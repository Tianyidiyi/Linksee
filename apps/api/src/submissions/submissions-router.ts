import { AssignmentStatus, Prisma, Role, StageStatus, SubmissionStatus } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseIdempotencyKey } from "../infra/request-utils.js";
import { fail, ok } from "../infra/http-response.js";
import { parseBigIntParam, parseSingleString, serializeBigInt, validationFailed, conflict, forbidden } from "../assignments/assignment-access.js";
import { getGroupAccess } from "../groups/group-access.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";
import { parseSubmissionFileUpload, uploadSubmissionFile, removeSubmissionFileObject } from "./submission-file-storage.js";
import { canCreateSubmissionAttempt } from "./submission-status.js";
import { getIdempotentResponse, saveIdempotentResponse } from "../infra/idempotency-store.js";

export const submissionsRouter = Router();

function parseOptionalText(
  value: unknown,
  fieldName: string,
  maxLength: number,
  res: Response,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    validationFailed(res, `${fieldName} must be a string or null`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    validationFailed(res, `${fieldName} must be a non-empty string`);
    return undefined;
  }
  if (trimmed.length > maxLength) {
    validationFailed(res, `${fieldName} must be at most ${maxLength} characters`);
    return undefined;
  }
  return trimmed;
}

function parseStringArray(
  value: unknown,
  fieldName: string,
  maxItems: number,
  res: Response,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    validationFailed(res, `${fieldName} must be an array`);
    return undefined;
  }
  if (value.length > maxItems) {
    validationFailed(res, `${fieldName} must contain at most ${maxItems} items`);
    return undefined;
  }
  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      validationFailed(res, `${fieldName} items must be strings`);
      return undefined;
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      validationFailed(res, `${fieldName} items must be non-empty strings`);
      return undefined;
    }
    normalized.push(trimmed);
  }
  return normalized;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseOptionalUrl(value: unknown, fieldName: string, res: Response): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    validationFailed(res, `${fieldName} must be a valid URL`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!isValidUrl(trimmed)) {
    validationFailed(res, `${fieldName} must be a valid URL`);
    return undefined;
  }
  return trimmed;
}

function parseUrlArray(value: unknown, fieldName: string, maxItems: number, res: Response): string[] | undefined {
  const urls = parseStringArray(value, fieldName, maxItems, res);
  if (!urls) return urls;
  for (const url of urls) {
    if (!isValidUrl(url)) {
      validationFailed(res, `${fieldName} items must be valid URLs`);
      return undefined;
    }
  }
  return urls;
}

