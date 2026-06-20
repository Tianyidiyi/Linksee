import { Prisma } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";

export type CreateUserNotificationInput = {
  userIds: string[];
  type: string;
  title: string;
  content: string;
  scopeType?: string | null;
  scopeId?: bigint | null;
  courseId?: bigint | null;
  assignmentId?: bigint | null;
  groupId?: bigint | null;
  miniTaskId?: bigint | null;
  relatedEventId?: string | null;
  payload?: Prisma.InputJsonValue | null;
};

function uniqueUserIds(userIds: string[]): string[] {
  return Array.from(new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean)));
}

export async function createUserNotifications(input: CreateUserNotificationInput): Promise<number> {
  const userIds = uniqueUserIds(input.userIds);
  const title = String(input.title || "").trim();
  const content = String(input.content || "").trim();
  if (userIds.length === 0 || !title || !content) return 0;

  let targetUserIds = userIds;
  if (input.relatedEventId) {
    const existing = await prisma.userNotification.findMany({
      where: {
        userId: { in: userIds },
        relatedEventId: input.relatedEventId,
      },
      select: { userId: true },
    });
    const existingUserIds = new Set(existing.map((item) => item.userId));
    targetUserIds = userIds.filter((userId) => !existingUserIds.has(userId));
  }
  if (targetUserIds.length === 0) return 0;

  const result = await prisma.userNotification.createMany({
    data: targetUserIds.map((userId) => ({
      userId,
      type: input.type,
      title,
      content,
      scopeType: input.scopeType ?? null,
      scopeId: input.scopeId ?? null,
      courseId: input.courseId ?? null,
      assignmentId: input.assignmentId ?? null,
      groupId: input.groupId ?? null,
      miniTaskId: input.miniTaskId ?? null,
      relatedEventId: input.relatedEventId ?? null,
      payload: input.payload ?? Prisma.JsonNull,
    })),
    skipDuplicates: true,
  });
  await Promise.all(
    targetUserIds.map(async (userId) => {
      const event = createEventEnvelope("system.notification.created", {
        userId,
        type: input.type,
        title,
        content,
        scopeType: input.scopeType ?? null,
        scopeId: input.scopeId ? input.scopeId.toString() : null,
        courseId: input.courseId ? input.courseId.toString() : null,
        assignmentId: input.assignmentId ? input.assignmentId.toString() : null,
        groupId: input.groupId ? input.groupId.toString() : null,
        miniTaskId: input.miniTaskId ? input.miniTaskId.toString() : null,
        relatedEventId: input.relatedEventId ?? null,
      });
      await pushSocketEvent(`user:${userId}`, event);
    }),
  );
  return result.count;
}
