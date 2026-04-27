# 通信契约 v1（教学协作 MVP）

## 1. HTTP 契约（示例）

### 1.1 创建课程项目作业

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

### 1.2 创建阶段任务

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

### 1.3 小组讨论消息创建

- Method: POST
- Path: /api/v1/groups/{groupId}/messages
- Headers:
  - Authorization: Bearer `<token>`
  - Idempotency-Key: `<uuid>`
- Request:
  - content: string
- Response:
  - id: string
  - groupId: string
  - content: string
  - creatorId: string
  - createdAt: string

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

### 1.5 教师反馈与评分

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

### 1.6 教师课程看板

- Method: GET
- Path: /api/v1/courses/{courseId}/dashboard
- Headers:
  - Authorization: Bearer `<token>`
- Response:
  - courseId: string
  - groups: Array<{ groupId: string; name: string; progress: number; pendingReviewCount: number; overdueCount: number; inactive: boolean }>

## 2. Socket 契约（示例）

### 2.1 握手

- token 放在握手鉴权字段
- 鉴权失败立即断开

### 2.2 房间

- course:{courseId}
- assignment:{assignmentId}
- group:{groupId}
- stage:{stageId}

### 2.3 推送事件

统一 envelope：

- id
- name
- occurredAt
- producer
- traceId
- payload

事件示例：

1. group.message.created
2. group.task.updated
3. submission.created
4. submission.status.updated
5. review.created
6. grade.updated
7. dashboard.group-risk.updated

## 3. Worker 事件契约（预留增强）

### 3.1 文件上传后处理

- submission.file.uploaded
- submission.file.process.requested
- submission.file.process.completed

### 3.2 后续 GitHub / CI 同步

- github.sync.requested
- github.sync.completed
- ci.result.synced

### 3.3 后续 AI 助教

- ai.weekly-summary.requested
- ai.review-draft.requested
- ai.rag-index.requested

## 4. 错误码约定

- UNAUTHENTICATED
- FORBIDDEN
- NOT_FOUND
- CONFLICT
- VALIDATION_FAILED
- INTERNAL_ERROR

## 5. 权限约定

1. 老师可管理课程内作业、阶段、评分与看板。
2. 助教可查看课程内小组并辅助评价，具体权限由课程设置决定。
3. 学生只能访问自己课程和小组相关资源。
4. 学生不能直接修改教师评分。

## 6. 一致性约定

1. 先 HTTP 成功写库，再推送 Socket 事件。
2. Socket 推送失败不回滚主事务。
3. 前端通过历史拉取 + 增量事件修正最终状态。
4. 提交、反馈、评分等写操作必须支持幂等键。
