import { MiniTaskPriority, MiniTaskStatus, Prisma, Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseLimitOffset } from "../infra/request-utils.js";
import { fail, ok } from "../infra/http-response.js";
import { conflict, parseBigIntParam, serializeBigInt, validationFailed } from "../assignments/assignment-access.js";
import { ensureCourseMemberActive, getGroupAccess } from "../groups/group-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";
import { ensureGroupConversation, getConversationId } from "../collaboration/chat-helpers.js";

export const minitasksRouter = Router();

function parseOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePriority(value: unknown): MiniTaskPriority | null {
  if (value === undefined || value === null) return MiniTaskPriority.medium;
  if (typeof value !== "string") return null;
  if (!Object.values(MiniTaskPriority).includes(value as MiniTaskPriority)) return null;
  return value as MiniTaskPriority;
}

function parseStatus(value: unknown): MiniTaskStatus | null {
  if (typeof value !== "string") return null;
  if (!Object.values(MiniTaskStatus).includes(value as MiniTaskStatus)) return null;
  return value as MiniTaskStatus;
}

function parseDateInput(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function parseBodyBigInt(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return String(value);
  return undefined;
}

function normalizeAssigneeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id) continue;
    unique.add(id);
  }
  return Array.from(unique);
}

async function ensureLeader(groupId: bigint, userId: string, res: Response): Promise<boolean> {
  const leader = await prisma.groupMember.findFirst({
    where: { groupId, userId, role: "leader" },
    select: { id: true },
  });
  if (!leader) {
    fail(res, 403, "FORBIDDEN", "Only group leader can perform this operation");
    return false;
  }
  return true;
}

async function isLeader(groupId: bigint, userId: string): Promise<boolean> {
  const leader = await prisma.groupMember.findFirst({
    where: { groupId, userId, role: "leader" },
    select: { id: true },
  });
  return Boolean(leader);
}

async function ensureAssigneesInGroup(groupId: bigint, assigneeIds: string[]): Promise<boolean> {
  if (assigneeIds.length === 0) return false;
  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: assigneeIds } },
    select: { userId: true },
  });
  return members.length === assigneeIds.length;
}

type MiniTaskSelectResult = {
  id: bigint;
  groupId: bigint;
  stageId: bigint | null;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeIds: Prisma.JsonValue | null;
  priority: MiniTaskPriority;
  status: MiniTaskStatus;
  dueAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  reminder1dSentAt: Date | null;
  reminder1hSentAt: Date | null;
  overdueSentAt: Date | null;
};

function miniTaskSelect(): Prisma.MiniTaskSelect {
  return {
    id: true,
    groupId: true,
    stageId: true,
    title: true,
    description: true,
    assigneeId: true,
    assigneeIds: true,
    priority: true,
    status: true,
    dueAt: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
    reminder1dSentAt: true,
    reminder1hSentAt: true,
    overdueSentAt: true,
  } as Prisma.MiniTaskSelect;
}

function extractAssigneeIds(task: { assigneeId: string | null; assigneeIds: Prisma.JsonValue | null }): string[] {
  const list = normalizeAssigneeIds(task.assigneeIds);
  if (list.length > 0) return list;
  return task.assigneeId ? [task.assigneeId] : [];
}

async function postTaskMentionMessage(
  groupId: bigint,
  userId: string,
  assignmentId: bigint,
  courseId: bigint,
  title: string,
  mentions: string[],
): Promise<void> {
  const conversationId = await getConversationId("group", groupId);
  if (!conversationId) return;

  const mentionText = mentions.map((id) => `@${id}`).join(" ");
  const content = `新建任务：${title}，请 ${mentionText} 处理`;
  const chatEvent = createEventEnvelope("group.message.created", {
    groupId: groupId.toString(),
    assignmentId: assignmentId.toString(),
    courseId: courseId.toString(),
    senderId: userId,
    content,
    messageType: "text",
    files: null,
    mentions,
    replyToId: null,
  });

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId: userId,
      content,
      mentions: mentions as unknown as Prisma.InputJsonValue,
      files: Prisma.JsonNull,
      eventId: chatEvent.id,
      traceId: chatEvent.traceId,
    },
    select: { id: true },
  });

  await pushSocketEvent(`group:${groupId.toString()}`, {
    ...chatEvent,
    payload: { ...chatEvent.payload, messageId: message.id.toString() },
  });
}

