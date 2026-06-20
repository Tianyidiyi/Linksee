# apps/api

`@linksee/api` 是 Linksee 的主后端服务。它同时承担业务 API、鉴权、Socket.IO 实时网关和前端静态资源托管职责。

## 职责

- 提供 `/api/v1/**` REST API。
- 提供登录、JWT 鉴权、权限保护和用户上下文解析。
- 通过 Socket.IO 处理在线状态、聊天、业务事件推送。
- 通过 Prisma 访问 MySQL。
- 使用 Redis 承载刷新令牌、在线状态和部分运行时状态。
- 对接 MinIO/对象存储，服务提交文件、聊天文件等业务文件。
- 托管 `apps/web/app` 到 `/app`。
- 托管 `apps/web/demo` 到 `/demo`。

## 运行命令

在仓库根目录执行：

```bash
npm run start:auth -w @linksee/api
npm run build -w @linksee/api
npm run test -w @linksee/api
npm run test:integration -w @linksee/api
```

说明：

- `start:auth` 是当前主服务启动入口，文件位于 `src/auth/server.ts`。
- 旧的独立后端 demo server 已删除；demo 页面由正式 API 服务以 `/demo` 静态路径托管。
- `build` 当前产出 `dist/BUILD_INFO.json`，还不是完整 TypeScript 编译产物。

## 主要目录

- `src/auth/`：登录、JWT、主服务启动入口。
- `src/users/`：用户、教务、教师、助教、个人资料。
- `src/courses/`：课程、教师绑定、助教绑定、课程成员名单。
- `src/assignments/`：项目与阶段。
- `src/groups/`：小组、成员、申请、组长转移。
- `src/minitasks/`：小组任务。
- `src/submissions/`：阶段提交、提交文件、截止任务。
- `src/grading/`：批阅、成绩草稿、发布、调整。
- `src/collaboration/`：课程/小组会话、聊天文件、实时会话。
- `src/socket/`：Socket.IO 网关。
- `src/events/`：业务事件封装和实时发布。
- `src/infra/`：环境变量、Prisma、JWT 中间件、MinIO、通用 HTTP 响应。
- `prisma/`：数据库 schema 和迁移相关资源。

## 服务边界

API 的设计基线是：

- HTTP 负责查询和写入。
- Socket 负责实时推送，不直接承载核心写库命令。
- 数据先落库，再发布实时事件。
- 权限判断以后端为准，前端只做体验层隐藏和提示。
- Worker 可复用 API 内的纯任务逻辑，但 Worker 进程不直接接 HTTP 流量。

## 依赖服务

本地开发通常需要：

- MySQL：业务数据。
- Redis：在线状态、刷新令牌、限流/运行时状态。
- MinIO：对象存储。

可通过根目录 Docker 命令启动依赖：

```bash
npm run dev:deps:up
```
