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
});
