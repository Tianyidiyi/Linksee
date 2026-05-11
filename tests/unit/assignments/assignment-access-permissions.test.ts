import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import {
  getAssignmentAccess,
  getAssignmentWriteAccess,
  getCourseReadAccess,
  getCourseWriteAccess,
  getStageReadAccess,
  getStageWriteAccess,
} from "../../../apps/api/src/assignments/assignment-access.js";

function createRes() {
  const state: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  };
  return { res: res as any, state };
}

describe("assignment-access permission paths", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("getCourseReadAccess/getCourseWriteAccess should follow role checks", async () => {
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({ courseId: 1n } as any);
    const r1 = createRes();
    await expect(getCourseReadAccess(1n, "t1", "teacher" as any, r1.res)).resolves.toBe(true);

    const r2 = createRes();
    await expect(getCourseWriteAccess(1n, "t1", "teacher" as any, r2.res)).resolves.toBe(true);

    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue(null as any);
    const r3 = createRes();
    await expect(getCourseWriteAccess(1n, "s1", "student" as any, r3.res)).resolves.toBe(false);
    expect(r3.state.status).toBe(403);
  });

  it("getAssignmentAccess should return 404 when assignment missing", async () => {
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue(null as any);
    const { res, state } = createRes();
    const result = await getAssignmentAccess(10n, "u1", "student" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(404);
  });

  it("getAssignmentAccess should block student reading draft assignment", async () => {
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({
      id: 10n,
      courseId: 1n,
      title: "A",
      description: null,
      descriptionFiles: null,
      status: "draft",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseMember, "findUnique").mockResolvedValue({ status: "active" } as any);
    const { res, state } = createRes();
    const result = await getAssignmentAccess(10n, "s1", "student" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("getAssignmentAccess should return null when course read access fails", async () => {
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({
      id: 12n,
      courseId: 99n,
      title: "A",
      description: null,
      descriptionFiles: null,
      status: "active",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue(null as any);
    const { res, state } = createRes();
    const result = await getAssignmentAccess(12n, "s1", "student" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(404);
  });

  it("getAssignmentAccess should allow non-student for draft assignment", async () => {
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({
      id: 10n,
      courseId: 1n,
      title: "A",
      description: null,
      descriptionFiles: null,
      status: "draft",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    const teacherSpy = jest.spyOn(prisma.courseTeacher, "findUnique");
    teacherSpy.mockResolvedValue({ courseId: 1n } as any);
    const { res } = createRes();
    const result = await getAssignmentAccess(10n, "t1", "teacher" as any, res);
    expect(result?.id).toBe(10n);
  });

  it("getAssignmentWriteAccess should return null when no write access", async () => {
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({
      id: 11n,
      courseId: 1n,
      title: "A",
      description: null,
      descriptionFiles: null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue(null as any);
    const { res, state } = createRes();
    const result = await getAssignmentWriteAccess(11n, "x1", "teacher" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("getAssignmentWriteAccess should return 404 when assignment missing and return record on success", async () => {
    const findAssignSpy = jest.spyOn(prisma.assignment, "findUnique");
    findAssignSpy.mockResolvedValueOnce(null as any);
    const c1 = createRes();
    expect(await getAssignmentWriteAccess(111n, "u1", "teacher" as any, c1.res)).toBeNull();
    expect(c1.state.status).toBe(404);

    findAssignSpy.mockResolvedValueOnce({
      id: 112n,
      courseId: 1n,
      title: "A",
      description: null,
      descriptionFiles: null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({ courseId: 1n } as any);
    const c2 = createRes();
    const result = await getAssignmentWriteAccess(112n, "t1", "teacher" as any, c2.res);
    expect(result?.id).toBe(112n);
  });

  it("getStageReadAccess should handle not found and student blocked stage", async () => {
    const findStageSpy = jest.spyOn(prisma.assignmentStage, "findUnique");
    findStageSpy.mockResolvedValueOnce(null as any);
    const c1 = createRes();
    expect(await getStageReadAccess(1n, "u1", "student" as any, c1.res)).toBeNull();
    expect(c1.state.status).toBe(404);

    findStageSpy.mockResolvedValueOnce({
      id: 2n,
      assignmentId: 1n,
      stageNo: 1,
      title: "S1",
      description: null,
      startAt: null,
      dueAt: null,
      weight: null,
      submissionDesc: null,
      requirementFiles: null,
      acceptCriteria: null,
      status: "planned",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 1n, status: "active" },
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseMember, "findUnique").mockResolvedValue({ status: "active" } as any);
    const c2 = createRes();
    expect(await getStageReadAccess(2n, "s1", "student" as any, c2.res)).toBeNull();
    expect(c2.state.status).toBe(403);
  });

  it("getStageReadAccess should return null when course read access fails and return stage on success", async () => {
    const findStageSpy = jest.spyOn(prisma.assignmentStage, "findUnique");
    findStageSpy.mockResolvedValueOnce({
      id: 21n,
      assignmentId: 1n,
      stageNo: 1,
      title: "S1",
      description: null,
      startAt: null,
      dueAt: null,
      weight: null,
      submissionDesc: null,
      requirementFiles: null,
      acceptCriteria: null,
      status: "open",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 1n, status: "active" },
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue(null as any);
    const c1 = createRes();
    expect(await getStageReadAccess(21n, "s1", "student" as any, c1.res)).toBeNull();
    expect(c1.state.status).toBe(404);

    findStageSpy.mockResolvedValueOnce({
      id: 22n,
      assignmentId: 1n,
      stageNo: 1,
      title: "S1",
      description: null,
      startAt: null,
      dueAt: null,
      weight: null,
      submissionDesc: null,
      requirementFiles: null,
      acceptCriteria: null,
      status: "open",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 1n, status: "active" },
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({ courseId: 1n } as any);
    const c2 = createRes();
    const result = await getStageReadAccess(22n, "t1", "teacher" as any, c2.res);
    expect(result?.id).toBe(22n);
  });

  it("getStageWriteAccess should block archived assignment and allow active", async () => {
    const findStageSpy = jest.spyOn(prisma.assignmentStage, "findUnique");
    findStageSpy.mockResolvedValueOnce({
      id: 3n,
      assignmentId: 1n,
      stageNo: 1,
      title: "S",
      description: null,
      startAt: null,
      dueAt: null,
      weight: null,
      submissionDesc: null,
      requirementFiles: null,
      acceptCriteria: null,
      status: "open",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 1n, status: "archived" },
      _count: { miniTasks: 0 },
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({ courseId: 1n } as any);
    const c1 = createRes();
    expect(await getStageWriteAccess(3n, "t1", "teacher" as any, c1.res)).toBeNull();
    expect(c1.state.status).toBe(409);

    findStageSpy.mockResolvedValueOnce({
      id: 4n,
      assignmentId: 1n,
      stageNo: 2,
      title: "S2",
      description: null,
      startAt: null,
      dueAt: null,
      weight: null,
      submissionDesc: null,
      requirementFiles: null,
      acceptCriteria: null,
      status: "open",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 1n, status: "active" },
      _count: { miniTasks: 0 },
    } as any);
    const c2 = createRes();
    const result = await getStageWriteAccess(4n, "t1", "teacher" as any, c2.res);
    expect(result?.id).toBe(4n);
  });

  it("getStageWriteAccess should return 404 when stage missing and null when no write access", async () => {
    const findStageSpy = jest.spyOn(prisma.assignmentStage, "findUnique");
    findStageSpy.mockResolvedValueOnce(null as any);
    const c1 = createRes();
    expect(await getStageWriteAccess(31n, "t1", "teacher" as any, c1.res)).toBeNull();
    expect(c1.state.status).toBe(404);

    findStageSpy.mockResolvedValueOnce({
      id: 32n,
      assignmentId: 1n,
      stageNo: 1,
      title: "S",
      description: null,
      startAt: null,
      dueAt: null,
      weight: null,
      submissionDesc: null,
      requirementFiles: null,
      acceptCriteria: null,
      status: "open",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 1n, status: "active" },
      _count: { miniTasks: 0 },
    } as any);
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue(null as any);
    const c2 = createRes();
    expect(await getStageWriteAccess(32n, "t1", "teacher" as any, c2.res)).toBeNull();
    expect(c2.state.status).toBe(403);
  });
});
