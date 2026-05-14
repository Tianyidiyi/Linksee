import { describe, expect, it } from "@jest/globals";
import type { EventEnvelope, SocketAck } from "../../../apps/api/src/shared/contracts.js";

describe("shared/contracts", () => {
  it("should allow valid EventEnvelope shape", () => {
    const payload = { hello: "world" };
    const envelope: EventEnvelope<typeof payload> = {
      id: "evt-1",
      name: "submission.created",
      occurredAt: new Date().toISOString(),
      producer: "api",
      traceId: "trace-1",
      payload,
    };
    expect(envelope.payload.hello).toBe("world");
  });

  it("should allow SocketAck variations", () => {
    const okAck: SocketAck = { ok: true, eventId: "evt-1" };
    const badAck: SocketAck = { ok: false, reason: "forbidden" };
    expect(okAck.ok).toBe(true);
    expect(badAck.ok).toBe(false);
  });
});

