import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { conversationsRouter } from "../../../apps/api/src/collaboration/conversations-router.js";
import * as userScope from "../../../apps/api/src/infra/user-scope.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", conversationsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("conversations-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("GET /api/v1/conversations should aggregate course and group conversations", async () => {
    const app = createApp();
    jest.spyOn(userScope, "resolveUserScopes").mockResolvedValue({
      courseIds: [1n],
      groupIds: [8n],
    } as any);
    jest.spyOn(prisma.chatConversation, "findMany").mockResolvedValue([
      { id: 101n, scopeType: "course", scopeId: 1n, roomKey: "course:1" },
      { id: 102n, scopeType: "group", scopeId: 8n, roomKey: "group:8" },
    ] as any);
    jest.spyOn(prisma.chatMessage, "findMany")
      .mockResolvedValueOnce([
        {
          id: 201n,
          conversationId: 101n,
          senderId: "t1",
          content: "课程通知",
          files: null,
          mentions: [],
          replyToId: null,
          createdAt: new Date(),
          editedAt: null,
          deletedAt: null,
        },
        {
          id: 202n,
          conversationId: 102n,
          senderId: "2026010041",
          content: "小组同步",
          files: null,
          mentions: [],
          replyToId: null,
          createdAt: new Date(),
          editedAt: null,
          deletedAt: null,
        },
      ] as any)
      .mockResolvedValueOnce([] as any);
    jest.spyOn(prisma.chatConversationRead, "findMany").mockResolvedValue([] as any);
    jest.spyOn(prisma.course, "findMany").mockResolvedValue([
      { id: 1n, name: "软件工程综合实践" },
    ] as any);
    jest.spyOn(prisma.group, "findMany").mockResolvedValue([
      { id: 8n, groupNo: 3, name: "原型实现组", assignmentId: 12n, assignment: { courseId: 1n } },
    ] as any);
    jest.spyOn(prisma.chatMessage, "count").mockResolvedValue(0);

    const res = await request(app)
      .get("/api/v1/conversations")
      .set("authorization", authHeader("2026010041", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].scopeType).toBe("course");
    expect(res.body.data[1].scopeType).toBe("group");
  });

  it("POST /api/v1/conversations/:conversationId/read should upsert read state", async () => {
    const app = createApp();
    jest.spyOn(prisma.chatConversation, "findUnique").mockResolvedValue({
      scopeType: "course",
      scopeId: 1n,
    } as any);
    jest.spyOn(userScope, "resolveUserScopes").mockResolvedValue({
      courseIds: [1n],
      groupIds: [],
    } as any);
    jest.spyOn(prisma.chatMessage, "findFirst").mockResolvedValue({ id: 201n } as any);
    const upsertSpy = jest.spyOn(prisma.chatConversationRead, "upsert").mockResolvedValue({
      conversationId: 101n,
      userId: "2026010041",
    } as any);

    const res = await request(app)
      .post("/api/v1/conversations/101/read")
      .set("authorization", authHeader("2026010041", "student"))
      .send({ messageId: "201" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});
