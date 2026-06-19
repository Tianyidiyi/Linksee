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

集成测试的目标不是重复单元测试，而是验证以下内容：

1. 路由参数校验是否正确。
2. 角色权限与越权拦截是否正确。
3. 状态流转是否符合当前业务规则。
4. 多个模块之间的联动是否一致。
5. 关键副作用是否发生，例如事件推送、通知、会话创建、成绩发布。

## 当前已有覆盖

### 1. 认证与用户
- `auth/auth-router.integration.test.ts`
- `users/users-router.integration.test.ts`
- `users/self-router.integration.test.ts`
- `users/assistant-router.integration.test.ts`

已覆盖重点：
- 登录参数校验
- 锁定账号拦截
- refresh token 基础链路
- 助教创建与用户创建的基础越权校验
- 当前用户信息回查
- 当前用户资料修改成功链路
- 教师创建助教成功链路
- 教师查询自己名下助教列表
- 助教账号编辑与停用成功链路
- 教务用户目录查询
- 教务创建学生成功链路
- 教务更新用户资料成功链路
- 教务删除助教成功链路
- 教务导出用户目录
- 教务批量创建学生/教师
- 教务导入学生名单

### 2. 课程
- `courses/courses-router.integration.test.ts`
- `courses/course-members-router.integration.test.ts`
- `courses/course-lifecycle.integration.test.ts`

已覆盖重点：
- 教务创建课程成功
- 课程创建权限
- 课程列表筛选校验
- 课程成员接口的基础参数与权限
- 课程老师绑定助教成功
- 课程教师角色更新成功链路
- 课程激活前必须有老师
- 课程激活前必须有助教
- 助教绑定上限约束
- 助教解绑的角色限制
- 课程单个成员添加成功链路

### 3. 项目与阶段
- `assignments/assignments-router.integration.test.ts`
- `assignments/assignment-stages-router.integration.test.ts`

已覆盖重点：
- 无阶段时禁止激活项目
- 存在未关闭阶段时禁止归档项目
- 项目激活前置规则
- 项目激活成功后的系统通知
- 项目归档成功后的分组归档联动
- 项目附件删除成功链路
- 开放阶段创建成功后的系统通知
- 阶段由非开放状态切换为 `open` 时的系统通知
- 阶段归档成功链路
- 阶段附件删除成功链路

### 4. 小组
- `groups/groups-router.integration.test.ts`
- `groups/group-admin-router.integration.test.ts`
- `groups/group-members-router.integration.test.ts`
- `groups/group-details-router.integration.test.ts`
- `groups/group-requests-router.integration.test.ts`

已覆盖重点：
- 小组列表和创建的基础参数校验
- 小组状态调整的基础校验
- 一键分组成功后的建组与组长分配
- 小组会话批量创建
- 确认成组后自动创建小组会话
- 确认成组后写入首条系统消息
- 空组归档成功链路
- 移除组长后的自动重分配与系统通知
- 小组详情聚合查询
- 学生发起入组申请
- 组长审批入组申请成功链路
- 添加成员成功链路
- 换组成功链路
- 组长转让申请创建成功链路
- 组长转让接受/拒绝成功链路

### 5. 提交、批阅与评分
- `submissions/submissions-router.integration.test.ts`
- `grading/reviews-router.integration.test.ts`
- `grading/grades-router.integration.test.ts`
- `grading/dashboard-router.integration.test.ts`

已覆盖重点：
- 提交接口基础参数校验
- 提交成功后的提交记录创建与实时副作用
- 提交记录再次查询与附件元数据回查
- 重交时替换旧附件成功链路
- 非组长提交拦截
- 截止后提交拦截
- 批阅开始、批阅提交的部分状态约束
- 助教/教师成功提交批阅
- 教师成功创建评分草稿
- 评分草稿、发布的部分校验
- 单条成绩成功发布后的实时副作用
- 单组单阶段成绩回查
- 已发布成绩调整成功链路
- 成绩列表分页筛选
- 草稿列表分页筛选
- dashboard 与 pipeline-health 聚合

### 6. 组内任务
- `minitasks/minitasks-router.integration.test.ts`

已覆盖重点：
- 组长创建小任务成功链路
- 任务状态更新成功链路
- 任务相关系统消息与实时副作用
### 7. 协作
- `collaboration/course-chat-router.integration.test.ts`
- `collaboration/conversations-router.integration.test.ts`
- `collaboration/chat-files-router.integration.test.ts`
- `collaboration/realtime-router.integration.test.ts`

已覆盖重点：
- 课程聊天发消息成功链路
- 课程聊天删除消息成功链路
- 课程聊天搜索成功链路
- 课程聊天编辑成功链路
- 小组聊天发消息成功链路
- 小组聊天搜索成功链路
- 小组聊天编辑成功链路
- 小组公告的基础权限拦截
- 会话列表聚合查询
- 会话已读状态更新
- 聊天文件上传/下载预签名基础链路
- 实时 ack 与 replay 基础链路

## 当前最明显的缺口

以下是按当前业务现状整理出的高优先级缺口，不是“理论上可以补”，而是对验收、联调和真实链路最有价值的场景。

### P0：今晚最值得补

1. 提交成功后的真实回查增强
- 当前提交侧测试更多还是基础校验。
- 建议验证：
  - 重交时旧附件被替换而不是脏叠加

2. 助教批阅、老师发布成绩的完整链路增强
- 这是验收主流程之一。
- 建议验证：
  - 老师发布成绩
  - 课程成绩列表与草稿列表的分页/筛选组合

3. 通知规则系统核对
- 目前缺少面向通知的成组覆盖。
- 建议至少补：
  - 课程开始
  - 课程结束
  - 项目开始
  - 阶段开始
  - 小组成立
  - 组长变更

### P1：可以随后补

1. 协作消息更深层能力，例如删除后的再次回查或文件消息编辑限制

## 建议的测试组织方式

为了让后面补测试更稳，建议按“业务链路”组织，而不是只按路由拆。

### 推荐优先新增的测试文件

1. `tests/integration/courses/course-notifications.integration.test.ts`
- 放课程激活、课程归档、课程通知相关测试

2. `tests/integration/assignments/assignment-lifecycle.integration.test.ts`
- 放项目/阶段激活、归档、通知联动相关测试

3. `tests/integration/groups/group-lifecycle.integration.test.ts`
- 放确认成组、自动建群、组长重分配、一键分组相关测试

4. `tests/integration/submissions/submission-review-grade-flow.integration.test.ts`
- 放提交、批阅、评分、发布成绩的一整条主链路

5. `tests/integration/notifications/`
- 如果后续通知逻辑继续扩展，建议单独拆一个目录

## 与验收最相关的建议顺序

如果按今晚最该补的优先级，建议顺序是：

1. 课程激活/归档
2. 项目与阶段状态联动
3. 小组成组、一键分组、组长重分配
4. 提交 -> 批阅 -> 评分 -> 发布成绩
5. 通知规则

## 说明

本 README 只负责说明当前集成测试覆盖范围和缺口。

更适合给验收或执行使用的文档，建议看：
- [集成测试场景清单](./集成测试场景清单.md)
