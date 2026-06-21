import { AssignmentStatus, CourseMemberStatus, GradeStatus, Role, StageStatus, SubmissionStatus } from "@prisma/client";
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

dashboardRouter.get("/students/dashboard", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const role = req.user!.role as Role;
  if (role !== Role.student) {
    return forbidden(res, "Only students can view student dashboard");
  }

  const memberships = await prisma.courseMember.findMany({
    where: { userId, status: CourseMemberStatus.active },
    select: { courseId: true },
  });
  const courseIds = memberships.map((item) => item.courseId);

  if (courseIds.length === 0) {
    return ok(res, { courses: [], todoRows: [], gradeRows: [] });
  }

  const [courses, assignments] = await prisma.$transaction([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      orderBy: [{ academicYear: "desc" }, { semester: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        courseNo: true,
        name: true,
        academicYear: true,
        semester: true,
        status: true,
        description: true,
        createdAt: true,
      },
    }),
    prisma.assignment.findMany({
      where: {
        courseId: { in: courseIds },
        status: { in: [AssignmentStatus.active, AssignmentStatus.archived] },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        courseId: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const assignmentIds = assignments.map((item) => item.id);
  if (assignmentIds.length === 0) {
    return ok(res, serializeBigInt({ courses, todoRows: [], gradeRows: [] }));
  }

  const [groupMemberships, stages] = await prisma.$transaction([
    prisma.groupMember.findMany({
      where: { userId, assignmentId: { in: assignmentIds } },
      select: {
        assignmentId: true,
        role: true,
        joinedAt: true,
        group: {
          select: {
            id: true,
            groupNo: true,
            name: true,
            status: true,
            _count: { select: { members: true } },
          },
        },
      },
    }),
    prisma.assignmentStage.findMany({
      where: {
        assignmentId: { in: assignmentIds },
        status: { in: [StageStatus.planned, StageStatus.open, StageStatus.closed, StageStatus.archived] },
      },
      orderBy: [{ stageNo: "asc" }],
      select: {
        id: true,
        assignmentId: true,
        stageNo: true,
        title: true,
        dueAt: true,
        status: true,
      },
    }),
  ]);

  if (stages.length === 0) {
    return ok(res, serializeBigInt({ courses, todoRows: [], gradeRows: [] }));
  }

  const groupByAssignmentId = new Map(
    groupMemberships.map((membership) => [
      membership.assignmentId.toString(),
      {
        id: membership.group.id,
        groupNo: membership.group.groupNo,
        name: membership.group.name,
        status: membership.group.status,
        myRole: membership.role,
        joinedAt: membership.joinedAt,
        _count: membership.group._count,
      },
    ]),
  );

  const groupIds = Array.from(new Set(groupMemberships.map((membership) => membership.group.id)));
  const stageIds = stages.map((stage) => stage.id);

  const [submissions, grades] = await prisma.$transaction([
    prisma.submission.findMany({
      where: {
        groupId: { in: groupIds },
        stageId: { in: stageIds },
      },
      orderBy: [{ stageId: "asc" }, { groupId: "asc" }, { attemptNo: "desc" }],
      select: {
        id: true,
        groupId: true,
        stageId: true,
        status: true,
        attemptNo: true,
        submittedAt: true,
        createdAt: true,
      },
    }),
    prisma.stageGrade.findMany({
      where: {
        groupId: { in: groupIds },
        stageId: { in: stageIds },
        status: GradeStatus.published,
      },
      select: {
        id: true,
        groupId: true,
        stageId: true,
        score: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const courseById = new Map(courses.map((course) => [course.id.toString(), course]));
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id.toString(), assignment]));

  const latestSubmissionByKey = new Map<string, (typeof submissions)[number]>();
  for (const submission of submissions) {
    const key = `${submission.groupId.toString()}::${submission.stageId.toString()}`;
    if (!latestSubmissionByKey.has(key)) {
      latestSubmissionByKey.set(key, submission);
    }
  }

  const gradeByKey = new Map(
    grades.map((grade) => [`${grade.groupId.toString()}::${grade.stageId.toString()}`, grade]),
  );

  const todoRows = stages.flatMap((stage) => {
    const assignment = assignmentById.get(stage.assignmentId.toString());
    if (!assignment) return [];

    const course = courseById.get(assignment.courseId.toString());
    if (!course) return [];

    const group = groupByAssignmentId.get(stage.assignmentId.toString()) ?? null;

    const submission = group
      ? latestSubmissionByKey.get(`${group.id.toString()}::${stage.id.toString()}`) ?? null
      : null;

    return [{
      course,
      assignment,
      group,
      stage,
      submission,
    }];
  });

  const gradeRows = todoRows.flatMap((row) => {
    if (!row.group) return [];
    const key = `${row.group.id.toString()}::${row.stage.id.toString()}`;
    const grade = gradeByKey.get(key);
    if (!grade) return [];

    return [{
      course: row.course,
      assignment: row.assignment,
      group: row.group,
      stage: row.stage,
      grade,
    }];
  });

  return ok(res, serializeBigInt({ courses, todoRows, gradeRows }));
});

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
