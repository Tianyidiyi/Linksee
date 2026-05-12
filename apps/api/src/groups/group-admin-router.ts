import { GroupStatus, Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseBigIntParam, serializeBigInt, validationFailed, conflict } from "../assignments/assignment-access.js";
import { fail, ok } from "../infra/http-response.js";
import { ensureAssignmentManageable, ensureGroupManageable } from "./group-access.js";
import { parseBigIntBodyValue } from "./group-utils.js";
import { ensureGroupConversation } from "../collaboration/chat-helpers.js";

export const groupAdminRouter = Router();

function parseGroupStatus(value: unknown): GroupStatus | null {
  if (typeof value !== "string") return null;
  if (!Object.values(GroupStatus).includes(value as GroupStatus)) return null;
  return value as GroupStatus;
}

groupAdminRouter.post("/groups/:groupId/merge", requireAuth, async (req: Request, res: Response) => {
  const sourceGroupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (sourceGroupId === null) return;

  const targetGroupId = parseBigIntParam(parseBigIntBodyValue(req.body?.targetGroupId), "targetGroupId", res);
  if (targetGroupId === null) return;
  if (targetGroupId === sourceGroupId) {
    return conflict(res, "targetGroupId must be different from groupId");
  }

  const sourceGroup = await ensureGroupManageable(sourceGroupId, req.user!.id, req.user!.role as Role, res);
  if (!sourceGroup) return;
  const targetGroup = await ensureGroupManageable(targetGroupId, req.user!.id, req.user!.role as Role, res);
  if (!targetGroup) return;
  if (sourceGroup.assignmentId !== targetGroup.assignmentId) {
    return conflict(res, "Groups must belong to the same assignment");
  }

  const result = await prisma.$transaction(async (tx) => {
    const source = await tx.group.findUnique({
      where: { id: sourceGroupId },
      select: {
        id: true,
        status: true,
        _count: { select: { members: true, joinRequests: true, leaderTransferRequests: true } },
      },
    });
    const target = await tx.group.findUnique({
      where: { id: targetGroupId },
      select: {
        id: true,
        status: true,
        _count: { select: { members: true } },
      },
    });
    if (!source || !target) return { ok: false as const, code: "NOT_FOUND" as const };
    if (source.status === GroupStatus.archived || target.status === GroupStatus.archived) {
      return { ok: false as const, code: "ARCHIVED" as const };
    }
    if (source._count.members === 0) {
      return { ok: false as const, code: "EMPTY" as const };
    }

    const members = await tx.groupMember.findMany({
      where: { groupId: sourceGroupId },
      select: { id: true, userId: true, role: true },
    });

    for (const member of members) {
      await tx.groupMember.update({
        where: { id: member.id },
        data: {
          groupId: targetGroupId,
          role: "member",
        },
      });
    }

    await tx.groupJoinRequest.updateMany({
      where: { groupId: sourceGroupId, status: "pending" },
      data: { status: "cancelled" },
    });
    await tx.groupLeaderTransferRequest.updateMany({
      where: { groupId: sourceGroupId, status: "pending" },
      data: { status: "cancelled" },
    });
    await tx.group.update({
      where: { id: sourceGroupId },
      data: { status: GroupStatus.archived },
    });

    return { ok: true as const, movedMembers: members.map((member) => member.userId) };
  });

  if (!result.ok) {
    if (result.code === "EMPTY") {
      return conflict(res, "Source group is empty");
    }
    if (result.code === "ARCHIVED") {
      return conflict(res, "Archived groups cannot be merged");
    }
    return fail(res, 404, "NOT_FOUND", "Group not found");
  }

  return ok(res, {
    sourceGroupId: sourceGroupId.toString(),
    targetGroupId: targetGroupId.toString(),
    movedMembers: result.movedMembers.length,
  });
});

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

    return ok(res, { assignmentId: assignmentId.toString(), created: groups.length });
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

  return ok(res, { id: groupId.toString(), status: GroupStatus.archived });
});

groupAdminRouter.patch("/groups/:groupId/status", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const group = await ensureGroupManageable(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  const status = parseGroupStatus(req.body?.status);
  if (!status) {
    return validationFailed(res, "status must be forming, locked or archived");
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { status },
    select: { id: true, assignmentId: true, groupNo: true, status: true, updatedAt: true },
  });

  return ok(res, serializeBigInt(updated));
});
