# 接口验收清单 — 群聊消息功能

本文件用于后端/QA 验收，列出所有接口的完整规范、测试场景与期望结果。

---

## 1. 消息列表（GET /api/v1/courses/{courseId}/messages）

### 1.1 基本功能

**端点**：`GET /api/v1/courses/{courseId}/messages`

**认证**：必需 JWT token

**查询参数**：
| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `beforeId` | string | 否 | - | 查询此 ID 之前的消息（向上滑） |
| `afterId` | string | 否 | - | 查询此 ID 之后的消息（向下滑） |
| `limit` | number | 否 | 50 | 返回数量，最大 100 |

**成功响应（200 OK）**：
```json
{
  "ok": true,
  "data": [
    {
      "id": "123",
      "conversationId": "456",
      "senderId": "2023010001",
      "content": "Hello world",
      "files": null,
      "mentions": [],
      "replyToId": null,
      "messageType": "text",
      "eventId": "uuid-1",
      "traceId": "uuid-2",
      "createdAt": "2026-05-10T10:00:00Z",
      "editedAt": null,
      "deletedAt": null
    }
  ],
  "paging": {
    "hasMore": true,
    "nextCursor": "789"
  }
}
```

### 1.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 1.2.1 | 首次无 cursor | `limit=50` | 返回最新 50 条 | | ○ |
| 1.2.2 | beforeId 向上翻页 | `beforeId=100&limit=50` | 返回 ID<100 的 50 条 | | ○ |
| 1.2.3 | afterId 向下翻页 | `afterId=100&limit=50` | 返回 ID>100 的 50 条 | | ○ |
| 1.2.4 | limit 超上限 | `limit=200` | 返回 100 条（截断） | | ○ |
| 1.2.5 | 无消息 | （空课程群） | 返回空 data，`hasMore=false` | | ○ |
| 1.2.6 | 软删除消息 | （消息已撤回） | 不返回 `deletedAt!=null` 消息 | | ○ |
| 1.2.7 | 非课程成员 | （其他课程 ID） | 403 Forbidden | | ○ |
| 1.2.8 | 无效 JWT | （过期/无效 token） | 401 Unauthorized | | ○ |

### 1.3 性能要求

- 响应时间 < 500ms（消息数 < 100K）
- 无 N+1 查询问题

---

## 2. 发送消息（POST /api/v1/courses/{courseId}/messages）

### 2.1 基本功能

**端点**：`POST /api/v1/courses/{courseId}/messages`

**认证**：必需 JWT token

**请求头**（可选）：
- `Idempotency-Key: {uuid}` — 用于幂等性（去重）

