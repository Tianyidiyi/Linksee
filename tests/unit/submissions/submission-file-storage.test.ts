import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { minioClient } from "../../../apps/api/src/infra/minio.js";
import {
  parseSubmissionFileUpload,
  removeSubmissionFileObject,
  uploadSubmissionFile,
} from "../../../apps/api/src/submissions/submission-file-storage.js";

describe("submissions/submission-file-storage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("parseSubmissionFileUpload should no-op for non-multipart", async () => {
    const req: any = { is: () => false };
    const res: any = {};
    const next = jest.fn();
    parseSubmissionFileUpload(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("parseSubmissionFileUpload should accept multipart without files", async () => {
    const app = express();
    app.post("/upload", parseSubmissionFileUpload, (req, res) => {
      res.json({ ok: true, files: Array.isArray(req.files) ? req.files.length : 0 });
    });

    const res = await request(app).post("/upload").field("note", "x");
    expect(res.status).toBe(200);
    expect(res.body.files).toBe(0);
  });

  it("parseSubmissionFileUpload should reject unsupported file type", async () => {
    const app = express();
    app.post("/upload", parseSubmissionFileUpload, (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post("/upload")
      .attach("files", Buffer.from("x"), { filename: "x.exe", contentType: "application/x-msdownload" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("parseSubmissionFileUpload should accept supported file type", async () => {
    const app = express();
    app.post("/upload", parseSubmissionFileUpload, (req, res) => {
      res.json({ ok: true, files: Array.isArray(req.files) ? req.files.length : 0 });
    });

    const res = await request(app)
      .post("/upload")
      .attach("files", Buffer.from("ok"), { filename: "demo.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.files).toBe(1);
  });

  it("uploadSubmissionFile should put object and return metadata", async () => {
    const putSpy = jest.spyOn(minioClient, "putObject").mockResolvedValue(undefined as any);
    const result = await uploadSubmissionFile({
      courseId: 1n,
      assignmentId: 2n,
      stageId: 3n,
      groupId: 4n,
      file: {
        originalname: "demo file.pdf",
        buffer: Buffer.from("x"),
        size: 1,
        mimetype: "application/pdf",
      } as any,
    });
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(result.objectKey).toContain("submissions/courses/1/assignments/2/stages/3/groups/4/");
  });

  it("uploadSubmissionFile should fallback to safe default file name", async () => {
    jest.spyOn(minioClient, "putObject").mockResolvedValue(undefined as any);
    const result = await uploadSubmissionFile({
      courseId: 1n,
      assignmentId: 2n,
      stageId: 3n,
      groupId: 4n,
      file: {
        originalname: "",
        buffer: Buffer.from("x"),
        size: 1,
        mimetype: "application/pdf",
      } as any,
    });
    expect(result.objectKey).toContain("-file");
  });

  it("removeSubmissionFileObject should swallow remove failures", async () => {
    jest.spyOn(minioClient, "removeObject").mockRejectedValue(new Error("boom"));
    await expect(removeSubmissionFileObject("k1")).resolves.toBeUndefined();
  });
});