minitasksRouter.post("/groups/:groupId/minitasks", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const role = req.user!.role as Role;
  const userId = req.user!.id;
  const group = await getGroupAccess(groupId, userId, role, res);
  if (!group) return;

  if (role === Role.student) {
    if (!(await ensureCourseMemberActive(group.courseId, userId, res))) return;
    if (!(await ensureLeader(groupId, userId, res))) return;
  }

  const title = parseOptionalString(req.body?.title);
  if (!title) return validationFailed(res, "title is required");

  const description =
    req.body?.description === undefined || req.body?.description === null
      ? null
      : typeof req.body.description === "string"
        ? req.body.description
        : null;
  if (req.body?.description !== undefined && req.body?.description !== null && description === null) {
    return validationFailed(res, "description must be a string or null");
  }

  const assigneeIds = normalizeAssigneeIds(req.body?.assigneeIds);
  if (assigneeIds.length === 0) return validationFailed(res, "assigneeIds is required and must be a non-empty string array");
  if (!(await ensureAssigneesInGroup(groupId, assigneeIds))) {
    return validationFailed(res, "All assigneeIds must be group members");
  }

  const priority = parsePriority(req.body?.priority);
  if (!priority) return validationFailed(res, "priority must be low, medium or high");

  const dueAt = parseDateInput(req.body?.dueAt);
  if (req.body?.dueAt !== undefined && dueAt === undefined) {
    return validationFailed(res, "dueAt must be a valid ISO datetime string or null");
  }

  let stageId: bigint | null = null;
  if (req.body?.stageId !== undefined && req.body?.stageId !== null) {
    const parsedStageId = parseBigIntParam(parseBodyBigInt(req.body.stageId), "stageId", res);
    if (parsedStageId === null) return;

    const stage = await prisma.assignmentStage.findFirst({
      where: { id: parsedStageId, assignmentId: group.assignmentId },
      select: { id: true },
    });
    if (!stage) return fail(res, 404, "NOT_FOUND", "stageId not found in this assignment");
    stageId = parsedStageId;
  }

  const task = await prisma.miniTask.create({
    data: {
      groupId,
      stageId,
      title,
      description,
      assigneeId: assigneeIds[0] ?? null,
      assigneeIds: assigneeIds as unknown as Prisma.InputJsonValue,
      priority,
      dueAt: dueAt ?? null,
      createdBy: userId,
    },
    select: miniTaskSelect(),
  });

  await postTaskMentionMessage(groupId, userId, group.assignmentId, group.courseId, title, assigneeIds);

  await pushSocketEvent(
    `group:${groupId.toString()}`,
    createEventEnvelope("group.minitask.updated", {
      action: "created",
      groupId: groupId.toString(),
      assignmentId: group.assignmentId.toString(),
      courseId: group.courseId.toString(),
      miniTaskId: task.id.toString(),
      assigneeIds,
      operatorId: userId,
    }),
  );

  return ok(res, serializeBigInt(task), 201);
});

minitasksRouter.get("/groups/:groupId/minitasks", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const role = req.user!.role as Role;
  const userId = req.user!.id;
  const group = await getGroupAccess(groupId, userId, role, res);
  if (!group) return;
  if (role === Role.student && !(await ensureCourseMemberActive(group.courseId, userId, res))) return;

  const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>);
  const where: Prisma.MiniTaskWhereInput = { groupId };

  if (req.query.stageId !== undefined) {
    const stageId = parseBigIntParam(req.query.stageId as string | string[] | undefined, "stageId", res);
    if (stageId === null) return;
    where.stageId = stageId;
  }
  if (req.query.assigneeId !== undefined) {
    const assigneeId = parseOptionalString(req.query.assigneeId);
    if (!assigneeId) return validationFailed(res, "assigneeId must be a non-empty string");
    where.OR = [
      { assigneeId },
      { assigneeIds: { array_contains: assigneeId } } as unknown as Prisma.MiniTaskWhereInput,
    ];
  }
  if (req.query.status !== undefined) {
    const status = parseStatus(req.query.status);
    if (!status) return validationFailed(res, "status must be todo, in_progress, done or cancelled");
    where.status = status;
  }

  const [rows, total] = await prisma.$transaction([
    prisma.miniTask.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      skip: offset,
      select: miniTaskSelect(),
    }),
    prisma.miniTask.count({ where }),
  ]);

  return res.json({
    ok: true,
    data: serializeBigInt(rows),
    paging: { limit, offset, total, hasMore: offset + rows.length < total },
  });
});

