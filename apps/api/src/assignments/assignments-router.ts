import { AssignmentStatus, Prisma, Role, StageStatus } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../infra/jwt-middleware.js";
import { prisma } from "../infra/prisma.js";
import { parseIdempotencyKey, parseLimitOffset } from "../infra/request-utils.js";
import { fail, ok } from "../infra/http-response.js";
import {
  canTransitionAssignmentStatus,
  conflict,
  getAssignmentAccess,
  getAssignmentWriteAccess,
  getCourseReadAccess,
  getCourseWriteAccess,
  parseAssignmentStatus,
  parseBigIntParam,
  parseSingleString,
  serializeBigInt,
  validationFailed,
  forbidden,
  notFound,
} from "./assignment-access.js";
import {
  normalizeStoredFiles,
  parseCourseMaterialUpload,
  removeCourseMaterialObject,
  uploadCourseMaterialFile,
  withCourseMaterialUrls,
  type PublicStoredFileMetadata,
} from "./course-material-storage.js";

export const assignmentsRouter = Router();

function serializeAssignmentRecord<T extends { descriptionFiles: Prisma.JsonValue | null }>(
  record: T,
): Omit<T, "descriptionFiles"> & { descriptionFiles: PublicStoredFileMetadata[] } {
  const serialized = serializeBigInt(record) as T;
  const { descriptionFiles: _descriptionFiles, ...rest } = serialized;
  return {
    ...(rest as Omit<T, "descriptionFiles">),
    descriptionFiles: withCourseMaterialUrls(normalizeStoredFiles(record.descriptionFiles)),
  };
}

assignmentsRouter.post("/courses/:courseId/assignments", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;
  const idempotencyKey = parseIdempotencyKey(req);

  const role = req.user!.role as Role;
  const userId = req.user!.id;
  if (!(await getCourseWriteAccess(courseId, userId, role, res))) return;

  const title = parseSingleString(req.body?.title);
  if (!title) {
    return validationFailed(res, "title is required");
  }

  if (idempotencyKey) {
    const existing = await prisma.assignment.findFirst({
      where: { courseId, title, createdBy: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        courseId: true,
        title: true,
        description: true,
        descriptionFiles: true,
        status: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (existing) {
      return ok(res, serializeAssignmentRecord(existing), 201);
    }
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

  const status =
    req.body?.status === undefined ? AssignmentStatus.draft : parseAssignmentStatus(req.body.status);
  if (!status) {
    return validationFailed(res, "status must be draft, active or archived");
  }

  const assignment = await prisma.assignment.create({
    data: {
      courseId,
      title,
      description,
      descriptionFiles: [] as Prisma.InputJsonValue,
      status,
      createdBy: userId,
    },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      descriptionFiles: true,
      status: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  ok(res, serializeAssignmentRecord(assignment), 201);
});

assignmentsRouter.get("/courses/:courseId/assignments", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseBigIntParam(req.params.courseId, "courseId", res);
  if (courseId === null) return;
  const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>);

  const role = req.user!.role as Role;
  const userId = req.user!.id;
  if (!(await getCourseReadAccess(courseId, userId, role, res))) return;

  const where: Prisma.AssignmentWhereInput = { courseId };
  const statusFilter =
    req.query.status === undefined ? null : parseAssignmentStatus(req.query.status as string | undefined);

  if (req.query.status !== undefined && !statusFilter) {
    return validationFailed(res, "status must be draft, active or archived");
  }

  if (statusFilter) {
    if (role === Role.student && statusFilter === AssignmentStatus.draft) {
      return forbidden(res);
    }
    where.status = statusFilter;
  } else if (role === Role.student) {
    where.status = { in: [AssignmentStatus.active, AssignmentStatus.archived] };
  }

  const [assignments, total] = await prisma.$transaction([
    prisma.assignment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        courseId: true,
        title: true,
        description: true,
        descriptionFiles: true,
        status: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.assignment.count({ where }),
  ]);

  res.json({
    ok: true,
    data: assignments.map((assignment) => serializeAssignmentRecord(assignment)),
    paging: { limit, offset, total, hasMore: offset + assignments.length < total },
  });
});

assignmentsRouter.get("/assignments/:assignmentId", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const assignment = await getAssignmentAccess(assignmentId, req.user!.id, req.user!.role as Role, res);
  if (!assignment) return;

  res.json({ ok: true, data: serializeAssignmentRecord(assignment) });
});

assignmentsRouter.patch("/assignments/:assignmentId", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const assignment = await getAssignmentWriteAccess(assignmentId, req.user!.id, req.user!.role as Role, res);
  if (!assignment) return;

  const hasTitle = req.body?.title !== undefined;
  const hasDescription = req.body?.description !== undefined;
  const hasStatus = req.body?.status !== undefined;
  if (!hasTitle && !hasDescription && !hasStatus) {
    return validationFailed(res, "At least one of title, description or status is required");
  }

  const nextData: Prisma.AssignmentUpdateInput = {};

  if (hasTitle) {
    const title = parseSingleString(req.body.title);
    if (!title) {
      return validationFailed(res, "title must be a non-empty string");
    }
    if (assignment.status === AssignmentStatus.archived && title !== assignment.title) {
      return conflict(res, "Archived assignments are read-only");
    }
    nextData.title = title;
  }

  if (hasDescription) {
    if (req.body.description !== null && typeof req.body.description !== "string") {
      return validationFailed(res, "description must be a string or null");
    }
    if (assignment.status === AssignmentStatus.archived && req.body.description !== assignment.description) {
      return conflict(res, "Archived assignments are read-only");
    }
    nextData.description = req.body.description ?? null;
  }

  if (hasStatus) {
    const nextStatus = parseAssignmentStatus(req.body.status);
    if (!nextStatus) {
      return validationFailed(res, "status must be draft, active or archived");
    }
    if (!canTransitionAssignmentStatus(assignment.status, nextStatus)) {
      return conflict(res, `Invalid assignment status transition: ${assignment.status} -> ${nextStatus}`);
    }
    nextData.status = nextStatus;
  }

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: nextData,
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      descriptionFiles: true,
      status: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ ok: true, data: serializeAssignmentRecord(updated) });
});

