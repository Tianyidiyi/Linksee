import argon2 from "argon2";
import {
  AssignmentStatus,
  CourseMemberStatus,
  CourseStatus,
  CourseTeacherRole,
  GradeStatus,
  GroupJoinRequestStatus,
  GroupMemberRole,
  GroupStatus,
  MiniTaskPriority,
  MiniTaskStatus,
  Role,
  StageStatus,
  SubmissionStatus,
} from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { MOCK } from "./student-dashboard-mock-shared.ts";
import { cleanupStudentDashboardMock } from "./cleanup-student-dashboard-mock.ts";

const hashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

async function ensureUser(input: {
  id: string;
  role: Role;
  realName: string;
  accountNo: string;
  studentProfile?: {
    stuNo: string;
    grade: number;
    cohort: number;
    major: string;
    adminClass: string;
  };
}): Promise<void> {
  const passwordHash = await argon2.hash("ChangeMe123!", hashOptions);
  await prisma.user.upsert({
    where: { id: input.id },
    update: {
      passwordHash,
      role: input.role,
      isActive: true,
      forceChangePassword: false,
    },
    create: {
      id: input.id,
      passwordHash,
      role: input.role,
      isActive: true,
      forceChangePassword: false,
    },
  });
  await prisma.userProfile.upsert({
    where: { userId: input.id },
    update: {
      realName: input.realName,
      accountNo: input.accountNo,
      bio: `${MOCK.tag} seed user`,
    },
    create: {
      userId: input.id,
      realName: input.realName,
      accountNo: input.accountNo,
      bio: `${MOCK.tag} seed user`,
    },
  });
  if (input.studentProfile) {
    await prisma.studentProfile.upsert({
      where: { userId: input.id },
      update: input.studentProfile,
      create: {
        userId: input.id,
        ...input.studentProfile,
      },
    });
  }
}

