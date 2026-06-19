import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { groupMembersRouter } from "../../../apps/api/src/groups/group-members-router.js";
import * as groupAccess from "../../../apps/api/src/groups/group-access.js";
import * as realtimePublisher from "../../../apps/api/src/events/realtime-publisher.js";
import * as groupLifecycle from "../../../apps/api/src/groups/group-lifecycle.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", groupMembersRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("group-members-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("DELETE /api/v1/groups/:groupId/members/:userId should reassign leader and publish system announcement", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureGroupManageable").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      groupNo: 3,
      name: "原型实现组",
      createdBy: "t1",
      status: "forming",
      assignment: { courseId: 22n },
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({
      id: 81n,
      role: "leader",
      user: {
        profile: {
          realName: "秦十三",
        },
      },
    } as any);
    const deleteSpy: any = jest.fn(async () => undefined);
    const nextLeaderFindSpy: any = jest.fn(async () => ({
      id: 82n,
      userId: "2026010042",
      user: {
        profile: {
          realName: "尤十四",
        },
      },
    }));
    const leaderUpdateSpy: any = jest.fn(async () => ({
      id: 82n,
      role: "leader",
    }));
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) =>
      callback({
        groupMember: {
          delete: deleteSpy,
          findFirst: nextLeaderFindSpy,
          update: leaderUpdateSpy,
        },
      }),
    );
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();
    const announcementSpy = jest.spyOn(groupLifecycle, "publishGroupSystemAnnouncement").mockResolvedValue();

    const res = await request(app)
      .delete("/api/v1/groups/8/members/2026010041")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith({
      where: { id: 81n },
    });
    expect(nextLeaderFindSpy).toHaveBeenCalledTimes(1);
    expect(leaderUpdateSpy).toHaveBeenCalledWith({
      where: { id: 82n },
      data: { role: "leader" },
    });
    expect(pushSpy).toHaveBeenCalledTimes(2);
    expect(announcementSpy).toHaveBeenCalledWith(expect.objectContaining({
      operatorId: "t1",
      subType: "group_member",
      content: expect.stringContaining("尤十四 已自动设为新组长"),
      group: expect.objectContaining({
        id: 8n,
        assignmentId: 12n,
        courseId: 22n,
        groupNo: 3,
        name: "原型实现组",
      }),
    }));
  });

  it("POST /api/v1/groups/:groupId/members should add student into current assignment group", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureGroupManageable").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "2026010043",
      role: "student",
    } as any);
    jest.spyOn(groupAccess, "ensureCourseMemberActive").mockResolvedValue(true);
    jest.spyOn(prisma.groupMember, "findUnique").mockResolvedValue(null);
    jest.spyOn(prisma.groupMember, "create").mockResolvedValue({
      id: 91n,
      userId: "2026010043",
      groupId: 8n,
    } as any);
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/groups/8/members")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ userId: "2026010043" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.userId).toBe("2026010043");
    expect(res.body.data.groupId).toBe("8");
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it("POST /api/v1/groups/:groupId/members/:userId/move should move non-leader member between groups", async () => {
    const app = createApp();
    jest.spyOn(groupAccess, "ensureGroupManageable").mockResolvedValue({
      id: 8n,
      assignmentId: 12n,
      courseId: 22n,
    } as any);
    jest.spyOn(prisma.group, "findUnique").mockResolvedValue({
      id: 9n,
      assignmentId: 12n,
      assignment: { courseId: 22n },
    } as any);
    jest.spyOn(prisma.groupMember, "findFirst").mockResolvedValue({
      id: 93n,
      role: "member",
    } as any);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) =>
      callback({
        groupMember: {
          findFirst: async () => ({ id: 93n, role: "member" }),
          update: async () => ({ id: 93n }),
        },
      }),
    );
    const pushSpy = jest.spyOn(realtimePublisher, "pushSocketEvent").mockResolvedValue();

    const res = await request(app)
      .post("/api/v1/groups/8/members/2026010043/move")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ targetGroupId: "9" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.fromGroupId).toBe("8");
    expect(res.body.data.toGroupId).toBe("9");
    expect(pushSpy).toHaveBeenCalledTimes(4);
  });
});
