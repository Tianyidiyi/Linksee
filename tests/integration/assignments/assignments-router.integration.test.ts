import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { assignmentsRouter } from "../../../apps/api/src/assignments/assignments-router.js";
import * as assignmentAccess from "../../../apps/api/src/assignments/assignment-access.js";

const AssignmentStatus = {
  draft: "draft",
  active: "active",
  archived: "archived",
} as const;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", assignmentsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("assignments-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /courses/:courseId/assignments should block creating active assignment before any stage exists", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getCourseWriteAccess").mockResolvedValue(true);
    const createSpy = jest.spyOn(prisma.assignment, "create");

    const res = await request(app)
      .post("/api/v1/courses/1/assignments")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ title: "Project Alpha", status: "active" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("at least one stage");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("PATCH /assignments/:assignmentId should block activating assignment without stages", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getAssignmentWriteAccess").mockResolvedValue({
      id: 1n,
      courseId: 10n,
      title: "Project Alpha",
      description: null,
      descriptionFiles: [],
      status: AssignmentStatus.draft,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.assignmentStage, "count").mockResolvedValue(0);
    const updateSpy = jest.spyOn(prisma.assignment, "update");

    const res = await request(app)
      .patch("/api/v1/assignments/1")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "active" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("at least one stage");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("PATCH /assignments/:assignmentId should block archiving while planned or open stages exist", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getAssignmentWriteAccess").mockResolvedValue({
      id: 2n,
      courseId: 10n,
      title: "Project Beta",
      description: null,
      descriptionFiles: [],
      status: AssignmentStatus.active,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.assignmentStage, "count").mockResolvedValue(2);
    const updateSpy = jest.spyOn(prisma.assignment, "update");

    const res = await request(app)
      .patch("/api/v1/assignments/2")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "archived" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("planned/open stages");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("PATCH /assignments/:assignmentId should allow activating assignment when at least one stage exists", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getAssignmentWriteAccess").mockResolvedValue({
      id: 3n,
      courseId: 10n,
      title: "Project Gamma",
      description: "draft",
      descriptionFiles: [],
      status: AssignmentStatus.draft,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.assignmentStage, "count").mockResolvedValue(1);
    jest.spyOn(prisma.assignment, "update").mockResolvedValue({
      id: 3n,
      courseId: 10n,
      title: "Project Gamma",
      description: "draft",
      descriptionFiles: [],
      status: AssignmentStatus.active,
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const res = await request(app)
      .patch("/api/v1/assignments/3")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "active" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("active");
  });
});
