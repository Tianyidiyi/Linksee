export type HttpRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  authRequired: boolean;
  module:
    | "auth"
    | "users"
    | "course"
    | "assignment"
    | "group"
    | "collaboration"
    | "submission"
    | "grading"
    | "rag";
};

// MVP 路由清单占位，按教学协作主线扩展。
export const mvpRoutes: HttpRoute[] = [
  // ── Auth ──────────────────────────────────
  { method: "POST",  path: "/api/v1/auth/login",                      authRequired: false, module: "auth" },
  { method: "POST",  path: "/api/v1/auth/refresh",                    authRequired: false, module: "auth" },
  { method: "POST",  path: "/api/v1/auth/logout",                     authRequired: false, module: "auth" },
  { method: "POST",  path: "/api/v1/auth/change-password",            authRequired: true,  module: "auth" },
  { method: "POST",  path: "/api/v1/auth/admin/reset-password",       authRequired: true,  module: "auth" },
  { method: "POST",  path: "/api/v1/auth/admin/batch-reset-password", authRequired: true,  module: "auth" },
  // ── Users ─────────────────────────────────
  { method: "GET",   path: "/api/v1/users/me",             authRequired: true,  module: "users" },
  { method: "PATCH", path: "/api/v1/users/me",             authRequired: true,  module: "users" },
  { method: "POST",  path: "/api/v1/users/me/avatar",      authRequired: true,  module: "users" },
  { method: "POST",  path: "/api/v1/users/assistants",     authRequired: true,  module: "users" },
  { method: "POST",  path: "/api/v1/users",                authRequired: true,  module: "users" },
  { method: "POST",  path: "/api/v1/users/batch/students", authRequired: true,  module: "users" },
  { method: "POST",  path: "/api/v1/users/batch/teachers", authRequired: true,  module: "users" },
  { method: "PATCH", path: "/api/v1/users/:id",            authRequired: true,  module: "users" },
  // ── Assignment ────────────────────────────
  {
    method: "POST",
    path: "/api/v1/courses/:courseId/assignments",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "POST",
    path: "/api/v1/groups/:groupId/messages",
    authRequired: true,
    module: "collaboration",
  },
  {
    method: "POST",
    path: "/api/v1/stages/:stageId/submissions",
    authRequired: true,
    module: "submission",
  },
  {
    method: "POST",
    path: "/api/v1/submissions/:submissionId/reviews",
    authRequired: true,
    module: "grading",
  },
];
