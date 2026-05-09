import { AssignmentStatus, Prisma, Role, StageStatus } from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../infra/prisma.js";
import { ensureCourseManageable, ensureCourseReadable } from "../courses/course-access.js";

export function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

export function forbidden(res: Response, message = "Insufficient permissions"): void {
  res.status(403).json({ ok: false, code: "FORBIDDEN", message });
}

export function notFound(res: Response, message = "Assignment not found"): void {
  res.status(404).json({ ok: false, code: "NOT_FOUND", message });
}

export function validationFailed(res: Response, message: string): void {
  res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message });
}

export function conflict(res: Response, message: string): void {
  res.status(409).json({ ok: false, code: "CONFLICT", message });
}

export function parseBigIntParam(rawValue: string | string[] | undefined, fieldName: string, res: Response): bigint | null {
  if (Array.isArray(rawValue) || typeof rawValue !== "string" || !/^\d+$/.test(rawValue)) {
    validationFailed(res, `${fieldName} must be a positive integer string`);
    return null;
  }

  try {
    return BigInt(rawValue);
  } catch {
    validationFailed(res, `${fieldName} is invalid`);
    return null;
  }
}

export function parseSingleString(rawValue: unknown): string | null {
  return typeof rawValue === "string" && rawValue.trim() !== "" ? rawValue.trim() : null;
}

export function parseAssignmentStatus(value: unknown): AssignmentStatus | null {
  return typeof value === "string" && Object.values(AssignmentStatus).includes(value as AssignmentStatus)
    ? (value as AssignmentStatus)
    : null;
}

export function canTransitionAssignmentStatus(current: AssignmentStatus, next: AssignmentStatus): boolean {
  if (current === next) return true;
  if (current === AssignmentStatus.draft) {
    return next === AssignmentStatus.active || next === AssignmentStatus.archived;
  }
  if (current === AssignmentStatus.active) {
    return next === AssignmentStatus.archived;
  }
  return false;
}

export function parseDateTimeInput(rawValue: unknown, fieldName: string, res: Response): Date | null | undefined {
  if (rawValue === undefined) {
    return undefined;
  }
  if (rawValue === null) {
    return null;
  }
  if (typeof rawValue !== "string") {
    validationFailed(res, `${fieldName} must be an ISO 8601 string or null`);
    return undefined;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    validationFailed(res, `${fieldName} must be a valid ISO 8601 datetime string`);
    return undefined;
  }

  return parsed;
}

export function parseWeightInput(rawValue: unknown, res: Response): Prisma.Decimal | null | undefined {
  if (rawValue === undefined) {
    return undefined;
  }
  if (rawValue === null) {
    return null;
  }
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue < 0 || rawValue > 100) {
    validationFailed(res, "weight must be a number between 0 and 100");
    return undefined;
  }
  return new Prisma.Decimal(rawValue);
}

export function canTransitionStageStatus(current: StageStatus, next: StageStatus): boolean {
  if (current === next) return true;
  if (current === StageStatus.planned) {
    return next === StageStatus.open || next === StageStatus.archived;
  }
  if (current === StageStatus.open) {
    return next === StageStatus.closed || next === StageStatus.archived;
  }
  if (current === StageStatus.closed) {
    return next === StageStatus.archived;
  }
  return false;
}

export function validateStageWindow(startAt: Date | null | undefined, dueAt: Date | null | undefined, res: Response): boolean {
  if (startAt instanceof Date && dueAt instanceof Date && startAt.getTime() >= dueAt.getTime()) {
    validationFailed(res, "startAt must be earlier than dueAt");
    return false;
  }
  return true;
}

export function validateStageDueAtState(
  dueAt: Date | null | undefined,
  status: StageStatus,
  res: Response,
): boolean {
  if (
    dueAt instanceof Date &&
    dueAt.getTime() <= Date.now() &&
    status !== StageStatus.closed &&
    status !== StageStatus.archived
  ) {
    validationFailed(res, "dueAt must be later than now unless the stage is closed or archived");
    return false;
  }
  return true;
}

