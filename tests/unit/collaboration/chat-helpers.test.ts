import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import {
  CHAT_MENTION_LIMIT,
  ensureCourseConversation,
  ensureGroupConversation,
  getConversationId,
  normalizeMentions,
  parseCursorParam,
  parseLimit,
  resolveMessageType,
} from "../../../apps/api/src/collaboration/chat-helpers.js";

describe("chat-helpers", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("parseLimit", () => {
    it("should return default 50 for invalid input", () => {
      expect(parseLimit(undefined)).toBe(50);
      expect(parseLimit(null)).toBe(50);
      expect(parseLimit("invalid")).toBe(50);
      expect(parseLimit(-5)).toBe(50);
      expect(parseLimit(0)).toBe(50);
    });

    it("should return parsed and bounded values", () => {
      expect(parseLimit(30)).toBe(30);
      expect(parseLimit("50")).toBe(50);
      expect(parseLimit(100)).toBe(100);
      expect(parseLimit(150)).toBe(100);
      expect(parseLimit("200")).toBe(100);
      expect(parseLimit(50.7)).toBe(50);
      expect(parseLimit("75.5")).toBe(75);
    });
  });

  describe("parseCursorParam", () => {
    it("should return null for missing value", () => {
      const mockRes = { status: () => ({ json: () => undefined }) } as any;
      expect(parseCursorParam(undefined, mockRes, "beforeId")).toBeNull();
      expect(parseCursorParam(null, mockRes, "beforeId")).toBeNull();
    });

    it("should parse valid string and number", () => {
      const mockRes = { status: () => ({ json: () => undefined }) } as any;
      expect(parseCursorParam("12345", mockRes, "beforeId")).toBe(12345n);
      expect(parseCursorParam(999, mockRes, "beforeId")).toBe(999n);
    });

    it("should reject invalid values", () => {
      let statusCalled = 0;
      const mockRes = {
        status: (code: number) => {
          statusCalled += 1;
          expect(code).toBe(400);
          return { json: () => undefined };
        },
      } as any;
      expect(parseCursorParam("abc", mockRes, "beforeId")).toBeNull();
      expect(parseCursorParam("-1", mockRes, "beforeId")).toBeNull();
      expect(statusCalled).toBe(2);
    });

    it("should reject unsupported raw types", () => {
      let statusCalled = false;
      const mockRes = {
        status: () => {
          statusCalled = true;
          return { json: () => undefined };
        },
      } as any;
      expect(parseCursorParam({} as any, mockRes, "beforeId")).toBeNull();
      expect(statusCalled).toBe(true);
    });

    it("should hit bigint catch branch when BigInt throws", () => {
      const original = (globalThis as any).BigInt;
      (globalThis as any).BigInt = () => {
        throw new Error("forced");
      };
      let statusCalled = false;
      const mockRes = {
        status: () => {
          statusCalled = true;
          return { json: () => undefined };
        },
      } as any;
      expect(parseCursorParam("123", mockRes, "beforeId")).toBeNull();
      expect(statusCalled).toBe(true);
      (globalThis as any).BigInt = original;
    });
  });

  describe("resolveMessageType", () => {
    it("should resolve announcement/file/text/default", () => {
      expect(resolveMessageType({ type: "announcement" }, "x")).toBe("announcement");
      expect(resolveMessageType({ key: "v" }, "")).toBe("file");
      expect(resolveMessageType([{ name: "f.pdf" }], null)).toBe("file");
      expect(resolveMessageType(null, "Hello")).toBe("text");
      expect(resolveMessageType(undefined, "   ")).toBe("text");
      expect(resolveMessageType(null, null)).toBe("text");
    });
  });

  describe("normalizeMentions", () => {
    it("should normalize and limit mentions", () => {
      expect(normalizeMentions(undefined)).toEqual([]);
      expect(normalizeMentions(["user1", 1, null, " user2 ", "user1", "   "])).toEqual(["user1", "user2"]);
      const mentions = Array.from({ length: 30 }, (_, i) => `user${i}`);
      const result = normalizeMentions(mentions);
      expect(result.length).toBe(CHAT_MENTION_LIMIT);
      expect(result[0]).toBe("user0");
      expect(result[CHAT_MENTION_LIMIT - 1]).toBe(`user${CHAT_MENTION_LIMIT - 1}`);
    });
  });

  describe("conversation helpers", () => {
    it("ensureCourseConversation/ensureGroupConversation should call upsert", async () => {
      const upsertSpy = jest.spyOn(prisma.chatConversation, "upsert").mockResolvedValue({} as any);
      await ensureCourseConversation(1n);
      await ensureGroupConversation(2n, "u1");
      expect(upsertSpy).toHaveBeenCalledTimes(2);
    });

    it("getConversationId should return id or null", async () => {
      const findSpy = jest.spyOn(prisma.chatConversation, "findUnique");
      findSpy.mockResolvedValueOnce({ id: 10n } as any);
      await expect(getConversationId("course", 1n)).resolves.toBe(10n);
      findSpy.mockResolvedValueOnce(null as any);
      await expect(getConversationId("group", 2n)).resolves.toBeNull();
    });
  });
});
