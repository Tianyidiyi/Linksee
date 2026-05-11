import {
  GroupJoinRequestStatus,
  GroupLeaderTransferRequestStatus,
  GroupMemberRole,
  GroupStatus,
  Role,
} from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseBigIntParam, serializeBigInt, validationFailed, conflict } from "../assignments/assignment-access.js";
import { parseIdempotencyKey, parseLimitOffset } from "../infra/request-utils.js";
import { fail, ok } from "../infra/http-response.js";
import {
  ensureAssignmentManageable,
  ensureCourseMemberActive,
  ensureGroupManageable,
  type AssignmentCourseRecord,
} from "./group-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent, removeUserFromRoom } from "../events/realtime-publisher.js";

export const groupsRouter = Router();

type AssignmentContext = {
  id: bigint;
  courseId: bigint;
  groupConfig: {
    groupFormEnd: Date | null;
    groupMaxSize: number;
  } | null;
};

function parseOptionalGroupNo(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

async function getAssignmentContext(assignmentId: bigint): Promise<AssignmentContext | null> {
  return prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      courseId: true,
      groupConfig: {
        select: {
          groupFormEnd: true,
          groupMaxSize: true,
        },
      },
    },
  });
}

function isStudent(role: Role): boolean {
  return role === Role.student;
}

function isCourseStaff(role: Role): boolean {
  return role === Role.academic || role === Role.teacher || role === Role.assistant;
}

function isBeforeStudentDeadline(groupFormEnd: Date | null): boolean {
  if (!groupFormEnd) return true;
  return Date.now() <= groupFormEnd.getTime();
}

async function ensureGroupConversation(groupId: bigint, createdBy: string): Promise<void> {
  await prisma.chatConversation.upsert({
    where: { scopeType_scopeId: { scopeType: "group", scopeId: groupId } },
    update: {},
    create: {
      scopeType: "group",
      scopeId: groupId,
      roomKey: `group:${groupId.toString()}`,
      createdBy,
    },
  });
}

async function createGroupAndMaybeLeader(
  assignment: AssignmentCourseRecord,
  groupNo: number,
  name: string | null,
  createdBy: string,
  role: Role,
): Promise<{ groupId: bigint; groupNo: number }> {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        assignmentId: assignment.id,
        groupNo,
        name,
        status: GroupStatus.forming,
        createdBy,
      },
      select: { id: true, groupNo: true },
    });

    if (role === Role.student) {
      await tx.groupMember.create({
        data: {
          groupId: group.id,
          assignmentId: assignment.id,
          userId: createdBy,
          role: GroupMemberRole.leader,
        },
      });
    }

    return { groupId: group.id, groupNo: group.groupNo };
  });
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/assignments/:assignmentId/groups
// 课程管理者查看小组列表
// ──────────────────────────────────────────────────────────────

