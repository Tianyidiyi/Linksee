import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const dotenv = require("dotenv");
const argon2 = require("argon2");
const {
  PrismaClient,
  Role,
  CourseStatus,
  CourseTeacherRole,
  CourseMemberStatus,
  AssignmentStatus,
  RegroupPolicy,
  StageStatus,
  GroupStatus,
  GroupMemberRole,
  MiniTaskPriority,
  MiniTaskStatus,
  ConversationScopeType,
  ConversationStatus,
  SubmissionStatus,
  ReviewStatus,
  ReviewDecision,
  GradeStatus,
  GradeAction,
} = require("@prisma/client");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../apps/api/.env") });

const prisma = new PrismaClient();
const TAG = "ACCEPTANCE_LARGE_20260619";
const PASSWORD = "Accept123!";
const STUDENT_COUNT = 200;
const TEACHER_COUNT = 20;
const COURSE_COUNT = 20;

function pad(n, width) {
  return String(n).padStart(width, "0");
}

function at(day, hour = 9) {
  return new Date(Date.UTC(2026, 5, day, hour, 0, 0));
}

const academic = {
  id: "2099000001",
  role: Role.academic,
  realName: "验收教务",
  accountNo: "2099000001",
};

const teacherProfiles = [
  ["陆嘉明", "副教授", "软件工程与协作学习"],
  ["叶舒然", "讲师", "数据系统与课程项目设计"],
  ["周行远", "教授", "人工智能产品设计"],
  ["沈知夏", "讲师", "Web 全栈开发与工程实践"],
  ["顾明川", "副教授", "移动应用与交互系统"],
  ["林砚秋", "实验师", "云原生应用与持续交付"],
  ["许清禾", "副教授", "机器学习工程化"],
  ["何景然", "讲师", "数据可视化与信息表达"],
  ["宋知远", "教授", "网络空间安全实践"],
  ["梁书衡", "副教授", "编译技术与程序分析"],
  ["郑一帆", "讲师", "操作系统与系统实现"],
  ["唐若川", "副教授", "数据库系统与优化"],
  ["韩以安", "讲师", "人机交互与原型评估"],
  ["白清越", "副教授", "软件测试与质量保证"],
  ["苏闻舟", "教授", "大数据平台与数据治理"],
  ["程南栀", "讲师", "自然语言处理应用"],
  ["谢星临", "副教授", "计算机视觉与多模态"],
  ["冯书言", "讲师", "分布式系统实践"],
  ["蒋明睿", "副教授", "信息系统分析与建模"],
  ["温知许", "讲师", "创新项目管理与教学设计"],
];

const teachers = Array.from({ length: TEACHER_COUNT }, (_, index) => {
  const n = index + 1;
  const profile = teacherProfiles[index] || [`教师${pad(n, 2)}`, "讲师", `课程方向 ${pad(n, 2)}`];
  return {
    id: `20990001${pad(n, 2)}`,
    role: Role.teacher,
    realName: profile[0],
    accountNo: `T-ACC-${pad(n, 4)}`,
    teacherNo: `T-ACC-${pad(n, 4)}`,
    title: profile[1],
    college: "计算机学院",
    researchDirection: profile[2],
  };
});

let assistantSerial = 1;
const assistants = teachers.flatMap((teacher, teacherIndex) => {
  const count = teacherIndex % 2 === 0 ? 1 : 2;
    return Array.from({ length: count }, () => {
      const n = assistantSerial++;
      return {
        id: `20990002${pad(n, 2)}`,
        role: Role.assistant,
        realName: `助教${pad(n, 2)}`,
        accountNo: `20990002${pad(n, 2)}`,
        ownerTeacherId: teacher.id,
      };
    });
  });

const majors = [
  ["软件工程", "软工"],
  ["数据科学与大数据技术", "数科"],
  ["人工智能", "智能"],
  ["网络空间安全", "网安"],
  ["计算机科学与技术", "计科"],
];

