# 通信契约 v1（MVP）

## 1. HTTP 契约（示例）

### 1.1 任务评论创建

- Method: POST
- Path: /api/v1/tasks/{taskId}/comments
- Headers:
  - Authorization: Bearer <token>
  - Idempotency-Key: <uuid>
- Request:
  - content: string
- Response:
  - id: string
  - taskId: string
  - content: string
  - creatorId: string
  - createdAt: string

### 1.2 历史消息分页

- Method: GET
- Path: /api/v1/channels/{channelId}/messages
- Query:
  - cursor?: string
  - limit?: number

## 2. Socket 契约（示例）

### 2.1 握手

- token 放在握手鉴权字段
- 鉴权失败立即断开

### 2.2 房间

- team:{teamId}
- project:{projectId}
- channel:{channelId}

### 2.3 推送事件

统一 envelope：

- id
- name
- occurredAt
- traceId
- payload

事件示例：

1. task.comment.created
2. task.updated
3. chat.message.created
4. feed.notice.created

## 3. Worker 事件契约（预留 RAG）

### 3.1 文档上传后处理

- doc.uploaded
- doc.process.requested
- doc.process.completed

## 4. 错误码约定

- UNAUTHENTICATED
- FORBIDDEN
- NOT_FOUND
- CONFLICT
- VALIDATION_FAILED
- INTERNAL_ERROR

## 5. 一致性约定

1. 先 HTTP 成功写库，再推送 Socket 事件。
2. Socket 推送失败不回滚主事务。
3. 前端通过历史拉取 + 增量事件修正最终状态。