groupsRouter.get("/assignments/:assignmentId/groups", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;
  const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>);
  const role = req.user!.role as Role;
  const userId = req.user!.id;

  const assignment = await getAssignmentContext(assignmentId);
  if (!assignment) {
    return fail(res, 404, "NOT_FOUND", "Assignment not found");
  }
  if (isStudent(role)) {
    if (!(await ensureCourseMemberActive(assignment.courseId, userId, res))) return;
  } else {
    const manageable = await ensureAssignmentManageable(assignmentId, userId, role, res);
    if (!manageable) return;
  }

  const [groups, total] = await prisma.$transaction([
    prisma.group.findMany({
      where: { assignmentId },
      orderBy: [{ groupNo: "asc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        assignmentId: true,
        groupNo: true,
        name: true,
        status: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { members: true } },
      },
    }),
    prisma.group.count({ where: { assignmentId } }),
  ]);

  res.json({
    ok: true,
    data: serializeBigInt(groups),
    paging: { limit, offset, total, hasMore: offset + groups.length < total },
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/assignments/:assignmentId/groups
// 创建小组（老师/助教/教务）
// ──────────────────────────────────────────────────────────────

groupsRouter.post("/assignments/:assignmentId/groups", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;
  const idempotencyKey = parseIdempotencyKey(req);

  const role = req.user!.role as Role;
  const userId = req.user!.id;
  const assignment = await getAssignmentContext(assignmentId);
  if (!assignment) {
    return fail(res, 404, "NOT_FOUND", "Assignment not found");
  }
  if (isStudent(role)) {
    if (!(await ensureCourseMemberActive(assignment.courseId, userId, res))) return;
    if (!isBeforeStudentDeadline(assignment.groupConfig?.groupFormEnd ?? null)) {
      return conflict(res, "Group self-service is closed after groupFormEnd");
    }
    const existingMembership = await prisma.groupMember.findUnique({
      where: { assignmentId_userId: { assignmentId, userId } },
      select: { id: true },
    });
    if (existingMembership) {
      return conflict(res, "Student already belongs to a group in this assignment");
    }
  } else {
    const manageable = await ensureAssignmentManageable(assignmentId, userId, role, res);
    if (!manageable) return;
  }

  const name = parseOptionalString(req.body?.name);
  const requestedGroupNo = parseOptionalGroupNo(req.body?.groupNo);
  if (req.body?.groupNo !== undefined && requestedGroupNo === null) {
    return validationFailed(res, "groupNo must be a positive integer");
  }

  let groupNo = requestedGroupNo;
  if (!groupNo) {
    const maxGroup = await prisma.group.aggregate({
      where: { assignmentId },
      _max: { groupNo: true },
    });
    groupNo = (maxGroup._max.groupNo ?? 0) + 1;
  }

  const existing = await prisma.group.findUnique({
    where: { assignmentId_groupNo: { assignmentId, groupNo } },
    select: { id: true },
  });
  if (existing) {
    return conflict(res, `groupNo ${groupNo} already exists`);
  }

  if (idempotencyKey) {
    const dup = await prisma.group.findFirst({
      where: { assignmentId, groupNo, createdBy: userId },
      select: { id: true, assignmentId: true, groupNo: true, name: true },
    });
    if (dup) {
      return ok(res, serializeBigInt(dup), 201);
    }
  }

  const created = await createGroupAndMaybeLeader(assignment, groupNo, name, userId, role);
  await ensureGroupConversation(created.groupId, userId);

  ok(res, {
    id: created.groupId.toString(),
    assignmentId: assignmentId.toString(),
    groupNo: created.groupNo,
    name,
  }, 201);
});

groupsRouter.post("/groups/:groupId/join-requests", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;
  if (!isStudent(req.user!.role as Role)) {
    return fail(res, 403, "FORBIDDEN", "Only students can create join requests");
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      assignmentId: true,
      assignment: {
        select: {
          courseId: true,
          groupConfig: { select: { groupFormEnd: true, groupMaxSize: true } },
        },
      },
      _count: { select: { members: true } },
    },
  });
  if (!group) return fail(res, 404, "NOT_FOUND", "Group not found");
  if (!(await ensureCourseMemberActive(group.assignment.courseId, req.user!.id, res))) return;
  if (!isBeforeStudentDeadline(group.assignment.groupConfig?.groupFormEnd ?? null)) {
    return conflict(res, "Group self-service is closed after groupFormEnd");
  }

  const existingMembership = await prisma.groupMember.findUnique({
    where: { assignmentId_userId: { assignmentId: group.assignmentId, userId: req.user!.id } },
    select: { id: true },
  });
  if (existingMembership) {
    return conflict(res, "Student already belongs to a group in this assignment");
  }

  const maxSize = group.assignment.groupConfig?.groupMaxSize ?? 6;
  if (group._count.members >= maxSize) {
    return conflict(res, "Group is full");
  }

  const pending = await prisma.groupJoinRequest.findFirst({
    where: {
      assignmentId: group.assignmentId,
      applicantUserId: req.user!.id,
      status: GroupJoinRequestStatus.pending,
    },
    select: { id: true },
  });
  if (pending) return conflict(res, "You already have a pending join request in this assignment");

  const created = await prisma.groupJoinRequest.create({
    data: {
      assignmentId: group.assignmentId,
      groupId: group.id,
      applicantUserId: req.user!.id,
      reason: parseOptionalString(req.body?.reason),
    },
    select: { id: true, assignmentId: true, groupId: true, applicantUserId: true, status: true, createdAt: true },
  });

  return ok(res, serializeBigInt(created), 201);
});

