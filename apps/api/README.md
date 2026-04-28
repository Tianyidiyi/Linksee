# apps/api

后端通信框架骨架目录（MVP 版本）。

## 目标

- HTTP 负责写操作与查询
- Socket 负责实时推送
- Events 负责异步任务与跨模块通知

## 主要依赖说明

| 库 | 版本 | 用途 | 容器化注意 |
|----|------|------|-----------|
| `prisma` + `@prisma/client` | ^7.8.0 | ORM，管理 MySQL 表结构与查询 | 容器内需重新 `npm ci` |
| `argon2` | ^0.44.0 | 密码散列（Argon2id 算法，OWASP 推荐） | **native 模块**，Alpine 镜像需加 `python3 make g++` |
| `jsonwebtoken` | ^9.0.3 | 签发和验证 JWT access token | 无特殊要求 |
| `ioredis` | ^5.10.1 | Redis 客户端，存 refresh token / 在线状态 / 限流计数 | 无特殊要求 |
| `winston` | ^3.19.0 | 结构化日志（JSON 格式输出到文件） | 无特殊要求 |
| `express` | ^4.19.2 | HTTP 服务框架 | 无特殊要求 |
| `socket.io` | ^4.8.1 | WebSocket 实时通信 | 无特殊要求 |

> **argon2 在容器化时的关键点**：不能把 Windows 本地的 `node_modules` 挂载进 Linux 容器，
> 必须在容器内执行 `npm ci` 重新编译 native 模块。
> 详见 `docs/architecture/engineering-flow-mvp.md §7`。

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