minitasksRouter.patch("/minitasks/:taskId", requireAuth, async (req: Request, res: Response) => {
  const taskId = parseBigIntParam(req.params.taskId, "taskId", res);
  if (taskId === null) return;

  const task = await prisma.miniTask.findUnique({
    where: { id: taskId },
    select: {
      ...miniTaskSelect(),
      group: {
        select: {
          assignmentId: true,
          assignment: { select: { courseId: true } },
        },
      },
    },
  });
  if (!task) return fail(res, 404, "NOT_FOUND", "MiniTask not found");

  const role = req.user!.role as Role;
  const userId = req.user!.id;
  const groupAccess = await getGroupAccess(task.groupId, userId, role, res);
  if (!groupAccess) return;
  if (role === Role.student) {
    if (!(await ensureCourseMemberActive(groupAccess.courseId, userId, res))) return;
    if (!(await ensureLeader(task.groupId, userId, res))) return;
  }

  const hasTitle = req.body?.title !== undefined;
  const hasDescription = req.body?.description !== undefined;
  const hasPriority = req.body?.priority !== undefined;
  const hasDueAt = req.body?.dueAt !== undefined;
  if (!hasTitle && !hasDescription && !hasPriority && !hasDueAt) {
    return validationFailed(res, "At least one of title, description, priority, dueAt is required");
  }

  const nextData: Prisma.MiniTaskUpdateInput = {};

  if (hasTitle) {
    const title = parseOptionalString(req.body?.title);
    if (!title) return validationFailed(res, "title must be a non-empty string");
    nextData.title = title;
  }

  if (hasDescription) {
    if (req.body.description !== null && typeof req.body.description !== "string") {
      return validationFailed(res, "description must be a string or null");
    }
    nextData.description = req.body.description ?? null;
  }

  if (hasPriority) {
    const priority = parsePriority(req.body?.priority);
    if (!priority) return validationFailed(res, "priority must be low, medium or high");
    nextData.priority = priority;
  }

  if (hasDueAt) {
    const dueAt = parseDateInput(req.body?.dueAt);
    if (dueAt === undefined) return validationFailed(res, "dueAt must be a valid ISO datetime string or null");
    if (task.dueAt && dueAt && dueAt.getTime() < task.dueAt.getTime()) {
      return conflict(res, "dueAt can only be postponed, not moved earlier");
    }
    nextData.dueAt = dueAt ?? null;
    Object.assign(
      nextData,
      {
        reminder1dSentAt: null,
        reminder1hSentAt: null,
        overdueSentAt: null,
      } as Prisma.MiniTaskUpdateInput,
    );
  }

  const updated = await prisma.miniTask.update({
    where: { id: taskId },
    data: nextData,
    select: miniTaskSelect(),
  });

  await pushSocketEvent(
    `group:${task.groupId.toString()}`,
    createEventEnvelope("group.minitask.updated", {
      action: "edited",
      groupId: task.groupId.toString(),
      assignmentId: task.group.assignmentId.toString(),
      courseId: task.group.assignment.courseId.toString(),
      miniTaskId: taskId.toString(),
      operatorId: userId,
    }),
  );

  return ok(res, serializeBigInt(updated));
});

minitasksRouter.patch("/minitasks/:taskId/status", requireAuth, async (req: Request, res: Response) => {
  const taskId = parseBigIntParam(req.params.taskId, "taskId", res);
  if (taskId === null) return;

  const task = await prisma.miniTask.findUnique({
    where: { id: taskId },
    select: {
      ...miniTaskSelect(),
      group: {
        select: {
          assignmentId: true,
          assignment: { select: { courseId: true } },
        },
      },
    },
  });
  if (!task) return fail(res, 404, "NOT_FOUND", "MiniTask not found");

  const role = req.user!.role as Role;
  const userId = req.user!.id;
  const groupAccess = await getGroupAccess(task.groupId, userId, role, res);
  if (!groupAccess) return;
  if (role === Role.student && !(await ensureCourseMemberActive(groupAccess.courseId, userId, res))) return;

  const nextStatus = parseStatus(req.body?.status);
  if (!nextStatus) return validationFailed(res, "status must be todo, in_progress, done or cancelled");

  const assigneeIds = extractAssigneeIds({
    assigneeId: task.assigneeId,
    assigneeIds: (task as unknown as { assigneeIds: Prisma.JsonValue | null }).assigneeIds,
  });
  const leader = await isLeader(task.groupId, userId);

  if (nextStatus === MiniTaskStatus.cancelled) {
    if (!leader) return fail(res, 403, "FORBIDDEN", "Only group leader can set cancelled");
  } else {
    if (!assigneeIds.includes(userId)) {
      return fail(res, 403, "FORBIDDEN", "Only assignees can update task status");
    }
  }

  if (task.status === MiniTaskStatus.cancelled && nextStatus !== MiniTaskStatus.cancelled) {
    return conflict(res, "Cancelled task status cannot be changed back");
  }

  const updated = await prisma.miniTask.update({
    where: { id: taskId },
    data: { status: nextStatus },
    select: miniTaskSelect(),
  });

  await pushSocketEvent(
    `group:${task.groupId.toString()}`,
    createEventEnvelope("group.minitask.updated", {
      action: "status_changed",
      groupId: task.groupId.toString(),
      assignmentId: task.group.assignmentId.toString(),
      courseId: task.group.assignment.courseId.toString(),
      miniTaskId: taskId.toString(),
      status: nextStatus,
      operatorId: userId,
    }),
  );

  return ok(res, serializeBigInt(updated));
});
