# 当前交付状态（2026-05-12）

## 1. 后端已实现主链路

1. Auth
   - 登录、刷新 Token、登出、改密
   - 单个/批量重置密码（含教务和教师权限边界）
2. Users
   - `GET/PATCH /api/v1/users/me`
   - `POST /api/v1/users/me/avatar`
   - 助教创建、教务批量建人、用户信息更新
3. Courses
   - 课程 CRUD、教师关系管理、助教绑定、成员导入/移除
4. Assignments + Stages
   - 作业与阶段 CRUD、状态流转、材料上传/删除
5. Groups + Collaboration
   - 分组、成员管理、申请/审批、组长移交、并组
   - 课程/小组消息发送、编辑、删除、检索、公告
   - 会话列表、已读上报、聊天文件预签名上传/下载、realtime ack/replay
6. Submissions + Reviews
   - 阶段提交创建/查询（含幂等、状态约束、附件处理）
   - 评审创建、待评审列表、评审更新
   - 截止自动标记 `not_submitted`（定时任务）
   - 评审开始 `submitted -> under_review`、未提交人工结案 `not_submitted -> reviewed`
   - 课程看板 `GET /api/v1/courses/:courseId/dashboard`
   - 学生小组定位 `GET /api/v1/assignments/:assignmentId/my-group`
7. MiniTasks
   - 任务创建、查询、编辑、状态流转、提醒相关字段复位

## 2. 当前文档基线

1. OpenAPI：`docs/api/openapi/linksee-v1.yaml`（持续与运行代码同步）
2. 接口导航：`docs/api/README.md`
3. 联调说明：`docs/api/前后端联调对齐说明.md`

## 3. 当前风险与后续动作

1. 风险：OpenAPI 仍可能落后于快速迭代中的协作接口细节（字段级）
2. 动作：每次新增/变更路由必须同步更新 OpenAPI 与 `apps/api/src/http/routes.ts`
3. 动作：补齐协作与 minitask 的集成测试覆盖（消息检索、已读、预签名、replay）
