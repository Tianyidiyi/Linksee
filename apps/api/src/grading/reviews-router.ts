import { Prisma, ReviewDecision, ReviewStatus, Role, SubmissionStatus } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseIdempotencyKey, parseLimitOffset } from "../infra/request-utils.js";
import { fail, ok } from "../infra/http-response.js";
import { parseBigIntParam, parseSingleString, serializeBigInt, validationFailed, conflict, forbidden } from "../assignments/assignment-access.js";
import { ensureCourseReadable } from "../courses/course-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";
import { canTransitionSubmissionStatus, reviewDecisionToSubmissionStatus } from "../submissions/submission-status.js";
import { getIdempotentResponse, saveIdempotentResponse } from "../infra/idempotency-store.js";

export const reviewsRouter = Router();

type RubricItem = {
  item: string;
  score: number;
  maxScore: number;
};

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function parseRubricScores(value: unknown, res: Response): RubricItem[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    validationFailed(res, "rubricScores must be an array");
    return undefined;
  }
  if (value.length > 10) {
    validationFailed(res, "rubricScores must contain at most 10 items");
    return undefined;
  }
  const items: RubricItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      validationFailed(res, "rubricScores items must be objects");
      return undefined;
    }
    const rawItem = (entry as { item?: unknown }).item;
    const rawScore = (entry as { score?: unknown }).score;
    const rawMaxScore = (entry as { maxScore?: unknown }).maxScore;

    if (typeof rawItem !== "string" || rawItem.trim().length === 0 || rawItem.trim().length > 80) {
      validationFailed(res, "rubricScores item must be 1-80 characters");
      return undefined;
    }
    if (typeof rawScore !== "number" || !Number.isFinite(rawScore) || rawScore < 0) {
      validationFailed(res, "rubricScores score must be a non-negative number");
      return undefined;
    }
    if (typeof rawMaxScore !== "number" || !Number.isFinite(rawMaxScore) || rawMaxScore <= 0 || rawMaxScore > 100) {
      validationFailed(res, "rubricScores maxScore must be between 1 and 100");
      return undefined;
    }
    if (rawScore > rawMaxScore) {
      validationFailed(res, "rubricScores score must be less than or equal to maxScore");
      return undefined;
    }

    items.push({
      item: rawItem.trim(),
      score: rawScore,
      maxScore: rawMaxScore,
    });
  }
  return items;
}

reviewsRouter.post("/submissions/:submissionId/reviews/start", requireAuth, async (req: Request, res: Response) => {
  const submissionId = parseBigIntParam(req.params.submissionId, "submissionId", res);
  if (submissionId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can start review");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      groupId: true,
      stageId: true,
      stage: { select: { assignment: { select: { courseId: true } } } },
    },
  });
  if (!submission) {
    return fail(res, 404, "NOT_FOUND", "Submission not found");
  }

  const courseId = submission.stage.assignment.courseId;
  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  if (submission.status === SubmissionStatus.under_review) {
    return ok(res, { submissionId: submissionId.toString(), status: SubmissionStatus.under_review });
  }
  if (!canTransitionSubmissionStatus(submission.status, SubmissionStatus.under_review)) {
    return conflict(res, "Only submitted status can enter under_review");
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: SubmissionStatus.under_review },
  });

  const statusEvent = createEventEnvelope("submission.status.updated", {
    submissionId: submissionId.toString(),
    groupId: submission.groupId.toString(),
    stageId: submission.stageId.toString(),
    courseId: courseId.toString(),
    status: SubmissionStatus.under_review,
  });
  await pushSocketEvent(`group:${submission.groupId.toString()}`, statusEvent);
  await pushSocketEvent(`course:${courseId.toString()}`, statusEvent);

  return ok(res, { submissionId: submissionId.toString(), status: SubmissionStatus.under_review });
});

