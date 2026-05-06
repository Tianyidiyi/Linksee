import { Role } from "@prisma/client";
import argon2 from "argon2";
import { Router, type Request, type Response } from "express";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";
import { env } from "../infra/env.js";
import { generatePassword, isStrongPassword } from "../auth/password-utils.js";
import { isUniqueViolation } from "./errors.js";

export const adminRouter = Router();

function ensureAcademic(req: Request, res: Response): boolean {
  if (req.user?.role !== "academic") {
    res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Only academic can perform this action" });
    return false;
  }
  return true;
}

async function createTeacherOrStudent(params: {
  id: string;
  role: Role;
  realName: string;
  temporaryPassword: string;
  studentProfile?: { stuNo: string; grade: number; cohort: number; major: string; adminClass: string };
  teacherProfile?: { teacherNo: string; title: string; college: string; researchDirection?: string };
}): Promise<void> {
  const passwordHash = await argon2.hash(params.temporaryPassword);

  const accountNo = params.role === "student"
    ? params.studentProfile?.stuNo
    : params.teacherProfile?.teacherNo;

  await prisma.user.create({
    data: {
      id: params.id,
      passwordHash,
      role: params.role,
      forceChangePassword: true,
      profile: {
        create: {
          realName: params.realName.trim(),
          avatarUrl: env.defaultAvatarUrl,
          accountNo: accountNo ?? null,
        },
      },
      ...(params.role === "student" && params.studentProfile
        ? {
            studentProfile: {
              create: {
                stuNo: params.studentProfile.stuNo,
                grade: params.studentProfile.grade,
                cohort: params.studentProfile.cohort,
                major: params.studentProfile.major,
                adminClass: params.studentProfile.adminClass,
              },
            },
          }
        : {}),
      ...(params.role === "teacher" && params.teacherProfile
        ? {
            teacherProfile: {
              create: {
                teacherNo: params.teacherProfile.teacherNo,
                title: params.teacherProfile.title,
                college: params.teacherProfile.college,
                researchDirection: params.teacherProfile.researchDirection,
              },
            },
          }
        : {}),
    },
  });
}

adminRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  if (!ensureAcademic(req, res)) return;

  const {
    id,
    role,
    realName,
    defaultPassword,
    stuNo,
    grade,
    cohort,
    major,
    adminClass,
    teacherNo,
    title,
    college,
    researchDirection,
  } = req.body ?? {};

  if (!id || typeof id !== "string" || !/^\d{10}$/.test(id)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "id must be a 10-digit string" });
  }
  if (role !== "student" && role !== "teacher") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "role must be student or teacher" });
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

  if (role === "student") {
    if (!stuNo || grade === undefined || cohort === undefined || !major || !adminClass) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "student requires stuNo, grade, cohort, major, adminClass",
      });
    }
  }

  if (role === "teacher") {
    if (!teacherNo || !title || !college) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "teacher requires teacherNo, title, college",
      });
    }
  }

  const temporaryPassword = defaultPassword ?? generatePassword();

  try {
    await createTeacherOrStudent({
      id,
      role,
      realName,
      temporaryPassword,
      ...(role === "student"
        ? { studentProfile: { stuNo, grade: Number(grade), cohort: Number(cohort), major, adminClass } }
        : {}),
      ...(role === "teacher"
        ? { teacherProfile: { teacherNo, title, college, researchDirection } }
        : {}),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ ok: false, code: "CONFLICT", message: "User or profile unique field already exists" });
    }
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to create user" });
  }

  return res.status(201).json({
    ok: true,
    data: { id, role, temporaryPassword, forceChangePassword: true },
  });
});