async function main(): Promise<void> {
  await cleanupStudentDashboardMock();

  await ensureUser({
    id: MOCK.academicId,
    role: Role.academic,
    realName: "教务 Mock",
    accountNo: "ACAD-MOCK-01",
  });
  await ensureUser({
    id: MOCK.teacherId,
    role: Role.teacher,
    realName: "汪楚奇",
    accountNo: "T-MOCK-01",
  });
  await ensureUser({
    id: MOCK.studentId,
    role: Role.student,
    realName: "小泉",
    accountNo: "2023010001",
    studentProfile: {
      stuNo: "2023010001",
      grade: 2023,
      cohort: 2027,
      major: "软件工程",
      adminClass: "软工2301",
    },
  });
  await ensureUser({
    id: MOCK.applicantIds[0],
    role: Role.student,
    realName: "周同学",
    accountNo: MOCK.applicantIds[0],
    studentProfile: {
      stuNo: MOCK.applicantIds[0],
      grade: 2023,
      cohort: 2027,
      major: "软件工程",
      adminClass: "软工2301",
    },
  });
  await ensureUser({
    id: MOCK.applicantIds[1],
    role: Role.student,
    realName: "陈同学",
    accountNo: MOCK.applicantIds[1],
    studentProfile: {
      stuNo: MOCK.applicantIds[1],
      grade: 2023,
      cohort: 2027,
      major: "软件工程",
      adminClass: "软工2301",
    },
  });
  await ensureUser({
    id: MOCK.memberIds[0],
    role: Role.student,
    realName: "李同学",
    accountNo: MOCK.memberIds[0],
    studentProfile: {
      stuNo: MOCK.memberIds[0],
      grade: 2023,
      cohort: 2027,
      major: "软件工程",
      adminClass: "软工2301",
    },
  });
  await ensureUser({
    id: MOCK.memberIds[1],
    role: Role.student,
    realName: "王同学",
    accountNo: MOCK.memberIds[1],
    studentProfile: {
      stuNo: MOCK.memberIds[1],
      grade: 2023,
      cohort: 2027,
      major: "软件工程",
      adminClass: "软工2301",
    },
  });

  const course1 = await prisma.course.create({
    data: {
      courseNo: MOCK.courseNos[0],
      name: "深入浅出程序设计竞赛（基础篇）",
      academicYear: 2025,
      semester: 2,
      description: `${MOCK.tag} current student dashboard showcase`,
      status: CourseStatus.active,
      createdBy: MOCK.academicId,
    },
  });
  const course2 = await prisma.course.create({
    data: {
      courseNo: MOCK.courseNos[1],
      name: "数据库系统",
      academicYear: 2025,
      semester: 2,
      description: `${MOCK.tag} secondary course`,
      status: CourseStatus.active,
      createdBy: MOCK.academicId,
    },
  });
  const course3 = await prisma.course.create({
    data: {
      courseNo: MOCK.courseNos[2],
      name: "人工智能导论",
      academicYear: 2025,
      semester: 2,
      description: `${MOCK.tag} tertiary course`,
      status: CourseStatus.active,
      createdBy: MOCK.academicId,
    },
  });

  await prisma.courseTeacher.createMany({
    data: [
      { courseId: course1.id, userId: MOCK.teacherId, role: CourseTeacherRole.lead },
      { courseId: course2.id, userId: MOCK.teacherId, role: CourseTeacherRole.lead },
      { courseId: course3.id, userId: MOCK.teacherId, role: CourseTeacherRole.lead },
    ],
  });
  await prisma.courseMember.createMany({
    data: [
      { courseId: course1.id, userId: MOCK.studentId, status: CourseMemberStatus.active },
      { courseId: course2.id, userId: MOCK.studentId, status: CourseMemberStatus.active },
      { courseId: course3.id, userId: MOCK.studentId, status: CourseMemberStatus.active },
      { courseId: course1.id, userId: MOCK.applicantIds[0], status: CourseMemberStatus.active },
      { courseId: course1.id, userId: MOCK.applicantIds[1], status: CourseMemberStatus.active },
      { courseId: course1.id, userId: MOCK.memberIds[0], status: CourseMemberStatus.active },
      { courseId: course1.id, userId: MOCK.memberIds[1], status: CourseMemberStatus.active },
      { courseId: course2.id, userId: MOCK.applicantIds[0], status: CourseMemberStatus.active },
    ],
  });

  const assignment1 = await prisma.assignment.create({
    data: {
      courseId: course1.id,
      title: "虚拟测试会话对话系统",
      description: `${MOCK.tag} primary assignment`,
      status: AssignmentStatus.active,
      createdBy: MOCK.teacherId,
    },
  });
  const assignment2 = await prisma.assignment.create({
    data: {
      courseId: course1.id,
      title: "后端联调与系统设计原型",
      description: `${MOCK.tag} secondary assignment`,
      status: AssignmentStatus.active,
      createdBy: MOCK.teacherId,
    },
  });
  const assignment3 = await prisma.assignment.create({
    data: {
      courseId: course2.id,
      title: "需求分析系统",
      description: `${MOCK.tag} join market assignment`,
      status: AssignmentStatus.active,
      createdBy: MOCK.teacherId,
    },
  });

  await prisma.assignmentGroupConfig.createMany({
    data: [
      {
        assignmentId: assignment1.id,
        groupFormStart: new Date("2026-05-20T08:00:00.000Z"),
        groupFormEnd: new Date("2026-07-20T08:00:00.000Z"),
        groupMinSize: 2,
        groupMaxSize: 5,
        updatedBy: MOCK.teacherId,
      },
      {
        assignmentId: assignment2.id,
        groupFormStart: new Date("2026-05-20T08:00:00.000Z"),
        groupFormEnd: new Date("2026-07-20T08:00:00.000Z"),
        groupMinSize: 2,
        groupMaxSize: 5,
        updatedBy: MOCK.teacherId,
      },
      {
        assignmentId: assignment3.id,
        groupFormStart: new Date("2026-05-20T08:00:00.000Z"),
        groupFormEnd: new Date("2026-07-20T08:00:00.000Z"),
        groupMinSize: 2,
        groupMaxSize: 5,
        updatedBy: MOCK.teacherId,
      },
    ],
  });

  const [a1s1, a1s2, a1s3, a2s1, a2s2, a3s1, a3s2] = await Promise.all([
    prisma.assignmentStage.create({
      data: {
        assignmentId: assignment1.id,
        stageNo: 1,
        title: "阶段一：需求调研",
        description: "完成用户访谈和需求收集",
        dueAt: new Date("2026-05-20T15:59:00.000Z"),
        weight: 20,
        submissionDesc: "提交需求分析与调研报告",
        acceptCriteria: "完成不少于 5 位用户访谈\n整理需求清单\n输出需求调研报告",
        requirementFiles: [],
        status: StageStatus.closed,
        createdBy: MOCK.teacherId,
      },
    }),
    prisma.assignmentStage.create({
      data: {
        assignmentId: assignment1.id,
        stageNo: 2,
        title: "阶段二：需求规格说明书",
        description: "输出规格说明和原型草案",
        dueAt: new Date("2026-05-28T15:59:00.000Z"),
        weight: 25,
        submissionDesc: "提交规格说明书和接口草案",
        acceptCriteria: "提交 SRS 文档\n覆盖核心流程\n明确接口草图",
        requirementFiles: [],
        status: StageStatus.closed,
        createdBy: MOCK.teacherId,
      },
    }),
    prisma.assignmentStage.create({
      data: {
        assignmentId: assignment1.id,
        stageNo: 3,
        title: "阶段三：开发实现",
        description: "完成核心模块联调和第一轮集成",
        startAt: new Date("2026-06-01T00:00:00.000Z"),
        dueAt: new Date("2026-06-18T15:59:00.000Z"),
        weight: 35,
        submissionDesc: "提交阶段实现包、仓库链接与贡献说明",
        acceptCriteria: "提交可运行版本\n附 Git 仓库链接\n说明小组成员贡献",
        requirementFiles: [],
        status: StageStatus.open,
        createdBy: MOCK.teacherId,
      },
    }),
    prisma.assignmentStage.create({
      data: {
        assignmentId: assignment2.id,
        stageNo: 1,
        title: "阶段一：原型草图",
        description: "输出系统原型和结构说明",
        dueAt: new Date("2026-06-12T15:59:00.000Z"),
        weight: 30,
        submissionDesc: "提交原型图与页面说明",
        acceptCriteria: "完成原型图\n标注关键交互",
        requirementFiles: [],
        status: StageStatus.open,
        createdBy: MOCK.teacherId,
      },
    }),
    prisma.assignmentStage.create({
      data: {
        assignmentId: assignment2.id,
        stageNo: 2,
        title: "阶段二：联调检查",
        description: "验证接口与页面联调",
        dueAt: new Date("2026-06-25T15:59:00.000Z"),
        weight: 30,
        submissionDesc: "提交联调记录与问题清单",
        acceptCriteria: "覆盖主要接口\n提交联调问题表",
        requirementFiles: [],
        status: StageStatus.open,
        createdBy: MOCK.teacherId,
      },
    }),
    prisma.assignmentStage.create({
      data: {
        assignmentId: assignment3.id,
        stageNo: 1,
        title: "阶段一：项目启动",
        description: "确定小组和分工",
        dueAt: new Date("2026-06-14T15:59:00.000Z"),
        weight: 20,
        submissionDesc: "提交启动文档和成员分工",
        acceptCriteria: "完成小组分工\n明确项目范围",
        requirementFiles: [],
        status: StageStatus.open,
        createdBy: MOCK.teacherId,
      },
    }),
    prisma.assignmentStage.create({
      data: {
        assignmentId: assignment3.id,
        stageNo: 2,
        title: "阶段二：系统设计",
        description: "数据库与模块设计",
        dueAt: new Date("2026-06-26T15:59:00.000Z"),
        weight: 30,
        submissionDesc: "提交 ER 图和模块说明",
        acceptCriteria: "完成数据库设计\n提交模块说明",
        requirementFiles: [],
        status: StageStatus.open,
        createdBy: MOCK.teacherId,
      },
    }),
  ]);

  const groupA1Main = await prisma.group.create({
    data: {
      assignmentId: assignment1.id,
      groupNo: 1,
      name: "洛谷学术组",
      status: GroupStatus.active,
      createdBy: MOCK.studentId,
    },
  });
  const groupA1Alt = await prisma.group.create({
    data: {
      assignmentId: assignment1.id,
      groupNo: 2,
      name: "星火协作组",
      status: GroupStatus.forming,
      createdBy: MOCK.applicantIds[0],
    },
  });
  const groupA2Main = await prisma.group.create({
    data: {
      assignmentId: assignment2.id,
      groupNo: 1,
      name: "原型冲刺组",
      status: GroupStatus.active,
      createdBy: MOCK.studentId,
    },
  });
  const groupA3Join = await prisma.group.create({
    data: {
      assignmentId: assignment3.id,
      groupNo: 1,
      name: "需求分析第一组",
      status: GroupStatus.forming,
      createdBy: MOCK.applicantIds[0],
    },
  });
  const groupA3Join2 = await prisma.group.create({
    data: {
      assignmentId: assignment3.id,
      groupNo: 2,
      name: "系统设计第二组",
      status: GroupStatus.forming,
      createdBy: MOCK.applicantIds[1],
    },
  });

  await prisma.groupMember.createMany({
    data: [
      {
        groupId: groupA1Main.id,
        assignmentId: assignment1.id,
        userId: MOCK.studentId,
        role: GroupMemberRole.leader,
      },
      {
        groupId: groupA1Main.id,
        assignmentId: assignment1.id,
        userId: MOCK.memberIds[0],
        role: GroupMemberRole.member,
      },
      {
        groupId: groupA1Main.id,
        assignmentId: assignment1.id,
        userId: MOCK.memberIds[1],
        role: GroupMemberRole.member,
      },
      {
        groupId: groupA1Alt.id,
        assignmentId: assignment1.id,
        userId: MOCK.applicantIds[0],
        role: GroupMemberRole.leader,
      },
      {
        groupId: groupA2Main.id,
        assignmentId: assignment2.id,
        userId: MOCK.studentId,
        role: GroupMemberRole.leader,
      },
      {
        groupId: groupA2Main.id,
        assignmentId: assignment2.id,
        userId: MOCK.memberIds[0],
        role: GroupMemberRole.member,
      },
      {
        groupId: groupA3Join.id,
        assignmentId: assignment3.id,
        userId: MOCK.applicantIds[0],
        role: GroupMemberRole.leader,
      },
      {
        groupId: groupA3Join2.id,
        assignmentId: assignment3.id,
        userId: MOCK.applicantIds[1],
        role: GroupMemberRole.leader,
      },
    ],
  });

  await prisma.groupJoinRequest.createMany({
    data: [
      {
        assignmentId: assignment1.id,
        groupId: groupA1Main.id,
        applicantUserId: MOCK.applicantIds[0],
        status: GroupJoinRequestStatus.pending,
        reason: "申请加入小组，负责前端页面联调。",
      },
      {
        assignmentId: assignment1.id,
        groupId: groupA1Main.id,
        applicantUserId: MOCK.applicantIds[1],
        status: GroupJoinRequestStatus.pending,
        reason: "申请加入小组，负责接口调试与测试。",
      },
    ],
  });

  await prisma.miniTask.createMany({
    data: [
      {
        groupId: groupA1Main.id,
        stageId: a1s3.id,
        title: "会话消息存储模块联调",
        description: "完成消息存储模块与接口联调。",
        assigneeId: MOCK.studentId,
        assigneeIds: [MOCK.studentId],
        priority: MiniTaskPriority.high,
        status: MiniTaskStatus.in_progress,
        dueAt: new Date("2026-06-10T15:59:00.000Z"),
        createdBy: MOCK.studentId,
      },
      {
        groupId: groupA1Main.id,
        stageId: a1s3.id,
        title: "接口文档补充",
        description: "补齐接口字段说明。",
        assigneeId: MOCK.studentId,
        assigneeIds: [MOCK.studentId],
        priority: MiniTaskPriority.medium,
        status: MiniTaskStatus.todo,
        dueAt: new Date("2026-06-11T15:59:00.000Z"),
        createdBy: MOCK.studentId,
      },
      {
        groupId: groupA1Main.id,
        stageId: a1s3.id,
        title: "单元测试补充",
        description: "补齐学生 dashboard 相关测试。",
        assigneeId: MOCK.studentId,
        assigneeIds: [MOCK.studentId],
        priority: MiniTaskPriority.medium,
        status: MiniTaskStatus.todo,
        dueAt: new Date("2026-06-13T15:59:00.000Z"),
        createdBy: MOCK.studentId,
      },
      {
        groupId: groupA2Main.id,
        stageId: a2s1.id,
        title: "原型图页面梳理",
        description: "输出原型图说明文档。",
        assigneeId: MOCK.studentId,
        assigneeIds: [MOCK.studentId],
        priority: MiniTaskPriority.low,
        status: MiniTaskStatus.done,
        dueAt: new Date("2026-06-05T15:59:00.000Z"),
        createdBy: MOCK.studentId,
      },
    ],
  });

  const sub1 = await prisma.submission.create({
    data: {
      groupId: groupA1Main.id,
      stageId: a1s1.id,
      attemptNo: 1,
      status: SubmissionStatus.approved,
      summary: "需求分析与调研报告",
      payload: {
        title: "需求调研报告 v1.0",
        description: "已完成用户访谈和需求清单整理。",
        repositoryUrl: "https://github.com/linksee/mock-student-stage1",
        links: ["https://docs.example.com/mock-stage1"],
        contributionNote: "小泉负责需求整理与访谈记录。",
      },
      submittedAt: new Date("2026-05-20T09:08:00.000Z"),
      createdBy: MOCK.studentId,
      submittedBy: MOCK.studentId,
    },
  });
  const sub2 = await prisma.submission.create({
    data: {
      groupId: groupA1Main.id,
      stageId: a1s2.id,
      attemptNo: 1,
      status: SubmissionStatus.approved,
      summary: "需求规格说明书",
      payload: {
        title: "需求规格说明书 v1.2",
        description: "完成规格说明书和流程图。",
        repositoryUrl: "https://github.com/linksee/mock-student-stage2",
        links: ["https://figma.com/mock-stage2"],
        contributionNote: "小泉负责 SRS 和接口说明。",
      },
      submittedAt: new Date("2026-05-28T09:18:00.000Z"),
      createdBy: MOCK.studentId,
      submittedBy: MOCK.studentId,
    },
  });
  const sub3 = await prisma.submission.create({
    data: {
      groupId: groupA1Main.id,
      stageId: a1s3.id,
      attemptNo: 1,
      status: SubmissionStatus.submitted,
      summary: "开发实现阶段成果",
      payload: {
        title: "开发实现成果 v1.0",
        description: "已提交阶段成果压缩包、仓库链接和贡献说明。",
        repositoryUrl: "https://github.com/linksee/mock-student-stage3",
        links: [
          "https://docs.example.com/mock-stage3",
          "https://demo.example.com/mock-stage3",
        ],
        contributionNote: "小泉负责整体规划、页面联调和任务拆分。",
      },
      submittedAt: new Date("2026-06-03T09:08:00.000Z"),
      createdBy: MOCK.studentId,
      submittedBy: MOCK.studentId,
    },
  });
  const sub4 = await prisma.submission.create({
    data: {
      groupId: groupA2Main.id,
      stageId: a2s1.id,
      attemptNo: 1,
      status: SubmissionStatus.reviewed,
      summary: "原型草图和说明文档",
      payload: {
        title: "原型草图 v0.9",
        description: "完成首版原型草图。",
        repositoryUrl: "https://github.com/linksee/mock-student-stage4",
        contributionNote: "小泉负责原型结构和交互描述。",
      },
      submittedAt: new Date("2026-06-02T09:22:00.000Z"),
      createdBy: MOCK.studentId,
      submittedBy: MOCK.studentId,
    },
  });

  await prisma.stageGrade.createMany({
    data: [
      {
        submissionId: sub1.id,
        groupId: groupA1Main.id,
        stageId: a1s1.id,
        courseId: course1.id,
        score: 88,
        status: GradeStatus.published,
        graderId: MOCK.teacherId,
        publishedBy: MOCK.teacherId,
        publishedAt: new Date("2026-05-21T10:30:00.000Z"),
      },
      {
        submissionId: sub2.id,
        groupId: groupA1Main.id,
        stageId: a1s2.id,
        courseId: course1.id,
        score: 85,
        status: GradeStatus.published,
        graderId: MOCK.teacherId,
        publishedBy: MOCK.teacherId,
        publishedAt: new Date("2026-05-30T12:10:00.000Z"),
      },
      {
        submissionId: sub4.id,
        groupId: groupA2Main.id,
        stageId: a2s1.id,
        courseId: course1.id,
        score: 92,
        status: GradeStatus.published,
        graderId: MOCK.teacherId,
        publishedBy: MOCK.teacherId,
        publishedAt: new Date("2026-06-03T10:12:00.000Z"),
      },
    ],
  });

  console.log("[seed] student dashboard mock data created");
  console.log("[seed] student account: " + MOCK.studentId);
  console.log("[seed] mock courses: " + MOCK.courseNos.join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