reviewsRouter.post("/submissions/:submissionId/reviews", requireAuth, async (req: Request, res: Response) => {
  const submissionId = parseBigIntParam(req.params.submissionId, "submissionId", res);
  if (submissionId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can review submissions");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      stageId: true,
      groupId: true,
      stage: { select: { assignment: { select: { courseId: true } } } },
    },
  });

  if (!submission) {
    return fail(res, 404, "NOT_FOUND", "Submission not found");
  }

  const course = await ensureCourseReadable(submission.stage.assignment.courseId, req.user!.id, role, res);
  if (!course) return;

  if (
    submission.status !== SubmissionStatus.submitted &&
    submission.status !== SubmissionStatus.under_review
  ) {
    return conflict(res, "Submission is not ready for review");
  }

  const statusRaw = req.body?.status;
  if (statusRaw !== "needs_changes" && statusRaw !== "approved" && statusRaw !== "rejected") {
    return validationFailed(res, "status must be needs_changes, approved or rejected");
  }

  const comment = parseSingleString(req.body?.comment);
  if (!comment) {
    return validationFailed(res, "comment is required");
  }
  if (comment.length > 3000) {
    return validationFailed(res, "comment must be at most 3000 characters");
  }

  const rubricScores = parseRubricScores(req.body?.rubricScores, res);
  if (req.body?.rubricScores !== undefined && rubricScores === undefined) return;

  const idempotencyKey = parseIdempotencyKey(req);
  const idemStoreKey = idempotencyKey
    ? `idem:review:create:${req.user!.id}:${submissionId.toString()}:${idempotencyKey}`
    : null;
  if (idemStoreKey) {
    const cached = await getIdempotentResponse<Record<string, unknown>>(idemStoreKey);
    if (cached) {
      return ok(res, cached);
    }
  }
  const existingReview = await prisma.review.findUnique({
    where: { submissionId_reviewerId: { submissionId, reviewerId: req.user!.id } },
    select: {
      id: true,
      submissionId: true,
      decision: true,
      score: true,
      reviewerId: true,
      createdAt: true,
    },
  });

  if (existingReview) {
    if (idempotencyKey) {
      return conflict(res, "Idempotency key has no cached result; review already exists");
    }
    return conflict(res, "Review already exists for this submission");
  }

  const decision =
    statusRaw === "needs_changes"
      ? ReviewDecision.needs_changes
      : statusRaw === "approved"
        ? ReviewDecision.approved
        : ReviewDecision.rejected;
  const nextSubmissionStatus = reviewDecisionToSubmissionStatus(decision);
  if (!canTransitionSubmissionStatus(submission.status, nextSubmissionStatus)) {
    return conflict(res, `Cannot transition submission status from ${submission.status} to ${nextSubmissionStatus}`);
  }

  const totalScore = rubricScores?.reduce((sum, item) => sum + item.score, 0) ?? null;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        submissionId,
        reviewerId: req.user!.id,
        status: ReviewStatus.submitted,
        decision,
        score: totalScore === null ? null : new Prisma.Decimal(totalScore),
        rubric: rubricScores ? (rubricScores as Prisma.InputJsonValue) : null,
        comment,
        submittedAt: now,
      },
      select: {
        id: true,
        submissionId: true,
        decision: true,
        score: true,
        reviewerId: true,
        createdAt: true,
      },
    });

    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: nextSubmissionStatus,
      },
    });

    return review;
  });

  const reviewEvent = createEventEnvelope("review.created", {
    reviewId: result.id.toString(),
    submissionId: submissionId.toString(),
    groupId: submission.groupId.toString(),
    stageId: submission.stageId.toString(),
    reviewerId: req.user!.id,
    status: decision,
  });

  const statusEvent = createEventEnvelope("submission.status.updated", {
    submissionId: submissionId.toString(),
    groupId: submission.groupId.toString(),
    stageId: submission.stageId.toString(),
    courseId: submission.stage.assignment.courseId.toString(),
    status: nextSubmissionStatus,
  });

  await pushSocketEvent(`group:${submission.groupId.toString()}`, reviewEvent);
  await pushSocketEvent(`group:${submission.groupId.toString()}`, statusEvent);
  await pushSocketEvent(`course:${submission.stage.assignment.courseId.toString()}`, statusEvent);

  const responseData = serializeBigInt({
    id: result.id,
    submissionId: result.submissionId,
    status: result.decision,
    score: result.score ? Number(result.score) : null,
    reviewerId: result.reviewerId,
    createdAt: result.createdAt,
  });
  if (idemStoreKey) {
    await saveIdempotentResponse(idemStoreKey, responseData);
  }

  return ok(res, responseData);
});

