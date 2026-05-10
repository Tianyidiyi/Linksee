import { CourseMemberStatus, Role } from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../infra/prisma.js";
import { ensureCourseReadable } from "../courses/course-access.js";

export type GroupAccessRecord = {
  id: bigint;
  assignmentId: bigint;
  courseId: bigint;
  groupNo: number;
};

export type AssignmentCourseRecord = {
  id: bigint;
  courseId: bigint;
};

function notFound(res: Response): void {
  res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Group not found" });
}

function forbidden(res: Response, message = "Insufficient permissions"): void {
  res.status(403).json({ ok: false, code: "FORBIDDEN", message });
}

export async function getGroupAccess(
  groupId: bigint,
  userId: string,
  role: Role,
  res: Response,
): Promise<GroupAccessRecord | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      assignmentId: true,
      groupNo: true,
      assignment: { select: { courseId: true } },
    },
  });

  if (!group) {
    notFound(res);
    return null;
  }

  if (role === Role.student) {
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId },
      select: { id: true },
    });
    if (!membership) {
      forbidden(res);
      return null;
    }
    return {
      id: group.id,
      assignmentId: group.assignmentId,
      courseId: group.assignment.courseId,
      groupNo: group.groupNo,
    };
  }

  const course = await ensureCourseReadable(group.assignment.courseId, userId, role, res);
  if (!course) {
    return null;
  }

  return {
    id: group.id,
    assignmentId: group.assignmentId,
    courseId: group.assignment.courseId,
    groupNo: group.groupNo,
  };
}

export async function ensureGroupManageable(
  groupId: bigint,
  userId: string,
  role: Role,
  res: Response,
): Promise<GroupAccessRecord | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      assignmentId: true,
      groupNo: true,
      assignment: { select: { courseId: true } },
    },
  });

  if (!group) {
    notFound(res);
    return null;
  }

  if (role === Role.academic) {
    return {
      id: group.id,
      assignmentId: group.assignmentId,
      courseId: group.assignment.courseId,
      groupNo: group.groupNo,
    };
  }

  if (role === Role.teacher) {
    const teacher = await prisma.courseTeacher.findUnique({
      where: { courseId_userId: { courseId: group.assignment.courseId, userId } },
      select: { courseId: true },
    });
    if (!teacher) {
      forbidden(res);
      return null;
    }
    return {
      id: group.id,
      assignmentId: group.assignmentId,
      courseId: group.assignment.courseId,
      groupNo: group.groupNo,
    };
  }

  if (role === Role.assistant) {
    const assistant = await prisma.assistantBinding.findUnique({
      where: { assistantUserId_courseId: { assistantUserId: userId, courseId: group.assignment.courseId } },
      select: { courseId: true },
    });
    if (!assistant) {
      forbidden(res);
      return null;
    }
    return {
      id: group.id,
      assignmentId: group.assignmentId,
      courseId: group.assignment.courseId,
      groupNo: group.groupNo,
    };
  }

  forbidden(res);
  return null;
}

export async function ensureAssignmentManageable(
  assignmentId: bigint,
  userId: string,
  role: Role,
  res: Response,
): Promise<AssignmentCourseRecord | null> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, courseId: true },
  });

  if (!assignment) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Assignment not found" });
    return null;
  }

  if (role === Role.academic) {
    return assignment;
  }

  if (role === Role.teacher) {
    const teacher = await prisma.courseTeacher.findUnique({
      where: { courseId_userId: { courseId: assignment.courseId, userId } },
      select: { courseId: true },
    });
    if (!teacher) {
      forbidden(res, "Only course teachers can manage groups");
      return null;
    }
    return assignment;
  }

  if (role === Role.assistant) {
    const assistant = await prisma.assistantBinding.findUnique({
      where: { assistantUserId_courseId: { assistantUserId: userId, courseId: assignment.courseId } },
      select: { courseId: true },
    });
    if (!assistant) {
      forbidden(res, "Only course staff can manage groups");
      return null;
    }
    return assignment;
  }

  forbidden(res, "Only course staff can manage groups");
  return null;
}

export async function ensureCourseMemberActive(
  courseId: bigint,
  userId: string,
  res: Response,
): Promise<boolean> {
  const member = await prisma.courseMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { status: true },
  });
  if (!member || member.status !== CourseMemberStatus.active) {
    res.status(403).json({ ok: false, code: "FORBIDDEN", message: "User is not an active course member" });
    return false;
  }
  return true;
}
