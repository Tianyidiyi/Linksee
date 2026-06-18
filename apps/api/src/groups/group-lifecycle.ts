import { GroupStatus } from "@prisma/client";
import { prisma } from "../infra/prisma.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";

export type GroupLifecycleRecord = {
  id: bigint;
  assignmentId: bigint;
  courseId: bigint;
  groupNo: number;
  name: string | null;
  createdBy: string;
  status: GroupStatus;
};

function getGroupLabel(group: Pick<GroupLifecycleRecord, "groupNo" | "name">): string {
  return group.name?.trim() || `第 ${group.groupNo} 组`;
}

async function createGroupLifecycleAnnouncement(input: {
  group: GroupLifecycleRecord;
  operatorId: string;
  content: string;
  subType?: string;
}) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { scopeType_scopeId: { scopeType: "group", scopeId: input.group.id } },
    select: { id: true, roomKey: true },
  });
  if (!conversation) {
    return null;
  }

  const files = { type: "announcement", subType: input.subType ?? "group_status" };
  const event = createEventEnvelope("group.message.created", {
    groupId: input.group.id.toString(),
    assignmentId: input.group.assignmentId.toString(),
    courseId: input.group.courseId.toString(),
    senderId: input.operatorId,
    content: input.content,
    messageType: "announcement",
    files,
    mentions: [],
    replyToId: null,
  });

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      senderId: input.operatorId,
      content: input.content,
      files,
      eventId: event.id,
      traceId: event.traceId,
    },
    select: { id: true },
  });

  return {
    roomKey: conversation.roomKey,
    outboundEvent: {
      ...event,
      payload: {
        ...event.payload,
        messageId: message.id.toString(),
      },
    },
  };
}

export async function publishGroupSystemAnnouncement(input: {
  group: GroupLifecycleRecord;
  operatorId: string;
  content: string;
  subType?: string;
}): Promise<void> {
  const announcement = await createGroupLifecycleAnnouncement(input);
  if (announcement) {
    await pushSocketEvent(announcement.roomKey, announcement.outboundEvent);
  }
}

export async function syncSingleGroupLifecycle(input: {
  group: GroupLifecycleRecord;
  nextStatus: GroupStatus;
  operatorId: string;
}): Promise<void> {
  const { group, nextStatus, operatorId } = input;
  const groupLabel = getGroupLabel(group);

  if (group.status !== GroupStatus.active && nextStatus === GroupStatus.active) {
    await prisma.chatConversation.upsert({
      where: { scopeType_scopeId: { scopeType: "group", scopeId: group.id } },
      update: { status: "active" },
      create: {
        scopeType: "group",
        scopeId: group.id,
        roomKey: `group:${group.id.toString()}`,
        createdBy: group.createdBy,
        status: "active",
      },
    });

    const lifecycleAnnouncement = await createGroupLifecycleAnnouncement({
      group,
      operatorId,
      content: `系统通知：${groupLabel}已确认成组，小组会话已启用`,
    });
    if (lifecycleAnnouncement) {
      await pushSocketEvent(lifecycleAnnouncement.roomKey, lifecycleAnnouncement.outboundEvent);
    }
    return;
  }

  if (group.status !== GroupStatus.archived && nextStatus === GroupStatus.archived) {
    const lifecycleAnnouncement = await createGroupLifecycleAnnouncement({
      group,
      operatorId,
      content: `系统通知：${groupLabel}已结束，小组会话已归档`,
    });

    await prisma.chatConversation.updateMany({
      where: { scopeType: "group", scopeId: group.id },
      data: { status: "archived" },
    });

    if (lifecycleAnnouncement) {
      await pushSocketEvent(lifecycleAnnouncement.roomKey, lifecycleAnnouncement.outboundEvent);
    }
  }
}

export async function archiveAssignmentGroups(assignmentId: bigint, operatorId: string): Promise<number> {
  const groups = await prisma.group.findMany({
    where: {
      assignmentId,
      status: { not: GroupStatus.archived },
    },
    select: {
      id: true,
      assignmentId: true,
      groupNo: true,
      name: true,
      createdBy: true,
      status: true,
      assignment: { select: { courseId: true } },
    },
  });

  for (const group of groups) {
    await prisma.group.update({
      where: { id: group.id },
      data: { status: GroupStatus.archived },
    });

    await syncSingleGroupLifecycle({
      group: {
        id: group.id,
        assignmentId: group.assignmentId,
        courseId: group.assignment.courseId,
        groupNo: group.groupNo,
        name: group.name,
        createdBy: group.createdBy,
        status: group.status,
      },
      nextStatus: GroupStatus.archived,
      operatorId,
    });
  }

  return groups.length;
}

export async function archiveCourseGroups(courseId: bigint, operatorId: string): Promise<number> {
  const groups = await prisma.group.findMany({
    where: {
      assignment: { courseId },
      status: { not: GroupStatus.archived },
    },
    select: {
      id: true,
      assignmentId: true,
      groupNo: true,
      name: true,
      createdBy: true,
      status: true,
      assignment: { select: { courseId: true } },
    },
  });

  for (const group of groups) {
    await prisma.group.update({
      where: { id: group.id },
      data: { status: GroupStatus.archived },
    });

    await syncSingleGroupLifecycle({
      group: {
        id: group.id,
        assignmentId: group.assignmentId,
        courseId: group.assignment.courseId,
        groupNo: group.groupNo,
        name: group.name,
        createdBy: group.createdBy,
        status: group.status,
      },
      nextStatus: GroupStatus.archived,
      operatorId,
    });
  }

  return groups.length;
}
