import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { courseMembersRouter } from "../../../apps/api/src/courses/course-members-router.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/courses", courseMembersRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("course-members-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("GET /api/v1/courses/:id/members should validate course id", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/courses/abc/members")
      .set("authorization", authHeader("s1", "student"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /api/v1/courses/:id/members/batch should reject non-academic", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/courses/1/members/batch")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ userIds: ["2023010001"] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});

