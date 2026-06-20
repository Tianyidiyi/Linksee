import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as XLSX from "xlsx";
import { env } from "../../../apps/api/src/infra/env.js";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
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

  it("GET /api/v1/users/directory should return paged rows for academic", async () => {
    const app = createApp();
    jest.spyOn(prisma, "$transaction").mockResolvedValue([
      [
        {
          id: "2026010041",
          role: "student",
          isActive: true,
          profile: { realName: "秦十三", accountNo: "2026010041", avatarUrl: null, email: "qin13@example.com" },
          studentProfile: { stuNo: "2026010041", grade: 2026, cohort: 2026, major: "软件工程", adminClass: "1班" },
          teacherProfile: null,
          teacherAssistantsAsAssistant: [],
          _count: { assistantBindingsAsAssistant: 0 },
        },
      ],
      1,
    ] as any);

    const res = await request(app)
      .get("/api/v1/users/directory?role=student&page=1&limit=20")
      .set("authorization", authHeader("a1", "academic"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("2026010041");
    expect(res.body.paging.total).toBe(1);
  });

  it("POST /api/v1/users should create student for academic", async () => {
    const app = createApp();
    const createSpy = jest.spyOn(prisma.user, "create").mockResolvedValue({ id: "2026010041" } as any);

    const res = await request(app)
      .post("/api/v1/users")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        id: "2026010041",
        role: "student",
        realName: "秦十三",
        defaultPassword: "StrongPass1",
        stuNo: "2026010041",
        grade: 2026,
        cohort: 2026,
        major: "软件工程",
        adminClass: "1班",
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("2026010041");
    expect(res.body.data.role).toBe("student");
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("PATCH /api/v1/users/:id should update student profile fields", async () => {
    const app = createApp();
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "2026010041",
      role: "student",
    } as any);
    jest.spyOn(prisma.studentProfile, "findUnique").mockResolvedValue({ userId: "2026010041" } as any);
    jest.spyOn(prisma.userProfile, "findUnique").mockResolvedValue({ userId: "2026010041" } as any);
    const tx = {
      user: { update: async () => ({ id: "2026010041" }) },
      userProfile: { upsert: async () => ({ userId: "2026010041" }) },
      studentProfile: { upsert: async () => ({ userId: "2026010041" }) },
      teacherProfile: { upsert: async () => ({ userId: "2026010041" }) },
    };
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(tx));

    const res = await request(app)
      .patch("/api/v1/users/2026010041")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        realName: "秦十三-更新",
        major: "人工智能",
        adminClass: "2班",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("2026010041");
    expect(res.body.data.role).toBe("student");
  });

  it("DELETE /api/v1/users/:id should delete assistant and related bindings", async () => {
    const app = createApp();
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "9000000001",
      role: "assistant",
    } as any);
    const tx = {
      assistantBinding: { deleteMany: async () => ({ count: 1 }) },
      teacherAssistant: { deleteMany: async () => ({ count: 1 }) },
      user: { delete: async () => ({ id: "9000000001" }) },
    };
    jest.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(tx));

    const res = await request(app)
      .delete("/api/v1/users/9000000001")
      .set("authorization", authHeader("a1", "academic"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("9000000001");
  });

  it("GET /api/v1/users/export should return csv attachment for academic", async () => {
    const app = createApp();
    jest.spyOn(prisma.user, "findMany").mockResolvedValue([
      {
        id: "2026010041",
        role: "student",
        isActive: true,
        profile: { realName: "秦十三", accountNo: "2026010041", avatarUrl: null, email: null },
        studentProfile: { stuNo: "2026010041", grade: 2026, cohort: 2026, major: "软件工程", adminClass: "1班" },
        teacherProfile: null,
        teacherAssistantsAsAssistant: [],
        _count: { assistantBindingsAsAssistant: 0 },
      },
    ] as any);

    const res = await request(app)
      .get("/api/v1/users/export?role=student&format=csv")
      .set("authorization", authHeader("a1", "academic"));

    expect(res.status).toBe(200);
    expect(String(res.header["content-type"])).toContain("text/csv");
    expect(String(res.header["content-disposition"])).toContain("linksee-users-student.csv");
    expect(res.text).toContain("一卡通号");
    expect(res.text).toContain("秦十三");
  });

  it("POST /api/v1/users/batch/students should create students in batch", async () => {
    const app = createApp();
    const createSpy = jest.spyOn(prisma.user, "create").mockResolvedValue({ id: "2026010041" } as any);

    const res = await request(app)
      .post("/api/v1/users/batch/students")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        defaultPassword: "StrongPass1",
        students: [
          {
            id: "2026010041",
            realName: "秦十三",
            stuNo: "2026010041",
            grade: 2026,
            cohort: 2026,
            major: "软件工程",
            adminClass: "1班",
          },
          {
            id: "2026010042",
            realName: "尤十四",
            stuNo: "2026010042",
            grade: 2026,
            cohort: 2026,
            major: "软件工程",
            adminClass: "1班",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.createdCount).toBe(2);
    expect(res.body.data.failedCount).toBe(0);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it("POST /api/v1/users/batch/students should report invalid rows and duplicate conflicts", async () => {
    const app = createApp();
    const createSpy = jest
      .spyOn(prisma.user, "create")
      .mockResolvedValueOnce({ id: "2026010041" } as any)
      .mockRejectedValueOnce({ code: "P2002" });

    const res = await request(app)
      .post("/api/v1/users/batch/students")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        defaultPassword: "StrongPass1",
        students: [
          {
            id: "2026010041",
            realName: "Student One",
            stuNo: "2026010041",
            grade: 2026,
            cohort: 2026,
            major: "Software Engineering",
            adminClass: "Class 1",
          },
          {
            id: "bad-id",
            realName: "Invalid Student",
            stuNo: "bad-id",
            grade: 2026,
            cohort: 2026,
            major: "Software Engineering",
            adminClass: "Class 1",
          },
          {
            id: "2026010042",
            realName: "Duplicate Student",
            stuNo: "2026010042",
            grade: 2026,
            cohort: 2026,
            major: "Software Engineering",
            adminClass: "Class 1",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.createdCount).toBe(1);
    expect(res.body.data.failedCount).toBe(2);
    expect(res.body.data.failed).toEqual([
      { id: "bad-id", reason: "invalid required fields" },
      { id: "2026010042", reason: "duplicate id or profile unique field" },
    ]);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it("POST /api/v1/users/batch/teachers should create teachers in batch", async () => {
    const app = createApp();
    const createSpy = jest.spyOn(prisma.user, "create").mockResolvedValue({ id: "1000000001" } as any);

    const res = await request(app)
      .post("/api/v1/users/batch/teachers")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        defaultPassword: "StrongPass1",
        teachers: [
          {
            id: "1000000001",
            realName: "张老师",
            teacherNo: "T-001",
            title: "讲师",
            college: "计算机学院",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.createdCount).toBe(1);
    expect(res.body.data.failedCount).toBe(0);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("POST /api/v1/users/import-file should import normalized student rows from uploaded table", async () => {
    const app = createApp();
    const createSpy = jest.spyOn(prisma.user, "create").mockResolvedValue({ id: "2026010041" } as any);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["一卡通号", "姓名", "年级", "届次", "专业", "行政班"],
      ["2026010041", "秦十三", 2026, 2026, "软件工程", "1班"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const workbookBase64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

    const res = await request(app)
      .post("/api/v1/users/import-file")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        mode: "student",
        defaultPassword: "StrongPass1",
        fileBase64: workbookBase64,
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.createdCount).toBe(1);
    expect(res.body.data.failedCount).toBe(0);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("POST /api/v1/users/import-file should summarize row validation failures and duplicate conflicts", async () => {
    const app = createApp();
    const createSpy = jest
      .spyOn(prisma.user, "create")
      .mockResolvedValueOnce({ id: "2026010041" } as any)
      .mockRejectedValueOnce({ code: "P2002" });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["一卡通号", "姓名", "年级", "届次", "专业", "行政班"],
      ["2026010041", "Student One", 2026, 2026, "Software Engineering", "Class 1"],
      ["bad-id", "Invalid Student", 2026, 2026, "Software Engineering", "Class 1"],
      ["2026010042", "Duplicate Student", 2026, 2026, "Software Engineering", "Class 1"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const workbookBase64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

    const res = await request(app)
      .post("/api/v1/users/import-file")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        mode: "student",
        defaultPassword: "StrongPass1",
        fileBase64: workbookBase64,
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.createdCount).toBe(1);
    expect(res.body.data.failedCount).toBe(2);
    expect(res.body.data.totalRows).toBe(3);
    expect(res.body.data.failed).toEqual([
      { id: "bad-id", reason: "invalid required fields" },
      { id: "2026010042", reason: "duplicate id or profile unique field" },
    ]);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it("POST /api/v1/users/import-file should reject unreadable uploaded table", async () => {
    const app = createApp();
    const createSpy = jest.spyOn(prisma.user, "create");

    const res = await request(app)
      .post("/api/v1/users/import-file")
      .set("authorization", authHeader("a1", "academic"))
      .send({
        mode: "student",
        defaultPassword: "StrongPass1",
        fileBase64: Buffer.from("not a workbook").toString("base64"),
      });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("IMPORT_FAILED");
    expect(createSpy).not.toHaveBeenCalled();
  });
});

