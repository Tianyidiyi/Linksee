import {
  GroupJoinRequestStatus,
  GroupLeaderTransferRequestStatus,
  GroupMemberRole,
  Role,
} from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseBigIntParam, serializeBigInt, validationFailed, conflict } from "../assignments/assignment-access.js";
import { fail, ok } from "../infra/http-response.js";
import { ensureCourseMemberActive, ensureGroupManageable } from "./group-access.js";
import { isCourseStaff, isBeforeStudentDeadline, isStudent, parseOptionalString } from "./group-utils.js";

export const groupRequestsRouter = Router();

groupRequestsRouter.post("/groups/:groupId/join-requests", requireAuth, async (req: Request, res: Response) => {
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

groupRequestsRouter.get("/groups/:groupId/join-requests", requireAuth, async (req: Request, res: Response) => {
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

groupRequestsRouter.post("/group-join-requests/:requestId/approve", requireAuth, async (req: Request, res: Response) => {
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

groupRequestsRouter.post("/group-join-requests/:requestId/reject", requireAuth, async (req: Request, res: Response) => {
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

groupRequestsRouter.post("/groups/:groupId/leader-transfer-requests", requireAuth, async (req: Request, res: Response) => {
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

groupRequestsRouter.post("/group-leader-transfer-requests/:requestId/accept", requireAuth, async (req: Request, res: Response) => {
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

groupRequestsRouter.post("/group-leader-transfer-requests/:requestId/reject", requireAuth, async (req: Request, res: Response) => {
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
