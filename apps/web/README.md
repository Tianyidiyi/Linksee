# apps/web

`@linksee/web` 存放 Linksee 前端静态资源。当前前端不是 Vue/React 工程，而是 HTML + CSS + 原生 JavaScript 的静态页面模式。

## 当前开发模式

- `app/`：正式应用页面，由 API 服务托管到 `/app`。
- `demo/`：演示页面，由 API 服务托管到 `/demo`。
- `app/styles/`：全局样式、布局、组件和 dashboard 覆盖样式。
- `app/scripts/`：页面级原生 JavaScript 逻辑。
- `src/api/`：前端 API 调用封装。
- `src/realtime/`：Socket 客户端和事件处理。
- `src/state/`：前端状态组织说明。

当前没有独立 Web dev server，也没有 Vite/Webpack 构建链。启动 `@linksee/api` 后，API 服务会静态托管页面。

## 页面入口

正式应用：

- `/app/login.html`
- `/app/academic-dashboard.html`
- `/app/teacher-dashboard.html`
- `/app/assistant-dashboard.html`
- `/app/student-dashboard.html`
- `/app/chat-hub.html`
- `/app/submission-hub.html`

演示页面：

- `/demo/login.html`
- `/demo/status.html`
- `/demo/vue-review-workbench.html`

## 运行命令

```bash
npm run start:auth -w @linksee/api
npm run build -w @linksee/web
npm run test:e2e -w @linksee/web
```

说明：

- `build` 当前只生成 `dist/BUILD_INFO.json`。
- `test:e2e` 使用仓库级 Playwright 配置。
- `demo/vue-review-workbench.html` 是 Vue 视觉原型，通过 CDN 引入 Vue 3，不代表当前正式前端已经迁移到 Vue。

## 维护建议

短期继续维护现有静态页面时，应优先：

1. 保持页面入口清晰，不再新增旧式独立 demo server。
2. 把复用逻辑放到 `app/scripts` 的共享模块或 `src` 下。
3. 避免在 HTML 中继续堆叠大量业务逻辑。
4. 新增复杂工作台时，优先考虑 Vue/Vite 试点，成熟后再迁移正式页面。

## 与后端关系

- 页面通过 `window.linkseeApi` 或 `src/api` 封装调用 `/api/v1/**`。
- 实时能力通过 Socket.IO 客户端连接 API 服务。
- 默认头像等静态资源可以走 `/demo/default-avatar-gray.svg` 或正式静态路径。
