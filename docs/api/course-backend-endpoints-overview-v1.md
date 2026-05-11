# 课程后端接口总览 v1（当前已开放）

> 更新时间：2026-05-11  
> 以代码与 OpenAPI 为准：`apps/api/src/http/routes.ts`、`docs/api/openapi/linksee-v1.yaml`

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
- `POST /api/v1/submissions/:submissionId/reviews`：评审提交

## 7. 当前未覆盖（课程域相关）
- 组号自动重排（截止后两轮整理）未实现。
- 批量合并组、智能补位、超员特批流程未实现。
- 复杂退组链路（先转让再退出自动引导）未实现。
