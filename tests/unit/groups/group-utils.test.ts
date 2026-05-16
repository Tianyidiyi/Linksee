import { describe, expect, it, jest } from "@jest/globals";
import {
  isBeforeStudentDeadline,
  isCourseStaff,
  isStudent,
  parseBigIntBodyValue,
  parseOptionalString,
} from "../../../apps/api/src/groups/group-utils.js";

describe("groups/group-utils", () => {
  it("parseOptionalString should normalize string values", () => {
    expect(parseOptionalString("  hello ")).toBe("hello");
    expect(parseOptionalString("")).toBeNull();
    expect(parseOptionalString("   ")).toBeNull();
    expect(parseOptionalString(undefined)).toBeNull();
    expect(parseOptionalString(null)).toBeNull();
    expect(parseOptionalString(123)).toBeNull();
  });

  it("parseBigIntBodyValue should accept numeric string and positive integer", () => {
    expect(parseBigIntBodyValue("123")).toBe("123");
    expect(parseBigIntBodyValue(123)).toBe("123");
    expect(parseBigIntBodyValue(0)).toBeUndefined();
    expect(parseBigIntBodyValue(-1)).toBeUndefined();
    expect(parseBigIntBodyValue(1.2)).toBeUndefined();
    expect(parseBigIntBodyValue({})).toBeUndefined();
  });

  it("role helpers should classify role correctly", () => {
    expect(isStudent("student" as any)).toBe(true);
    expect(isStudent("teacher" as any)).toBe(false);

    expect(isCourseStaff("academic" as any)).toBe(true);
    expect(isCourseStaff("teacher" as any)).toBe(true);
    expect(isCourseStaff("assistant" as any)).toBe(true);
    expect(isCourseStaff("student" as any)).toBe(false);
  });

  it("isBeforeStudentDeadline should respect null and current time", () => {
    expect(isBeforeStudentDeadline(null)).toBe(true);

    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(new Date("2026-01-01T00:00:00.000Z").getTime());
    expect(isBeforeStudentDeadline(new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isBeforeStudentDeadline(new Date("2026-01-01T00:00:01.000Z"))).toBe(true);
    expect(isBeforeStudentDeadline(new Date("2025-12-31T23:59:59.000Z"))).toBe(false);
    nowSpy.mockRestore();
  });
});
