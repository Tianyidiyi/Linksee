import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";
import {
  ensureAssignmentManageable,
  ensureCourseMemberActive,
  ensureGroupManageable,
  getGroupAccess,
} from "../../../apps/api/src/groups/group-access.js";

function createRes() {
  const state: { status?: number; body?: unknown } = {};
  const res: any = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  };
  return { res, state };
}

describe("groups/group-access", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("getGroupAccess should return not found when group missing", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue(null as any);
    const result = await getGroupAccess(1n, "u1", "student" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(404);
  });

  it("getGroupAccess should reject student without membership", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue(null as any);
    const result = await getGroupAccess(1n, "u1", "student" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("getGroupAccess should allow student with membership", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({ id: 9n } as any);
    const result = await getGroupAccess(1n, "u1", "student" as any, res);
    expect(result?.groupNo).toBe(3);
  });

  it("getGroupAccess should allow non-student via ensureCourseReadable", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 4n } as any);
    const result = await getGroupAccess(1n, "t1", "teacher" as any, res);
    expect(result?.courseId).toBe(4n);
  });

  it("getGroupAccess should return null when ensureCourseReadable rejects access", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue(null as any);
    const result = await getGroupAccess(1n, "t1", "teacher" as any, res);
    expect(result).toBeNull();
  });

  it("ensureGroupManageable should allow academic", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    const result = await ensureGroupManageable(1n, "a1", "academic" as any, res);
    expect(result?.id).toBe(1n);
  });

  it("ensureGroupManageable should return not found when group missing", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue(null as any);
    const result = await ensureGroupManageable(1n, "a1", "academic" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(404);
  });

  it("ensureGroupManageable should reject teacher without binding", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue(null as any);
    const result = await ensureGroupManageable(1n, "t1", "teacher" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("ensureGroupManageable should allow teacher with binding", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({ courseId: 4n } as any);
    const result = await ensureGroupManageable(1n, "t1", "teacher" as any, res);
    expect(result?.groupNo).toBe(3);
  });

  it("ensureGroupManageable should allow assistant with binding", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    jest.spyOn(prisma.assistantBinding, "findUnique").mockResolvedValue({ courseId: 4n } as any);
    const result = await ensureGroupManageable(1n, "as1", "assistant" as any, res);
    expect(result?.id).toBe(1n);
  });

  it("ensureGroupManageable should reject assistant without binding", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    jest.spyOn(prisma.assistantBinding, "findUnique").mockResolvedValue(null as any);
    const result = await ensureGroupManageable(1n, "as1", "assistant" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("ensureGroupManageable should reject unsupported roles", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 1n,
      assignmentId: 2n,
      groupNo: 3,
      assignment: { courseId: 4n },
    } as any);
    const result = await ensureGroupManageable(1n, "x1", "student" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("ensureAssignmentManageable should allow assistant with binding", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({ id: 1n, courseId: 2n } as any);
    jest.spyOn(prisma.assistantBinding, "findUnique").mockResolvedValue({ courseId: 2n } as any);
    const result = await ensureAssignmentManageable(1n, "as1", "assistant" as any, res);
    expect(result?.courseId).toBe(2n);
  });

  it("ensureAssignmentManageable should allow academic", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({ id: 1n, courseId: 2n } as any);
    const result = await ensureAssignmentManageable(1n, "ac1", "academic" as any, res);
    expect(result?.id).toBe(1n);
  });

  it("ensureAssignmentManageable should allow teacher with binding", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({ id: 1n, courseId: 2n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({ courseId: 2n } as any);
    const result = await ensureAssignmentManageable(1n, "t1", "teacher" as any, res);
    expect(result?.courseId).toBe(2n);
  });

  it("ensureAssignmentManageable should return not found when assignment missing", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue(null as any);
    const result = await ensureAssignmentManageable(1n, "u1", "teacher" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(404);
  });

  it("ensureAssignmentManageable should reject teacher without course binding", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({ id: 1n, courseId: 2n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue(null as any);
    const result = await ensureAssignmentManageable(1n, "t1", "teacher" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("ensureAssignmentManageable should reject assistant without binding", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({ id: 1n, courseId: 2n } as any);
    jest.spyOn(prisma.assistantBinding, "findUnique").mockResolvedValue(null as any);
    const result = await ensureAssignmentManageable(1n, "a1", "assistant" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("ensureAssignmentManageable should reject non-staff role", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({ id: 1n, courseId: 2n } as any);
    const result = await ensureAssignmentManageable(1n, "s1", "student" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("ensureCourseMemberActive should return false for withdrawn or missing", async () => {
    const { res, state } = createRes();
    jest.spyOn(prisma.courseMember, "findUnique").mockResolvedValue({ status: "withdrawn" } as any);
    await expect(ensureCourseMemberActive(1n, "u1", res)).resolves.toBe(false);
    expect(state.status).toBe(403);
  });

  it("ensureCourseMemberActive should return true for active member", async () => {
    const { res } = createRes();
    jest.spyOn(prisma.courseMember, "findUnique").mockResolvedValue({ status: "active" } as any);
    await expect(ensureCourseMemberActive(1n, "u1", res)).resolves.toBe(true);
  });
});
