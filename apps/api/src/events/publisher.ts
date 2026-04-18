import type { EventEnvelope } from "../shared/contracts";

export interface EventPublisher {
  publishToSocket(event: EventEnvelope, room: string): Promise<void>;
  publishToWorker(event: EventEnvelope, topic: string): Promise<void>;
}

// 说明：真实实现中应在事务提交后调用 publish，避免脏推送。
export async function publishAfterCommit(
  publisher: EventPublisher,
  event: EventEnvelope,
  target: { kind: "socket"; room: string } | { kind: "worker"; topic: string },
): Promise<void> {
  if (target.kind === "socket") {
    await publisher.publishToSocket(event, target.room);
    return;
  }
  await publisher.publishToWorker(event, target.topic);
}
