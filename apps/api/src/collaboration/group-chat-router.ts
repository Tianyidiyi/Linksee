import { Prisma, Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseIdempotencyKey, parseLimitOffset } from "../infra/request-utils.js";
import { fail, ok } from "../infra/http-response.js";
import { parseBigIntParam, serializeBigInt, validationFailed } from "../assignments/assignment-access.js";
import { ensureCourseMemberActive, getGroupAccess } from "../groups/group-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";
import {
  CHAT_MENTION_LIMIT,
  ensureGroupConversation,
  getConversationId,
  normalizeMentions,
  parseCursorParam,
  resolveMessageType,
} from "./chat-helpers.js";
import {
  CHAT_FILE_MAX_BYTES,
  ensureChatFileSize,
  isAllowedChatMimeType,
  isObjectKeyInScope,
  normalizeChatFiles,
  toChatFileMetadata,
} from "./chat-file-storage.js";

export const groupChatRouter = Router();
const prismaChatFile = prisma as typeof prisma & {
  chatFile: { createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown> };
};
const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  files: true,
  mentions: true,
  replyToId: true,
  eventId: true,
  traceId: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
} as unknown as Prisma.ChatMessageSelect;

function forbidden(res: Response, message = "Insufficient permissions"): void {
  fail(res, 403, "FORBIDDEN", message);
}

function parseOptionalMessageId(rawValue: unknown, res: Response, fieldName: string): bigint | null {
  if (rawValue === undefined || rawValue === null || rawValue === "") return null;
  if (typeof rawValue !== "string" || !/^[0-9]+$/.test(rawValue)) {
    validationFailed(res, `${fieldName} must be a positive integer string`);
    return null;
  }
  try {
    return BigInt(rawValue);
  } catch {
    validationFailed(res, `${fieldName} is invalid`);
    return null;
  }
}

