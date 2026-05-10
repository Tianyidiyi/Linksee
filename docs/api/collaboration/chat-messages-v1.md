# 群聊消息增强（课程群 / 小组群）

本文件描述群聊消息增强后的 HTTP/Socket 对接规范，覆盖：撤回/编辑、回复引用、@提醒、搜索、文件上传签名、缩略图、断线重传窗口、ACK 机制、会话列表与未读计数。

## 1. 消息模型

**ChatMessage 扩展字段**

- `mentions`: `string[]`，被 @ 的用户 ID 列表（最多 20）
- `replyToId`: `string | null`，回复引用的消息 ID
- `editedAt`: `string | null`，编辑时间
- `deletedAt`: `string | null`，撤回时间
- `messageType`: `text | file | announcement`

**文件元数据（files 数组元素）**

```
{
  name: string,
  objectKey: string,
  size: number,
  mimeType: string,
  uploadedAt: string,
  thumbnailKey?: string
}
```

> 说明：MVP 的 `thumbnailKey` 默认等于原文件 `objectKey`（仅对图片生效），不做缩放处理。

## 2. 课程群消息

### 2.1 拉历史（游标分页）

GET `/api/v1/courses/{courseId}/messages`

Query:
- `beforeId` / `afterId` 二选一
- `limit` 默认 50，最大 100

Response:
- `data`: 消息列表
- `paging`: `{ hasMore, nextCursor }`

### 2.2 发送消息（文本/文件）

POST `/api/v1/courses/{courseId}/messages`

Headers:
- `Idempotency-Key` 可选，用于弱网重试去重

Body:
- `type`: `text | file`
- `content`: `string`（文本必填）
- `files`: `ChatFileMetadata[]`（文件必填）
- `mentions`: `string[]`（可选）
- `replyToId`: `string`（可选）

### 2.3 课程公告（仅课程管理者）

POST `/api/v1/courses/{courseId}/announcements`

Body:
- `content`: `string`

### 2.4 搜索

GET `/api/v1/courses/{courseId}/messages/search?q=keyword&limit=50`

### 2.5 编辑

PATCH `/api/v1/courses/{courseId}/messages/{messageId}`

Body:
- `content`: `string`
- `mentions`: `string[]`（可选）

> 文件消息不可编辑。

### 2.6 撤回

DELETE `/api/v1/courses/{courseId}/messages/{messageId}`

## 3. 小组群消息

与课程群一致，路径替换为：

- GET `/api/v1/groups/{groupId}/messages`
- POST `/api/v1/groups/{groupId}/messages`
- POST `/api/v1/groups/{groupId}/announcements`
- GET `/api/v1/groups/{groupId}/messages/search`
- PATCH `/api/v1/groups/{groupId}/messages/{messageId}`
- DELETE `/api/v1/groups/{groupId}/messages/{messageId}`

## 4. 文件上传/下载签名

### 4.1 申请上传签名

POST `/api/v1/chat/files/presign-upload`

Body:
- `scopeType`: `course | group`
- `scopeId`: `string`
- `fileName`: `string`
- `mimeType`: `string`
- `size`: `number`

Response:
- `uploadUrl`
- `objectKey`
- `expiresInSeconds`

### 4.2 下载签名

GET `/api/v1/chat/files/presign-download?objectKey=...`

Response:
- `downloadUrl`
- `expiresInSeconds`

**限制**
- 单文件最大 500MB
- MIME 白名单：常见办公/图片/压缩/代码/视频（包含 `text/*` 与 `.tex`）
- 文件保留 7 天（过期清理）

清理脚本：`apps/api/src/collaboration/chat-files-cleanup.ts`（建议接入定时任务）。

## 5. 会话列表与未读数

### 5.1 会话列表

GET `/api/v1/conversations`

返回：课程/小组会话列表 + 最近一条消息 + `unreadCount`

### 5.2 标记已读

POST `/api/v1/conversations/{conversationId}/read`

Body:
- `messageId`: 最新已读消息 ID

## 6. ACK 与断线重传窗口

### 6.1 ACK 回传

POST `/api/v1/realtime/acks`

Body:
- `eventId`
- `roomKey`
- `messageId`（可选）

客户端在**渲染成功后**回 ACK。

### 6.2 断线重传

GET `/api/v1/realtime/replay?room=course:{courseId}&afterEventId=...`

服务端按窗口缓存事件重放，已 ACK 的事件会被过滤。

## 7. Socket 事件

- `course.message.created`
- `course.message.updated`
- `course.message.deleted`
- `group.message.created`
- `group.message.updated`
- `group.message.deleted`

payload 补充字段：
- `messageId`
- `messageType`
- `mentions`
- `replyToId`

## 8. 前后端对接建议

1. **发送文件消息**：先 presign 上传 → 上传到 MinIO → POST 消息写库。
2. **离线补拉**：记录最后一条 `messageId`，用 `afterId` 拉增量。
3. **重复去重**：前端用 `messageId` + `event.id` 去重。
4. **弱网缓存**：前端本地缓存待发送消息，使用 `Idempotency-Key` 进行重试。
