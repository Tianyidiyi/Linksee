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
const TAG = "ACCEPTANCE_20260619";
const PASSWORD = "Accept123!";
const USER_IDS = [
  "2099000001",
  "2099000101",
  "2099000102",
  "2099000201",
  "2099001001",
  "2099001002",
  "2099001003",
  "2099001004",
  "2099001005",
  "2099001006",
  "2099001007",
  "2099001008",
  "2099001009",
  "2099001010",
  "2099001011",
  "2099001012",
];
const COURSE_NOS = ["ACC-2026-01", "ACC-2026-02", "ACC-2026-03"];

const people = {
  academic: { id: "2099000001", role: Role.academic, realName: "验收教务", accountNo: "2099000001" },
  teacherA: { id: "2099000101", role: Role.teacher, realName: "陆嘉明", accountNo: "T-ACC-0101", teacherNo: "T-ACC-0101", title: "副教授", college: "计算机学院", researchDirection: "软件工程与协作学习" },
  teacherB: { id: "2099000102", role: Role.teacher, realName: "叶舒然", accountNo: "T-ACC-0102", teacherNo: "T-ACC-0102", title: "讲师", college: "计算机学院", researchDirection: "数据系统与课程项目设计" },
  assistant: { id: "2099000201", role: Role.assistant, realName: "宋助教", accountNo: "2099000201" },
};

const students = [
  ["2099001001", "陈一航", "软件工程", "软工2301"],
  ["2099001002", "林若溪", "软件工程", "软工2301"],
  ["2099001003", "赵明远", "软件工程", "软工2301"],
  ["2099001004", "沈知夏", "软件工程", "软工2302"],
  ["2099001005", "周景行", "软件工程", "软工2302"],
  ["2099001006", "吴念安", "数据科学", "数科2301"],
  ["2099001007", "何清越", "数据科学", "数科2301"],
  ["2099001008", "许星河", "数据科学", "数科2302"],
  ["2099001009", "郑以宁", "人工智能", "智能2301"],
  ["2099001010", "唐亦辰", "人工智能", "智能2301"],
  ["2099001011", "梁思远", "人工智能", "智能2302"],
  ["2099001012", "顾南栀", "人工智能", "智能2302"],
].map(([id, realName, major, adminClass]) => ({
  id,
  role: Role.student,
  realName,
  accountNo: id,
  stuNo: id,
  grade: 2023,
  cohort: 2027,
  major,
  adminClass,
}));

function at(day, hour = 9) {
  return new Date(Date.UTC(2026, 5, day, hour, 0, 0));
}

