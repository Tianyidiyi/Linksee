# Grade V1 设计草案（评审后确认版）

> 日期：2026-05-12  
> 目标：在现有 `submission + review` 闭环上，补齐“评分草稿 -> 教师发布”的最小可用成绩链路。

## 1. 目标与范围

Grade V1 只解决以下问题：

1. 助教/老师都可以录入或调整评分草稿。
2. 只有老师可以执行最终发布（对学生可见）。
3. 成绩变更可追溯（保留日志）。

不纳入 V1：

- 学生申诉
- 多评审自动聚合策略（均分、权重、主评优先）
- 课程最终总评（跨 Stage 汇总）

---

## 2. 角色与权限

### 2.1 角色定义

- `teacher`：可录入草稿、改草稿、发布成绩、调整已发布成绩。
- `assistant`：可录入草稿、改草稿；**不可发布成绩**。
- `student`：仅可查看自己小组的已发布成绩。
- `academic`：V1 只读（可选，按课程监管视角）。

### 2.2 权限矩阵（Grade 域）

| 操作 | teacher | assistant | student | academic |
| --- | --- | --- | --- | --- |
| 创建评分草稿 | ✅ | ✅ | ❌ | ❌ |
| 更新评分草稿 | ✅ | ✅ | ❌ | ❌ |
| 发布成绩 | ✅ | ❌ | ❌ | ❌ |
| 调整已发布成绩 | ✅ | ❌ | ❌ | ❌ |
| 查看组成绩（已发布） | ✅ | ✅ | ✅(仅本组) | ✅(可选) |

---

## 3. 业务流程（V1）

1. 小组提交进入评审流程（现有：`submitted -> under_review -> approved/needs_changes/rejected`）。
2. 助教或老师可在 Submission 上创建/更新 `grade draft`。
3. 当提交达到可评分条件（默认 `approved`）时，老师点击发布。
4. 发布后学生端可见该 Stage 成绩。
5. 若需改分，老师可发起“成绩调整”，必须填写原因并记日志。

---

## 4. 状态机设计

## 4.1 Grade 状态

```text
draft -> published
published -> published (adjusted)
```

说明：

- `draft`：仅教学侧可见。
- `published`：学生可见。
- “调整已发布成绩”不新增状态，保留在 `published`，通过日志体现变更。

## 4.2 与 Submission 的衔接规则

默认 V1 规则：

- 仅当 Submission `status=approved` 时允许发布成绩。
- `needs_changes/rejected/not_submitted/reviewed` 默认不允许发布正式分数（后续可配置化）。

---

## 5. 数据模型草案（Prisma Draft）

## 5.1 `stage_grades`（当前生效成绩）

建议字段：

- `id` BIGINT PK
- `submissionId` BIGINT UNIQUE FK -> `submissions.id`
- `groupId` BIGINT FK -> `groups.id`
- `stageId` BIGINT FK -> `assignment_stages.id`
- `courseId` BIGINT FK -> `courses.id`
- `score` DECIMAL(6,2) NULL
- `status` ENUM(`draft`,`published`) NOT NULL DEFAULT `draft`
- `graderId` VARCHAR(10) NOT NULL（最后一次编辑人）
- `publishedBy` VARCHAR(10) NULL（teacher）
- `publishedAt` DATETIME NULL
- `sourceReviewId` BIGINT NULL FK -> `reviews.id`
- `createdAt` DATETIME
- `updatedAt` DATETIME

约束建议：

- `UNIQUE(submissionId)`：一个 Submission 对应一个当前成绩记录。
- `INDEX(courseId, stageId, status)`：课程/阶段成绩列表。
- `INDEX(groupId, stageId)`：组内阶段成绩查询。

## 5.2 `stage_grade_logs`（成绩变更日志）

建议字段：

- `id` BIGINT PK
- `stageGradeId` BIGINT FK -> `stage_grades.id`
- `action` ENUM(`created`,`updated`,`published`,`adjusted`)
- `beforeScore` DECIMAL(6,2) NULL
- `afterScore` DECIMAL(6,2) NULL
- `operatorId` VARCHAR(10) NOT NULL
- `reason` VARCHAR(500) NULL（`adjusted` 时必填）
- `createdAt` DATETIME

约束建议：

- `INDEX(stageGradeId, createdAt)`
- `INDEX(operatorId, createdAt)`

---

## 6. API 草案（V1）

统一前缀：`/api/v1`

1. `POST /submissions/:submissionId/grade-drafts`
   - 角色：teacher/assistant
   - 用途：创建草稿或幂等返回现有草稿（建议 upsert）

2. `PATCH /grade-drafts/:gradeId`
   - 角色：teacher/assistant
   - 用途：更新草稿分数/备注

3. `POST /grades/:gradeId/publish`
   - 角色：teacher
   - 用途：发布成绩（`draft -> published`）
   - 校验：submission 必须 `approved`

4. `PATCH /grades/:gradeId`
   - 角色：teacher
   - 用途：调整已发布成绩
   - 要求：`reason` 必填，落日志

5. `GET /stages/:stageId/groups/:groupId/grade`
   - 角色：teacher/assistant/student(本组)/academic(可选)
   - 学生仅可见 `published`

6. `GET /courses/:courseId/grades`
   - 角色：teacher/assistant/academic(可选)
   - 支持分页与筛选：`stageId`、`status`、`groupId`

---

## 7. 核心校验规则

1. 助教不能发布、不能调整已发布成绩。
2. 老师可发布与调整；调整必须填写原因。
3. 学生无写权限。
4. 评分分值范围：`0 <= score <= 100`（V1 固定百分制）。
5. 发布动作要写事件：
   - `grade.published`
   - `grade.updated`（调整时）

---

## 8. 与现有模块集成

1. `reviews-router`：评审结果可作为 `sourceReviewId` 来源。
2. `dashboard-router`：可增加字段
   - `publishedGradeCount`
   - `ungradedApprovedCount`
3. `communication-contract-v1`：补 Grade 契约与权限规则。
4. `openapi/linksee-v1.yaml`：新增 Grade tag 与路径。

---

## 9. 风险与取舍

1. 单 Submission 单 Grade（UNIQUE）简化了 V1，但不支持多评审聚合。
2. 不做申诉可降低复杂度，但后续上线需补流程。
3. 若后续接入 rubric 自动算分，建议新增 `scoreBreakdown` JSON 字段。

---

## 10. 建议落地顺序

1. 数据模型（Prisma）  
2. 草稿接口（assistant/teacher）  
3. 发布接口（teacher）  
4. 查询接口（学生可见 published）  
5. 日志与事件  

