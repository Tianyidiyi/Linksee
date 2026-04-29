import argon2 from "argon2";
import { Router, type Request, type Response } from "express";
import { prisma } from "../infra/prisma.js";
import {
  clearLoginFailures,
  isLoginLocked,
  recordLoginFailure,
} from "./login-rate-limit.js";
import {
  createRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  storeRefreshToken,
  consumeRefreshToken,
} from "./token-service.js";
import type {
  LoginRequestBody,
  LogoutRequestBody,
  RefreshRequestBody,
} from "./types.js";

function invalidCredentials(res: Response): void {
  res.status(401).json({
    ok: false,
    code: "UNAUTHENTICATED",
    message: "Invalid userId or password",
  });
}

function isValidUserId(value: string): boolean {
  return /^\d{10}$/.test(value);
}

export const authRouter = Router();

authRouter.post(
  "/login",
  async (req: Request<unknown, unknown, LoginRequestBody>, res: Response) => {
    const { userId, password } = req.body ?? {};
    if (!userId || !password || !isValidUserId(userId)) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "userId must be 10 digits and password is required",
      });
    }

    if (await isLoginLocked(userId)) {
      return res.status(423).json({
        ok: false,
        code: "FORBIDDEN",
        message: "Too many failed attempts. Try again later.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      await recordLoginFailure(userId);
      return invalidCredentials(res);
    }

    const passwordOk = await argon2.verify(user.passwordHash, password);
    if (!passwordOk) {
      await recordLoginFailure(userId);
      return invalidCredentials(res);
    }

    await clearLoginFailures(userId);

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      forceChangePassword: user.forceChangePassword,
    });
    const refreshToken = createRefreshToken();
    await storeRefreshToken(refreshToken, user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return res.json({
      ok: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: "30m",
        forceChangePassword: user.forceChangePassword,
      },
    });
  },
);

authRouter.post(
  "/refresh",
  async (req: Request<unknown, unknown, RefreshRequestBody>, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "refreshToken is required",
      });
    }

    const userId = await consumeRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        code: "UNAUTHENTICATED",
        message: "Invalid or expired refresh token",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({
        ok: false,
        code: "UNAUTHENTICATED",
        message: "User not found or disabled",
      });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      forceChangePassword: user.forceChangePassword,
    });
    const nextRefreshToken = createRefreshToken();
    await storeRefreshToken(nextRefreshToken, user.id);

    return res.json({
      ok: true,
      data: {
        accessToken,
        refreshToken: nextRefreshToken,
        expiresIn: "30m",
      },
    });
  },
);

authRouter.post(
  "/logout",
  async (req: Request<unknown, unknown, LogoutRequestBody>, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "refreshToken is required",
      });
    }

    await revokeRefreshToken(refreshToken);
    return res.json({ ok: true });
  },
);
