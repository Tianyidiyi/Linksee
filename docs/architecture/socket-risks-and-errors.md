# Socket 架构风险与已知错误（Phase 1-4）

> 文档目的：在写代码阶段作为核对清单使用。**错误**应在对应代码写入前修复；**风险**应在设计实现时主动规避。
>
> 关联文档：
> - [communication-governance.md](./communication-governance.md)
> - [docs/api/courses/course-tables-design-v1.md](../api/courses/course-tables-design-v1.md)

---

## 一、已知错误（代码写入前必须修复）

以下三处属于"设计已定、代码/文档对不上"的明确错误，优先级最高。

---

### 错误 1：`course.message.created` 事件名三处缺失

**现状**：`chat_conversations` + `chat_messages` 统一模型已设计课程群聊，但对应事件名从未加入任何文件。

| 文件 | 缺失内容 | 修复动作 |
|------|----------|----------|
| `apps/api/src/shared/contracts.ts` | `EventName` 联合类型缺少 `"course.message.created"` | 加入联合类型 |
| `apps/api/src/events/event-catalog.ts` | `eventCatalog` 没有 `"course.message.created"` 条目 | 补 socket 条目 |
| `apps/web/src/realtime/event-handlers.ts` | `RealtimeEventName` 缺少 `"course.message.created"` | 加入联合类型 |

**修复时机**：Phase 4 群聊接口开发前，三处同步修改。

---

### 错误 2：`chat_conversations.created_by` 不允许 NULL（设计有误）

**现状**：`created_by VARCHAR(10) NOT NULL` ——但课程群聊是随课程创建时系统自动生成的，没有"某个学生创建了它"这件事。

| 场景 | `scope_type` | `created_by` 应为 |
|------|-------------|-------------------|
| 课程群（随 courses 创建时自动生成） | `course` | `NULL`（系统自动） |
| 项目组群（随 groups 创建时自动生成） | `group` | 创建小组的学生 ID |

**修复动作**：
- `docs/api/courses/course-tables-design-v1.md` Phase 4 表结构：`created_by` 改为 `VARCHAR(10) NULL`
- `apps/api/prisma/schema.prisma` 对应字段：`createdBy String? @db.VarChar(10)`

**修复时机**：Phase 4 Prisma schema 写入前。

---

### 错误 3：`chat_messages` 缺少 `updated_at` 列

**现状**：Phase 4 `chat_messages` 表设计中有 `created_at` 和 `deleted_at`，但**缺少 `updated_at`**。全局规范要求有更新语义的表都加 `updated_at`（即使消息原则上不可编辑，P0 也应预留以统一规范）。

**修复动作**：
- `docs/api/courses/course-tables-design-v1.md` Phase 4 `chat_messages` 表：在 `created_at` 之后加 `updated_at DATETIME NOT NULL`
- `apps/api/prisma/schema.prisma` 对应字段：`updatedAt DateTime @updatedAt`

**修复时机**：Phase 4 Prisma schema 写入前。

---

## 二、已识别风险（写代码时主动规避）

以下三个风险不要求在 Phase 1 开发前解决，但每一处涉及到的实现节点上，需按"规避措施"落地。

---

### 风险 2：HTTP 写库成功但 Socket 推送失败，客户端状态不一致

**场景**：消息发送走 HTTP → 写入 `chat_messages` 成功 → `publisher.ts` 推 Socket 事件失败（网络抖动/进程崩溃），客户端没收到推送，消息列表短暂不更新。

**当前基建**：无 `event_outbox` 表，`publisher.ts` 是内存级发布，失败即丢。

**规避措施**：

1. **先落库，再发布**（已在 Phase 4 设计中约定）：事务 commit 后再调 `publisher.ts`，保证消息永远在 DB 中。
2. **客户端兜底**：消息列表组件在 Socket 断连或超时后，自动调 HTTP 补拉最新消息（可用 `GET /conversations/:id/messages?after=lastId`）。
3. **Phase 4 可选**：引入 `event_outbox` 表（写库时同步插一行 outbox，推送成功后 mark done；定时任务补发未完成行）。MVP 阶段客户端兜底已足够。

**影响**：Phase 4 群聊发送接口开发时必须遵守此规约。

---

### 风险 3：`gateway.ts authenticate()` 给老师/助教返回非空 `groupIds`（实现与文档不符）

**场景**：设计文档约定"老师/助教 `authenticate()` 返回空 `groupIds`，不自动 join 任何 `group:*` 房间"。但代码尚未实现这个分支，若直接用当前骨架代码在课程中给老师返回了小组 ID，老师会实时收到组内消息，违反隐私边界。

**已约定规则**：
- `role=teacher` 或 `role=assistant` → `groupIds: []`
- `role=student` → 该学生实际所在的 `group_ids`（查 `group_members`）

**规避措施**：

Phase 3 小组建表后、`gateway.ts` 实现 `authenticate()` 完整逻辑时，必须加此分支：

```typescript
// gateway.ts authenticate() 伪代码
if (user.role === 'teacher' || user.role === 'assistant') {
  return { userId: user.id, courseIds, groupIds: [] };   // 老师/助教不订阅 group 房间
}
// 学生：查 group_members 返回实际 groupIds
const groupIds = await prisma.groupMember.findMany({
  where: { userId: user.id },
  select: { group: { select: { id: true } } },
}).then(rows => rows.map(r => r.group.id));
return { userId: user.id, courseIds, groupIds };
```

**影响**：Phase 3 gateway 接入时必须落地。

---

### 风险 4：客户端 `shouldApplyEvent` 用内存 `Set` 去重，页面刷新后失效

**当前实现**（`apps/web/src/realtime/event-handlers.ts`）：

```typescript
export function shouldApplyEvent(seenIds: Set<string>, event: RealtimeEventEnvelope): boolean {
  if (seenIds.has(event.id)) return false;
  seenIds.add(event.id);
  return true;
}
```

`seenIds` 是调用方传入的内存 `Set`，页面刷新后 `Set` 清空。若服务端在刷新前后重推同一事件（断线重连后补发场景），客户端会重复渲染消息气泡。

**规避措施**：

消息类页面（`group.message.created` / `course.message.created`）实现时，**不依赖 `seenIds Set` 去重**，改为以消息 `id`（DB 主键）做去重：

```typescript
// 页面级 Map: messageId → ChatMessage（DB 主键唯一，刷新后从 HTTP 历史重建）
const messageMap = new Map<bigint, ChatMessage>();

function applyMessageEvent(payload: CourseMessagePayload) {
  if (messageMap.has(payload.messageId)) return;   // 按 DB id 去重，刷新后从 HTTP 拉取重建
  messageMap.set(payload.messageId, payload);
  renderMessage(payload);
}
```

**影响**：Phase 4 前端消息列表组件实现时必须采用此方案，`shouldApplyEvent` 只在无持久 ID 的纯通知类事件中使用。

---

## 三、快速核对表

### 写 Phase 4 群聊 API 之前

- [ ] 错误 1：三处加入 `course.message.created`
- [ ] 错误 2：`chat_conversations.created_by` 改为可空
- [ ] 错误 3：`chat_messages` 加 `updated_at`

### 写 Phase 4 前端消息组件之前

- [ ] 风险 4：按消息 DB id 去重，不依赖内存 Set

### 写 Phase 3 gateway 接入时

- [ ] 风险 3：老师/助教 `authenticate()` 返回空 `groupIds`

### Phase 4 发消息 HTTP 接口

- [ ] 风险 2：事务先写库，再调 `publisher.ts`；前端实现补拉兜底
