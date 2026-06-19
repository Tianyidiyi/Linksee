import { Prisma, Role } from "@prisma/client";
import argon2 from "argon2";
import { Router, type Request, type Response } from "express";
import * as XLSX from "xlsx";
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

async function createAssistantForAcademic(params: {
  id: string;
  realName: string;
  temporaryPassword: string;
  ownerTeacherId: string;
}): Promise<void> {
  const passwordHash = await argon2.hash(params.temporaryPassword);

  await prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({
      where: { id: params.ownerTeacherId },
      select: { id: true, role: true },
    });
    if (!owner || owner.role !== Role.teacher) {
      throw new Error("OWNER_TEACHER_NOT_FOUND");
    }

    await tx.user.create({
      data: {
        id: params.id,
        passwordHash,
        role: Role.assistant,
        forceChangePassword: true,
        profile: {
          create: {
            realName: params.realName.trim(),
            avatarUrl: env.defaultAvatarUrl,
            accountNo: params.id,
          },
        },
      },
    });

    await tx.teacherAssistant.create({
      data: {
        teacherUserId: params.ownerTeacherId,
        assistantUserId: params.id,
      },
    });
  });
}

const USER_DIRECTORY_SELECT = {
  id: true,
  role: true,
  isActive: true,
  profile: {
    select: {
      realName: true,
      accountNo: true,
      avatarUrl: true,
      email: true,
    },
  },
  studentProfile: {
    select: {
      stuNo: true,
      grade: true,
      cohort: true,
      major: true,
      adminClass: true,
    },
  },
  teacherProfile: {
    select: {
      teacherNo: true,
      title: true,
      college: true,
      researchDirection: true,
      description: true,
    },
  },
  teacherAssistantsAsAssistant: {
    select: {
      teacherUserId: true,
      teacher: {
        select: {
          id: true,
          profile: {
            select: {
              realName: true,
              accountNo: true,
            },
          },
        },
      },
    },
  },
  _count: {
    select: {
      assistantBindingsAsAssistant: true,
    },
  },
} as const;

type UserDirectoryRow = Prisma.UserGetPayload<{
  select: typeof USER_DIRECTORY_SELECT;
}>;

function buildDirectoryWhere(query: Request["query"]) {
  const role = typeof query.role === "string" ? query.role : "";
  const keyword = typeof query.keyword === "string" ? query.keyword.trim() : "";
  const realName = typeof query.realName === "string" ? query.realName.trim() : "";
  const accountNo = typeof query.accountNo === "string" ? query.accountNo.trim() : "";
  const stuNo = typeof query.stuNo === "string" ? query.stuNo.trim() : "";
  const teacherNo = typeof query.teacherNo === "string" ? query.teacherNo.trim() : "";
  const major = typeof query.major === "string" ? query.major.trim() : "";
  const adminClass = typeof query.adminClass === "string" ? query.adminClass.trim() : "";
  const college = typeof query.college === "string" ? query.college.trim() : "";
  const title = typeof query.title === "string" ? query.title.trim() : "";
  const ownerTeacherName = typeof query.ownerTeacherName === "string" ? query.ownerTeacherName.trim() : "";
  const grade = typeof query.grade === "string" ? Number(query.grade) : undefined;
  const cohort = typeof query.cohort === "string" ? Number(query.cohort) : undefined;

  const where: Record<string, unknown> = {
    ...(role ? { role: role as Role } : { role: { in: [Role.student, Role.teacher, Role.assistant] } }),
  };

  if (realName) {
    where.profile = {
      is: {
        realName: { contains: realName },
      },
    };
  }

  if (keyword) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { id: { contains: keyword } },
          { profile: { is: { realName: { contains: keyword } } } },
          { profile: { is: { accountNo: { contains: keyword } } } },
          { studentProfile: { is: { stuNo: { contains: keyword } } } },
          { teacherProfile: { is: { teacherNo: { contains: keyword } } } },
        ],
      },
    ];
  }

  if (accountNo) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { id: { contains: accountNo } },
          { profile: { is: { accountNo: { contains: accountNo } } } },
          { studentProfile: { is: { stuNo: { contains: accountNo } } } },
        ],
      },
    ];
  }

  if (role === "student") {
    where.studentProfile = {
      is: {
        ...(stuNo ? { stuNo: { contains: stuNo } } : {}),
        ...(Number.isFinite(grade) ? { grade } : {}),
        ...(Number.isFinite(cohort) ? { cohort } : {}),
        ...(major ? { major: { contains: major } } : {}),
        ...(adminClass ? { adminClass: { contains: adminClass } } : {}),
      },
    };
  }

  if (role === "teacher") {
    where.teacherProfile = {
      is: {
        ...(teacherNo ? { teacherNo: { contains: teacherNo } } : {}),
        ...(college ? { college: { contains: college } } : {}),
        ...(title ? { title: { contains: title } } : {}),
      },
    };
  }

  if (role === "assistant" && ownerTeacherName) {
    where.teacherAssistantsAsAssistant = {
      some: {
        teacher: {
          profile: {
            is: {
              realName: { contains: ownerTeacherName },
            },
          },
        },
      },
    };
  }

  return where;
}