export async function getCourseWriteAccess(courseId: bigint, userId: string, role: Role, res: Response): Promise<boolean> {
  const course = await ensureCourseManageable(
    courseId,
    userId,
    role,
    res,
    "Only academic staff or course teachers can manage assignments",
  );
  return Boolean(course);
}

export async function getCourseReadAccess(courseId: bigint, userId: string, role: Role, res: Response): Promise<boolean> {
  const course = await ensureCourseReadable(courseId, userId, role, res);
  return Boolean(course);
}

export type AssignmentViewRecord = {
  id: bigint;
  courseId: bigint;
  title: string;
  description: string | null;
  descriptionFiles: Prisma.JsonValue | null;
  status: AssignmentStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAssignmentAccess(
  assignmentId: bigint,
  userId: string,
  role: Role,
  res: Response,
): Promise<AssignmentViewRecord | null> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
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

  if (!assignment) {
    notFound(res);
    return null;
  }

  if (!(await getCourseReadAccess(assignment.courseId, userId, role, res))) {
    return null;
  }

  if (role === Role.student && assignment.status === AssignmentStatus.draft) {
    forbidden(res);
    return null;
  }

  return assignment;
}

export type AssignmentWriteRecord = {
  id: bigint;
  courseId: bigint;
  title: string;
  description: string | null;
  descriptionFiles: Prisma.JsonValue | null;
  status: AssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAssignmentWriteAccess(
  assignmentId: bigint,
  userId: string,
  role: Role,
  res: Response,
): Promise<AssignmentWriteRecord | null> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      descriptionFiles: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!assignment) {
    notFound(res);
    return null;
  }
  if (!(await getCourseWriteAccess(assignment.courseId, userId, role, res))) {
    return null;
  }
  return assignment;
}

export type StageReadRecord = {
  id: bigint;
  assignmentId: bigint;
  stageNo: number;
  title: string;
  description: string | null;
  startAt: Date | null;
  dueAt: Date | null;
  weight: Prisma.Decimal | null;
  submissionDesc: string | null;
  requirementFiles: Prisma.JsonValue | null;
  acceptCriteria: string | null;
  status: StageStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  assignment: {
    courseId: bigint;
    status: AssignmentStatus;
  };
};

export async function getStageReadAccess(
  stageId: bigint,
  userId: string,
  role: Role,
  res: Response,
): Promise<StageReadRecord | null> {
  const stage = await prisma.assignmentStage.findUnique({
    where: { id: stageId },
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
      assignment: {
        select: {
          courseId: true,
          status: true,
        },
      },
    },
  });

  if (!stage) {
    notFound(res, "Stage not found");
    return null;
  }

  if (!(await getCourseReadAccess(stage.assignment.courseId, userId, role, res))) {
    return null;
  }
  if (role === Role.student && (stage.assignment.status === AssignmentStatus.draft || stage.status === StageStatus.planned)) {
    forbidden(res);
    return null;
  }

  return stage;
}

export type StageWriteRecord = StageReadRecord & {
  _count: {
    miniTasks: number;
  };
};

export async function getStageWriteAccess(
  stageId: bigint,
  userId: string,
  role: Role,
  res: Response,
): Promise<StageWriteRecord | null> {
  const stage = await prisma.assignmentStage.findUnique({
    where: { id: stageId },
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
      assignment: {
        select: {
          courseId: true,
          status: true,
        },
      },
      _count: {
        select: {
          miniTasks: true,
        },
      },
    },
  });

  if (!stage) {
    notFound(res, "Stage not found");
    return null;
  }

  if (!(await getCourseWriteAccess(stage.assignment.courseId, userId, role, res))) {
    return null;
  }

  if (stage.assignment.status === AssignmentStatus.archived) {
    conflict(res, "Archived assignments are read-only");
    return null;
  }

  return stage;
}
