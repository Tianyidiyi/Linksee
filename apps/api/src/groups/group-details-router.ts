import { Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseBigIntParam, serializeBigInt } from "../assignments/assignment-access.js";
import { fail, ok } from "../infra/http-response.js";
import { ensureGroupManageable, getGroupAccess } from "./group-access.js";

export const groupDetailsRouter = Router();

groupDetailsRouter.get("/groups/:groupId", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const role = req.user!.role as Role;
  const userId = req.user!.id;

  const groupAccess =
    role === Role.student
      ? await getGroupAccess(groupId, userId, role, res)
      : await ensureGroupManageable(groupId, userId, role, res);
  if (!groupAccess) return;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      assignmentId: true,
      groupNo: true,
      name: true,
      status: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      assignment: {
        select: { courseId: true },
      },
    },
  });

  if (!group) {
    return fail(res, 404, "NOT_FOUND", "Group not found");
  }

  const [members, statusCounts, overdueCount, latestTask] = await prisma.$transaction([
    prisma.groupMember.findMany({
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
    }),
    prisma.miniTask.groupBy({
      by: ["status"],
      where: { groupId },
      _count: { _all: true },
    }),
    prisma.miniTask.count({
      where: {
        groupId,
        status: { in: ["todo", "in_progress"] },
        dueAt: { lt: new Date() },
      },
    }),
    prisma.miniTask.findFirst({
      where: { groupId },
      orderBy: [{ updatedAt: "desc" }],
      select: { updatedAt: true },
    }),
  ]);

  const statusMap: Record<string, number> = {
    todo: 0,
    in_progress: 0,
    done: 0,
    cancelled: 0,
  };
  for (const entry of statusCounts) {
    statusMap[entry.status] = entry._count._all;
  }

  return ok(res, serializeBigInt({
    group: {
      id: group.id,
      assignmentId: group.assignmentId,
      courseId: group.assignment.courseId,
      groupNo: group.groupNo,
      name: group.name,
      status: group.status,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    },
    members,
    miniTaskStats: {
      total: Object.values(statusMap).reduce((sum, value) => sum + value, 0),
      byStatus: statusMap,
      overdue: overdueCount,
      latestUpdatedAt: latestTask?.updatedAt ?? null,
    },
  }));
});