reviewsRouter.get("/courses/:courseId/pending-reviews", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can view pending reviews");
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
  const reviewerId = typeof req.query.reviewerId === "string" && req.query.reviewerId.trim()
    ? req.query.reviewerId.trim()
    : null;
  if (req.query.reviewerId !== undefined && !reviewerId) {
    return validationFailed(res, "reviewerId must be a non-empty string");
  }

  const where: Prisma.SubmissionWhereInput = {
    status: { in: [SubmissionStatus.submitted, SubmissionStatus.under_review] },
    ...(stageId ? { stageId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(reviewerId ? { NOT: { reviews: { some: { reviewerId } } } } : {}),
    stage: {
      assignment: {
        courseId,
      },
    },
  };

  const [rows, total] = await prisma.$transaction([
    prisma.submission.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        groupId: true,
        stageId: true,
        attemptNo: true,
        status: true,
        submittedAt: true,
        submittedBy: true,
        createdAt: true,
        stage: {
          select: {
            title: true,
            dueAt: true,
            assignment: { select: { courseId: true } },
          },
        },
        group: {
          select: {
            name: true,
            groupNo: true,
            assignmentId: true,
          },
        },
      },
    }),
    prisma.submission.count({ where }),
  ]);

  res.json({
    ok: true,
    data: serializeBigInt(rows),
    paging: { limit, offset, total, hasMore: offset + rows.length < total },
  });
});

reviewsRouter.patch("/reviews/:reviewId", requireAuth, async (req: Request, res: Response) => {
  const reviewId = parseBigIntParam(req.params.reviewId, "reviewId", res);
  if (reviewId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can update reviews");
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      submissionId: true,
      reviewerId: true,
      decision: true,
      status: true,
      submission: {
        select: {
          id: true,
          status: true,
          groupId: true,
          stageId: true,
          stage: { select: { assignment: { select: { courseId: true } } } },
        },
      },
    },
  });

  if (!review) {
    return fail(res, 404, "NOT_FOUND", "Review not found");
  }

  const courseId = review.submission.stage.assignment.courseId;
  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  if (review.reviewerId !== req.user!.id) {
    return forbidden(res, "Only the review author can update this review");
  }

  const statusRaw = req.body?.status;
  if (statusRaw !== "needs_changes" && statusRaw !== "approved" && statusRaw !== "rejected") {
    return validationFailed(res, "status must be needs_changes, approved or rejected");
  }

  const comment = parseSingleString(req.body?.comment);
  if (!comment) {
    return validationFailed(res, "comment is required");
  }
  if (comment.length > 3000) {
    return validationFailed(res, "comment must be at most 3000 characters");
  }

  const rubricScores = parseRubricScores(req.body?.rubricScores, res);
  if (req.body?.rubricScores !== undefined && rubricScores === undefined) return;

  const decision =
    statusRaw === "needs_changes"
      ? ReviewDecision.needs_changes
      : statusRaw === "approved"
        ? ReviewDecision.approved
        : ReviewDecision.rejected;
  const nextSubmissionStatus = reviewDecisionToSubmissionStatus(decision);
  if (!canTransitionSubmissionStatus(review.submission.status, nextSubmissionStatus)) {
    return conflict(res, `Cannot transition submission status from ${review.submission.status} to ${nextSubmissionStatus}`);
  }
  const totalScore = rubricScores?.reduce((sum, item) => sum + item.score, 0) ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReview = await tx.review.update({
      where: { id: reviewId },
      data: {
        status: ReviewStatus.submitted,
        decision,
        score: totalScore === null ? null : new Prisma.Decimal(totalScore),
        rubric: rubricScores ? (rubricScores as Prisma.InputJsonValue) : null,
        comment,
        submittedAt: new Date(),
      },
      select: {
        id: true,
        submissionId: true,
        decision: true,
        score: true,
        reviewerId: true,
        createdAt: true,
      },
    });

    await tx.submission.update({
      where: { id: review.submissionId },
      data: { status: nextSubmissionStatus },
    });

    return updatedReview;
  });

  const reviewEvent = createEventEnvelope("review.updated", {
    reviewId: updated.id.toString(),
    submissionId: review.submissionId.toString(),
    groupId: review.submission.groupId.toString(),
    stageId: review.submission.stageId.toString(),
    reviewerId: req.user!.id,
    status: decision,
  });

  const statusEvent = createEventEnvelope("submission.status.updated", {
    submissionId: review.submissionId.toString(),
    groupId: review.submission.groupId.toString(),
    stageId: review.submission.stageId.toString(),
    courseId: courseId.toString(),
    status: nextSubmissionStatus,
  });

  await pushSocketEvent(`group:${review.submission.groupId.toString()}`, reviewEvent);
  await pushSocketEvent(`group:${review.submission.groupId.toString()}`, statusEvent);
  await pushSocketEvent(`course:${courseId.toString()}`, statusEvent);

  return ok(res, serializeBigInt({
    id: updated.id,
    submissionId: updated.submissionId,
    status: updated.decision,
    score: updated.score ? Number(updated.score) : null,
    reviewerId: updated.reviewerId,
    createdAt: updated.createdAt,
  }));
});

