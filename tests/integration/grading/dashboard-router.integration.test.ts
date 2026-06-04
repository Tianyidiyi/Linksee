import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { dashboardRouter } from "../../../apps/api/src/grading/dashboard-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", dashboardRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("dashboard-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("GET /students/dashboard should reject non-student role", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/students/dashboard")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("GET /students/dashboard should return empty payload when student has no active courses", async () => {
    const app = createApp();
    jest.spyOn(prisma.courseMember, "findMany").mockResolvedValue([]);

    const res = await request(app)
      .get("/api/v1/students/dashboard")
      .set("authorization", authHeader("s1", "student"));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ courses: [], todoRows: [], gradeRows: [] });
  });

  it("GET /students/dashboard should return empty todo and grade rows when courses exist but no assignments are visible", async () => {
    const app = createApp();
    jest.spyOn(prisma.courseMember, "findMany").mockResolvedValue([{ courseId: 1n }] as any);
    jest.spyOn(prisma, "$transaction").mockResolvedValueOnce([
      [
        {
          id: 1n,
          courseNo: "CS101",
          name: "Software Engineering",
          academicYear: 2026,
          semester: 1,
          status: "active",
          description: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      [],
    ] as any);

    const res = await request(app)
      .get("/api/v1/students/dashboard")
      .set("authorization", authHeader("s1", "student"));

    expect(res.status).toBe(200);
    expect(res.body.data.courses).toHaveLength(1);
    expect(res.body.data.todoRows).toEqual([]);
    expect(res.body.data.gradeRows).toEqual([]);
  });

  it("GET /students/dashboard should return empty todo and grade rows when assignments exist but student has no group or stage context", async () => {
    const app = createApp();
    jest.spyOn(prisma.courseMember, "findMany").mockResolvedValue([{ courseId: 1n }] as any);
    jest.spyOn(prisma, "$transaction")
      .mockResolvedValueOnce([
        [
          {
            id: 1n,
            courseNo: "CS101",
            name: "Software Engineering",
            academicYear: 2026,
            semester: 1,
            status: "active",
            description: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        [
          {
            id: 10n,
            courseId: 1n,
            title: "Course Project",
            description: null,
            status: "active",
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
            updatedAt: new Date("2026-01-03T00:00:00.000Z"),
          },
        ],
      ] as any)
      .mockResolvedValueOnce([[], []] as any);

    const res = await request(app)
      .get("/api/v1/students/dashboard")
      .set("authorization", authHeader("s1", "student"));

    expect(res.status).toBe(200);
    expect(res.body.data.todoRows).toEqual([]);
    expect(res.body.data.gradeRows).toEqual([]);
  });

  it("GET /students/dashboard should aggregate course, stage, submission and grade summaries", async () => {
    const app = createApp();
    jest.spyOn(prisma.courseMember, "findMany").mockResolvedValue([{ courseId: 1n }] as any);
    jest.spyOn(prisma, "$transaction")
      .mockResolvedValueOnce([
        [
          {
            id: 1n,
            courseNo: "CS101",
            name: "Software Engineering",
            academicYear: 2026,
            semester: 1,
            status: "active",
            description: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        [
          {
            id: 10n,
            courseId: 1n,
            title: "Course Project",
            description: null,
            status: "active",
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
            updatedAt: new Date("2026-01-03T00:00:00.000Z"),
          },
        ],
      ] as any)
      .mockResolvedValueOnce([
        [
          {
            assignmentId: 10n,
            role: "leader",
            joinedAt: new Date("2026-01-04T00:00:00.000Z"),
            group: {
              id: 100n,
              groupNo: 2,
              name: "Team Two",
              status: "active",
              _count: { members: 3 },
            },
          },
        ],
        [
          {
            id: 1000n,
            assignmentId: 10n,
            stageNo: 1,
            title: "Milestone 1",
            dueAt: new Date("2026-06-30T00:00:00.000Z"),
            status: "open",
          },
        ],
      ] as any)
      .mockResolvedValueOnce([
        [
          {
            id: 5000n,
            groupId: 100n,
            stageId: 1000n,
            status: "submitted",
            attemptNo: 2,
            submittedAt: new Date("2026-06-01T00:00:00.000Z"),
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
          },
        ],
        [
          {
            id: 7000n,
            groupId: 100n,
            stageId: 1000n,
            score: "95",
            status: "published",
            publishedAt: new Date("2026-06-02T00:00:00.000Z"),
            createdAt: new Date("2026-06-02T00:00:00.000Z"),
            updatedAt: new Date("2026-06-02T00:00:00.000Z"),
          },
        ],
      ] as any);

    const res = await request(app)
      .get("/api/v1/students/dashboard")
      .set("authorization", authHeader("s1", "student"));

    expect(res.status).toBe(200);
    expect(res.body.data.courses).toHaveLength(1);
    expect(res.body.data.todoRows).toHaveLength(1);
    expect(res.body.data.gradeRows).toHaveLength(1);
    expect(res.body.data.todoRows[0].course.name).toBe("Software Engineering");
    expect(res.body.data.todoRows[0].assignment.title).toBe("Course Project");
    expect(res.body.data.todoRows[0].group.myRole).toBe("leader");
    expect(res.body.data.todoRows[0].submission.attemptNo).toBe(2);
    expect(res.body.data.gradeRows[0].grade.status).toBe("published");
  });

  it("GET /courses/:courseId/dashboard should reject student role", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/courses/1/dashboard")
      .set("authorization", authHeader("s1", "student"));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("GET /courses/:courseId/dashboard should compute staff group progress summary", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([
      { id: 11n, dueAt: new Date("2026-06-01T00:00:00.000Z") },
      { id: 12n, dueAt: new Date("2026-06-02T00:00:00.000Z") },
    ] as any);
    jest.spyOn(prisma.group, "findMany").mockResolvedValue([
      { id: 21n, name: "G1", groupNo: 1, updatedAt: new Date() },
    ] as any);
    jest.spyOn(prisma.submission, "findMany").mockResolvedValue([
      { groupId: 21n, stageId: 11n, status: "approved", attemptNo: 1 },
      { groupId: 21n, stageId: 12n, status: "submitted", attemptNo: 1 },
    ] as any);

    const res = await request(app)
      .get("/api/v1/courses/1/dashboard")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.data.groups).toHaveLength(1);
    expect(res.body.data.groups[0].progress).toBe(50);
    expect(res.body.data.groups[0].pendingReviewCount).toBe(1);
    expect(res.body.data.groups[0].overdueCount).toBe(1);
  });

  it("GET /courses/:courseId/pipeline-health should reject student role", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/courses/1/pipeline-health")
      .set("authorization", authHeader("s1", "student"));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("GET /courses/:courseId/pipeline-health should aggregate stage pipeline counters", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([
      { id: 31n, stageNo: 1, title: "Stage 1", dueAt: new Date("2026-06-01T00:00:00.000Z") },
    ] as any);
    jest.spyOn(prisma, "$transaction").mockResolvedValue([
      [
        { stageId: 31n, status: "submitted", _count: { _all: 2 } },
        { stageId: 31n, status: "needs_changes", _count: { _all: 1 } },
        { stageId: 31n, status: "approved", _count: { _all: 3 } },
      ],
      [
        { stageId: 31n, status: "draft", _count: { _all: 2 } },
        { stageId: 31n, status: "published", _count: { _all: 1 } },
      ],
    ] as any);

    const res = await request(app)
      .get("/api/v1/courses/1/pipeline-health")
      .set("authorization", authHeader("a1", "assistant"));

    expect(res.status).toBe(200);
    expect(res.body.data.stages).toHaveLength(1);
    expect(res.body.data.stages[0].pendingReviewCount).toBe(2);
    expect(res.body.data.stages[0].needsChangesCount).toBe(1);
    expect(res.body.data.stages[0].approvedCount).toBe(3);
    expect(res.body.data.stages[0].gradeDraftCount).toBe(2);
    expect(res.body.data.stages[0].gradePublishedCount).toBe(1);
  });
});
