import { Router, type Request, type Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { CourseMemberStatus, CourseStatus, Role } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";
import { ensureCourseExists, ensureCourseReadable } from "./course-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent, removeUserFromRoom } from "../events/realtime-publisher.js";
import { fail, ok } from "../infra/http-response.js";
import { parseIdempotencyKey, parseLimitOffset } from "../infra/request-utils.js";

export const courseMembersRouter = Router();
const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

function validationFailed(res: Response, message: string): void {
  fail(res, 400, "VALIDATION_FAILED", message);
}

function forbidden(res: Response, message = "Insufficient permissions"): void {
  fail(res, 403, "FORBIDDEN", message);
}

function notFound(res: Response): void {
  fail(res, 404, "NOT_FOUND", "Course not found");
}

function parseCourseId(rawValue: string | string[] | undefined, res: Response): bigint | null {
  if (Array.isArray(rawValue) || typeof rawValue !== "string" || !/^\d+$/.test(rawValue)) {
    validationFailed(res, "courseId must be a positive integer string");
    return null;
  }

  try {
    return BigInt(rawValue);
  } catch {
    validationFailed(res, "courseId is invalid");
    return null;
  }
}

function parseRequiredParam(rawValue: string | string[] | undefined, fieldName: string, res: Response): string | null {
  if (Array.isArray(rawValue) || typeof rawValue !== "string" || rawValue.length === 0) {
    validationFailed(res, `${fieldName} must be a non-empty string`);
    return null;
  }
  return rawValue;
}

function parseCourseMemberStatus(value: unknown): CourseMemberStatus | null {
  if (value === undefined) return CourseMemberStatus.active;
  if (typeof value !== "string") return null;
  if (value !== CourseMemberStatus.active && value !== CourseMemberStatus.withdrawn) return null;
  return value;
}

function normalizeCell(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function parseRosterRowsFromBuffer(buffer: Buffer): Array<{ realName: string; accountNo: string }> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, { header: 1, raw: false, defval: "" });
  if (!rows.length) return [];

  const header = (rows[0] ?? []).map((cell) => normalizeCell(cell));
  const nameIndex = header.findIndex((text) => ["姓名", "学生姓名", "name", "realName"].includes(text));
  const accountIndex = header.findIndex((text) => ["一卡通号", "卡号", "用户名", "账号", "ID", "id", "accountNo"].includes(text));
  const hasHeader = nameIndex >= 0 || accountIndex >= 0;
  const start = hasHeader ? 1 : 0;
  const resolvedNameIndex = nameIndex >= 0 ? nameIndex : 0;
  const resolvedAccountIndex = accountIndex >= 0 ? accountIndex : 1;

  return rows.slice(start).map((row) => {
    const cells = Array.isArray(row) ? row : [];
    return {
      realName: normalizeCell(cells[resolvedNameIndex]),
      accountNo: normalizeCell(cells[resolvedAccountIndex]),
    };
  }).filter((row) => row.realName || row.accountNo);
}

