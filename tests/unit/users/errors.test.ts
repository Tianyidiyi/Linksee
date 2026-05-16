import { describe, expect, it } from "@jest/globals";
import { isUniqueViolation } from "../../../apps/api/src/users/errors.js";

describe("users/errors", () => {
  it("should return true for Prisma known request error instance", async () => {
    const prismaModule = await import("../../../apps/api/node_modules/@prisma/client/index.js");
    const Ctor = (prismaModule as any).Prisma.PrismaClientKnownRequestError;
    const err = Object.create(Ctor.prototype) as { code: string };
    err.code = "P2002";
    expect(isUniqueViolation(err)).toBe(true);
  });

  it("should return true for P2002-like error objects", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
  });

  it("should return false for non-prisma errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation({ code: "P2003" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
  });
});
