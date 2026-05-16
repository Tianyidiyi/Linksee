import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";
import * as deadlineJob from "../../../apps/api/src/submissions/submission-deadline-job.js";

const { runSubmissionDeadlineCli, runSubmissionDeadlineJob, runSubmissionDeadlineCliFromArgv } = deadlineJob;

describe("submissions/submission-deadline-job", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("should return zero metrics when no due stages", async () => {
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([] as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const result = await runSubmissionDeadlineJob(new Date("2026-05-13T00:00:00.000Z"));
    expect(result).toEqual({
      markedNotSubmitted: 0,
      scannedStages: 0,
      scannedGroups: 0,
      skippedExisting: 0,
    });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("should mark not_submitted and publish events for missing submissions", async () => {
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([
      {
        id: 101n,
        assignmentId: 201n,
        assignment: { courseId: 301n },
      },
    ] as any);
    jest.spyOn(prisma.group, "findMany").mockResolvedValue([
      { id: 401n, createdBy: "u1" },
      { id: 402n, createdBy: "u2" },
    ] as any);
    jest.spyOn(prisma.submission, "findMany").mockResolvedValue([{ groupId: 401n }] as any);
    const createSpy = jest.spyOn(prisma.submission, "create").mockResolvedValue({
      id: 501n,
      groupId: 402n,
      stageId: 101n,
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const result = await runSubmissionDeadlineJob(new Date("2026-05-13T00:00:00.000Z"));
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      markedNotSubmitted: 1,
      scannedStages: 1,
      scannedGroups: 2,
      skippedExisting: 1,
    });
  });

  it("should skip stage when no groups in scope", async () => {
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([
      {
        id: 101n,
        assignmentId: 201n,
        assignment: { courseId: 301n },
      },
    ] as any);
    jest.spyOn(prisma.group, "findMany").mockResolvedValue([] as any);
    const findSubmissionSpy = jest.spyOn(prisma.submission, "findMany");
    const createSpy = jest.spyOn(prisma.submission, "create");

    const result = await runSubmissionDeadlineJob(new Date("2026-05-13T00:00:00.000Z"));
    expect(findSubmissionSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      markedNotSubmitted: 0,
      scannedStages: 1,
      scannedGroups: 0,
      skippedExisting: 0,
    });
  });

  it("cli should log summary and exit 0 on success", async () => {
    const log = jest.fn();
    const error = jest.fn();
    const exit = jest.fn();

    await runSubmissionDeadlineCli(
      async () => ({
        markedNotSubmitted: 2,
        scannedStages: 3,
        scannedGroups: 4,
        skippedExisting: 1,
      }),
      { log, error, exit },
    );

    expect(log).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("cli should log error and exit 1 on failure", async () => {
    const log = jest.fn();
    const error = jest.fn();
    const exit = jest.fn();
    const err = new Error("boom");

    await runSubmissionDeadlineCli(async () => {
      throw err;
    }, { log, error, exit });

    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("[submission-deadline] failed", err);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("cli should use default io when not provided", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as any);

    await runSubmissionDeadlineCli(async () => ({
      markedNotSubmitted: 0,
      scannedStages: 0,
      scannedGroups: 0,
      skippedExisting: 0,
    }));

    expect(logSpy).toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("cli should use default runner when runner is undefined", async () => {
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([] as any);
    const log = jest.fn();
    const error = jest.fn();
    const exit = jest.fn();

    await runSubmissionDeadlineCli(undefined as any, { log, error, exit });

    expect(log).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("cli should use default io error path when runner fails", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as any);
    const err = new Error("boom-default-io");

    await runSubmissionDeadlineCli(async () => {
      throw err;
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith("[submission-deadline] failed", err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("runSubmissionDeadlineCliFromArgv should trigger when argv matches", () => {
    let called = 0;
    const runCli = async () => {
      called += 1;
    };
    runSubmissionDeadlineCliFromArgv(["node", "/tmp/submission-deadline-job.ts"], runCli);
    expect(called).toBe(1);
  });

  it("runSubmissionDeadlineCliFromArgv should no-op when argv does not match", () => {
    let called = 0;
    const runCli = async () => {
      called += 1;
    };
    runSubmissionDeadlineCliFromArgv(["node", "/tmp/other.ts"], runCli);
    expect(called).toBe(0);
  });

  it("runSubmissionDeadlineCliFromArgv should no-op when argv[1] is missing", () => {
    let called = 0;
    const runCli = async () => {
      called += 1;
    };
    runSubmissionDeadlineCliFromArgv(["node"], runCli);
    expect(called).toBe(0);
  });

  it("runSubmissionDeadlineCliFromArgv should use default argv when argv is undefined", () => {
    const oldArgv1 = process.argv[1];
    process.argv[1] = "/tmp/other.ts";
    let called = 0;
    const runCli = async () => {
      called += 1;
    };
    runSubmissionDeadlineCliFromArgv(undefined as any, runCli);
    expect(called).toBe(0);
    process.argv[1] = oldArgv1;
  });

});
