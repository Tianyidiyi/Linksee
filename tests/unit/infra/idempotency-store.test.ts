import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { redis } from "../../../apps/api/src/infra/redis.js";
import {
  getIdempotentResponse,
  saveIdempotentResponse,
} from "../../../apps/api/src/infra/idempotency-store.js";

describe("infra/idempotency-store", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("getIdempotentResponse should return null when redis has no value", async () => {
    jest.spyOn(redis, "get").mockResolvedValue(null as any);
    await expect(getIdempotentResponse("idem:k")).resolves.toBeNull();
  });

  it("getIdempotentResponse should parse json payload", async () => {
    jest.spyOn(redis, "get").mockResolvedValue(JSON.stringify({ ok: true, data: { id: 1 } }) as any);
    await expect(getIdempotentResponse<{ ok: boolean; data: { id: number } }>("idem:k")).resolves.toEqual({
      ok: true,
      data: { id: 1 },
    });
  });

  it("getIdempotentResponse should return null when json is invalid", async () => {
    jest.spyOn(redis, "get").mockResolvedValue("not-json" as any);
    await expect(getIdempotentResponse("idem:k")).resolves.toBeNull();
  });

  it("saveIdempotentResponse should write with 24h TTL", async () => {
    const setSpy = jest.spyOn(redis, "set").mockResolvedValue("OK" as any);
    await saveIdempotentResponse("idem:k", { a: 1 });
    expect(setSpy).toHaveBeenCalledWith("idem:k", JSON.stringify({ a: 1 }), "EX", 24 * 60 * 60);
  });
});

