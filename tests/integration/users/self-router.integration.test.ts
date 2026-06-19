import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { selfRouter } from "../../../apps/api/src/users/self-router.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", selfRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("self-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("GET /api/v1/me should return current user profile", async () => {
    const app = createApp();
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "2026010041",
      role: "student",
      isActive: true,
      forceChangePassword: false,
      lastLoginAt: new Date(),
      studentProfile: {
        stuNo: "2026010041",
        grade: "2026",
        cohort: "2026",
        major: "软件工程",
        adminClass: "1班",
      },
      teacherProfile: null,
      profile: {
        realName: "秦十三",
        accountNo: "2026010041",
        avatarUrl: null,
        bio: "前端负责人",
        location: "西安",
        email: "qin13@example.com",
      },
    } as any);

    const res = await request(app)
      .get("/api/v1/me")
      .set("authorization", authHeader("2026010041", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("2026010041");
    expect(res.body.data.profile.realName).toBe("秦十三");
    expect(res.body.data.studentProfile.major).toBe("软件工程");
  });

  it("PATCH /api/v1/me should update profile fields", async () => {
    const app = createApp();
    jest.spyOn(prisma.userProfile, "findUnique").mockResolvedValue({
      realName: "秦十三",
      avatarUrl: "https://example.com/avatar.png",
    } as any);
    const upsertSpy = jest.spyOn(prisma.userProfile, "upsert").mockResolvedValue({
      userId: "2026010041",
    } as any);

    const res = await request(app)
      .patch("/api/v1/me")
      .set("authorization", authHeader("2026010041", "student"))
      .send({
        realName: "秦十三-更新",
        bio: "负责原型与前端联调",
        location: "西安",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toBe("Profile updated");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});
