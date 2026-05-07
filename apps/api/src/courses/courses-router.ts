import { Router, type Request, type Response } from "express";
import { Role, CourseStatus, CourseTeacherRole, CourseMemberStatus } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { requireAuth } from "../infra/jwt-middleware.js";

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

// 验证调用方是否能访问该课程（is a member / teacher / assistant / academic）
async function getCourseWithAccessCheck(
  courseId: bigint,
  userId: string,
  role: Role,
  res: Response
): Promise<{ id: bigint } | null> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    notFound(res);
    return null;
  }
  if (role === Role.academic) return course;

  if (role === Role.teacher || role === Role.assistant) {
    const isTeacher = await prisma.courseTeacher.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });
    const isAssistant = isTeacher
      ? null
      : await prisma.assistantBinding.findUnique({
          where: { assistantUserId_courseId: { assistantUserId: userId, courseId } },
        });
    if (!isTeacher && !isAssistant) {
      forbidden(res);
      return null;
    }
    return course;
  }

  // student：必须是课程成员
  const membership = await prisma.courseMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!membership || membership.status === CourseMemberStatus.withdrawn) {
    forbidden(res);
    return null;
  }
  return course;
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

  res.status(201).json({ ok: true, data: serializeBigInt(course) });
});

// ──────────────────────────────────────────────────────────────
// GET /api/v1/courses/:id
// 获取课程详情（需有访问权限）
// ──────────────────────────────────────────────────────────────
coursesRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const courseId = BigInt(req.params.id);
  const { id: userId, role } = req.user!;

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

  const courseId = BigInt(req.params.id);
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
  const courseId = BigInt(req.params.id);
  const { id: userId, role } = req.user!;

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

  const courseId = BigInt(req.params.id);
  const existing = await prisma.course.findUnique({ where: { id: courseId } });
  if (!existing) return notFound(res);

  const { userId, role: teacherRole } = req.body ?? {};
  if (!userId) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "userId is required" });
  }

  // 校验 userId 的 role 是否为 teacher
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== Role.teacher) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "User is not a teacher" });
  }

  const roleValue: CourseTeacherRole =
    teacherRole === CourseTeacherRole.co ? CourseTeacherRole.co : CourseTeacherRole.lead;

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

  const courseId = BigInt(req.params.id);
  const { userId } = req.params;

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
// GET /api/v1/courses/:id/members
// 列出课程成员（需有访问权限，支持 status 筛选）
// ──────────────────────────────────────────────────────────────
coursesRouter.get("/:id/members", requireAuth, async (req: Request, res: Response) => {
  const courseId = BigInt(req.params.id);
  const { id: userId, role } = req.user!;

  const access = await getCourseWithAccessCheck(courseId, userId, role, res);
  if (!access) return;

  const statusFilter = (req.query.status as CourseMemberStatus | undefined) ?? CourseMemberStatus.active;

  const members = await prisma.courseMember.findMany({
    where: { courseId, status: statusFilter },
    select: {
      id: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          profile: { select: { realName: true, accountNo: true, avatarUrl: true } },
          studentProfile: { select: { stuNo: true, grade: true, adminClass: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  res.json({ ok: true, data: serializeBigInt(members) });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/courses/:id/members/batch
// 批量导入学生成员（academic only）
// body: { userIds: string[] }
// ──────────────────────────────────────────────────────────────
coursesRouter.post("/:id/members/batch", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = BigInt(req.params.id);
  const existing = await prisma.course.findUnique({ where: { id: courseId } });
  if (!existing) return notFound(res);

  const { userIds } = req.body ?? {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "userIds must be a non-empty array" });
  }
  if (userIds.length > 500) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Maximum 500 users per batch" });
  }

  // 校验所有 userId 是 student
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, role: Role.student },
    select: { id: true },
  });
  const validIds = new Set(users.map((u) => u.id));
  const invalidIds = userIds.filter((id: string) => !validIds.has(id));

  if (invalidIds.length > 0) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: `The following user IDs are not valid students: ${invalidIds.join(", ")}`,
    });
  }

  // upsert：已存在且 withdrawn 的改回 active；全新的插入
  await prisma.$transaction(
    userIds.map((uid: string) =>
      prisma.courseMember.upsert({
        where: { courseId_userId: { courseId, userId: uid } },
        create: { courseId, userId: uid },
        update: { status: CourseMemberStatus.active },
      })
    )
  );

  res.status(201).json({ ok: true, data: { imported: userIds.length } });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/courses/:id/members/:userId
// 移除课程成员（academic only，软删除 status=withdrawn）
// ──────────────────────────────────────────────────────────────
coursesRouter.delete("/:id/members/:userId", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = BigInt(req.params.id);
  const { userId } = req.params;

  const member = await prisma.courseMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!member || member.status === CourseMemberStatus.withdrawn) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Member not found in this course" });
  }

  await prisma.courseMember.update({
    where: { courseId_userId: { courseId, userId } },
    data: { status: CourseMemberStatus.withdrawn },
  });

  res.json({ ok: true });
});
