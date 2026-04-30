export type RealtimeEventName =
  | "assignment.created"
  | "stage.created"
  | "group.message.created"
  | "group.minitask.updated"
  | "submission.created"
  | "submission.status.updated"
  | "review.created"
  | "grade.published"
  | "course.dashboard.updated";

export interface RealtimeEventEnvelope<T = unknown> {
  id: string;
  name: RealtimeEventName;
  occurredAt: string;
  traceId: string;
  payload: T;
}

export function shouldApplyEvent(seenIds: Set<string>, event: RealtimeEventEnvelope): boolean {
  if (seenIds.has(event.id)) {
    return false;
  }
  seenIds.add(event.id);
  return true;
}