async function ensureGroupMentions(
  groupId: bigint,
  courseId: bigint,
  mentions: string[],
  res: Response,
): Promise<boolean> {
  if (mentions.length === 0) return true;

  const [groupMembers, courseMembers, teachers, assistants] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId, userId: { in: mentions } },
      select: { userId: true },
    }),
    prisma.courseMember.findMany({
      where: { courseId, userId: { in: mentions }, status: "active" },
      select: { userId: true },
    }),
    prisma.courseTeacher.findMany({
      where: { courseId, userId: { in: mentions } },
      select: { userId: true },
    }),
    prisma.assistantBinding.findMany({
      where: { courseId, assistantUserId: { in: mentions } },
      select: { assistantUserId: true },
    }),
  ]);

  const valid = new Set<string>([
    ...groupMembers.map((m) => m.userId),
    ...courseMembers.map((m) => m.userId),
    ...teachers.map((t) => t.userId),
    ...assistants.map((a) => a.assistantUserId),
  ]);

  const invalid = mentions.filter((id) => !valid.has(id));
  if (invalid.length > 0) {
    validationFailed(res, `mentions must be group or course members: ${invalid.join(", ")}`);
    return false;
  }

  return true;
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/groups/:groupId/messages
// ──────────────────────────────────────────────────────────────
groupChatRouter.get("/groups/:groupId/messages", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const group = await getGroupAccess(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  if ((req.user!.role as Role) === Role.student) {
    const active = await ensureCourseMemberActive(group.courseId, req.user!.id, res);
    if (!active) return;
  }

  const conversationId = await getConversationId("group", groupId);
  if (!conversationId) {
    return res.json({ ok: true, data: [], paging: { hasMore: false, nextCursor: null } });
  }

  const beforeId = parseCursorParam(req.query.beforeId, res, "beforeId");
  if (req.query.beforeId !== undefined && beforeId === null) return;
  const afterId = parseCursorParam(req.query.afterId, res, "afterId");
  if (req.query.afterId !== undefined && afterId === null) return;
  if (beforeId && afterId) {
    return validationFailed(res, "beforeId and afterId cannot be used together");
  }

  let cursor: { id: bigint; createdAt: Date } | null = null;
  if (beforeId || afterId) {
    const cursorId = beforeId ?? afterId!;
    cursor = await prisma.chatMessage.findFirst({
      where: { id: cursorId, conversationId },
      select: { id: true, createdAt: true },
    });
    if (!cursor) {
      return validationFailed(res, "Cursor message not found in this conversation");
    }
  }

  const { limit } = parseLimitOffset(req.query as Record<string, unknown>);
  const where = {
    conversationId,
    ...(cursor
      ? {
          OR: beforeId
            ? [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ]
            : [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
        }
      : {}),
  };
  const orderBy: Prisma.ChatMessageOrderByWithRelationInput[] = afterId
    ? [{ createdAt: Prisma.SortOrder.asc }, { id: Prisma.SortOrder.asc }]
    : [{ createdAt: Prisma.SortOrder.desc }, { id: Prisma.SortOrder.desc }];
  const messages = await prisma.chatMessage.findMany({
    where,
    orderBy,
    take: limit + 1,
    select: messageSelect,
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = items.length > 0 ? items[items.length - 1].id.toString() : null;

  const mapped = items.map((message) => ({
    ...message,
    messageType: resolveMessageType(message.files, message.content),
  }));

  res.json({ ok: true, data: serializeBigInt(mapped), paging: { hasMore, nextCursor } });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/groups/:groupId/messages
// ──────────────────────────────────────────────────────────────
groupChatRouter.post("/groups/:groupId/messages", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const group = await getGroupAccess(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  if ((req.user!.role as Role) === Role.student) {
    const active = await ensureCourseMemberActive(group.courseId, req.user!.id, res);
    if (!active) return;
  }

  const messageType = typeof req.body?.type === "string" ? req.body.type : "text";
  if (messageType !== "text" && messageType !== "file") {
    return validationFailed(res, "type must be text or file");
  }

  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const filesInput = normalizeChatFiles(req.body?.files);
  if (messageType === "text" && !content) {
    return validationFailed(res, "content is required");
  }
  if (messageType === "text" && filesInput.length > 0) {
    return validationFailed(res, "files are not allowed for text messages");
  }
  if (messageType === "file" && filesInput.length === 0) {
    return validationFailed(res, "files is required for file messages");
  }

  for (const file of filesInput) {
    if (!ensureChatFileSize(file.size)) {
      return validationFailed(res, `file size must be <= ${CHAT_FILE_MAX_BYTES} bytes`);
    }
    if (!isAllowedChatMimeType(file.mimeType)) {
      return validationFailed(res, `mimeType not allowed: ${file.mimeType}`);
    }
    if (!isObjectKeyInScope(file.objectKey, "group", groupId.toString())) {
      return validationFailed(res, "file objectKey does not match group scope");
    }
  }

  const mentions = normalizeMentions(req.body?.mentions);
  if (mentions.length > CHAT_MENTION_LIMIT) {
    return validationFailed(res, `mentions must be <= ${CHAT_MENTION_LIMIT}`);
  }
  if (!(await ensureGroupMentions(groupId, group.courseId, mentions, res))) return;

  const replyToId = parseOptionalMessageId(req.body?.replyToId, res, "replyToId");
  if (req.body?.replyToId !== undefined && replyToId === null) return;

  await ensureGroupConversation(groupId, req.user!.id);

  const conversationId = await getConversationId("group", groupId);
  if (!conversationId) {
    return fail(res, 500, "INTERNAL_ERROR", "Conversation not found");
  }

  if (replyToId) {
    const replyMessage = await prisma.chatMessage.findFirst({
      where: { id: replyToId, conversationId },
      select: { id: true },
    });
    if (!replyMessage) {
      return validationFailed(res, "replyToId must reference a message in this conversation");
    }
  }

  const idempotencyKey = parseIdempotencyKey(req);
  if (idempotencyKey) {
    const existing = await prisma.chatMessage.findUnique({
      where: { eventId: idempotencyKey },
      select: messageSelect,
    });
    if (existing && existing.conversationId === conversationId) {
      return ok(res, serializeBigInt({ ...existing, messageType: resolveMessageType(existing.files, existing.content) }), 201);
    }
  }

  const files = filesInput.length > 0 ? filesInput.map((file) => toChatFileMetadata(file)) : null;

  const event = createEventEnvelope("group.message.created", {
    groupId: groupId.toString(),
    assignmentId: group.assignmentId.toString(),
    courseId: group.courseId.toString(),
    senderId: req.user!.id,
    content,
    messageType,
    files,
    mentions,
    replyToId: replyToId ? replyToId.toString() : null,
  });
  const eventId = idempotencyKey ?? event.id;

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId: req.user!.id,
      content,
      files: files ?? Prisma.JsonNull,
      mentions,
      replyToId,
      eventId: eventId,
      traceId: event.traceId,
    },
    select: messageSelect,
  });

  if (files && files.length > 0) {
    await prismaChatFile.chatFile.createMany({
      data: files.map((file) => ({
        messageId: message.id,
        objectKey: file.objectKey,
        name: file.name,
        size: BigInt(file.size),
        mimeType: file.mimeType,
        uploadedAt: new Date(file.uploadedAt),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        thumbnailKey: file.thumbnailKey ?? null,
      })),
    });
  }

  const outboundEvent = {
    ...event,
    id: eventId,
    payload: {
      ...event.payload,
      messageId: message.id.toString(),
    },
  };

  await pushSocketEvent(`group:${groupId.toString()}`, outboundEvent);

  ok(res, serializeBigInt({ ...message, messageType: resolveMessageType(message.files, message.content) }), 201);
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/groups/:groupId/announcements
// ──────────────────────────────────────────────────────────────
groupChatRouter.post("/groups/:groupId/announcements", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  if ((req.user!.role as Role) === Role.student) {
    return forbidden(res, "Only course staff can post announcements");
  }

  const group = await getGroupAccess(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    return validationFailed(res, "content is required");
  }

  await ensureGroupConversation(groupId, req.user!.id);

  const conversationId = await getConversationId("group", groupId);
  if (!conversationId) {
    return fail(res, 500, "INTERNAL_ERROR", "Conversation not found");
  }

  const files = { type: "announcement" };
  const event = createEventEnvelope("group.message.created", {
    groupId: groupId.toString(),
    assignmentId: group.assignmentId.toString(),
    courseId: group.courseId.toString(),
    senderId: req.user!.id,
    content,
    messageType: "announcement",
    files,
    mentions: [],
    replyToId: null,
  });

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId: req.user!.id,
      content,
      files,
      eventId: event.id,
      traceId: event.traceId,
    },
    select: messageSelect,
  });

  const outboundEvent = {
    ...event,
    payload: {
      ...event.payload,
      messageId: message.id.toString(),
    },
  };

  await pushSocketEvent(`group:${groupId.toString()}`, outboundEvent);

  ok(res, serializeBigInt({ ...message, messageType: "announcement" }), 201);
});

