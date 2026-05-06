import argon2 from "argon2";
import { Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";
import { generatePassword, isStrongPassword } from "./password-utils.js";
import {
  clearLoginFailures,
  isLoginLocked,
  recordLoginFailure,
} from "./login-rate-limit.js";
import {
  createRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
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
        code: "ACCOUNT_LOCKED",
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

authRouter.post(
  "/change-password",
  requireAuth,
  async (req: Request<unknown, unknown, { currentPassword: string; newPassword: string }>, res: Response) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "currentPassword and newPassword are required",
      });
    }

    // newPassword 强度校验：8-72字符，至少含大写、小写、数字各一
    if (!isStrongPassword(newPassword)) {
      return res.status(422).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "newPassword must be 8-72 characters and contain uppercase, lowercase, and a digit",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", message: "User not found" });
    }

    const currentOk = await argon2.verify(user.passwordHash, currentPassword);
    if (!currentOk) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Current password is incorrect" });
    }

    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, forceChangePassword: false },
    });

    // 撤销所有 refresh token，强制重新登录
    await revokeAllUserRefreshTokens(userId);

    // 签发新 AT + RT，避免旧 JWT 中 forceChangePassword=true 导致门卫继续拦截
    const accessToken = signAccessToken({ sub: userId, role: user.role, forceChangePassword: false });
    const refreshToken = createRefreshToken();
    await storeRefreshToken(refreshToken, userId);

    return res.json({ ok: true, data: { accessToken, refreshToken, expiresIn: "30m" } });
  },
);

// ──────────────────────────────────────────────
// POST /api/v1/auth/admin/reset-password
// 单个用户重置密码
//   academic 可重置任意用户
//   teacher  只能重置自己创建的助教（assistant_bindings 有记录）
// ──────────────────────────────────────────────
authRouter.post(
  "/admin/reset-password",
  requireAuth,
  async (req: Request, res: Response) => {
    const requesterRole = req.user!.role;
    const requesterId  = req.user!.id;

    if (requesterRole !== "academic" && requesterRole !== "teacher") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Insufficient role" });
    }

    const { targetUserId, newPassword } = req.body ?? {};
    if (!targetUserId || typeof targetUserId !== "string") {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "targetUserId is required" });
    }
    if (newPassword !== undefined && !isStrongPassword(newPassword)) {
      return res.status(422).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "newPassword must be 8-72 characters and contain uppercase, lowercase, and a digit",
      });
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || !target.isActive) {
      return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", message: "Target user not found" });
    }

    // teacher 只能重置自己在 teacher_assistants 中的助教
    if (requesterRole === "teacher") {
      const binding = await prisma.teacherAssistant.findUnique({
        where: { assistantUserId: targetUserId },
      });
      if (!binding || binding.teacherUserId !== requesterId) {
        return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Target is not your assistant" });
      }
    }

    const temporaryPassword = newPassword ?? generatePassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash, forceChangePassword: true },
    });
    await revokeAllUserRefreshTokens(targetUserId);

    return res.json({
      ok: true,
      data: { temporaryPassword, forceChangePassword: true },
    });
  },
);

// ──────────────────────────────────────────────
// POST /api/v1/auth/admin/batch-reset-password
// 按条件批量重置密码（academic 专属）
//
// Body:
//   newPassword?  string   — 不传则随机生成
//   userIds?      string[] — 精确指定用户ID列表（优先）
//   以下为学生筛选条件（role=student 时有效，可组合）：
//   grade?        number   — 入学年份，如 2023
//   cohort?       number   — 预计毕业年份，如 2027
//   adminClass?   string   — 行政班，如 "软工2301"
//   major?        string   — 专业，如 "软件工程"
//
// 至少提供 userIds 或一个筛选条件。
// ──────────────────────────────────────────────
authRouter.post(
  "/admin/batch-reset-password",
  requireAuth,
  async (req: Request, res: Response) => {
    if (req.user!.role !== "academic") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Only academic can batch reset" });
    }

    const { newPassword, userIds, grade, cohort, adminClass, major } = req.body ?? {};
    const batchAllowedRoles: Role[] = ["teacher", "student"];

    if (newPassword !== undefined && !isStrongPassword(newPassword)) {
      return res.status(422).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "newPassword must be 8-72 characters and contain uppercase, lowercase, and a digit",
      });
    }

    // 至少有一种筛选方式
    const hasFilter = (Array.isArray(userIds) && userIds.length > 0)
      || grade !== undefined || cohort !== undefined
      || adminClass !== undefined || major !== undefined;
    if (!hasFilter) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Provide at least one of: userIds, grade, cohort, adminClass, major",
      });
    }

    let targetIds: string[];

    if (Array.isArray(userIds) && userIds.length > 0) {
      // 精确指定 ID 列表，并限制角色仅 teacher/student
      const normalizedIds = userIds.filter((id: unknown) => typeof id === "string" && /^\d{10}$/.test(id));
      const users = await prisma.user.findMany({
        where: {
          id: { in: normalizedIds },
          role: { in: batchAllowedRoles },
          isActive: true,
        },
        select: { id: true },
      });
      targetIds = users.map((u) => u.id);
    } else {
      // 按学生档案字段筛选
      const profileFilter: Record<string, unknown> = {};
      if (grade !== undefined)      profileFilter.grade      = Number(grade);
      if (cohort !== undefined)     profileFilter.cohort     = Number(cohort);
      if (adminClass !== undefined) profileFilter.adminClass = adminClass;
      if (major !== undefined)      profileFilter.major      = major;

      const profiles = await prisma.studentProfile.findMany({
        where: profileFilter,
        select: { userId: true },
      });
      targetIds = profiles.map((p) => p.userId);
    }

    if (targetIds.length === 0) {
      return res.json({ ok: true, data: { defaultPassword: null, affectedCount: 0 } });
    }

    const defaultPassword = newPassword ?? generatePassword();
    const passwordHash = await argon2.hash(defaultPassword);

    const { count } = await prisma.user.updateMany({
      where: { id: { in: targetIds }, role: { in: batchAllowedRoles }, isActive: true },
      data: { passwordHash, forceChangePassword: true },
    });

    return res.json({
      ok: true,
      data: { defaultPassword, affectedCount: count, forceChangePassword: true },
    });
  },
);
