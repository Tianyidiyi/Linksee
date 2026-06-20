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
  realName: "Acceptance Academic",
  accountNo: "2099000001",
};

const teachers = Array.from({ length: TEACHER_COUNT }, (_, index) => {
  const n = index + 1;
  return {
    id: `20990001${pad(n, 2)}`,
    role: Role.teacher,
    realName: `Acceptance Teacher ${pad(n, 2)}`,
    accountNo: `T-ACC-${pad(n, 4)}`,
    teacherNo: `T-ACC-${pad(n, 4)}`,
    title: index % 4 === 0 ? "Professor" : index % 4 === 1 ? "Associate Professor" : index % 4 === 2 ? "Lecturer" : "Lab Instructor",
    college: "School of Computer Science",
    researchDirection: `Acceptance course direction ${pad(n, 2)}`,
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
      realName: `Acceptance Assistant ${pad(n, 2)}`,
      accountNo: `20990002${pad(n, 2)}`,
      ownerTeacherId: teacher.id,
    };
  });
});

const majors = [
  ["Software Engineering", "SE"],
  ["Data Science", "DS"],
  ["Artificial Intelligence", "AI"],
  ["Cyber Security", "CSec"],
  ["Computer Science", "CST"],
];

const students = Array.from({ length: STUDENT_COUNT }, (_, index) => {
  const n = index + 1;
  const [major, classPrefix] = majors[index % majors.length];
  const classNo = pad((Math.floor(index / majors.length) % 4) + 1, 2);
  return {
    id: `2099001${pad(n, 3)}`,
    role: Role.student,
    realName: `Acceptance Student ${pad(n, 3)}`,
    accountNo: `2099001${pad(n, 3)}`,
    stuNo: `2099001${pad(n, 3)}`,
    grade: 2023,
    cohort: 2027,
    major,
    adminClass: `${classPrefix}23${classNo}`,
  };
});

const courseNames = [
  "Software Engineering Practice",
  "Data System Design",
  "AI Product Prototype",
  "Web Full Stack Development",
  "Mobile Application Development",
  "Cloud Native Application Practice",
  "Machine Learning Engineering",
  "Data Visualization",
  "Cyber Security Lab",
  "Compiler Practice",
  "Operating System Project",
  "Database Project",
  "Human Computer Interaction",
  "Software Testing and Quality",
  "Big Data Platform Practice",
  "Natural Language Processing",
  "Computer Vision Application",
  "Distributed System Practice",
  "Information System Analysis",
  "Innovation Project Practice",
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

function rosterForCourse(plan) {
  return Array.from({ length: plan.rosterSize }, (_, offset) => students[(plan.rosterStart + offset) % students.length]);
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
  const stages = await prisma.assignmentStage.findMany({
    where: { OR: [{ assignmentId: { in: assignmentIds } }, { createdBy: { in: USER_IDS } }] },
    select: { id: true },
  });
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
          bio: `${TAG} account`,
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
            description: `${TAG} teacher profile`,
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
        description: `${TAG}; existing course with ${plan.projectCount} seeded project(s)`,
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
          title: `${row.name} Project ${i}`,
          description: `${TAG}; existing project ${i}`,
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
          title: stageNo === 1 ? "Planning and Division" : "Implementation and Demo",
          description: `${TAG}; existing stage ${stageNo}`,
          startAt: at(stageNo === 1 ? 2 : 16),
          dueAt: at(stageNo === 1 ? 15 : 28),
          weight: stageNo === 1 ? "40.00" : "60.00",
          submissionDesc: stageNo === 1 ? "Submit planning document" : "Submit demo package",
          acceptCriteria: stageNo === 1 ? "Scope, roles, risks" : "Runnable demo and clear report",
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
          name: `Acceptance Group ${row.course.courseNo}-${groupNo}`,
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
        title: "Prepare demo script",
        description: `${TAG}; high priority task`,
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
        title: "Collect acceptance screenshots",
        description: `${TAG}; normal task`,
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
    await createMessage(row.conversation.id, row.teacher.id, `Announcement for ${row.course.courseNo}: please submit by stage deadline.`, messageIndex++);
    const assistant = assistants.find((item) => item.ownerTeacherId === row.teacher.id);
    if (assistant) {
      await createMessage(row.conversation.id, assistant.id, "Assistant reminder: submitted work will enter pending review.", messageIndex++);
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
    const first = await createMessage(conversation.id, row.members[0].id, "Let's finish the demo script first.", messageIndex++);
    await createMessage(conversation.id, row.members[1].id, "I will handle screenshots and upload package.", messageIndex++, first.id);
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
      summary: `${TAG}; published grade submission`,
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
      summary: `${TAG}; reviewed submission with draft grade`,
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
      summary: `${TAG}; pending review submission`,
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
      summary: `${TAG}; needs changes submission`,
      payload: { kind: "report", url: "acceptance://large/quality" },
      submittedAt: at(18),
      createdBy: group3.members[0].id,
      submittedBy: group3.members[1].id,
    },
  });

  await prisma.submissionFile.createMany({
    data: [
      { submissionId: subPublished.id, objectKey: `${TAG}/requirements.pdf`, name: "requirements.pdf", size: 204800n, mimeType: "application/pdf", slotKey: "document", uploadedBy: group1.members[0].id },
      { submissionId: subDraft.id, objectKey: `${TAG}/demo.zip`, name: "demo.zip", size: 1024000n, mimeType: "application/zip", slotKey: "archive", uploadedBy: group1.members[1].id },
      { submissionId: subPending.id, objectKey: `${TAG}/pending.zip`, name: "pending.zip", size: 512000n, mimeType: "application/zip", slotKey: "archive", uploadedBy: group2.members[0].id },
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
      comment: "Complete planning and clear division.",
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
      comment: "Good demo; teacher should review before publishing.",
      submittedAt: at(22),
    },
  });
  await prisma.review.create({
    data: {
      submissionId: subPending.id,
      reviewerId: assistant.id,
      status: ReviewStatus.draft,
      comment: "Claimed by assistant; review not submitted yet.",
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
      comment: "Missing critical test cases.",
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
      { stageGradeId: publishedGrade.id, action: GradeAction.created, beforeScore: null, afterScore: "88.00", operatorId: group1.teacher.id, reason: "Created from review" },
      { stageGradeId: publishedGrade.id, action: GradeAction.published, beforeScore: "88.00", afterScore: "88.00", operatorId: group1.teacher.id, reason: "Published stage grade" },
      { stageGradeId: publishedGrade.id, action: GradeAction.adjusted, beforeScore: "88.00", afterScore: "90.00", operatorId: group1.teacher.id, reason: "Adjusted after teacher review" },
      { stageGradeId: draftGrade.id, action: GradeAction.created, beforeScore: null, afterScore: "91.00", operatorId: assistant.id, reason: "Assistant-created draft to expose role policy gap" },
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

