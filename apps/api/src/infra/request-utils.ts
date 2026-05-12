import type { Request } from "express";

export function parseLimitOffset(query: Record<string, unknown>, defaults = { limit: 20, maxLimit: 100 }) {
  const limitRaw = Number(query.limit ?? defaults.limit);
  const offsetRaw = Number(query.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(defaults.maxLimit, Math.max(1, Math.floor(limitRaw))) : defaults.limit;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;
  return { limit, offset };
}

export function parseIdempotencyKey(req: Request): string | null {
  const key = req.header("Idempotency-Key");
  if (!key || key.length > 64) return null;
  return key;
}
