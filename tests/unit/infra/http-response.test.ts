import { describe, expect, it } from "@jest/globals";
import { fail, ok } from "../../../apps/api/src/infra/http-response.js";

function createRes(withGetHeader = true) {
  const state: { status?: number; body?: unknown } = {};
  const res: any = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  };
  if (withGetHeader) {
    res.getHeader = (name: string) => (name === "x-request-id" ? "rid-1" : undefined);
  }
  return { res, state };
}

describe("infra/http-response", () => {
  it("ok should default to status 200", () => {
    const { res, state } = createRes();
    ok(res, { ok: 1 });
    expect(state.status).toBe(200);
    expect(state.body).toEqual({ ok: true, data: { ok: 1 } });
  });

  it("ok should emit success payload with status", () => {
    const { res, state } = createRes();
    ok(res, { a: 1 }, 201);
    expect(state.status).toBe(201);
    expect(state.body).toEqual({ ok: true, data: { a: 1 } });
  });

  it("fail should include requestId when getHeader exists", () => {
    const { res, state } = createRes(true);
    fail(res, 400, "VALIDATION_FAILED", "bad", { field: "x" });
    expect(state.status).toBe(400);
    expect(state.body).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "bad",
      details: { field: "x" },
      requestId: "rid-1",
    });
  });

  it("fail should still work when getHeader is absent", () => {
    const { res, state } = createRes(false);
    fail(res, 401, "UNAUTHENTICATED", "no token");
    expect(state.status).toBe(401);
    expect(state.body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "no token",
      details: null,
      requestId: null,
    });
  });

  it("fail should set requestId to null when getHeader exists but has no id", () => {
    const state: { status?: number; body?: unknown } = {};
    const res: any = {
      status(code: number) {
        state.status = code;
        return this;
      },
      json(body: unknown) {
        state.body = body;
        return this;
      },
      getHeader() {
        return undefined;
      },
    };
    fail(res, 500, "INTERNAL_ERROR", "oops");
    expect(state.status).toBe(500);
    expect(state.body).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "oops",
      details: null,
      requestId: null,
    });
  });
});
