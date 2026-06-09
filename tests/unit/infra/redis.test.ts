import { describe, expect, it, jest } from "@jest/globals";
import { runRedis } from "../../../apps/api/src/infra/redis.js";

describe("infra/redis", () => {
  it("runRedis should return operation result when it resolves in time", async () => {
    await expect(runRedis(async () => "OK", async () => "fallback")).resolves.toBe("OK");
  });

  it("runRedis should fallback when operation rejects", async () => {
    await expect(runRedis(async () => {
      throw new Error("boom");
    }, async () => "fallback")).resolves.toBe("fallback");
  });

  it("runRedis should fallback when operation times out", async () => {
    jest.useFakeTimers();
    const pending = runRedis(
      () => new Promise<string>(() => {}),
      async () => "timed-out",
      20,
    );

    await jest.advanceTimersByTimeAsync(25);
    await expect(pending).resolves.toBe("timed-out");
    jest.useRealTimers();
  });
});
