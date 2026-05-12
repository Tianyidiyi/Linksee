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
});
