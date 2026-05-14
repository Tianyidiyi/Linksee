import {
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
  type AssignmentCourseRecord,
} from "./group-access.js";
import { isBeforeStudentDeadline, isStudent, parseOptionalString } from "./group-utils.js";

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
// GET /api/v1/assignments/:assignmentId/my-group
// 学生查询自己在该作业下的小组
// ──────────────────────────────────────────────────────────────
groupsRouter.get("/assignments/:assignmentId/my-group", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const role = req.user!.role as Role;
  const userId = req.user!.id;

  const assignment = await getAssignmentContext(assignmentId);
  if (!assignment) {
    return fail(res, 404, "NOT_FOUND", "Assignment not found");
  }

  if (!isStudent(role)) {
    const manageable = await ensureAssignmentManageable(assignmentId, userId, role, res);
    if (!manageable) return;
  } else {
    if (!(await ensureCourseMemberActive(assignment.courseId, userId, res))) return;
  }

  const membership = await prisma.groupMember.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } },
    select: { groupId: true, role: true, joinedAt: true },
  });

  if (!membership) {
    return fail(res, 404, "NOT_FOUND", "Group not found for current user");
  }

  const group = await prisma.group.findUnique({
    where: { id: membership.groupId },
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

  if (!group) {
    return fail(res, 404, "NOT_FOUND", "Group not found");
  }

  return ok(res, serializeBigInt({
    ...group,
    myRole: membership.role,
    joinedAt: membership.joinedAt,
  }));
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

  ok(res, {
    id: created.groupId.toString(),
    assignmentId: assignmentId.toString(),
    groupNo: created.groupNo,
    name,
  }, 201);
});

