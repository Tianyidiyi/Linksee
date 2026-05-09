import { CourseMemberStatus, Role } from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../infra/prisma.js";

export function courseNotFound(res: Response): void {
  res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Course not found" });
}

export function courseForbidden(res: Response, message = "Insufficient permissions"): void {
  res.status(403).json({ ok: false, code: "FORBIDDEN", message });
}

export async function ensureCourseExists(courseId: bigint, res: Response): Promise<boolean> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    courseNotFound(res);
    return false;
  }
  return true;
}

export async function getCourseTeacherRecord(courseId: bigint, userId: string) {
  return prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
}

export async function ensureCourseReadable(
  courseId: bigint,
  userId: string,
  role: Role,
  res: Response,
): Promise<{ id: bigint } | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    courseNotFound(res);
    return null;
  }

  if (role === Role.academic) {
    return course;
  }

  if (role === Role.teacher || role === Role.assistant) {
    const isTeacher = await prisma.courseTeacher.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { courseId: true },
    });
    const isAssistant = isTeacher
      ? null
      : await prisma.assistantBinding.findUnique({
          where: { assistantUserId_courseId: { assistantUserId: userId, courseId } },
          select: { courseId: true },
        });
    if (!isTeacher && !isAssistant) {
      courseForbidden(res);
      return null;
    }
    return course;
  }

  const membership = await prisma.courseMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { status: true },
  });
  if (!membership || membership.status === CourseMemberStatus.withdrawn) {
    courseForbidden(res);
    return null;
  }

  return course;
}

export async function ensureCourseManageable(
  courseId: bigint,
  userId: string,
  role: Role,
  res: Response,
  forbiddenMessage = "Only academic staff or course teachers can manage this course",
): Promise<{ id: bigint } | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    courseNotFound(res);
    return null;
  }

  if (role === Role.academic) {
    return course;
  }

  if (role !== Role.teacher) {
    courseForbidden(res, forbiddenMessage);
    return null;
  }

  const teacherRecord = await prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { courseId: true },
  });
  if (!teacherRecord) {
    courseForbidden(res, forbiddenMessage);
    return null;
  }

  return course;
}
