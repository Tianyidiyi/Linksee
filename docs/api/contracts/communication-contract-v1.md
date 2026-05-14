# 通信契约 v1（教学协作 MVP）

## 0. 术语约定

P0 统一使用以下业务对象：

- Course：课程空间。
- Assignment：老师发布的课程项目。
- Stage：Assignment 下的阶段要求，承担老师层任务职责。
- Group：学生项目小组。
- MiniTask：小组内部拆分的执行任务。
- Submission：小组针对 Stage 的成果提交。
- Review：老师或助教对 Submission 的反馈。
- Grade：阶段分数或最终成绩。

P0 不单独定义老师层 `Task` 接口，避免与 Stage 重复。

## 0.1 通用字段约束

- id 类字段：使用稳定字符串 ID，建议采用业务前缀加唯一编号或 UUID，例如 `course_software_engineering`、`submission_001`。
- 时间字段：统一使用 ISO 8601 字符串，建议包含时区，例如 `2026-05-15T23:59:59+08:00`。
- createdAt / submittedAt：由服务端生成，客户端不得自行指定。
- 文本字段：服务端应去除首尾空格；去除后为空时，按空值处理。
- 字段名后的 `?` 表示该字段可选；不带 `?` 表示必填。Request 中可选表示客户端可以不传，Response 中可选表示服务端在无值时可以省略该字段。
- 可选字段：未传表示不更新或无该信息；不建议用空字符串表达“无值”。
- Idempotency-Key：写操作必填，格式建议为 UUID 或等价唯一字符串，用于防止重复提交。
- traceId：服务端生成，用于排查请求链路问题。

## 1. HTTP 契约（示例）

### 1.1 创建 Assignment（课程项目）

- Method: POST
- Path: /api/v1/courses/{courseId}/assignments
- Headers:
  - Authorization: Bearer `<token>`
  - Idempotency-Key: `<uuid>`
- Request:
  - title: string
  - description?: string
  - dueAt?: string
- Response:
  - id: string
  - courseId: string
  - title: string
  - description?: string
  - dueAt?: string
  - createdBy: string
  - createdAt: string

Field Constraints:

- courseId: 必须是当前老师有管理权限的课程 ID。
- title: 必填，1 到 80 个字符，去除首尾空格后不能为空。
- description: 可选，最多 2000 个字符。
- dueAt: 可选，ISO 8601 时间字符串；若提供，必须晚于当前时间。
- createdBy: 服务端根据 token 写入，客户端不得传入。

Success Example:

```json
{
  "id": "assignment_001",
  "courseId": "course_software_engineering",
  "title": "软件工程课程项目",
  "description": "完成一个教学协作平台原型",
  "dueAt": "2026-06-30T23:59:59+08:00",
  "createdBy": "teacher_001",
  "createdAt": "2026-04-30T10:00:00+08:00"
}
```

Failure Examples:

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication token is missing or invalid.",
    "traceId": "trace_20260430_001"
  }
}
```

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only course teachers can create assignments.",
    "traceId": "trace_20260430_002"
  }
}
```

### 1.2 创建 Stage（阶段要求）

- Method: POST
- Path: /api/v1/assignments/{assignmentId}/stages
- Headers:
  - Authorization: Bearer `<token>`
  - Idempotency-Key: `<uuid>`
- Request:
  - name: string
  - description?: string
  - dueAt: string
  - weight?: number
- Response:
  - id: string
  - assignmentId: string
  - name: string
  - dueAt: string
  - weight?: number

Field Constraints:

- assignmentId: 必须是当前老师有管理权限的 Assignment ID。
- name: 必填，1 到 60 个字符，去除首尾空格后不能为空。
- description: 可选，最多 2000 个字符，用于说明提交要求和验收标准。
- dueAt: 必填，ISO 8601 时间字符串，必须晚于当前时间。
- weight: 可选，0 到 100 的数字，表示该 Stage 在总成绩中的百分比权重。

Success Example:

```json
{
  "id": "stage_001",
  "assignmentId": "assignment_001",
  "name": "需求分析提交",
  "description": "提交需求说明书、用例图和原型链接",
  "dueAt": "2026-05-15T23:59:59+08:00",
  "weight": 20
}
```

Failure Examples:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Assignment was not found.",
    "traceId": "trace_20260430_003"
  }
}
```

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Stage dueAt is required.",
    "traceId": "trace_20260430_004"
  }
}
```

### 1.3 小组讨论消息创建

- Method: POST
- Path: /api/v1/groups/{groupId}/messages
- Headers:
  - Authorization: Bearer `<token>`
  - Idempotency-Key: `<uuid>`
- Request:
- Request:
  - type: text | file
  - content?: string
  - files?: ChatFileMetadata[]
  - mentions?: string[]
  - replyToId?: string
- Response:
  - id: string
  - groupId: string
  - content?: string
  - files?: ChatFileMetadata[]
  - mentions?: string[]
  - replyToId?: string
  - messageType: text | file | announcement
  - creatorId: string
  - createdAt: string
  - editedAt?: string
  - deletedAt?: string

Field Constraints:

- groupId: 必须是当前用户可访问的小组 ID；学生只能访问自己所在小组。
- type: 必填，`text` 或 `file`。
- content: 文本消息必填，1 到 2000 个字符。
- files: 文件消息必填，需先 presign 上传。
- mentions: 可选，最多 20 个用户 ID。
- replyToId: 可选，必须指向同会话消息。

ChatFileMetadata（files 数组元素）:

```json
{
  "name": "spec.pdf",
  "objectKey": "chat/group/123/uuid-spec.pdf",
  "size": 102400,
  "mimeType": "application/pdf",
  "uploadedAt": "2026-05-09T10:00:00+08:00",
  "thumbnailKey": "chat/group/123/uuid-spec.pdf"
}
```
- creatorId: 服务端根据 token 写入，客户端不得传入。

Success Example:

```json
{
  "id": "message_001",
  "groupId": "group_001",
  "content": "我已经上传了需求分析初稿，请大家今晚前补充用例。",
  "creatorId": "student_001",
  "createdAt": "2026-04-30T11:20:00+08:00"
}
```

Failure Examples:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Student can only send messages in their own group.",
    "traceId": "trace_20260430_005"
  }
}
```

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Message content cannot be empty.",
    "traceId": "trace_20260430_006"
  }
}
```

### 1.4 阶段成果提交

- Method: POST
- Path: /api/v1/stages/{stageId}/groups/{groupId}/submissions
- Headers:
  - Authorization: Bearer `<token>`
  - Idempotency-Key: `<uuid>`
- Request:
  - title: string
  - description?: string
  - fileIds?: string[]
  - files?: file[] (multipart/form-data)
  - links?: string[]
  - repositoryUrl?: string
  - contributionNote?: string
- Response:
  - id: string
  - stageId: string
  - groupId: string
  - status: submitted
  - submittedBy: string
  - submittedAt: string

Field Constraints:

- stageId: 必须是当前 Assignment 下存在的 Stage ID。
- groupId: 必须是当前学生所在的小组 ID；老师和助教默认不可代替学生提交。
- title: 必填，1 到 100 个字符，去除首尾空格后不能为空。
- description: 可选，最多 3000 个字符，用于填写提交说明。
- fileIds: 可选，最多 20 个文件 ID；文件必须已上传且归属当前 Group 或当前 Submission 草稿。
- files: 可选，multipart/form-data 字段名为 files；最多 20 个文件，单文件 20MB。
- links: 可选，最多 10 个 URL，必须使用 `http://` 或 `https://`。
- repositoryUrl: 可选，必须是合法 URL；MVP 只记录链接，不自动统计 commit。
- contributionNote: 可选，最多 3000 个字符，用于填写人工贡献说明。
- status: 服务端写入 `submitted`。截止前允许重复提交（生成新 attempt 并覆盖上一轮文件）；截止后不开放学生端补交。
- submittedBy / submittedAt: 服务端根据 token 和提交时间写入。

Success Example:

