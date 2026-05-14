import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { redis } from "../../../apps/api/src/infra/redis.js";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "../../../apps/api/src/auth/login-rate-limit.js";

describe("login-rate-limit", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("isLoginLocked should return true when attempts >= 5", async () => {
    jest.spyOn(redis, "get").mockResolvedValue("5" as any);
    await expect(isLoginLocked("2023010001")).resolves.toBe(true);
  });

  it("isLoginLocked should return false when attempts < 5 or invalid", async () => {
    jest.spyOn(redis, "get").mockResolvedValue("4" as any);
    await expect(isLoginLocked("2023010001")).resolves.toBe(false);

    jest.spyOn(redis, "get").mockResolvedValue("x" as any);
    await expect(isLoginLocked("2023010001")).resolves.toBe(false);
  });

  it("recordLoginFailure should set expire only on first failure", async () => {
    const incrSpy = jest.spyOn(redis, "incr");
    const expireSpy = jest.spyOn(redis, "expire").mockResolvedValue(1 as any);

    incrSpy.mockResolvedValueOnce(1 as any);
    await recordLoginFailure("2023010001");
    expect(expireSpy).toHaveBeenCalledTimes(1);

    incrSpy.mockResolvedValueOnce(2 as any);
    await recordLoginFailure("2023010001");
    expect(expireSpy).toHaveBeenCalledTimes(1);
  });

  it("clearLoginFailures should delete lock key", async () => {
    const delSpy = jest.spyOn(redis, "del").mockResolvedValue(1 as any);
    await clearLoginFailures("2023010001");
    expect(delSpy).toHaveBeenCalledTimes(1);
  });

  it("should fallback to memory attempts when redis is unavailable", async () => {
    jest.spyOn(redis, "incr").mockRejectedValue(new Error("redis down"));
    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));

    for (let i = 0; i < 4; i += 1) {
      await recordLoginFailure("mem-user-1");
    }
    await expect(isLoginLocked("mem-user-1")).resolves.toBe(false);

    await recordLoginFailure("mem-user-1");
    await expect(isLoginLocked("mem-user-1")).resolves.toBe(true);
  });

  it("should clear memory attempts when redis delete fails", async () => {
    jest.spyOn(redis, "incr").mockRejectedValue(new Error("redis down"));
    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));
    jest.spyOn(redis, "del").mockRejectedValue(new Error("redis down"));

    for (let i = 0; i < 5; i += 1) {
      await recordLoginFailure("mem-user-2");
    }
    await expect(isLoginLocked("mem-user-2")).resolves.toBe(true);
    await clearLoginFailures("mem-user-2");
    await expect(isLoginLocked("mem-user-2")).resolves.toBe(false);
  });

  it("should expire memory attempts by ttl", async () => {
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1_000);
    jest.spyOn(redis, "incr").mockRejectedValue(new Error("redis down"));
    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));
    await recordLoginFailure("mem-user-3");

    nowSpy.mockReturnValue(1_000 + 16 * 60 * 1000);
    await expect(isLoginLocked("mem-user-3")).resolves.toBe(false);
  });
});
