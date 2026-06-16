import { Router, type Request, type Response } from "express";
import argon2 from "argon2";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";
import { env } from "../infra/env.js";
import { generatePassword, isStrongPassword } from "../auth/password-utils.js";
import { isUniqueViolation } from "./errors.js";

export const assistantRouter = Router();

async function generateAssistantId(): Promise<string> {
  for (let index = 0; index < 20; index += 1) {
    const candidate = "9" + String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0");
    const exists = await prisma.user.findUnique({
      where: { id: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
  }
  throw new Error("Unable to generate unique assistant id");
}

assistantRouter.post("/assistants", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== "teacher") {
    return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Only teachers can create assistants" });
  }

  const { id, realName, defaultPassword } = req.body ?? {};

  if (id !== undefined && id !== null && (!/^\d{10}$/.test(String(id)))) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "id must be a 10-digit string when provided" });
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

  const assistantId = typeof id === "string" && id.trim() ? id.trim() : await generateAssistantId();
  const temporaryPassword = defaultPassword ?? generatePassword();
  const passwordHash = await argon2.hash(temporaryPassword);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: assistantId,
          passwordHash,
          role: "assistant",
          forceChangePassword: true,
          profile: { create: { realName: realName.trim(), avatarUrl: env.defaultAvatarUrl } },
        },
      });
      await tx.teacherAssistant.create({
        data: { teacherUserId: req.user!.id, assistantUserId: assistantId },
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
      id: assistantId,
      temporaryPassword,
      forceChangePassword: true,
    },
  });
});

assistantRouter.get("/assistants/mine", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== "teacher") {
    return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Only teachers can view owned assistants" });
  }

  const rows = await prisma.teacherAssistant.findMany({
    where: { teacherUserId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      assistantUserId: true,
      assistant: {
        select: {
          id: true,
          isActive: true,
          forceChangePassword: true,
          profile: {
            select: {
              realName: true,
              accountNo: true,
            },
          },
          _count: {
            select: {
              assistantBindingsAsAssistant: true,
            },
          },
        },
      },
    },
  });

  return res.json({
    ok: true,
    data: rows.map((row) => ({
      id: row.assistant.id,
      assistantUserId: row.assistantUserId,
      realName: row.assistant.profile?.realName ?? "",
      accountNo: row.assistant.profile?.accountNo ?? row.assistant.id,
      isActive: row.assistant.isActive,
      forceChangePassword: row.assistant.forceChangePassword,
      boundCourseCount: row.assistant._count.assistantBindingsAsAssistant,
      createdAt: row.createdAt,
    })),
  });
});

assistantRouter.patch("/assistants/:assistantUserId", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== "teacher") {
    return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Only teachers can manage owned assistants" });
  }

  const assistantUserId = String(req.params.assistantUserId || "").trim();
  if (!/^\d{10}$/.test(assistantUserId)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "assistantUserId must be a 10-digit string" });
  }

  const binding = await prisma.teacherAssistant.findUnique({
    where: { assistantUserId },
    select: { teacherUserId: true },
  });
  if (!binding || binding.teacherUserId !== req.user!.id) {
    return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Target is not your assistant" });
  }

  const { realName, isActive } = req.body ?? {};
  if (realName === undefined && isActive === undefined) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Provide realName or isActive" });
  }
  if (realName !== undefined && (typeof realName !== "string" || !realName.trim())) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "realName must be a non-empty string" });
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "isActive must be a boolean" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (realName !== undefined) {
      await tx.userProfile.upsert({
        where: { userId: assistantUserId },
        update: { realName: realName.trim() },
        create: { userId: assistantUserId, realName: realName.trim(), avatarUrl: env.defaultAvatarUrl },
      });
    }

    if (isActive !== undefined) {
      await tx.user.update({
        where: { id: assistantUserId },
        data: { isActive },
      });
      if (!isActive) {
        await tx.assistantBinding.deleteMany({
          where: { assistantUserId },
        });
      }
    }

    return tx.user.findUniqueOrThrow({
      where: { id: assistantUserId },
      select: {
        id: true,
        isActive: true,
        forceChangePassword: true,
        profile: { select: { realName: true, accountNo: true } },
        _count: { select: { assistantBindingsAsAssistant: true } },
      },
    });
  });

  return res.json({
    ok: true,
    data: {
      id: updated.id,
      assistantUserId,
      realName: updated.profile?.realName ?? "",
      accountNo: updated.profile?.accountNo ?? updated.id,
      isActive: updated.isActive,
      forceChangePassword: updated.forceChangePassword,
      boundCourseCount: updated._count.assistantBindingsAsAssistant,
    },
  });
});
