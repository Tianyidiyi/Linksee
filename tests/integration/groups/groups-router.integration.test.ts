import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { groupsRouter } from "../../../apps/api/src/groups/groups-router.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", groupsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("groups-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("GET /api/v1/assignments/:assignmentId/groups should validate assignmentId", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/assignments/abc/groups")
      .set("authorization", authHeader("s1", "student"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("POST /api/v1/assignments/:assignmentId/groups should validate assignmentId", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/assignments/abc/groups")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ name: "G1" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });
});

