import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

export async function runRedis<T>(
  operation: () => Promise<T>,
  fallback: () => T | Promise<T>,
  timeoutMs = 750,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Redis operation timed out")), timeoutMs);
      }),
    ]);
  } catch {
    return fallback();
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