adminRouter.post("/batch/students", requireAuth, async (req: Request, res: Response) => {
  if (!ensureAcademic(req, res)) return;

  const { students, defaultPassword } = req.body ?? {};
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "students must be a non-empty array" });
  }
  if (defaultPassword !== undefined && !isStrongPassword(defaultPassword)) {
    return res.status(422).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "defaultPassword must be 8-72 characters and contain uppercase, lowercase, and a digit",
    });
  }

  const batchPassword = defaultPassword ?? generatePassword();
  const failed: Array<{ id: string; reason: string }> = [];
  let createdCount = 0;

  for (const item of students) {
    const id = String(item?.id ?? "");
    const realName = String(item?.realName ?? "");
    const stuNo = String(item?.stuNo ?? "");
    const major = String(item?.major ?? "");
    const adminClass = String(item?.adminClass ?? "");
    const grade = Number(item?.grade);
    const cohort = Number(item?.cohort);

    if (!/^\d{10}$/.test(id) || !realName || !stuNo || !major || !adminClass || Number.isNaN(grade) || Number.isNaN(cohort)) {
      failed.push({ id: id || "(unknown)", reason: "invalid required fields" });
      continue;
    }

    try {
      await createTeacherOrStudent({
        id,
        role: "student",
        realName,
        temporaryPassword: batchPassword,
        studentProfile: { stuNo, grade, cohort, major, adminClass },
      });
      createdCount += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        failed.push({ id, reason: "duplicate id or profile unique field" });
      } else {
        failed.push({ id, reason: "internal error" });
      }
    }
  }

  return res.json({
    ok: true,
    data: {
      defaultPassword: batchPassword,
      createdCount,
      failedCount: failed.length,
      failed,
      forceChangePassword: true,
    },
  });
});

adminRouter.post("/batch/teachers", requireAuth, async (req: Request, res: Response) => {
  if (!ensureAcademic(req, res)) return;

  const { teachers, defaultPassword } = req.body ?? {};
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "teachers must be a non-empty array" });
  }
  if (defaultPassword !== undefined && !isStrongPassword(defaultPassword)) {
    return res.status(422).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "defaultPassword must be 8-72 characters and contain uppercase, lowercase, and a digit",
    });
  }

  const batchPassword = defaultPassword ?? generatePassword();
  const failed: Array<{ id: string; reason: string }> = [];
  let createdCount = 0;

  for (const item of teachers) {
    const id = String(item?.id ?? "");
    const realName = String(item?.realName ?? "");
    const teacherNo = String(item?.teacherNo ?? "");
    const title = String(item?.title ?? "");
    const college = String(item?.college ?? "");
    const researchDirection = item?.researchDirection ? String(item.researchDirection) : undefined;

    if (!/^\d{10}$/.test(id) || !realName || !teacherNo || !title || !college) {
      failed.push({ id: id || "(unknown)", reason: "invalid required fields" });
      continue;
    }

    try {
      await createTeacherOrStudent({
        id,
        role: "teacher",
        realName,
        temporaryPassword: batchPassword,
        teacherProfile: { teacherNo, title, college, researchDirection },
      });
      createdCount += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        failed.push({ id, reason: "duplicate id or profile unique field" });
      } else {
        failed.push({ id, reason: "internal error" });
      }
    }
  }

  return res.json({
    ok: true,
    data: {
      defaultPassword: batchPassword,
      createdCount,
      failedCount: failed.length,
      failed,
      forceChangePassword: true,
    },
  });
});

