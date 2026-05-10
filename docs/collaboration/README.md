# 协作与群聊（课程群 / 小组群）

本目录描述课程群与小组群的最小实现方案，以及与 Socket 事件的对接规范。

## 1. 范围

- 课程群：课程创建后自动生成，用于课程成员的消息沟通。
- 小组群：小组创建后自动生成，用于小组成员的消息沟通。
- 群成员不单独建表，成员来源以课程成员与小组成员为准。

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
