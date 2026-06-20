import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { groupsRouter } from "../../../apps/api/src/groups/groups-router.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";

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

  it("POST /api/v1/assignments/:assignmentId/groups should create group and return it from list query", async () => {
    const app = createApp();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({
      id: 12n,
      courseId: 22n,
      groupConfig: {
        groupFormEnd: null,
        groupMaxSize: 6,
      },
    } as any);
    jest.spyOn(groupAccess, "ensureAssignmentManageable").mockResolvedValue({
      id: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(prisma.group, "aggregate").mockResolvedValue({
      _max: { groupNo: 2 },
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue(null);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (input: any) => {
      if (typeof input === "function") {
        return input({
          group: {
            create: async () => ({ id: 103n, groupNo: 3 }),
          },
          groupMember: {
            create: async () => ({ id: 201n }),
          },
        });
      }
      return [
        [
          {
            id: 103n,
            assignmentId: 12n,
            groupNo: 3,
            name: "Acceptance Group",
            status: "forming",
            createdBy: "t1",
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { members: 0 },
          },
        ],
        1,
      ] as any;
    });

    const createRes = await request(app)
      .post("/api/v1/assignments/12/groups")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ name: "Acceptance Group" });

    expect(createRes.status).toBe(201);
    expect(createRes.body.ok).toBe(true);
    expect(createRes.body.data.id).toBe("103");
    expect(createRes.body.data.assignmentId).toBe("12");
    expect(createRes.body.data.groupNo).toBe(3);
    expect(createRes.body.data.name).toBe("Acceptance Group");

    const listRes = await request(app)
      .get("/api/v1/assignments/12/groups?limit=10&offset=0")
      .set("authorization", authHeader("t1", "teacher"));

    expect(listRes.status).toBe(200);
    expect(listRes.body.ok).toBe(true);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0]).toEqual(expect.objectContaining({
      id: "103",
      assignmentId: "12",
      groupNo: 3,
      name: "Acceptance Group",
      status: "forming",
    }));
    expect(listRes.body.paging).toEqual({ limit: 10, offset: 0, total: 1, hasMore: false });
  });

  it("POST /api/v1/assignments/:assignmentId/groups/auto should create forming groups for ungrouped students", async () => {
    const app = createApp();
    jest.spyOn(prisma.assignment, "findUnique").mockResolvedValue({
      id: 12n,
      courseId: 22n,
      groupConfig: {
        groupFormEnd: null,
        groupMaxSize: 6,
      },
    } as any);
    jest.spyOn(groupAccess, "ensureAssignmentManageable").mockResolvedValue({
      id: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(prisma.groupMember, "findMany").mockResolvedValue([]);
    jest.spyOn(prisma.courseMember, "findMany").mockResolvedValue([
      { userId: "2026010041" },
      { userId: "2026010042" },
      { userId: "2026010043" },
      { userId: "2026010044" },
      { userId: "2026010045" },
    ] as any);
    jest.spyOn(prisma.group, "aggregate").mockResolvedValue({
      _max: { groupNo: 2 },
    } as any);

    const groupCreate: any = jest.fn();
    groupCreate
      .mockResolvedValueOnce({ id: 101n })
      .mockResolvedValueOnce({ id: 102n });
    const memberCreateMany: any = jest.fn();
    memberCreateMany
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce({ count: 1 });
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) =>
      callback({
        group: { create: groupCreate },
        groupMember: { createMany: memberCreateMany },
      }),
    );

    const res = await request(app)
      .post("/api/v1/assignments/12/groups/auto")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ groupSize: 4 });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.assignmentId).toBe("12");
    expect(res.body.data.createdGroups).toBe(2);
    expect(res.body.data.groupedStudents).toBe(5);
    expect(res.body.data.groupSize).toBe(4);
    expect(groupCreate).toHaveBeenCalledTimes(2);
    expect(groupCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        assignmentId: 12n,
        groupNo: 3,
        name: "第 3 组",
        status: "forming",
        createdBy: "t1",
      }),
    }));
    expect(groupCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        assignmentId: 12n,
        groupNo: 4,
        name: "第 4 组",
        status: "forming",
        createdBy: "t1",
      }),
    }));
    expect(memberCreateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: [
        { groupId: 101n, assignmentId: 12n, userId: "2026010041", role: "leader" },
        { groupId: 101n, assignmentId: 12n, userId: "2026010042", role: "member" },
        { groupId: 101n, assignmentId: 12n, userId: "2026010043", role: "member" },
        { groupId: 101n, assignmentId: 12n, userId: "2026010044", role: "member" },
      ],
    }));
    expect(memberCreateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: [
        { groupId: 102n, assignmentId: 12n, userId: "2026010045", role: "leader" },
      ],
    }));
  });
});

