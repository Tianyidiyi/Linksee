import { GroupMemberRole, Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseBigIntParam, serializeBigInt, validationFailed, conflict } from "../assignments/assignment-access.js";
import { fail, ok } from "../infra/http-response.js";
import { ensureCourseMemberActive, ensureGroupManageable, getGroupAccess } from "./group-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";
import { parseBigIntBodyValue, parseOptionalString } from "./group-utils.js";

export const groupMembersRouter = Router();

// ──────────────────────────────────────────────────────────────
// POST /api/v1/groups/:groupId/members
// 添加小组成员（老师/助教/教务）
// ──────────────────────────────────────────────────────────────

groupMembersRouter.post("/groups/:groupId/members", requireAuth, async (req: Request, res: Response) => {
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

groupMembersRouter.get("/groups/:groupId/members", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const role = req.user!.role as Role;
  const group =
    role === Role.student
      ? await getGroupAccess(groupId, req.user!.id, role, res)
      : await ensureGroupManageable(groupId, req.user!.id, role, res);
  if (!group) return;

  const rows = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    select: {
      id: true,
      groupId: true,
      assignmentId: true,
      userId: true,
      role: true,
      joinedAt: true,
      user: {
        select: {
          profile: {
            select: {
              realName: true,
              avatarUrl: true,
              accountNo: true,
            },
          },
        },
      },
    },
  });

  return ok(res, serializeBigInt(rows));
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/groups/:groupId/members/:userId
// 移除小组成员（老师/助教/教务）
// ──────────────────────────────────────────────────────────────

groupMembersRouter.delete("/groups/:groupId/members/:userId", requireAuth, async (req: Request, res: Response) => {
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

  res.json({ ok: true });
});

groupMembersRouter.post("/groups/:groupId/members/:userId/move", requireAuth, async (req: Request, res: Response) => {
  const sourceGroupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (sourceGroupId === null) return;

  const targetUserId = parseOptionalString(req.params.userId);
  if (!targetUserId) return validationFailed(res, "userId is required");

  const sourceGroup = await ensureGroupManageable(sourceGroupId, req.user!.id, req.user!.role as Role, res);
  if (!sourceGroup) return;

  const targetGroupId = parseBigIntParam(parseBigIntBodyValue(req.body?.targetGroupId), "targetGroupId", res);
  if (targetGroupId === null) return;

  const targetGroup = await prisma.group.findUnique({
    where: { id: targetGroupId },
    select: { id: true, assignmentId: true, assignment: { select: { courseId: true } } },
  });
  if (!targetGroup) {
    return fail(res, 404, "NOT_FOUND", "Target group not found");
  }
  if (targetGroup.assignmentId !== sourceGroup.assignmentId) {
    return conflict(res, "Target group must be in the same assignment");
  }
  if (targetGroup.assignment.courseId !== sourceGroup.courseId) {
    return conflict(res, "Target group course mismatch");
  }

  const sourceMember = await prisma.groupMember.findFirst({
    where: {
      groupId: sourceGroupId,
      assignmentId: sourceGroup.assignmentId,
      userId: targetUserId,
    },
    select: { id: true, role: true },
  });
  if (!sourceMember) {
    return fail(res, 404, "NOT_FOUND", "Group member not found in source group");
  }
  if (sourceMember.role === GroupMemberRole.leader) {
    return conflict(res, "Cannot move current leader; transfer leader first");
  }

  const moved = await prisma.$transaction(async (tx) => {
    const latest = await tx.groupMember.findFirst({
      where: {
        groupId: sourceGroupId,
        assignmentId: sourceGroup.assignmentId,
        userId: targetUserId,
      },
      select: { id: true, role: true },
    });
    if (!latest) return null;
    if (latest.role === GroupMemberRole.leader) return "LEADER";

    await tx.groupMember.update({
      where: { id: latest.id },
      data: { groupId: targetGroupId },
      select: { id: true },
    });

    return "OK";
  });

  if (moved === null) return fail(res, 404, "NOT_FOUND", "Group member not found in source group");
  if (moved === "LEADER") return conflict(res, "Cannot move current leader; transfer leader first");

  const sourceEvent = createEventEnvelope("group.member.updated", {
    groupId: sourceGroupId.toString(),
    assignmentId: sourceGroup.assignmentId.toString(),
    courseId: sourceGroup.courseId.toString(),
    userId: targetUserId,
    action: "moved_out",
    operatorId: req.user!.id,
  });
  const targetEvent = createEventEnvelope("group.member.updated", {
    groupId: targetGroupId.toString(),
    assignmentId: sourceGroup.assignmentId.toString(),
    courseId: sourceGroup.courseId.toString(),
    userId: targetUserId,
    action: "moved_in",
    operatorId: req.user!.id,
  });
  await pushSocketEvent(`group:${sourceGroupId.toString()}`, sourceEvent);
  await pushSocketEvent(`group:${targetGroupId.toString()}`, targetEvent);
  await pushSocketEvent(`course:${sourceGroup.courseId.toString()}`, sourceEvent);
  await pushSocketEvent(`course:${sourceGroup.courseId.toString()}`, targetEvent);

  return ok(res, {
    assignmentId: sourceGroup.assignmentId.toString(),
    userId: targetUserId,
    fromGroupId: sourceGroupId.toString(),
    toGroupId: targetGroupId.toString(),
  });
});
