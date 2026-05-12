# 协作与群聊（课程群 / 小组群）

本目录描述课程群与小组群的最小实现方案，以及与 Socket 事件的对接规范。

## 1. 范围

- 课程群：课程从 draft 变为 active 时自动生成，用于课程成员的消息沟通。
- 小组群：老师/助教确认分组后批量生成，用于小组成员的消息沟通。
- 群成员不单独建表，成员来源以课程成员与小组成员为准。

### 1.1 课程群创建逻辑（API + 时序说明）

- 课程创建接口：`POST /api/v1/courses`
	- 创建后状态固定为 `draft`
	- 此时不创建课程群会话

- 课程激活接口：`PATCH /api/v1/courses/{courseId}`（status=active）
	- 激活前置条件：至少有 1 位老师 + 已绑定助教
	- 满足条件后切换为 `active`
	- 触发创建课程群会话（`chat_conversations`，roomKey = `course:{courseId}`）

结论：课程群与会话是同义概念，只有在课程被激活时才会创建。

## 2. HTTP 接口（最小集）

### 2.1 课程群消息

- GET /api/v1/courses/{courseId}/messages
- POST /api/v1/courses/{courseId}/messages
- GET /api/v1/courses/{courseId}/messages/search
- PATCH /api/v1/courses/{courseId}/messages/{messageId}
- DELETE /api/v1/courses/{courseId}/messages/{messageId}
- POST /api/v1/courses/{courseId}/announcements

### 2.2 小组群消息

- GET /api/v1/groups/{groupId}/messages
- POST /api/v1/groups/{groupId}/messages
- GET /api/v1/groups/{groupId}/messages/search
- PATCH /api/v1/groups/{groupId}/messages/{messageId}
- DELETE /api/v1/groups/{groupId}/messages/{messageId}
- POST /api/v1/groups/{groupId}/announcements

### 2.3 文件与会话

- POST /api/v1/chat/files/presign-upload
- GET /api/v1/chat/files/presign-download
- GET /api/v1/conversations
- POST /api/v1/conversations/{conversationId}/read
- POST /api/v1/realtime/acks
- GET /api/v1/realtime/replay

### 2.3 小组管理

- GET /api/v1/assignments/{assignmentId}/groups
- POST /api/v1/assignments/{assignmentId}/groups
- POST /api/v1/assignments/{assignmentId}/groups/conversations
- GET /api/v1/groups/{groupId}
- POST /api/v1/groups/{groupId}/members
- DELETE /api/v1/groups/{groupId}/members/{userId}

## 3. Socket 事件

- course.message.created
- course.message.updated
- course.message.deleted
- group.message.created
- group.message.updated
- group.message.deleted
- course.member.updated
- group.member.updated

事件 payload 中应包含 courseId / groupId / assignmentId / userId / action 等关键字段。

## 4. 成员变动规则

- 课程群成员来源：course_members + course_teachers + assistant_bindings。
- 小组群成员来源：group_members（可选叠加课程老师/助教）。
- 退课/踢人仅更新课程或小组成员表，群聊成员通过事件同步。

## 5. 小组协作审查权限建议（老师/助教）

目标：老师/助教可审查小组协作状态与任务推进，但不能以“天眼模式”进入小组群聊。

建议规则：

- 老师/助教可访问 `GET /api/v1/groups/{groupId}` 获取小组信息、成员、MiniTask 统计。
- 老师/助教不可加入小组群聊房间（`group:{groupId}`），避免看到聊天细节。
- 老师/助教禁止访问小组聊天历史接口（`/api/v1/groups/{groupId}/messages`）。
- 若确需审计聊天内容，必须通过单独的“审计接口 + 审计日志”开启，不能复用普通群聊接口。

建议审查面板字段（仅做状态审查，不含聊天内容）：

- 小组基本信息：groupNo、name、status、成员与组长
- MiniTask 统计：总数、todo/in_progress/done/cancelled、逾期数
- 最近任务更新时间（latestUpdatedAt）
- 阶段关联情况（stageId 分布）

这些字段用于后续“工作面板 + 评分联动”增强时的客观证据。
