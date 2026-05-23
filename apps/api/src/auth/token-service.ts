import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../infra/env.js";
import { redis, runRedis } from "../infra/redis.js";

const REFRESH_PREFIX = "rt:";
const memoryRefreshTokens = new Map<string, { userId: string; expiresAt: number }>();

type AccessPayload = {
  sub: string;
  role: string;
  forceChangePassword: boolean;
};

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function refreshKey(rawToken: string): string {
  return `${REFRESH_PREFIX}${hashToken(rawToken)}`;
}

function getMemoryRefreshToken(rawToken: string): string | null {
  const key = refreshKey(rawToken);
  const entry = memoryRefreshTokens.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    memoryRefreshTokens.delete(key);
    return null;
  }
  return entry.userId;
}

function setMemoryRefreshToken(rawToken: string, userId: string): void {
  const key = refreshKey(rawToken);
  memoryRefreshTokens.set(key, {
    userId,
    expiresAt: Date.now() + env.jwtRefreshTtlSeconds * 1000,
  });
}

export function signAccessToken(payload: AccessPayload): string {
  const expiresIn = env.jwtAccessExpiresIn as SignOptions["expiresIn"];
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn,
  });
}

export function createRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function storeRefreshToken(rawToken: string, userId: string): Promise<void> {
  let usedMemoryFallback = false;
  await runRedis(
    () => redis.set(refreshKey(rawToken), userId, "EX", env.jwtRefreshTtlSeconds),
    () => {
      usedMemoryFallback = true;
      setMemoryRefreshToken(rawToken, userId);
      return "OK";
    },
  );
  if (!usedMemoryFallback) {
    memoryRefreshTokens.delete(refreshKey(rawToken));
  }
}

export async function consumeRefreshToken(rawToken: string): Promise<string | null> {
  const key = refreshKey(rawToken);
  let usedMemoryFallback = false;
  const userId = await runRedis(
    () => redis.get(key),
    () => {
      usedMemoryFallback = true;
      return getMemoryRefreshToken(rawToken);
    },
  );
  if (!userId) {
    return null;
  }
  if (usedMemoryFallback) {
    memoryRefreshTokens.delete(key);
  } else {
    await runRedis(
      () => redis.del(key),
      () => {
        memoryRefreshTokens.delete(key);
        return 0;
      },
    );
  }
  return userId;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const key = refreshKey(rawToken);
  await runRedis(
    () => redis.del(key),
    () => 0,
  );
  memoryRefreshTokens.delete(key);
}

async function revokeAllRefreshTokensForTargetUsers(userIds: string[]): Promise<void> {
  const targetUserIds = new Set(userIds);
  if (targetUserIds.size === 0) {
    return;
  }

  await runRedis(
    async () => {
      const stream = redis.scanStream({
        match: `${REFRESH_PREFIX}*`,
        count: 200,
      });

      for await (const keys of stream) {
        if (!Array.isArray(keys) || keys.length === 0) {
          continue;
        }

        const values = await redis.mget(...keys);
        const matchedKeys = keys.filter((_, idx) => {
          const storedUserId = values[idx];
          return typeof storedUserId === "string" && targetUserIds.has(storedUserId);
        });

        if (matchedKeys.length > 0) {
          await redis.del(...matchedKeys);
        }
      }
    },
    () => undefined,
    1500,
  );

  for (const [key, entry] of memoryRefreshTokens.entries()) {
    if (targetUserIds.has(entry.userId)) {
      memoryRefreshTokens.delete(key);
    }
  }
}

export async function revokeAllRefreshTokensForUsers(userIds: string[]): Promise<void> {
  await revokeAllRefreshTokensForTargetUsers(userIds);
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await revokeAllRefreshTokensForTargetUsers([userId]);
}