submissionsRouter.post(
  "/stages/:stageId/groups/:groupId/submissions",
  requireAuth,
  parseSubmissionFileUpload,
  async (req: Request, res: Response) => {
    const stageId = parseBigIntParam(req.params.stageId, "stageId", res);
    if (stageId === null) return;
    const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
    if (groupId === null) return;

    const role = req.user!.role as Role;
    if (role !== Role.student) {
      return forbidden(res, "Only students can submit stage work");
    }

    const group = await getGroupAccess(groupId, req.user!.id, role, res);
    if (!group) return;

    const stage = await prisma.assignmentStage.findUnique({
      where: { id: stageId },
      select: {
        id: true,
        assignmentId: true,
        status: true,
        dueAt: true,
        assignment: { select: { status: true, courseId: true } },
      },
    });

    if (!stage) {
      return fail(res, 404, "NOT_FOUND", "Stage not found");
    }

    if (stage.assignment.status === AssignmentStatus.draft) {
      return forbidden(res, "Cannot submit work for a draft assignment");
    }

    if (stage.status !== StageStatus.open) {
      return conflict(res, "Stage is not open for submission");
    }

    if (stage.dueAt && stage.dueAt.getTime() <= Date.now()) {
      return conflict(res, "Stage dueAt has passed; submission is closed");
    }

    if (stage.assignmentId !== group.assignmentId) {
      return conflict(res, "Stage and group are not in the same assignment");
    }

    const title = parseSingleString(req.body?.title);
    if (!title) {
      return validationFailed(res, "title is required");
    }
    if (title.length > 100) {
      return validationFailed(res, "title must be at most 100 characters");
    }

    const description = parseOptionalText(req.body?.description, "description", 3000, res);
    if (req.body?.description !== undefined && description === undefined) return;

    const contributionNote = parseOptionalText(req.body?.contributionNote, "contributionNote", 3000, res);
    if (req.body?.contributionNote !== undefined && contributionNote === undefined) return;

    const fileIds = parseStringArray(req.body?.fileIds, "fileIds", 20, res);
    if (req.body?.fileIds !== undefined && fileIds === undefined) return;

    const links = parseUrlArray(req.body?.links, "links", 10, res);
    if (req.body?.links !== undefined && links === undefined) return;

    const repositoryUrl = parseOptionalUrl(req.body?.repositoryUrl, "repositoryUrl", res);
    if (req.body?.repositoryUrl !== undefined && repositoryUrl === undefined) return;

    const latestSubmission = await prisma.submission.findFirst({
      where: { groupId, stageId },
      orderBy: { attemptNo: "desc" },
      select: {
        id: true,
        groupId: true,
        stageId: true,
        attemptNo: true,
        status: true,
        createdAt: true,
        submittedAt: true,
        submittedBy: true,
        createdBy: true,
      },
    });

    const idempotencyKey = parseIdempotencyKey(req);
    const idemStoreKey = idempotencyKey
      ? `idem:submission:create:${req.user!.id}:${stageId.toString()}:${groupId.toString()}:${idempotencyKey}`
      : null;
    if (idemStoreKey) {
      const cached = await getIdempotentResponse<Record<string, unknown>>(idemStoreKey);
      if (cached) {
        return ok(res, cached);
      }
    }

    if (latestSubmission) {
      const allowed = canCreateSubmissionAttempt(latestSubmission.status);
      if (!allowed.ok) {
        return conflict(res, allowed.message);
      }
    }

    const attemptNo = latestSubmission ? latestSubmission.attemptNo + 1 : 1;
    const nextStatus = SubmissionStatus.submitted;

    const payload: Record<string, unknown> = { title };
    if (description !== null && description !== undefined) payload.description = description;
    if (fileIds !== undefined) payload.fileIds = fileIds;
    if (links !== undefined) payload.links = links;
    if (repositoryUrl !== null && repositoryUrl !== undefined) payload.repositoryUrl = repositoryUrl;
    if (contributionNote !== null && contributionNote !== undefined) payload.contributionNote = contributionNote;

    const summary = contributionNote ?? description ?? title;
    const submittedAt = new Date();

    const files = Array.isArray(req.files) ? req.files : [];
    const uploadedFiles: Array<Awaited<ReturnType<typeof uploadSubmissionFile>>> = [];
    const previousFileObjects = latestSubmission
      ? await prisma.submissionFile.findMany({
          where: { submissionId: latestSubmission.id },
          select: { objectKey: true },
        })
      : [];

    try {
      for (const file of files) {
        uploadedFiles.push(
          await uploadSubmissionFile({
            courseId: stage.assignment.courseId,
            assignmentId: stage.assignmentId,
            stageId,
            groupId,
            file,
          }),
        );
      }

      const submission = await prisma.$transaction(async (tx) => {
        if (latestSubmission) {
          await tx.submissionFile.deleteMany({ where: { submissionId: latestSubmission.id } });
        }

        const created = await tx.submission.create({
          data: {
            groupId,
            stageId,
            attemptNo,
            status: nextStatus,
            summary,
            payload: payload as Prisma.InputJsonValue,
            submittedAt,
            createdBy: req.user!.id,
            submittedBy: req.user!.id,
          },
          select: {
            id: true,
            groupId: true,
            stageId: true,
            status: true,
            submittedBy: true,
            submittedAt: true,
          },
        });

        if (uploadedFiles.length > 0) {
          await tx.submissionFile.createMany({
            data: uploadedFiles.map((file) => ({
              submissionId: created.id,
              objectKey: file.objectKey,
              name: file.name,
              size: file.size,
              mimeType: file.mimeType,
              slotKey: null,
              uploadedBy: req.user!.id,
              uploadedAt: new Date(file.uploadedAt),
            })),
          });
        }

        return created;
      });

      if (previousFileObjects.length > 0) {
        await Promise.all(previousFileObjects.map((file) => removeSubmissionFileObject(file.objectKey)));
      }

      const submissionEvent = createEventEnvelope("submission.created", {
        submissionId: submission.id.toString(),
        stageId: stageId.toString(),
        groupId: groupId.toString(),
        courseId: stage.assignment.courseId.toString(),
        status: submission.status,
        submittedBy: submission.submittedBy,
      });
      await pushSocketEvent(`course:${stage.assignment.courseId.toString()}`, submissionEvent);

      const responseData = serializeBigInt({
        ...submission,
        attemptNo,
        replacedSubmissionId: latestSubmission ? latestSubmission.id : null,
      });
      if (idemStoreKey) {
        await saveIdempotentResponse(idemStoreKey, responseData);
      }
      return ok(res, responseData);
    } catch (error) {
      if (uploadedFiles.length > 0) {
        await Promise.all(uploadedFiles.map((file) => removeSubmissionFileObject(file.objectKey)));
      }
      throw error;
    }
  },
);

submissionsRouter.get(
  "/stages/:stageId/groups/:groupId/submissions",
  requireAuth,
  async (req: Request, res: Response) => {
    const stageId = parseBigIntParam(req.params.stageId, "stageId", res);
    if (stageId === null) return;
    const groupId = parseBigIntParam(req.params.groupId, "groupId", res);
    if (groupId === null) return;

    const role = req.user!.role as Role;
    const group = await getGroupAccess(groupId, req.user!.id, role, res);
    if (!group) return;

    const stage = await prisma.assignmentStage.findUnique({
      where: { id: stageId },
      select: {
        id: true,
        assignmentId: true,
        status: true,
        assignment: { select: { status: true } },
      },
    });
    if (!stage) {
      return fail(res, 404, "NOT_FOUND", "Stage not found");
    }

    if (stage.assignmentId !== group.assignmentId) {
      return conflict(res, "Stage and group are not in the same assignment");
    }

    if (role === Role.student) {
      if (stage.assignment.status === AssignmentStatus.draft || stage.status === StageStatus.planned) {
        return forbidden(res, "Stage is not available for students");
      }
    }

    const submissions = await prisma.submission.findMany({
      where: { groupId, stageId },
      orderBy: { attemptNo: "desc" },
      select: {
        id: true,
        groupId: true,
        stageId: true,
        attemptNo: true,
        status: true,
        summary: true,
        payload: true,
        submittedAt: true,
        createdBy: true,
        submittedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok(res, serializeBigInt(submissions));
  },
);