reviewsRouter.post("/submissions/:submissionId/mark-reviewed", requireAuth, async (req: Request, res: Response) => {
  const submissionId = parseBigIntParam(req.params.submissionId, "submissionId", res);
  if (submissionId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can mark submission status");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      groupId: true,
      stageId: true,
      stage: { select: { assignment: { select: { courseId: true } } } },
    },
  });
  if (!submission) {
    return fail(res, 404, "NOT_FOUND", "Submission not found");
  }

  const courseId = submission.stage.assignment.courseId;
  const course = await ensureCourseReadable(courseId, req.user!.id, role, res);
  if (!course) return;

  if (!canTransitionSubmissionStatus(submission.status, SubmissionStatus.reviewed)) {
    return conflict(res, "Only not_submitted status can be marked reviewed");
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: SubmissionStatus.reviewed },
  });

  const statusEvent = createEventEnvelope("submission.status.updated", {
    submissionId: submissionId.toString(),
    groupId: submission.groupId.toString(),
    stageId: submission.stageId.toString(),
    courseId: courseId.toString(),
    status: SubmissionStatus.reviewed,
  });

  await pushSocketEvent(`group:${submission.groupId.toString()}`, statusEvent);
  await pushSocketEvent(`course:${courseId.toString()}`, statusEvent);

  return ok(res, { submissionId: submissionId.toString(), status: SubmissionStatus.reviewed });
});

reviewsRouter.get("/courses/:courseId/reviews/export", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;

  const role = req.user!.role as Role;
  if (role === Role.student) {
    return forbidden(res, "Only course staff can export reviews");
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
  const reviewerId = typeof req.query.reviewerId === "string" && req.query.reviewerId.trim()
    ? req.query.reviewerId.trim()
    : null;
  if (req.query.reviewerId !== undefined && !reviewerId) {
    return validationFailed(res, "reviewerId must be a non-empty string");
  }

  const where: Prisma.ReviewWhereInput = {
    ...(reviewerId ? { reviewerId } : {}),
    submission: {
      stage: {
        assignment: { courseId },
      },
      ...(stageId ? { stageId } : {}),
      ...(groupId ? { groupId } : {}),
    },
  };

  const rows = await prisma.review.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      submissionId: true,
      reviewerId: true,
      status: true,
      decision: true,
      score: true,
      comment: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      submission: {
        select: {
          groupId: true,
          stageId: true,
          attemptNo: true,
          status: true,
          group: { select: { name: true, groupNo: true } },
          stage: { select: { title: true, stageNo: true } },
        },
      },
    },
  });

  const header = [
    "reviewId", "courseId", "submissionId", "stageId", "stageNo", "stageTitle", "groupId", "groupNo",
    "groupName", "attemptNo", "submissionStatus", "reviewerId", "reviewStatus", "decision", "score",
    "comment", "submittedAt", "createdAt", "updatedAt",
  ];
  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push([
      row.id.toString(),
      courseId.toString(),
      row.submissionId.toString(),
      row.submission.stageId.toString(),
      row.submission.stage.stageNo,
      csvEscape(row.submission.stage.title),
      row.submission.groupId.toString(),
      row.submission.group.groupNo,
      csvEscape(row.submission.group.name ?? ""),
      row.submission.attemptNo,
      row.submission.status,
      row.reviewerId,
      row.status,
      row.decision ?? "",
      row.score ? Number(row.score) : "",
      csvEscape(row.comment ?? ""),
      row.submittedAt ? row.submittedAt.toISOString() : "",
      row.createdAt.toISOString(),
      row.updatedAt.toISOString(),
    ].map(csvEscape).join(","));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="course-${courseId.toString()}-reviews.csv"`);
  res.send(lines.join("\n"));
});
