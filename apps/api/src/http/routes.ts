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
  // ── Courses ───────────────────────────────
  { method: "GET",   path: "/api/v1/courses",                    authRequired: true, module: "course" },
  { method: "POST",  path: "/api/v1/courses",                    authRequired: true, module: "course" },
  { method: "GET",   path: "/api/v1/courses/:id",                authRequired: true, module: "course" },
  { method: "PATCH", path: "/api/v1/courses/:id",                authRequired: true, module: "course" },
  { method: "GET",   path: "/api/v1/courses/:id/teachers",       authRequired: true, module: "course" },
  { method: "POST",  path: "/api/v1/courses/:id/teachers",       authRequired: true, module: "course" },
  { method: "PATCH", path: "/api/v1/courses/:id/teachers/:userId", authRequired: true, module: "course" },
  { method: "DELETE", path: "/api/v1/courses/:id/teachers/:userId", authRequired: true, module: "course" },
  { method: "GET",   path: "/api/v1/courses/:id/assistants",     authRequired: true, module: "course" },
  { method: "POST",  path: "/api/v1/courses/:id/assistants",     authRequired: true, module: "course" },
  { method: "DELETE", path: "/api/v1/courses/:id/assistants/:assistantUserId", authRequired: true, module: "course" },
  { method: "GET",   path: "/api/v1/courses/:id/members",        authRequired: true, module: "course" },
  { method: "POST",  path: "/api/v1/courses/:id/members",        authRequired: true, module: "course" },
  { method: "POST",  path: "/api/v1/courses/:id/members/batch",  authRequired: true, module: "course" },
  { method: "DELETE", path: "/api/v1/courses/:id/members/:userId", authRequired: true, module: "course" },
  // ── Assignment ────────────────────────────
  {
    method: "POST",
    path: "/api/v1/courses/:courseId/assignments",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "GET",
    path: "/api/v1/courses/:courseId/assignments",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "GET",
    path: "/api/v1/assignments/:assignmentId",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "PATCH",
    path: "/api/v1/assignments/:assignmentId",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "DELETE",
    path: "/api/v1/assignments/:assignmentId",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "POST",
    path: "/api/v1/assignments/:assignmentId/materials",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "DELETE",
    path: "/api/v1/assignments/:assignmentId/materials",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "GET",
    path: "/api/v1/assignments/:assignmentId/stages",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "POST",
    path: "/api/v1/assignments/:assignmentId/stages",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "GET",
    path: "/api/v1/assignments/:assignmentId/groups",
    authRequired: true,
    module: "group",
  },
  {
    method: "POST",
    path: "/api/v1/assignments/:assignmentId/groups",
    authRequired: true,
    module: "group",
  },
  {
    method: "GET",
    path: "/api/v1/stages/:stageId",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "PATCH",
    path: "/api/v1/stages/:stageId",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "DELETE",
    path: "/api/v1/stages/:stageId",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "POST",
    path: "/api/v1/stages/:stageId/materials",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "DELETE",
    path: "/api/v1/stages/:stageId/materials",
    authRequired: true,
    module: "assignment",
  },
  {
    method: "GET",
    path: "/api/v1/courses/:courseId/messages",
    authRequired: true,
    module: "collaboration",
  },
  {
    method: "POST",
    path: "/api/v1/courses/:courseId/messages",
    authRequired: true,
    module: "collaboration",
  },
  {
    method: "POST",
    path: "/api/v1/groups/:groupId/messages",
    authRequired: true,
    module: "collaboration",
  },
  {
    method: "GET",
    path: "/api/v1/groups/:groupId/messages",
    authRequired: true,
    module: "collaboration",
  },
  {
    method: "POST",
    path: "/api/v1/groups/:groupId/members",
    authRequired: true,
    module: "group",
  },
  {
    method: "POST",
    path: "/api/v1/groups/:groupId/join-requests",
    authRequired: true,
    module: "group",
  },
  {
    method: "GET",
    path: "/api/v1/groups/:groupId/join-requests",
    authRequired: true,
    module: "group",
  },
  {
    method: "POST",
    path: "/api/v1/group-join-requests/:requestId/approve",
    authRequired: true,
    module: "group",
  },
  {
    method: "POST",
    path: "/api/v1/group-join-requests/:requestId/reject",
    authRequired: true,
    module: "group",
  },
  {
    method: "POST",
    path: "/api/v1/groups/:groupId/leader-transfer-requests",
    authRequired: true,
    module: "group",
  },
  {
    method: "POST",
    path: "/api/v1/group-leader-transfer-requests/:requestId/accept",
    authRequired: true,
    module: "group",
  },
  {
    method: "POST",
    path: "/api/v1/group-leader-transfer-requests/:requestId/reject",
    authRequired: true,
    module: "group",
  },
  {
    method: "DELETE",
    path: "/api/v1/groups/:groupId/members/:userId",
    authRequired: true,
    module: "group",
  },
  {
    method: "POST",
    path: "/api/v1/stages/:stageId/groups/:groupId/submissions",
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
