# 通信治理规范（教学协作版）

本文档用于避免后续开发中“混合通信越写越乱”，并保证所有模块围绕教学项目协作与过程评价主线展开。

## 1. 范围

适用于以下模块：

- auth：认证、角色与权限
- course：课程空间与班级管理
- group：小组与成员管理
- assignment：课程项目与阶段任务
- collaboration：小组任务、讨论、文件与动态流
- submission：阶段提交与材料管理
- grading：Rubric、互评、贡献与评分
- worker：异步文件处理、通知汇总、后续 GitHub/AI/RAG 任务

## 2. 决策原则

1. 改数据：HTTP。
2. 推变化：Socket。
3. 重任务：Worker。

若一个需求同时涉及三者，必须先写通信决策表再实现。

## 3. 必填通信决策表

每个需求必须写：

- 功能名
- 涉及教学角色：teacher / student / assistant
- 涉及模块：course / group / assignment / collaboration / submission / grading / worker
- 是否改数据
- 是否需要秒级实时
- 失败后是否可重试
- 通信通道（HTTP/Socket/Worker）
- 权限校验点
- 降级策略

## 4. 后端规范

1. API 层负责输入校验、权限校验、调用业务层。
2. 业务层写入成功后，生成事件并发布。
3. Socket 层只分发事件，不写业务数据。
4. Worker 层只消费异步事件，不回写跨模块私有表。
5. 学生、老师、助教的权限必须在业务层再次校验，不能只依赖前端隐藏入口。

## 5. 前端规范

1. 写请求只调 HTTP。
2. Socket 只用于增量更新页面状态。
3. 本地状态合并顺序：HTTP 确认结果优先，Socket 增量补齐。
4. 事件去重基于 eventId。
5. 老师看板必须支持刷新兜底，不能完全依赖 Socket。

## 6. 事件规范

### 6.1 命名

- 统一格式：entity.action
- 示例：submission.created、review.created、group.message.created

### 6.2 包结构

- id: 全局唯一事件 ID
- name: 事件名
- occurredAt: 发生时间
- producer: 事件生产者
- traceId: 链路追踪 ID
- payload: 业务数据

### 6.3 发布顺序

1. 事务提交成功
2. 事件写入 outbox（或可靠记录）
3. 推送 Socket 或交给 Worker

## 7. 降级策略

1. Socket 不可用：前端回退到手动刷新或短轮询。
2. Worker 堵塞：文件/AI/GitHub 同步任务状态保持 pending，前端显示处理中。
3. 事件重复：按 eventId 幂等消费。
4. 看板短暂不一致：以 HTTP 查询结果为准，Socket 只做增量提示。

## 8. 审查清单（PR 必须通过）

- [ ] 写操作未使用 Socket
- [ ] Socket 网关未直接写库
- [ ] 事件命名符合规范
- [ ] 角色与权限校验明确
- [ ] 失败重试与降级策略明确
- [ ] 教学语义未退回旧的 team/project-task/feed 命名
