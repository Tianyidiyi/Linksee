import { describe, expect, it } from "@jest/globals";
import { eventCatalog } from "../../../apps/api/src/events/event-catalog.js";

describe("events/event-catalog", () => {
  it("should provide metadata for all event names", () => {
    expect(Object.keys(eventCatalog).length).toBeGreaterThan(0);
    for (const [eventName, meta] of Object.entries(eventCatalog)) {
      expect(eventName.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(["socket", "worker"]).toContain(meta.channel);
    }
  });

  it("should keep expected worker events", () => {
    expect(eventCatalog["material.uploaded"].channel).toBe("worker");
    expect(eventCatalog["material.process.requested"].channel).toBe("worker");
    expect(eventCatalog["material.process.completed"].channel).toBe("worker");
  });
});

