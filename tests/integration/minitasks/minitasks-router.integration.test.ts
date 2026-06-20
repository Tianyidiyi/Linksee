import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { minitasksRouter } from "../../../apps/api/src/minitasks/minitasks-router.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";
import * as chatHelpers from "../../../apps/api/src/collaboration/chat-helpers.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", minitasksRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("minitasks-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/groups/:groupId/minitasks should create a minitask and publish side effects", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({ id: 81n } as any);
    jest.spyOn(prisma.groupMember, "findMany").mockResolvedValue([
      { userId: "2026010041" },
      { userId: "2026010042" },
    ] as any);
    jest.spyOn(prisma.miniTask, "create").mockResolvedValue({
      id: 301n,
      groupId: 8n,
      stageId: null,
      title: "完善原型交互",
      description: "完成关键页面跳转与状态提示",
      assigneeId: "2026010042",
      assigneeIds: ["2026010041", "2026010042"],
      priority: "high",
      status: "todo",
      dueAt: null,
      createdBy: "2026010041",
      createdAt: new Date(),
      updatedAt: new Date(),
      reminder1dSentAt: null,
      reminder1hSentAt: null,
      overdueSentAt: null,
    } as any);
    jest.spyOn(chatHelpers, "ensureGroupConversation").mockResolvedValue();
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(901n);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({ id: 801n } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/groups/8/minitasks")
      .set("authorization", authHeader("2026010041", "student"))
      .send({
        title: "完善原型交互",
        description: "完成关键页面跳转与状态提示",
        assigneeIds: ["2026010041", "2026010042"],
        priority: "high",
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("301");
    expect(res.body.data.title).toBe("完善原型交互");
    expect(res.body.data.status).toBe("todo");
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it("PATCH /api/v1/minitasks/:taskId/status should allow assignee to update task status", async () => {
    const app = createApp();
    jest.spyOn(prisma.miniTask, "findUnique").mockResolvedValue({
      id: 301n,
      groupId: 8n,
      stageId: null,
      title: "完善原型交互",
      description: null,
      assigneeId: "2026010042",
      assigneeIds: ["2026010041", "2026010042"],
      priority: "high",
      status: "todo",
      dueAt: null,
      createdBy: "2026010041",
      createdAt: new Date(),
      updatedAt: new Date(),
      reminder1dSentAt: null,
      reminder1hSentAt: null,
      overdueSentAt: null,
      group: {
        assignmentId: 12n,
        assignment: { courseId: 22n },
      },
    } as any);
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue(null);
    jest.spyOn(prisma.miniTask, "update").mockResolvedValue({
      id: 301n,
      groupId: 8n,
      stageId: null,
      title: "完善原型交互",
      description: null,
      assigneeId: "2026010042",
      assigneeIds: ["2026010041", "2026010042"],
      priority: "high",
      status: "in_progress",
      dueAt: null,
      createdBy: "2026010041",
      createdAt: new Date(),
      updatedAt: new Date(),
      reminder1dSentAt: null,
      reminder1hSentAt: null,
      overdueSentAt: null,
    } as any);
    jest.spyOn(chatHelpers, "ensureGroupConversation").mockResolvedValue();
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(901n);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({ id: 802n } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/minitasks/301/status")
      .set("authorization", authHeader("2026010042", "student"))
      .send({ status: "in_progress" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("301");
    expect(res.body.data.status).toBe("in_progress");
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it("GET /api/v1/groups/:groupId/minitasks should return filtered paged tasks", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(prisma, "$transaction").mockResolvedValue([
      [
        {
          id: 401n,
          groupId: 8n,
          stageId: 31n,
          title: "Finalize API contract",
          description: "Review payload fields",
          assigneeId: "2026010042",
          assigneeIds: ["2026010042"],
          priority: "medium",
          status: "todo",
          dueAt: null,
          createdBy: "2026010041",
          createdAt: new Date(),
          updatedAt: new Date(),
          reminder1dSentAt: null,
          reminder1hSentAt: null,
          overdueSentAt: null,
        },
      ],
      3,
    ] as any);

    const res = await request(app)
      .get("/api/v1/groups/8/minitasks?stageId=31&assigneeId=2026010042&status=todo&limit=1&offset=1")
      .set("authorization", authHeader("2026010042", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("401");
    expect(res.body.data[0].stageId).toBe("31");
    expect(res.body.paging).toEqual({ limit: 1, offset: 1, total: 3, hasMore: true });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.objectContaining({}),
      expect.objectContaining({}),
    ]);
  });

  it("PATCH /api/v1/minitasks/:taskId should allow leader to edit task fields and publish side effects", async () => {
    const app = createApp();
    const originalDueAt = new Date("2026-07-01T00:00:00.000Z");
    const nextDueAt = new Date("2026-07-05T00:00:00.000Z");
    jest.spyOn(prisma.miniTask, "findUnique").mockResolvedValue({
      id: 301n,
      groupId: 8n,
      stageId: null,
      title: "Draft plan",
      description: "Initial plan",
      assigneeId: "2026010042",
      assigneeIds: ["2026010042"],
      priority: "medium",
      status: "todo",
      dueAt: originalDueAt,
      createdBy: "2026010041",
      createdAt: new Date(),
      updatedAt: new Date(),
      reminder1dSentAt: new Date(),
      reminder1hSentAt: new Date(),
      overdueSentAt: null,
      group: {
        assignmentId: 12n,
        assignment: { courseId: 22n },
      },
    } as any);
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({ id: 81n } as any);
    const updateSpy = jest.spyOn(prisma.miniTask, "update").mockResolvedValue({
      id: 301n,
      groupId: 8n,
      stageId: null,
      title: "Finalize plan",
      description: "Add acceptance checklist",
      assigneeId: "2026010042",
      assigneeIds: ["2026010042"],
      priority: "high",
      status: "todo",
      dueAt: nextDueAt,
      createdBy: "2026010041",
      createdAt: new Date(),
      updatedAt: new Date(),
      reminder1dSentAt: null,
      reminder1hSentAt: null,
      overdueSentAt: null,
    } as any);
    jest.spyOn(chatHelpers, "ensureGroupConversation").mockResolvedValue();
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(901n);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({ id: 803n } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/minitasks/301")
      .set("authorization", authHeader("2026010041", "student"))
      .send({
        title: "Finalize plan",
        description: "Add acceptance checklist",
        priority: "high",
        dueAt: nextDueAt.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.title).toBe("Finalize plan");
    expect(res.body.data.priority).toBe("high");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: "Finalize plan",
        description: "Add acceptance checklist",
        priority: "high",
        reminder1dSentAt: null,
        reminder1hSentAt: null,
      }),
    }));
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it("PATCH /api/v1/minitasks/:taskId/status should reject cancelling by non-leader assignee", async () => {
    const app = createApp();
    jest.spyOn(prisma.miniTask, "findUnique").mockResolvedValue({
      id: 301n,
      groupId: 8n,
      stageId: null,
      title: "Finalize plan",
      description: null,
      assigneeId: "2026010042",
      assigneeIds: ["2026010042"],
      priority: "high",
      status: "todo",
      dueAt: null,
      createdBy: "2026010041",
      createdAt: new Date(),
      updatedAt: new Date(),
      reminder1dSentAt: null,
      reminder1hSentAt: null,
      overdueSentAt: null,
      group: {
        assignmentId: 12n,
        assignment: { courseId: 22n },
      },
    } as any);
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue(null);
    const updateSpy = jest.spyOn(prisma.miniTask, "update");

    const res = await request(app)
      .patch("/api/v1/minitasks/301/status")
      .set("authorization", authHeader("2026010042", "student"))
      .send({ status: "cancelled" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
