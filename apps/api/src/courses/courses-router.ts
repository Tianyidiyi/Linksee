import { Router, type Request, type Response } from "express";
import { Role, CourseStatus, CourseTeacherRole, CourseMemberStatus } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";
import {
  ensureCourseExists as ensureCourseExistsShared,
  ensureCourseReadable as ensureCourseReadableShared,
  getCourseTeacherRecord as getCourseTeacherRecordShared,
} from "./course-access.js";

export const coursesRouter = Router();

// BigInt → string 序列化（JSON 不原生支持 BigInt）
function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

function notFound(res: Response): void {
  res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Course not found" });
}

function forbidden(res: Response): void {
  res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Insufficient permissions" });
}

function validationFailed(res: Response, message: string): void {
  res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message });
}

function parseCourseId(rawValue: string | string[] | undefined, res: Response): bigint | null {
  if (Array.isArray(rawValue) || typeof rawValue !== "string") {
    validationFailed(res, "courseId must be a positive integer string");
    return null;
  }

  if (!/^\d+$/.test(rawValue)) {
    validationFailed(res, "courseId must be a positive integer string");
    return null;
  }

  try {
    return BigInt(rawValue);
  } catch {
    validationFailed(res, "courseId is invalid");
    return null;
  }
}

function parseRequiredParam(rawValue: string | string[] | undefined, fieldName: string, res: Response): string | null {
  if (Array.isArray(rawValue) || typeof rawValue !== "string" || rawValue.length === 0) {
    validationFailed(res, `${fieldName} must be a non-empty string`);
    return null;
  }

  return rawValue;
}

async function ensureCourseConversation(courseId: bigint): Promise<void> {
  await prisma.chatConversation.upsert({
    where: { scopeType_scopeId: { scopeType: "course", scopeId: courseId } },
    update: {},
    create: {
      scopeType: "course",
      scopeId: courseId,
      roomKey: `course:${courseId.toString()}`,
      createdBy: null,
    },
  });
}

// 验证调用方是否能访问该课程（is a member / teacher / assistant / academic）
async function getCourseWithAccessCheck(
  courseId: bigint,
  userId: string,
  role: Role,
  res: Response
): Promise<{ id: bigint } | null> {
  return ensureCourseReadableShared(courseId, userId, role, res);
}

async function getCourseTeacherRecord(courseId: bigint, userId: string) {
  return getCourseTeacherRecordShared(courseId, userId);
}

async function ensureCourseExists(courseId: bigint, res: Response): Promise<boolean> {
  return ensureCourseExistsShared(courseId, res);
}

async function ensureLeadTeacherConflict(courseId: bigint, userId: string, role: CourseTeacherRole, res: Response): Promise<boolean> {
  if (role !== CourseTeacherRole.lead) {
    return false;
  }

  const existingLead = await prisma.courseTeacher.findFirst({
    where: { courseId, role: CourseTeacherRole.lead },
    select: { userId: true },
  });
  if (existingLead && existingLead.userId !== userId) {
    res.status(409).json({ ok: false, code: "CONFLICT", message: "Course already has a lead teacher" });
    return true;
  }

  return false;
}

async function ensureAssistantBelongsToTeacher(
  teacherUserId: string,
  assistantUserId: string,
): Promise<boolean> {
  const binding = await prisma.teacherAssistant.findUnique({
    where: { assistantUserId: assistantUserId },
  });
  return binding?.teacherUserId === teacherUserId;
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/courses
// 查询当前用户有权访问的课程列表
// ──────────────────────────────────────────────────────────────
coursesRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  const { id: userId, role } = req.user!;

  const { status, academicYear, semester } = req.query as Record<string, string | undefined>;

  const where: Record<string, unknown> = {};
  if (status) where["status"] = status;
  if (academicYear) where["academicYear"] = Number(academicYear);
  if (semester) where["semester"] = Number(semester);

  let courseIds: bigint[] | undefined;

  if (role === Role.academic) {
    // academic 可看所有课程
  } else if (role === Role.teacher) {
    const rows = await prisma.courseTeacher.findMany({
      where: { userId },
      select: { courseId: true },
    });
    courseIds = rows.map((r) => r.courseId);
  } else if (role === Role.assistant) {
    const rows = await prisma.assistantBinding.findMany({
      where: { assistantUserId: userId },
      select: { courseId: true },
    });
    courseIds = rows.map((r) => r.courseId);
  } else {
    // student
    const rows = await prisma.courseMember.findMany({
      where: { userId, status: CourseMemberStatus.active },
      select: { courseId: true },
    });
    courseIds = rows.map((r) => r.courseId);
  }

  if (courseIds !== undefined) {
    where["id"] = { in: courseIds };
  }

  const courses = await prisma.course.findMany({
    where,
    orderBy: [{ academicYear: "desc" }, { semester: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      courseNo: true,
      name: true,
      academicYear: true,
      semester: true,
      status: true,
      description: true,
      createdAt: true,
    },
  });

  res.json({ ok: true, data: serializeBigInt(courses) });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/courses
// 创建课程（academic only）
// ──────────────────────────────────────────────────────────────
coursesRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const { courseNo, name, academicYear, semester, description } = req.body ?? {};

  if (!courseNo || !name || !academicYear || !semester) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "courseNo, name, academicYear, semester are required",
    });
  }

  const existing = await prisma.course.findUnique({ where: { courseNo } });
  if (existing) {
    return res.status(409).json({ ok: false, code: "CONFLICT", message: "courseNo already exists" });
  }

  const course = await prisma.course.create({
    data: {
      courseNo,
      name,
      academicYear: Number(academicYear),
      semester: Number(semester),
      description: description ?? null,
      createdBy: req.user!.id,
    },
    select: { id: true, courseNo: true, name: true, academicYear: true, semester: true, status: true, createdAt: true },
  });

  await ensureCourseConversation(course.id);

  res.status(201).json({ ok: true, data: serializeBigInt(course) });
});

