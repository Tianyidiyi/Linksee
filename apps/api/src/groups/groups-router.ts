import { GroupStatus, GroupMemberRole, Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseBigIntParam, serializeBigInt, validationFailed, conflict } from "../assignments/assignment-access.js";
import {
  ensureAssignmentManageable,
  ensureCourseMemberActive,
  ensureGroupManageable,
  type AssignmentCourseRecord,
} from "./group-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent, removeUserFromRoom } from "../events/realtime-publisher.js";

export const groupsRouter = Router();

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

  const assignment = await ensureAssignmentManageable(assignmentId, req.user!.id, req.user!.role as Role, res);
  if (!assignment) return;

  const groups = await prisma.group.findMany({
    where: { assignmentId },
    orderBy: [{ groupNo: "asc" }],
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
  });

  res.json({ ok: true, data: serializeBigInt(groups) });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/assignments/:assignmentId/groups
// 创建小组（老师/助教/教务）
// ──────────────────────────────────────────────────────────────

groupsRouter.post("/assignments/:assignmentId/groups", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const role = req.user!.role as Role;
  const userId = req.user!.id;
  const assignment = await ensureAssignmentManageable(assignmentId, userId, role, res);
  if (!assignment) return;

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

  const created = await createGroupAndMaybeLeader(assignment, groupNo, name, userId, role);
  await ensureGroupConversation(created.groupId, userId);

  res.status(201).json({
    ok: true,
    data: {
      id: created.groupId.toString(),
      assignmentId: assignmentId.toString(),
      groupNo: created.groupNo,
      name,
    },
  });
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
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Group member not found" });
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
