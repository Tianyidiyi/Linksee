import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { groupRequestsRouter } from "../../../apps/api/src/groups/group-requests-router.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", groupRequestsRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("group-requests-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/groups/:groupId/join-requests should create a join request for student", async () => {
    const app = createApp();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      assignment: {
        courseId: 22n,
        groupConfig: {
          groupFormEnd: null,
          groupMaxSize: 6,
        },
      },
      _count: { members: 3 },
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(prisma.groupMember, "findUnique").mockResolvedValue(null);
    jest.spyOn(prisma.groupJoinRequest, "findFirst").mockResolvedValue(null);
    jest.spyOn(prisma.groupJoinRequest, "create").mockResolvedValue({
      id: 51n,
      assignmentId: 12n,
      groupId: 8n,
      applicantUserId: "2026010099",
      status: "pending",
      createdAt: new Date(),
    } as any);

    const res = await request(app)
      .post("/api/v1/groups/8/join-requests")
      .set("authorization", authHeader("2026010099", "student"))
      .send({ reason: "希望加入该组参与原型实现" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("51");
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.groupId).toBe("8");
  });

  it("POST /api/v1/group-join-requests/:requestId/approve should add applicant into group", async () => {
    const app = createApp();
    jest.spyOn(prisma.groupJoinRequest, "findUnique").mockResolvedValue({
      id: 51n,
      assignmentId: 12n,
      groupId: 8n,
      applicantUserId: "2026010099",
      status: "pending",
      group: {
        assignment: {
          groupConfig: {
            groupFormEnd: null,
            groupMaxSize: 6,
          },
        },
        _count: { members: 3 },
      },
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({
      id: 81n,
    } as any);
    const createSpy = jest.fn(async () => ({ id: 91n }));
    const updateSpy = jest.fn(async () => ({ id: 51n, status: "approved" }));
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      groupJoinRequest: {
        findUnique: async () => ({
          status: "pending",
          assignmentId: 12n,
          groupId: 8n,
          applicantUserId: "2026010099",
        }),
        update: updateSpy,
      },
      groupMember: {
        findUnique: async () => null,
        create: createSpy,
      },
    }));

    const res = await request(app)
      .post("/api/v1/group-join-requests/51/approve")
      .set("authorization", authHeader("2026010041", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.approved).toBe(true);
    expect(createSpy).toHaveBeenCalledWith({
      data: {
        groupId: 8n,
        assignmentId: 12n,
        userId: "2026010099",
        role: "member",
      },
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it("POST /api/v1/groups/:groupId/leader-transfer-requests should create transfer request for current leader", async () => {
    const app = createApp();
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst")
      .mockResolvedValueOnce({ id: 81n } as any)
      .mockResolvedValueOnce({ id: 82n } as any);
    jest.spyOn(prisma.groupLeaderTransferRequest, "findFirst").mockResolvedValue(null);
    jest.spyOn(prisma.groupLeaderTransferRequest, "create").mockResolvedValue({
      id: 61n,
      groupId: 8n,
      fromUserId: "2026010041",
      toUserId: "2026010042",
      status: "pending",
      createdAt: new Date(),
    } as any);

    const res = await request(app)
      .post("/api/v1/groups/8/leader-transfer-requests")
      .set("authorization", authHeader("2026010041", "student"))
      .send({ toUserId: "2026010042" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("61");
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.toUserId).toBe("2026010042");
  });

  it("POST /api/v1/group-leader-transfer-requests/:requestId/accept should switch leader roles", async () => {
    const app = createApp();
    jest.spyOn(prisma.groupLeaderTransferRequest, "findUnique").mockResolvedValue({
      id: 61n,
      groupId: 8n,
      fromUserId: "2026010041",
      toUserId: "2026010042",
      status: "pending",
    } as any);
    const leaderUpdateMany = jest.fn(async () => ({ count: 1 }));
    const requestUpdate = jest.fn(async () => ({ id: 61n, status: "accepted" }));
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      groupLeaderTransferRequest: {
        findUnique: async () => ({
          status: "pending",
          groupId: 8n,
          fromUserId: "2026010041",
          toUserId: "2026010042",
        }),
        update: requestUpdate,
      },
      groupMember: {
        updateMany: leaderUpdateMany,
      },
    }));

    const res = await request(app)
      .post("/api/v1/group-leader-transfer-requests/61/accept")
      .set("authorization", authHeader("2026010042", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("accepted");
    expect(leaderUpdateMany).toHaveBeenCalledTimes(2);
    expect(requestUpdate).toHaveBeenCalledTimes(1);
  });

  it("POST /api/v1/group-leader-transfer-requests/:requestId/reject should mark request rejected", async () => {
    const app = createApp();
    jest.spyOn(prisma.groupLeaderTransferRequest, "findUnique").mockResolvedValue({
      id: 62n,
      toUserId: "2026010042",
      status: "pending",
    } as any);
    const updateSpy = jest.spyOn(prisma.groupLeaderTransferRequest, "update").mockResolvedValue({
      id: 62n,
      status: "rejected",
    } as any);

    const res = await request(app)
      .post("/api/v1/group-leader-transfer-requests/62/reject")
      .set("authorization", authHeader("2026010042", "student"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("rejected");
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
