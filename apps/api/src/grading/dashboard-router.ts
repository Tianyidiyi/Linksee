import { GradeStatus, Role, SubmissionStatus } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseBigIntParam, serializeBigInt, forbidden } from "../assignments/assignment-access.js";
import { ensureCourseReadable } from "../courses/course-access.js";
import { ok } from "../infra/http-response.js";

export const dashboardRouter = Router();

function computeProgress(totalStages: number, approvedCount: number): number {
  if (totalStages <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((approvedCount / totalStages) * 100)));
}

dashboardRouter.get("/courses/:courseId/dashboard", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can view dashboard");
  }

  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  const stages = await prisma.assignmentStage.findMany({
    where: { assignment: { courseId } },
    select: { id: true, dueAt: true },
  });
  const stageIds = stages.map((stage) => stage.id);

  const groups = await prisma.group.findMany({
    where: { assignment: { courseId }, status: { in: ["forming", "active"] } },
    orderBy: [{ assignmentId: "asc" }, { groupNo: "asc" }],
    select: {
      id: true,
      name: true,
      groupNo: true,
      updatedAt: true,
    },
  });

  const rows = groups.length === 0 || stageIds.length === 0
    ? []
    : await prisma.submission.findMany({
        where: { groupId: { in: groups.map((g) => g.id) }, stageId: { in: stageIds } },
        orderBy: [{ stageId: "asc" }, { attemptNo: "desc" }],
        select: { groupId: true, stageId: true, status: true, attemptNo: true },
      });

  const latestByGroupStage = new Map<string, SubmissionStatus>();
  for (const row of rows) {
    const key = `${row.groupId.toString()}::${row.stageId.toString()}`;
    if (!latestByGroupStage.has(key)) {
      latestByGroupStage.set(key, row.status);
    }
  }

  const now = Date.now();
  const staleMs = 14 * 24 * 60 * 60 * 1000;

  const data = groups.map((group) => {
    let approvedCount = 0;
    let pendingReviewCount = 0;
    let overdueCount = 0;

    for (const stage of stages) {
      const key = `${group.id.toString()}::${stage.id.toString()}`;
      const status = latestByGroupStage.get(key) ?? null;
      if (status === SubmissionStatus.approved || status === SubmissionStatus.reviewed || status === SubmissionStatus.rejected) {
        approvedCount += 1;
      }
      if (status === SubmissionStatus.submitted || status === SubmissionStatus.under_review) {
        pendingReviewCount += 1;
      }
      if (stage.dueAt && stage.dueAt.getTime() < now) {
        if (!status || status === SubmissionStatus.not_submitted || status === SubmissionStatus.submitted || status === SubmissionStatus.under_review || status === SubmissionStatus.needs_changes) {
          overdueCount += 1;
        }
      }
    }

    return {
      groupId: group.id.toString(),
      name: group.name?.trim() || `第 ${group.groupNo} 组`,
      progress: computeProgress(stages.length, approvedCount),
      pendingReviewCount,
      overdueCount,
      inactive: now - group.updatedAt.getTime() > staleMs,
    };
  });

  return ok(res, serializeBigInt({ courseId: courseId.toString(), groups: data }));
});

dashboardRouter.get("/courses/:courseId/pipeline-health", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can view pipeline health");
  }

  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  const stages = await prisma.assignmentStage.findMany({
    where: { assignment: { courseId } },
    select: { id: true, stageNo: true, title: true, dueAt: true },
    orderBy: [{ stageNo: "asc" }],
  });
  const stageIds = stages.map((stage) => stage.id);

  const [submissionCounts, gradeCounts] = await prisma.$transaction([
    prisma.submission.groupBy({
      by: ["stageId", "status"],
      where: { stageId: { in: stageIds } },
      _count: { _all: true },
    }),
    prisma.stageGrade.groupBy({
      by: ["stageId", "status"],
      where: { courseId, stageId: { in: stageIds } },
      _count: { _all: true },
    }),
  ]);

  const submissionMap = new Map<string, number>();
  for (const row of submissionCounts) {
    submissionMap.set(`${row.stageId.toString()}::${row.status}`, row._count._all);
  }

  const gradeMap = new Map<string, number>();
  for (const row of gradeCounts) {
    gradeMap.set(`${row.stageId.toString()}::${row.status}`, row._count._all);
  }

  const stageHealth = stages.map((stage) => ({
    stageId: stage.id.toString(),
    stageNo: stage.stageNo,
    stageTitle: stage.title,
    dueAt: stage.dueAt,
    notSubmittedCount: submissionMap.get(`${stage.id.toString()}::${SubmissionStatus.not_submitted}`) ?? 0,
    pendingReviewCount:
      (submissionMap.get(`${stage.id.toString()}::${SubmissionStatus.submitted}`) ?? 0)
      + (submissionMap.get(`${stage.id.toString()}::${SubmissionStatus.under_review}`) ?? 0),
    needsChangesCount: submissionMap.get(`${stage.id.toString()}::${SubmissionStatus.needs_changes}`) ?? 0,
    approvedCount: submissionMap.get(`${stage.id.toString()}::${SubmissionStatus.approved}`) ?? 0,
    rejectedCount: submissionMap.get(`${stage.id.toString()}::${SubmissionStatus.rejected}`) ?? 0,
    reviewedCount: submissionMap.get(`${stage.id.toString()}::${SubmissionStatus.reviewed}`) ?? 0,
    gradeDraftCount: gradeMap.get(`${stage.id.toString()}::${GradeStatus.draft}`) ?? 0,
    gradePublishedCount: gradeMap.get(`${stage.id.toString()}::${GradeStatus.published}`) ?? 0,
  }));

  return ok(res, serializeBigInt({
    courseId: courseId.toString(),
    stageCount: stages.length,
    stages: stageHealth,
  }));
});