**请求体**：
```json
{
  "content": "Message text",
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

**成功响应（201 Created）**：
```json
{
  "ok": true,
  "data": {
    "id": "123",
    "conversationId": "456",
    "senderId": "2023010001",
    "content": "Message text",
    "files": [...],
    "mentions": ["2023010002", "2023010003"],
    "replyToId": "789",
    "messageType": "text",
    "eventId": "uuid-1",
    "traceId": "uuid-2",
    "createdAt": "2026-05-10T10:00:00Z",
    "editedAt": null,
    "deletedAt": null
  }
}
```

### 2.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 2.2.1 | 纯文本消息 | `content="Hello"` | 创建成功，返回完整消息 | | ○ |
| 2.2.2 | 含文件消息 | `content + files[]` | 创建成功，files 正确存储 | | ○ |
| 2.2.3 | 含 mentions | `mentions=["user1","user2"]` | mentions 正确存储 | | ○ |
| 2.2.4 | 含 replyToId | `replyToId="789"` | replyTo 关系建立 | | ○ |
| 2.2.5 | 空 content | `content=""` | 400 Validation（无消息） | | ○ |
| 2.2.6 | Mentions 超 20 | `mentions=[...x30]` | 400 Validation 或截断到 20 | | ○ |
| 2.2.7 | 幂等性（重试）| 相同 `Idempotency-Key` | 返回相同消息，不重复创建 | | ○ |
| 2.2.8 | 无幂等键（正常发送） | （无 header） | 正常创建 | | ○ |
| 2.2.9 | 非课程成员 | （其他课程） | 403 Forbidden | | ○ |
| 2.2.10 | Socket 推送 | （验证事件） | 所有成员收到 `chat:message:created` | | ○ |

### 2.3 Socket 事件

发送成功后，服务端推送：
```json
{
  "type": "chat:message:created",
  "data": { /* 新消息 */ }
}
```

---

## 3. 编辑消息（PATCH /api/v1/courses/{courseId}/messages/{messageId}）

### 3.1 基本功能

**端点**：`PATCH /api/v1/courses/{courseId}/messages/{messageId}`

**认证**：必需 JWT token

**请求体**：
```json
{
  "content": "Updated message",
  "mentions": ["2023010002"]
}
```

**成功响应（200 OK）**：
```json
{
  "ok": true,
  "data": { /* 更新后的消息，editedAt 已更新 */ }
}
```

### 3.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 3.2.1 | 发送者编辑 | （原发送者） | 编辑成功，`editedAt` 更新 | | ○ |
| 3.2.2 | 非发送者编辑 | （其他用户） | 403 Forbidden | | ○ |
| 3.2.3 | 编辑已撤回消息 | `deletedAt != null` | 400 Conflict 或 404 | | ○ |
| 3.2.4 | Socket 推送 | （验证事件） | 所有成员收到 `chat:message:updated` | | ○ |

---

## 4. 撤回消息（DELETE /api/v1/courses/{courseId}/messages/{messageId}）

### 4.1 基本功能

**端点**：`DELETE /api/v1/courses/{courseId}/messages/{messageId}`

**认证**：必需 JWT token

**成功响应（200 OK）**：
```json
{
  "ok": true,
  "data": { /* 撤回后的消息，deletedAt 已设置 */ }
}
```

### 4.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 4.2.1 | 发送者撤回 | （原发送者） | 撤回成功，`deletedAt` 设置 | | ○ |
| 4.2.2 | 非发送者撤回 | （其他用户） | 403 Forbidden | | ○ |
| 4.2.3 | 重复撤回 | （已撤回消息） | 400 Conflict 或 404 | | ○ |
| 4.2.4 | Socket 推送 | （验证事件） | 所有成员收到 `chat:message:deleted` | | ○ |
| 4.2.5 | 前端列表隐藏 | （UI 验收） | 列表中隐藏消息 | | ○ |

---

## 5. 搜索消息（GET /api/v1/courses/{courseId}/messages/search）

### 5.1 基本功能

**端点**：`GET /api/v1/courses/{courseId}/messages/search`

**认证**：必需 JWT token

**查询参数**：
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 搜索关键词 |
| `limit` | number | 否 | 返回数量（默认 50，最大 100） |
| `offset` | number | 否 | 分页偏移（默认 0） |

**成功响应（200 OK）**：
```json
{
  "ok": true,
  "data": [
    { /* 匹配消息 */ }
  ],
  "paging": {
    "total": 123,
    "limit": 50,
    "offset": 0
  }
}
```

### 5.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 5.2.1 | 精确搜索 | `q="hello"` | 返回内容包含"hello"的消息 | | ○ |
| 5.2.2 | 模糊搜索 | `q="hel"` | 返回相关消息 | | ○ |
| 5.2.3 | 空搜索 | `q=""` | 400 Validation 或返回所有 | | ○ |
| 5.2.4 | 无结果 | `q="xyzabc123"` | 返回空 data | | ○ |
| 5.2.5 | 排除撤回消息 | （已撤回） | 不返回 `deletedAt != null` | | ○ |
| 5.2.6 | 分页 | `offset=100&limit=50` | 正确分页 | | ○ |

---

## 6. 发布公告（POST /api/v1/courses/{courseId}/announcements）

### 6.1 基本功能

**端点**：`POST /api/v1/courses/{courseId}/announcements`

**认证**：必需 JWT token

**权限**：仅课程老师/助教

**请求体**：
```json
{
  "content": "Important announcement",
  "files": []
}
```

**成功响应（201 Created）**：
```json
{
  "ok": true,
  "data": {
    "id": "123",
    "messageType": "announcement",
    ...
  }
}
```

### 6.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 6.2.1 | 老师发公告 | （老师账号） | 创建成功，`messageType="announcement"` | | ○ |
| 6.2.2 | 助教发公告 | （助教账号） | 创建成功 | | ○ |
| 6.2.3 | 学生发公告 | （学生账号） | 403 Forbidden | | ○ |
| 6.2.4 | Socket 推送 | （验证事件） | 所有成员收到公告事件 | | ○ |

---

## 7. 会话列表（GET /api/v1/conversations）

### 7.1 基本功能

**端点**：`GET /api/v1/conversations`

**认证**：必需 JWT token

**查询参数**：
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `scopeType` | string | 否 | 过滤（"course" \| "group" \| null=全部） |
| `limit` | number | 否 | 返回数量 |
| `offset` | number | 否 | 分页偏移 |

**成功响应（200 OK）**：
```json
{
  "ok": true,
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

### 7.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 7.2.1 | 获取所有会话 | （无过滤） | 返回用户参与的全部会话 | | ○ |
| 7.2.2 | 过滤课程会话 | `scopeType="course"` | 仅返回课程群会话 | | ○ |
| 7.2.3 | 过滤小组会话 | `scopeType="group"` | 仅返回小组群会话 | | ○ |
| 7.2.4 | 未读计数准确 | （ACK 记录） | `unreadCount` 正确 | | ○ |
| 7.2.5 | 无会话 | （新用户） | 返回空 data | | ○ |
| 7.2.6 | 最近活动排序 | （检查顺序） | 按 `lastMessage.createdAt` 倒序 | | ○ |

---

## 8. ACK & 标记已读（POST /api/v1/conversations/{conversationId}/read）

### 8.1 基本功能

**端点**：`POST /api/v1/conversations/{conversationId}/read`

**认证**：必需 JWT token

**请求体**：
```json
{
  "lastMessageId": "789"
}
```

**成功响应（200 OK）**：
```json
{
  "ok": true,
  "data": {
    "conversationId": "123",
    "userId": "2023010001",
    "lastMessageId": "789",
    "lastReadAt": "2026-05-10T10:05:00Z"
  }
}
```

### 8.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 8.2.1 | 首次 ACK | （无读记录） | 创建读记录，`lastReadAt` 设置 | | ○ |
| 8.2.2 | 更新 ACK | （已有读记录） | 更新 `lastMessageId` 和 `lastReadAt` | | ○ |
| 8.2.3 | 重复 ACK 相同消息 | `lastMessageId` 不变 | 仍然成功 | | ○ |
| 8.2.4 | 未读计数更新 | （触发会话列表更新） | 会话列表中 `unreadCount` 减少 | | ○ |

---

## 9. 文件上传签名（POST /api/v1/chat/files/presign-upload）

### 9.1 基本功能

**端点**：`POST /api/v1/chat/files/presign-upload`

**认证**：必需 JWT token

**请求体**：
```json
{
  "fileName": "report.pdf",
  "mimeType": "application/pdf",
  "size": 102400
}
```

**成功响应（200 OK）**：
```json
{
  "ok": true,
  "data": {
    "uploadUrl": "https://minio.example.com/...?X-Amz-Signature=...",
    "objectKey": "chat-files/uuid/report.pdf",
    "expiresAt": "2026-05-10T11:00:00Z"
  }
}
```

### 9.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 9.2.1 | 有效文件 | PDF 100KB | 返回 presign URL，有效期 30 分钟 | | ○ |
| 9.2.2 | 超大文件 | 600MB | 413 Payload Too Large 或 400 | | ○ |
| 9.2.3 | 无效 MIME | `image/xyz` | 400 Validation（不在白名单） | | ○ |
| 9.2.4 | 常见格式白名单 | PDF/Word/Excel/ZIP | 返回 presign URL | | ○ |
| 9.2.5 | 图片格式 | JPG/PNG | 返回 presign URL | | ○ |
| 9.2.6 | 视频格式 | MP4/MOV | 返回 presign URL | | ○ |
| 9.2.7 | 代码格式 | .tex/.java/.py | 返回 presign URL | | ○ |

---

## 10. 文件下载签名（GET /api/v1/chat/files/presign-download）

### 10.1 基本功能

**端点**：`GET /api/v1/chat/files/presign-download`

**认证**：必需 JWT token

**查询参数**：
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `objectKey` | string | 是 | 对象存储路径 |

**成功响应（200 OK）**：
```json
{
  "ok": true,
  "data": {
    "downloadUrl": "https://minio.example.com/...?X-Amz-Signature=...",
    "expiresAt": "2026-05-10T11:00:00Z"
  }
}
```

### 10.2 验收场景

| # | 场景 | 输入 | 期望 | 实际 | 状态 |
|---|------|------|------|------|------|
| 10.2.1 | 有效 objectKey | `chat-files/xxx.pdf` | 返回 presign URL | | ○ |
| 10.2.2 | 无效 objectKey | `invalid/key` | 400 Validation 或 404 | | ○ |
| 10.2.3 | presign URL 有效期 | （验证链接） | 30 分钟内可下载 | | ○ |
| 10.2.4 | 过期后无效 | （30分钟后） | 403 Forbidden（S3 签名过期） | | ○ |

---

## 11. 小组聊天接口（同课程接口，路径替换为 /groups/{groupId}）

所有接口逻辑同课程群，仅路径替换：

| 课程 | 小组 |
|------|------|
| `GET /api/v1/courses/{courseId}/messages` | `GET /api/v1/groups/{groupId}/messages` |
| `POST /api/v1/courses/{courseId}/messages` | `POST /api/v1/groups/{groupId}/messages` |
| `PATCH /api/v1/courses/{courseId}/messages/{messageId}` | `PATCH /api/v1/groups/{groupId}/messages/{messageId}` |
| `DELETE /api/v1/courses/{courseId}/messages/{messageId}` | `DELETE /api/v1/groups/{groupId}/messages/{messageId}` |
| `GET /api/v1/courses/{courseId}/messages/search` | `GET /api/v1/groups/{groupId}/messages/search` |
| `POST /api/v1/courses/{courseId}/announcements` | `POST /api/v1/groups/{groupId}/announcements` |

额外权限验收：
- 小组群仅允许课程成员和小组成员访问
- 非小组成员 POST/PATCH/DELETE → 403 Forbidden

---

## 12. 整体验收清单

### 功能完整性

- [ ] 消息列表分页（beforeId/afterId）
- [ ] 发送消息（文本、文件、mentions、引用）
- [ ] 编辑消息
- [ ] 撤回消息
- [ ] 搜索消息
- [ ] 发布公告
- [ ] 会话列表与未读计数
- [ ] 文件上传签名
- [ ] 文件下载签名
- [ ] ACK 标记已读

### 权限正确性

- [ ] 非课程成员禁止访问课程群
- [ ] 非小组成员禁止访问小组群
- [ ] 只有消息发送者可编辑/撤回
- [ ] 只有老师/助教可发布公告
- [ ] 只有小组创建者可发布小组公告

### WebSocket 实时性

- [ ] 消息创建事件推送
- [ ] 消息编辑事件推送
- [ ] 消息撤回事件推送
- [ ] 成员移除事件推送（踢人即退房）
- [ ] 课程成员变动事件推送

### 数据一致性

- [ ] 消息 eventId 去重（幂等性）
- [ ] 已撤回消息不返回
- [ ] 已软删除消息不可编辑
- [ ] mentions 验证（用户存在性）
- [ ] replyToId 验证（消息存在性）

### 性能指标

- [ ] 消息列表 API 响应 < 500ms
- [ ] 文件上传签名 API 响应 < 200ms
- [ ] Socket 事件延迟 < 100ms
- [ ] 无 N+1 查询

### 错误处理

- [ ] 所有接口返回统一格式 `{ ok, data/code/message }`
- [ ] 400/401/403/404/500 错误码正确映射
- [ ] 错误消息清晰准确

---

End of API acceptance checklist.
