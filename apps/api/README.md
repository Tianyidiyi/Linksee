# apps/api

后端通信框架骨架目录（MVP 版本）。

## 目标

- HTTP 负责写操作与查询
- Socket 负责实时推送
- Events 负责异步任务与跨模块通知

## 目录

- [src/http](src/http/)：REST 接口入口层
- [src/socket](src/socket/)：Socket 连接与事件推送
- [src/events](src/events/)：领域事件定义与发布入口
- `src/auth`：认证与权限中间件（规划中）
- [src/shared](src/shared/)：通信契约与通用类型

## 硬规则

1. 改数据只走 HTTP，不走 Socket。
2. Socket 网关不直接写数据库，只消费业务结果并推送。
3. 事件命名统一 entity.action。
4. 先持久化成功，再发布实时事件。
