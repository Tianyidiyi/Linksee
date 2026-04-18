export type RealtimeEventName =
  | "task.created"
  | "task.updated"
  | "task.comment.created"
  | "chat.message.created"
  | "chat.read.updated"
  | "feed.notice.created";

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
