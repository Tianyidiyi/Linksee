import { redis, runRedis } from "../infra/redis.js";

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
  const attempts = Number(await runRedis(
    () => redis.get(lockKey(userId)),
    () => String(getMemoryAttempts(userId)),
  ));
  return Number.isFinite(attempts) && attempts >= MAX_ATTEMPTS;
}

export async function recordLoginFailure(userId: string): Promise<void> {
  const key = lockKey(userId);
  let usedMemoryFallback = false;
  const current = await runRedis(
    () => redis.incr(key),
    () => {
      usedMemoryFallback = true;
      const next = getMemoryAttempts(userId) + 1;
      setMemoryAttempts(userId, next);
      return next;
    },
  );
  if (current === 1) {
    await runRedis(
      () => redis.expire(key, LOCK_SECONDS),
      () => 0,
    );
  }
  if (!usedMemoryFallback) memoryAttempts.delete(userId);
}

export async function clearLoginFailures(userId: string): Promise<void> {
  await runRedis(
    () => redis.del(lockKey(userId)),
    () => 0,
  );
  memoryAttempts.delete(userId);
}