function parseImportedTable(base64: string) {
  const buffer = Buffer.from(base64, "base64");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("IMPORT_SHEET_EMPTY");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows;
}

adminRouter.get("/directory", requireAuth, async (req: Request, res: Response) => {
  if (!ensureAcademic(req, res)) return;

  const role = typeof req.query.role === "string" ? req.query.role : "";
  if (role && role !== "student" && role !== "teacher" && role !== "assistant") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "role must be student, teacher or assistant" });
  }

  const limitRaw = Number(req.query.limit ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20;
  const pageRaw = Number(req.query.page ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
  const offset = (page - 1) * limit;
  const where = buildDirectoryWhere(req.query);

  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: [{ createdAt: "desc" }],
      select: USER_DIRECTORY_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  return res.json({
    ok: true,
    data: rows,
    paging: { page, limit, total, hasMore: offset + rows.length < total },
  });
});

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
    ownerTeacherId,
  } = req.body ?? {};

  if (!id || typeof id !== "string" || !/^\d{10}$/.test(id)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "id must be a 10-digit string" });
  }
  if (role !== "student" && role !== "teacher" && role !== "assistant") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "role must be student, teacher or assistant" });
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

  if (role === "assistant") {
    if (!ownerTeacherId || typeof ownerTeacherId !== "string" || !/^\d{10}$/.test(ownerTeacherId)) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "assistant requires ownerTeacherId",
      });
    }
  }

  const temporaryPassword = defaultPassword ?? generatePassword();

  try {
    if (role === "assistant") {
      await createAssistantForAcademic({
        id,
        realName,
        temporaryPassword,
        ownerTeacherId,
      });
    } else {
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
    }
  } catch (error) {
    if (error instanceof Error && error.message === "OWNER_TEACHER_NOT_FOUND") {
      return res.status(404).json({ ok: false, code: "TEACHER_NOT_FOUND", message: "Owner teacher not found" });
    }
    if (isUniqueViolation(error)) {
      return res.status(409).json({ ok: false, code: "CONFLICT", message: "User or profile unique field already exists" });
    }
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to create user" });
  }

  return res.status(201).json({
    ok: true,
    data: { id, role, temporaryPassword, forceChangePassword: true, ownerTeacherId: role === "assistant" ? ownerTeacherId : undefined },
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

adminRouter.post("/import-file", requireAuth, async (req: Request, res: Response) => {
  if (!ensureAcademic(req, res)) return;

  const { mode, fileBase64, defaultPassword } = req.body ?? {};
  if (mode !== "student" && mode !== "teacher") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "mode must be student or teacher" });
  }
  if (!fileBase64 || typeof fileBase64 !== "string") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "fileBase64 is required" });
  }
  if (defaultPassword !== undefined && !isStrongPassword(defaultPassword)) {
    return res.status(422).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "defaultPassword must be 8-72 characters and contain uppercase, lowercase, and a digit",
    });
  }

  let rawRows: Record<string, unknown>[] = [];
  try {
    rawRows = parseImportedTable(fileBase64);
  } catch (error) {
    return res.status(400).json({ ok: false, code: "IMPORT_FAILED", message: "无法识别导入文件，请确认是有效的 Excel 或 CSV 文件" });
  }

  const normalizedRows = rawRows.map((row) => {
    const source = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim(), value]));
    if (mode === "student") {
      return {
        id: String(source["一卡通号"] ?? source["账号"] ?? source["ID"] ?? source["id"] ?? "").trim(),
        realName: String(source["姓名"] ?? source["name"] ?? "").trim(),
        stuNo: String(source["一卡通号"] ?? source["学号"] ?? source["账号"] ?? "").trim(),
        grade: Number(source["年级"] ?? 0),
        cohort: Number(source["届次"] ?? 0),
        major: String(source["专业"] ?? "").trim(),
        adminClass: String(source["行政班"] ?? "").trim(),
      };
    }
    return {
      id: String(source["一卡通号"] ?? source["账号"] ?? source["ID"] ?? source["id"] ?? "").trim(),
      realName: String(source["姓名"] ?? source["name"] ?? "").trim(),
      teacherNo: String(source["工号"] ?? source["teacherNo"] ?? source["一卡通号"] ?? "").trim(),
      title: String(source["职称"] ?? "").trim(),
      college: String(source["学院"] ?? "").trim(),
      researchDirection: String(source["研究方向"] ?? "").trim(),
    };
  }).filter((row) => row.id && row.realName);

  if (!normalizedRows.length) {
    return res.status(400).json({ ok: false, code: "IMPORT_FAILED", message: "未识别到有效数据，请检查表头和内容格式" });
  }

  const batchPassword = defaultPassword ?? generatePassword();
  const failed: Array<{ id: string; reason: string }> = [];
  let createdCount = 0;

  for (const row of normalizedRows) {
    try {
      if (mode === "student") {
        const student = row as {
          id: string; realName: string; stuNo: string; grade: number; cohort: number; major: string; adminClass: string;
        };
        if (!/^\d{10}$/.test(student.id) || !student.realName || !student.stuNo || !student.major || !student.adminClass || Number.isNaN(student.grade) || Number.isNaN(student.cohort)) {
          failed.push({ id: student.id || "(unknown)", reason: "invalid required fields" });
          continue;
        }
        await createTeacherOrStudent({
          id: student.id,
          role: "student",
          realName: student.realName,
          temporaryPassword: batchPassword,
          studentProfile: {
            stuNo: student.stuNo,
            grade: student.grade,
            cohort: student.cohort,
            major: student.major,
            adminClass: student.adminClass,
          },
        });
      } else {
        const teacher = row as {
          id: string; realName: string; teacherNo: string; title: string; college: string; researchDirection?: string;
        };
        if (!/^\d{10}$/.test(teacher.id) || !teacher.realName || !teacher.teacherNo || !teacher.title || !teacher.college) {
          failed.push({ id: teacher.id || "(unknown)", reason: "invalid required fields" });
          continue;
        }
        await createTeacherOrStudent({
          id: teacher.id,
          role: "teacher",
          realName: teacher.realName,
          temporaryPassword: batchPassword,
          teacherProfile: {
            teacherNo: teacher.teacherNo,
            title: teacher.title,
            college: teacher.college,
            researchDirection: teacher.researchDirection,
          },
        });
      }
      createdCount += 1;
    } catch (error) {
      failed.push({
        id: String((row as { id?: string }).id || "(unknown)"),
        reason: isUniqueViolation(error) ? "duplicate id or profile unique field" : "internal error",
      });
    }
  }

  return res.json({
    ok: true,
    data: {
      defaultPassword: batchPassword,
      createdCount,
      failedCount: failed.length,
      failed,
      totalRows: normalizedRows.length,
      forceChangePassword: true,
    },
  });
});

