import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { redis } from "../../../apps/api/src/infra/redis.js";
import {
  ackRealtimeEvent,
  cacheRealtimeEvent,
  filterAckedEvents,
  loadReplayEvents,
} from "../../../apps/api/src/events/realtime-cache.js";
import type { EventEnvelope } from "../../../apps/api/src/shared/contracts.js";

describe("events/realtime-cache", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("cacheRealtimeEvent should push/trim/expire via pipeline", async () => {
    const rpush = jest.fn();
    const ltrim = jest.fn();
    const expire = jest.fn();
    const exec = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);
    const multi = jest.spyOn(redis, "multi").mockReturnValue({ rpush, ltrim, expire, exec } as any);

    const event: EventEnvelope = {
      id: "e1",
      name: "submission.created",
      occurredAt: new Date().toISOString(),
      producer: "api",
      traceId: "t1",
      payload: { a: 1 },
    };
    await cacheRealtimeEvent("group:1", event);

    expect(multi).toHaveBeenCalled();
    expect(rpush).toHaveBeenCalledWith("realtime:room:group:1", JSON.stringify(event));
    expect(ltrim).toHaveBeenCalledWith("realtime:room:group:1", -500, -1);
    expect(expire).toHaveBeenCalledWith("realtime:room:group:1", 30 * 60);
    expect(exec).toHaveBeenCalled();
  });

  it("loadReplayEvents should parse and filter invalid entries", async () => {
    jest.spyOn(redis, "lrange").mockResolvedValue([
      JSON.stringify({ id: "a", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} }),
      "invalid-json",
      JSON.stringify({ id: "b", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} }),
    ] as any);

    const rows = await loadReplayEvents("course:1");
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("a");
    expect(rows[1].id).toBe("b");
  });

  it("loadReplayEvents should return empty when redis has no events", async () => {
    jest.spyOn(redis, "lrange").mockResolvedValue([] as any);
    const rows = await loadReplayEvents("course:1");
    expect(rows).toEqual([]);
  });

  it("loadReplayEvents should return events after afterEventId", async () => {
    jest.spyOn(redis, "lrange").mockResolvedValue([
      JSON.stringify({ id: "a", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} }),
      JSON.stringify({ id: "b", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} }),
      JSON.stringify({ id: "c", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} }),
    ] as any);

    const rows = await loadReplayEvents("course:1", "b");
    expect(rows.map((item) => item.id)).toEqual(["c"]);
  });

  it("loadReplayEvents should return all events when afterEventId not found", async () => {
    jest.spyOn(redis, "lrange").mockResolvedValue([
      JSON.stringify({ id: "a", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} }),
      JSON.stringify({ id: "b", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} }),
    ] as any);

    const rows = await loadReplayEvents("course:1", "z");
    expect(rows.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("ackRealtimeEvent should write ack set and ttl", async () => {
    const sadd = jest.spyOn(redis, "sadd").mockResolvedValue(1 as any);
    const expire = jest.spyOn(redis, "expire").mockResolvedValue(1 as any);
    await ackRealtimeEvent("u1", "e1");
    expect(sadd).toHaveBeenCalledWith("realtime:ack:u1", "e1");
    expect(expire).toHaveBeenCalledWith("realtime:ack:u1", 6 * 60 * 60);
  });

  it("filterAckedEvents should return unacked events only", async () => {
    const sismember = jest.fn();
    const exec = jest.fn<() => Promise<any[]>>().mockResolvedValue([
      [null, 1],
      [null, 0],
      [null, "1"],
    ]);
    jest.spyOn(redis, "multi").mockReturnValue({ sismember, exec } as any);

    const events: EventEnvelope[] = [
      { id: "a", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} },
      { id: "b", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} },
      { id: "c", name: "submission.created", occurredAt: "x", producer: "api", traceId: "t", payload: {} },
    ];

    const filtered = await filterAckedEvents("u1", events);
    expect(sismember).toHaveBeenCalledTimes(3);
    expect(filtered.map((item) => item.id)).toEqual(["b"]);
  });

  it("filterAckedEvents should short-circuit on empty events", async () => {
    const multiSpy = jest.spyOn(redis, "multi");
    const filtered = await filterAckedEvents("u1", []);
    expect(filtered).toEqual([]);
    expect(multiSpy).not.toHaveBeenCalled();
  });
});
