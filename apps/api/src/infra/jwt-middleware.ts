import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "./env.js";
import { fail } from "./http-response.js";

export type AuthUser = {
  id: string;
  role: string;
  forceChangePassword: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as {
      sub: string;
      role: string;
      forceChangePassword: boolean;
    };
    req.user = { id: payload.sub, role: payload.role, forceChangePassword: payload.forceChangePassword };
  } catch {
    // ignore invalid optional token
  }
  next();
}

export function forceChangeGuard(req: Request, res: Response, next: NextFunction): void {
  const passThrough = new Set([
    "/api/v1/auth/change-password",
    "/api/v1/auth/logout",
    "/api/v1/auth/refresh",
  ]);
  if (req.user?.forceChangePassword && !passThrough.has(req.path)) {
    fail(res, 403, "FORCE_CHANGE_PASSWORD", "Password reset required before accessing other resources");
    return;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    fail(res, 401, "UNAUTHENTICATED", "Missing or malformed token");
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as {
      sub: string;
      role: string;
      forceChangePassword: boolean;
    };
    req.user = { id: payload.sub, role: payload.role, forceChangePassword: payload.forceChangePassword };
    next();
  } catch {
    fail(res, 401, "UNAUTHENTICATED", "Invalid or expired token");
  }
}
