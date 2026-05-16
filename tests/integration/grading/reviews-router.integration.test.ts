import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { reviewsRouter } from "../../../apps/api/src/grading/reviews-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", reviewsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("reviews-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /submissions/:id/reviews/start should reject student", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/submissions/1/reviews/start")
      .set("authorization", authHeader("s1", "student"));
    expect(res.status).toBe(403);
  });

  it("POST /submissions/:id/reviews/start should set under_review and publish events", async () => {
    const app = createApp();
    jest.spyOn(prisma.submission, "findUnique").mockResolvedValue({
      id: 1n,
      status: "submitted",
      groupId: 10n,
      stageId: 20n,
      stage: { assignment: { courseId: 30n } },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);
    const updateSpy = jest.spyOn(prisma.submission, "update").mockResolvedValue({ id: 1n } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/submissions/1/reviews/start")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledTimes(2);
    expect(res.body.data.status).toBe("under_review");
  });

  it("POST /submissions/:id/reviews should validate decision status", async () => {
    const app = createApp();
    jest.spyOn(prisma.submission, "findUnique").mockResolvedValue({
      id: 1n,
      status: "submitted",
      stageId: 20n,
      groupId: 10n,
      stage: { assignment: { courseId: 30n } },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);

    const res = await request(app)
      .post("/api/v1/submissions/1/reviews")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "bad-status", comment: "ok" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /submissions/:id/reviews/start should reject invalid status transition", async () => {
    const app = createApp();
    jest.spyOn(prisma.submission, "findUnique").mockResolvedValue({
      id: 1n,
      status: "needs_changes",
      groupId: 10n,
      stageId: 20n,
      stage: { assignment: { courseId: 30n } },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);

    const res = await request(app)
      .post("/api/v1/submissions/1/reviews/start")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("GET /courses/:id/pending-reviews should validate non-empty reviewerId", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);

    const res = await request(app)
      .get("/api/v1/courses/30/pending-reviews?reviewerId=   ")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("PATCH /reviews/:id should reject non-author reviewer", async () => {
    const app = createApp();
    jest.spyOn(prisma.review, "findUnique").mockResolvedValue({
      id: 1n,
      submissionId: 2n,
      reviewerId: "other-user",
      decision: "approved",
      status: "submitted",
      submission: {
        id: 2n,
        status: "under_review",
        groupId: 10n,
        stageId: 20n,
        stage: { assignment: { courseId: 30n } },
      },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);

    const res = await request(app)
      .patch("/api/v1/reviews/1")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "approved", comment: "ok" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("PATCH /reviews/:id should reject invalid submission status transition", async () => {
    const app = createApp();
    jest.spyOn(prisma.review, "findUnique").mockResolvedValue({
      id: 1n,
      submissionId: 2n,
      reviewerId: "t1",
      decision: "needs_changes",
      status: "submitted",
      submission: {
        id: 2n,
        status: "needs_changes",
        groupId: 10n,
        stageId: 20n,
        stage: { assignment: { courseId: 30n } },
      },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);

    const res = await request(app)
      .patch("/api/v1/reviews/1")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "approved", comment: "ok" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("POST /submissions/:id/mark-reviewed should reject invalid status transition", async () => {
    const app = createApp();
    jest.spyOn(prisma.submission, "findUnique").mockResolvedValue({
      id: 1n,
      status: "submitted",
      groupId: 10n,
      stageId: 20n,
      stage: { assignment: { courseId: 30n } },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);

    const res = await request(app)
      .post("/api/v1/submissions/1/mark-reviewed")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("GET /courses/:id/reviews/export should validate reviewerId", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);

    const res = await request(app)
      .get("/api/v1/courses/30/reviews/export?reviewerId=   ")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("GET /courses/:id/reviews/export should validate stageId", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 30n } as any);

    const res = await request(app)
      .get("/api/v1/courses/30/reviews/export?stageId=bad")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });
});
