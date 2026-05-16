import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { usersRouter } from "../../../apps/api/src/users/users-router.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/users", usersRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("users-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/users/assistants should reject non-teacher", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/users/assistants")
      .set("authorization", authHeader("s1", "student"))
      .send({ id: "2023010001", realName: "A" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/users should reject non-academic", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/users")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ id: "2023010001", role: "student", realName: "A" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});

