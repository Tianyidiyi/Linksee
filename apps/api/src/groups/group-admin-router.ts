import { GroupStatus, Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseBigIntParam, serializeBigInt, validationFailed, conflict } from "../assignments/assignment-access.js";
import { fail, ok } from "../infra/http-response.js";
import { ensureAssignmentManageable, ensureGroupManageable } from "./group-access.js";
import { ensureGroupConversation } from "../collaboration/chat-helpers.js";
import { syncSingleGroupLifecycle } from "./group-lifecycle.js";

export const groupAdminRouter = Router();

function parseGroupStatus(value: unknown): GroupStatus | null {
  if (typeof value !== "string") return null;
  if (!Object.values(GroupStatus).includes(value as GroupStatus)) return null;
  return value as GroupStatus;
}

function canTransitionGroupStatus(from: GroupStatus, to: GroupStatus): boolean {
  if (from === to) return true;
  if (from === GroupStatus.forming && (to === GroupStatus.active || to === GroupStatus.archived)) return true;
  if (from === GroupStatus.active && to === GroupStatus.archived) return true;
  return false;
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/assignments/:assignmentId/groups/conversations
// 老师/助教确认分组后批量生成小组群会话
// ──────────────────────────────────────────────────────────────

groupAdminRouter.post(
  "/assignments/:assignmentId/groups/conversations",
  requireAuth,
  async (req: Request, res: Response) => {
    const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
    if (assignmentId === null) return;

    const role = req.user!.role as Role;
    const userId = req.user!.id;
    const assignment = await ensureAssignmentManageable(assignmentId, userId, role, res);
    if (!assignment) return;

    const groups = await prisma.group.findMany({
      where: { assignmentId },
      select: { id: true, createdBy: true },
    });

    await Promise.all(
      groups.map((group) => ensureGroupConversation(group.id, group.createdBy ?? userId)),
    );

    return ok(res, { assignmentId: assignmentId.toString(), processedCount: groups.length });
  },
);

groupAdminRouter.delete("/groups/:groupId", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const group = await ensureGroupManageable(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  const current = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      status: true,
      _count: { select: { members: true } },
    },
  });
  if (!current) {
    return fail(res, 404, "NOT_FOUND", "Group not found");
  }
  if (current.status === GroupStatus.archived) {
    return ok(res, { id: groupId.toString(), status: GroupStatus.archived });
  }
  if (current._count.members > 0) {
    return conflict(res, "Group must be empty before deletion; merge or move members first");
  }

  await prisma.group.update({
    where: { id: groupId },
    data: { status: GroupStatus.archived },
  });

  await prisma.chatConversation.updateMany({
    where: { scopeType: "group", scopeId: groupId },
    data: { status: "archived" },
  });

  return ok(res, { id: groupId.toString(), status: GroupStatus.archived });
});

groupAdminRouter.patch("/groups/:groupId/status", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const group = await ensureGroupManageable(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  const status = parseGroupStatus(req.body?.status);
  if (!status) {
    return validationFailed(res, "status must be forming, active or archived");
  }

  const current = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      assignmentId: true,
      groupNo: true,
      name: true,
      status: true,
      createdBy: true,
      assignment: {
        select: {
          courseId: true,
        },
      },
    },
  });
  if (!current) {
    return fail(res, 404, "NOT_FOUND", "Group not found");
  }

  if (!canTransitionGroupStatus(current.status, status)) {
    return conflict(res, `Invalid group status transition: ${current.status} -> ${status}`);
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { status },
    select: { id: true, assignmentId: true, groupNo: true, status: true, updatedAt: true },
  });
  await syncSingleGroupLifecycle({
    group: {
      id: current.id,
      assignmentId: current.assignmentId,
      courseId: current.assignment.courseId,
      groupNo: current.groupNo,
      name: current.name,
      createdBy: current.createdBy,
      status: current.status,
    },
    nextStatus: status,
    operatorId: req.user!.id,
  });

  return ok(res, serializeBigInt(updated));
});
