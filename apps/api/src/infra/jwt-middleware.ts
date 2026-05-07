import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "./env.js";

export type AuthUser = {
  id: string;
  role: string;
  forceChangePassword: boolean;
};

// 扩展 Express Request，附加已鉴权用户信息
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** 尝试解析 Bearer Token，成功则挂 req.user，失败/缺失则跳过（不拒绝请求） */
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
    // 无效 token 忽略，req.user 保持 undefined
  }
  next();
}

/** 强制改密门卫：已登录且 forceChangePassword=true 时，除 change-password 外所有接口返回 403 */
export function forceChangeGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.forceChangePassword && req.path !== "/api/v1/auth/change-password") {
    res.status(403).json({
      ok: false,
      code: "FORCE_CHANGE_PASSWORD",
      message: "请修改默认密码后重试",
    });
    return;
  }
  next();
}

/** Bearer Token 鉴权中间件，验证失败直接返回 401 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, code: "UNAUTHENTICATED", message: "Missing or malformed token" });
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
    res.status(401).json({ ok: false, code: "UNAUTHENTICATED", message: "Invalid or expired token" });
  }
}
