import { Prisma, Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { resolveUserScopes } from "../infra/user-scope.js";
import { parseBigIntParam, serializeBigInt, validationFailed } from "../assignments/assignment-access.js";
import { resolveMessageType } from "./chat-helpers.js";

export const conversationsRouter = Router();

function forbidden(res: Response, message = "Insufficient permissions"): void {
  res.status(403).json({ ok: false, code: "FORBIDDEN", message });
}

function buildTaskEventJsonFilter(): Prisma.JsonFilter {
  return {
    path: "$.subType",
    equals: "task_event",
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/conversations
// ──────────────────────────────────────────────────────────────
conversationsRouter.get("/conversations", requireAuth, async (req: Request, res: Response) => {
  const role = req.user!.role as Role;
  const scopes = await resolveUserScopes(req.user!.id, role);

  const filters: Prisma.ChatConversationWhereInput[] = [];
  if (scopes.courseIds.length > 0) {
    filters.push({ scopeType: "course", scopeId: { in: scopes.courseIds } });
  }
  if (scopes.groupIds.length > 0) {
    filters.push({ scopeType: "group", scopeId: { in: scopes.groupIds } });
  }

  if (filters.length === 0) {
    return res.json({ ok: true, data: [] });
  }

  const conversations = await prisma.chatConversation.findMany({
    where: { OR: filters },
    select: { id: true, scopeType: true, scopeId: true, roomKey: true },
  });

  const conversationIds = conversations.map((conversation) => conversation.id);

  const [lastMessages, taskMessages, readStates, courses, groups] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { conversationId: { in: conversationIds }, deletedAt: null },
      orderBy: [{ createdAt: Prisma.SortOrder.desc }, { id: Prisma.SortOrder.desc }],
      distinct: ["conversationId"],
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true,
        files: true,
        mentions: true,
        replyToId: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
      },
    }),
    prisma.chatMessage.findMany({
      where: {
        conversationId: { in: conversationIds },
        deletedAt: null,
        files: buildTaskEventJsonFilter(),
      },
      orderBy: [{ createdAt: Prisma.SortOrder.desc }, { id: Prisma.SortOrder.desc }],
      distinct: ["conversationId"],
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true,
        files: true,
        mentions: true,
        replyToId: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
      },
    }),
    prisma.chatConversationRead.findMany({
      where: { conversationId: { in: conversationIds }, userId: req.user!.id },
      select: { conversationId: true, lastMessageId: true, lastReadAt: true },
    }),
    prisma.course.findMany({ where: { id: { in: scopes.courseIds }, status: { not: "draft" } }, select: { id: true, name: true } }),
    prisma.group.findMany({
      where: { id: { in: scopes.groupIds } },
      select: { id: true, groupNo: true, name: true, assignmentId: true, assignment: { select: { courseId: true } } },
    }),
  ]);

  const lastMessageMap = new Map<bigint, typeof lastMessages[number]>();
  for (const message of lastMessages) {
    lastMessageMap.set(message.conversationId, message);
  }

  const taskMessageMap = new Map<bigint, typeof taskMessages[number]>();
  for (const message of taskMessages) {
    taskMessageMap.set(message.conversationId, message);
  }

  const readMap = new Map<bigint, { lastMessageId: bigint | null; lastReadAt: Date | null }>();
  for (const read of readStates) {
    readMap.set(read.conversationId, { lastMessageId: read.lastMessageId, lastReadAt: read.lastReadAt });
  }

  const courseMap = new Map<bigint, string>();
  for (const course of courses) {
    courseMap.set(course.id, course.name);
  }

  const groupMap = new Map<bigint, { label: string; assignmentId: bigint; courseId: bigint }>();
  for (const group of groups) {
    const label = group.name?.trim() || `Group ${group.groupNo}`;
    groupMap.set(group.id, { label, assignmentId: group.assignmentId, courseId: group.assignment.courseId });
  }

  const [unreadCounts, unreadTaskCounts] = await Promise.all([
    Promise.all(
      conversations.map(async (conversation) => {
        const read = readMap.get(conversation.id);
        const lastMessageId = read?.lastMessageId ?? null;
        const where: Prisma.ChatMessageWhereInput = {
          conversationId: conversation.id,
          deletedAt: null,
          ...(lastMessageId ? { id: { gt: lastMessageId } } : {}),
        };
        const count = await prisma.chatMessage.count({ where });
        return [conversation.id, count] as const;
      }),
    ),
    Promise.all(
      conversations.map(async (conversation) => {
        const read = readMap.get(conversation.id);
        const lastMessageId = read?.lastMessageId ?? null;
        const where: Prisma.ChatMessageWhereInput = {
          conversationId: conversation.id,
          deletedAt: null,
          files: buildTaskEventJsonFilter(),
          ...(lastMessageId ? { id: { gt: lastMessageId } } : {}),
        };
        const count = await prisma.chatMessage.count({ where });
        return [conversation.id, count] as const;
      }),
    ),
  ]);

  const unreadMap = new Map<bigint, number>(unreadCounts);
  const unreadTaskMap = new Map<bigint, number>(unreadTaskCounts);

  const data = conversations.flatMap((conversation) => {
    const lastMessage = lastMessageMap.get(conversation.id);
    const lastTaskMessage = taskMessageMap.get(conversation.id);
    const lastRead = readMap.get(conversation.id);
    const unreadCount = unreadMap.get(conversation.id) ?? 0;
    const unreadTaskCount = unreadTaskMap.get(conversation.id) ?? 0;
    const hasTaskNotification = Boolean(lastTaskMessage);

    if (conversation.scopeType === "course") {
      const courseTitle = courseMap.get(conversation.scopeId);
      if (!courseTitle) {
        return [];
      }
      return [{
        id: conversation.id.toString(),
        scopeType: "course",
        scopeId: conversation.scopeId.toString(),
        title: courseTitle,
        roomKey: conversation.roomKey,
        lastMessage: lastMessage
          ? {
              ...lastMessage,
              messageType: resolveMessageType(lastMessage.files, lastMessage.content),
            }
          : null,
        lastTaskMessage: lastTaskMessage
          ? {
              ...lastTaskMessage,
              messageType: resolveMessageType(lastTaskMessage.files, lastTaskMessage.content),
            }
          : null,
        unreadCount,
        unreadTaskCount,
        hasTaskNotification,
        lastReadAt: lastRead?.lastReadAt?.toISOString() ?? null,
      }];
    }

    const groupInfo = groupMap.get(conversation.scopeId);
    return [{
      id: conversation.id.toString(),
      scopeType: "group",
      scopeId: conversation.scopeId.toString(),
      title: groupInfo?.label ?? "Group",
      roomKey: conversation.roomKey,
      assignmentId: groupInfo?.assignmentId?.toString() ?? null,
      courseId: groupInfo?.courseId?.toString() ?? null,
      lastMessage: lastMessage
        ? {
            ...lastMessage,
            messageType: resolveMessageType(lastMessage.files, lastMessage.content),
          }
        : null,
      lastTaskMessage: lastTaskMessage
        ? {
            ...lastTaskMessage,
            messageType: resolveMessageType(lastTaskMessage.files, lastTaskMessage.content),
          }
        : null,
      unreadCount,
      unreadTaskCount,
      hasTaskNotification,
      lastReadAt: lastRead?.lastReadAt?.toISOString() ?? null,
    }];
  });

  res.json({ ok: true, data: serializeBigInt(data) });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/conversations/:conversationId/read
