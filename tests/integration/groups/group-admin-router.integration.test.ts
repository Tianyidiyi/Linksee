import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { groupAdminRouter } from "../../../apps/api/src/groups/group-admin-router.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";
import * as groupLifecycle from "../../../apps/api/src/groups/group-lifecycle.js";
import * as chatHelpers from "../../../apps/api/src/collaboration/chat-helpers.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", groupAdminRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("group-admin-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("DELETE /api/v1/groups/:groupId should block deleting a non-empty group", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureGroupManageable").mockResolvedValue({
      id: 1n,
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      status: "forming",
      _count: { members: 2 },
    } as any);
    const updateSpy = jest.spyOn(prisma.group, "update");

    const res = await request(app)
      .delete("/api/v1/groups/1")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("Group must be empty");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("PATCH /api/v1/groups/:groupId/status should reject invalid active -> forming transition", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureGroupManageable").mockResolvedValue({
      id: 2n,
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 2n,
      assignmentId: 11n,
      groupNo: 2,
      name: "Team 2",
      status: "active",
      createdBy: "t1",
      assignment: { courseId: 21n },
    } as any);
    const updateSpy = jest.spyOn(prisma.group, "update");

    const res = await request(app)
      .patch("/api/v1/groups/2/status")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "forming" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("Invalid group status transition");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("PATCH /api/v1/groups/:groupId/status should activate group and sync lifecycle", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureGroupManageable").mockResolvedValue({
      id: 3n,
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 3n,
      assignmentId: 12n,
      groupNo: 3,
      name: "Team 3",
      status: "forming",
      createdBy: "t1",
      assignment: { courseId: 22n },
    } as any);
    jest.spyOn(prisma.group, "update").mockResolvedValue({
      id: 3n,
      assignmentId: 12n,
      groupNo: 3,
      status: "active",
      updatedAt: new Date(),
    } as any);
    const lifecycleSpy = jest.spyOn(groupLifecycle, "syncSingleGroupLifecycle").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/groups/3/status")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "active" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("active");
    expect(lifecycleSpy).toHaveBeenCalledTimes(1);
  });

  it("PATCH /api/v1/groups/:groupId/status should create conversation and first system message when confirming group", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureGroupManageable").mockResolvedValue({
      id: 5n,
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 5n,
      assignmentId: 15n,
      groupNo: 5,
      name: "交互体验组",
      status: "forming",
      createdBy: "t1",
      assignment: { courseId: 25n },
    } as any);
    jest.spyOn(prisma.group, "update").mockResolvedValue({
      id: 5n,
      assignmentId: 15n,
      groupNo: 5,
      status: "active",
      updatedAt: new Date(),
    } as any);
    const upsertSpy = jest.spyOn(prisma.chatConversation, "upsert").mockResolvedValue({
      id: 501n,
      roomKey: "group:5",
    } as any);
    jest.spyOn(prisma.chatConversation, "findUnique").mockResolvedValue({
      id: 501n,
      roomKey: "group:5",
    } as any);
    const messageSpy = jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({
      id: 601n,
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/groups/5/status")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "active" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("active");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(messageSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("POST /api/v1/assignments/:assignmentId/groups/conversations should create conversations for all groups", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureAssignmentManageable").mockResolvedValue({
      id: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(prisma.group, "findMany").mockResolvedValue([
      { id: 31n, createdBy: "t1" },
      { id: 32n, createdBy: null },
    ] as any);
    const ensureConversationSpy = jest.spyOn(chatHelpers, "ensureGroupConversation").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/assignments/12/groups/conversations")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.processedCount).toBe(2);
    expect(ensureConversationSpy).toHaveBeenCalledTimes(2);
  });

  it("DELETE /api/v1/groups/:groupId should archive an empty group and related conversation", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureGroupManageable").mockResolvedValue({
      id: 4n,
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 4n,
      status: "forming",
      _count: { members: 0 },
    } as any);
    const groupUpdateSpy = jest.spyOn(prisma.group, "update").mockResolvedValue({
      id: 4n,
      status: "archived",
    } as any);
    const archiveConversationSpy = jest.spyOn(prisma.chatConversation, "updateMany").mockResolvedValue({ count: 1 } as any);

    const res = await request(app)
      .delete("/api/v1/groups/4")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("archived");
    expect(groupUpdateSpy).toHaveBeenCalledTimes(1);
    expect(archiveConversationSpy).toHaveBeenCalledTimes(1);
  });
});
