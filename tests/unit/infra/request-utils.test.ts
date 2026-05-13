import { describe, expect, it } from "@jest/globals";
import { parseIdempotencyKey, parseLimitOffset } from "../../../apps/api/src/infra/request-utils.js";

describe("infra/request-utils", () => {
  it("parseLimitOffset should clamp and normalize", () => {
    expect(parseLimitOffset({})).toEqual({ limit: 20, offset: 0 });
    expect(parseLimitOffset({ limit: "200", offset: "-2" })).toEqual({ limit: 100, offset: 0 });
    expect(parseLimitOffset({ limit: "3.9", offset: "8.6" })).toEqual({ limit: 3, offset: 8 });
    expect(parseLimitOffset({ limit: "x", offset: "y" })).toEqual({ limit: 20, offset: 0 });
  });

  it("parseIdempotencyKey should validate header", () => {
    const reqA = { header: (_: string) => null } as any;
    expect(parseIdempotencyKey(reqA)).toBeNull();
    const reqB = { header: (_: string) => "a".repeat(65) } as any;
    expect(parseIdempotencyKey(reqB)).toBeNull();
    const reqC = { header: (_: string) => "idem-1" } as any;
    expect(parseIdempotencyKey(reqC)).toBe("idem-1");
  });
});
