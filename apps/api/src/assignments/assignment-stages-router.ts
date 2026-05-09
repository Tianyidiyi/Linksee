import { AssignmentStatus, Prisma, Role, StageStatus } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import {
  canTransitionStageStatus,
  conflict,
  getAssignmentAccess,
  getAssignmentWriteAccess,
  getStageReadAccess,
  getStageWriteAccess,
  parseBigIntParam,
  parseDateTimeInput,
  parseSingleString,
  parseWeightInput,
  serializeBigInt,
  validateStageDueAtState,
  validateStageWindow,
  validationFailed,
} from "./assignment-access.js";
import {
  normalizeStoredFiles,
  parseCourseMaterialUpload,
  removeCourseMaterialObject,
  uploadCourseMaterialFile,
  withCourseMaterialUrls,
  type PublicStoredFileMetadata,
} from "./course-material-storage.js";

export const assignmentStagesRouter = Router();

function serializeStageRecord<T extends { requirementFiles: Prisma.JsonValue | null }>(
  record: T,
): Omit<T, "requirementFiles"> & { requirementFiles: PublicStoredFileMetadata[] } {
  const serialized = serializeBigInt(record) as T;
  const { requirementFiles: _requirementFiles, ...rest } = serialized;
  return {
    ...(rest as Omit<T, "requirementFiles">),
    requirementFiles: withCourseMaterialUrls(normalizeStoredFiles(record.requirementFiles)),
  };
}

assignmentStagesRouter.get("/assignments/:assignmentId/stages", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const assignment = await getAssignmentAccess(assignmentId, req.user!.id, req.user!.role as Role, res);
  if (!assignment) return;

  const where: Prisma.AssignmentStageWhereInput = { assignmentId };
  if (req.user!.role === Role.student) {
    where.status = { in: [StageStatus.open, StageStatus.closed, StageStatus.archived] };
  }

  const stages = await prisma.assignmentStage.findMany({
    where,
    orderBy: [{ stageNo: "asc" }],
    select: {
      id: true,
      assignmentId: true,
      stageNo: true,
      title: true,
      description: true,
      startAt: true,
      dueAt: true,
      weight: true,
      submissionDesc: true,
      requirementFiles: true,
      acceptCriteria: true,
      status: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ ok: true, data: stages.map((stage) => serializeStageRecord(stage)) });
});

