# 前端联调清单 — 群聊消息功能

本文件用于前端开发自检，确保与后端接口对接完整。

---

## 1. 前置条件

- [ ] 已获取有效的 JWT token（`Authorization: Bearer {token}`）
- [ ] WebSocket 已连接，room key 格式确认（`course:xxx` / `group:xxx`）
- [ ] MinIO 预签名链接功能验证（CORS 配置）

---

## 2. 接口对接检查清单

### 2.1 消息列表 & 分页

**接口**：`GET /api/v1/courses/{courseId}/messages`（课程）或 `GET /api/v1/groups/{groupId}/messages`（小组）

**必测场景**：
- [ ] 首次进入时拉最新 50 条消息（不带 cursor）
- [ ] 向上滑动加载历史（`beforeId` + 递减）
- [ ] 向下滑动加载新消息（`afterId` + 递增）
- [ ] 分页返回 `paging.hasMore` 和 `nextCursor`
- [ ] `limit` 参数校验（>100 截断为 100）
- [ ] 消息排序：按 `createdAt` 升序展示
- [ ] 软删除消息不展示（`deletedAt != null` 时隐藏）

**字段验证**：
```
{
  id: "123",                    // 大整数字符串
  conversationId: "456",
  senderId: "2023010001",       // 一卡通号
  content: "text message",      // 可为 null
  files: [{ name, objectKey, size, mimeType, uploadedAt, thumbnailKey? }],
  mentions: ["2023010002"],     // 被@的用户ID
  replyToId: "789",             // 可为 null
  messageType: "text|file|announcement",
  eventId: "uuid",              // 用于幂等性
  traceId: "uuid",
  createdAt: "2026-05-10T...",
  editedAt: null,               // 编辑时更新
  deletedAt: null               // 撤回时更新
}
```

---

### 2.2 发送消息

**接口**：`POST /api/v1/courses/{courseId}/messages`（课程）或 `POST /api/v1/groups/{groupId}/messages`（小组）

**必测场景**：
- [ ] 发送纯文本消息
- [ ] 发送含文件的消息
- [ ] 消息包含 mentions 字段（最多 20 个用户）
- [ ] 消息包含 replyToId 字段（引用消息）
- [ ] 带 `Idempotency-Key` 头重试不重复创建
- [ ] 不带 `Idempotency-Key` 也可正常发送
- [ ] 响应包含新消息完整信息

**请求体示例**：
```json
{
  "content": "Hello @user1 @user2",
  "files": [
    {
      "objectKey": "chat-files/xxx.pdf",
      "name": "document.pdf",
      "size": 102400,
      "mimeType": "application/pdf",
      "uploadedAt": "2026-05-10T10:00:00Z",
      "thumbnailKey": "chat-files/xxx.pdf"
    }
  ],
  "mentions": ["2023010002", "2023010003"],
  "replyToId": "789"
}
```

**权限检查**：
- [ ] 非课程成员发送课程群消息 → 403 Forbidden
- [ ] 非小组成员发送小组群消息 → 403 Forbidden

---

### 2.3 编辑消息

**接口**：`PATCH /api/v1/courses/{courseId}/messages/{messageId}`（课程）或 `PATCH /api/v1/groups/{groupId}/messages/{messageId}`（小组）

**必测场景**：
- [ ] 只有消息发送者可编辑
- [ ] 其他用户编辑 → 403 Forbidden
- [ ] 编辑后 `editedAt` 时间更新
- [ ] 编辑后返回最新消息体

**请求体示例**：
```json
{
  "content": "Updated message",
  "mentions": ["2023010002"]
}
```

---

### 2.4 撤回消息

**接口**：`DELETE /api/v1/courses/{courseId}/messages/{messageId}`（课程）或 `DELETE /api/v1/groups/{groupId}/messages/{messageId}`（小组）

**必测场景**：
- [ ] 只有消息发送者可撤回
- [ ] 其他用户撤回 → 403 Forbidden
- [ ] 撤回后 `deletedAt` 被设置
- [ ] 前端列表中隐藏已撤回消息
- [ ] Socket 事件推送撤回事件（所有成员收到）

---

### 2.5 搜索消息