// ──────────────────────────────────────────────────────────────
conversationsRouter.post(
  "/conversations/:conversationId/read",
  requireAuth,
  async (req: Request, res: Response) => {
    const conversationId = parseBigIntParam(req.params.conversationId, "conversationId", res);
    if (conversationId === null) return;

    const messageId = typeof req.body?.messageId === "string" ? req.body.messageId : "";
    if (!messageId || !/^[0-9]+$/.test(messageId)) {
      return validationFailed(res, "messageId is required");
    }

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { scopeType: true, scopeId: true },
    });
    if (!conversation) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Conversation not found" });
    }

    const scopes = await resolveUserScopes(req.user!.id, req.user!.role as Role);
    const allowed =
      (conversation.scopeType === "course" && scopes.courseIds.some((id) => id === conversation.scopeId)) ||
      (conversation.scopeType === "group" && scopes.groupIds.some((id) => id === conversation.scopeId));
    if (!allowed) {
      return forbidden(res);
    }

    const message = await prisma.chatMessage.findFirst({
      where: { id: BigInt(messageId), conversationId },
      select: { id: true },
    });
    if (!message) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Message not found" });
    }

    await prisma.chatConversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: req.user!.id } },
      update: { lastMessageId: message.id, lastReadAt: new Date() },
      create: { conversationId, userId: req.user!.id, lastMessageId: message.id, lastReadAt: new Date() },
    });

    res.json({ ok: true });
  },
);
