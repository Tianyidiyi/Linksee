import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { realtimeRouter } from "../../../apps/api/src/collaboration/realtime-router.js";
import * as courseAccess from "../../../apps/api/src/courses/course-access.js";
import * as realtimeCache from "../../../apps/api/src/events/realtime-cache.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", realtimeRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("realtime-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/realtime/acks should ack event and update conversation read state", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    const ackSpy = jest.spyOn(realtimeCache, "ackRealtimeEvent").mockResolvedValue();
    jest.spyOn(prisma.chatConversation, "findFirst").mockResolvedValue({ id: 101n } as any);
    const upsertSpy = jest.spyOn(prisma.chatConversationRead, "upsert").mockResolvedValue({
      conversationId: 101n,
      userId: "t1",
    } as any);

    const res = await request(app)
      .post("/api/v1/realtime/acks")
      .set("authorization", authHeader("t1", "teacher"))
      .send({
        eventId: "evt-1",
        roomKey: "course:1",
        messageId: "201",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(ackSpy).toHaveBeenCalledWith("t1", "evt-1");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it("GET /api/v1/realtime/replay should return filtered replay events for readable room", async () => {
    const app = createApp();
    jest.spyOn(courseAccess, "ensureCourseReadable").mockResolvedValue({ id: 1n } as any);
    jest.spyOn(realtimeCache, "loadReplayEvents").mockResolvedValue([
      { id: "evt-2", type: "course.message.created", payload: { courseId: "1" } },
    ] as any);
    jest.spyOn(realtimeCache, "filterAckedEvents").mockResolvedValue([
      { id: "evt-2", type: "course.message.created", payload: { courseId: "1" } },
    ] as any);

    const res = await request(app)
      .get("/api/v1/realtime/replay?room=course:1&afterEventId=evt-1")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("evt-2");
  });
});
