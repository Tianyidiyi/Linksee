import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseLimitOffset } from "../infra/request-utils.js";
import { parseBigIntParam, serializeBigInt, validationFailed } from "../assignments/assignment-access.js";

export const notificationsRouter = Router();

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  content: true,
  scopeType: true,
  scopeId: true,
  courseId: true,
  assignmentId: true,
  groupId: true,
  miniTaskId: true,
  relatedEventId: true,
  payload: true,
  readAt: true,
  createdAt: true,
};

notificationsRouter.get("/notifications", requireAuth, async (req: Request, res: Response) => {
  const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>);
  const unreadOnly = req.query.unreadOnly === "1" || req.query.unreadOnly === "true";
  const where: Record<string, unknown> = {
    userId: req.user!.id,
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [items, total, unreadTotal] = await Promise.all([
    prisma.userNotification.findMany({
      where,
      orderBy: [{ createdAt: Prisma.SortOrder.desc }, { id: Prisma.SortOrder.desc }],
      take: limit,
      skip: offset,
      select: notificationSelect,
    }),
    prisma.userNotification.count({ where }),
    prisma.userNotification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);

  res.json({
    ok: true,
    data: serializeBigInt(items),
    paging: { limit, offset, total, hasMore: offset + items.length < total },
    unreadTotal,
  });
});

notificationsRouter.post("/notifications/:notificationId/read", requireAuth, async (req: Request, res: Response) => {
  const notificationId = parseBigIntParam(req.params.notificationId, "notificationId", res);
  if (notificationId === null) return;
  const existing = await prisma.userNotification.findFirst({
    where: { id: notificationId, userId: req.user!.id },
    select: notificationSelect,
  });
  if (!existing) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Notification not found" });
  }
  if (existing.readAt) {
    return res.json({ ok: true, data: serializeBigInt(existing) });
  }
  const updated = await prisma.userNotification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
    select: notificationSelect,
  });
  res.json({ ok: true, data: serializeBigInt(updated) });
});

notificationsRouter.post("/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
  const scopeType = typeof req.body?.scopeType === "string" ? req.body.scopeType.trim() : "";
  const rawScopeId = req.body?.scopeId;
  let scopeId: bigint | null = null;
  if (rawScopeId !== undefined && rawScopeId !== null && rawScopeId !== "") {
    if (!scopeType) {
      return validationFailed(res, "scopeType is required when scopeId is provided");
    }
    if (typeof rawScopeId !== "string" || !/^\d+$/.test(rawScopeId)) {
      return validationFailed(res, "scopeId must be a numeric string");
    }
    scopeId = BigInt(rawScopeId);
  }
  const where: Record<string, unknown> = {
    userId: req.user!.id,
    readAt: null,
    ...(scopeType ? { scopeType } : {}),
    ...(scopeId !== null ? { scopeId } : {}),
  };
  const result = await prisma.userNotification.updateMany({ where, data: { readAt: new Date() } });
  res.json({ ok: true, data: { count: result.count } });
});