```json
{
  "id": "submission_001",
  "stageId": "stage_001",
  "groupId": "group_001",
  "status": "submitted",
  "submittedBy": "student_001",
  "submittedAt": "2026-05-15T21:30:00+08:00"
}
```

Failure Examples:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Student can only submit work for their own group.",
    "traceId": "trace_20260430_007"
  }
}
```

### 1.4.1 获取阶段提交记录

- Method: GET
- Path: /api/v1/stages/{stageId}/groups/{groupId}/submissions
- Headers:
  - Authorization: Bearer `<token>`
- Response: Submission[]

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Submission is pending review.",
    "traceId": "trace_20260430_008"
  }
}
```

### 1.5 教师反馈与评分

### 1.5.0 开始评审（进入 under_review）

- Method: POST
- Path: /api/v1/submissions/{submissionId}/reviews/start
- Headers:
  - Authorization: Bearer `<token>`
- Response:
  - submissionId: string
  - status: under_review

说明：
- 仅老师/助教可操作。
- 仅 `submitted` 状态允许进入 `under_review`。

- Method: POST
- Path: /api/v1/submissions/{submissionId}/reviews
- Headers:
  - Authorization: Bearer `<token>`
  - Idempotency-Key: `<uuid>`
- Request:
  - status: needs_changes | approved | rejected
  - comment: string
  - rubricScores?: Array<{ item: string; score: number; maxScore: number }>
- Response:
  - id: string
  - submissionId: string
  - status: string
  - score?: number
  - reviewerId: string
  - createdAt: string

Field Constraints:

- submissionId: 必须是当前老师或助教授权课程内的 Submission ID。
- status: 必填，只允许 `needs_changes` / `approved` / `rejected`。
- comment: 必填，1 到 3000 个字符；当 status 为 `needs_changes` 时必须说明修改要求。
- rubricScores: 可选，最多 10 项；每一项的 item 必填且最多 80 个字符。
- rubricScores.score: 必须是 0 到 maxScore 之间的数字。
- rubricScores.maxScore: 必须大于 0，建议不超过 100。
- score: 响应中的总分由服务端根据 rubricScores 计算或由评分逻辑生成。
- reviewerId / createdAt: 服务端根据 token 和创建时间写入。

Success Example:

```json
{
  "id": "review_001",
  "submissionId": "submission_001",
  "status": "needs_changes",
  "score": 82,
  "reviewerId": "teacher_001",
  "createdAt": "2026-05-16T09:30:00+08:00"
}
```

Failure Examples:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only authorized teachers or assistants can review this submission.",
    "traceId": "trace_20260430_009"
  }
}
```

### 1.5.1 更新教师反馈

- Method: PATCH
- Path: /api/v1/reviews/{reviewId}
- Headers:
  - Authorization: Bearer `<token>`
- Request:
  - status: needs_changes | approved | rejected
  - comment: string
  - rubricScores?: Array<{ item: string; score: number; maxScore: number }>
- Response: Review

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Review comment is required when status is needs_changes.",
    "traceId": "trace_20260430_010"
  }
}
```

### 1.5.2 标记未提交已处理

- Method: POST
- Path: /api/v1/submissions/{submissionId}/mark-reviewed
- Headers:
  - Authorization: Bearer `<token>`
- Response:
  - submissionId: string
  - status: reviewed

说明：
- 仅老师/助教可操作。
- 仅 `not_submitted` 状态允许标记为 `reviewed`。

### 1.6 教师课程看板

- Method: GET
- Path: /api/v1/courses/{courseId}/dashboard
- Headers:
  - Authorization: Bearer `<token>`
- Response:
  - courseId: string
  - groups: Array<{ groupId: string; name: string; progress: number; pendingReviewCount: number; overdueCount: number; inactive: boolean }>

Field Constraints:

