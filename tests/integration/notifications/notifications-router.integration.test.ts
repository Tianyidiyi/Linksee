import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { notificationsRouter } from "../../../apps/api/src/notifications/notifications-router.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", notificationsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("notifications-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    (prisma as any).userNotification = {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
  });

  it("GET /api/v1/notifications should return current user notifications and unread count", async () => {
    const app = createApp();
    (prisma as any).userNotification.findMany.mockResolvedValue([
      {
        id: 1n,
        userId: "2026010001",
        type: "reminder_1h",
        title: "任务截止前 1 小时提醒",
        content: "请尽快处理",
        scopeType: "group",
        scopeId: 8n,
        courseId: 1n,
        assignmentId: 2n,
        groupId: 8n,
        miniTaskId: 9n,
        relatedEventId: "evt-1",
        payload: null,
        readAt: null,
        createdAt: new Date("2026-06-19T10:00:00.000Z"),
      },
    ]);
    (prisma as any).userNotification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const res = await request(app)
      .get("/api/v1/notifications")
      .set("authorization", authHeader("2026010001", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("1");
    expect(res.body.unreadTotal).toBe(1);
    expect((prisma as any).userNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "2026010001" },
    }));
  });

  it("POST /api/v1/notifications/:id/read should mark owned notification as read", async () => {
    const app = createApp();
    (prisma as any).userNotification.findFirst.mockResolvedValue({
      id: 1n,
      userId: "2026010001",
      type: "reminder_1h",
      title: "任务截止前 1 小时提醒",
      content: "请尽快处理",
      readAt: null,
      createdAt: new Date(),
    });
    (prisma as any).userNotification.update.mockResolvedValue({
      id: 1n,
      userId: "2026010001",
      type: "reminder_1h",
      title: "任务截止前 1 小时提醒",
      content: "请尽快处理",
      readAt: new Date(),
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/v1/notifications/1/read")
      .set("authorization", authHeader("2026010001", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect((prisma as any).userNotification.update).toHaveBeenCalledTimes(1);
  });

  it("POST /api/v1/notifications/:id/read should be idempotent for already-read notification", async () => {
    const app = createApp();
    const readAt = new Date("2026-06-19T10:10:00.000Z");
    (prisma as any).userNotification.findFirst.mockResolvedValue({
      id: 1n,
      userId: "2026010001",
      type: "reminder_1h",
      title: "任务截止前 1 小时提醒",
      content: "请尽快处理",
      readAt,
      createdAt: new Date("2026-06-19T10:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/v1/notifications/1/read")
      .set("authorization", authHeader("2026010001", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.readAt).toBe(readAt.toISOString());
    expect((prisma as any).userNotification.update).not.toHaveBeenCalled();
  });
});
