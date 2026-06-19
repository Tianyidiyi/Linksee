import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { coursesRouter } from "../../../apps/api/src/courses/courses-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/courses", coursesRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("courses-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/courses should reject non-academic role", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/courses")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ courseNo: "CS101", name: "SE", academicYear: 2026, semester: 1 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("GET /api/v1/courses should reject invalid status filter", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/courses?status=bad")
      .set("authorization", authHeader("a1", "academic"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /api/v1/courses should create a draft course for academic role", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue(null);
    jest.spyOn(prisma.course, "create").mockResolvedValue({
      id: 101n,
      courseNo: "SE-2026-01",
      name: "软件工程综合实践",
      academicYear: 2026,
      semester: 1,
      status: "draft",
      createdAt: new Date(),
    } as any);

    const res = await request(app)
      .post("/api/v1/courses")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        courseNo: "SE-2026-01",
        name: "软件工程综合实践",
        academicYear: 2026,
        semester: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("101");
    expect(res.body.data.courseNo).toBe("SE-2026-01");
    expect(res.body.data.status).toBe("draft");
  });

  it("POST /api/v1/courses/:id/assistants should bind assistant for current teacher", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({
      id: 1n,
      status: "draft",
    } as any);
    jest.spyOn(courseAccess, "getCourseTeacherRecord").mockResolvedValue({
      courseId: 1n,
      userId: "t1",
      role: "lead",
    } as any);
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "2026011001",
      role: "assistant",
      isActive: true,
    } as any);
    jest.spyOn(prisma.teacherAssistant, "findUnique").mockResolvedValue({
      assistantUserId: "2026011001",
      teacherUserId: "t1",
    } as any);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      assistantBinding: {
        findUnique: async () => null,
        count: async () => 1,
        upsert: async () => ({
          assistantUserId: "2026011001",
          teacherUserId: "t1",
          courseId: 1n,
          createdAt: new Date(),
          assistant: {
            id: "2026011001",
            profile: {
              realName: "助教甲",
              avatarUrl: null,
              accountNo: "2026011001",
            },
          },
        }),
      },
    }));

    const res = await request(app)
      .post("/api/v1/courses/1/assistants")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ assistantUserId: "2026011001" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.assistantUserId).toBe("2026011001");
    expect(res.body.data.teacherUserId).toBe("t1");
    expect(res.body.data.courseId).toBe("1");
  });

  it("POST /api/v1/courses/:id/assistants should reject when assistant limit is reached", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({
      id: 1n,
      status: "draft",
    } as any);
    jest.spyOn(courseAccess, "getCourseTeacherRecord").mockResolvedValue({
      courseId: 1n,
      userId: "t1",
      role: "lead",
    } as any);
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "2026011001",
      role: "assistant",
      isActive: true,
    } as any);
    jest.spyOn(prisma.teacherAssistant, "findUnique").mockResolvedValue({
      assistantUserId: "2026011001",
      teacherUserId: "t1",
    } as any);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
      const tx = {
        assistantBinding: {
          findUnique: async () => null,
          count: async () => 3,
          upsert: async () => ({}),
        },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post("/api/v1/courses/1/assistants")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ assistantUserId: "2026011001" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("at most 3 assistants");
  });

  it("PATCH /api/v1/courses/:id/teachers/:userId should update teacher role for academic", async () => {
    const app = createApp();
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({
      id: 1n,
      status: "draft",
    } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({
      courseId: 1n,
      userId: "t2",
    } as any);
    jest.spyOn(courseAccess, "getCourseTeacherRecord").mockResolvedValue(null as any);
    jest.spyOn(prisma.courseTeacher, "findFirst").mockResolvedValue(null);
    jest.spyOn(prisma.courseTeacher, "update").mockResolvedValue({
      courseId: 1n,
      userId: "t2",
      role: "co",
      assignedAt: new Date(),
    } as any);

    const res = await request(app)
      .patch("/api/v1/courses/1/teachers/t2")
      .set("authorization", authHeader("a1", "academic"))
      .send({ role: "co" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.userId).toBe("t2");
    expect(res.body.data.role).toBe("co");
  });
});

