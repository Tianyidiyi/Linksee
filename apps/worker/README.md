# apps/worker

`@linksee/worker` 存放后台任务进程。它与 API 服务分开启动，用于运行定时扫描、异步处理和不适合放在 HTTP 请求生命周期里的任务。

## 当前任务

- `src/submission-deadline-scheduler.ts`：定时执行提交截止扫描，调用 API 包中的 `runSubmissionDeadlineJob`，把逾期未提交的小组/阶段标记为未提交。

## 运行命令

```bash
npm run start:submission-deadline-scheduler -w @linksee/worker
npm run build -w @linksee/worker
```

环境变量：

- `SUBMISSION_DEADLINE_JOB_INTERVAL_MINUTES`：扫描间隔，默认 5 分钟。

## 边界说明

- Worker 不提供 HTTP API。
- Worker 可以复用 API 中的纯任务逻辑，但不应依赖 Express 请求上下文。
- Worker 与 API 使用同一套数据库和环境变量配置。
- 后续文件处理、通知聚合、数据预处理等后台任务可以继续放在此应用。
