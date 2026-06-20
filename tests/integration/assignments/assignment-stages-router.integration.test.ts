import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { assignmentStagesRouter } from "../../../apps/api/src/assignments/assignment-stages-router.js";
import * as assignmentAccess from "../../../apps/api/src/assignments/assignment-access.js";
import * as assignmentNotifications from "../../../apps/api/src/assignments/assignment-notifications.js";
import * as materialStorage from "../../../apps/api/src/assignments/course-material-storage.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", assignmentStagesRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("assignment-stages-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /assignments/:assignmentId/stages should create an open stage and publish notification", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getAssignmentWriteAccess").mockResolvedValue({
      id: 11n,
      courseId: 21n,
      title: "项目一",
      status: "active",
    } as any);
    jest.spyOn(prisma.assignmentStage, "aggregate").mockResolvedValue({
      _max: { stageNo: 2 },
    } as any);
    jest.spyOn(prisma.assignmentStage, "create").mockResolvedValue({
      id: 31n,
      assignmentId: 11n,
      stageNo: 3,
      title: "原型评审",
      description: null,
      startAt: null,
      dueAt: new Date(Date.now() + 3600_000),
      weight: null,
      submissionDesc: null,
      requirementFiles: [],
      acceptCriteria: "按时提交",
      status: "open",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    const announcementSpy = jest.spyOn(assignmentNotifications, "publishCourseSystemAnnouncement").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/assignments/11/stages")
      .set("authorization", authHeader("t1", "teacher"))
      .send({
        title: "原型评审",
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
        status: "open",
        acceptCriteria: "按时提交",
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("open");
    expect(res.body.data.stageNo).toBe(3);
    expect(announcementSpy).toHaveBeenCalledTimes(1);
  });

  it("PATCH /stages/:stageId should open a stage and publish notification", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getStageWriteAccess").mockResolvedValue({
      id: 41n,
      assignmentId: 11n,
      stageNo: 2,
      title: "阶段二",
      description: null,
      startAt: null,
      dueAt: new Date(Date.now() + 7200_000),
      weight: null,
      submissionDesc: null,
      requirementFiles: [],
      acceptCriteria: null,
      status: "planned",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 21n },
    } as any);
    jest.spyOn(prisma.assignmentStage, "update").mockResolvedValue({
      id: 41n,
      assignmentId: 11n,
      stageNo: 2,
      title: "阶段二",
      description: null,
      startAt: null,
      dueAt: new Date(Date.now() + 7200_000),
      weight: null,
      submissionDesc: null,
      requirementFiles: [],
      acceptCriteria: null,
      status: "open",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    const announcementSpy = jest.spyOn(assignmentNotifications, "publishCourseSystemAnnouncement").mockResolvedValue();

    const res = await request(app)
      .patch("/api/v1/stages/41")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "open" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("open");
    expect(announcementSpy).toHaveBeenCalledTimes(1);
  });

  it("PATCH /stages/:stageId should reject closed to planned transition", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getStageWriteAccess").mockResolvedValue({
      id: 42n,
      assignmentId: 11n,
      stageNo: 2,
      title: "Closed stage",
      description: null,
      startAt: null,
      dueAt: new Date(Date.now() + 7200_000),
      weight: null,
      submissionDesc: null,
      requirementFiles: [],
      acceptCriteria: null,
      status: "closed",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 21n },
    } as any);
    const updateSpy = jest.spyOn(prisma.assignmentStage, "update");

    const res = await request(app)
      .patch("/api/v1/stages/42")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ status: "planned" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toContain("Invalid stage status transition");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("DELETE /stages/:stageId should archive a stage successfully", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getStageWriteAccess").mockResolvedValue({
      id: 51n,
      status: "closed",
    } as any);
    const updateSpy = jest.spyOn(prisma.assignmentStage, "update").mockResolvedValue({
      id: 51n,
      status: "archived",
    } as any);

    const res = await request(app)
      .delete("/api/v1/stages/51")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it("DELETE /stages/:stageId/materials should remove existing stage material", async () => {
    const app = createApp();
    jest.spyOn(assignmentAccess, "getStageWriteAccess").mockResolvedValue({
      id: 61n,
      assignmentId: 11n,
      assignment: { courseId: 21n },
      requirementFiles: [
        {
          objectKey: "course/21/assignment/11/stage/61/checklist.pdf",
          name: "checklist.pdf",
          size: 2048,
          mimeType: "application/pdf",
          uploadedAt: new Date().toISOString(),
        },
      ],
      status: "planned",
    } as any);
    const updateSpy = jest.spyOn(prisma.assignmentStage, "update").mockResolvedValue({
      id: 61n,
      requirementFiles: [],
    } as any);
    const removeSpy = jest.spyOn(materialStorage, "removeCourseMaterialObject").mockResolvedValue();

    const res = await request(app)
      .delete("/api/v1/stages/61/materials")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ objectKey: "course/21/assignment/11/stage/61/checklist.pdf" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith("course/21/assignment/11/stage/61/checklist.pdf");
  });
});
