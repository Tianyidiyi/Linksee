import { MiniTaskStatus, Prisma } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";
import { getConversationId } from "../collaboration/chat-helpers.js";

function normalizeAssigneeIds(assigneeId: string | null, assigneeIds: Prisma.JsonValue | null): string[] {
  const result = new Set<string>();
  if (assigneeId) result.add(assigneeId);
  if (Array.isArray(assigneeIds)) {
    for (const item of assigneeIds) {
      if (typeof item === "string" && item.trim()) result.add(item.trim());
    }
  }
  return Array.from(result);
}

type ReminderType = "reminder_1d" | "reminder_1h" | "overdue";

async function notifyTask(
  task: {
    id: bigint;
    title: string;
    groupId: bigint;
    dueAt: Date | null;
    assigneeId: string | null;
    assigneeIds: Prisma.JsonValue | null;
    group: { assignmentId: bigint; assignment: { courseId: bigint } };
  },
  type: ReminderType,
): Promise<void> {
  const mentions = normalizeAssigneeIds(task.assigneeId, task.assigneeIds);
  if (mentions.length === 0) return;

  const conversationId = await getConversationId("group", task.groupId);
  if (!conversationId) return;

  const dueAtText = task.dueAt ? task.dueAt.toISOString() : "未设置";
  const prefix = type === "reminder_1d" ? "任务截止前1天提醒" : type === "reminder_1h" ? "任务截止前1小时提醒" : "任务已逾期提醒";
  const content = `${prefix}：${task.title}，截止时间 ${dueAtText}，请尽快处理。`;

  const senderId = "0000000000";
  const event = createEventEnvelope("group.message.created", {
    groupId: task.groupId.toString(),
    assignmentId: task.group.assignmentId.toString(),
    courseId: task.group.assignment.courseId.toString(),
    senderId,
    content,
    messageType: "text",
    files: null,
    mentions,
    replyToId: null,
  });

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId,
      content,
      mentions: mentions as unknown as Prisma.InputJsonValue,
      files: Prisma.JsonNull,
      eventId: event.id,
      traceId: event.traceId,
    },
    select: { id: true },
  });

  await pushSocketEvent(`group:${task.groupId.toString()}`, {
    ...event,
    payload: { ...event.payload, messageId: message.id.toString() },
  });
}

export async function runMiniTaskReminderJob(now = new Date()): Promise<{ oneDay: number; oneHour: number; overdue: number }> {
  const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);
  const [oneDayTasks, oneHourTasks, overdueTasks] = await Promise.all([
    prisma.miniTask.findMany({
      where: {
        dueAt: { gte: new Date(now.getTime() + 24 * 60 * 60 * 1000), lt: new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000) },
        status: { in: [MiniTaskStatus.todo, MiniTaskStatus.in_progress] },
        reminder1dSentAt: null,
      },
      select: {
        id: true,
        title: true,
        groupId: true,
        dueAt: true,
        assigneeId: true,
        assigneeIds: true,
        group: { select: { assignmentId: true, assignment: { select: { courseId: true } } } },
      },
    }),
    prisma.miniTask.findMany({
      where: {
        dueAt: { gte: new Date(now.getTime() + 60 * 60 * 1000), lt: new Date(windowEnd.getTime() + 60 * 60 * 1000) },
        status: { in: [MiniTaskStatus.todo, MiniTaskStatus.in_progress] },
        reminder1hSentAt: null,
      },
      select: {
        id: true,
        title: true,
        groupId: true,
        dueAt: true,
        assigneeId: true,
        assigneeIds: true,
        group: { select: { assignmentId: true, assignment: { select: { courseId: true } } } },
      },
    }),
    prisma.miniTask.findMany({
      where: {
        dueAt: { lt: now },
        status: { in: [MiniTaskStatus.todo, MiniTaskStatus.in_progress] },
        overdueSentAt: null,
      },
      select: {
        id: true,
        title: true,
        groupId: true,
        dueAt: true,
        assigneeId: true,
        assigneeIds: true,
        group: { select: { assignmentId: true, assignment: { select: { courseId: true } } } },
      },
    }),
  ]);

  for (const task of oneDayTasks) {
    await notifyTask(task, "reminder_1d");
    await prisma.miniTask.update({ where: { id: task.id }, data: { reminder1dSentAt: now } });
  }
  for (const task of oneHourTasks) {
    await notifyTask(task, "reminder_1h");
    await prisma.miniTask.update({ where: { id: task.id }, data: { reminder1hSentAt: now } });
  }
  for (const task of overdueTasks) {
    await notifyTask(task, "overdue");
    await prisma.miniTask.update({ where: { id: task.id }, data: { overdueSentAt: now } });
  }

  return { oneDay: oneDayTasks.length, oneHour: oneHourTasks.length, overdue: overdueTasks.length };
}

if (process.argv[1] && process.argv[1].endsWith("minitask-reminder-job.ts")) {
  runMiniTaskReminderJob()
    .then((result) => {
      console.log(
        `[minitask-reminder] 1d=${result.oneDay} 1h=${result.oneHour} overdue=${result.overdue}`,
      );
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error("[minitask-reminder] failed", err);
      process.exit(1);
    });
}

