import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { EventEnvelope } from "../../../apps/api/src/shared/contracts.js";

const cacheRealtimeEventMock = jest.fn(async () => undefined);
const cacheRealtimeEventWithArgsMock = cacheRealtimeEventMock as jest.MockedFunction<
  (roomKey: string, event: EventEnvelope) => Promise<void>
>;

jest.mock("../../../apps/api/src/events/realtime-cache.js", () => ({
  cacheRealtimeEvent: (roomKey: string, event: EventEnvelope) =>
    cacheRealtimeEventWithArgsMock(roomKey, event),
}));

import {
  pushSocketEvent,
  registerRealtimeGateway,
  removeUserFromRoom,
} from "../../../apps/api/src/events/realtime-publisher.js";

describe("events/realtime-publisher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const event: EventEnvelope = {
    id: "e1",
    name: "submission.created",
    occurredAt: new Date().toISOString(),
    producer: "api",
    traceId: "t1",
    payload: { ok: true },
  };

  it("should no-op when gateway not registered", async () => {
    await pushSocketEvent("group:1", event);
    await removeUserFromRoom("u1", "group:1");
    expect(cacheRealtimeEventMock).not.toHaveBeenCalled();
  });

  it("should cache and push after gateway registered", async () => {
    const push = jest.fn(async () => undefined);
    const remove = jest.fn(async () => undefined);
    registerRealtimeGateway({
      push,
      removeUserFromRoom: remove,
    } as any);

    await pushSocketEvent("group:1", event);
    await removeUserFromRoom("u1", "group:1");

    expect(cacheRealtimeEventMock).toHaveBeenCalledWith("group:1", event);
    expect(push).toHaveBeenCalledWith("group:1", event);
    expect(remove).toHaveBeenCalledWith("u1", "group:1");
  });
});