// ──────────────────────────────────────────────────────────────
// GET /api/v1/groups/:groupId/messages/search
// ──────────────────────────────────────────────────────────────
groupChatRouter.get("/groups/:groupId/messages/search", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const group = await getGroupAccess(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  if ((req.user!.role as Role) === Role.student) {
    const active = await ensureCourseMemberActive(group.courseId, req.user!.id, res);
    if (!active) return;
  }

  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    return validationFailed(res, "q is required");
  }

  const conversationId = await getConversationId("group", groupId);
  if (!conversationId) {
    return res.json({ ok: true, data: [] });
  }

  const { limit } = parseLimitOffset(req.query as Record<string, unknown>);
  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId,
      deletedAt: null,
      content: { contains: query, mode: "insensitive" },
    },
    orderBy: [{ createdAt: Prisma.SortOrder.desc }, { id: Prisma.SortOrder.desc }],
    take: limit,
    select: messageSelect,
  });

  const mapped = messages.map((message) => ({
    ...message,
    messageType: resolveMessageType(message.files, message.content),
  }));

  res.json({ ok: true, data: serializeBigInt(mapped) });
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/v1/groups/:groupId/messages/:messageId
// ──────────────────────────────────────────────────────────────
groupChatRouter.patch("/groups/:groupId/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;
  const messageId = parseBigIntParam(req.params.messageId, "messageId", res);
  if (messageId === null) return;

  const group = await getGroupAccess(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  if ((req.user!.role as Role) === Role.student) {
    const active = await ensureCourseMemberActive(group.courseId, req.user!.id, res);
    if (!active) return;
  }

  const conversationId = await getConversationId("group", groupId);
  if (!conversationId) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Conversation not found" });
  }

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, conversationId },
    select: { senderId: true, files: true, deletedAt: true },
  });
  if (!message || message.deletedAt) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Message not found" });
  }

  const isStaff = (req.user!.role as Role) !== Role.student;
  if (message.senderId !== req.user!.id && !isStaff) {
    return forbidden(res);
  }

  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    return validationFailed(res, "content is required");
  }

  if (message.files) {
    return validationFailed(res, "cannot edit file messages");
  }

  const mentions = normalizeMentions(req.body?.mentions);
  if (mentions.length > CHAT_MENTION_LIMIT) {
    return validationFailed(res, `mentions must be <= ${CHAT_MENTION_LIMIT}`);
  }
  if (!(await ensureGroupMentions(groupId, group.courseId, mentions, res))) return;

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { content, mentions, editedAt: new Date() },
    select: messageSelect,
  });

  const updatedEditedAt = (updated as { editedAt?: Date | null }).editedAt;
  const event = createEventEnvelope("group.message.updated", {
    groupId: groupId.toString(),
    assignmentId: group.assignmentId.toString(),
    courseId: group.courseId.toString(),
    messageId: messageId.toString(),
    editorId: req.user!.id,
    content,
    mentions,
    editedAt: updatedEditedAt ? updatedEditedAt.toISOString() : null,
  });

  await pushSocketEvent(`group:${groupId.toString()}`, event);

  res.json({
    ok: true,
    data: serializeBigInt({ ...updated, messageType: resolveMessageType(updated.files, updated.content) }),
  });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/groups/:groupId/messages/:messageId
