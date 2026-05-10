# apps/web

Web 端工程目录，当前用于承载前端静态页面、联调代码与构建产物。

## 目录结构

- `app/`：主应用静态资源目录（由 API 服务以 `/app` 路径托管）
- `demo/`：演示页面静态资源目录（由 API 服务以 `/demo` 路径托管）
- `src/api/`：HTTP 请求封装与 API 调用逻辑
- `src/realtime/`：Socket 客户端与事件处理
- `src/state/`：前端状态与联调说明
- `scripts/build.mjs`：构建脚本
- `dist/`：构建产物目录（当前产出 `BUILD_INFO.json`）

## 可用命令

在仓库根目录执行：

```bash
npm run build --workspace @linksee/web
```

或在 `apps/web` 目录执行：

```bash
npm run build
```

当前 `web` 包没有独立 `dev` 脚本；页面由 API 服务统一静态托管。

## 运行与访问

启动 API 服务后可访问：

- `/app`
- `/demo`

说明：`apps/api/src/auth/server.ts` 已挂载上述两个静态目录。

## 联调文档入口

- 前后端联调规范：`docs/api/前后端联调对齐说明.md`
- 当前交付状态：`docs/status/current-delivery-status.md`
- OpenAPI：`docs/api/openapi/linksee-v1.yaml`

## 当前联调覆盖

1. Auth + Users
2. Courses
3. Assignments + Stages（含材料上传/删除）

未完成主联调的模块：Group、Submission、Review、Socket/Worker 闭环业务事件。