adminRouter.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  if (!ensureAcademic(req, res)) return;

  const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!/^\d{10}$/.test(targetId)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "id must be a 10-digit string" });
  }
  if (req.body?.id !== undefined || req.body?.role !== undefined) {
    return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "id and role cannot be modified" });
  }

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
  if (!target) {
    return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", message: "User not found" });
  }

  const {
    isActive,
    realName,
    bio,
    location,
    email,
    accountNo,
    stuNo,
    grade,
    cohort,
    major,
    adminClass,
    teacherNo,
    title,
    college,
    researchDirection,
    description,
  } = req.body ?? {};

  const hasUpdate = [
    isActive,
    realName,
    bio,
    location,
    email,
    accountNo,
    stuNo,
    grade,
    cohort,
    major,
    adminClass,
    teacherNo,
    title,
    college,
    researchDirection,
    description,
  ].some((v) => v !== undefined);

  if (!hasUpdate) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "No updatable field provided" });
  }

  const hasStudentFields = [stuNo, grade, cohort, major, adminClass].some((v) => v !== undefined);
  const hasTeacherFields = [teacherNo, title, college, researchDirection, description].some((v) => v !== undefined);

  if (target.role === "student" && hasTeacherFields) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Teacher fields are not valid for student" });
  }
  if (target.role === "teacher" && hasStudentFields) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Student fields are not valid for teacher" });
  }

  if (target.role === "student" && hasStudentFields) {
    const studentProfile = await prisma.studentProfile.findUnique({ where: { userId: targetId }, select: { userId: true } });
    if (!studentProfile) {
      const requiredForCreate = [stuNo, grade, cohort, major, adminClass].every((v) => v !== undefined);
      if (!requiredForCreate) {
        return res.status(400).json({
          ok: false,
          code: "VALIDATION_FAILED",
          message: "Missing student profile; provide stuNo, grade, cohort, major, adminClass to initialize",
        });
      }
    }
  }

  if (target.role === "teacher" && hasTeacherFields) {
    const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: targetId }, select: { userId: true } });
    if (!teacherProfile) {
      const requiredForCreate = [teacherNo, title, college].every((v) => v !== undefined);
      if (!requiredForCreate) {
        return res.status(400).json({
          ok: false,
          code: "VALIDATION_FAILED",
          message: "Missing teacher profile; provide teacherNo, title, college to initialize",
        });
      }
    }
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "isActive must be a boolean" });
  }

  await prisma.$transaction(async (tx) => {
    if (isActive !== undefined) {
      await tx.user.update({ where: { id: targetId }, data: { isActive } });
    }

    const profileData = {
      ...(realName !== undefined && { realName }),
      ...(bio !== undefined && { bio }),
      ...(location !== undefined && { location }),
      ...(email !== undefined && { email }),
      ...(accountNo !== undefined && { accountNo }),
    };

    if (Object.keys(profileData).length > 0) {
      await tx.userProfile.upsert({
        where: { userId: targetId },
        create: { userId: targetId, realName: String(realName ?? ""), avatarUrl: env.defaultAvatarUrl, ...profileData },
        update: profileData,
      });
    }

    if (target.role === "student") {
      const studentData = {
        ...(stuNo !== undefined && { stuNo }),
        ...(grade !== undefined && { grade: Number(grade) }),
        ...(cohort !== undefined && { cohort: Number(cohort) }),
        ...(major !== undefined && { major }),
        ...(adminClass !== undefined && { adminClass }),
      };
      if (Object.keys(studentData).length > 0) {
        await tx.studentProfile.upsert({
          where: { userId: targetId },
          create: {
            userId: targetId,
            stuNo: String(stuNo ?? ""),
            grade: Number(grade ?? 0),
            cohort: Number(cohort ?? 0),
            major: String(major ?? ""),
            adminClass: String(adminClass ?? ""),
          },
          update: studentData,
        });
      }
    }

    if (target.role === "teacher") {
      const teacherData = {
        ...(teacherNo !== undefined && { teacherNo }),
        ...(title !== undefined && { title }),
        ...(college !== undefined && { college }),
        ...(researchDirection !== undefined && { researchDirection }),
        ...(description !== undefined && { description }),
      };
      if (Object.keys(teacherData).length > 0) {
        await tx.teacherProfile.upsert({
          where: { userId: targetId },
          create: {
            userId: targetId,
            teacherNo: String(teacherNo ?? ""),
            title: title !== undefined ? String(title) : null,
            college: college !== undefined ? String(college) : null,
            researchDirection: researchDirection !== undefined ? String(researchDirection) : null,
            description: description !== undefined ? String(description) : null,
          },
          update: teacherData,
        });
      }
    }
  });

  return res.json({ ok: true, data: { id: targetId, role: target.role } });
});
