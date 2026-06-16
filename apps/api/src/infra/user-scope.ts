import { Role } from "@prisma/client";
import { prisma } from "./prisma.js";

export type UserScopes = {
  courseIds: bigint[];
  groupIds: bigint[];
};

export async function resolveUserScopes(userId: string, role: Role): Promise<UserScopes> {
  if (role === Role.academic) {
    const courses = await prisma.course.findMany({ select: { id: true } });
    return { courseIds: courses.map((course) => course.id), groupIds: [] };
  }

  if (role === Role.teacher) {
    const courses = await prisma.courseTeacher.findMany({
      where: { userId, course: { status: { not: "draft" } } },
      select: { courseId: true },
    });
    return { courseIds: courses.map((row) => row.courseId), groupIds: [] };
  }

  if (role === Role.assistant) {
    const courses = await prisma.assistantBinding.findMany({
      where: { assistantUserId: userId, course: { status: { not: "draft" } } },
      select: { courseId: true },
    });
    return { courseIds: courses.map((row) => row.courseId), groupIds: [] };
  }

  const [courses, groups] = await Promise.all([
    prisma.courseMember.findMany({
      where: { userId, status: "active", course: { status: { not: "draft" } } },
      select: { courseId: true },
    }),
    prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } }),
  ]);

  return {
    courseIds: courses.map((row) => row.courseId),
    groupIds: groups.map((row) => row.groupId),
  };
}
