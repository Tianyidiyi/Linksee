import { Role } from "@prisma/client";

export function parseOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

export function parseBigIntBodyValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return String(value);
  return undefined;
}

export function isStudent(role: Role): boolean {
  return role === Role.student;
}

export function isCourseStaff(role: Role): boolean {
  return role === Role.academic || role === Role.teacher || role === Role.assistant;
}

export function isBeforeStudentDeadline(groupFormEnd: Date | null): boolean {
  if (!groupFormEnd) return true;
  return Date.now() <= groupFormEnd.getTime();
}