// ──────────────────────────────────────────────────────────────
// GET /api/v1/courses/:id
// 获取课程详情（需有访问权限）
// ──────────────────────────────────────────────────────────────
coursesRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  const userId = req.user!.id;
  const role = req.user!.role as Role;

  const access = await getCourseWithAccessCheck(courseId, userId, role, res);
  if (!access) return;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      courseNo: true,
      name: true,
      academicYear: true,
      semester: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { members: { where: { status: CourseMemberStatus.active } }, teachers: true } },
    },
  });

  res.json({ ok: true, data: serializeBigInt(course) });
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/v1/courses/:id
// 更新课程（academic only）
// ──────────────────────────────────────────────────────────────
coursesRouter.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  const existing = await prisma.course.findUnique({ where: { id: courseId } });
  if (!existing) return notFound(res);

  const { name, description, status } = req.body ?? {};

  const allowedStatuses: string[] = Object.values(CourseStatus);
  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Invalid status" });
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
    },
    select: { id: true, courseNo: true, name: true, status: true, updatedAt: true },
  });

  res.json({ ok: true, data: serializeBigInt(updated) });
});

// ──────────────────────────────────────────────────────────────
// GET /api/v1/courses/:id/teachers
// 列出课程老师（需有访问权限）
// ──────────────────────────────────────────────────────────────
coursesRouter.get("/:id/teachers", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  const userId = req.user!.id;
  const role = req.user!.role as Role;

  const access = await getCourseWithAccessCheck(courseId, userId, role, res);
  if (!access) return;

  const teachers = await prisma.courseTeacher.findMany({
    where: { courseId },
    select: {
      role: true,
      assignedAt: true,
      user: { select: { id: true, profile: { select: { realName: true, avatarUrl: true } } } },
    },
  });

  res.json({ ok: true, data: serializeBigInt(teachers) });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/courses/:id/teachers
// 为课程指派老师（academic only）
// ──────────────────────────────────────────────────────────────
coursesRouter.post("/:id/teachers", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return;

  const { userId, role: teacherRole } = req.body ?? {};
  if (typeof userId !== "string" || userId.length === 0) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "userId is required" });
  }

  // 校验 userId 的 role 是否为 teacher
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== Role.teacher) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "User is not a teacher" });
  }

  const roleValue: CourseTeacherRole =
    teacherRole === CourseTeacherRole.co ? CourseTeacherRole.co : CourseTeacherRole.lead;

  if (await ensureLeadTeacherConflict(courseId, userId, roleValue, res)) return;

  const record = await prisma.courseTeacher.upsert({
    where: { courseId_userId: { courseId, userId } },
    create: { courseId, userId, role: roleValue },
    update: { role: roleValue },
    select: { courseId: true, userId: true, role: true, assignedAt: true },
  });

  res.status(201).json({ ok: true, data: serializeBigInt(record) });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/courses/:id/teachers/:userId
// 移除课程老师（academic only）
// ──────────────────────────────────────────────────────────────
coursesRouter.delete("/:id/teachers/:userId", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  const userId = parseRequiredParam(req.params.userId, "userId", res);
  if (userId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return;

  const record = await prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!record) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Teacher not in this course" });
  }

  await prisma.courseTeacher.delete({ where: { courseId_userId: { courseId, userId } } });
  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────────