- courseId: 必须是当前老师或助教有查看权限的课程 ID。
- groups: 按课程项目下的小组聚合返回；P0 可按 groupId 或风险等级排序。
- groups[].name: 1 到 60 个字符，用于展示小组名称。
- groups[].progress: 0 到 100 的整数，表示阶段完成百分比。
- groups[].pendingReviewCount: 大于或等于 0 的整数，表示待评价提交数。
- groups[].overdueCount: 大于或等于 0 的整数，表示已逾期未完成项数量。
- groups[].inactive: boolean，表示该小组是否被判定为协作不活跃。

Success Example:

```json
{
  "courseId": "course_software_engineering",
  "groups": [
    {
      "groupId": "group_001",
      "name": "第 1 小组",
      "progress": 60,
      "pendingReviewCount": 1,
      "overdueCount": 0,
      "inactive": false
    },
    {
      "groupId": "group_002",
      "name": "第 2 小组",
      "progress": 30,
      "pendingReviewCount": 0,
      "overdueCount": 1,
      "inactive": true
    }
  ]
}
```

Failure Examples:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only authorized teachers or assistants can view the course dashboard.",
    "traceId": "trace_20260430_011"
  }
}
```

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Course was not found.",
    "traceId": "trace_20260430_012"
  }
}
```

## 2. P0 最小查询接口

前端页面至少需要以下查询接口支撑老师看板、学生小组空间和提交台：

| 场景 | Method | Path | 用途 |
| --- | --- | --- | --- |
| 我的课程 | GET | /api/v1/courses | 获取当前用户可访问课程 |
| 课程详情 | GET | /api/v1/courses/{courseId} | 获取课程基础信息、角色与班级范围 |
| 项目列表 | GET | /api/v1/courses/{courseId}/assignments | 获取课程项目 |
| 项目阶段 | GET | /api/v1/assignments/{assignmentId}/stages | 获取阶段要求与截止时间 |
| 小组列表 | GET | /api/v1/assignments/{assignmentId}/groups | 老师查看项目下所有小组 |
| 我的小组 | GET | /api/v1/assignments/{assignmentId}/my-group | 学生进入自己的小组空间 |
| 小组详情 | GET | /api/v1/groups/{groupId} | 获取成员、MiniTask、文件、链接和动态摘要 |
| 小组讨论 | GET | /api/v1/groups/{groupId}/messages | 分页获取讨论消息 |
| 阶段提交 | GET | /api/v1/stages/{stageId}/groups/{groupId}/submissions | 获取该小组在某阶段的提交记录 |
| 待评价列表 | GET | /api/v1/courses/{courseId}/pending-reviews | 老师/助教查看待处理提交 |

## 3. 提交状态流转

Submission 状态统一为：

```text
not_submitted -> reviewed
not_submitted -> submitted -> under_review -> needs_changes -> submitted
not_submitted -> submitted -> under_review -> approved | rejected
```

说明：

- `not_submitted`：到达 Stage 截止时间且无提交时由系统自动落库。
- `submitted`：首次提交，等待老师或助教查看。
- `under_review`：老师或助教开始处理评审过程中的中间态。
- `needs_changes`：老师或助教要求修改。
- `submitted`（再次出现）：学生在截止前按反馈重新提交，形成下一次 attempt。
- `approved`：老师确认通过。
- `rejected`：老师或助教明确判定不通过。
- `reviewed`：老师或助教将 `not_submitted` 人工标记为“已处理”。

## 4. Socket 契约（示例）

### 4.1 握手

- token 放在握手鉴权字段
- 鉴权失败立即断开

### 4.2 房间

- course:{courseId}
- assignment:{assignmentId}
- group:{groupId}
- stage:{stageId}
- submission:{submissionId}

### 4.3 推送事件

统一 envelope：

- id
- name
- occurredAt
- producer
- traceId
- payload

事件示例：

1. group.message.created
2. group.message.updated
3. group.message.deleted
4. course.message.created
5. course.message.updated
6. course.message.deleted
3. course.member.updated
4. group.member.updated
5. group.minitask.updated
6. submission.created
7. submission.status.updated
8. review.created
9. grade.published
10. course.dashboard.updated

## 5. Worker 事件契约（预留增强）

### 5.1 文件上传后处理

- submission.file.uploaded
- submission.file.process.requested
- submission.file.process.completed

