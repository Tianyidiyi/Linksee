import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { coursesRouter } from "../../../apps/api/src/courses/courses-router.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";
import * as groupLifecycle from "../../../apps/api/src/groups/group-lifecycle.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/courses", coursesRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("courses lifecycle integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("PATCH /api/v1/courses/:id should block activation when no teacher exists", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({
      id: 1n,
      name: "Software Engineering",
      status: "draft",
    } as any);
    jest.spyOn(prisma.courseTeacher, "count").mockResolvedValue(0);
    jest.spyOn(prisma.assistantBinding, "count").mockResolvedValue(1);
    const updateSpy = jest.spyOn(prisma.course, "update");

    const res = await request(app)
      .patch("/api/v1/courses/1")
      .set("authorization", authHeader("a1", "academic"))
      .send({ status: "active" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("at least one teacher");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("PATCH /api/v1/courses/:id should block activation when no assistant is bound", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({
      id: 1n,
      name: "Software Engineering",
      status: "draft",
    } as any);
    jest.spyOn(prisma.courseTeacher, "count").mockResolvedValue(1);
    jest.spyOn(prisma.assistantBinding, "count").mockResolvedValue(0);
    const updateSpy = jest.spyOn(prisma.course, "update");

    const res = await request(app)
      .patch("/api/v1/courses/1")
      .set("authorization", authHeader("a1", "academic"))
      .send({ status: "active" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("assistants assigned");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("DELETE /api/v1/courses/:id/assistants/:assistantUserId should reject non-teacher role", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({
      id: 1n,
      status: "draft",
    } as any);

    const res = await request(app)
      .delete("/api/v1/courses/1/assistants/2026010001")
      .set("authorization", authHeader("a1", "academic"));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("PATCH /api/v1/courses/:id should activate course and publish activation side effects", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({
      id: 1n,
      name: "Software Engineering",
      status: "draft",
    } as any);
    jest.spyOn(prisma.courseTeacher, "count").mockResolvedValue(1);
    jest.spyOn(prisma.assistantBinding, "count").mockResolvedValue(1);
    jest.spyOn(prisma.course, "update").mockResolvedValue({
      id: 1n,
      courseNo: "SE-2026-01",
      name: "Software Engineering",
      status: "active",
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.chatConversation, "findUnique").mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 11n,
      roomKey: "course:1",
    } as any);
    jest.spyOn(prisma.chatConversation, "upsert").mockResolvedValue({ id: 11n } as any);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({ id: 21n } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/courses/1")
      .set("authorization", authHeader("a1", "academic"))
      .send({ status: "active" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("active");
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it("PATCH /api/v1/courses/:id should archive course and archive related side effects", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({
      id: 2n,
      name: "Software Engineering",
      status: "active",
    } as any);
    jest.spyOn(prisma.course, "update").mockResolvedValue({
      id: 2n,
      courseNo: "SE-2026-01",
      name: "Software Engineering",
      status: "archived",
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.chatConversation, "upsert").mockResolvedValue({ id: 12n } as any);
    jest.spyOn(prisma.chatConversation, "findUnique").mockResolvedValue({
      id: 12n,
      roomKey: "course:2",
    } as any);
    const archiveConversationsSpy = jest.spyOn(prisma.chatConversation, "updateMany").mockResolvedValue({ count: 1 } as any);
    const archiveGroupsSpy = jest.spyOn(groupLifecycle, "archiveCourseGroups").mockResolvedValue(3);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({ id: 22n } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/courses/2")
      .set("authorization", authHeader("a1", "academic"))
      .send({ status: "archived" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("archived");
    expect(archiveConversationsSpy).toHaveBeenCalledTimes(1);
    expect(archiveGroupsSpy).toHaveBeenCalledWith(2n, "a1");
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });
});
