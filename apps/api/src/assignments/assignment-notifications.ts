import { prisma } from "../infra/prisma.js";
import { ensureCourseConversation, getConversationId } from "../collaboration/chat-helpers.js";
import { createEventEnvelope } from "../events/event-builder.js";
import { pushSocketEvent } from "../events/realtime-publisher.js";

export async function publishCourseSystemAnnouncement(input: {
  courseId: bigint;
  senderId: string;
  content: string;
}): Promise<void> {
  const content = String(input.content || "").trim();
  if (!content) return;

  await ensureCourseConversation(input.courseId);
  const conversationId = await getConversationId("course", input.courseId);
  if (!conversationId) return;

  const files = { type: "announcement" };
  const event = createEventEnvelope("course.message.created", {
    courseId: input.courseId.toString(),
    senderId: input.senderId,
    content,
    messageType: "announcement",
    files,
    mentions: [],
    replyToId: null,
  });

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId: input.senderId,
      content,
      files,
      eventId: event.id,
      traceId: event.traceId,
    },
    select: { id: true },
  });

  await pushSocketEvent(`course:${input.courseId.toString()}`, {
    ...event,
    payload: {
      ...event.payload,
      messageId: message.id.toString(),
    },
  });
}
