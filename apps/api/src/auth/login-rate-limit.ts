import { redis } from "../infra/redis.js";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 15 * 60;

function lockKey(userId: string): string {
  return `rate:login:${userId}`;
}

export async function isLoginLocked(userId: string): Promise<boolean> {
  const attempts = Number(await redis.get(lockKey(userId)));
  return Number.isFinite(attempts) && attempts >= MAX_ATTEMPTS;
}

export async function recordLoginFailure(userId: string): Promise<void> {
  const key = lockKey(userId);
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, LOCK_SECONDS);
  }
}

export async function clearLoginFailures(userId: string): Promise<void> {
  await redis.del(lockKey(userId));
}
