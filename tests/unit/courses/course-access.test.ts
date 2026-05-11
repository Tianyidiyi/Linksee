import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import {
  courseForbidden,
  courseNotFound,
  ensureCourseExists,
  ensureCourseManageable,
  ensureCourseReadable,
  getCourseTeacherRecord,
} from "../../../apps/api/src/courses/course-access.js";

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

describe("course-access", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("courseNotFound/courseForbidden should write expected response", () => {
    const a = createRes();
    courseNotFound(a.res);
    expect(a.state.status).toBe(404);

    const b = createRes();
    courseForbidden(b.res, "nope");
    expect(b.state.status).toBe(403);
  });

  it("ensureCourseExists should return false when course missing", async () => {
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue(null as any);
    const { res, state } = createRes();
    await expect(ensureCourseExists(1n, res)).resolves.toBe(false);
    expect(state.status).toBe(404);
  });

  it("ensureCourseExists should return true when found", async () => {
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    const { res } = createRes();
    await expect(ensureCourseExists(1n, res)).resolves.toBe(true);
  });

  it("getCourseTeacherRecord should query composite key", async () => {
    const spy = jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({} as any);
    await getCourseTeacherRecord(2n, "u1");
    expect(spy).toHaveBeenCalled();
  });

  it("ensureCourseReadable: academic can read existing course", async () => {
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    const { res } = createRes();
    const result = await ensureCourseReadable(1n, "u1", "academic" as any, res);
    expect(result).toEqual({ id: 1n });
  });

  it("ensureCourseReadable: teacher forbidden when neither teacher nor assistant", async () => {
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue(null as any);
    jest.spyOn(prisma.assistantBinding, "findUnique").mockResolvedValue(null as any);
    const { res, state } = createRes();
    const result = await ensureCourseReadable(1n, "u2", "teacher" as any, res);
    expect(result).toBeNull();
    expect(state.status).toBe(403);
  });

  it("ensureCourseReadable: assistant can read when bound", async () => {
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue(null as any);
    jest.spyOn(prisma.assistantBinding, "findUnique").mockResolvedValue({ courseId: 1n } as any);
    const { res } = createRes();
    const result = await ensureCourseReadable(1n, "a1", "assistant" as any, res);
    expect(result).toEqual({ id: 1n });
  });

  it("ensureCourseReadable: teacher can read directly when teacher record exists", async () => {
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    const teacherSpy = jest.spyOn(prisma.courseTeacher, "findUnique").mockResolvedValue({ courseId: 1n } as any);
    const assistantSpy = jest.spyOn(prisma.assistantBinding, "findUnique").mockResolvedValue(null as any);
    const { res } = createRes();
    const result = await ensureCourseReadable(1n, "t1", "teacher" as any, res);
    expect(result).toEqual({ id: 1n });
    expect(teacherSpy).toHaveBeenCalled();
    expect(assistantSpy).not.toHaveBeenCalled();
  });

  it("ensureCourseReadable: student forbidden for missing/withdrawn membership", async () => {
    jest.spyOn(prisma.course, "findUnique").mockResolvedValue({ id: 1n } as any);
    const memberSpy = jest.spyOn(prisma.courseMember, "findUnique");

    memberSpy.mockResolvedValueOnce(null as any);
    const c1 = createRes();
    expect(await ensureCourseReadable(1n, "s1", "student" as any, c1.res)).toBeNull();
    expect(c1.state.status).toBe(403);

    memberSpy.mockResolvedValueOnce({ status: "withdrawn" } as any);
    const c2 = createRes();
    expect(await ensureCourseReadable(1n, "s1", "student" as any, c2.res)).toBeNull();
    expect(c2.state.status).toBe(403);
  });

  it("ensureCourseManageable: role and teacher-record checks", async () => {
    const courseSpy = jest.spyOn(prisma.course, "findUnique");
    courseSpy.mockResolvedValueOnce(null as any);
    const c0 = createRes();
    expect(await ensureCourseManageable(1n, "u1", "academic" as any, c0.res)).toBeNull();
    expect(c0.state.status).toBe(404);

    courseSpy.mockResolvedValue({ id: 1n } as any);
    const c1 = createRes();
    expect(await ensureCourseManageable(1n, "u1", "academic" as any, c1.res)).toEqual({ id: 1n });

    const c2 = createRes();
    expect(await ensureCourseManageable(1n, "u1", "assistant" as any, c2.res, "x")).toBeNull();
    expect(c2.state.status).toBe(403);

    const teacherSpy = jest.spyOn(prisma.courseTeacher, "findUnique");
    teacherSpy.mockResolvedValueOnce(null as any);
    const c3 = createRes();
    expect(await ensureCourseManageable(1n, "t1", "teacher" as any, c3.res, "x")).toBeNull();
    expect(c3.state.status).toBe(403);

    teacherSpy.mockResolvedValueOnce({ courseId: 1n } as any);
    const c4 = createRes();
    expect(await ensureCourseManageable(1n, "t1", "teacher" as any, c4.res)).toEqual({ id: 1n });
  });
});
