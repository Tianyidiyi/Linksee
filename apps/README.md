# apps

`apps` 存放可以独立启动或独立构建的应用入口。当前仓库采用 npm workspaces 组织，主要应用包括：

- [`api`](api/)：后端 HTTP API、Socket.IO 实时网关、静态资源托管入口。
- [`web`](web/)：前端静态页面、演示页面、前端通信封装。
- [`worker`](worker/)：后台定时任务和异步任务进程。

## 当前服务形态

Linksee 当前是“模块化单体后端 + 静态前端 + 独立 worker”的形态：

- `api` 是主服务进程，负责鉴权、业务 API、实时通信、文件相关入口，并托管 `/app` 和 `/demo` 静态页面。
- `web` 当前不是 Vue/React/Vite 应用，而是 HTML + CSS + 原生 JavaScript 的静态前端资源集合。
- `worker` 是独立 Node 进程，用于运行不适合绑在请求生命周期里的后台任务。

## 本地常用命令

在仓库根目录执行：

```bash
npm run build
npm run start:auth -w @linksee/api
npm run start:submission-deadline-scheduler -w @linksee/worker
```

Web 页面由 API 服务托管。启动 `@linksee/api` 后访问：

- `/app/login.html`
- `/app/teacher-dashboard.html`
- `/app/student-dashboard.html`
- `/demo/login.html`
- `/demo/vue-review-workbench.html`

## 边界原则

1. 业务写入走 HTTP API，不通过 Socket 直接写库。
2. Socket.IO 负责实时状态、消息和业务结果推送。
3. 后台任务放在 `worker` 或 API 内部 job，不放到前端。
4. 前端静态页面可以演示功能，但正式业务数据必须通过 API 获取。
5. 验收数据脚本放在 [`scripts/验收`](../scripts/验收/)，验收文档放在 [`docs/验收`](../docs/验收/)。