**接口**：`GET /api/v1/courses/{courseId}/messages/search`（课程）或 `GET /api/v1/groups/{groupId}/messages/search`（小组）

**必测场景**：
- [ ] 按关键词搜索内容
- [ ] 搜索结果按相关性排序
- [ ] 支持分页（`limit`, `offset`）
- [ ] 搜索结果不包含已撤回消息

---

### 2.6 发布公告

**接口**：`POST /api/v1/courses/{courseId}/announcements`（课程）或 `POST /api/v1/groups/{groupId}/announcements`（小组）

**必测场景**：
- [ ] 仅课程老师/助教可发布课程公告
- [ ] 仅小组创建者可发布小组公告
- [ ] 权限不足 → 403 Forbidden
- [ ] 公告消息 `messageType = "announcement"`
- [ ] 公告可有 files 字段

**请求体示例**：
```json
{
  "content": "Important notice",
  "files": []
}
```

---

### 2.7 会话列表 & 未读计数

**接口**：`GET /api/v1/conversations`

**必测场景**：
- [ ] 返回用户参与的所有会话
- [ ] 每个会话包含最后一条消息预览
- [ ] 每个会话包含未读消息计数
- [ ] 支持排序（最近活动 or 未读优先）
- [ ] 支持过滤（仅课程 / 仅小组）

**响应体示例**：
```json
{
  "data": [
    {
      "conversationId": "123",
      "scopeType": "course",
      "scopeId": "456",
      "roomKey": "course:456",
      "lastMessage": {
        "id": "789",
        "content": "...",
        "senderId": "2023010001",
        "createdAt": "2026-05-10T10:00:00Z"
      },
      "unreadCount": 5,
      "lastReadAt": "2026-05-10T09:50:00Z"
    }
  ]
}
```

---

### 2.8 ACK & 断线重连

**接口**：`POST /api/v1/conversations/{conversationId}/read`

**必测场景**：
- [ ] 用户阅读消息后上报 ACK
- [ ] 服务端记录 `lastMessageId` 和 `lastReadAt`
- [ ] 未读计数动态更新

**请求体示例**：
```json
{
  "lastMessageId": "789"
}
```

**断线重连场景**：
- [ ] 客户端发送 ACK 前网络中断
- [ ] 重连后从 `lastReadAt` 之后拉取新消息
- [ ] 确保消息不重复、不遗漏

---

### 2.9 文件上传（预签名）

**接口**：`POST /api/v1/chat/files/presign-upload`

**必测场景**：
- [ ] 文件大小检查（≤500MB）
- [ ] MIME 类型白名单检查
- [ ] 响应包含 `uploadUrl`（预签名上传链接）
- [ ] 响应包含 `objectKey`（对象存储路径）
- [ ] 响应包含 `expiresAt`（链接过期时间）
- [ ] 前端使用 presign URL 上传文件（PUT 请求）

**请求体示例**：
```json
{
  "fileName": "report.pdf",
  "mimeType": "application/pdf",
  "size": 102400
}
```

**响应体示例**：
```json
{
  "uploadUrl": "https://minio.example.com/...?X-Amz-Signature=...",
  "objectKey": "chat-files/xxx.pdf",
  "expiresAt": "2026-05-10T11:00:00Z"
}
```

---

### 2.10 文件下载（预签名）

**接口**：`GET /api/v1/chat/files/presign-download`

**必测场景**：
- [ ] 提供 `objectKey` 查询参数
- [ ] 响应包含 `downloadUrl`（预签名下载链接）
- [ ] 响应包含 `expiresAt`
- [ ] 前端使用 downloadUrl 直接下载（浏览器 GET）

**查询参数**：
```
GET /api/v1/chat/files/presign-download?objectKey=chat-files/xxx.pdf
```

**响应体示例**：
```json
{
  "downloadUrl": "https://minio.example.com/...?X-Amz-Signature=...",
  "expiresAt": "2026-05-10T11:00:00Z"
}
```

---

## 3. WebSocket 实时事件

### 事件接收（前端监听）

连接后加入 room：
```javascript
socket.emit('join', { room: 'course:456' }); // 或 'group:789'
```

