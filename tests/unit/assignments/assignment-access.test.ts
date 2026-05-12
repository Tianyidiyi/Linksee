import { describe, expect, it } from "@jest/globals";
import {
  conflict,
  canTransitionAssignmentStatus,
  canTransitionStageStatus,
  forbidden,
  notFound,
  parseAssignmentStatus,
  parseBigIntParam,
  parseDateTimeInput,
  parseSingleString,
  parseWeightInput,
  serializeBigInt,
  validateStageDueAtState,
  validateStageWindow,
  validationFailed,
} from "../../../apps/api/src/assignments/assignment-access.js";

const AssignmentStatus = {
  draft: "draft",
  active: "active",
  archived: "archived",
} as const;

const StageStatus = {
  planned: "planned",
  open: "open",
  closed: "closed",
  archived: "archived",
} as const;

function createRes() {
  const state: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  };
  return { res: res as any, state };
}

describe("assignment-access", () => {
  describe("response and serializer helpers", () => {
    it("should serialize bigint and write response helpers", () => {
      expect(serializeBigInt({ id: 1n } as any)).toEqual({ id: "1" });

      const a = createRes();
      forbidden(a.res, "x");
      expect(a.state.statusCode).toBe(403);

      const b = createRes();
      notFound(b.res, "x");
      expect(b.state.statusCode).toBe(404);

      const c = createRes();
      validationFailed(c.res, "x");
      expect(c.state.statusCode).toBe(400);

      const d = createRes();
      conflict(d.res, "x");
      expect(d.state.statusCode).toBe(409);
    });
  });

  describe("parseBigIntParam", () => {
    it("should parse valid number string", () => {
      const { res, state } = createRes();
      expect(parseBigIntParam("123", "courseId", res)).toBe(123n);
      expect(state.statusCode).toBeUndefined();
    });

    it("should reject array/undefined/non-digit", () => {
      const c1 = createRes();
      expect(parseBigIntParam(["1"], "courseId", c1.res)).toBeNull();
      expect(c1.state.statusCode).toBe(400);

      const c2 = createRes();
      expect(parseBigIntParam(undefined, "courseId", c2.res)).toBeNull();
      expect(c2.state.statusCode).toBe(400);

      const c3 = createRes();
      expect(parseBigIntParam("12a", "courseId", c3.res)).toBeNull();
      expect(c3.state.statusCode).toBe(400);
    });

    it("should hit bigint parse catch branch when BigInt throws", () => {
      const original = (globalThis as any).BigInt;
      (globalThis as any).BigInt = () => {
        throw new Error("forced");
      };
      const c = createRes();
      expect(parseBigIntParam("123", "courseId", c.res)).toBeNull();
      expect(c.state.statusCode).toBe(400);
      (globalThis as any).BigInt = original;
    });
  });

  describe("parseSingleString", () => {
    it("should parse trimmed non-empty string", () => {
      expect(parseSingleString("  abc ")).toBe("abc");
    });

    it("should reject empty or non-string", () => {
      expect(parseSingleString("   ")).toBeNull();
      expect(parseSingleString(123)).toBeNull();
      expect(parseSingleString(null)).toBeNull();
    });
  });

  describe("parseAssignmentStatus", () => {
    it("should parse enum values", () => {
      expect(parseAssignmentStatus("draft")).toBe(AssignmentStatus.draft);
      expect(parseAssignmentStatus("active")).toBe(AssignmentStatus.active);
      expect(parseAssignmentStatus("archived")).toBe(AssignmentStatus.archived);
    });

    it("should reject invalid values", () => {
      expect(parseAssignmentStatus("x")).toBeNull();
      expect(parseAssignmentStatus(1)).toBeNull();
    });
  });

  describe("canTransitionAssignmentStatus", () => {
    it("should allow expected transitions", () => {
      expect(canTransitionAssignmentStatus(AssignmentStatus.draft, AssignmentStatus.draft)).toBe(true);
      expect(canTransitionAssignmentStatus(AssignmentStatus.draft, AssignmentStatus.active)).toBe(true);
      expect(canTransitionAssignmentStatus(AssignmentStatus.draft, AssignmentStatus.archived)).toBe(true);
      expect(canTransitionAssignmentStatus(AssignmentStatus.active, AssignmentStatus.archived)).toBe(true);
    });

    it("should reject illegal transitions", () => {
      expect(canTransitionAssignmentStatus(AssignmentStatus.active, AssignmentStatus.draft)).toBe(false);
      expect(canTransitionAssignmentStatus(AssignmentStatus.archived, AssignmentStatus.active)).toBe(false);
      expect(canTransitionAssignmentStatus(AssignmentStatus.archived, AssignmentStatus.draft)).toBe(false);
    });
  });

  describe("parseDateTimeInput", () => {
    it("should parse undefined/null/valid ISO string", () => {
      const c1 = createRes();
      expect(parseDateTimeInput(undefined, "startAt", c1.res)).toBeUndefined();

      const c2 = createRes();
      expect(parseDateTimeInput(null, "startAt", c2.res)).toBeNull();

      const c3 = createRes();
      const value = parseDateTimeInput("2026-01-01T00:00:00.000Z", "startAt", c3.res);
      expect(value instanceof Date).toBe(true);
      expect(c3.state.statusCode).toBeUndefined();
    });

    it("should reject invalid types and bad datetime", () => {
      const c1 = createRes();
      expect(parseDateTimeInput(123, "startAt", c1.res)).toBeUndefined();
      expect(c1.state.statusCode).toBe(400);

      const c2 = createRes();
      expect(parseDateTimeInput("not-a-date", "startAt", c2.res)).toBeUndefined();
      expect(c2.state.statusCode).toBe(400);
    });
  });

  describe("parseWeightInput", () => {
    it("should parse undefined/null/valid number", () => {
      const c1 = createRes();
      expect(parseWeightInput(undefined, c1.res)).toBeUndefined();

      const c2 = createRes();
      expect(parseWeightInput(null, c2.res)).toBeNull();

      const c3 = createRes();
      expect(parseWeightInput(35.5, c3.res)?.toString()).toBe("35.5");
    });

    it("should reject invalid values", () => {
      for (const value of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY, "1"] as unknown[]) {
        const c = createRes();
        expect(parseWeightInput(value, c.res)).toBeUndefined();
        expect(c.state.statusCode).toBe(400);
      }
    });
  });

  describe("canTransitionStageStatus", () => {
    it("should allow expected transitions", () => {
      expect(canTransitionStageStatus(StageStatus.planned, StageStatus.open)).toBe(true);
      expect(canTransitionStageStatus(StageStatus.planned, StageStatus.archived)).toBe(true);
      expect(canTransitionStageStatus(StageStatus.open, StageStatus.closed)).toBe(true);
      expect(canTransitionStageStatus(StageStatus.open, StageStatus.archived)).toBe(true);
      expect(canTransitionStageStatus(StageStatus.closed, StageStatus.archived)).toBe(true);
      expect(canTransitionStageStatus(StageStatus.closed, StageStatus.closed)).toBe(true);
    });

    it("should reject illegal transitions", () => {
      expect(canTransitionStageStatus(StageStatus.open, StageStatus.planned)).toBe(false);
      expect(canTransitionStageStatus(StageStatus.closed, StageStatus.open)).toBe(false);
      expect(canTransitionStageStatus(StageStatus.archived, StageStatus.open)).toBe(false);
    });
  });

  describe("stage datetime validations", () => {
    it("validateStageWindow should reject start>=due", () => {
      const c = createRes();
      const startAt = new Date("2026-01-02T00:00:00.000Z");
      const dueAt = new Date("2026-01-01T00:00:00.000Z");
      expect(validateStageWindow(startAt, dueAt, c.res)).toBe(false);
      expect(c.state.statusCode).toBe(400);
    });

    it("validateStageWindow should allow missing or correct window", () => {
      const c1 = createRes();
      expect(validateStageWindow(undefined, undefined, c1.res)).toBe(true);

      const c2 = createRes();
      const startAt = new Date("2026-01-01T00:00:00.000Z");
      const dueAt = new Date("2026-01-02T00:00:00.000Z");
      expect(validateStageWindow(startAt, dueAt, c2.res)).toBe(true);
    });

    it("validateStageDueAtState should enforce dueAt in future for planned/open", () => {
      const c1 = createRes();
      const past = new Date(Date.now() - 60_000);
      expect(validateStageDueAtState(past, StageStatus.open, c1.res)).toBe(false);
      expect(c1.state.statusCode).toBe(400);

      const c2 = createRes();
      expect(validateStageDueAtState(past, StageStatus.closed, c2.res)).toBe(true);
      const c3 = createRes();
      expect(validateStageDueAtState(past, StageStatus.archived, c3.res)).toBe(true);
    });
  });
});
