import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { submissionsRouter } from "../../../apps/api/src/submissions/submissions-router.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", submissionsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("submissions-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should validate stage id", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/stages/abc/groups/1/submissions")
      .set("authorization", authHeader("s1", "student"))
      .send({ title: "demo" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /stages/:stageId/groups/:groupId/submissions should reject non-student role", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/stages/1/groups/1/submissions")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ title: "demo" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});

