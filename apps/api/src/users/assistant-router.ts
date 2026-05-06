import { Router, type Request, type Response } from "express";
import argon2 from "argon2";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";
import { env } from "../infra/env.js";
import { generatePassword, isStrongPassword } from "../auth/password-utils.js";
import { isUniqueViolation } from "./errors.js";

export const assistantRouter = Router();

assistantRouter.post("/assistants", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== "teacher") {
    return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Only teachers can create assistants" });
  }

  const { id, realName, defaultPassword } = req.body ?? {};

  if (!id || !/^\d{10}$/.test(id)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "id must be a 10-digit string" });
  }
  if (!realName || typeof realName !== "string" || realName.trim() === "") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "realName is required" });
  }
  if (defaultPassword !== undefined && !isStrongPassword(defaultPassword)) {
    return res.status(422).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "defaultPassword must be 8-72 characters and contain uppercase, lowercase, and a digit",
    });
  }

  const temporaryPassword = defaultPassword ?? generatePassword();
  const passwordHash = await argon2.hash(temporaryPassword);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          passwordHash,
          role: "assistant",
          forceChangePassword: true,
          profile: { create: { realName: realName.trim(), avatarUrl: env.defaultAvatarUrl } },
        },
      });
      await tx.teacherAssistant.create({
        data: { teacherUserId: req.user!.id, assistantUserId: id },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ ok: false, code: "CONFLICT", message: "User ID already exists" });
    }
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to create assistant account" });
  }

  return res.status(201).json({
    ok: true,
    data: {
      id,
      temporaryPassword,
      forceChangePassword: true,
    },
  });
});