const surnames = ["陈", "林", "赵", "沈", "周", "吴", "何", "许", "郑", "唐", "梁", "顾", "叶", "宋", "韩", "白", "苏", "程", "谢", "冯", "蒋", "温", "陆", "夏", "徐", "邵", "罗", "高", "曹", "姚"];
const givenNames = ["一航", "若溪", "明远", "知夏", "景行", "念安", "清越", "星河", "以宁", "亦辰", "思远", "南栀", "舒然", "知远", "以安", "闻舟", "南乔", "书言", "星临", "明睿", "知许", "嘉禾", "清和", "云舟", "时安", "书衡", "予安", "清禾", "闻笙", "知礼"];
function studentName(index) {
  return surnames[index % surnames.length] + givenNames[Math.floor(index / surnames.length) % givenNames.length];
}

const students = Array.from({ length: STUDENT_COUNT }, (_, index) => {
  const n = index + 1;
  const [major, classPrefix] = majors[index % majors.length];
  const classNo = pad((Math.floor(index / majors.length) % 4) + 1, 2);
  return {
    id: `2099001${pad(n, 3)}`,
    role: Role.student,
    realName: studentName(index),
    accountNo: `2099001${pad(n, 3)}`,
    stuNo: `2099001${pad(n, 3)}`,
    grade: 2023,
    cohort: 2027,
    major,
    adminClass: `${classPrefix}23${classNo}`,
  };
});

const courseNames = [
  "软件工程综合实践",
  "数据系统设计实践",
  "AI 产品原型设计",
  "Web 全栈开发实践",
  "移动应用开发实践",
  "云原生应用实训",
  "机器学习工程实践",
  "数据可视化设计",
  "网络安全综合实验",
  "编译原理课程设计",
  "操作系统项目实践",
  "数据库系统课程设计",
  "人机交互原型设计",
  "软件测试与质量保障",
  "大数据平台实践",
  "自然语言处理应用",
  "计算机视觉应用实践",
  "分布式系统课程实践",
  "信息系统分析与设计",
  "创新项目实践",
];

const coursesPlan = Array.from({ length: COURSE_COUNT }, (_, index) => ({
  courseNo: `ACC-2026-${pad(index + 1, 2)}`,
  name: courseNames[index],
  teacher: teachers[index % teachers.length],
  projectCount: index % 5 === 0 ? 2 : 1,
  rosterStart: (index * 9) % students.length,
  rosterSize: index < 5 ? 35 : index < 12 ? 28 : 20,
}));

const COURSE_NOS = coursesPlan.map((course) => course.courseNo);
const USER_IDS = [
  academic.id,
  ...teachers.map((teacher) => teacher.id),
  ...assistants.map((assistant) => assistant.id),
  ...students.map((student) => student.id),
];
const LEGACY_USER_IDS = ["1000000001", "2022000001", "2023000001", "2023010001", "2023010102", "2023010103", "2023010104", "2023010105"];
const LEGACY_COURSE_NOS = ["1345", "124541"];

function rosterForCourse(plan) {
  return Array.from({ length: plan.rosterSize }, (_, offset) => students[(plan.rosterStart + offset) % students.length]);
}

function userBio(input) {
  if (input.role === Role.academic) {
    return "负责课程开设、教师指派、助教配置与成员导入，主要用于演示教务侧管理流程。";
  }
  if (input.role === Role.teacher) {
    return `${input.college}${input.title}，长期负责《${courseNames[teachers.findIndex((teacher) => teacher.id === input.id)] || "课程实践"}》相关教学与项目指导。`;
  }
  if (input.role === Role.assistant) {
    return "协助教师完成课程答疑、提交初审与批阅草稿整理，验收中主要展示助教工作台链路。";
  }
  return `${input.major}${input.adminClass}学生，当前参与课程项目协作、任务分工、材料提交与成绩查看。`;
}

function teacherDescription(input) {
  return `${input.realName}，${input.college}${input.title}。当前研究方向为“${input.researchDirection}”，本次验收数据中承担课程项目设计、阶段把关与最终成绩发布工作。`;
}

