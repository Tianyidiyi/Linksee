# 集成测试

本目录用于放置后端接口与业务链路的集成测试。

运行方式：

```bash
npm run test:integration -w @linksee/api -- --runInBand
```

说明：

1. `apps/api/jest.config.js` 默认不在 `npm test` 中执行 `*.integration.test.ts`。
2. 集成测试应通过 `test:integration` 脚本单独运行。
3. 在当前环境里如果 Jest 多进程出现 `spawn EPERM`，建议加上 `--runInBand`。
4. Windows PowerShell 若拦截 `npm.ps1`，可改用 `npm.cmd run ...`。

集成测试的目标不是重复单元测试，而是验证：

1. 路由参数校验是否正确。
2. 角色权限与越权拦截是否正确。
3. 状态流转是否符合当前业务规则。
4. 多个模块之间的联动是否一致。
5. 关键副作用是否发生，例如实时事件、系统消息、会话创建、成绩发布。

## 当前已有覆盖

### 1. 认证与用户

- `auth/auth-router.integration.test.ts`
- `users/users-router.integration.test.ts`
- `users/self-router.integration.test.ts`
- `users/assistant-router.integration.test.ts`

已覆盖重点：

- 登录参数校验、锁定账号拦截、refresh token 基础链路
- 当前用户信息回查与个人资料修改
- 教师创建、查询、编辑、停用助教
- 教务用户目录查询、创建学生、更新用户资料、删除助教、导出用户目录
- 教务批量创建学生/教师
- 教务批量创建学生的部分成功、无效行、唯一冲突汇总
- 教务导入学生名单成功链路
- 教务导入文件无法解析时返回 `IMPORT_FAILED`
- 教务导入文件可解析但部分行无效或唯一冲突时的汇总结果

### 2. 课程

- `courses/courses-router.integration.test.ts`
- `courses/course-members-router.integration.test.ts`
- `courses/course-lifecycle.integration.test.ts`

已覆盖重点：

- 教务创建课程、课程创建权限、课程列表筛选
- 课程成员接口基础参数与权限
- 教师绑定助教、教师角色更新、助教绑定上限、助教解绑角色限制
- 课程激活前必须有教师和助教
- 课程激活、归档、课程会话与系统通知副作用
- 课程单个成员添加成功链路

### 3. 项目与阶段

- `assignments/assignments-router.integration.test.ts`
- `assignments/assignment-stages-router.integration.test.ts`

已覆盖重点：

- 无阶段时禁止激活项目
- 存在未关闭阶段时禁止归档项目
- 项目 `archived -> active` 非法状态流转被拒绝
- 项目激活前置规则、激活通知、归档后分组归档联动
- 项目附件删除
- 开放阶段创建、阶段从非开放状态切换为 `open` 的通知
- 阶段 `closed -> planned` 非法状态流转被拒绝
- 阶段归档、阶段附件删除

### 4. 小组

- `groups/groups-router.integration.test.ts`
- `groups/group-admin-router.integration.test.ts`
- `groups/group-members-router.integration.test.ts`
- `groups/group-details-router.integration.test.ts`
- `groups/group-requests-router.integration.test.ts`

已覆盖重点：

- 小组列表和创建的基础参数校验
- 创建小组成功后可在列表再次查询
- 一键分组成功后的建组与组长分配
- 小组状态调整校验
- 确认成组后自动创建小组会话并写入首条系统消息
- 空组归档、非空组删除拦截
- 移除组长后的自动重分配与系统通知
- 小组详情聚合查询
- 入组申请、组长审批、添加成员、换组
- 组长转让申请创建、接受、拒绝

### 5. 提交、批阅与评分

- `submissions/submissions-router.integration.test.ts`
- `submissions/submission-review-grade-flow.integration.test.ts`
- `grading/reviews-router.integration.test.ts`
- `grading/grades-router.integration.test.ts`
- `grading/dashboard-router.integration.test.ts`

已覆盖重点：

- 提交接口基础参数校验
- 提交成功后的记录创建、实时事件与会话消息副作用
- 提交记录再次查询与附件元数据回查
- 重交时替换旧附件
- 非组长提交拦截、截止后提交拦截
- 课程外用户越权提交拦截
- 批阅开始、提交批阅、批阅状态约束
- 教师创建评分草稿、发布单条成绩、发布后单组单阶段成绩回查
- `提交 -> 批阅 -> 评分 -> 发布成绩 -> 学生回查` 串联式主链路
- 已发布成绩调整
- 成绩列表分页筛选、草稿列表分页筛选
- dashboard 与 pipeline-health 聚合

### 6. 组内任务

- `minitasks/minitasks-router.integration.test.ts`

已覆盖重点：

- 组长创建小任务
- 任务状态更新
- 任务相关系统消息与实时事件
- 任务列表筛选与分页
- 组长编辑任务成功链路
- 非组长取消任务权限拦截

### 7. 协作与实时

- `collaboration/course-chat-router.integration.test.ts`
- `collaboration/conversations-router.integration.test.ts`
- `collaboration/chat-files-router.integration.test.ts`
- `collaboration/realtime-router.integration.test.ts`

已覆盖重点：

- 课程聊天发送、删除、搜索、编辑
- 小组聊天发送、搜索、编辑
- 小组消息删除后再次搜索回查不可见
- 小组公告权限拦截
- 会话列表聚合、会话已读状态更新
- 聊天文件上传/下载预签名
- 实时 ack 与 replay 基础链路

## 当前仍明显缺口

以下是验收和联调仍值得继续补齐的后端集成测试：

### P1

1. 课程激活后面向前端关键回查链路的接口组合验证。
2. 通知规则的独立场景化核对。
3. 取消任务后的再次修改被拒绝或保持取消状态的补充回归场景。
4. 文件消息编辑权限限制。

## 建议的新增测试文件

1. `tests/integration/courses/course-notifications.integration.test.ts`

更适合给验收或执行使用的文档，见：

- [集成测试场景清单](./集成测试场景清单.md)
