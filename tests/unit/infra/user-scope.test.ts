import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { resolveUserScopes } from "../../../apps/api/src/infra/user-scope.js";

describe("infra/user-scope", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("should resolve scopes for academic", async () => {
    jest.spyOn(prisma.course, "findMany").mockResolvedValue([{ id: 1n }, { id: 2n }] as any);
    const scopes = await resolveUserScopes("u1", "academic" as any);
    expect(scopes).toEqual({ courseIds: [1n, 2n], groupIds: [] });
  });

  it("should resolve scopes for teacher", async () => {
    jest.spyOn(prisma.courseTeacher, "findMany").mockResolvedValue([{ courseId: 11n }] as any);
    const scopes = await resolveUserScopes("u2", "teacher" as any);
    expect(scopes).toEqual({ courseIds: [11n], groupIds: [] });
  });

  it("should resolve scopes for assistant", async () => {
    jest.spyOn(prisma.assistantBinding, "findMany").mockResolvedValue([{ courseId: 12n }, { courseId: 13n }] as any);
    const scopes = await resolveUserScopes("u3", "assistant" as any);
    expect(scopes).toEqual({ courseIds: [12n, 13n], groupIds: [] });
  });

  it("should resolve scopes for student", async () => {
    jest.spyOn(prisma.courseMember, "findMany").mockResolvedValue([{ courseId: 21n }] as any);
    jest.spyOn(prisma.groupMember, "findMany").mockResolvedValue([{ groupId: 31n }, { groupId: 32n }] as any);
    const scopes = await resolveUserScopes("u4", "student" as any);
    expect(scopes).toEqual({ courseIds: [21n], groupIds: [31n, 32n] });
  });
});