async function cleanup() {
  const legacyProfiles = await prisma.userProfile.findMany({
    where: {
      OR: [
        { userId: { in: LEGACY_USER_IDS } },
        { accountNo: { startsWith: "ACAD-MOCK-" } },
        { accountNo: { startsWith: "T-MOCK-" } },
        { realName: { contains: "Flow Student" } },
        { realName: { contains: "Mock" } },
        { bio: { contains: "UI-MOCK-STUDENT-2026" } },
        { bio: { contains: "avatar-chain-check" } },
        { email: { contains: "the.dan.com" } },
      ],
    },
    select: { userId: true },
  });
  const cleanupUserIds = [...new Set([...USER_IDS, ...LEGACY_USER_IDS, ...legacyProfiles.map((row) => row.userId)])];

  const courses = await prisma.course.findMany({
    where: {
      OR: [
        { courseNo: { in: COURSE_NOS } },
        { courseNo: { in: LEGACY_COURSE_NOS } },
        { courseNo: { startsWith: "CHAT-" } },
        { courseNo: { startsWith: "UI-MOCK-" } },
        { courseNo: { startsWith: "QA-" } },
        { name: { contains: "Chat Smoke" } },
        { name: { contains: "flow-check-course" } },
        { description: { contains: "Temporary chat smoke test course" } },
        { description: { contains: "UI-MOCK-STUDENT-2026" } },
        { description: { contains: "real api flow verification" } },
        { createdBy: { in: cleanupUserIds } },
      ],
    },
    select: { id: true },
  });
  const courseIds = courses.map((row) => row.id);
  const assignments = await prisma.assignment.findMany({
    where: {
      OR: [
        { courseId: { in: courseIds } },
        { createdBy: { in: cleanupUserIds } },
        { description: { contains: "UI-MOCK-STUDENT-2026" } },
      ],
    },
    select: { id: true },
  });
  const assignmentIds = assignments.map((row) => row.id);
  const stages = await prisma.assignmentStage.findMany({
    where: { OR: [{ assignmentId: { in: assignmentIds } }, { createdBy: { in: cleanupUserIds } }] },
    select: { id: true },
  });
  const stageIds = stages.map((row) => row.id);
  const groups = await prisma.group.findMany({
    where: { OR: [{ assignmentId: { in: assignmentIds } }, { createdBy: { in: cleanupUserIds } }] },
    select: { id: true },
  });
  const groupIds = groups.map((row) => row.id);
  const submissions = await prisma.submission.findMany({
    where: {
      OR: [
        { groupId: { in: groupIds } },
        { stageId: { in: stageIds } },
        { createdBy: { in: cleanupUserIds } },
        { submittedBy: { in: cleanupUserIds } },
      ],
    },
    select: { id: true },
  });
  const submissionIds = submissions.map((row) => row.id);
  const grades = await prisma.stageGrade.findMany({
    where: {
      OR: [
        { courseId: { in: courseIds } },
        { submissionId: { in: submissionIds } },
        { graderId: { in: cleanupUserIds } },
        { publishedBy: { in: cleanupUserIds } },
      ],
    },
    select: { id: true },
  });
  const gradeIds = grades.map((row) => row.id);
  const conversations = await prisma.chatConversation.findMany({
    where: {
      OR: [
        { scopeType: ConversationScopeType.course, scopeId: { in: courseIds } },
        { scopeType: ConversationScopeType.group, scopeId: { in: groupIds } },
        { createdBy: { in: cleanupUserIds } },
      ],
    },
    select: { id: true },
  });
  const conversationIds = conversations.map((row) => row.id);
  const messages = await prisma.chatMessage.findMany({
    where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: { in: cleanupUserIds } }] },
    select: { id: true },
  });
  const messageIds = messages.map((row) => row.id);

  await prisma.chatMessage.updateMany({ where: { id: { in: messageIds } }, data: { replyToId: null } });
  await prisma.chatFile.deleteMany({ where: { messageId: { in: messageIds } } });
  await prisma.chatConversationRead.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { userId: { in: cleanupUserIds } }] } });
  await prisma.chatMessage.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: { in: cleanupUserIds } }] } });
  await prisma.chatConversation.deleteMany({ where: { id: { in: conversationIds } } });
  await prisma.userNotification.deleteMany({ where: { userId: { in: cleanupUserIds } } });
  await prisma.stageGradeLog.deleteMany({ where: { OR: [{ stageGradeId: { in: gradeIds } }, { operatorId: { in: cleanupUserIds } }] } });
  await prisma.stageGrade.deleteMany({ where: { id: { in: gradeIds } } });
  await prisma.review.deleteMany({ where: { OR: [{ submissionId: { in: submissionIds } }, { reviewerId: { in: cleanupUserIds } }] } });
  await prisma.submissionFile.deleteMany({ where: { OR: [{ submissionId: { in: submissionIds } }, { uploadedBy: { in: cleanupUserIds } }] } });
  await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } });
  await prisma.miniTask.deleteMany({ where: { OR: [{ groupId: { in: groupIds } }, { createdBy: { in: cleanupUserIds } }, { assigneeId: { in: cleanupUserIds } }] } });
  await prisma.groupLeaderTransferRequest.deleteMany({
    where: { OR: [{ assignmentId: { in: assignmentIds } }, { fromUserId: { in: cleanupUserIds } }, { toUserId: { in: cleanupUserIds } }] },
  });
  await prisma.groupJoinRequest.deleteMany({
    where: { OR: [{ assignmentId: { in: assignmentIds } }, { applicantUserId: { in: cleanupUserIds } }, { reviewedBy: { in: cleanupUserIds } }] },
  });
  await prisma.groupMember.deleteMany({ where: { OR: [{ groupId: { in: groupIds } }, { userId: { in: cleanupUserIds } }] } });
  await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
  await prisma.assignmentGroupConfig.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
  await prisma.assignmentStage.deleteMany({ where: { id: { in: stageIds } } });
  await prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.assistantBinding.deleteMany({ where: { OR: [{ courseId: { in: courseIds } }, { assistantUserId: { in: cleanupUserIds } }, { teacherUserId: { in: cleanupUserIds } }] } });
  await prisma.courseMember.deleteMany({ where: { OR: [{ courseId: { in: courseIds } }, { userId: { in: cleanupUserIds } }] } });
  await prisma.courseTeacher.deleteMany({ where: { OR: [{ courseId: { in: courseIds } }, { userId: { in: cleanupUserIds } }] } });
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
  await prisma.teacherAssistant.deleteMany({ where: { OR: [{ assistantUserId: { in: cleanupUserIds } }, { teacherUserId: { in: cleanupUserIds } }] } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: cleanupUserIds } } });
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: cleanupUserIds } } });
  await prisma.userProfile.deleteMany({ where: { userId: { in: cleanupUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
}

async function createUser(input, passwordHash) {
  await prisma.user.create({
    data: {
      id: input.id,
      role: input.role,
      passwordHash,
      isActive: true,
      forceChangePassword: false,
      profile: {
        create: {
          realName: input.realName,
          accountNo: input.accountNo,
          bio: userBio(input),
        },
      },
      ...(input.role === Role.student ? {
        studentProfile: {
          create: {
            stuNo: input.stuNo,
            grade: input.grade,
            cohort: input.cohort,
            major: input.major,
            adminClass: input.adminClass,
          },
        },
      } : {}),
      ...(input.role === Role.teacher ? {
        teacherProfile: {
          create: {
            teacherNo: input.teacherNo,
            title: input.title,
            college: input.college,
            researchDirection: input.researchDirection,
            description: teacherDescription(input),
          },
        },
      } : {}),
    },
  });
}

async function createMessage(conversationId, senderId, content, index, replyToId = null) {
  return prisma.chatMessage.create({
    data: {
      conversationId,
      senderId,
      content,
      replyToId,
      eventId: `${TAG}-${conversationId.toString()}-${index}`,
      traceId: `${TAG}-trace-${conversationId.toString()}-${index}`,
      createdAt: at(10 + index, 10),
    },
  });
}

async function seedUsers(passwordHash) {
  await createUser(academic, passwordHash);
  for (const teacher of teachers) await createUser(teacher, passwordHash);
  for (const assistant of assistants) await createUser(assistant, passwordHash);
  for (const student of students) await createUser(student, passwordHash);

  await prisma.teacherAssistant.createMany({
    data: assistants.map((assistant) => ({
      teacherUserId: assistant.ownerTeacherId,
      assistantUserId: assistant.id,
    })),
  });
}

async function seedCourses() {
  const courseRows = [];
  for (const plan of coursesPlan) {
    const course = await prisma.course.create({
      data: {
        courseNo: plan.courseNo,
        name: plan.name,
        academicYear: 2026,
        semester: 2,
        description: `${plan.name}：面向课程协作验收准备的预置课程，包含项目、阶段、小组、提交与批阅示例数据。`,
        status: CourseStatus.active,
        createdBy: academic.id,
      },
    });
    courseRows.push({ ...plan, course });
  }

  await prisma.courseTeacher.createMany({
    data: courseRows.map((row) => ({
      courseId: row.course.id,
      userId: row.teacher.id,
      role: CourseTeacherRole.lead,
    })),
  });

  const assistantBindingRows = courseRows.flatMap((row) => {
    const ownedAssistants = assistants.filter((assistant) => assistant.ownerTeacherId === row.teacher.id);
    return ownedAssistants.map((assistant) => ({
      assistantUserId: assistant.id,
      teacherUserId: row.teacher.id,
      courseId: row.course.id,
    }));
  });
  await prisma.assistantBinding.createMany({ data: assistantBindingRows, skipDuplicates: true });

  const memberRows = courseRows.flatMap((row) => rosterForCourse(row).map((student) => ({
    courseId: row.course.id,
    userId: student.id,
    status: CourseMemberStatus.active,
  })));
  await prisma.courseMember.createMany({ data: memberRows, skipDuplicates: true });

  return courseRows;
}

async function seedProjectsAndStages(courseRows) {
  const assignmentRows = [];

  for (const row of courseRows) {
    for (let i = 1; i <= row.projectCount; i += 1) {
      const assignment = await prisma.assignment.create({
        data: {
          courseId: row.course.id,
          title: row.projectCount === 1 ? `${row.name}课程项目` : `${row.name}项目 ${i}`,
          description: i === 1 ? "围绕课程核心主题开展小组协作，覆盖分组、任务、提交和批阅流程。" : "作为第二个扩展项目，用于验证项目切换、阶段切换和多项目展示逻辑。",
          status: AssignmentStatus.active,
          createdBy: row.teacher.id,
        },
      });
      assignmentRows.push({ ...row, assignment, projectNo: i });
    }
  }

  await prisma.assignmentGroupConfig.createMany({
    data: assignmentRows.map((row) => ({
      assignmentId: row.assignment.id,
      groupFormStart: at(1),
      groupFormEnd: at(8),
      groupMinSize: 2,
      groupMaxSize: 5,
      maxGroups: 10,
      regroupPolicy: RegroupPolicy.teacher_decides,
      updatedBy: row.teacher.id,
    })),
  });

  const stageRows = [];
  for (const row of assignmentRows) {
    const stageCount = row.projectNo === 1 ? 2 : 1;
    for (let stageNo = 1; stageNo <= stageCount; stageNo += 1) {
      const status = stageNo === 1 ? StageStatus.closed : row.course.courseNo.endsWith("03") ? StageStatus.planned : StageStatus.open;
      const stage = await prisma.assignmentStage.create({
        data: {
          assignmentId: row.assignment.id,
          stageNo,
          title: stageNo === 1 ? "需求与分工" : "实现与演示",
          description: stageNo === 1 ? "提交需求说明、任务分工与阶段计划。" : "提交实现说明、演示材料与阶段成果包。",
          startAt: at(stageNo === 1 ? 2 : 16),
          dueAt: at(stageNo === 1 ? 15 : 28),
          weight: stageNo === 1 ? "40.00" : "60.00",
          submissionDesc: stageNo === 1 ? "提交需求说明文档与成员分工表" : "提交可运行演示、说明文档与关键截图",
          acceptCriteria: stageNo === 1 ? "需求边界清楚、角色分工明确、风险识别完整" : "功能可运行、演示闭环完整、说明材料清晰",
          status,
          createdBy: row.teacher.id,
        },
      });
      stageRows.push({ ...row, stage, stageNo });
    }
  }

  return { assignmentRows, stageRows };
}

async function seedGroupsTasksAndChats(courseRows, assignmentRows, stageRows) {
  const groups = [];
  const firstProjectRows = assignmentRows.filter((row) => row.projectNo === 1).slice(0, 12);

  for (const row of firstProjectRows) {
    const roster = rosterForCourse(row);
    for (let groupNo = 1; groupNo <= 2; groupNo += 1) {
      const leader = roster[(groupNo - 1) * 3];
      const group = await prisma.group.create({
        data: {
          assignmentId: row.assignment.id,
          groupNo,
          name: `${row.course.courseNo}第${groupNo}组`,
          status: GroupStatus.active,
          createdBy: leader.id,
        },
      });
      groups.push({ ...row, group, groupNo, members: roster.slice((groupNo - 1) * 3, (groupNo - 1) * 3 + 3) });
    }
  }

  await prisma.groupMember.createMany({
    data: groups.flatMap((row) => row.members.map((member, index) => ({
      groupId: row.group.id,
      assignmentId: row.assignment.id,
      userId: member.id,
      role: index === 0 ? GroupMemberRole.leader : GroupMemberRole.member,
    }))),
  });

  const taskRows = [];
  for (const row of groups.slice(0, 10)) {
    const stage = stageRows.find((stageRow) => stageRow.assignment.id === row.assignment.id && stageRow.stageNo === 2)
      ?? stageRows.find((stageRow) => stageRow.assignment.id === row.assignment.id);
    taskRows.push(
      {
        groupId: row.group.id,
        stageId: stage.stage.id,
        title: "准备阶段演示脚本",
        description: "高优先级任务，用于串联成员分工、提醒通知和进度状态。",
        assigneeId: row.members[0].id,
        assigneeIds: [row.members[0].id, row.members[1].id],
        priority: MiniTaskPriority.high,
        status: MiniTaskStatus.in_progress,
        dueAt: at(22),
        createdBy: row.members[0].id,
      },
      {
        groupId: row.group.id,
        stageId: stage.stage.id,
        title: "整理验收截图与说明",
        description: "补齐材料归档，便于后续答辩与教师复核。",
        assigneeId: row.members[1].id,
        assigneeIds: [row.members[1].id],
        priority: MiniTaskPriority.medium,
        status: row.groupNo === 1 ? MiniTaskStatus.todo : MiniTaskStatus.done,
        dueAt: at(24),
        createdBy: row.members[0].id,
      },
    );
  }
  await prisma.miniTask.createMany({ data: taskRows });

  const courseConversations = [];
  for (const row of courseRows) {
    const conversation = await prisma.chatConversation.create({
      data: {
        scopeType: ConversationScopeType.course,
        scopeId: row.course.id,
        roomKey: `course:${row.course.id}`,
        status: ConversationStatus.active,
        createdBy: null,
      },
    });
    courseConversations.push({ ...row, conversation });
  }

  let messageIndex = 1;
  for (const row of courseConversations.slice(0, 8)) {
    await createMessage(row.conversation.id, row.teacher.id, `${row.course.courseNo} 课程公告：请各组按阶段要求及时提交材料。`, messageIndex++);
    const assistant = assistants.find((item) => item.ownerTeacherId === row.teacher.id);
    if (assistant) {
      await createMessage(row.conversation.id, assistant.id, "助教提醒：提交后会进入待批阅列表，请确保附件与说明完整。", messageIndex++);
    }
  }

  for (const row of groups.slice(0, 8)) {
    const conversation = await prisma.chatConversation.create({
      data: {
        scopeType: ConversationScopeType.group,
        scopeId: row.group.id,
        roomKey: `group:${row.group.id}`,
        status: ConversationStatus.active,
        createdBy: row.members[0].id,
      },
    });
    const first = await createMessage(conversation.id, row.members[0].id, "我们先把演示脚本和分工确认下来。", messageIndex++);
    await createMessage(conversation.id, row.members[1].id, "我来负责截图和材料整理，提交前再一起复查。", messageIndex++, first.id);
    await prisma.chatConversationRead.createMany({
      data: [
        { conversationId: conversation.id, userId: row.members[0].id, lastMessageId: first.id, lastReadAt: at(14) },
        { conversationId: conversation.id, userId: row.members[1].id, lastMessageId: first.id, lastReadAt: at(14) },
      ],
    });
  }

  return groups;
}

async function seedReviewAndGrades(groups, stageRows) {
  const group1 = groups[0];
  const group2 = groups[1];
  const group3 = groups[2];
  const stage11 = stageRows.find((row) => row.assignment.id === group1.assignment.id && row.stageNo === 1);
  const stage12 = stageRows.find((row) => row.assignment.id === group1.assignment.id && row.stageNo === 2);
  const stage22 = stageRows.find((row) => row.assignment.id === group2.assignment.id && row.stageNo === 2) ?? stage12;
  const stage31 = stageRows.find((row) => row.assignment.id === group3.assignment.id && row.stageNo === 1);
  const assistant = assistants.find((item) => item.ownerTeacherId === group1.teacher.id);

  const subPublished = await prisma.submission.create({
    data: {
      groupId: group1.group.id,
      stageId: stage11.stage.id,
      attemptNo: 1,
      status: SubmissionStatus.approved,
      summary: "需求与分工材料完整，已完成教师评分发布。",
      payload: { kind: "doc", url: "acceptance://large/requirements" },
      submittedAt: at(14),
      createdBy: group1.members[0].id,
      submittedBy: group1.members[0].id,
    },
  });
  const subDraft = await prisma.submission.create({
    data: {
      groupId: group1.group.id,
      stageId: stage12.stage.id,
      attemptNo: 1,
      status: SubmissionStatus.reviewed,
      summary: "实现与演示材料已批阅，当前保留成绩草稿待教师发布。",
      payload: { kind: "demo", url: "acceptance://large/demo" },
      submittedAt: at(21),
      createdBy: group1.members[0].id,
      submittedBy: group1.members[1].id,
    },
  });
  const subPending = await prisma.submission.create({
    data: {
      groupId: group2.group.id,
      stageId: stage22.stage.id,
      attemptNo: 1,
      status: SubmissionStatus.under_review,
      summary: "蓝图小组已提交实现材料，当前处于待批阅状态。",
      payload: { kind: "demo", url: "acceptance://large/pending" },
      submittedAt: at(21),
      createdBy: group2.members[0].id,
      submittedBy: group2.members[0].id,
    },
  });
  const subNeedsChanges = await prisma.submission.create({
    data: {
      groupId: group3.group.id,
      stageId: stage31.stage.id,
      attemptNo: 1,
      status: SubmissionStatus.needs_changes,
      summary: "质量回归报告存在缺项，教师已退回修改。",
      payload: { kind: "report", url: "acceptance://large/quality" },
      submittedAt: at(18),
      createdBy: group3.members[0].id,
      submittedBy: group3.members[1].id,
    },
  });

  await prisma.submissionFile.createMany({
    data: [
      { submissionId: subPublished.id, objectKey: `${TAG}/requirements.pdf`, name: "需求与分工.pdf", size: 204800n, mimeType: "application/pdf", slotKey: "document", uploadedBy: group1.members[0].id },
      { submissionId: subDraft.id, objectKey: `${TAG}/demo.zip`, name: "实现演示.zip", size: 1024000n, mimeType: "application/zip", slotKey: "archive", uploadedBy: group1.members[1].id },
      { submissionId: subPending.id, objectKey: `${TAG}/pending.zip`, name: "蓝图小组演示.zip", size: 512000n, mimeType: "application/zip", slotKey: "archive", uploadedBy: group2.members[0].id },
    ],
  });

  const reviewPublished = await prisma.review.create({
    data: {
      submissionId: subPublished.id,
      reviewerId: group1.teacher.id,
      status: ReviewStatus.submitted,
      decision: ReviewDecision.approved,
      score: "88.00",
      rubric: { completeness: 34, collaboration: 28, quality: 26 },
      comment: "需求完整，分工清晰，可以作为已发布成绩示例。",
      submittedAt: at(15),
    },
  });
  const reviewDraft = await prisma.review.create({
    data: {
      submissionId: subDraft.id,
      reviewerId: assistant.id,
      status: ReviewStatus.submitted,
      decision: ReviewDecision.approved,
      score: "91.00",
      rubric: { demo: 36, quality: 35, explanation: 20 },
      comment: "演示闭环完整，建议教师复核后再发布成绩。",
      submittedAt: at(22),
    },
  });
  await prisma.review.create({
    data: {
      submissionId: subPending.id,
      reviewerId: assistant.id,
      status: ReviewStatus.draft,
      comment: "助教已领取，等待补充正式批阅意见。",
    },
  });
  await prisma.review.create({
    data: {
      submissionId: subNeedsChanges.id,
      reviewerId: group3.teacher.id,
      status: ReviewStatus.submitted,
      decision: ReviewDecision.needs_changes,
      score: "72.00",
      rubric: { cases: 24, defects: 20, conclusion: 28 },
      comment: "缺少关键回归用例，请补充后再次提交。",
      submittedAt: at(19),
    },
  });

  const publishedGrade = await prisma.stageGrade.create({
    data: {
      submissionId: subPublished.id,
      groupId: group1.group.id,
      stageId: stage11.stage.id,
      courseId: group1.course.id,
      score: "90.00",
      status: GradeStatus.published,
      graderId: group1.teacher.id,
      publishedBy: group1.teacher.id,
      publishedAt: at(16),
      sourceReviewId: reviewPublished.id,
    },
  });
  const draftGrade = await prisma.stageGrade.create({
    data: {
      submissionId: subDraft.id,
      groupId: group1.group.id,
      stageId: stage12.stage.id,
      courseId: group1.course.id,
      score: "91.00",
      status: GradeStatus.draft,
      graderId: assistant.id,
      sourceReviewId: reviewDraft.id,
    },
  });

  await prisma.stageGradeLog.createMany({
    data: [
      { stageGradeId: publishedGrade.id, action: GradeAction.created, beforeScore: null, afterScore: "88.00", operatorId: group1.teacher.id, reason: "根据批阅结果创建成绩" },
      { stageGradeId: publishedGrade.id, action: GradeAction.published, beforeScore: "88.00", afterScore: "88.00", operatorId: group1.teacher.id, reason: "教师发布阶段成绩" },
      { stageGradeId: publishedGrade.id, action: GradeAction.adjusted, beforeScore: "88.00", afterScore: "90.00", operatorId: group1.teacher.id, reason: "教师复核后补充加分" },
      { stageGradeId: draftGrade.id, action: GradeAction.created, beforeScore: null, afterScore: "91.00", operatorId: assistant.id, reason: "助教批阅后生成成绩草稿" },
    ],
  });
}

async function main() {
  await cleanup();
  const passwordHash = await argon2.hash(PASSWORD);
  await seedUsers(passwordHash);
  const courseRows = await seedCourses();
  const { assignmentRows, stageRows } = await seedProjectsAndStages(courseRows);
  const groups = await seedGroupsTasksAndChats(courseRows, assignmentRows, stageRows);
  await seedReviewAndGrades(groups, stageRows);

  console.log(`Seeded ${students.length} students, ${teachers.length} teachers, ${assistants.length} assistants.`);
  console.log(`Seeded ${courseRows.length} courses and ${assignmentRows.length} existing projects.`);
  console.log(`Password for all acceptance users: ${PASSWORD}`);
  console.log("Teacher 2099000101 has exactly one assistant and can be used for assistant-opening validation.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
