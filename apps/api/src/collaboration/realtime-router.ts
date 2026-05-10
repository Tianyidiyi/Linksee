import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { Role } from "@prisma/client";
import { validationFailed } from "../assignments/assignment-access.js";
import { ensureCourseReadable } from "../courses/course-access.js";
import { getGroupAccess } from "../groups/group-access.js";
import { ackRealtimeEvent, filterAckedEvents, loadReplayEvents } from "../events/realtime-cache.js";

export const realtimeRouter = Router();

function parseRoom(rawValue: unknown, res: Response): string | null {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    validationFailed(res, "room is required");
    return null;
  }
  return rawValue.trim();
}

async function ensureRoomReadable(room: string, req: Request, res: Response): Promise<boolean> {
  const [scope, id] = room.split(":");
  if (!id || !/^[0-9]+$/.test(id)) {
    validationFailed(res, "room is invalid");
    return false;
  }

  if (scope === "course") {
    return !!(await ensureCourseReadable(BigInt(id), req.user!.id, req.user!.role as Role, res));
  }

  if (scope === "group") {
    return !!(await getGroupAccess(BigInt(id), req.user!.id, req.user!.role as Role, res));
  }

  validationFailed(res, "room is invalid");
  return false;
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/realtime/acks
// ──────────────────────────────────────────────────────────────
realtimeRouter.post("/realtime/acks", requireAuth, async (req: Request, res: Response) => {
  const eventId = typeof req.body?.eventId === "string" ? req.body.eventId : "";
  if (!eventId) {
    return validationFailed(res, "eventId is required");
  }

  const room = parseRoom(req.body?.roomKey, res);
  if (!room) return;
  if (!(await ensureRoomReadable(room, req, res))) return;

  await ackRealtimeEvent(req.user!.id, eventId);

  const messageId = typeof req.body?.messageId === "string" ? req.body.messageId : "";
  if (messageId && /^[0-9]+$/.test(messageId)) {
    if (!room) return;

    const conversation = await prisma.chatConversation.findFirst({
      where: { roomKey: room },
      select: { id: true },
    });
    if (conversation) {
      await prisma.chatConversationRead.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId: req.user!.id } },
        update: { lastMessageId: BigInt(messageId), lastReadAt: new Date() },
        create: { conversationId: conversation.id, userId: req.user!.id, lastMessageId: BigInt(messageId), lastReadAt: new Date() },
      });
    }
  }

  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────────
// GET /api/v1/realtime/replay
// ──────────────────────────────────────────────────────────────
realtimeRouter.get("/realtime/replay", requireAuth, async (req: Request, res: Response) => {
  const room = parseRoom(req.query.room, res);
  if (!room) return;
  if (!(await ensureRoomReadable(room, req, res))) return;

  const afterEventId = typeof req.query.afterEventId === "string" ? req.query.afterEventId : undefined;
  const events = await loadReplayEvents(room, afterEventId);
  const filtered = await filterAckedEvents(req.user!.id, events);

  res.json({ ok: true, data: filtered });
});
