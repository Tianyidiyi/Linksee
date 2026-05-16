import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { env } from "../../../apps/api/src/infra/env.js";
import { redis } from "../../../apps/api/src/infra/redis.js";
import {
  consumeRefreshToken,
  createRefreshToken,
  revokeAllUserRefreshTokens,
  revokeAllRefreshTokensForUsers,
  revokeRefreshToken,
  signAccessToken,
  storeRefreshToken,
} from "../../../apps/api/src/auth/token-service.js";

describe("token-service", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("signAccessToken should create verifiable JWT", () => {
    const token = signAccessToken({
      sub: "2023010001",
      role: "student",
      forceChangePassword: false,
    });
    const payload = jwt.verify(token, env.jwtSecret) as any;
    expect(payload.sub).toBe("2023010001");
    expect(payload.role).toBe("student");
  });

  it("createRefreshToken should create random token", () => {
    const a = createRefreshToken();
    const b = createRefreshToken();
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
  });

  it("storeRefreshToken should write redis key", async () => {
    const setSpy = jest.spyOn(redis, "set").mockResolvedValue("OK" as any);
    await storeRefreshToken("raw-token", "u1");
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it("store/consume should fallback to memory when redis unavailable", async () => {
    jest.spyOn(redis, "set").mockRejectedValue(new Error("redis down"));
    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));
    jest.spyOn(redis, "del").mockRejectedValue(new Error("redis down"));

    await storeRefreshToken("raw-token-memory-1", "u-memory-1");
    await expect(consumeRefreshToken("raw-token-memory-1")).resolves.toBe("u-memory-1");
    await expect(consumeRefreshToken("raw-token-memory-1")).resolves.toBeNull();
  });

  it("consume should return null when memory refresh token is expired", async () => {
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1_000);
    jest.spyOn(redis, "set").mockRejectedValue(new Error("redis down"));
    await storeRefreshToken("raw-token-memory-expire", "u-memory-expire");

    nowSpy.mockReturnValue(1_000 + env.jwtRefreshTtlSeconds * 1000 + 1);
    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));
    await expect(consumeRefreshToken("raw-token-memory-expire")).resolves.toBeNull();
  });

  it("consumeRefreshToken should return null when not found", async () => {
    jest.spyOn(redis, "get").mockResolvedValue(null as any);
    await expect(consumeRefreshToken("raw-token")).resolves.toBeNull();
  });

  it("consumeRefreshToken should consume existing token", async () => {
    const getSpy = jest.spyOn(redis, "get").mockResolvedValue("u1" as any);
    const delSpy = jest.spyOn(redis, "del").mockResolvedValue(1 as any);
    await expect(consumeRefreshToken("raw-token")).resolves.toBe("u1");
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(delSpy).toHaveBeenCalledTimes(1);
  });

  it("revokeRefreshToken should delete key", async () => {
    const delSpy = jest.spyOn(redis, "del").mockResolvedValue(1 as any);
    await revokeRefreshToken("raw-token");
    expect(delSpy).toHaveBeenCalledTimes(1);
  });

  it("revokeRefreshToken should remove fallback memory token when redis delete fails", async () => {
    jest.spyOn(redis, "set").mockRejectedValue(new Error("redis down"));
    await storeRefreshToken("raw-token-memory-2", "u-memory-2");

    jest.spyOn(redis, "del").mockRejectedValue(new Error("redis down"));
    await revokeRefreshToken("raw-token-memory-2");

    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));
    await expect(consumeRefreshToken("raw-token-memory-2")).resolves.toBeNull();
  });

  it("revokeAllRefreshTokensForUsers should no-op on empty input", async () => {
    const scanSpy = jest.spyOn(redis, "scanStream");
    await revokeAllRefreshTokensForUsers([]);
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it("revokeAllRefreshTokensForUsers should delete matched keys from stream", async () => {
    async function* keyStream() {
      yield ["rt:key1", "rt:key2", "rt:key3"];
      yield [];
      yield ["rt:key4"];
    }

    const scanSpy = jest.spyOn(redis, "scanStream").mockReturnValue(keyStream() as any);
    const mgetSpy = jest
      .spyOn(redis, "mget")
      .mockResolvedValueOnce(["u1", "u2", "u1"] as any)
      .mockResolvedValueOnce(["u3"] as any);
    const delSpy = jest.spyOn(redis, "del").mockResolvedValue(2 as any);

    await revokeAllRefreshTokensForUsers(["u1"]);
    expect(scanSpy).toHaveBeenCalledTimes(1);
    expect(mgetSpy).toHaveBeenCalledTimes(2);
    expect(delSpy).toHaveBeenCalled();
  });

  it("revokeAllRefreshTokensForUsers should skip delete when no keys matched", async () => {
    async function* keyStream() {
      yield ["rt:key9", "rt:key8"];
    }

    const scanSpy = jest.spyOn(redis, "scanStream").mockReturnValue(keyStream() as any);
    const mgetSpy = jest.spyOn(redis, "mget").mockResolvedValueOnce(["u2", "u3"] as any);
    const delSpy = jest.spyOn(redis, "del").mockResolvedValue(0 as any);

    await revokeAllRefreshTokensForUsers(["u1"]);
    expect(scanSpy).toHaveBeenCalledTimes(1);
    expect(mgetSpy).toHaveBeenCalledTimes(1);
    expect(delSpy).not.toHaveBeenCalled();
  });

  it("revokeAllUserRefreshTokens should delegate to bulk revoke", async () => {
    async function* keyStream() {
      yield ["rt:key1"];
    }
    jest.spyOn(redis, "scanStream").mockReturnValue(keyStream() as any);
    jest.spyOn(redis, "mget").mockResolvedValueOnce(["u1"] as any);
    const delSpy = jest.spyOn(redis, "del").mockResolvedValue(1 as any);
    await revokeAllUserRefreshTokens("u1");
    expect(delSpy).toHaveBeenCalledTimes(1);
  });

  it("revokeAllUserRefreshTokens should fallback to memory cleanup on redis failure", async () => {
    jest.spyOn(redis, "set").mockRejectedValue(new Error("redis down"));
    await storeRefreshToken("raw-token-memory-3", "u-memory-3");
    await storeRefreshToken("raw-token-memory-4", "u-memory-other");

    jest.spyOn(redis, "scanStream").mockImplementation(() => {
      throw new Error("redis down");
    });

    await revokeAllUserRefreshTokens("u-memory-3");

    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));
    await expect(consumeRefreshToken("raw-token-memory-3")).resolves.toBeNull();
    await expect(consumeRefreshToken("raw-token-memory-4")).resolves.toBe("u-memory-other");
  });

  it("revokeAllRefreshTokensForUsers should fallback to memory cleanup on redis failure", async () => {
    jest.spyOn(redis, "set").mockRejectedValue(new Error("redis down"));
    await storeRefreshToken("raw-token-memory-5", "u-memory-5");
    await storeRefreshToken("raw-token-memory-6", "u-memory-6");

    jest.spyOn(redis, "scanStream").mockImplementation(() => {
      throw new Error("redis down");
    });

    await revokeAllRefreshTokensForUsers(["u-memory-5"]);

    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));
    await expect(consumeRefreshToken("raw-token-memory-5")).resolves.toBeNull();
    await expect(consumeRefreshToken("raw-token-memory-6")).resolves.toBe("u-memory-6");
  });

  it("revokeAllRefreshTokensForUsers should cleanup memory tokens on successful redis scan flow", async () => {
    jest.spyOn(redis, "set").mockRejectedValue(new Error("redis down"));
    await storeRefreshToken("raw-token-memory-7", "u-memory-7");
    await storeRefreshToken("raw-token-memory-8", "u-memory-8");

    async function* keyStream() {
      yield [];
    }
    jest.spyOn(redis, "scanStream").mockReturnValue(keyStream() as any);

    await revokeAllRefreshTokensForUsers(["u-memory-7"]);

    jest.spyOn(redis, "get").mockRejectedValue(new Error("redis down"));
    await expect(consumeRefreshToken("raw-token-memory-7")).resolves.toBeNull();
    await expect(consumeRefreshToken("raw-token-memory-8")).resolves.toBe("u-memory-8");
  });
});
