import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { gradesRouter } from "../../../apps/api/src/grading/grades-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", gradesRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("grades-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /submissions/:id/grade-drafts should reject student role", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/submissions/1/grade-drafts")
      .set("authorization", authHeader("s1", "student"))
      .send({ score: 90 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("POST /submissions/:id/grade-drafts should validate score range", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/submissions/1/grade-drafts")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ score: 120 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /grades/:id/publish should reject non-teacher role", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/grades/1/publish")
      .set("authorization", authHeader("a1", "assistant"));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("POST /grades/:id/publish should short-circuit when grade already published", async () => {
    const app = createApp();
    jest.spyOn(prisma.stageGrade, "findUnique").mockResolvedValue({
      id: 1n,
      score: "95",
      status: "published",
      courseId: 10n,
      groupId: 20n,
      stageId: 30n,
      submission: { status: "approved" },
    } as any);

    const res = await request(app)
      .post("/api/v1/grades/1/publish")
      .set("authorization", authHeader("t1", "teacher"));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("published");
  });

  it("POST /courses/:courseId/grades/publish-batch should validate gradeIds", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    const res = await request(app)
      .post("/api/v1/courses/1/grades/publish-batch")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ gradeIds: "bad" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /courses/:courseId/grades/publish-batch should block when strict and blocked rows exist", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.stageGrade, "findMany").mockResolvedValue([
      {
        id: 1n,
        score: "88",
        status: "draft",
        submissionId: 11n,
        groupId: 21n,
        stageId: 31n,
        courseId: 1n,
        submission: { status: "under_review" },
      },
    ] as any);

    const res = await request(app)
      .post("/api/v1/courses/1/grades/publish-batch")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ gradeIds: ["1"], strict: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("PATCH /grades/:id should validate reason length", async () => {
    const app = createApp();
    const tooLong = "x".repeat(501);
    const res = await request(app)
      .patch("/api/v1/grades/1")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ score: 90, reason: tooLong });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /courses/:courseId/grades/publish-batch should allow partial publish when strict=false", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.stageGrade, "findMany").mockResolvedValue([
      {
        id: 1n,
        score: "88",
        status: "draft",
        submissionId: 11n,
        groupId: 21n,
        stageId: 31n,
        courseId: 1n,
        submission: { status: "approved" },
      },
      {
        id: 2n,
        score: "66",
        status: "published",
        submissionId: 12n,
        groupId: 22n,
        stageId: 32n,
        courseId: 1n,
        submission: { status: "approved" },
      },
    ] as any);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (arg: any) => {
      if (typeof arg === "function") {
        return [
          {
            id: 1n,
            submissionId: 11n,
            groupId: 21n,
            stageId: 31n,
            courseId: 1n,
            score: "88",
            status: "published",
            graderId: "t1",
            publishedBy: "t1",
            publishedAt: new Date(),
            sourceReviewId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }
      return [];
    });
    jest.spyOn(prisma.stageGradeLog, "createMany").mockResolvedValue({ count: 1 } as any);

    const res = await request(app)
      .post("/api/v1/courses/1/grades/publish-batch")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ gradeIds: ["1", "1", "2"], strict: false });

    expect(res.status).toBe(200);
    expect(res.body.data.requestedCount).toBe(2); // deduplicated
    expect(res.body.data.publishedCount).toBe(1);
    expect(res.body.data.blockedCount).toBe(1);
  });

  it("GET /courses/:courseId/grades should validate status filter", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);

    const res = await request(app)
      .get("/api/v1/courses/1/grades?status=bad")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("GET /courses/:courseId/grade-drafts should reject student role", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/courses/1/grade-drafts")
      .set("authorization", authHeader("s1", "student"));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("GET /courses/:courseId/grades/export should validate status filter", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);

    const res = await request(app)
      .get("/api/v1/courses/1/grades/export?status=unknown")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });
});
