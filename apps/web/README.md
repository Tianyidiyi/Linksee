# apps/web

前端客户端骨架目录（MVP 版本）。

## 角色定位

- [api](src/api/)：通过 HTTP 访问业务写接口和查询接口
- [realtime](src/realtime/)：处理 Socket 连接、订阅和事件分发
- [state](src/state/)：预留页面状态组织边界，用于后续合并 HTTP 结果与 Socket 增量更新

## 前端硬规则

1. 不通过 Socket 提交写操作。
2. 所有写操作统一走 HTTP。
3. Socket 只接收服务端变化推送。
4. 收到重复事件时按 eventId 去重。
