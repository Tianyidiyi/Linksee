import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../infra/env.js";
import { redis } from "../infra/redis.js";

const REFRESH_PREFIX = "rt:";

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
  await redis.set(refreshKey(rawToken), userId, "EX", env.jwtRefreshTtlSeconds);
}

export async function consumeRefreshToken(rawToken: string): Promise<string | null> {
  const key = refreshKey(rawToken);
  const userId = await redis.get(key);
  if (!userId) {
    return null;
  }
  await redis.del(key);
  return userId;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await redis.del(refreshKey(rawToken));
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await revokeAllRefreshTokensForUsers([userId]);
}

export async function revokeAllRefreshTokensForUsers(userIds: string[]): Promise<void> {
  const targetUserIds = new Set(userIds);
  if (targetUserIds.size === 0) {
    return;
  }

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
}
