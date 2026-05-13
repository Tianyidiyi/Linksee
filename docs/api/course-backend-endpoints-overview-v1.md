# 课程后端接口总览 v1（当前已开放）

> 更新时间：2026-05-11  
> 以代码与 OpenAPI 为准：`apps/api/src/http/routes.ts`、`docs/api/openapi/linksee-v1.yaml`

## ⚠️ 前端联调必读：分组确认后再建群（高优先级）

- 小组聊天会话**不能**在学生组队过程中自动创建。  
- 原因：组队中途会发生加人/移人/合组，若提前建群会导致成员同步复杂且容易出现脏状态。  
- 正确流程：老师（或助教）在分组调整完成后，点击“确认分组并创建群聊”，再调用后端接口批量建群。

**确认分组并建群接口（教学侧）**
- `POST /api/v1/assignments/:assignmentId/groups/conversations`
- 权限：`teacher / assistant / academic`（课程可管理角色）
- 语义：把该作业下现有小组一次性创建/补齐群会话（幂等）
- 前端建议：将此动作放在教师端“分组管理页”的醒目主按钮，避免遗漏。

## 1. Course
- `GET /api/v1/courses`：课程列表（分页/筛选）
- `POST /api/v1/courses`：创建课程
- `GET /api/v1/courses/:id`：课程详情
- `PATCH /api/v1/courses/:id`：更新课程（含状态流转）
- `GET /api/v1/courses/:id/teachers`：课程教师列表
- `POST /api/v1/courses/:id/teachers`：绑定教师
- `PATCH /api/v1/courses/:id/teachers/:userId`：更新教师关系
- `DELETE /api/v1/courses/:id/teachers/:userId`：解绑教师
- `GET /api/v1/courses/:id/assistants`：助教列表
- `POST /api/v1/courses/:id/assistants`：绑定助教
- `DELETE /api/v1/courses/:id/assistants/:assistantUserId`：解绑助教
- `GET /api/v1/courses/:id/members`：课程学生列表
- `POST /api/v1/courses/:id/members`：添加单个学生
- `POST /api/v1/courses/:id/members/batch`：批量导入学生
- `DELETE /api/v1/courses/:id/members/:userId`：移除学生

## 2. Assignment
- `POST /api/v1/courses/:courseId/assignments`：创建作业
- `GET /api/v1/courses/:courseId/assignments`：作业列表
- `GET /api/v1/assignments/:assignmentId`：作业详情
- `PATCH /api/v1/assignments/:assignmentId`：更新作业
- `DELETE /api/v1/assignments/:assignmentId`：删除作业
- `POST /api/v1/assignments/:assignmentId/materials`：上传作业说明附件（MinIO）
- `DELETE /api/v1/assignments/:assignmentId/materials`：删除作业说明附件

## 3. Stage
- `GET /api/v1/assignments/:assignmentId/stages`：阶段列表
- `POST /api/v1/assignments/:assignmentId/stages`：创建阶段
- `GET /api/v1/stages/:stageId`：阶段详情
- `PATCH /api/v1/stages/:stageId`：更新阶段
- `DELETE /api/v1/stages/:stageId`：删除阶段
- `POST /api/v1/stages/:stageId/materials`：上传阶段要求附件（MinIO）
- `DELETE /api/v1/stages/:stageId/materials`：删除阶段要求附件

## 4. Group
- `GET /api/v1/assignments/:assignmentId/groups`：小组列表（分页）
- `GET /api/v1/assignments/:assignmentId/my-group`：查询当前用户在该作业下的小组
- `POST /api/v1/assignments/:assignmentId/groups`：创建小组
- `POST /api/v1/groups/:groupId/members`：手动加组员（教学侧）
- `DELETE /api/v1/groups/:groupId/members/:userId`：移除组员

### 4.1 入组申请链路（已实现）
- `POST /api/v1/groups/:groupId/join-requests`：学生申请加入小组
- `GET /api/v1/groups/:groupId/join-requests`：组长/教学侧查看申请
- `POST /api/v1/group-join-requests/:requestId/approve`：组长同意申请
- `POST /api/v1/group-join-requests/:requestId/reject`：组长拒绝申请

### 4.2 组长转让链路（已实现）
- `POST /api/v1/groups/:groupId/leader-transfer-requests`：组长发起转让
- `POST /api/v1/group-leader-transfer-requests/:requestId/accept`：目标成员确认接受
- `POST /api/v1/group-leader-transfer-requests/:requestId/reject`：目标成员拒绝

### 4.3 关键规则（后端已约束）
- 学生侧受 `assignment_group_configs.groupFormEnd` 截止限制。
- 同一学生在同一作业下只能属于一个组。
- 学生自助入组受 `groupMaxSize` 限制。
- 同组同时仅允许一条待处理组长转让请求。

## 5. Collaboration
- `GET /api/v1/courses/:courseId/messages`：课程会话消息列表
- `POST /api/v1/courses/:courseId/messages`：发送课程消息
- `GET /api/v1/groups/:groupId/messages`：小组会话消息列表
- `POST /api/v1/groups/:groupId/messages`：发送小组消息

## 6. Submission / Review
- `POST /api/v1/stages/:stageId/groups/:groupId/submissions`：阶段提交
- `GET /api/v1/stages/:stageId/groups/:groupId/submissions`：提交记录列表
- `POST /api/v1/submissions/:submissionId/reviews/start`：开始评审（submitted -> under_review）
- `POST /api/v1/submissions/:submissionId/reviews`：评审提交
- `POST /api/v1/submissions/:submissionId/mark-reviewed`：未提交人工结案（not_submitted -> reviewed）
- `GET /api/v1/courses/:courseId/pending-reviews`：课程待评审列表（支持 stageId/groupId/reviewerId 筛选）
- `PATCH /api/v1/reviews/:reviewId`：更新评审

## 6.1 Dashboard
- `GET /api/v1/courses/:courseId/dashboard`：课程教师看板（进度/待评审/逾期/活跃度）

## 6.2 自动任务
- `@linksee/worker`：`npm run start:submission-deadline-scheduler -w @linksee/worker`
  - 周期执行截止扫描，自动写入 `not_submitted`，并推送 `submission.status.updated` 事件

## 6.3 Grading（评分与导出）
- `POST /api/v1/submissions/:submissionId/grade-drafts`：创建/覆盖评分草稿
- `PATCH /api/v1/grade-drafts/:gradeId`：更新评分草稿
- `POST /api/v1/grades/:gradeId/publish`：单条发布成绩（teacher）
- `POST /api/v1/courses/:courseId/grades/publish-batch`：批量发布成绩（teacher，可返回阻塞明细）
- `PATCH /api/v1/grades/:gradeId`：发布后成绩调整（teacher）
- `GET /api/v1/stages/:stageId/groups/:groupId/grade`：查询单组单阶段成绩
- `GET /api/v1/courses/:courseId/grades`：课程成绩列表（分页筛选）
- `GET /api/v1/courses/:courseId/grade-drafts`：课程成绩草稿列表（分页筛选）
- `GET /api/v1/courses/:courseId/grades/export`：导出成绩 CSV
- `GET /api/v1/courses/:courseId/reviews/export`：导出评审 CSV
- `GET /api/v1/courses/:courseId/pipeline-health`：课程流水线健康检查（每阶段未交/待评审/草稿/已发布）

## 7. 当前未覆盖（课程域相关）
- 组号自动重排（截止后两轮整理）未实现。
- 批量合并组、智能补位、超员特批流程未实现。
- 复杂退组链路（先转让再退出自动引导）未实现。
