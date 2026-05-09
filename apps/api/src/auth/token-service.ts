import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../infra/env.js";
import { redis } from "../infra/redis.js";

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
  try {
    await redis.set(refreshKey(rawToken), userId, "EX", env.jwtRefreshTtlSeconds);
  } catch {
    setMemoryRefreshToken(rawToken, userId);
  }
}

export async function consumeRefreshToken(rawToken: string): Promise<string | null> {
  try {
    const key = refreshKey(rawToken);
    const userId = await redis.get(key);
    if (!userId) {
      return null;
    }
    await redis.del(key);
    return userId;
  } catch {
    const userId = getMemoryRefreshToken(rawToken);
    if (!userId) {
      return null;
    }
    memoryRefreshTokens.delete(refreshKey(rawToken));
    return userId;
  }
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  try {
    await redis.del(refreshKey(rawToken));
  } catch {
    memoryRefreshTokens.delete(refreshKey(rawToken));
  }
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  try {
    const stream = redis.scanStream({
      match: `${REFRESH_PREFIX}*`,
      count: 200,
    });

    for await (const keys of stream) {
      if (!Array.isArray(keys) || keys.length === 0) {
        continue;
      }
      const values = await redis.mget(...keys);
      const matchedKeys = keys.filter((_, idx) => values[idx] === userId);
      if (matchedKeys.length > 0) {
        await redis.del(...matchedKeys);
      }
    }
  } catch {
    for (const [key, entry] of memoryRefreshTokens.entries()) {
      if (entry.userId === userId) {
        memoryRefreshTokens.delete(key);
      }
    }
  }
}