// GET /api/v1/courses/:id/assistants
// 列出课程助教（academic 或课程老师）
// ──────────────────────────────────────────────────────────────
coursesRouter.get("/:id/assistants", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;

  const { id: userId, role } = req.user!;
  if (role !== Role.academic) {
    const teacherRecord = await getCourseTeacherRecord(courseId, userId);
    if (!teacherRecord) {
      return forbidden(res);
    }
  }

  const assistants = await prisma.assistantBinding.findMany({
    where: { courseId },
    select: {
      assistantUserId: true,
      teacherUserId: true,
      createdAt: true,
      assistant: {
        select: {
          id: true,
          profile: {
            select: {
              realName: true,
              avatarUrl: true,
              accountNo: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  res.json({ ok: true, data: serializeBigInt(assistants) });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/courses/:id/assistants
// 课程老师为自己的课程绑定助教
// ──────────────────────────────────────────────────────────────
coursesRouter.post("/:id/assistants", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;

  if (req.user!.role !== Role.teacher) {
    return res.status(403).json({
      ok: false,
      code: "FORBIDDEN",
      message: "Only course teachers can bind assistants",
    });
  }

  const teacherUserId = req.user!.id;
  const teacherRecord = await getCourseTeacherRecord(courseId, teacherUserId);
  if (!teacherRecord) {
    return forbidden(res);
  }

  const { assistantUserId } = req.body ?? {};
  if (!assistantUserId || typeof assistantUserId !== "string" || !/^\d{10}$/.test(assistantUserId)) {
    return validationFailed(res, "assistantUserId must be a 10-digit string");
  }

  const assistant = await prisma.user.findUnique({
    where: { id: assistantUserId },
    select: { id: true, role: true, isActive: true },
  });
  if (!assistant || !assistant.isActive || assistant.role !== Role.assistant) {
    return validationFailed(res, "Target user is not an active assistant");
  }

  const belongsToTeacher = await ensureAssistantBelongsToTeacher(teacherUserId, assistantUserId);
  if (!belongsToTeacher) {
    return res.status(403).json({
      ok: false,
      code: "FORBIDDEN",
      message: "Assistant does not belong to current teacher",
    });
  }

  const currentCount = await prisma.assistantBinding.count({ where: { courseId } });
  const exists = await prisma.assistantBinding.findUnique({
    where: { assistantUserId_courseId: { assistantUserId, courseId } },
  });

  if (!exists && currentCount >= 3) {
    return res.status(409).json({
      ok: false,
      code: "CONFLICT",
      message: "A course can bind at most 3 assistants",
    });
  }

  const record = await prisma.assistantBinding.upsert({
    where: { assistantUserId_courseId: { assistantUserId, courseId } },
    create: {
      assistantUserId,
      teacherUserId,
      courseId,
    },
    update: {
      teacherUserId,
    },
    select: {
      assistantUserId: true,
      teacherUserId: true,
      courseId: true,
      createdAt: true,
      assistant: {
        select: {
          id: true,
          profile: {
            select: {
              realName: true,
              avatarUrl: true,
              accountNo: true,
            },
          },
        },
      },
    },
  });

  res.status(201).json({ ok: true, data: serializeBigInt(record) });
});

coursesRouter.delete("/:id/assistants/:assistantUserId", requireAuth, async (req: Request, res: Response) => {
  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;

  if (req.user!.role !== Role.teacher) {
    return res.status(403).json({
      ok: false,
      code: "FORBIDDEN",
      message: "Only course teachers can unbind assistants",
    });
  }

  const assistantUserId = parseRequiredParam(req.params.assistantUserId, "assistantUserId", res);
  if (assistantUserId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return;

  const teacherUserId = req.user!.id;
  const teacherRecord = await getCourseTeacherRecord(courseId, teacherUserId);
  if (!teacherRecord) {
    return forbidden(res);
  }

  const binding = await prisma.assistantBinding.findUnique({
    where: { assistantUserId_courseId: { assistantUserId, courseId } },
    select: { assistantUserId: true, teacherUserId: true },
  });
  if (!binding) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Assistant not bound to this course" });
  }
  if (binding.teacherUserId !== teacherUserId) {
    return forbidden(res);
  }

  await prisma.assistantBinding.delete({
    where: { assistantUserId_courseId: { assistantUserId, courseId } },
  });

  res.json({ ok: true });
});

coursesRouter.patch("/:id/teachers/:userId", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = parseCourseId(req.params.id, res);
  if (courseId === null) return;
  const userId = parseRequiredParam(req.params.userId, "userId", res);
  if (userId === null) return;
  if (!(await ensureCourseExists(courseId, res))) return;

  const record = await prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { courseId: true, userId: true },
  });
  if (!record) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Teacher not in this course" });
  }

  const roleValue =
    req.body?.role === CourseTeacherRole.co ? CourseTeacherRole.co : req.body?.role === CourseTeacherRole.lead ? CourseTeacherRole.lead : null;
  if (!roleValue) {
    return validationFailed(res, "role must be lead or co");
  }

  if (await ensureLeadTeacherConflict(courseId, userId, roleValue, res)) return;

  const updated = await prisma.courseTeacher.update({
    where: { courseId_userId: { courseId, userId } },
    data: { role: roleValue },
    select: { courseId: true, userId: true, role: true, assignedAt: true },
  });

  res.json({ ok: true, data: serializeBigInt(updated) });
});