adminRouter.get("/export", requireAuth, async (req: Request, res: Response) => {
  if (!ensureAcademic(req, res)) return;

  const role = typeof req.query.role === "string" ? req.query.role : "";
  const format = typeof req.query.format === "string" ? req.query.format.toLowerCase() : "xlsx";
  if (role && role !== "student" && role !== "teacher" && role !== "assistant") {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "role must be student, teacher or assistant" });
  }
  if (!["xlsx", "xls", "csv"].includes(format)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "format must be xlsx, xls or csv" });
  }

  const rows = await prisma.user.findMany({
    where: buildDirectoryWhere(req.query),
    orderBy: [{ createdAt: "desc" }],
    select: USER_DIRECTORY_SELECT,
  });

  const header = role === "teacher"
    ? ["工号", "姓名", "学院", "职称", "一卡通号"]
    : role === "assistant"
      ? ["助教账号", "姓名", "所属教师", "已绑课程数"]
      : ["一卡通号", "姓名", "年级", "专业", "行政班", "届次"];

  const body = (rows as UserDirectoryRow[]).map((row) => {
    const profile = row.profile;
    const studentProfile = row.studentProfile;
    const teacherProfile = row.teacherProfile;
    const ownerBinding = Array.isArray(row.teacherAssistantsAsAssistant) ? row.teacherAssistantsAsAssistant[0] : null;
    const ownerName = ownerBinding?.teacher?.profile?.realName || ownerBinding?.teacherUserId || "";
    return role === "teacher"
      ? [teacherProfile?.teacherNo || row.id, profile?.realName || "", teacherProfile?.college || "", teacherProfile?.title || "", profile?.accountNo || row.id]
      : role === "assistant"
        ? [profile?.accountNo || row.id, profile?.realName || "", ownerName, row._count?.assistantBindingsAsAssistant || 0]
        : [profile?.accountNo || row.id, profile?.realName || "", studentProfile?.grade || "", studentProfile?.major || "", studentProfile?.adminClass || "", studentProfile?.cohort || ""];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"linksee-users-${role || "all"}.csv\"`);
    return res.send("\ufeff" + csv);
  }

  const bookType = format === "xls" ? "biff8" : "xlsx";
  const buffer = XLSX.write(workbook, { type: "buffer", bookType });
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename=\"linksee-users-${role || "all"}.${format}\"`);
  return res.send(buffer);
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

  const willWriteProfile = [realName, bio, location, email, accountNo].some((v) => v !== undefined);
  if (willWriteProfile) {
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId: targetId },
      select: { userId: true },
    });
    if (!existingProfile && realName === undefined) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "realName is required when initializing a missing user profile",
      });
    }
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

adminRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  if (!ensureAcademic(req, res)) return;

  const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!/^\d{10}$/.test(targetId)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "id must be a 10-digit string" });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) {
    return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", message: "User not found" });
  }

  try {
    if (target.role === Role.assistant) {
      await prisma.$transaction(async (tx) => {
        await tx.assistantBinding.deleteMany({ where: { assistantUserId: targetId } });
        await tx.teacherAssistant.deleteMany({ where: { assistantUserId: targetId } });
        await tx.user.delete({ where: { id: targetId } });
      });
    } else {
      await prisma.user.delete({ where: { id: targetId } });
    }
  } catch (error) {
    return res.status(409).json({
      ok: false,
      code: "USER_DELETE_BLOCKED",
      message: "该用户已关联课程或其他业务数据，暂时无法直接删除",
    });
  }

  return res.json({ ok: true, data: { id: targetId } });
});
