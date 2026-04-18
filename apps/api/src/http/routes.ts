export type HttpRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  authRequired: boolean;
  module: "auth" | "team" | "project-task" | "chat" | "docs" | "feed" | "rag";
};

// MVP 路由清单占位，后续可按模块扩展。
export const mvpRoutes: HttpRoute[] = [
  {
    method: "POST",
    path: "/api/v1/tasks/:taskId/comments",
    authRequired: true,
    module: "project-task",
  },
  {
    method: "GET",
    path: "/api/v1/channels/:channelId/messages",
    authRequired: true,
    module: "chat",
  },
];
