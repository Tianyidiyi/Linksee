export type HttpRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  authRequired: boolean;
  module:
    | "auth"
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
