export type HttpErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export type EventName =
  | "assignment.created"
  | "stage.created"
  | "course.message.created"
  | "course.message.updated"
  | "course.message.deleted"
  | "course.member.updated"
  | "group.message.created"
  | "group.message.updated"
  | "group.message.deleted"
  | "group.member.updated"
  | "group.minitask.updated"
  | "submission.created"
  | "submission.status.updated"
  | "review.created"
  | "grade.published"
  | "course.dashboard.updated"
  | "material.uploaded"
  | "material.process.requested"
  | "material.process.completed";

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
