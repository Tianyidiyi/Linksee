import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { submissionsRouter } from "../../../apps/api/src/submissions/submissions-router.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";
import * as chatHelpers from "../../../apps/api/src/collaboration/chat-helpers.js";
import * as submissionFileStorage from "../../../apps/api/src/submissions/submission-file-storage.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", submissionsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("submissions-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should validate stage id", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/stages/abc/groups/1/submissions")
      .set("authorization", authHeader("s1", "student"))
      .send({ title: "demo" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should reject non-student role", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/stages/1/groups/1/submissions")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ title: "demo" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should create a submission and publish side effects", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 1n,
      assignmentId: 31n,
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({ id: 101n } as any);
    jest.spyOn(prisma.assignmentStage, "findUnique").mockResolvedValue({
      id: 11n,
      assignmentId: 31n,
      stageNo: 2,
      title: "需求文档提交",
      status: "open",
      dueAt: new Date(Date.now() + 60_000),
      assignment: { status: "active", courseId: 41n },
    } as any);
    jest.spyOn(prisma.submission, "findFirst").mockResolvedValue(null);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      submission: {
        create: async () => ({
          id: 501n,
          groupId: 1n,
          stageId: 11n,
          status: "submitted",
          submittedBy: "s1",
          submittedAt: new Date(),
        }),
      },
      submissionFile: {
        createMany: async () => ({ count: 0 }),
      },
    }));
    jest.spyOn(chatHelpers, "ensureGroupConversation").mockResolvedValue();
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(801n);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({ id: 901n } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/stages/11/groups/1/submissions")
      .set("authorization", authHeader("s1", "student"))
      .send({ title: "第一次提交", description: "提交需求文档" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("submitted");
    expect(res.body.data.attemptNo).toBe(1);
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should reject student who is not current group leader", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 1n,
      assignmentId: 31n,
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/stages/11/groups/1/submissions")
      .set("authorization", authHeader("s1", "student"))
      .send({ title: "第一次提交" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(res.body.message).toContain("Only group leader");
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should reject student outside the course", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockImplementation(async (_groupId, _userId, _role, res) => {
      res.status(403).json({ ok: false, code: "FORBIDDEN", message: "User is not an active course member" });
      return null;
    });
    const leaderSpy = jest.spyOn(prisma.groupMember, "findFirst");
    const createSpy = jest.spyOn(prisma.submission, "create");

    const res = await request(app)
      .post("/api/v1/stages/11/groups/1/submissions")
      .set("authorization", authHeader("outsider", "student"))
      .send({ title: "Unauthorized submission" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(res.body.message).toContain("active course member");
    expect(leaderSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should reject when stage dueAt has passed", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 1n,
      assignmentId: 31n,
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({ id: 101n } as any);
    jest.spyOn(prisma.assignmentStage, "findUnique").mockResolvedValue({
      id: 11n,
      assignmentId: 31n,
      stageNo: 2,
      title: "需求文档提交",
      status: "open",
      dueAt: new Date(Date.now() - 60_000),
      assignment: { status: "active", courseId: 41n },
    } as any);

    const res = await request(app)
      .post("/api/v1/stages/11/groups/1/submissions")
      .set("authorization", authHeader("s1", "student"))
      .send({ title: "截止后提交" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("submission is closed");
  });

  it("GET /stages/:stageId/groups/:groupId/submissions should return latest submissions with file metadata", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 1n,
      assignmentId: 31n,
    } as any);
    jest.spyOn(prisma.assignmentStage, "findUnique").mockResolvedValue({
      id: 11n,
      assignmentId: 31n,
      status: "open",
      assignment: { status: "active" },
    } as any);
    jest.spyOn(prisma.submission, "findMany").mockResolvedValue([
      {
        id: 501n,
        groupId: 1n,
        stageId: 11n,
        attemptNo: 2,
        status: "submitted",
        summary: "第二次提交",
        payload: { title: "第二次提交", fileIds: ["file-1"] },
        submittedAt: new Date("2026-06-19T10:00:00Z"),
        createdBy: "s1",
        submittedBy: "s1",
        createdAt: new Date("2026-06-19T10:00:00Z"),
        updatedAt: new Date("2026-06-19T10:00:00Z"),
        files: [
          {
            id: 701n,
            name: "需求说明书.docx",
            size: 80500,
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            uploadedAt: new Date("2026-06-19T10:00:00Z"),
          },
        ],
      },
    ] as any);

    const res = await request(app)
      .get("/api/v1/stages/11/groups/1/submissions")
      .set("authorization", authHeader("s1", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].attemptNo).toBe(2);
    expect(res.body.data[0].payload.title).toBe("第二次提交");
    expect(res.body.data[0].files).toHaveLength(1);
    expect(res.body.data[0].files[0].name).toBe("需求说明书.docx");
    expect(res.body.data[0].files[0].downloadPath).toBe("/api/v1/submission-files/701/download-url");
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should replace previous submission files on resubmission", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 1n,
      assignmentId: 31n,
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({ id: 101n } as any);
    jest.spyOn(prisma.assignmentStage, "findUnique").mockResolvedValue({
      id: 11n,
      assignmentId: 31n,
      stageNo: 2,
      title: "需求文档提交",
      status: "open",
      dueAt: new Date(Date.now() + 60_000),
      assignment: { status: "active", courseId: 41n },
    } as any);
    jest.spyOn(prisma.submission, "findFirst").mockResolvedValue({
      id: 401n,
      attemptNo: 1,
      status: "needs_changes",
      createdAt: new Date(),
      submittedAt: new Date(),
      submittedBy: "s1",
      createdBy: "s1",
      groupId: 1n,
      stageId: 11n,
    } as any);
    jest.spyOn(prisma.submissionFile, "findMany").mockResolvedValue([
      { objectKey: "old/file-1.docx" },
      { objectKey: "old/file-2.pdf" },
    ] as any);
    jest.spyOn(submissionFileStorage, "uploadSubmissionFile").mockResolvedValue({
      objectKey: "new/file-3.docx",
      name: "新需求说明书.docx",
      size: 1024n,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      uploadedAt: new Date().toISOString(),
    } as any);
    const removeSpy = jest.spyOn(submissionFileStorage, "removeSubmissionFileObject").mockResolvedValue();
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      submissionFile: {
        deleteMany: async () => ({ count: 2 }),
        createMany: async () => ({ count: 1 }),
      },
      submission: {
        create: async () => ({
          id: 501n,
          groupId: 1n,
          stageId: 11n,
          status: "submitted",
          submittedBy: "s1",
          submittedAt: new Date(),
        }),
      },
    }));
    jest.spyOn(chatHelpers, "ensureGroupConversation").mockResolvedValue();
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(801n);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({ id: 901n } as any);
    jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/stages/11/groups/1/submissions")
      .set("authorization", authHeader("s1", "student"))
      .field("title", "第二次提交")
      .attach("files", Buffer.from("docx-bytes"), "新需求说明书.docx");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.attemptNo).toBe(2);
    expect(res.body.data.replacedSubmissionId).toBe("401");
    expect(removeSpy).toHaveBeenCalledTimes(2);
    expect(removeSpy).toHaveBeenCalledWith("old/file-1.docx");
    expect(removeSpy).toHaveBeenCalledWith("old/file-2.pdf");
  });
});

