import express from "express";
import request from "supertest";
import argon2 from "argon2";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { authRouter } from "../../../apps/api/src/auth/auth-router.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import * as rateLimit from "../../../apps/api/src/auth/login-rate-limit.js";
import * as tokenService from "../../../apps/api/src/auth/token-service.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRouter);
  return app;
}

describe("auth-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /login should reject invalid payload", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/auth/login").send({ userId: "1" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /login should reject locked account", async () => {
    const app = createApp();
    jest.spyOn(rateLimit, "isLoginLocked").mockResolvedValue(true);
    const res = await request(app).post("/api/v1/auth/login").send({
      userId: "2023010001",
      password: "Abcd1234",
    });
    expect(res.status).toBe(423);
    expect(res.body.code).toBe("ACCOUNT_LOCKED");
  });

  it("POST /login should reject missing user", async () => {
    const app = createApp();
    jest.spyOn(rateLimit, "isLoginLocked").mockResolvedValue(false);
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue(null as any);
    const failSpy = jest.spyOn(rateLimit, "recordLoginFailure").mockResolvedValue();

    const res = await request(app).post("/api/v1/auth/login").send({
      userId: "2023010001",
      password: "Abcd1234",
    });
    expect(res.status).toBe(401);
    expect(failSpy).toHaveBeenCalledTimes(1);
  });

  it("POST /login should login successfully", async () => {
    const app = createApp();
    jest.spyOn(rateLimit, "isLoginLocked").mockResolvedValue(false);
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "2023010001",
      role: "student",
      isActive: true,
      forceChangePassword: false,
      passwordHash: "hash",
    } as any);
    jest.spyOn(argon2, "verify").mockResolvedValue(true as never);
    jest.spyOn(rateLimit, "clearLoginFailures").mockResolvedValue();
    jest.spyOn(tokenService, "signAccessToken").mockReturnValue("access-token");
    jest.spyOn(tokenService, "createRefreshToken").mockReturnValue("refresh-token");
    jest.spyOn(tokenService, "storeRefreshToken").mockResolvedValue();
    jest.spyOn(prisma.user, "update").mockResolvedValue({ id: "2023010001" } as any);

    const res = await request(app).post("/api/v1/auth/login").send({
      userId: "2023010001",
      password: "Abcd1234",
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.accessToken).toBe("access-token");
  });

  it("POST /refresh should validate input and token existence", async () => {
    const app = createApp();
    const res1 = await request(app).post("/api/v1/auth/refresh").send({});
    expect(res1.status).toBe(400);

    jest.spyOn(tokenService, "consumeRefreshToken").mockResolvedValue(null);
    const res2 = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "bad" });
    expect(res2.status).toBe(401);
  });

  it("POST /refresh should return new access token", async () => {
    const app = createApp();
    jest.spyOn(tokenService, "consumeRefreshToken").mockResolvedValue("2023010001");
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "2023010001",
      role: "student",
      isActive: true,
      forceChangePassword: false,
    } as any);
    jest.spyOn(tokenService, "signAccessToken").mockReturnValue("new-at");
    jest.spyOn(tokenService, "createRefreshToken").mockReturnValue("new-rt");
    jest.spyOn(tokenService, "storeRefreshToken").mockResolvedValue();

    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "ok" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe("new-at");
    expect(res.body.data.refreshToken).toBe("new-rt");
  });
});
