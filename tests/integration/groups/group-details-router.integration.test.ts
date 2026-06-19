import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { groupDetailsRouter } from "../../../apps/api/src/groups/group-details-router.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", groupDetailsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("group-details-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("GET /api/v1/groups/:groupId should return group members and mini task stats", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "getGroupAccess").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      groupNo: 3,
      name: "原型实现组",
      status: "active",
      createdBy: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignment: { courseId: 22n },
    } as any);
    jest.spyOn(prisma, "$transaction").mockResolvedValue([
      [
        {
          id: 81n,
          groupId: 8n,
          assignmentId: 12n,
          userId: "2026010041",
          role: "leader",
          joinedAt: new Date(),
          user: {
            profile: {
              realName: "秦十三",
              avatarUrl: null,
              accountNo: "2026010041",
            },
          },
        },
      ],
      [
        { status: "todo", _count: { _all: 2 } },
        { status: "done", _count: { _all: 1 } },
      ],
      1,
      { updatedAt: new Date("2026-06-19T10:00:00Z") },
    ] as any);

    const res = await request(app)
      .get("/api/v1/groups/8")
      .set("authorization", authHeader("2026010041", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.group.name).toBe("原型实现组");
    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.miniTaskStats.total).toBe(3);
    expect(res.body.data.miniTaskStats.byStatus.todo).toBe(2);
    expect(res.body.data.miniTaskStats.byStatus.done).toBe(1);
    expect(res.body.data.miniTaskStats.overdue).toBe(1);
  });
});
