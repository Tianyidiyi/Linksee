import { describe, expect, it } from "@jest/globals";
import { createEventEnvelope } from "../../../apps/api/src/events/event-builder.js";

describe("events/event-builder", () => {
  it("createEventEnvelope should build envelope with default producer", () => {
    const payload = { groupId: "1", status: "submitted" };
    const event = createEventEnvelope("submission.created", payload);

    expect(event.name).toBe("submission.created");
    expect(event.payload).toEqual(payload);
    expect(event.producer).toBe("api");
    expect(typeof event.id).toBe("string");
    expect(typeof event.traceId).toBe("string");
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.traceId.length).toBeGreaterThan(0);
    expect(new Date(event.occurredAt).toString()).not.toBe("Invalid Date");
  });

  it("createEventEnvelope should support custom producer", () => {
    const event = createEventEnvelope("grade.published", { gradeId: "9" }, "worker");
    expect(event.producer).toBe("worker");
  });
});

