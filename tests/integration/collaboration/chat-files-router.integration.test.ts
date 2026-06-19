import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { chatFilesRouter } from "../../../apps/api/src/collaboration/chat-files-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";
import * as chatStorage from "../../../apps/api/src/collaboration/chat-file-storage.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", chatFilesRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("chat-files-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/chat/files/presign-upload should create upload url for course scope", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(chatStorage, "presignChatUpload").mockResolvedValue("https://upload.example.com/file");

    const res = await request(app)
      .post("/api/v1/chat/files/presign-upload")
      .set("authorization", authHeader("t1", "teacher"))
      .send({
        scopeType: "course",
        scopeId: "1",
        fileName: "需求说明书.pdf",
        mimeType: "application/pdf",
        size: 4096,
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.uploadUrl).toBe("https://upload.example.com/file");
    expect(res.body.data.objectKey).toContain("chat/course/1/");
  });

  it("GET /api/v1/chat/files/presign-download should return download url for group scope", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(chatStorage, "presignChatDownload").mockResolvedValue("https://download.example.com/file");

    const res = await request(app)
      .get("/api/v1/chat/files/presign-download")
      .set("authorization", authHeader("2026010041", "student"))
      .query({ objectKey: "chat/group/8/abc-file.pdf" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.downloadUrl).toBe("https://download.example.com/file");
    expect(res.body.data.objectKey).toBe("chat/group/8/abc-file.pdf");
  });
});