groupsRouter.get("/groups/:groupId/join-requests", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;
  const role = req.user!.role as Role;

  if (isCourseStaff(role)) {
    const group = await ensureGroupManageable(groupId, req.user!.id, role, res);
    if (!group) return;
  } else {
    const leader = await prisma.groupMember.findFirst({
      where: { groupId, userId: req.user!.id, role: GroupMemberRole.leader },
      select: { id: true },
    });
    if (!leader) return fail(res, 403, "FORBIDDEN", "Only group leader or course staff can view join requests");
  }

  const rows = await prisma.groupJoinRequest.findMany({
    where: { groupId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      assignmentId: true,
      groupId: true,
      applicantUserId: true,
      status: true,
      reason: true,
      reviewedBy: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return ok(res, serializeBigInt(rows));
});

groupsRouter.post("/group-join-requests/:requestId/approve", requireAuth, async (req: Request, res: Response) => {
  const requestId = parseBigIntParam(req.params.requestId, "requestId", res);
  if (requestId === null) return;

  const joinRequest = await prisma.groupJoinRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      assignmentId: true,
      groupId: true,
      applicantUserId: true,
      status: true,
      group: {
        select: {
          assignment: { select: { groupConfig: { select: { groupFormEnd: true, groupMaxSize: true } } } },
          _count: { select: { members: true } },
        },
      },
    },
  });
  if (!joinRequest) return fail(res, 404, "NOT_FOUND", "Join request not found");
  if (joinRequest.status !== GroupJoinRequestStatus.pending) {
    return conflict(res, "Join request is not pending");
  }

  const leader = await prisma.groupMember.findFirst({
    where: { groupId: joinRequest.groupId, userId: req.user!.id, role: GroupMemberRole.leader },
    select: { id: true },
  });
  if (!leader) return fail(res, 403, "FORBIDDEN", "Only group leader can approve join requests");

  const studentWindowEnd = joinRequest.group.assignment.groupConfig?.groupFormEnd ?? null;
  if (!isBeforeStudentDeadline(studentWindowEnd)) {
    return conflict(res, "Group self-service is closed after groupFormEnd");
  }

  const maxSize = joinRequest.group.assignment.groupConfig?.groupMaxSize ?? 6;
  if (joinRequest.group._count.members >= maxSize) return conflict(res, "Group is full");

  const result = await prisma.$transaction(async (tx) => {
    const latest = await tx.groupJoinRequest.findUnique({
      where: { id: requestId },
      select: { status: true, assignmentId: true, groupId: true, applicantUserId: true },
    });
    if (!latest || latest.status !== GroupJoinRequestStatus.pending) return null;

    const exists = await tx.groupMember.findUnique({
      where: { assignmentId_userId: { assignmentId: latest.assignmentId, userId: latest.applicantUserId } },
      select: { id: true },
    });
    if (exists) {
      await tx.groupJoinRequest.update({
        where: { id: requestId },
        data: { status: GroupJoinRequestStatus.rejected, reviewedBy: req.user!.id, reviewedAt: new Date() },
      });
      return { autoRejected: true };
    }

    await tx.groupMember.create({
      data: {
        groupId: latest.groupId,
        assignmentId: latest.assignmentId,
        userId: latest.applicantUserId,
        role: GroupMemberRole.member,
      },
    });
    await tx.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: GroupJoinRequestStatus.approved, reviewedBy: req.user!.id, reviewedAt: new Date() },
    });
    return { autoRejected: false };
  });

  if (!result) return conflict(res, "Join request is not pending");
  return ok(res, { approved: !result.autoRejected, reason: result.autoRejected ? "applicant_already_joined" : null });
});