监听消息事件：
```javascript
socket.on('chat:message:created', (data) => {
  // 新消息
});
socket.on('chat:message:updated', (data) => {
  // 消息已编辑
});
socket.on('chat:message:deleted', (data) => {
  // 消息已撤回
});
socket.on('group:member:removed', (data) => {
  // 成员被踢 → 退出房间
});
socket.on('course:member:updated', (data) => {
  // 课程成员变动
});
```

### 事件体结构

所有事件包装在 `EventEnvelope` 中：
```typescript
{
  id: "uuid",
  type: "chat:message:created",
  timestamp: "2026-05-10T10:00:00Z",
  source: "api",
  data: { /* 具体数据 */ },
  traceId: "uuid"
}
```

---

## 4. 错误处理

### 常见错误码

| Code | HTTP | 含义 | 处理方案 |
|------|------|------|---------|
| `VALIDATION_FAILED` | 400 | 参数校验失败 | 检查请求参数格式 |
| `UNAUTHORIZED` | 401 | 未登录/token 过期 | 重新登录 |
| `FORBIDDEN` | 403 | 权限不足 | 提示用户无权限 |
| `NOT_FOUND` | 404 | 资源不存在 | 检查资源 ID |
| `CONFLICT` | 409 | 冲突（如重复消息） | 重试或提示 |
| `INTERNAL_ERROR` | 500 | 服务端错误 | 重试或上报 |

---

## 5. 性能与容限

| 指标 | 值 | 说明 |
|------|-----|------|
| 消息列表单次拉取 | ≤100 | `limit` 参数上限 |
| Mentions 最多数量 | 20 | 单条消息中的 @ 用户 |
| 文件单个大小 | ≤500MB | 上传/下载 |
| 预签名链接有效期 | 30分钟 | 上传/下载 |
| 消息编辑截止 | 无限制 | 暂未实现时间限制 |
| 消息撤回截止 | 无限制 | 暂未实现时间限制 |

---

## 6. 自测检查表

### 流程完整性

- [ ] 进入课程/小组 → 拉消息列表
- [ ] 发送消息 → Socket 推送 → 本地渲染
- [ ] 编辑消息 → Socket 推送 → 列表更新
- [ ] 撤回消息 → Socket 推送 → 列表隐藏
- [ ] @ 提及 → 被提及用户收到通知（若有）
- [ ] 引用消息 → 显示原消息内容
- [ ] 上传文件 → presign → 发送消息 → 显示下载链接
- [ ] 被踢出小组 → Socket 推送 `group:member:removed` → 断开连接
- [ ] 课程退课 → Socket 推送 → 退出课程群房间
- [ ] 弱网重试 → Idempotency-Key 去重 → 不重复发送

### 边界情况

- [ ] 空消息发送 → 400 Validation Error
- [ ] 超大文件上传（>500MB） → 413 Payload Too Large
- [ ] 同时编辑和撤回 → 后一个操作 404 Not Found
- [ ] 删除用户后访问旧消息 → senderId 用户可能不存在（前端兜底）
- [ ] 百万级消息分页 → cursor 性能确认

---

## 7. 联调记录

| 日期 | 功能 | 状态 | 备注 |
|------|------|------|------|
| 2026-05-10 | 消息列表 & 分页 | ✓ 完成 | |
| 2026-05-10 | 发送消息 | ✓ 完成 | |
| 2026-05-10 | 编辑/撤回 | ✓ 完成 | |
| | 文件上传下载 | ○ 测试中 | |
| | 实时 Socket 事件 | ○ 测试中 | |
| | 弱网重连 & ACK | ○ 测试中 | |

---

## 8. 前端实现建议

### 推荐库
- 消息分页：`react-window` or `react-virtualized`
- 实时连接：`socket.io-client`
- 文件上传：`axios` or `fetch`
- 状态管理：Redux / Zustand（维护会话列表和消息缓存）

### UI 交互建议
- 消息列表：虚拟滚动（大数据）
- 发送框：@提及自动补全
- 文件进度：显示上传/下载进度条
- 撤回/编辑：历史记录或 badge 标识
- 未读徽章：会话列表右上角计数

---

End of frontend integration checklist.
