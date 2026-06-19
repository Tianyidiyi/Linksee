import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { gradesRouter } from "../../../apps/api/src/grading/grades-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";

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

  it("GET /courses/:courseId/grades should validate status filter", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);

    const res = await request(app)
      .get("/api/v1/courses/1/grades?status=bad")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("GET /courses/:courseId/grades should return paged filtered grade list", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 10n } as any);
    jest.spyOn(prisma, "$transaction").mockResolvedValue([
      [
        {
          id: 5n,
          submissionId: 40n,
          groupId: 20n,
          stageId: 30n,
          courseId: 10n,
          score: "91",
          status: "published",
          graderId: "t1",
          publishedBy: "t1",
          publishedAt: new Date(),
          sourceReviewId: 9n,
          createdAt: new Date(),
          updatedAt: new Date(),
          submission: { status: "approved", attemptNo: 1, submittedAt: new Date() },
          group: { name: "交互体验组", groupNo: 1 },
          stage: { title: "阶段一", stageNo: 1, dueAt: new Date() },
        },
      ],
      1,
    ] as any);

    const res = await request(app)
      .get("/api/v1/courses/10/grades?status=published&stageId=30&groupId=20&limit=10&offset=0")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("5");
    expect(res.body.data[0].status).toBe("published");
    expect(res.body.paging.total).toBe(1);
  });

  it("GET /stages/:stageId/groups/:groupId/grade should return final grade for teacher", async () => {
    const app = createApp();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      assignment: { courseId: 10n },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 10n } as any);
    jest.spyOn(prisma.stageGrade, "findFirst").mockResolvedValue({
      id: 5n,
      submissionId: 40n,
      groupId: 20n,
      stageId: 30n,
      courseId: 10n,
      score: "91",
      status: "published",
      graderId: "t1",
      publishedBy: "t1",
      publishedAt: new Date(),
      sourceReviewId: 9n,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const res = await request(app)
      .get("/api/v1/stages/30/groups/20/grade")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("5");
    expect(res.body.data.status).toBe("published");
    expect(res.body.data.score).toBe("91");
  });

  it("GET /courses/:courseId/grade-drafts should reject student role", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/courses/1/grade-drafts")
      .set("authorization", authHeader("s1", "student"));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("GET /courses/:courseId/grade-drafts should return paged draft list", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 10n } as any);
    jest.spyOn(prisma, "$transaction").mockResolvedValue([
      [
        {
          id: 6n,
          submissionId: 41n,
          groupId: 21n,
          stageId: 31n,
          courseId: 10n,
          score: "88",
          status: "draft",
          graderId: "t1",
          sourceReviewId: 10n,
          createdAt: new Date(),
          updatedAt: new Date(),
          submission: { status: "approved", attemptNo: 2, submittedAt: new Date() },
          group: { name: "原型实现组", groupNo: 2 },
          stage: { title: "阶段二", stageNo: 2, dueAt: new Date() },
        },
      ],
      1,
    ] as any);

    const res = await request(app)
      .get("/api/v1/courses/10/grade-drafts?stageId=31&groupId=21&limit=10&offset=0")
      .set("authorization", authHeader("a1", "assistant"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe("draft");
    expect(res.body.paging.total).toBe(1);
  });

  it("POST /submissions/:id/grade-drafts should create a draft grade for approved submission", async () => {
    const app = createApp();
    jest.spyOn(prisma.submission, "findUnique").mockResolvedValue({
      id: 1n,
      status: "approved",
      groupId: 20n,
      stageId: 30n,
      stage: { assignment: { courseId: 10n } },
      reviews: [{ id: 99n }],
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 10n } as any);
    jest.spyOn(prisma.stageGrade, "findUnique").mockResolvedValue(null);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      stageGrade: {
        upsert: async () => ({
          id: 5n,
          submissionId: 1n,
          groupId: 20n,
          stageId: 30n,
          courseId: 10n,
          score: "95",
          status: "draft",
          graderId: "t1",
          publishedBy: null,
          publishedAt: null,
          sourceReviewId: 99n,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      stageGradeLog: {
        create: async () => ({ id: 1n }),
      },
    }));

    const res = await request(app)
      .post("/api/v1/submissions/1/grade-drafts")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ score: 95 });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.submissionId).toBe("1");
    expect(res.body.data.status).toBe("draft");
    expect(res.body.data.score).toBe("95");
    expect(res.body.data.graderId).toBe("t1");
  });

  it("POST /grades/:id/publish should publish a draft grade and emit realtime events", async () => {
    const app = createApp();
    jest.spyOn(prisma.stageGrade, "findUnique").mockResolvedValue({
      id: 5n,
      score: "91",
      status: "draft",
      courseId: 10n,
      groupId: 20n,
      stageId: 30n,
      submissionId: 40n,
      submission: { status: "approved" },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 10n } as any);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      stageGrade: {
        update: async () => ({
          id: 5n,
          submissionId: 40n,
          groupId: 20n,
          stageId: 30n,
          courseId: 10n,
          score: "91",
          status: "published",
          graderId: "t1",
          publishedBy: "t1",
          publishedAt: new Date(),
          sourceReviewId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      stageGradeLog: {
        create: async () => ({ id: 1n }),
      },
    }));
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/grades/5/publish")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("published");
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it("PATCH /grades/:id should adjust a published grade and emit realtime events", async () => {
    const app = createApp();
    jest.spyOn(prisma.stageGrade, "findUnique").mockResolvedValue({
      id: 5n,
      score: "91",
      status: "published",
      courseId: 10n,
      groupId: 20n,
      stageId: 30n,
      submissionId: 40n,
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 10n } as any);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      stageGrade: {
        update: async () => ({
          id: 5n,
          submissionId: 40n,
          groupId: 20n,
          stageId: 30n,
          courseId: 10n,
          score: "93",
          status: "published",
          graderId: "t1",
          publishedBy: "t1",
          publishedAt: new Date(),
          sourceReviewId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      stageGradeLog: {
        create: async () => ({ id: 2n }),
      },
    }));
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/grades/5")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ score: 93, reason: "教师复核后调整分数" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("5");
    expect(res.body.data.score).toBe("93");
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

});
