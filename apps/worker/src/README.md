# worker/src

Worker 源码目录。

- `submission-deadline-scheduler.ts`：提交截止定时扫描入口。

新增后台任务时，优先把可测试的业务逻辑放在对应领域模块中，再由 worker 入口负责定时、调度和日志输出。