async function cleanup() {
  const courses = await prisma.course.findMany({
    where: { OR: [{ courseNo: { in: COURSE_NOS } }, { createdBy: { in: USER_IDS } }] },
    select: { id: true },
  });
  const courseIds = courses.map((row) => row.id);
  const assignments = await prisma.assignment.findMany({
    where: { OR: [{ courseId: { in: courseIds } }, { createdBy: { in: USER_IDS } }] },
    select: { id: true },
  });
  const assignmentIds = assignments.map((row) => row.id);
  const stages = await prisma.assignmentStage.findMany({ where: { assignmentId: { in: assignmentIds } }, select: { id: true } });
  const stageIds = stages.map((row) => row.id);
  const groups = await prisma.group.findMany({
    where: { OR: [{ assignmentId: { in: assignmentIds } }, { createdBy: { in: USER_IDS } }] },
    select: { id: true },
  });
  const groupIds = groups.map((row) => row.id);
  const submissions = await prisma.submission.findMany({
    where: {
      OR: [
        { groupId: { in: groupIds } },
        { stageId: { in: stageIds } },
        { createdBy: { in: USER_IDS } },
        { submittedBy: { in: USER_IDS } },
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
        { graderId: { in: USER_IDS } },
        { publishedBy: { in: USER_IDS } },
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
        { createdBy: { in: USER_IDS } },
      ],
    },
    select: { id: true },
  });
  const conversationIds = conversations.map((row) => row.id);
  const messages = await prisma.chatMessage.findMany({
    where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: { in: USER_IDS } }] },
    select: { id: true },
  });
  const messageIds = messages.map((row) => row.id);

  await prisma.chatMessage.updateMany({ where: { id: { in: messageIds } }, data: { replyToId: null } });
  await prisma.chatFile.deleteMany({ where: { messageId: { in: messageIds } } });
  await prisma.chatConversationRead.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { userId: { in: USER_IDS } }] } });
  await prisma.chatMessage.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: { in: USER_IDS } }] } });
  await prisma.chatConversation.deleteMany({ where: { id: { in: conversationIds } } });
  await prisma.stageGradeLog.deleteMany({ where: { OR: [{ stageGradeId: { in: gradeIds } }, { operatorId: { in: USER_IDS } }] } });
  await prisma.stageGrade.deleteMany({ where: { id: { in: gradeIds } } });
  await prisma.review.deleteMany({ where: { OR: [{ submissionId: { in: submissionIds } }, { reviewerId: { in: USER_IDS } }] } });
  await prisma.submissionFile.deleteMany({ where: { OR: [{ submissionId: { in: submissionIds } }, { uploadedBy: { in: USER_IDS } }] } });
  await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } });
  await prisma.miniTask.deleteMany({ where: { OR: [{ groupId: { in: groupIds } }, { createdBy: { in: USER_IDS } }, { assigneeId: { in: USER_IDS } }] } });
  await prisma.groupLeaderTransferRequest.deleteMany({
    where: { OR: [{ assignmentId: { in: assignmentIds } }, { fromUserId: { in: USER_IDS } }, { toUserId: { in: USER_IDS } }] },
  });
  await prisma.groupJoinRequest.deleteMany({
    where: { OR: [{ assignmentId: { in: assignmentIds } }, { applicantUserId: { in: USER_IDS } }, { reviewedBy: { in: USER_IDS } }] },
  });
  await prisma.groupMember.deleteMany({ where: { OR: [{ groupId: { in: groupIds } }, { userId: { in: USER_IDS } }] } });
  await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
  await prisma.assignmentGroupConfig.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
  await prisma.assignmentStage.deleteMany({ where: { id: { in: stageIds } } });
  await prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.assistantBinding.deleteMany({ where: { OR: [{ courseId: { in: courseIds } }, { assistantUserId: { in: USER_IDS } }, { teacherUserId: { in: USER_IDS } }] } });
  await prisma.courseMember.deleteMany({ where: { OR: [{ courseId: { in: courseIds } }, { userId: { in: USER_IDS } }] } });
  await prisma.courseTeacher.deleteMany({ where: { OR: [{ courseId: { in: courseIds } }, { userId: { in: USER_IDS } }] } });
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
  await prisma.teacherAssistant.deleteMany({ where: { OR: [{ assistantUserId: { in: USER_IDS } }, { teacherUserId: { in: USER_IDS } }] } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await prisma.teacherProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await prisma.userProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
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
          bio: `${TAG} 验收账号`,
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
            description: `${TAG} 验收教师档案`,
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

async function main() {
  await cleanup();
  const passwordHash = await argon2.hash(PASSWORD);

  await createUser(people.academic, passwordHash);
  await createUser(people.teacherA, passwordHash);
  await createUser(people.teacherB, passwordHash);
  await createUser(people.assistant, passwordHash);
  for (const student of students) await createUser(student, passwordHash);

  await prisma.teacherAssistant.create({
    data: { teacherUserId: people.teacherA.id, assistantUserId: people.assistant.id },
  });

  const course1 = await prisma.course.create({
    data: {
      courseNo: "ACC-2026-01",
      name: "软件工程实践验收课",
      academicYear: 2026,
      semester: 2,
      description: `${TAG} 2 个项目，覆盖批阅、草稿、发布、调整`,
      status: CourseStatus.active,
      createdBy: people.academic.id,
    },
  });
  const course2 = await prisma.course.create({
    data: {
      courseNo: "ACC-2026-02",
      name: "数据系统设计验收课",
      academicYear: 2026,
      semester: 2,
      description: `${TAG} 1 个项目，覆盖名单与小组`,
      status: CourseStatus.active,
      createdBy: people.academic.id,
    },
  });
  const course3 = await prisma.course.create({
    data: {
      courseNo: "ACC-2026-03",
      name: "AI 产品原型验收课",
      academicYear: 2026,
      semester: 2,
      description: `${TAG} 1 个项目，覆盖学生成绩可见性`,
      status: CourseStatus.active,
      createdBy: people.academic.id,
    },
  });

  await prisma.courseTeacher.createMany({
    data: [
      { courseId: course1.id, userId: people.teacherA.id, role: CourseTeacherRole.lead },
      { courseId: course2.id, userId: people.teacherB.id, role: CourseTeacherRole.lead },
      { courseId: course3.id, userId: people.teacherA.id, role: CourseTeacherRole.lead },
    ],
  });
  await prisma.assistantBinding.create({
    data: { assistantUserId: people.assistant.id, teacherUserId: people.teacherA.id, courseId: course1.id },
  });

  const courseMembers = [
    ...students.slice(0, 8).map((s) => ({ courseId: course1.id, userId: s.id, status: CourseMemberStatus.active })),
    ...students.slice(4, 10).map((s) => ({ courseId: course2.id, userId: s.id, status: CourseMemberStatus.active })),
    ...students.slice(8, 12).map((s) => ({ courseId: course3.id, userId: s.id, status: CourseMemberStatus.active })),
  ];
  await prisma.courseMember.createMany({ data: courseMembers, skipDuplicates: true });

  const assign1 = await prisma.assignment.create({
    data: { courseId: course1.id, title: "团队协作看板", description: `${TAG} 验收项目 1`, status: AssignmentStatus.active, createdBy: people.teacherA.id },
  });
  const assign2 = await prisma.assignment.create({
    data: { courseId: course1.id, title: "质量回归报告", description: `${TAG} 验收项目 2`, status: AssignmentStatus.active, createdBy: people.teacherA.id },
  });
  const assign3 = await prisma.assignment.create({
    data: { courseId: course2.id, title: "订单数据建模", description: `${TAG} 验收项目`, status: AssignmentStatus.active, createdBy: people.teacherB.id },
  });
  const assign4 = await prisma.assignment.create({
    data: { courseId: course3.id, title: "AI 助手原型", description: `${TAG} 验收项目`, status: AssignmentStatus.active, createdBy: people.teacherA.id },
  });

  await prisma.assignmentGroupConfig.createMany({
    data: [assign1, assign2, assign3, assign4].map((assignment) => ({
      assignmentId: assignment.id,
      groupFormStart: at(1),
      groupFormEnd: at(8),
      groupMinSize: 2,
      groupMaxSize: 4,
      maxGroups: 4,
      regroupPolicy: RegroupPolicy.teacher_decides,
      updatedBy: assignment.createdBy,
    })),
  });

  const s11 = await prisma.assignmentStage.create({
    data: { assignmentId: assign1.id, stageNo: 1, title: "需求与分工", description: `${TAG} 阶段 1`, startAt: at(2), dueAt: at(15), weight: "40.00", submissionDesc: "提交需求说明与任务分工", acceptCriteria: "包含需求、分工、风险", status: StageStatus.closed, createdBy: people.teacherA.id },
  });
  const s12 = await prisma.assignmentStage.create({
    data: { assignmentId: assign1.id, stageNo: 2, title: "实现与演示", description: `${TAG} 阶段 2`, startAt: at(16), dueAt: at(28), weight: "60.00", submissionDesc: "提交实现说明和演示材料", acceptCriteria: "功能可运行且说明清楚", status: StageStatus.open, createdBy: people.teacherA.id },
  });
  const s21 = await prisma.assignmentStage.create({
    data: { assignmentId: assign2.id, stageNo: 1, title: "回归报告", description: `${TAG} 单阶段`, startAt: at(5), dueAt: at(26), weight: "100.00", submissionDesc: "提交质量回归报告", acceptCriteria: "包含用例、缺陷、结论", status: StageStatus.open, createdBy: people.teacherA.id },
  });
  const s31 = await prisma.assignmentStage.create({
    data: { assignmentId: assign3.id, stageNo: 1, title: "概念模型", description: `${TAG} 单阶段`, startAt: at(3), dueAt: at(24), weight: "100.00", submissionDesc: "提交 ER 图和说明", acceptCriteria: "实体、关系、约束完整", status: StageStatus.open, createdBy: people.teacherB.id },
  });
  const s41 = await prisma.assignmentStage.create({
    data: { assignmentId: assign4.id, stageNo: 1, title: "原型方案", description: `${TAG} 计划阶段`, startAt: at(20), dueAt: at(30), weight: "100.00", submissionDesc: "提交原型方案", acceptCriteria: "场景和交互闭环", status: StageStatus.planned, createdBy: people.teacherA.id },
  });

  const g1 = await prisma.group.create({ data: { assignmentId: assign1.id, groupNo: 1, name: "启明星小组", status: GroupStatus.active, createdBy: "2099001001" } });
  const g2 = await prisma.group.create({ data: { assignmentId: assign1.id, groupNo: 2, name: "蓝图小组", status: GroupStatus.active, createdBy: "2099001004" } });
  const g3 = await prisma.group.create({ data: { assignmentId: assign2.id, groupNo: 1, name: "质量哨兵", status: GroupStatus.active, createdBy: "2099001001" } });
  const g4 = await prisma.group.create({ data: { assignmentId: assign3.id, groupNo: 1, name: "范式小组", status: GroupStatus.active, createdBy: "2099001005" } });
  const g5 = await prisma.group.create({ data: { assignmentId: assign4.id, groupNo: 1, name: "星火原型组", status: GroupStatus.forming, createdBy: "2099001009" } });

  await prisma.groupMember.createMany({
    data: [
      { groupId: g1.id, assignmentId: assign1.id, userId: "2099001001", role: GroupMemberRole.leader },
      { groupId: g1.id, assignmentId: assign1.id, userId: "2099001002", role: GroupMemberRole.member },
      { groupId: g1.id, assignmentId: assign1.id, userId: "2099001003", role: GroupMemberRole.member },
      { groupId: g2.id, assignmentId: assign1.id, userId: "2099001004", role: GroupMemberRole.leader },
      { groupId: g2.id, assignmentId: assign1.id, userId: "2099001005", role: GroupMemberRole.member },
      { groupId: g2.id, assignmentId: assign1.id, userId: "2099001006", role: GroupMemberRole.member },
      { groupId: g3.id, assignmentId: assign2.id, userId: "2099001001", role: GroupMemberRole.leader },
      { groupId: g3.id, assignmentId: assign2.id, userId: "2099001007", role: GroupMemberRole.member },
      { groupId: g4.id, assignmentId: assign3.id, userId: "2099001005", role: GroupMemberRole.leader },
      { groupId: g4.id, assignmentId: assign3.id, userId: "2099001008", role: GroupMemberRole.member },
      { groupId: g5.id, assignmentId: assign4.id, userId: "2099001009", role: GroupMemberRole.leader },
      { groupId: g5.id, assignmentId: assign4.id, userId: "2099001010", role: GroupMemberRole.member },
    ],
  });

  await prisma.miniTask.createMany({
    data: [
      { groupId: g1.id, stageId: s12.id, title: "补齐阶段演示脚本", description: `${TAG} 高优先级`, assigneeId: "2099001001", assigneeIds: ["2099001001", "2099001002"], priority: MiniTaskPriority.high, status: MiniTaskStatus.in_progress, dueAt: at(22), createdBy: "2099001001" },
      { groupId: g1.id, stageId: s12.id, title: "整理接口验收截图", description: `${TAG}`, assigneeId: "2099001002", assigneeIds: ["2099001002"], priority: MiniTaskPriority.medium, status: MiniTaskStatus.todo, dueAt: at(24), createdBy: "2099001001" },
      { groupId: g2.id, stageId: s11.id, title: "提交需求文档", description: `${TAG}`, assigneeId: "2099001004", assigneeIds: ["2099001004", "2099001005"], priority: MiniTaskPriority.low, status: MiniTaskStatus.done, dueAt: at(12), createdBy: "2099001004" },
      { groupId: g3.id, stageId: s21.id, title: "取消重复用例整理", description: `${TAG}`, assigneeId: "2099001007", assigneeIds: ["2099001007"], priority: MiniTaskPriority.medium, status: MiniTaskStatus.cancelled, dueAt: at(21), createdBy: "2099001001" },
    ],
  });

  const c1Chat = await prisma.chatConversation.create({ data: { scopeType: ConversationScopeType.course, scopeId: course1.id, roomKey: `course:${course1.id}`, status: ConversationStatus.active, createdBy: null } });
  const g1Chat = await prisma.chatConversation.create({ data: { scopeType: ConversationScopeType.group, scopeId: g1.id, roomKey: `group:${g1.id}`, status: ConversationStatus.active, createdBy: "2099001001" } });
  const msg1 = await createMessage(c1Chat.id, people.teacherA.id, "验收课程公告：请各组按阶段提交材料。", 1);
  const msg2 = await createMessage(c1Chat.id, people.assistant.id, "助教提醒：提交后会进入待批阅列表。", 2, msg1.id);
  const msg3 = await createMessage(g1Chat.id, "2099001001", "我们先完成演示脚本，再补截图。", 3);
  await createMessage(g1Chat.id, "2099001002", "收到，我负责接口截图。", 4, msg3.id);
  await prisma.chatConversationRead.createMany({
    data: [
      { conversationId: c1Chat.id, userId: people.teacherA.id, lastMessageId: msg2.id, lastReadAt: at(13) },
      { conversationId: c1Chat.id, userId: "2099001001", lastMessageId: msg1.id, lastReadAt: at(12) },
      { conversationId: g1Chat.id, userId: "2099001001", lastMessageId: msg3.id, lastReadAt: at(14) },
    ],
  });

  const subPublished = await prisma.submission.create({
    data: { groupId: g1.id, stageId: s11.id, attemptNo: 1, status: SubmissionStatus.approved, summary: `${TAG} 已发布成绩提交`, payload: { kind: "doc", url: "acceptance://requirements" }, submittedAt: at(14), createdBy: "2099001001", submittedBy: "2099001001" },
  });
  const subDraft = await prisma.submission.create({
    data: { groupId: g1.id, stageId: s12.id, attemptNo: 1, status: SubmissionStatus.reviewed, summary: `${TAG} 已批阅待发布`, payload: { kind: "demo", url: "acceptance://demo" }, submittedAt: at(21), createdBy: "2099001001", submittedBy: "2099001002" },
  });
  const subPending = await prisma.submission.create({
    data: { groupId: g2.id, stageId: s12.id, attemptNo: 1, status: SubmissionStatus.under_review, summary: `${TAG} 待批阅提交`, payload: { kind: "demo", url: "acceptance://pending" }, submittedAt: at(21), createdBy: "2099001004", submittedBy: "2099001004" },
  });
  const subNeedsChanges = await prisma.submission.create({
    data: { groupId: g3.id, stageId: s21.id, attemptNo: 1, status: SubmissionStatus.needs_changes, summary: `${TAG} 需修改提交`, payload: { kind: "report", url: "acceptance://quality" }, submittedAt: at(18), createdBy: "2099001001", submittedBy: "2099001007" },
  });

  await prisma.submissionFile.createMany({
    data: [
      { submissionId: subPublished.id, objectKey: `${TAG}/requirements.pdf`, name: "需求与分工.pdf", size: 204800n, mimeType: "application/pdf", slotKey: "document", uploadedBy: "2099001001" },
      { submissionId: subDraft.id, objectKey: `${TAG}/demo.zip`, name: "实现演示.zip", size: 1024000n, mimeType: "application/zip", slotKey: "archive", uploadedBy: "2099001002" },
      { submissionId: subPending.id, objectKey: `${TAG}/pending.zip`, name: "蓝图小组演示.zip", size: 512000n, mimeType: "application/zip", slotKey: "archive", uploadedBy: "2099001004" },
    ],
  });

  const reviewPublished = await prisma.review.create({
    data: { submissionId: subPublished.id, reviewerId: people.teacherA.id, status: ReviewStatus.submitted, decision: ReviewDecision.approved, score: "88.00", rubric: { completeness: 34, collaboration: 28, quality: 26 }, comment: "需求完整，分工清晰。", submittedAt: at(15) },
  });
  const reviewDraft = await prisma.review.create({
    data: { submissionId: subDraft.id, reviewerId: people.assistant.id, status: ReviewStatus.submitted, decision: ReviewDecision.approved, score: "91.00", rubric: { demo: 36, quality: 35, explanation: 20 }, comment: "演示闭环完整，建议教师复核后发布。", submittedAt: at(22) },
  });
  await prisma.review.create({
    data: { submissionId: subPending.id, reviewerId: people.assistant.id, status: ReviewStatus.draft, comment: "已领取，待补充批阅意见。" },
  });
  await prisma.review.create({
    data: { submissionId: subNeedsChanges.id, reviewerId: people.teacherA.id, status: ReviewStatus.submitted, decision: ReviewDecision.needs_changes, score: "72.00", rubric: { cases: 24, defects: 20, conclusion: 28 }, comment: "缺少关键回归用例，请补充。", submittedAt: at(19) },
  });

  const publishedGrade = await prisma.stageGrade.create({
    data: { submissionId: subPublished.id, groupId: g1.id, stageId: s11.id, courseId: course1.id, score: "90.00", status: GradeStatus.published, graderId: people.teacherA.id, publishedBy: people.teacherA.id, publishedAt: at(16), sourceReviewId: reviewPublished.id },
  });
  const draftGrade = await prisma.stageGrade.create({
    data: { submissionId: subDraft.id, groupId: g1.id, stageId: s12.id, courseId: course1.id, score: "91.00", status: GradeStatus.draft, graderId: people.assistant.id, sourceReviewId: reviewDraft.id },
  });

  await prisma.stageGradeLog.createMany({
    data: [
      { stageGradeId: publishedGrade.id, action: GradeAction.created, beforeScore: null, afterScore: "88.00", operatorId: people.teacherA.id, reason: "根据批阅创建成绩" },
      { stageGradeId: publishedGrade.id, action: GradeAction.published, beforeScore: "88.00", afterScore: "88.00", operatorId: people.teacherA.id, reason: "发布阶段成绩" },
      { stageGradeId: publishedGrade.id, action: GradeAction.adjusted, beforeScore: "88.00", afterScore: "90.00", operatorId: people.teacherA.id, reason: "复核后加分" },
      { stageGradeId: draftGrade.id, action: GradeAction.created, beforeScore: null, afterScore: "91.00", operatorId: people.assistant.id, reason: "助教批阅生成草稿，用于暴露第 6 点权限差异" },
    ],
  });

  console.log(`Acceptance data seeded. Password for all acceptance users: ${PASSWORD}`);
  console.log(`Courses: ${COURSE_NOS.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