groupsRouter.post("/group-join-requests/:requestId/reject", requireAuth, async (req: Request, res: Response) => {
  const requestId = parseBigIntParam(req.params.requestId, "requestId", res);
  if (requestId === null) return;

  const joinRequest = await prisma.groupJoinRequest.findUnique({
    where: { id: requestId },
    select: { id: true, groupId: true, status: true },
  });
  if (!joinRequest) return fail(res, 404, "NOT_FOUND", "Join request not found");
  if (joinRequest.status !== GroupJoinRequestStatus.pending) return conflict(res, "Join request is not pending");

  const leader = await prisma.groupMember.findFirst({
    where: { groupId: joinRequest.groupId, userId: req.user!.id, role: GroupMemberRole.leader },
    select: { id: true },
  });
  if (!leader) return fail(res, 403, "FORBIDDEN", "Only group leader can reject join requests");

  await prisma.groupJoinRequest.update({
    where: { id: requestId },
    data: {
      status: GroupJoinRequestStatus.rejected,
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
      reason: parseOptionalString(req.body?.reason),
    },
  });
  return ok(res, { id: requestId.toString(), status: GroupJoinRequestStatus.rejected });
});

groupsRouter.post("/groups/:groupId/leader-transfer-requests", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const toUserId = parseOptionalString(req.body?.toUserId);
  if (!toUserId) return validationFailed(res, "toUserId is required");

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, assignmentId: true },
  });
  if (!group) return fail(res, 404, "NOT_FOUND", "Group not found");

  const leader = await prisma.groupMember.findFirst({
    where: { groupId, userId: req.user!.id, role: GroupMemberRole.leader },
    select: { id: true },
  });
  if (!leader) return fail(res, 403, "FORBIDDEN", "Only current leader can initiate transfer");

  const target = await prisma.groupMember.findFirst({
    where: { groupId, userId: toUserId },
    select: { id: true },
  });
  if (!target) return fail(res, 400, "VALIDATION_FAILED", "Target user must be a current group member");

  const pending = await prisma.groupLeaderTransferRequest.findFirst({
    where: { groupId, status: GroupLeaderTransferRequestStatus.pending },
    select: { id: true },
  });
  if (pending) return conflict(res, "There is already a pending leader transfer request");

  const created = await prisma.groupLeaderTransferRequest.create({
    data: {
      assignmentId: group.assignmentId,
      groupId,
      fromUserId: req.user!.id,
      toUserId,
      status: GroupLeaderTransferRequestStatus.pending,
    },
    select: { id: true, groupId: true, fromUserId: true, toUserId: true, status: true, createdAt: true },
  });
  return ok(res, serializeBigInt(created), 201);
});

groupsRouter.post("/group-leader-transfer-requests/:requestId/accept", requireAuth, async (req: Request, res: Response) => {
  const requestId = parseBigIntParam(req.params.requestId, "requestId", res);
  if (requestId === null) return;

  const request = await prisma.groupLeaderTransferRequest.findUnique({
    where: { id: requestId },
    select: { id: true, groupId: true, fromUserId: true, toUserId: true, status: true },
  });
  if (!request) return fail(res, 404, "NOT_FOUND", "Leader transfer request not found");
  if (request.status !== GroupLeaderTransferRequestStatus.pending) {
    return conflict(res, "Leader transfer request is not pending");
  }
  if (request.toUserId !== req.user!.id) {
    return fail(res, 403, "FORBIDDEN", "Only target user can accept transfer");
  }

  const switched = await prisma.$transaction(async (tx) => {
    const latest = await tx.groupLeaderTransferRequest.findUnique({
      where: { id: requestId },
      select: { status: true, groupId: true, fromUserId: true, toUserId: true },
    });
    if (!latest || latest.status !== GroupLeaderTransferRequestStatus.pending) {
      return false;
    }
    await tx.groupMember.updateMany({
      where: { groupId: latest.groupId, userId: latest.fromUserId, role: GroupMemberRole.leader },
      data: { role: GroupMemberRole.member },
    });
    await tx.groupMember.updateMany({
      where: { groupId: latest.groupId, userId: latest.toUserId },
      data: { role: GroupMemberRole.leader },
    });
    await tx.groupLeaderTransferRequest.update({
      where: { id: requestId },
      data: { status: GroupLeaderTransferRequestStatus.accepted, respondedAt: new Date() },
    });
    return true;
  });
  if (!switched) return conflict(res, "Leader transfer request is not pending");

  return ok(res, { id: requestId.toString(), status: GroupLeaderTransferRequestStatus.accepted });
});