assignmentStagesRouter.post("/assignments/:assignmentId/stages", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const assignment = await getAssignmentWriteAccess(assignmentId, req.user!.id, req.user!.role as Role, res);
  if (!assignment) return;
  if (assignment.status === AssignmentStatus.archived) {
    return conflict(res, "Archived assignments are read-only");
  }

  const title = parseSingleString(req.body?.title ?? req.body?.name);
  if (!title) {
    return validationFailed(res, "title is required");
  }

  const description =
    req.body?.description === undefined || req.body?.description === null
      ? null
      : typeof req.body.description === "string"
        ? req.body.description
        : null;
  if (req.body?.description !== undefined && req.body?.description !== null && description === null) {
    return validationFailed(res, "description must be a string or null");
  }

  const submissionDesc =
    req.body?.submissionDesc === undefined || req.body?.submissionDesc === null
      ? null
      : typeof req.body.submissionDesc === "string"
        ? req.body.submissionDesc
        : null;
  if (req.body?.submissionDesc !== undefined && req.body?.submissionDesc !== null && submissionDesc === null) {
    return validationFailed(res, "submissionDesc must be a string or null");
  }

  const acceptCriteria =
    req.body?.acceptCriteria === undefined || req.body?.acceptCriteria === null
      ? null
      : typeof req.body.acceptCriteria === "string"
        ? req.body.acceptCriteria
        : null;
  if (req.body?.acceptCriteria !== undefined && req.body?.acceptCriteria !== null && acceptCriteria === null) {
    return validationFailed(res, "acceptCriteria must be a string or null");
  }

  const startAt = parseDateTimeInput(req.body?.startAt, "startAt", res);
  if (req.body?.startAt !== undefined && startAt === undefined) return;
  if (req.body?.dueAt === undefined) {
    return validationFailed(res, "dueAt is required");
  }
  const dueAt = parseDateTimeInput(req.body?.dueAt, "dueAt", res);
  if (dueAt === undefined) return;
  if (dueAt === null) return validationFailed(res, "dueAt is required");
  if (dueAt.getTime() <= Date.now()) {
    return validationFailed(res, "dueAt must be later than now");
  }
  if (!validateStageWindow(startAt, dueAt, res)) return;

  const weight = parseWeightInput(req.body?.weight, res);
  if (req.body?.weight !== undefined && weight === undefined) return;

  const requestedStatus =
    req.body?.status === undefined ? StageStatus.planned : (req.body.status as StageStatus | undefined);
  if (!requestedStatus || !Object.values(StageStatus).includes(requestedStatus)) {
    return validationFailed(res, "status must be planned, open, closed or archived");
  }
  if (!canTransitionStageStatus(StageStatus.planned, requestedStatus)) {
    return conflict(res, `Invalid stage status transition: planned -> ${requestedStatus}`);
  }

  const maxStage = await prisma.assignmentStage.aggregate({
    where: { assignmentId },
    _max: { stageNo: true },
  });
  const stageNo = (maxStage._max.stageNo ?? 0) + 1;

  const stage = await prisma.assignmentStage.create({
    data: {
      assignmentId,
      stageNo,
      title,
      description,
      startAt,
      dueAt,
      weight: weight ?? null,
      submissionDesc,
      requirementFiles: [] as Prisma.InputJsonValue,
      acceptCriteria,
      status: requestedStatus,
      createdBy: req.user!.id,
    },
    select: {
      id: true,
      assignmentId: true,
      stageNo: true,
      title: true,
      description: true,
      startAt: true,
      dueAt: true,
      weight: true,
      submissionDesc: true,
      requirementFiles: true,
      acceptCriteria: true,
      status: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(201).json({ ok: true, data: serializeStageRecord(stage) });
});

assignmentStagesRouter.get("/stages/:stageId", requireAuth, async (req: Request, res: Response) => {
  const stageId = parseBigIntParam(req.params.stageId, "stageId", res);
  if (stageId === null) return;

  const stage = await getStageReadAccess(stageId, req.user!.id, req.user!.role as Role, res);
  if (!stage) return;

  res.json({ ok: true, data: serializeStageRecord(stage) });
});

assignmentStagesRouter.patch("/stages/:stageId", requireAuth, async (req: Request, res: Response) => {
  const stageId = parseBigIntParam(req.params.stageId, "stageId", res);
  if (stageId === null) return;

  const stage = await getStageWriteAccess(stageId, req.user!.id, req.user!.role as Role, res);
  if (!stage) return;
  if (stage.status === StageStatus.archived) {
    return conflict(res, "Archived stages are read-only");
  }

  const hasAnyField =
    req.body?.title !== undefined ||
    req.body?.name !== undefined ||
    req.body?.description !== undefined ||
    req.body?.startAt !== undefined ||
    req.body?.dueAt !== undefined ||
    req.body?.weight !== undefined ||
    req.body?.submissionDesc !== undefined ||
    req.body?.acceptCriteria !== undefined ||
    req.body?.status !== undefined;
  if (!hasAnyField) {
    return validationFailed(res, "At least one editable field is required");
  }

  const nextData: Prisma.AssignmentStageUpdateInput = {};

  if (req.body?.title !== undefined || req.body?.name !== undefined) {
    const title = parseSingleString(req.body?.title ?? req.body?.name);
    if (!title) {
      return validationFailed(res, "title must be a non-empty string");
    }
    nextData.title = title;
  }

  if (req.body?.description !== undefined) {
    if (req.body.description !== null && typeof req.body.description !== "string") {
      return validationFailed(res, "description must be a string or null");
    }
    nextData.description = req.body.description ?? null;
  }

  const startAt = parseDateTimeInput(req.body?.startAt, "startAt", res);
  if (req.body?.startAt !== undefined && startAt === undefined) return;
  const dueAt = parseDateTimeInput(req.body?.dueAt, "dueAt", res);
  if (req.body?.dueAt !== undefined && dueAt === undefined) return;

  const nextStartAt = req.body?.startAt !== undefined ? startAt : stage.startAt;
  const nextDueAt = req.body?.dueAt !== undefined ? dueAt : stage.dueAt;
  if (!validateStageWindow(nextStartAt, nextDueAt, res)) return;

  let nextStatus: StageStatus = stage.status;
  if (req.body?.status !== undefined) {
    const requestedStatus = req.body.status as StageStatus | undefined;
    if (!requestedStatus || !Object.values(StageStatus).includes(requestedStatus)) {
      return validationFailed(res, "status must be planned, open, closed or archived");
    }
    if (!canTransitionStageStatus(stage.status, requestedStatus)) {
      return conflict(res, `Invalid stage status transition: ${stage.status} -> ${requestedStatus}`);
    }
    nextStatus = requestedStatus;
  }

  if ((req.body?.dueAt !== undefined || req.body?.status !== undefined) && !validateStageDueAtState(nextDueAt, nextStatus, res)) {
    return;
  }

  if (req.body?.startAt !== undefined) {
    nextData.startAt = startAt;
  }
  if (req.body?.dueAt !== undefined) {
    nextData.dueAt = dueAt;
  }

  const weight = parseWeightInput(req.body?.weight, res);
  if (req.body?.weight !== undefined && weight === undefined) return;
  if (req.body?.weight !== undefined) {
    nextData.weight = weight;
  }

  if (req.body?.submissionDesc !== undefined) {
    if (req.body.submissionDesc !== null && typeof req.body.submissionDesc !== "string") {
      return validationFailed(res, "submissionDesc must be a string or null");
    }
    nextData.submissionDesc = req.body.submissionDesc ?? null;
  }

  if (req.body?.acceptCriteria !== undefined) {
    if (req.body.acceptCriteria !== null && typeof req.body.acceptCriteria !== "string") {
      return validationFailed(res, "acceptCriteria must be a string or null");
    }
    nextData.acceptCriteria = req.body.acceptCriteria ?? null;
  }

  if (req.body?.status !== undefined) {
    nextData.status = nextStatus;
  }

  const updated = await prisma.assignmentStage.update({
    where: { id: stageId },
    data: nextData,
    select: {
      id: true,
      assignmentId: true,
      stageNo: true,
      title: true,
      description: true,
      startAt: true,
      dueAt: true,
      weight: true,
      submissionDesc: true,
      requirementFiles: true,
      acceptCriteria: true,
      status: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ ok: true, data: serializeStageRecord(updated) });
});

assignmentStagesRouter.delete("/stages/:stageId", requireAuth, async (req: Request, res: Response) => {
  const stageId = parseBigIntParam(req.params.stageId, "stageId", res);
  if (stageId === null) return;

  const stage = await getStageWriteAccess(stageId, req.user!.id, req.user!.role as Role, res);
  if (!stage) return;

  if (stage.status !== StageStatus.archived) {
    await prisma.assignmentStage.update({
      where: { id: stageId },
      data: { status: StageStatus.archived },
    });
  }

  res.json({ ok: true });
});

assignmentStagesRouter.post(
  "/stages/:stageId/materials",
  requireAuth,
  parseCourseMaterialUpload,
  async (req: Request, res: Response) => {
    const stageId = parseBigIntParam(req.params.stageId, "stageId", res);
    if (stageId === null) return;

    const stage = await getStageWriteAccess(stageId, req.user!.id, req.user!.role as Role, res);
    if (!stage) return;
    if (stage.status === StageStatus.archived) {
      return conflict(res, "Archived stages are read-only");
    }

    if (!Array.isArray(req.files) || req.files.length === 0) {
      return validationFailed(res, "No files uploaded. Use multipart/form-data with field name 'files'");
    }

    const currentFiles = normalizeStoredFiles(stage.requirementFiles);
    const uploadedFiles = [];

    try {
      for (const file of req.files) {
        uploadedFiles.push(
          await uploadCourseMaterialFile({
            courseId: stage.assignment.courseId,
            assignmentId: stage.assignmentId,
            stageId: stage.id,
            file,
          }),
        );
      }

      const nextFiles = [...currentFiles, ...uploadedFiles];
      await prisma.assignmentStage.update({
        where: { id: stageId },
        data: { requirementFiles: nextFiles as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      await Promise.all(uploadedFiles.map((file) => removeCourseMaterialObject(file.objectKey)));
      throw error;
    }

    res.status(201).json({
      ok: true,
      data: {
        uploaded: withCourseMaterialUrls(uploadedFiles),
        total: currentFiles.length + uploadedFiles.length,
      },
    });
  },
);

assignmentStagesRouter.delete("/stages/:stageId/materials", requireAuth, async (req: Request, res: Response) => {
  const stageId = parseBigIntParam(req.params.stageId, "stageId", res);
  if (stageId === null) return;

  const stage = await getStageWriteAccess(stageId, req.user!.id, req.user!.role as Role, res);
  if (!stage) return;
  if (stage.status === StageStatus.archived) {
    return conflict(res, "Archived stages are read-only");
  }

  const objectKey =
    parseSingleString(req.body?.objectKey) ??
    parseSingleString(req.query.objectKey as string | string[] | undefined);
  if (!objectKey) {
    return validationFailed(res, "objectKey is required");
  }

  const currentFiles = normalizeStoredFiles(stage.requirementFiles);
  const existingFile = currentFiles.find((file) => file.objectKey === objectKey);
  if (!existingFile) {
    return validationFailed(res, "Stage material not found");
  }

  const nextFiles = currentFiles.filter((file) => file.objectKey !== objectKey);
  await prisma.assignmentStage.update({
    where: { id: stageId },
    data: { requirementFiles: nextFiles as unknown as Prisma.InputJsonValue },
  });

  await removeCourseMaterialObject(objectKey);

  res.json({ ok: true });
});