async function ensureCourseStatusAllowsStudentMutation(courseId: bigint, res: Response): Promise<boolean> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { status: true },
  });
  if (!course) {
    return notFound(res), false;
  }
  if (course.status === CourseStatus.archived) {
    fail(res, 409, "CONFLICT", "Archived course cannot change student members");
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/courses/:id/members
// ──────────────────────────────────────────────────────────────

courseMembersRouter.get("/:id/members", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;

  const access = await ensureCourseReadable(courseId, req.user!.id, req.user!.role as Role, res);
  if (!access) return;
  const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>);

  const statusFilter = parseCourseMemberStatus(req.query.status);
  if (!statusFilter) {
    return validationFailed(res, "status must be active or withdrawn");
  }

  const [members, total] = await prisma.$transaction([
    prisma.courseMember.findMany({
      where: { courseId, status: statusFilter },
      select: {
        id: true,
        status: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            profile: { select: { realName: true, accountNo: true, avatarUrl: true } },
            studentProfile: { select: { stuNo: true, grade: true, major: true, adminClass: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
      skip: offset,
      take: limit,
    }),
    prisma.courseMember.count({ where: { courseId, status: statusFilter } }),
  ]);

  res.json({
    ok: true,
    data: serializeBigInt(members),
    paging: { limit, offset, total, hasMore: offset + members.length < total },
  });
});

courseMembersRouter.post("/:id/members/import-roster", requireAuth, rosterUpload.single("file"), async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return notFound(res);
  if (!(await ensureCourseStatusAllowsStudentMutation(courseId, res))) return;
  if (!req.file?.buffer?.length) {
    return validationFailed(res, "Please upload an Excel or CSV roster file");
  }

  const importedRows = parseRosterRowsFromBuffer(req.file.buffer).slice(0, 500);
  if (!importedRows.length) {
    return validationFailed(res, "No valid rows found. Excel should contain 姓名 and 一卡通号 two columns");
  }

  const accountNos = Array.from(new Set(importedRows.map((row) => row.accountNo).filter(Boolean)));
  const users = await prisma.user.findMany({
    where: {
      role: Role.student,
      OR: [
        { id: { in: accountNos } },
        { profile: { is: { accountNo: { in: accountNos } } } },
      ],
    },
    select: {
      id: true,
      profile: { select: { realName: true, accountNo: true, avatarUrl: true } },
      studentProfile: { select: { stuNo: true, grade: true, major: true, adminClass: true } },
    },
  });

  const userByAccount = new Map<string, (typeof users)[number]>();
  users.forEach((user) => {
    userByAccount.set(String(user.id), user);
    if (user.profile?.accountNo) {
      userByAccount.set(String(user.profile.accountNo), user);
    }
  });

  const activeMembers = await prisma.courseMember.findMany({
    where: { courseId, status: CourseMemberStatus.active, userId: { in: users.map((user) => user.id) } },
    select: { userId: true },
  });
  const activeMemberIds = new Set(activeMembers.map((row) => row.userId));

  const previewRows: Array<Record<string, unknown>> = [];
  let matchedCount = 0;
  let selectedCount = 0;
  let alreadyJoinedCount = 0;
  let notFoundCount = 0;
  let nameMismatchCount = 0;

  importedRows.forEach((row) => {
    const matched = userByAccount.get(row.accountNo);
    if (!matched) {
      notFoundCount += 1;
      return;
    }

    const inputName = normalizeName(row.realName);
    const dbName = normalizeName(String(matched.profile?.realName ?? ""));
    const joined = activeMemberIds.has(matched.id);
    let importStatus = joined ? "already_joined" : "ready";

    if (inputName && dbName && inputName !== dbName) {
      importStatus = "name_mismatch";
      nameMismatchCount += 1;
    } else if (joined) {
      alreadyJoinedCount += 1;
    } else {
      selectedCount += 1;
    }

    matchedCount += 1;
    previewRows.push({
      id: matched.id,
      role: "student",
      profile: {
        realName: matched.profile?.realName ?? "",
        accountNo: matched.profile?.accountNo ?? matched.id,
        avatarUrl: matched.profile?.avatarUrl ?? null,
      },
      studentProfile: matched.studentProfile ?? null,
      importStatus,
      importSourceName: row.realName,
      importSourceAccountNo: row.accountNo,
    });
  });

  ok(res, serializeBigInt({
    rows: previewRows,
    summary: {
      totalRows: importedRows.length,
      matchedCount,
      selectedCount,
      alreadyJoinedCount,
      notFoundCount,
      nameMismatchCount,
    },
  }), 201);
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/courses/:id/members/batch
// ──────────────────────────────────────────────────────────────

courseMembersRouter.post("/:id/members/batch", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return notFound(res);
  if (!(await ensureCourseStatusAllowsStudentMutation(courseId, res))) return;
  const idempotencyKey = parseIdempotencyKey(req);

  const { userIds } = req.body ?? {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return validationFailed(res, "userIds must be a non-empty array");
  }
  if (userIds.length > 500) {
    return validationFailed(res, "Maximum 500 users per batch");
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, role: Role.student },
    select: { id: true },
  });
  const validIds = new Set(users.map((u) => u.id));
  const invalidIds = userIds.filter((id: string) => !validIds.has(id));

  if (invalidIds.length > 0) {
    return validationFailed(res, `The following user IDs are not valid students: ${invalidIds.join(", ")}`);
  }

  if (idempotencyKey) {
    const existingActive = await prisma.courseMember.count({
      where: { courseId, userId: { in: userIds }, status: CourseMemberStatus.active },
    });
    if (existingActive === userIds.length) {
      return ok(res, { imported: userIds.length, idempotent: true }, 201);
    }
  }

  await prisma.$transaction(
    userIds.map((uid: string) =>
      prisma.courseMember.upsert({
        where: { courseId_userId: { courseId, userId: uid } },
        create: { courseId, userId: uid },
        update: { status: CourseMemberStatus.active },
      })
    )
  );

  const batchEvent = createEventEnvelope("course.member.updated", {
    courseId: courseId.toString(),
    action: "batch_added",
    operatorId: req.user!.id,
    count: userIds.length,
  });
  await pushSocketEvent(`course:${courseId.toString()}`, batchEvent);

  ok(res, { imported: userIds.length }, 201);
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/courses/:id/members
// ──────────────────────────────────────────────────────────────

courseMembersRouter.post("/:id/members", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return;
  if (!(await ensureCourseStatusAllowsStudentMutation(courseId, res))) return;
  const idempotencyKey = parseIdempotencyKey(req);

  const { userId } = req.body ?? {};
  if (typeof userId !== "string" || userId.length === 0) {
    return validationFailed(res, "userId is required");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive || user.role !== Role.student) {
    return validationFailed(res, "User is not an active student");
  }

  if (idempotencyKey) {
    const existing = await prisma.courseMember.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { id: true, courseId: true, userId: true, status: true, joinedAt: true },
    });
    if (existing && existing.status === CourseMemberStatus.active) {
      return ok(res, serializeBigInt(existing), 201);
    }
  }

  const member = await prisma.courseMember.upsert({
    where: { courseId_userId: { courseId, userId } },
    create: { courseId, userId },
    update: { status: CourseMemberStatus.active },
    select: { id: true, courseId: true, userId: true, status: true, joinedAt: true },
  });

  const event = createEventEnvelope("course.member.updated", {
    courseId: courseId.toString(),
    userId,
    action: "added",
    operatorId: req.user!.id,
  });
  await pushSocketEvent(`course:${courseId.toString()}`, event);

  ok(res, serializeBigInt(member), 201);
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/courses/:id/members/:userId
// ──────────────────────────────────────────────────────────────

courseMembersRouter.delete("/:id/members/:userId", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  const userId = parseRequiredParam(req.params.userId, "userId", res);
  if (userId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return;
  if (!(await ensureCourseStatusAllowsStudentMutation(courseId, res))) return;

  const member = await prisma.courseMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!member || member.status === CourseMemberStatus.withdrawn) {
    return fail(res, 404, "NOT_FOUND", "Member not found in this course");
  }

  await prisma.courseMember.update({
    where: { courseId_userId: { courseId, userId } },
    data: { status: CourseMemberStatus.withdrawn },
  });

  const event = createEventEnvelope("course.member.updated", {
    courseId: courseId.toString(),
    userId,
    action: "removed",
    operatorId: req.user!.id,
  });
  await pushSocketEvent(`course:${courseId.toString()}`, event);
  await removeUserFromRoom(userId, `course:${courseId.toString()}`);

  ok(res, { success: true });
});
