import { describe, expect, it, jest } from "@jest/globals";
import { publishAfterCommit, type EventPublisher } from "../../../apps/api/src/events/publisher.js";
import type { EventEnvelope } from "../../../apps/api/src/shared/contracts.js";

describe("events/publisher", () => {
  const event: EventEnvelope = {
    id: "e1",
    name: "submission.created",
    occurredAt: new Date().toISOString(),
    producer: "api",
    traceId: "t1",
    payload: { ok: true },
  };

  it("should publish to socket target", async () => {
    const publisher: EventPublisher = {
      publishToSocket: jest.fn(async () => undefined),
      publishToWorker: jest.fn(async () => undefined),
    };

    await publishAfterCommit(publisher, event, { kind: "socket", room: "group:1" });

    expect(publisher.publishToSocket).toHaveBeenCalledWith(event, "group:1");
    expect(publisher.publishToWorker).not.toHaveBeenCalled();
  });

  it("should publish to worker target", async () => {
    const publisher: EventPublisher = {
      publishToSocket: jest.fn(async () => undefined),
      publishToWorker: jest.fn(async () => undefined),
    };

    await publishAfterCommit(publisher, event, { kind: "worker", topic: "material.process" });

    expect(publisher.publishToWorker).toHaveBeenCalledWith(event, "material.process");
    expect(publisher.publishToSocket).not.toHaveBeenCalled();
  });
});

