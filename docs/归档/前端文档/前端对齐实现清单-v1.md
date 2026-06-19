# 前端对齐实现清单 v1（课程域）

> 更新时间：2026-05-11  
> 目标：明确“前端现在应该实现什么”，避免做超前功能。

## 1. 课程页（Course）
- 功能：
  - 课程列表、课程详情。
  - 教师/助教/学生成员管理入口。
- 主要接口：
  - `GET /api/v1/courses`
  - `GET /api/v1/courses/:id`
  - `GET/POST/PATCH/DELETE /api/v1/courses/:id/teachers*`
  - `GET/POST/DELETE /api/v1/courses/:id/assistants*`
  - `GET/POST/POST(batch)/DELETE /api/v1/courses/:id/members*`

## 2. 作业页（Assignment）
- 功能：
  - 作业列表、创建、编辑、删除。
  - 作业说明附件上传/删除。
- 主要接口：
  - `GET/POST /api/v1/courses/:courseId/assignments`
  - `GET/PATCH/DELETE /api/v1/assignments/:assignmentId`
  - `POST/DELETE /api/v1/assignments/:assignmentId/materials`

## 3. 阶段页（Stage）
- 功能：
  - 阶段列表、创建、编辑、删除。
  - 阶段要求附件上传/删除。
- 主要接口：
  - `GET/POST /api/v1/assignments/:assignmentId/stages`
  - `GET/PATCH/DELETE /api/v1/stages/:stageId`
  - `POST/DELETE /api/v1/stages/:stageId/materials`

## 4. 组队页（Group Formation）
- 功能（学生）：
  - 创建小组（自动成为组长）。
  - 申请加入已有小组。
- 功能（组长）：
  - 查看入组申请列表。
  - 同意/拒绝申请。
  - 发起组长转让，等待目标成员确认。
- 功能（教师/助教）：
  - 手动加减组员（兜底调整）。
- 主要接口：
  - `GET/POST /api/v1/assignments/:assignmentId/groups`
  - `POST /api/v1/groups/:groupId/join-requests`
  - `GET /api/v1/groups/:groupId/join-requests`
  - `POST /api/v1/group-join-requests/:requestId/approve`
  - `POST /api/v1/group-join-requests/:requestId/reject`
  - `POST /api/v1/groups/:groupId/leader-transfer-requests`
  - `POST /api/v1/group-leader-transfer-requests/:requestId/accept`
  - `POST /api/v1/group-leader-transfer-requests/:requestId/reject`
  - `POST/DELETE /api/v1/groups/:groupId/members*`

## 5. 小组协作页（Group Collaboration）
- 功能：
  - 小组消息列表、发送消息。
  - 基础协作信息展示（先不做搜索/公告/编辑撤回）。
- 主要接口：
  - `GET/POST /api/v1/groups/:groupId/messages`

## 6. 课程消息页（Course Collaboration）
- 功能：
  - 课程消息列表、发送消息。
  - 先不做消息搜索、公告、编辑撤回。
- 主要接口：
  - `GET/POST /api/v1/courses/:courseId/messages`

## 7. 必须对齐的前端规则
- 截止后学生侧禁用组队操作（创建组、申请入组）。
- 同一学生同一作业仅允许一个组归属，冲突时展示后端错误信息。
- 组长转让需目标成员确认才算完成，前端显示“待确认”状态。
- 文件上传统一按 `multipart/form-data`。
- 所有 ID 按字符串处理。

## 8. 暂不实现（前端先隐藏/标记待上线）
- 组号自动重排与截止后两轮整理。
- 批量合并组、智能补位、超员特批。
- 课程/小组消息搜索、公告、编辑撤回。
- 会话总览、read 标记、聊天文件 presign、realtime ack/replay。

## 9. 联调验收最小用例
- 学生创建组：截止前成功、截止后被阻止。
- 学生申请入组：成功、重复申请冲突、满员冲突。
- 组长审批：同意后成员入组、拒绝后状态更新。
- 组长转让：发起成功，目标成员接受后角色切换成功。
- 教师/助教手动调组：截止后仍可加减成员。