// ──────────────────────────────────────────────────────────────
groupChatRouter.delete("/groups/:groupId/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;
  const messageId = parseBigIntParam(req.params.messageId, "messageId", res);
  if (messageId === null) return;

  const group = await getGroupAccess(groupId, req.user!.id, req.user!.role as Role, res);
  if (!group) return;

  if ((req.user!.role as Role) === Role.student) {
    const active = await ensureCourseMemberActive(group.courseId, req.user!.id, res);
    if (!active) return;
  }

  const conversationId = await getConversationId("group", groupId);
  if (!conversationId) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Conversation not found" });
  }

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, conversationId },
    select: { senderId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Message not found" });
  }

  const isStaff = (req.user!.role as Role) !== Role.student;
  if (message.senderId !== req.user!.id && !isStaff) {
    return forbidden(res);
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { content: null, files: Prisma.JsonNull, mentions: Prisma.JsonNull, deletedAt: new Date() },
    select: messageSelect,
  });

  const event = createEventEnvelope("group.message.deleted", {
    groupId: groupId.toString(),
    assignmentId: group.assignmentId.toString(),
    courseId: group.courseId.toString(),
    messageId: messageId.toString(),
    operatorId: req.user!.id,
  });

  await pushSocketEvent(`group:${groupId.toString()}`, event);

  res.json({
    ok: true,
    data: serializeBigInt({ ...updated, messageType: resolveMessageType(updated.files, updated.content) }),
  });
});
