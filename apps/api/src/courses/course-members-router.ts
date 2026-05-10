import { Router, type Request, type Response } from "express";
import { CourseMemberStatus, Role } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";
import { ensureCourseExists, ensureCourseReadable } from "./course-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent, removeUserFromRoom } from "../events/realtime-publisher.js";

export const courseMembersRouter = Router();

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

function validationFailed(res: Response, message: string): void {
  res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message });
}

function forbidden(res: Response, message = "Insufficient permissions"): void {
  res.status(403).json({ ok: false, code: "FORBIDDEN", message });
}

function notFound(res: Response): void {
  res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Course not found" });
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

// ──────────────────────────────────────────────────────────────
// GET /api/v1/courses/:id/members
// ──────────────────────────────────────────────────────────────

courseMembersRouter.get("/:id/members", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;

  const access = await ensureCourseReadable(courseId, req.user!.id, req.user!.role as Role, res);
  if (!access) return;

  const statusFilter = (req.query.status as CourseMemberStatus | undefined) ?? CourseMemberStatus.active;

  const members = await prisma.courseMember.findMany({
    where: { courseId, status: statusFilter },
    select: {
      id: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          profile: { select: { realName: true, accountNo: true, avatarUrl: true } },
          studentProfile: { select: { stuNo: true, grade: true, adminClass: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  res.json({ ok: true, data: serializeBigInt(members) });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/courses/:id/members/batch
// ──────────────────────────────────────────────────────────────

courseMembersRouter.post("/:id/members/batch", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return;

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

  res.status(201).json({ ok: true, data: { imported: userIds.length } });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/courses/:id/members
// ──────────────────────────────────────────────────────────────

courseMembersRouter.post("/:id/members", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return;

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

  res.status(201).json({ ok: true, data: serializeBigInt(member) });
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

  const member = await prisma.courseMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!member || member.status === CourseMemberStatus.withdrawn) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Member not found in this course" });
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

  res.json({ ok: true });
});