### 5.2 后续 GitHub / CI 同步

- github.sync.requested
- github.sync.completed
- ci.result.synced

### 5.3 后续 AI 助教

- ai.weekly-summary.requested
- ai.review-draft.requested
- ai.rag-index.requested

## 6. 错误码约定

- UNAUTHENTICATED
- FORBIDDEN
- NOT_FOUND
- CONFLICT
- VALIDATION_FAILED
- INTERNAL_ERROR

## 7. 权限约定

### 7.1 角色说明

| 角色 | 说明 |
| --- | --- |
| academic | 教务或课程监管角色，负责课程基础信息、名单范围和课程执行监督；P0 可由管理员或初始化数据模拟。 |
| teacher | 课程负责人，负责创建 Assignment、Stage、查看小组过程、批改反馈和最终成绩确认。 |
| assistant | 助教，受老师授权后查看课程内小组和提交，协助 Review 与登记建议分数。 |
| student | 学生，参与课程项目小组，维护 MiniTask、讨论、文件链接和阶段提交。 |

### 7.2 权限矩阵

| 资源 / 操作 | academic | teacher | assistant | student |
| --- | --- | --- | --- | --- |
| Course | R / 管理课程基础信息 | R / 管理自己负责课程 | R 授权课程 | R 自己参与课程 |
| Class / roster | R / 导入或维护名单 | R / 管理自己课程名单 | R 授权课程名单 | R 自己信息 |
| Assignment | R | CRUD 自己课程内项目 | R 授权课程项目 | R 自己课程项目 |
| Stage | R | CRUD 自己课程项目阶段 | R 授权课程阶段 | R 自己课程阶段 |
| Group | R | CRUD / 调整自己课程内小组 | R / 协助调整授权课程小组 | R 自己小组；按规则加入或退出 |
| MiniTask | R | R 自己课程内小组 MiniTask | R 授权课程内小组 MiniTask | CRUD 自己小组内 MiniTask |
| Group Message | R 审计视角 | R 自己课程内小组讨论 | R 授权课程内小组讨论 | C/R 自己小组讨论 |
| Submission | R | R / 状态更新 / 要求修改 / 确认通过 | R / 协助检查 / 登记 Review | C/R 自己小组提交，按状态重交 |
| Review | R | CRUD 自己课程内 Review | C/U 授权课程内 Review | R 自己小组 Review |
| Grade | R | 确认 / 发布最终 Grade | 建议登记，不可最终发布 | R 自己成绩 |
| Dashboard | R 课程监管看板 | R 自己课程看板 | R 授权课程看板 | 不可访问教师看板 |

说明：

- C = Create，R = Read，U = Update，D = Delete。
- P0 中 academic 可先不实现完整后台，但权限模型需保留课程监管视角。
- assistant 的权限必须绑定到具体 Course；默认不能跨课程查看或批改。
- student 的写权限默认限定在自己所在 Group 和对应 Stage / Submission 范围内。

### 7.3 关键越权规则

1. 未登录请求必须返回 `UNAUTHENTICATED`。
2. 已登录但访问未授权 Course、Assignment、Stage、Group、Submission、Review 或 Grade 时，必须返回 `FORBIDDEN`。
3. 学生只能提交自己所在 Group 的 Submission，不能代替其他小组提交。
4. 学生不能创建、修改或删除 Review 和 Grade。
5. 学生只能修改自己小组内的 MiniTask 和讨论内容，不能修改老师发布的 Stage。
6. 助教只能操作授权 Course 内的 Review 和建议分数，不能最终发布 Grade。
7. 老师只能管理自己负责 Course 下的 Assignment、Stage、Group、Submission、Review 和 Grade。
8. Grade 发布、Grade 修改、Review 修改和强制调组等敏感操作必须写入审计日志。

## 8. 一致性约定

1. 先 HTTP 成功写库，再推送 Socket 事件。
2. Socket 推送失败不回滚主事务。
3. 前端通过历史拉取 + 增量事件修正最终状态。
4. 提交、反馈、评分等写操作必须支持幂等键。
