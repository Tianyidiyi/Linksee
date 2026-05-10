# 当前交付状态（2026-05-09）

## 1. 已实现范围（后端）

当前后端已经可用的主链路模块：

1. Auth
   - 登录、刷新 Token、登出、改密
   - 管理员/教师重置密码（单个与批量）
2. Users
   - `GET/PATCH /api/v1/users/me`
   - `POST /api/v1/users/me/avatar`
   - 教务创建/批量创建学生与教师
   - 教师创建助教账号
3. Courses（课程顶层）
   - 课程 CRUD（受角色权限控制）
   - 课程教师关系管理（含 lead/co）
   - 课程助教绑定/解绑与查询
   - 课程成员单个/批量导入、查询、移除（withdrawn 软移除）
4. Assignments（课程作业）
   - Assignment 顶层 CRUD 与状态流转（draft/active/archived）
   - Assignment 说明附件上传/删除（MinIO）
   - Stage CRUD、状态流转（planned/open/closed/archived）
   - Stage 要求附件上传/删除（MinIO）
5. Collaboration + Groups
   - 课程群消息（GET/POST /api/v1/courses/:courseId/messages）
   - 小组群消息（GET/POST /api/v1/groups/:groupId/messages）
   - 小组列表与创建（GET/POST /api/v1/assignments/:assignmentId/groups）
   - 小组成员增删（POST/DELETE /api/v1/groups/:groupId/members）

## 2. 当前实现的结构化拆分

为避免课程与作业路由继续膨胀，已完成以下结构拆分并在运行路径生效：

1. `apps/api/src/courses/course-access.ts`
   - 统一课程读权限（可见）和写权限（可管理）判断
   - 统一课程存在性与教师关系校验辅助函数
2. `apps/api/src/assignments/course-material-storage.ts`
   - 统一课程材料的 multipart 解析、MinIO 上传/删除、元数据标准化与 URL 组装
3. `apps/api/src/assignments/assignments-router.ts`
   - 仅保留 assignment 顶层 CRUD 与 assignment 材料接口
4. `apps/api/src/assignments/assignment-stages-router.ts`
   - 负责 stage CRUD、状态变更与 stage 材料接口

## 3. 前后端对齐建议（按“已开放接口”开发）

详细联调文档：`docs/api/前后端联调对齐说明.md`

前端当前应以“已实现并可联调”的接口为准，不再按早期规划接口猜测：

1. 课程页可直接对接
   - `/api/v1/courses`
   - `/api/v1/courses/:id`
   - `/api/v1/courses/:id/teachers`
   - `/api/v1/courses/:id/assistants`
   - `/api/v1/courses/:id/members`
2. 作业页可直接对接
   - `/api/v1/courses/:courseId/assignments`
   - `/api/v1/assignments/:assignmentId`
   - `/api/v1/assignments/:assignmentId/materials`
3. 阶段页可直接对接
   - `/api/v1/assignments/:assignmentId/stages`
   - `/api/v1/stages/:stageId`
   - `/api/v1/stages/:stageId/materials`
4. 群聊与小组可直接对接
   - `/api/v1/courses/:courseId/messages`
   - `/api/v1/groups/:groupId/messages`
   - `/api/v1/assignments/:assignmentId/groups`
   - `/api/v1/groups/:groupId/members`

## 4. 仍缺少/待推进部分

1. Submission / Review 主业务尚未进入完整实现阶段（当前以规划为主）
2. 端到端自动化集成测试（integration test）体系尚未建立
3. OpenAPI 仍需继续与“真实可运行行为”保持同步更新（尤其是错误码与返回结构）
