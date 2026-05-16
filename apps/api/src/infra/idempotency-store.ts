import { redis } from "./redis.js";

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export async function getIdempotentResponse<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveIdempotentResponse<T>(key: string, value: T): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", IDEMPOTENCY_TTL_SECONDS);
}

