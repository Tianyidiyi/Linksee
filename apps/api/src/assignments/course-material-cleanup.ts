import { AssignmentStatus, Prisma, StageStatus } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { normalizeStoredFiles, removeCourseMaterialObject, type StoredFileMetadata } from "./course-material-storage.js";
import { publishCourseSystemAnnouncement } from "./assignment-notifications.js";

const DAY_MS = 24 * 60 * 60 * 1000;

type CleanupPlan = {
  scope: "assignment" | "stage";
  id: bigint;
  courseId: bigint;
  title: string;
  files: StoredFileMetadata[];
};

export type CourseMaterialCleanupOptions = {
  now?: Date;
  retentionDays?: number;
  senderId?: string;
  dryRun?: boolean;
};

export type CourseMaterialCleanupResult = {
  assignments: number;
  stages: number;
  files: number;
  objectKeys: string[];
};

function resolveRetentionDays(input: number | undefined): number {
  if (input !== undefined) return Math.max(0, input);
  const raw = process.env.COURSE_MATERIAL_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === "") return 180;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 180;
}

function isOlderThanRetention(value: Date, cutoff: Date): boolean {
  return value.getTime() <= cutoff.getTime();
}

function uniqueObjectKeys(plans: CleanupPlan[]): string[] {
  return Array.from(new Set(plans.flatMap((plan) => plan.files.map((file) => file.objectKey))));
}

async function notifyCleanup(plans: CleanupPlan[], senderId: string | undefined): Promise<void> {
  if (!senderId) return;
  const byCourse = new Map<string, { courseId: bigint; assignmentCount: number; stageCount: number; fileCount: number }>();
  for (const plan of plans) {
    const key = plan.courseId.toString();
    const item = byCourse.get(key) ?? { courseId: plan.courseId, assignmentCount: 0, stageCount: 0, fileCount: 0 };
    if (plan.scope === "assignment") item.assignmentCount += 1;
    if (plan.scope === "stage") item.stageCount += 1;
    item.fileCount += plan.files.length;
    byCourse.set(key, item);
  }

  await Promise.all(
    Array.from(byCourse.values()).map((item) =>
      publishCourseSystemAnnouncement({
        courseId: item.courseId,
        senderId,
        content: `系统通知：已清理归档课程材料 ${item.fileCount} 个，涉及项目附件 ${item.assignmentCount} 处、阶段附件 ${item.stageCount} 处。`,
      }).catch(() => undefined),
    ),
  );
}

export async function cleanupArchivedCourseMaterials(
  options: CourseMaterialCleanupOptions = {},
): Promise<CourseMaterialCleanupResult> {
  const now = options.now ?? new Date();
  const retentionDays = resolveRetentionDays(options.retentionDays);
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);

  const archivedAssignments = await prisma.assignment.findMany({
    where: { status: AssignmentStatus.archived },
    select: {
      id: true,
      courseId: true,
      title: true,
      descriptionFiles: true,
      updatedAt: true,
    },
  });

  const stages = await prisma.assignmentStage.findMany({
    where: {
      OR: [
        { status: StageStatus.archived },
        { assignment: { status: AssignmentStatus.archived } },
      ],
    },
    select: {
      id: true,
      stageNo: true,
      title: true,
      requirementFiles: true,
      updatedAt: true,
      assignment: {
        select: {
          courseId: true,
          status: true,
          updatedAt: true,
        },
      },
    },
  });

  const assignmentPlans: CleanupPlan[] = archivedAssignments.flatMap((assignment) => {
    const files = normalizeStoredFiles(assignment.descriptionFiles);
    if (files.length === 0 || !isOlderThanRetention(assignment.updatedAt, cutoff)) return [];
    return [{
      scope: "assignment",
      id: assignment.id,
      courseId: assignment.courseId,
      title: assignment.title,
      files,
    }];
  });

  const stagePlans: CleanupPlan[] = stages.flatMap((stage) => {
    const files = normalizeStoredFiles(stage.requirementFiles);
    if (files.length === 0) return [];
    const archivedAt = stage.assignment.status === AssignmentStatus.archived ? stage.assignment.updatedAt : stage.updatedAt;
    if (!isOlderThanRetention(archivedAt, cutoff)) return [];
    return [{
      scope: "stage",
      id: stage.id,
      courseId: stage.assignment.courseId,
      title: `阶段 ${stage.stageNo} ${stage.title}`,
      files,
    }];
  });

  const plans = [...assignmentPlans, ...stagePlans];
  const objectKeys = uniqueObjectKeys(plans);
  if (plans.length === 0 || options.dryRun) {
    return {
      assignments: assignmentPlans.length,
      stages: stagePlans.length,
      files: objectKeys.length,
      objectKeys,
    };
  }

  await prisma.$transaction([
    ...assignmentPlans.map((plan) =>
      prisma.assignment.update({
        where: { id: plan.id },
        data: { descriptionFiles: [] as Prisma.InputJsonValue },
      }),
    ),
    ...stagePlans.map((plan) =>
      prisma.assignmentStage.update({
        where: { id: plan.id },
        data: { requirementFiles: [] as Prisma.InputJsonValue },
      }),
    ),
  ]);

  await Promise.all(objectKeys.map((objectKey) => removeCourseMaterialObject(objectKey)));
  await notifyCleanup(plans, options.senderId ?? process.env.COURSE_MATERIAL_CLEANUP_SENDER_ID);

  return {
    assignments: assignmentPlans.length,
    stages: stagePlans.length,
    files: objectKeys.length,
    objectKeys,
  };
}

if (process.argv[1] && process.argv[1].endsWith("course-material-cleanup.ts")) {
  cleanupArchivedCourseMaterials()
    .then((result) => {
      console.log(
        `[course-materials] cleaned ${result.files} files from ${result.assignments} assignments and ${result.stages} stages`,
      );
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error("[course-materials] cleanup failed", err);
      process.exit(1);
    });
}
