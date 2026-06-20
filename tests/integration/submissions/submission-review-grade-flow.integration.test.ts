import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { submissionsRouter } from "../../../apps/api/src/submissions/submissions-router.js";
import { reviewsRouter } from "../../../apps/api/src/grading/reviews-router.js";
import { gradesRouter } from "../../../apps/api/src/grading/grades-router.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";
import * as chatHelpers from "../../../apps/api/src/collaboration/chat-helpers.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", submissionsRouter);
  app.use("/api/v1", reviewsRouter);
  app.use("/api/v1", gradesRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("submission-review-grade-flow integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("should complete submit -> review -> grade draft -> publish -> final grade query", async () => {
    const app = createApp();
    const now = new Date("2026-06-19T10:00:00.000Z");
    let submissionStatus = "submitted";
    let gradeStatus = "draft";

    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 20n,
      assignmentId: 30n,
      courseId: 10n,
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 10n } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({ id: 2001n } as any);
    jest.spyOn(prisma.assignmentStage, "findUnique").mockResolvedValue({
      id: 40n,
      assignmentId: 30n,
      stageNo: 1,
      title: "Prototype delivery",
      status: "open",
      dueAt: new Date("2026-07-01T10:00:00.000Z"),
      assignment: { status: "active", courseId: 10n },
    } as any);
    jest.spyOn(prisma.submission, "findFirst").mockResolvedValue(null);
    jest.spyOn(prisma.submissionFile, "findMany").mockResolvedValue([]);
    jest.spyOn(chatHelpers, "ensureGroupConversation").mockResolvedValue();
    jest.spyOn(chatHelpers, "getConversationId").mockResolvedValue(901n);
    jest.spyOn(prisma.chatMessage, "create").mockResolvedValue({ id: 902n } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    jest.spyOn(prisma.submission, "findUnique").mockImplementation((async () => ({
      id: 501n,
      status: submissionStatus,
      groupId: 20n,
      stageId: 40n,
      stage: { assignment: { courseId: 10n } },
      reviews: submissionStatus === "approved" ? [{ id: 601n }] : [],
    }) as any) as any);
    jest.spyOn(prisma.submission, "update").mockImplementation((async ({ data }: any) => {
      if (data?.status) submissionStatus = data.status;
      return { id: 501n, status: submissionStatus } as any;
    }) as any);
    jest.spyOn(prisma.review, "findUnique").mockResolvedValue(null);
    jest.spyOn(prisma.stageGrade, "findUnique").mockImplementation((async (args: any) => {
      if (!args?.select?.submission) {
        return null;
      }
      if (gradeStatus === "published") {
        return {
          id: 701n,
          score: "92",
          status: "published",
          courseId: 10n,
          groupId: 20n,
          stageId: 40n,
          submissionId: 501n,
          submission: { status: submissionStatus },
        } as any;
      }
      return {
        id: 701n,
        score: "92",
        status: "draft",
        courseId: 10n,
        groupId: 20n,
        stageId: 40n,
        submissionId: 501n,
        submission: { status: submissionStatus },
      } as any;
    }) as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      assignment: { courseId: 10n },
    } as any);
    jest.spyOn(prisma.stageGrade, "findFirst").mockImplementation((async () => ({
      id: 701n,
      submissionId: 501n,
      groupId: 20n,
      stageId: 40n,
      courseId: 10n,
      score: "92",
      status: gradeStatus,
      graderId: "t1",
      publishedBy: gradeStatus === "published" ? "t1" : null,
      publishedAt: gradeStatus === "published" ? now : null,
      sourceReviewId: 601n,
      createdAt: now,
      updatedAt: now,
    }) as any) as any);

    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      submission: {
        create: async () => {
          submissionStatus = "submitted";
          return {
            id: 501n,
            groupId: 20n,
            stageId: 40n,
            status: submissionStatus,
            submittedBy: "s1",
            submittedAt: now,
          };
        },
        update: async ({ data }: any) => {
          if (data?.status) submissionStatus = data.status;
          return { id: 501n, status: submissionStatus };
        },
      },
      submissionFile: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 0 }),
      },
      review: {
        create: async () => {
          submissionStatus = "approved";
          return {
            id: 601n,
            submissionId: 501n,
            decision: "approved",
            score: "92",
            reviewerId: "a1",
            createdAt: now,
          };
        },
      },
      stageGrade: {
        upsert: async () => {
          gradeStatus = "draft";
          return {
            id: 701n,
            submissionId: 501n,
            groupId: 20n,
            stageId: 40n,
            courseId: 10n,
            score: "92",
            status: gradeStatus,
            graderId: "t1",
            publishedBy: null,
            publishedAt: null,
            sourceReviewId: 601n,
            createdAt: now,
            updatedAt: now,
          };
        },
        update: async () => {
          gradeStatus = "published";
          return {
            id: 701n,
            submissionId: 501n,
            groupId: 20n,
            stageId: 40n,
            courseId: 10n,
            score: "92",
            status: gradeStatus,
            graderId: "t1",
            publishedBy: "t1",
            publishedAt: now,
            sourceReviewId: 601n,
            createdAt: now,
            updatedAt: now,
          };
        },
      },
      stageGradeLog: {
        create: async () => ({ id: 801n }),
      },
    }));

    const submitRes = await request(app)
      .post("/api/v1/stages/40/groups/20/submissions")
      .set("authorization", authHeader("s1", "student"))
      .send({
        title: "Prototype package",
        description: "Submitted for acceptance flow",
      });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.ok).toBe(true);
    expect(submitRes.body.data.id).toBe("501");
    expect(submitRes.body.data.status).toBe("submitted");
    expect(submitRes.body.data.attemptNo).toBe(1);

    const startReviewRes = await request(app)
      .post("/api/v1/submissions/501/reviews/start")
      .set("authorization", authHeader("a1", "assistant"));

    expect(startReviewRes.status).toBe(200);
    expect(startReviewRes.body.ok).toBe(true);
    expect(startReviewRes.body.data.status).toBe("under_review");
    expect(submissionStatus).toBe("under_review");

    const reviewRes = await request(app)
      .post("/api/v1/submissions/501/reviews")
      .set("authorization", authHeader("a1", "assistant"))
      .send({
        status: "approved",
        comment: "Meets acceptance criteria",
        rubricScores: [{ item: "Completeness", score: 92, maxScore: 100 }],
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.ok).toBe(true);
    expect(reviewRes.body.data.id).toBe("601");
    expect(reviewRes.body.data.status).toBe("approved");
    expect(submissionStatus).toBe("approved");

    const draftRes = await request(app)
      .post("/api/v1/submissions/501/grade-drafts")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ score: 92 });

    expect(draftRes.status).toBe(201);
    expect(draftRes.body.ok).toBe(true);
    expect(draftRes.body.data.id).toBe("701");
    expect(draftRes.body.data.status).toBe("draft");
    expect(draftRes.body.data.sourceReviewId).toBe("601");

    const publishRes = await request(app)
      .post("/api/v1/grades/701/publish")
      .set("authorization", authHeader("t1", "teacher"));

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.ok).toBe(true);
    expect(publishRes.body.data.status).toBe("published");
    expect(gradeStatus).toBe("published");

    const finalGradeRes = await request(app)
      .get("/api/v1/stages/40/groups/20/grade")
      .set("authorization", authHeader("s1", "student"));

    expect(finalGradeRes.status).toBe(200);
    expect(finalGradeRes.body.ok).toBe(true);
    expect(finalGradeRes.body.data.id).toBe("701");
    expect(finalGradeRes.body.data.submissionId).toBe("501");
    expect(finalGradeRes.body.data.status).toBe("published");
    expect(finalGradeRes.body.data.score).toBe("92");
    expect(pushSpy).toHaveBeenCalledWith(
      "group:20",
      expect.objectContaining({ name: "grade.published" }),
    );
    expect(pushSpy).toHaveBeenCalledWith(
      "course:10",
      expect.objectContaining({ name: "grade.published" }),
    );
  });
});
