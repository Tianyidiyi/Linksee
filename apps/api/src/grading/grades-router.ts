import { GradeAction, GradeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { fail, ok } from "../infra/http-response.js";
import { parseBigIntParam, serializeBigInt, validationFailed, conflict, forbidden } from "../assignments/assignment-access.js";
import { ensureCourseReadable } from "../courses/course-access.js";
import { getGroupAccess } from "../groups/group-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";
import { parseLimitOffset } from "../infra/request-utils.js";

export const gradesRouter = Router();

function parseScore(raw: unknown, res: Response): Prisma.Decimal | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 100) {
    validationFailed(res, "score must be a number between 0 and 100");
    return null;
  }
  return new Prisma.Decimal(raw);
}

function parseGradeIds(raw: unknown, res: Response): bigint[] | null {
  if (!Array.isArray(raw)) {
    validationFailed(res, "gradeIds must be an array");
    return null;
  }
  if (raw.length === 0 || raw.length > 200) {
    validationFailed(res, "gradeIds must contain between 1 and 200 ids");
    return null;
  }

  const ids: bigint[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !/^\d+$/.test(item)) {
      validationFailed(res, "gradeIds items must be numeric strings");
      return null;
    }
    ids.push(BigInt(item));
  }

  const unique = Array.from(new Set(ids.map((id) => id.toString()))).map((id) => BigInt(id));
  return unique;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

async function resolveSubmissionContext(submissionId: bigint) {
  return prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      groupId: true,
      stageId: true,
      stage: { select: { assignment: { select: { courseId: true } } } },
      reviews: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: { id: true },
      },
    },
  });
}

