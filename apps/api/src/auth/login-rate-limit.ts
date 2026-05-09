import { redis } from "../infra/redis.js";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 15 * 60;
const memoryAttempts = new Map<string, { count: number; expiresAt: number }>();

function lockKey(userId: string): string {
  return `rate:login:${userId}`;
}

function getMemoryAttempts(userId: string): number {
  const entry = memoryAttempts.get(userId);
  if (!entry) {
    return 0;
  }
  if (Date.now() > entry.expiresAt) {
    memoryAttempts.delete(userId);
    return 0;
  }
  return entry.count;
}

function setMemoryAttempts(userId: string, count: number): void {
  memoryAttempts.set(userId, {
    count,
    expiresAt: Date.now() + LOCK_SECONDS * 1000,
  });
}

export async function isLoginLocked(userId: string): Promise<boolean> {
  try {
    const attempts = Number(await redis.get(lockKey(userId)));
    return Number.isFinite(attempts) && attempts >= MAX_ATTEMPTS;
  } catch {
    return getMemoryAttempts(userId) >= MAX_ATTEMPTS;
  }
}

export async function recordLoginFailure(userId: string): Promise<void> {
  try {
    const key = lockKey(userId);
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, LOCK_SECONDS);
    }
  } catch {
    const current = getMemoryAttempts(userId) + 1;
    setMemoryAttempts(userId, current);
  }
}

export async function clearLoginFailures(userId: string): Promise<void> {
  try {
    await redis.del(lockKey(userId));
  } catch {
    memoryAttempts.delete(userId);
  }
}
