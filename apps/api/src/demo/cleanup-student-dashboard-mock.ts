import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../infra/prisma.js";
import { MOCK } from "./student-dashboard-mock-shared.ts";

export async function cleanupStudentDashboardMock(): Promise<void> {
  const courses = await prisma.course.findMany({
    where: { courseNo: { in: [...MOCK.courseNos] } },
    select: { id: true },
  });
  const courseIds = courses.map((row) => row.id);

  if (courseIds.length > 0) {
    const assignments = await prisma.assignment.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true },
    });
    const assignmentIds = assignments.map((row) => row.id);

    const stages = assignmentIds.length === 0
      ? []
      : await prisma.assignmentStage.findMany({
          where: { assignmentId: { in: assignmentIds } },
          select: { id: true },
        });
    const stageIds = stages.map((row) => row.id);

    const groups = assignmentIds.length === 0
      ? []
      : await prisma.group.findMany({
          where: { assignmentId: { in: assignmentIds } },
          select: { id: true },
        });
    const groupIds = groups.map((row) => row.id);

    const submissions = stageIds.length === 0 || groupIds.length === 0
      ? []
      : await prisma.submission.findMany({
          where: {
            stageId: { in: stageIds },
            groupId: { in: groupIds },
          },
          select: { id: true },
        });
    const submissionIds = submissions.map((row) => row.id);

    const stageGradeIds = submissionIds.length === 0
      ? []
      : (await prisma.stageGrade.findMany({
          where: { submissionId: { in: submissionIds } },
          select: { id: true },
        })).map((row) => row.id);

    await prisma.$transaction(async (tx) => {
      if (stageGradeIds.length > 0) {
        await tx.stageGradeLog.deleteMany({ where: { stageGradeId: { in: stageGradeIds } } });
      }
      if (submissionIds.length > 0) {
        await tx.review.deleteMany({ where: { submissionId: { in: submissionIds } } });
        await tx.submissionFile.deleteMany({ where: { submissionId: { in: submissionIds } } });
        await tx.stageGrade.deleteMany({ where: { submissionId: { in: submissionIds } } });
      }
      if (groupIds.length > 0) {
        await tx.miniTask.deleteMany({ where: { groupId: { in: groupIds } } });
        await tx.groupLeaderTransferRequest.deleteMany({ where: { groupId: { in: groupIds } } });
        await tx.groupJoinRequest.deleteMany({ where: { groupId: { in: groupIds } } });
      }
      if (submissionIds.length > 0) {
        await tx.submission.deleteMany({ where: { id: { in: submissionIds } } });
      }
      if (groupIds.length > 0) {
        await tx.groupMember.deleteMany({ where: { groupId: { in: groupIds } } });
        await tx.group.deleteMany({ where: { id: { in: groupIds } } });
      }
      if (stageIds.length > 0) {
        await tx.assignmentStage.deleteMany({ where: { id: { in: stageIds } } });
      }
      if (assignmentIds.length > 0) {
        await tx.assignmentGroupConfig.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
        await tx.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
      }
      await tx.courseTeacher.deleteMany({ where: { courseId: { in: courseIds } } });
      await tx.courseMember.deleteMany({ where: { courseId: { in: courseIds } } });
      await tx.course.deleteMany({ where: { id: { in: courseIds } } });
    });
  }

  await prisma.userProfile.deleteMany({
    where: { userId: { in: [...MOCK.applicantIds, ...MOCK.memberIds] } },
  });
  await prisma.studentProfile.deleteMany({
    where: { userId: { in: [...MOCK.applicantIds, ...MOCK.memberIds] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [...MOCK.applicantIds, ...MOCK.memberIds] } },
  });

  console.log("[cleanup] student dashboard mock data removed");
}

async function main(): Promise<void> {
  await cleanupStudentDashboardMock();
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
