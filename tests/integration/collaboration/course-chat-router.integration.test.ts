import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { courseChatRouter } from "../../../apps/api/src/collaboration/course-chat-router.js";
import { groupChatRouter } from "../../../apps/api/src/collaboration/group-chat-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";
import * as chatHelpers from "../../../apps/api/src/collaboration/chat-helpers.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", courseChatRouter);
  app.use("/api/v1", groupChatRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("course-chat-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/courses/:courseId/messages should create a text message and emit realtime event", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ status: "active" } as any);
    jest.spyOn(chatHelpers, "ensureCourseConversation").mockResolvedValue();
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(101n);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({
      id: 201n,
      conversationId: 101n,
      senderId: "t1",
      content: "课程通知已更新",
      files: null,
      filesMeta: [],
      mentions: [],
      replyToId: null,
      eventId: "evt-1",
      traceId: "trace-1",
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/courses/1/messages")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ type: "text", content: "课程通知已更新" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("201");
    expect(res.body.data.content).toBe("课程通知已更新");
    expect(res.body.data.messageType).toBe("text");
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("DELETE /api/v1/courses/:courseId/messages/:messageId should soft delete message", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ status: "active" } as any);
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(101n);
    jest.spyOn(prisma.chatMessage, "findFirst").mockResolvedValue({
      senderId: "t1",
      deletedAt: null,
    } as any);
    jest.spyOn(prisma.chatMessage, "update").mockResolvedValue({
      id: 201n,
      conversationId: 101n,
      senderId: "t1",
      content: null,
      files: null,
      filesMeta: [],
      mentions: [],
      replyToId: null,
      eventId: "evt-1",
      traceId: "trace-1",
      createdAt: new Date(),
      editedAt: null,
      deletedAt: new Date(),
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .delete("/api/v1/courses/1/messages/201")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("201");
    expect(res.body.data.deletedAt).toBeDefined();
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("GET /api/v1/courses/:courseId/messages/search should return matched messages", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ status: "active" } as any);
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(101n);
    jest.spyOn(prisma.chatMessage, "findMany").mockResolvedValue([
      {
        id: 202n,
        conversationId: 101n,
        senderId: "t1",
        content: "课程通知已更新，请查看原型要求",
        files: null,
        filesMeta: [],
        mentions: [],
        replyToId: null,
        eventId: "evt-search",
        traceId: "trace-search",
        createdAt: new Date(),
        editedAt: null,
        deletedAt: null,
      },
    ] as any);

    const res = await request(app)
      .get("/api/v1/courses/1/messages/search?q=%E5%8E%9F%E5%9E%8B")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("202");
    expect(res.body.data[0].content).toContain("原型");
  });

  it("PATCH /api/v1/courses/:courseId/messages/:messageId should edit text message and emit realtime event", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ status: "active" } as any);
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(101n);
    jest.spyOn(prisma.chatMessage, "findFirst").mockResolvedValue({
      senderId: "t1",
      files: null,
      deletedAt: null,
    } as any);
    jest.spyOn(prisma.chatMessage, "update").mockResolvedValue({
      id: 203n,
      conversationId: 101n,
      senderId: "t1",
      content: "课程通知已更新，请查看最新原型要求",
      files: null,
      filesMeta: [],
      mentions: [],
      replyToId: null,
      eventId: "evt-update",
      traceId: "trace-update",
      createdAt: new Date(),
      editedAt: new Date(),
      deletedAt: null,
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/courses/1/messages/203")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ content: "课程通知已更新，请查看最新原型要求", mentions: [] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("203");
    expect(res.body.data.content).toContain("最新原型要求");
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

});

