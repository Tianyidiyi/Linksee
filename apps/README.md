# apps

此目录存放可独立运行的应用程序入口。

## 子目录

- web：前端应用（用户页面、管理页面）
- api：后端 API 服务（REST + WebSocket）
- worker：异步任务处理（文档切片、向量化、定时任务）

## 设计原则

- 每个应用可独立启动、独立构建
- 应用之间通过 API、消息、事件通信
- 业务逻辑尽量下沉到 services 或 packages

## 当前骨架进度

- api：已建立 src/http, src/socket, src/events, src/auth, src/shared 通信骨架
- web：已建立 src/api, src/realtime, src/state 客户端通信骨架
