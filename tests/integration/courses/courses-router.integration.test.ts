import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { coursesRouter } from "../../../apps/api/src/courses/courses-router.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/courses", coursesRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("courses-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/courses should reject non-academic role", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/courses")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ courseNo: "CS101", name: "SE", academicYear: 2026, semester: 1 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("GET /api/v1/courses should reject invalid status filter", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/courses?status=bad")
      .set("authorization", authHeader("a1", "academic"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });
});