describe("group-chat-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/groups/:groupId/messages should create a group text message and emit realtime event", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(chatHelpers, "ensureGroupConversation").mockResolvedValue();
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(102n);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({
      id: 301n,
      conversationId: 102n,
      senderId: "2026010041",
      content: "我们今晚合并原型交互",
      files: null,
      filesMeta: [],
      mentions: [],
      replyToId: null,
      eventId: "evt-2",
      traceId: "trace-2",
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/groups/8/messages")
      .set("authorization", authHeader("2026010041", "student"))
      .send({ type: "text", content: "我们今晚合并原型交互" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("301");
    expect(res.body.data.messageType).toBe("text");
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("POST /api/v1/groups/:groupId/announcements should reject student role", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/groups/8/announcements")
      .set("authorization", authHeader("2026010041", "student"))
      .send({ content: "请尽快提交阶段成果" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("GET /api/v1/groups/:groupId/messages/search should return matched group messages", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(102n);
    jest.spyOn(prisma.chatMessage, "findMany").mockResolvedValue([
      {
        id: 302n,
        conversationId: 102n,
        senderId: "2026010041",
        content: "原型交互已完成第一版，请组内检查",
        files: null,
        filesMeta: [],
        mentions: [],
        replyToId: null,
        eventId: "evt-group-search",
        traceId: "trace-group-search",
        createdAt: new Date(),
        editedAt: null,
        deletedAt: null,
      },
    ] as any);

    const res = await request(app)
      .get("/api/v1/groups/8/messages/search?q=%E5%8E%9F%E5%9E%8B")
      .set("authorization", authHeader("2026010041", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("302");
    expect(res.body.data[0].content).toContain("原型交互");
  });

  it("PATCH /api/v1/groups/:groupId/messages/:messageId should edit group text message and emit realtime event", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(102n);
    jest.spyOn(prisma.chatMessage, "findFirst").mockResolvedValue({
      senderId: "2026010041",
      files: null,
      deletedAt: null,
    } as any);
    jest.spyOn(prisma.chatMessage, "update").mockResolvedValue({
      id: 303n,
      conversationId: 102n,
      senderId: "2026010041",
      content: "原型交互已更新第二版，请大家再次检查",
      files: null,
      filesMeta: [],
      mentions: [],
      replyToId: null,
      eventId: "evt-group-update",
      traceId: "trace-group-update",
      createdAt: new Date(),
      editedAt: new Date(),
      deletedAt: null,
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/groups/8/messages/303")
      .set("authorization", authHeader("2026010041", "student"))
      .send({ content: "原型交互已更新第二版，请大家再次检查", mentions: [] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("303");
    expect(res.body.data.content).toContain("第二版");
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("DELETE /api/v1/groups/:groupId/messages/:messageId should hide deleted message from later search", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(102n);
    jest.spyOn(prisma.chatMessage, "findFirst").mockResolvedValue({
      senderId: "2026010041",
      deletedAt: null,
    } as any);
    jest.spyOn(prisma.chatMessage, "update").mockResolvedValue({
      id: 304n,
      conversationId: 102n,
      senderId: "2026010041",
      content: null,
      files: null,
      filesMeta: [],
      mentions: [],
      replyToId: null,
      eventId: "evt-group-delete",
      traceId: "trace-group-delete",
      createdAt: new Date(),
      editedAt: null,
      deletedAt: new Date(),
    } as any);
    const findManySpy = jest.spyOn(prisma.chatMessage, "findMany").mockResolvedValue([]);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const deleteRes = await request(app)
      .delete("/api/v1/groups/8/messages/304")
      .set("authorization", authHeader("2026010041", "student"));

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);
    expect(deleteRes.body.data.id).toBe("304");
    expect(deleteRes.body.data.deletedAt).toBeDefined();
    expect(pushSpy).toHaveBeenCalledTimes(1);

    const searchRes = await request(app)
      .get("/api/v1/groups/8/messages/search?q=prototype")
      .set("authorization", authHeader("2026010041", "student"));

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.ok).toBe(true);
    expect(searchRes.body.data).toEqual([]);
    expect(findManySpy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conversationId: 102n,
        deletedAt: null,
        content: expect.objectContaining({ contains: "prototype" }),
      }),
    }));
  });
});
