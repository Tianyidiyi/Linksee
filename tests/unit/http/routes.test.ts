import { describe, expect, it } from "@jest/globals";
import { mvpRoutes } from "../../../apps/api/src/http/routes.js";

describe("http/routes", () => {
  it("should have no duplicated method+path pairs", () => {
    const keys = mvpRoutes.map((route) => `${route.method} ${route.path}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("should require auth for all non-auth module routes", () => {
    const nonAuthRoutes = mvpRoutes.filter((route) => route.module !== "auth");
    expect(nonAuthRoutes.every((route) => route.authRequired)).toBe(true);
  });

  it("should contain core submission and grading routes", () => {
    const keys = new Set(mvpRoutes.map((route) => `${route.method} ${route.path}`));
    expect(keys.has("POST /api/v1/stages/:stageId/groups/:groupId/submissions")).toBe(true);
    expect(keys.has("POST /api/v1/submissions/:submissionId/reviews")).toBe(true);
    expect(keys.has("POST /api/v1/submissions/:submissionId/reviews/start")).toBe(true);
    expect(keys.has("POST /api/v1/grades/:gradeId/publish")).toBe(true);
  });
});

