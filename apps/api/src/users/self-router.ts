import { Router, type Request, type Response } from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";
import { minioClient, buildPublicUrl, extractObjectName } from "../infra/minio.js";
import { env } from "../infra/env.js";

export const selfRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only jpeg/png/webp/gif images are allowed"));
    }
  },
});

function parseAvatarUpload(req: Request, res: Response, next: (err?: unknown) => void): void {
  if (!req.is("multipart/form-data")) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Use multipart/form-data and field name 'avatar'",
    });
    return;
  }
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Invalid avatar file. Only jpeg/png/webp/gif up to 5MB are allowed",
      });
      return;
    }
    next();
  });
}

async function getRequiredProfileSeed(userId: string): Promise<{ realName: string; avatarUrl: string | null } | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { realName: true, avatarUrl: true },
  });

  if (!profile || profile.realName.trim() === "") {
    return null;
  }

  return profile;
}

selfRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      forceChangePassword: true,
      lastLoginAt: true,
      profile: {
        select: {
          realName: true,
          accountNo: true,
          avatarUrl: true,
          bio: true,
          location: true,
          email: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", message: "User not found" });
  }

  return res.json({
    ok: true,
    data: {
      id: user.id,
      role: user.role,
      forceChangePassword: user.forceChangePassword,
      lastLoginAt: user.lastLoginAt,
      profile: {
        realName: user.profile?.realName ?? null,
        accountNo: user.profile?.accountNo ?? null,
        avatarUrl: user.profile?.avatarUrl ?? env.defaultAvatarUrl,
        bio: user.profile?.bio ?? null,
        location: user.profile?.location ?? null,
        email: user.profile?.email ?? null,
      },
    },
  });
});

selfRouter.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { realName, bio, location, email } = req.body ?? {};

  const forbiddenSelfFields = ["stuNo", "grade", "cohort", "major", "adminClass", "teacherNo", "title", "college"];
  const forbiddenHit = forbiddenSelfFields.find((k) => req.body?.[k] !== undefined);
  if (forbiddenHit) {
    return res.status(403).json({
      ok: false,
      code: "FORBIDDEN",
      message: `Field '${forbiddenHit}' cannot be modified by current user`,
    });
  }

  if ([realName, bio, location, email].every((v) => v === undefined)) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "At least one field is required",
    });
  }

  const updateData = {
    ...(realName !== undefined && { realName }),
    ...(bio !== undefined && { bio }),
    ...(location !== undefined && { location }),
    ...(email !== undefined && { email }),
  };

  const profileSeed = await getRequiredProfileSeed(userId);
  if (!profileSeed && realName === undefined) {
    return res.status(409).json({
      ok: false,
      code: "CONFLICT",
      message: "Profile record is incomplete. Provide realName to repair it before updating other fields.",
    });
  }

  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, realName: realName ?? profileSeed!.realName, ...updateData },
    update: updateData,
  });

  return res.json({ ok: true, message: "Profile updated" });
});

selfRouter.post("/me/avatar", requireAuth, parseAvatarUpload, async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "No file uploaded. Use multipart/form-data with field name 'avatar'",
    });
  }

  const userId = req.user!.id;

  const profileSeed = await getRequiredProfileSeed(userId);
  if (!profileSeed) {
    return res.status(409).json({
      ok: false,
      code: "CONFLICT",
      message: "Profile record is incomplete. Repair the profile before uploading an avatar.",
    });
  }

  const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
  const objectName = `${userId}/${crypto.randomUUID()}${ext}`;

  await minioClient.putObject(
    env.minioBucketAvatars,
    objectName,
    req.file.buffer,
    req.file.size,
    { "Content-Type": req.file.mimetype },
  );

  const avatarUrl = buildPublicUrl(objectName);

  try {
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, realName: profileSeed.realName, avatarUrl },
      update: { avatarUrl },
    });
  } catch (error) {
    await minioClient.removeObject(env.minioBucketAvatars, objectName).catch(() => {});
    throw error;
  }

  if (profileSeed.avatarUrl) {
    const oldObjectName = extractObjectName(profileSeed.avatarUrl);
    if (oldObjectName && oldObjectName !== objectName) {
      await minioClient.removeObject(env.minioBucketAvatars, oldObjectName).catch(() => {});
    }
  }

  return res.json({ ok: true, data: { avatarUrl } });
});
