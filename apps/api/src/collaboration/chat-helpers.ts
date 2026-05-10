import type { Response } from "express";
import { prisma } from "../infra/prisma.js";

export type ChatMessageType = "text" | "file" | "announcement";
export const CHAT_MENTION_LIMIT = 20;

export function parseLimit(rawValue: unknown): number {
  const value = typeof rawValue === "string" ? Number(rawValue) : typeof rawValue === "number" ? rawValue : NaN;
  if (!Number.isFinite(value) || value <= 0) return 50;
  return Math.min(100, Math.floor(value));
}

export function parseCursorParam(
  rawValue: unknown,
  res: Response,
  fieldName: string,
): bigint | null {
  if (rawValue === undefined || rawValue === null) return null;
  const value = typeof rawValue === "string" ? rawValue : typeof rawValue === "number" ? String(rawValue) : "";
  if (!/^[0-9]+$/.test(value)) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `${fieldName} must be a positive integer` });
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `${fieldName} is invalid` });
    return null;
  }
}

export function resolveMessageType(files: unknown, content: string | null): ChatMessageType {
  if (files && typeof files === "object" && !Array.isArray(files)) {
    const type = (files as { type?: string }).type;
    if (type === "announcement") return "announcement";
  }
  if (files) return "file";
  if (content && content.trim().length > 0) return "text";
  return "text";
}

export function normalizeMentions(rawValue: unknown): string[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const unique = new Set<string>();
  for (const entry of rawValue) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
    if (unique.size >= CHAT_MENTION_LIMIT) break;
  }

  return Array.from(unique);
}

export async function ensureCourseConversation(courseId: bigint): Promise<void> {
  await prisma.chatConversation.upsert({
    where: { scopeType_scopeId: { scopeType: "course", scopeId: courseId } },
    update: {},
    create: {
      scopeType: "course",
      scopeId: courseId,
      roomKey: `course:${courseId.toString()}`,
      createdBy: null,
    },
  });
}

export async function ensureGroupConversation(groupId: bigint, createdBy: string): Promise<void> {
  await prisma.chatConversation.upsert({
    where: { scopeType_scopeId: { scopeType: "group", scopeId: groupId } },
    update: {},
    create: {
      scopeType: "group",
      scopeId: groupId,
      roomKey: `group:${groupId.toString()}`,
      createdBy,
    },
  });
}

export async function getConversationId(scopeType: "course" | "group", scopeId: bigint): Promise<bigint | null> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { scopeType_scopeId: { scopeType, scopeId } },
    select: { id: true },
  });
  return conversation?.id ?? null;
}