groupsRouter.post("/group-leader-transfer-requests/:requestId/reject", requireAuth, async (req: Request, res: Response) => {
  const requestId = parseBigIntParam(req.params.requestId, "requestId", res);
  if (requestId === null) return;

  const request = await prisma.groupLeaderTransferRequest.findUnique({
    where: { id: requestId },
    select: { id: true, toUserId: true, status: true },
  });
  if (!request) return fail(res, 404, "NOT_FOUND", "Leader transfer request not found");
  if (request.status !== GroupLeaderTransferRequestStatus.pending) {
    return conflict(res, "Leader transfer request is not pending");
  }
  if (request.toUserId !== req.user!.id) {
    return fail(res, 403, "FORBIDDEN", "Only target user can reject transfer");
  }

  await prisma.groupLeaderTransferRequest.update({
    where: { id: requestId },
    data: { status: GroupLeaderTransferRequestStatus.rejected, respondedAt: new Date() },
  });
  return ok(res, { id: requestId.toString(), status: GroupLeaderTransferRequestStatus.rejected });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/groups/:groupId/members
// 添加小组成员（老师/助教/教务）
// ──────────────────────────────────────────────────────────────

groupsRouter.post("/groups/:groupId/members", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const group = await ensureGroupManageable(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  const targetUserId = parseOptionalString(req.body?.userId);
  if (!targetUserId) {
    return validationFailed(res, "userId is required");
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true },
  });
  if (!user || user.role !== Role.student) {
    return validationFailed(res, "userId must be a student");
  }

  if (!(await ensureCourseMemberActive(group.courseId, targetUserId, res))) return;

  const existing = await prisma.groupMember.findUnique({
    where: { assignmentId_userId: { assignmentId: group.assignmentId, userId: targetUserId } },
    select: { groupId: true },
  });
  if (existing) {
    return conflict(res, "Student already belongs to a group in this assignment");
  }

  const member = await prisma.groupMember.create({
    data: {
      groupId,
      assignmentId: group.assignmentId,
      userId: targetUserId,
      role: GroupMemberRole.member,
    },
    select: { id: true, userId: true, groupId: true },
  });

  const event = createEventEnvelope("group.member.updated", {
    groupId: groupId.toString(),
    assignmentId: group.assignmentId.toString(),
    courseId: group.courseId.toString(),
    userId: targetUserId,
    action: "added",
    operatorId: req.user!.id,
  });
  await pushSocketEvent(`group:${groupId.toString()}`, event);
  await pushSocketEvent(`course:${group.courseId.toString()}`, event);

  res.status(201).json({ ok: true, data: serializeBigInt(member) });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/groups/:groupId/members/:userId
// 移除小组成员（老师/助教/教务）
// ──────────────────────────────────────────────────────────────

groupsRouter.delete("/groups/:groupId/members/:userId", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const targetUserId = parseOptionalString(req.params.userId);
  if (!targetUserId) {
    return validationFailed(res, "userId is required");
  }

  const group = await ensureGroupManageable(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  const existing = await prisma.groupMember.findFirst({
    where: { groupId, userId: targetUserId },
    select: { id: true },
  });
  if (!existing) {
    return fail(res, 404, "NOT_FOUND", "Group member not found");
  }

  await prisma.groupMember.delete({
    where: { id: existing.id },
  });

  const event = createEventEnvelope("group.member.updated", {
    groupId: groupId.toString(),
    assignmentId: group.assignmentId.toString(),
    courseId: group.courseId.toString(),
    userId: targetUserId,
    action: "removed",
    operatorId: req.user!.id,
  });
  await pushSocketEvent(`group:${groupId.toString()}`, event);
  await pushSocketEvent(`course:${group.courseId.toString()}`, event);
  await removeUserFromRoom(targetUserId, `group:${groupId.toString()}`);

  res.json({ ok: true });
});
