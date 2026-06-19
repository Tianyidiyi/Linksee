import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { courseMembersRouter } from "../../../apps/api/src/courses/course-members-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/courses", courseMembersRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("course-members-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("GET /api/v1/courses/:id/members should validate course id", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/courses/abc/members")
      .set("authorization", authHeader("s1", "student"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /api/v1/courses/:id/members/batch should reject non-academic", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/courses/1/members/batch")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ userIds: ["2023010001"] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/courses/:id/members should add a single active student", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseExists").mockResolvedValue(true);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ status: "draft" } as any);
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "2026010041",
      role: "student",
      isActive: true,
    } as any);
    jest.spyOn(prisma.courseMember, "upsert").mockResolvedValue({
      id: 51n,
      courseId: 1n,
      userId: "2026010041",
      status: "active",
      joinedAt: new Date(),
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/courses/1/members")
      .set("authorization", authHeader("a1", "academic"))
      .send({ userId: "2026010041" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.userId).toBe("2026010041");
    expect(res.body.data.courseId).toBe("1");
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });
});

