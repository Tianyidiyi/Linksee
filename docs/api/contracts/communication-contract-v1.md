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
  - status: submitted | resubmitted
  - submittedBy: string
  - submittedAt: string

### 1.5 教师反馈与评分

- Method: POST
- Path: /api/v1/submissions/{submissionId}/reviews
- Headers:
  - Authorization: Bearer `<token>`
  - Idempotency-Key: `<uuid>`
- Request:
  - status: needs_changes | approved
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
not_submitted -> submitted -> needs_changes -> resubmitted -> approved
```

说明：

- `not_submitted`：尚未提交，可由看板根据 Stage 和 Group 推导，不一定落库。
- `submitted`：首次提交，等待老师或助教查看。
- `needs_changes`：老师或助教要求修改。
- `resubmitted`：学生按反馈重新提交。
- `approved`：老师确认通过。
- P0 暂不使用 `rejected` 作为常规状态；不通过原因写入 Review.comment。

## 4. Socket 契约（示例）

### 4.1 握手

- token 放在握手鉴权字段
- 鉴权失败立即断开

### 4.2 房间

- course:{courseId}
- assignment:{assignmentId}
- group:{groupId}
- stage:{stageId}

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
2. group.minitask.updated
3. submission.created
4. submission.status.updated
5. review.created
6. grade.updated
7. dashboard.group-risk.updated

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

1. 老师可管理课程内作业、阶段、评分与看板。
2. 助教可查看课程内小组并辅助评价，具体权限由课程设置决定。
3. 学生只能访问自己课程和小组相关资源。
4. 学生不能直接修改教师评分。
5. 学生只能提交自己所在 Group 的成果。
6. 助教可登记 Review，但最终 Grade 发布权保留给老师。

## 8. 一致性约定

1. 先 HTTP 成功写库，再推送 Socket 事件。
2. Socket 推送失败不回滚主事务。
3. 前端通过历史拉取 + 增量事件修正最终状态。
4. 提交、反馈、评分等写操作必须支持幂等键。