gradesRouter.post("/submissions/:submissionId/grade-drafts", requireAuth, async (req: Request, res: Response) => {
  const submissionId = parseBigIntParam(req.params.submissionId, "submissionId", res);
  if (submissionId === null) return;

  const role = req.user!.role as Role;
  if (role !== Role.teacher && role !== Role.assistant) {
    return forbidden(res, "Only course staff can create grade drafts");
  }

  const score = parseScore(req.body?.score, res);
  if (score === null) return;

  const submission = await resolveSubmissionContext(submissionId);
  if (!submission) {
    return fail(res, 404, "NOT_FOUND", "Submission not found");
  }

  const courseId = submission.stage.assignment.courseId;
  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;
  if (submission.status !== SubmissionStatus.approved && submission.status !== SubmissionStatus.reviewed) {
    return conflict(res, "Only approved or reviewed submissions can be graded");
  }

  const existing = await prisma.stageGrade.findUnique({
    where: { submissionId },
    select: { id: true, score: true, status: true },
  });

  const grade = await prisma.$transaction(async (tx) => {
    const upserted = await tx.stageGrade.upsert({
      where: { submissionId },
      update: {
        score,
        graderId: req.user!.id,
        sourceReviewId: submission.reviews[0]?.id ?? null,
      },
      create: {
        submissionId,
        groupId: submission.groupId,
        stageId: submission.stageId,
        courseId,
        score,
        status: GradeStatus.draft,
        graderId: req.user!.id,
        sourceReviewId: submission.reviews[0]?.id ?? null,
      },
      select: {
        id: true,
        submissionId: true,
        groupId: true,
        stageId: true,
        courseId: true,
        score: true,
        status: true,
        graderId: true,
        publishedBy: true,
        publishedAt: true,
        sourceReviewId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.stageGradeLog.create({
      data: {
        stageGradeId: upserted.id,
        action: existing ? GradeAction.updated : GradeAction.created,
        beforeScore: existing?.score ?? null,
        afterScore: score,
        operatorId: req.user!.id,
        reason: null,
      },
    });

    return upserted;
  });

  return ok(res, serializeBigInt(grade), existing ? 200 : 201);
});

gradesRouter.patch("/grade-drafts/:gradeId", requireAuth, async (req: Request, res: Response) => {
  const gradeId = parseBigIntParam(req.params.gradeId, "gradeId", res);
  if (gradeId === null) return;

  const role = req.user!.role as Role;
  if (role !== Role.teacher && role !== Role.assistant) {
    return forbidden(res, "Only course staff can update grade drafts");
  }

  const score = parseScore(req.body?.score, res);
  if (score === null) return;

  const grade = await prisma.stageGrade.findUnique({
    where: { id: gradeId },
    select: {
      id: true,
      score: true,
      status: true,
      courseId: true,
    },
  });
  if (!grade) {
    return fail(res, 404, "NOT_FOUND", "Grade draft not found");
  }
  if (grade.status !== GradeStatus.draft) {
    return conflict(res, "Only draft grades can be updated");
  }

  const course = await ensureCourseReadable(grade.courseId, req.user!.id, role, res);
  if (!course) return;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.stageGrade.update({
      where: { id: gradeId },
      data: { score, graderId: req.user!.id },
      select: {
        id: true,
        submissionId: true,
        groupId: true,
        stageId: true,
        courseId: true,
        score: true,
        status: true,
        graderId: true,
        publishedBy: true,
        publishedAt: true,
        sourceReviewId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.stageGradeLog.create({
      data: {
        stageGradeId: gradeId,
        action: GradeAction.updated,
        beforeScore: grade.score,
        afterScore: score,
        operatorId: req.user!.id,
        reason: null,
      },
    });
    return next;
  });

  return ok(res, serializeBigInt(updated));
});

gradesRouter.post("/grades/:gradeId/publish", requireAuth, async (req: Request, res: Response) => {
  const gradeId = parseBigIntParam(req.params.gradeId, "gradeId", res);
  if (gradeId === null) return;

  const role = req.user!.role as Role;
  if (role !== Role.teacher) {
    return forbidden(res, "Only teacher can publish grades");
  }

  const grade = await prisma.stageGrade.findUnique({
    where: { id: gradeId },
    select: {
      id: true,
      score: true,
      status: true,
      courseId: true,
      groupId: true,
      stageId: true,
      submission: { select: { status: true } },
    },
  });
  if (!grade) {
    return fail(res, 404, "NOT_FOUND", "Grade draft not found");
  }
  if (grade.status === GradeStatus.published) {
    return ok(res, serializeBigInt({ id: grade.id, status: grade.status }));
  }
  if (grade.submission.status !== SubmissionStatus.approved && grade.submission.status !== SubmissionStatus.reviewed) {
    return conflict(res, "Only approved or reviewed submission can publish grade");
  }

  const course = await ensureCourseReadable(grade.courseId, req.user!.id, role, res);
  if (!course) return;

  const publishedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.stageGrade.update({
      where: { id: gradeId },
      data: {
        status: GradeStatus.published,
        publishedBy: req.user!.id,
        publishedAt,
      },
      select: {
        id: true,
        submissionId: true,
        groupId: true,
        stageId: true,
        courseId: true,
        score: true,
        status: true,
        graderId: true,
        publishedBy: true,
        publishedAt: true,
        sourceReviewId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await tx.stageGradeLog.create({
      data: {
        stageGradeId: gradeId,
        action: GradeAction.published,
        beforeScore: grade.score,
        afterScore: grade.score,
        operatorId: req.user!.id,
        reason: null,
      },
    });
    return next;
  });

  const event = createEventEnvelope("grade.published", {
    gradeId: updated.id.toString(),
    submissionId: updated.submissionId.toString(),
    groupId: updated.groupId.toString(),
    stageId: updated.stageId.toString(),
    courseId: updated.courseId.toString(),
    score: updated.score ? Number(updated.score) : null,
  });
  await pushSocketEvent(`group:${updated.groupId.toString()}`, event);
  await pushSocketEvent(`course:${updated.courseId.toString()}`, event);

  return ok(res, serializeBigInt(updated));
});

gradesRouter.post("/courses/:courseId/grades/publish-batch", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;

  const role = req.user!.role as Role;
  if (role !== Role.teacher) {
    return forbidden(res, "Only teacher can publish grades");
  }

  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  const gradeIds = parseGradeIds(req.body?.gradeIds, res);
  if (!gradeIds) return;
  const strict = req.body?.strict === true;

  const grades = await prisma.stageGrade.findMany({
    where: { id: { in: gradeIds }, courseId },
    select: {
      id: true,
      score: true,
      status: true,
      submissionId: true,
      groupId: true,
      stageId: true,
      courseId: true,
      submission: { select: { status: true } },
    },
  });

  const rowById = new Map(grades.map((row) => [row.id.toString(), row]));
  const blocked: Array<{ gradeId: string; reason: string }> = [];
  const publishable: Array<(typeof grades)[number]> = [];

  for (const gradeId of gradeIds) {
    const key = gradeId.toString();
    const row = rowById.get(key);
    if (!row) {
      blocked.push({ gradeId: key, reason: "not_found_in_course" });
      continue;
    }
    if (row.status === GradeStatus.published) {
      blocked.push({ gradeId: key, reason: "already_published" });
      continue;
    }
    if (row.submission.status !== SubmissionStatus.approved && row.submission.status !== SubmissionStatus.reviewed) {
      blocked.push({ gradeId: key, reason: `submission_status_${row.submission.status}` });
      continue;
    }
    publishable.push(row);
  }

  if (strict && blocked.length > 0) {
    return conflict(res, `Batch publish blocked by ${blocked.length} grade(s)`);
  }

  const publishedAt = new Date();
  const updated = publishable.length === 0 ? [] : await prisma.$transaction(async (tx) => {
    const publishedRows: Array<{
      id: bigint;
      submissionId: bigint;
      groupId: bigint;
      stageId: bigint;
      courseId: bigint;
      score: Prisma.Decimal | null;
      status: GradeStatus;
      graderId: string;
      publishedBy: string | null;
      publishedAt: Date | null;
      sourceReviewId: bigint | null;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    for (const row of publishable) {
      const next = await tx.stageGrade.update({
        where: { id: row.id },
        data: {
          status: GradeStatus.published,
          publishedBy: req.user!.id,
          publishedAt,
        },
        select: {
          id: true,
          submissionId: true,
          groupId: true,
          stageId: true,
          courseId: true,
          score: true,
          status: true,
          graderId: true,
          publishedBy: true,
          publishedAt: true,
          sourceReviewId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      publishedRows.push(next);
    }

    await tx.stageGradeLog.createMany({
      data: publishable.map((row) => ({
        stageGradeId: row.id,
        action: GradeAction.published,
        beforeScore: row.score,
        afterScore: row.score,
        operatorId: req.user!.id,
        reason: null,
      })),
    });

    return publishedRows;
  });

  for (const row of updated) {
    const event = createEventEnvelope("grade.published", {
      gradeId: row.id.toString(),
      submissionId: row.submissionId.toString(),
      groupId: row.groupId.toString(),
      stageId: row.stageId.toString(),
      courseId: row.courseId.toString(),
      score: row.score ? Number(row.score) : null,
    });
    await pushSocketEvent(`group:${row.groupId.toString()}`, event);
    await pushSocketEvent(`course:${row.courseId.toString()}`, event);
  }

  return ok(res, serializeBigInt({
    strict,
    requestedCount: gradeIds.length,
    publishedCount: updated.length,
    blockedCount: blocked.length,
    blocked,
    published: updated,
  }));
});

gradesRouter.patch("/grades/:gradeId", requireAuth, async (req: Request, res: Response) => {
  const gradeId = parseBigIntParam(req.params.gradeId, "gradeId", res);
  if (gradeId === null) return;

  const role = req.user!.role as Role;
  if (role !== Role.teacher) {
    return forbidden(res, "Only teacher can adjust published grade");
  }

  const score = parseScore(req.body?.score, res);
  if (score === null) return;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    return validationFailed(res, "reason is required when adjusting grade");
  }
  if (reason.length > 500) {
    return validationFailed(res, "reason must be at most 500 characters");
  }

  const grade = await prisma.stageGrade.findUnique({
    where: { id: gradeId },
    select: {
      id: true,
      score: true,
      status: true,
      courseId: true,
      groupId: true,
      stageId: true,
      submissionId: true,
    },
  });
  if (!grade) {
    return fail(res, 404, "NOT_FOUND", "Grade not found");
  }
  if (grade.status !== GradeStatus.published) {
    return conflict(res, "Only published grades can be adjusted");
  }

  const course = await ensureCourseReadable(grade.courseId, req.user!.id, role, res);
  if (!course) return;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.stageGrade.update({
      where: { id: gradeId },
      data: { score, graderId: req.user!.id },
      select: {
        id: true,
        submissionId: true,
        groupId: true,
        stageId: true,
        courseId: true,
        score: true,
        status: true,
        graderId: true,
        publishedBy: true,
        publishedAt: true,
        sourceReviewId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await tx.stageGradeLog.create({
      data: {
        stageGradeId: gradeId,
        action: GradeAction.adjusted,
        beforeScore: grade.score,
        afterScore: score,
        operatorId: req.user!.id,
        reason,
      },
    });
    return next;
  });

  const event = createEventEnvelope("grade.updated", {
    gradeId: updated.id.toString(),
    submissionId: updated.submissionId.toString(),
    groupId: updated.groupId.toString(),
    stageId: updated.stageId.toString(),
    courseId: updated.courseId.toString(),
    score: updated.score ? Number(updated.score) : null,
    reason,
  });
  await pushSocketEvent(`group:${updated.groupId.toString()}`, event);
  await pushSocketEvent(`course:${updated.courseId.toString()}`, event);

  return ok(res, serializeBigInt(updated));
});

gradesRouter.get("/courses/:courseId/grades", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can list grades");
  }

  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>);
  const stageId = req.query.stageId !== undefined
    ? parseBigIntParam(req.query.stageId as string | string[] | undefined, "stageId", res)
    : null;
  if (req.query.stageId !== undefined && stageId === null) return;

  const groupId = req.query.groupId !== undefined
    ? parseBigIntParam(req.query.groupId as string | string[] | undefined, "groupId", res)
    : null;
  if (req.query.groupId !== undefined && groupId === null) return;

  const statusRaw = typeof req.query.status === "string" ? req.query.status : null;
  const status = statusRaw === "draft" || statusRaw === "published" ? statusRaw : null;
  if (req.query.status !== undefined && status === null) {
    return validationFailed(res, "status must be draft or published");
  }

  const where: Prisma.StageGradeWhereInput = {
    courseId,
    ...(stageId ? { stageId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(status ? { status: status === "draft" ? GradeStatus.draft : GradeStatus.published } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.stageGrade.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        submissionId: true,
        groupId: true,
        stageId: true,
        courseId: true,
        score: true,
        status: true,
        graderId: true,
        publishedBy: true,
        publishedAt: true,
        sourceReviewId: true,
        createdAt: true,
        updatedAt: true,
        submission: { select: { status: true, attemptNo: true, submittedAt: true } },
        group: { select: { name: true, groupNo: true } },
        stage: { select: { title: true, stageNo: true, dueAt: true } },
      },
    }),
    prisma.stageGrade.count({ where }),
  ]);

  res.json({
    ok: true,
    data: serializeBigInt(rows),
    paging: { limit, offset, total, hasMore: offset + rows.length < total },
  });
});

gradesRouter.get("/courses/:courseId/grades/export", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can export grades");
  }
  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  const stageId = req.query.stageId !== undefined
    ? parseBigIntParam(req.query.stageId as string | string[] | undefined, "stageId", res)
    : null;
  if (req.query.stageId !== undefined && stageId === null) return;
  const groupId = req.query.groupId !== undefined
    ? parseBigIntParam(req.query.groupId as string | string[] | undefined, "groupId", res)
    : null;
  if (req.query.groupId !== undefined && groupId === null) return;
  const statusRaw = typeof req.query.status === "string" ? req.query.status : null;
  const status = statusRaw === "draft" || statusRaw === "published" ? statusRaw : null;
  if (req.query.status !== undefined && status === null) {
    return validationFailed(res, "status must be draft or published");
  }

  const where: Prisma.StageGradeWhereInput = {
    courseId,
    ...(stageId ? { stageId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(status ? { status: status === "draft" ? GradeStatus.draft : GradeStatus.published } : {}),
  };
  const rows = await prisma.stageGrade.findMany({
    where,
    orderBy: [{ stageId: "asc" }, { groupId: "asc" }, { id: "asc" }],
    select: {
      id: true,
      score: true,
      status: true,
      graderId: true,
      publishedBy: true,
      publishedAt: true,
      submissionId: true,
      groupId: true,
      stageId: true,
      group: { select: { name: true, groupNo: true } },
      stage: { select: { title: true, stageNo: true } },
      submission: { select: { status: true, attemptNo: true, submittedAt: true } },
    },
  });

  const header = [
    "gradeId", "courseId", "stageId", "stageNo", "stageTitle", "groupId", "groupNo", "groupName",
    "submissionId", "attemptNo", "submissionStatus", "score", "gradeStatus", "graderId",
    "publishedBy", "publishedAt", "submittedAt",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([
      row.id.toString(),
      courseId.toString(),
      row.stageId.toString(),
      row.stage.stageNo,
      csvEscape(row.stage.title),
      row.groupId.toString(),
      row.group.groupNo,
      csvEscape(row.group.name ?? ""),
      row.submissionId.toString(),
      row.submission.attemptNo,
      row.submission.status,
      row.score ? Number(row.score) : "",
      row.status,
      row.graderId,
      row.publishedBy ?? "",
      row.publishedAt ? row.publishedAt.toISOString() : "",
      row.submission.submittedAt ? row.submission.submittedAt.toISOString() : "",
    ].map(csvEscape).join(","));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="course-${courseId.toString()}-grades.csv"`);
  res.send(lines.join("\n"));
});

gradesRouter.get("/courses/:courseId/grade-drafts", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can list grade drafts");
  }

  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>);
  const stageId = req.query.stageId !== undefined
    ? parseBigIntParam(req.query.stageId as string | string[] | undefined, "stageId", res)
    : null;
  if (req.query.stageId !== undefined && stageId === null) return;

  const groupId = req.query.groupId !== undefined
    ? parseBigIntParam(req.query.groupId as string | string[] | undefined, "groupId", res)
    : null;
  if (req.query.groupId !== undefined && groupId === null) return;

  const where: Prisma.StageGradeWhereInput = {
    courseId,
    status: GradeStatus.draft,
    ...(stageId ? { stageId } : {}),
    ...(groupId ? { groupId } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.stageGrade.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        submissionId: true,
        groupId: true,
        stageId: true,
        courseId: true,
        score: true,
        status: true,
        graderId: true,
        sourceReviewId: true,
        createdAt: true,
        updatedAt: true,
        submission: { select: { status: true, attemptNo: true, submittedAt: true } },
        group: { select: { name: true, groupNo: true } },
        stage: { select: { title: true, stageNo: true, dueAt: true } },
      },
    }),
    prisma.stageGrade.count({ where }),
  ]);

  res.json({
    ok: true,
    data: serializeBigInt(rows),
    paging: { limit, offset, total, hasMore: offset + rows.length < total },
  });
});

gradesRouter.get("/stages/:stageId/groups/:groupId/grade", requireAuth, async (req: Request, res: Response) => {
  const stageId = parseBigIntParam(req.params.stageId, "stageId", res);
  if (stageId === null) return;
  const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
  if (groupId === null) return;

  const role = req.user!.role as Role;

  if (role === Role.student) {
    const group = await getGroupAccess(groupId, req.user!.id, role, res);
    if (!group) return;
  } else {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { assignment: { select: { courseId: true } } },
    });
    if (!group) {
      return fail(res, 404, "NOT_FOUND", "Group not found");
    }
    const course = await ensureCourseReadable(group.assignment.courseId, req.user!.id, role, res);
    if (!course) return;
  }

  const grade = await prisma.stageGrade.findFirst({
    where: { stageId, groupId },
    select: {
      id: true,
      submissionId: true,
      groupId: true,
      stageId: true,
      courseId: true,
      score: true,
      status: true,
      graderId: true,
      publishedBy: true,
      publishedAt: true,
      sourceReviewId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!grade) {
    return fail(res, 404, "NOT_FOUND", "Grade not found");
  }

  if (role === Role.student && grade.status !== GradeStatus.published) {
    return fail(res, 404, "NOT_FOUND", "Grade not found");
  }

  return ok(res, serializeBigInt(grade));
});