assignmentsRouter.delete("/assignments/:assignmentId", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      courseId: true,
      status: true,
      descriptionFiles: true,
      _count: { select: { stages: true, groups: true } },
      groupConfig: { select: { assignmentId: true } },
    },
  });
  if (!assignment) {
    return notFound(res);
  }

  if (!(await getCourseWriteAccess(assignment.courseId, req.user!.id, req.user!.role as Role, res))) return;

  if (assignment.status !== AssignmentStatus.draft) {
    return conflict(res, "Only draft assignments can be deleted");
  }

  if (assignment._count.stages > 0 || assignment._count.groups > 0 || assignment.groupConfig) {
    return conflict(res, "Cannot delete assignment with existing stages, groups or grouping configuration");
  }

  const files = normalizeStoredFiles(assignment.descriptionFiles);

  await prisma.assignment.delete({
    where: { id: assignmentId },
  });

  await Promise.all(files.map((file) => removeCourseMaterialObject(file.objectKey)));

  res.json({ ok: true });
});

assignmentsRouter.post("/assignments/:assignmentId/status", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const assignment = await getAssignmentWriteAccess(assignmentId, req.user!.id, req.user!.role as Role, res);
  if (!assignment) return;

  const nextStatus = parseAssignmentStatus(req.body?.status);
  if (!nextStatus) {
    return validationFailed(res, "status must be draft, active or archived");
  }
  if (!canTransitionAssignmentStatus(assignment.status, nextStatus)) {
    return conflict(res, `Invalid assignment status transition: ${assignment.status} -> ${nextStatus}`);
  }

  if (nextStatus === AssignmentStatus.active) {
    const stageCount = await prisma.assignmentStage.count({ where: { assignmentId } });
    if (stageCount === 0) {
      return conflict(res, "Cannot activate assignment without at least one stage");
    }
  }

  if (nextStatus === AssignmentStatus.archived) {
    const openStageCount = await prisma.assignmentStage.count({
      where: {
        assignmentId,
        status: { in: [StageStatus.planned, StageStatus.open] },
      },
    });
    if (openStageCount > 0) {
      return conflict(res, "Cannot archive assignment while planned/open stages exist");
    }
  }

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: nextStatus },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      descriptionFiles: true,
      status: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok(res, serializeAssignmentRecord(updated));
});

assignmentsRouter.post(
  "/assignments/:assignmentId/materials",
  requireAuth,
  parseCourseMaterialUpload,
  async (req: Request, res: Response) => {
    const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
    if (assignmentId === null) return;

    const assignment = await getAssignmentWriteAccess(assignmentId, req.user!.id, req.user!.role as Role, res);
    if (!assignment) return;

    if (assignment.status === AssignmentStatus.archived) {
      return conflict(res, "Archived assignments are read-only");
    }

    if (!Array.isArray(req.files) || req.files.length === 0) {
      return validationFailed(res, "No files uploaded. Use multipart/form-data with field name 'files'");
    }

    const currentFiles = normalizeStoredFiles(assignment.descriptionFiles);
    const uploadedFiles = [];

    try {
      for (const file of req.files) {
        uploadedFiles.push(
          await uploadCourseMaterialFile({
            courseId: assignment.courseId,
            assignmentId: assignment.id,
            file,
          }),
        );
      }

      const nextFiles = [...currentFiles, ...uploadedFiles];
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { descriptionFiles: nextFiles as unknown as Prisma.InputJsonValue },
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

assignmentsRouter.delete("/assignments/:assignmentId/materials", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = parseBigIntParam(req.params.assignmentId, "assignmentId", res);
  if (assignmentId === null) return;

  const assignment = await getAssignmentWriteAccess(assignmentId, req.user!.id, req.user!.role as Role, res);
  if (!assignment) return;

  if (assignment.status === AssignmentStatus.archived) {
    return conflict(res, "Archived assignments are read-only");
  }

  const objectKey =
    parseSingleString(req.body?.objectKey) ??
    parseSingleString(req.query.objectKey as string | string[] | undefined);
  if (!objectKey) {
    return validationFailed(res, "objectKey is required");
  }

  const currentFiles = normalizeStoredFiles(assignment.descriptionFiles);
  const existingFile = currentFiles.find((file) => file.objectKey === objectKey);
  if (!existingFile) {
    return notFound(res, "Assignment material not found");
  }

  const nextFiles = currentFiles.filter((file) => file.objectKey !== objectKey);

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { descriptionFiles: nextFiles as unknown as Prisma.InputJsonValue },
  });

  await removeCourseMaterialObject(objectKey);

  res.json({ ok: true });
});
