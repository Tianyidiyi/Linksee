import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { minioClient } from "../../../apps/api/src/infra/minio.js";
import {
  normalizeStoredFiles,
  parseCourseMaterialUpload,
  removeCourseMaterialObject,
  uploadCourseMaterialFile,
  withCourseMaterialUrls,
} from "../../../apps/api/src/assignments/course-material-storage.js";

describe("assignments/course-material-storage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("normalizeStoredFiles should filter invalid records", () => {
    const rows = normalizeStoredFiles([
      {
        name: "a.pdf",
        objectKey: "k1",
        size: 1,
        mimeType: "application/pdf",
        uploadedAt: "2026-05-13T00:00:00.000Z",
      },
      { bad: true },
    ] as any);
    expect(rows).toHaveLength(1);
    expect(rows[0].objectKey).toBe("k1");
  });

  it("normalizeStoredFiles should ignore non-object/array items", () => {
    const rows = normalizeStoredFiles([null, [], 1, "x"] as any);
    expect(rows).toEqual([]);
  });

  it("normalizeStoredFiles should return empty for non-array input", () => {
    expect(normalizeStoredFiles(null)).toEqual([]);
    expect(normalizeStoredFiles({} as any)).toEqual([]);
  });

  it("withCourseMaterialUrls should add url field", () => {
    const rows = withCourseMaterialUrls([
      {
        name: "a.pdf",
        objectKey: "k1",
        size: 1,
        mimeType: "application/pdf",
        uploadedAt: "2026-05-13T00:00:00.000Z",
      },
    ]);
    expect(rows[0].url).toContain("k1");
  });

  it("parseCourseMaterialUpload should reject non-multipart", () => {
    const req: any = { is: () => false };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    parseCourseMaterialUpload(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("parseCourseMaterialUpload should pass multipart without files to next handler", async () => {
    const app = express();
    app.post("/upload", parseCourseMaterialUpload, (req, res) => {
      res.json({ ok: true, files: Array.isArray(req.files) ? req.files.length : 0 });
    });

    const res = await request(app).post("/upload").field("note", "x");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.files).toBe(0);
  });

  it("parseCourseMaterialUpload should reject unsupported mimetype", async () => {
    const app = express();
    app.post("/upload", parseCourseMaterialUpload, (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post("/upload")
      .attach("files", Buffer.from("x"), { filename: "x.exe", contentType: "application/x-msdownload" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("parseCourseMaterialUpload should accept supported mimetype", async () => {
    const app = express();
    app.post("/upload", parseCourseMaterialUpload, (req, res) => {
      res.json({ ok: true, files: Array.isArray(req.files) ? req.files.length : 0 });
    });

    const res = await request(app)
      .post("/upload")
      .attach("files", Buffer.from("ok"), { filename: "ok.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.files).toBe(1);
  });

  it("uploadCourseMaterialFile should put object and return metadata", async () => {
    const putSpy = jest.spyOn(minioClient, "putObject").mockResolvedValue(undefined as any);
    const result = await uploadCourseMaterialFile({
      courseId: 1n,
      assignmentId: 2n,
      file: {
        originalname: "demo file.pdf",
        buffer: Buffer.from("x"),
        size: 1,
        mimetype: "application/pdf",
      } as any,
    });
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(result.name).toBe("demo file.pdf");
    expect(result.objectKey).toContain("courses/1/assignments/2/");
  });

  it("uploadCourseMaterialFile should include stage path and sanitize empty name fallback", async () => {
    jest.spyOn(minioClient, "putObject").mockResolvedValue(undefined as any);
    const result = await uploadCourseMaterialFile({
      courseId: 1n,
      assignmentId: 2n,
      stageId: 3n,
      file: {
        originalname: "",
        buffer: Buffer.from("x"),
        size: 1,
        mimetype: "application/pdf",
      } as any,
    });
    expect(result.objectKey).toContain("courses/1/assignments/2/stages/3/");
    expect(result.objectKey).toContain("-file");
  });

  it("removeCourseMaterialObject should swallow remove failures", async () => {
    jest.spyOn(minioClient, "removeObject").mockRejectedValue(new Error("boom"));
    await expect(removeCourseMaterialObject("k1")).resolves.toBeUndefined();
  });
});
