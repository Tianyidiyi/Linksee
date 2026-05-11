import type { Response } from "express";

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "FORCE_CHANGE_PASSWORD";

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}

export function fail(res: Response, status: number, code: ErrorCode, message: string, details?: unknown): void {
  const getHeader = (res as Response & { getHeader?: (name: string) => unknown }).getHeader;
  const requestId = typeof getHeader === "function" ? getHeader.call(res, "x-request-id") ?? null : null;
  res.status(status).json({
    ok: false,
    code,
    message,
    details: details ?? null,
    requestId,
  });
}
