import jwt from "jsonwebtoken";
import { describe, expect, it } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import { forceChangeGuard, optionalAuth, requireAuth } from "../../../apps/api/src/infra/jwt-middleware.js";

function createReq(header?: string, path = "/api/v1/courses") {
  return {
    header(name: string) {
      if (name.toLowerCase() === "authorization") return header;
      return undefined;
    },
    path,
    user: undefined as any,
  } as any;
}

function createRes() {
  const state: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  };
  return { res: res as any, state };
}

describe("jwt-middleware", () => {
  describe("optionalAuth", () => {
    it("should skip when no bearer token", () => {
      const req = createReq(undefined);
      let called = false;
      optionalAuth(req, {} as any, () => {
        called = true;
      });
      expect(called).toBe(true);
      expect(req.user).toBeUndefined();
    });

    it("should attach user when token is valid", () => {
      const token = jwt.sign(
        { sub: "2023010001", role: "student", forceChangePassword: false },
        env.jwtSecret,
      );
      const req = createReq(`Bearer ${token}`);
      optionalAuth(req, {} as any, () => undefined);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("2023010001");
    });

    it("should ignore invalid token and continue", () => {
      const req = createReq("Bearer bad-token");
      let called = false;
      optionalAuth(req, {} as any, () => {
        called = true;
      });
      expect(called).toBe(true);
      expect(req.user).toBeUndefined();
    });
  });

  describe("forceChangeGuard", () => {
    it("should block non-change-password path for forced user", () => {
      const req = createReq(undefined, "/api/v1/courses");
      req.user = { id: "u1", role: "student", forceChangePassword: true };
      const { res, state } = createRes();
      let called = false;
      forceChangeGuard(req, res, () => {
        called = true;
      });
      expect(called).toBe(false);
      expect(state.status).toBe(403);
    });

    it("should allow change-password path", () => {
      const req = createReq(undefined, "/api/v1/auth/change-password");
      req.user = { id: "u1", role: "student", forceChangePassword: true };
      const { res } = createRes();
      let called = false;
      forceChangeGuard(req, res, () => {
        called = true;
      });
      expect(called).toBe(true);
    });
  });

  describe("requireAuth", () => {
    it("should reject missing token", () => {
      const req = createReq(undefined);
      const { res, state } = createRes();
      let called = false;
      requireAuth(req, res, () => {
        called = true;
      });
      expect(called).toBe(false);
      expect(state.status).toBe(401);
    });

    it("should reject invalid token", () => {
      const req = createReq("Bearer bad-token");
      const { res, state } = createRes();
      requireAuth(req, res, () => undefined);
      expect(state.status).toBe(401);
    });

    it("should accept valid token", () => {
      const token = jwt.sign(
        { sub: "2023010002", role: "teacher", forceChangePassword: false },
        env.jwtSecret,
      );
      const req = createReq(`Bearer ${token}`);
      const { res, state } = createRes();
      let called = false;
      requireAuth(req, res, () => {
        called = true;
      });
      expect(called).toBe(true);
      expect(state.status).toBeUndefined();
      expect(req.user.id).toBe("2023010002");
    });
  });
});
