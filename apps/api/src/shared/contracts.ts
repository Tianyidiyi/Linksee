export type HttpErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export type EventName =
  | "task.created"
  | "task.updated"
  | "task.comment.created"
  | "chat.message.created"
  | "chat.read.updated"
  | "feed.notice.created"
  | "doc.uploaded"
  | "doc.process.requested"
  | "doc.process.completed";

export interface EventEnvelope<T = unknown> {
  id: string;
  name: EventName;
  occurredAt: string;
  producer: string;
  traceId: string;
  payload: T;
}

export interface SocketAck {
  ok: boolean;
  eventId?: string;
  reason?: string;
}
