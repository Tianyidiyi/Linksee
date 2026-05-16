import { AssignmentStatus, Prisma, StageStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";

type StageRow = {
  id: bigint;
  assignmentId: bigint;
  assignment: { courseId: bigint };
};

export async function runSubmissionDeadlineJob(now = new Date()): Promise<{
  markedNotSubmitted: number;
  scannedStages: number;
  scannedGroups: number;
  skippedExisting: number;
}> {
  const runId = `deadline-${now.toISOString()}`;
  const dueStages = await prisma.assignmentStage.findMany({
    where: {
      dueAt: { lte: now },
      status: { in: [StageStatus.open, StageStatus.closed] },
      assignment: { status: { in: [AssignmentStatus.active, AssignmentStatus.archived] } },
    },
    select: {
      id: true,
      assignmentId: true,
      assignment: { select: { courseId: true } },
    },
  });

  let marked = 0;
  let scannedGroups = 0;
  let skippedExisting = 0;

  console.log(`[submission-deadline] start runId=${runId} stages=${dueStages.length}`);

  for (const stage of dueStages as StageRow[]) {
    const groups = await prisma.group.findMany({
      where: { assignmentId: stage.assignmentId, status: { in: ["forming", "active"] } },
      select: { id: true, createdBy: true },
    });
    scannedGroups += groups.length;
    if (groups.length === 0) continue;

    const existing = await prisma.submission.findMany({
      where: { stageId: stage.id, groupId: { in: groups.map((g) => g.id) } },
      select: { groupId: true },
    });
    const existingGroupIds = new Set(existing.map((row) => row.groupId.toString()));

    for (const group of groups) {
      if (existingGroupIds.has(group.id.toString())) {
        skippedExisting += 1;
        continue;
      }

      const created = await prisma.submission.create({
        data: {
          groupId: group.id,
          stageId: stage.id,
          attemptNo: 1,
          status: SubmissionStatus.not_submitted,
          summary: "AUTO_NOT_SUBMITTED",
          payload: Prisma.DbNull,
          submittedAt: null,
          createdBy: group.createdBy,
          submittedBy: null,
        },
        select: { id: true, groupId: true, stageId: true },
      });

      const statusEvent = createEventEnvelope("submission.status.updated", {
        submissionId: created.id.toString(),
        groupId: created.groupId.toString(),
        stageId: created.stageId.toString(),
        courseId: stage.assignment.courseId.toString(),
        status: SubmissionStatus.not_submitted,
      });
      await pushSocketEvent(`group:${created.groupId.toString()}`, statusEvent);
      await pushSocketEvent(`course:${stage.assignment.courseId.toString()}`, statusEvent);

      marked += 1;
    }
  }

  console.log(
    `[submission-deadline] finish runId=${runId} marked=${marked} scannedStages=${dueStages.length} scannedGroups=${scannedGroups} skippedExisting=${skippedExisting}`,
  );

  return {
    markedNotSubmitted: marked,
    scannedStages: dueStages.length,
    scannedGroups,
    skippedExisting,
  };
}

export async function runSubmissionDeadlineCli(
  runner: () => Promise<{
    markedNotSubmitted: number;
    scannedStages: number;
    scannedGroups: number;
    skippedExisting: number;
  }> = () => runSubmissionDeadlineJob(),
  io: {
    log: (message: string) => void;
    error: (message: string, err: unknown) => void;
    exit: (code: number) => void;
  } = {
    log: (message: string) => console.log(message),
    error: (message: string, err: unknown) => console.error(message, err),
    exit: (code: number) => {
      process.exit(code);
    },
  },
): Promise<void> {
  try {
    const result = await runner();
    io.log(
      `[submission-deadline] markedNotSubmitted=${result.markedNotSubmitted} scannedStages=${result.scannedStages} scannedGroups=${result.scannedGroups} skippedExisting=${result.skippedExisting}`,
    );
    io.exit(0);
  } catch (err: unknown) {
    io.error("[submission-deadline] failed", err);
    io.exit(1);
  }
}

export function runSubmissionDeadlineCliFromArgv(
  argv = process.argv,
  runCli: () => Promise<void>,
): void {
  if (argv[1] && argv[1].endsWith("submission-deadline-job.ts")) {
    void runCli();
  }
}
