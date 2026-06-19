import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { assistantRouter } from "../../../apps/api/src/users/assistant-router.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", assistantRouter);
  return app;
}

function authHeader(userId: string, role: string): string {
  const token = jwt.sign({ sub: userId, role, forceChangePassword: false }, env.jwtSecret, { expiresIn: "1h" });
  return `Bearer ${token}`;
}

describe("assistant-router integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /api/v1/assistants should create assistant account for teacher", async () => {
    const app = createApp();
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      user: {
        create: async () => ({ id: "9000000001" }),
      },
      teacherAssistant: {
        create: async () => ({ teacherUserId: "t1", assistantUserId: "9000000001" }),
      },
    }));

    const res = await request(app)
      .post("/api/v1/assistants")
      .set("authorization", authHeader("t1", "teacher"))
      .send({
        id: "9000000001",
        realName: "助教甲",
        defaultPassword: "StrongPass1",
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("9000000001");
    expect(res.body.data.forceChangePassword).toBe(true);
  });

  it("GET /api/v1/assistants/mine should return assistants owned by current teacher", async () => {
    const app = createApp();
    jest.spyOn(prisma.teacherAssistant, "findMany").mockResolvedValue([
      {
        createdAt: new Date(),
        assistantUserId: "9000000001",
        assistant: {
          id: "9000000001",
          isActive: true,
          forceChangePassword: true,
          profile: {
            realName: "助教甲",
            accountNo: "9000000001",
          },
          _count: {
            assistantBindingsAsAssistant: 2,
          },
        },
      },
    ] as any);

    const res = await request(app)
      .get("/api/v1/assistants/mine")
      .set("authorization", authHeader("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].assistantUserId).toBe("9000000001");
    expect(res.body.data[0].boundCourseCount).toBe(2);
  });

  it("PATCH /api/v1/assistants/:assistantUserId should update assistant and clear bindings when deactivated", async () => {
    const app = createApp();
    jest.spyOn(prisma.teacherAssistant, "findUnique").mockResolvedValue({
      teacherUserId: "t1",
    } as any);
    const tx = {
      userProfile: {
        upsert: async () => ({ userId: "9000000001", realName: "助教甲-更新" }),
      },
      user: {
        update: async () => ({ id: "9000000001", isActive: false }),
        findUniqueOrThrow: async () => ({
          id: "9000000001",
          isActive: false,
          forceChangePassword: true,
          profile: { realName: "助教甲-更新", accountNo: "9000000001" },
          _count: { assistantBindingsAsAssistant: 0 },
        }),
      },
      assistantBinding: {
        deleteMany: async () => ({ count: 2 }),
      },
    };
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(tx));

    const res = await request(app)
      .patch("/api/v1/assistants/9000000001")
      .set("authorization", authHeader("t1", "teacher"))
      .send({ realName: "助教甲-更新", isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("9000000001");
    expect(res.body.data.realName).toBe("助教甲-更新");
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.boundCourseCount).toBe(0);
  });
});
