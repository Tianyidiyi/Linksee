# 通信架构规划（教学协作 MVP 到可扩展）

本文基于当前 Linksee 新定位：

- MVP：课程项目 + 小组协作 + 阶段提交 + 教师追踪 + 评分反馈
- 增强：GitHub 提交记录汇总、自动测试结果展示、AI 助教与 RAG 问答
- 技术栈：Vue 3 + TypeScript，Node.js + Express/NestJS，MySQL + Prisma，Redis + Socket.io

## 1. 一句话结论

Linksee 建议采用混合通信模型：

- HTTP：登录、课程、小组、阶段要求、提交、评分等业务主链路
- Socket：小组讨论、提交状态变化、教师反馈、待评价提醒等实时推送
- Worker：文件处理、通知汇总、后续 GitHub/CI 同步、AI/RAG 处理

这样可以先完成教学项目协作闭环，同时给后续自动代码贡献统计、自动测试、AI 助教预留边界。

## 2. 先做什么，不做什么

MVP 必做：

1. 用户认证与基础角色：teacher、student、assistant。
2. 课程、Assignment、小组、Stage 的 HTTP API。
3. 小组讨论、任务状态、阶段提交的 HTTP 写入与 Socket 推送。
4. 教师看板的聚合查询：未提交、延期、待评价、协作不活跃。
5. 阶段评价与 Rubric 简化评分。

MVP 可延后：

1. GitHub commit 自动导入。
2. GitHub Actions / GitLab CI 自动测试结果同步。
3. 文件内容向量化与 RAG 问答。
4. AI 周报、AI 评语草稿。
5. 复杂消息队列编排。

说明：第一版可以记录 GitHub 仓库链接和人工贡献说明，但不要承诺自动代码贡献统计。

## 3. 通信分层设计

### 3.1 HTTP（同步）

适用：

- 登录、鉴权、角色校验
- 课程与 Assignment 管理
- 小组创建、加入、成员管理
- Stage 创建与查询
- 小组任务看板 CRUD
- 阶段提交创建与状态更新
- 教师反馈、Rubric 评分
- 历史讨论消息分页查询
- 文件元数据管理

必须约定：

- 接口超时：3 到 8 秒
- 幂等：提交、反馈、评分等写操作支持 Idempotency-Key
- 错误码：未认证、无权限、资源不存在、冲突、校验失败
- 权限：学生只能操作自己小组，老师/助教可查看课程内小组

### 3.2 Socket（实时）

适用：

- 小组新讨论消息推送
- 小组任务状态变化推送
- 阶段提交状态变化推送
- 教师反馈和评分完成提醒
- 老师看板的待评价/延期/风险提示
- 在线状态、心跳和连接健康

必须约定：

- 连接鉴权：JWT 握手校验
- 房间模型：
  - course:{courseId}
  - group:{groupId}
  - assignment:{assignmentId}
  - stage:{stageId}
- 心跳保活：服务端 ping/pong 或业务心跳
- 断线重连：客户端指数退避
- 事件去重：eventId 幂等消费

### 3.3 Worker（异步）

适用：

- 文件上传后处理
- 通知汇总与提醒
- 后续 GitHub commit / CI 结果同步
- 后续 AI 周报、AI 评语、RAG 索引

建议事件示例：

- submission.created
- submission.file.uploaded
- review.created
- grade.updated
- github.sync.requested
- ai.weekly-summary.requested

## 4. RAG 与 AI 后续预留

建议先留三个能力接口：

1. 材料处理入口
- 输入：submissionId 或 fileId
- 输出：处理状态（pending/processing/done/failed）

2. 课程知识检索接口占位
- 输入：query、courseId、groupId?
- 输出：空结果或 mock 结构

3. AI 助教接口占位
- 输入：courseId、groupId、stageId、summaryType
- 输出：周报草稿、风险摘要或评语草稿

这样未来接入向量库或大模型时，前后端协议不用大改。

## 5. 扩展问题

### 5.1 是否需要上消息队列

触发条件：

- 文件处理、通知、AI 总结互相阻塞
- GitHub/CI 同步需要失败重试
- 老师看板需要异步汇总统计

建议：

- MVP 先用 Redis 队列或轻量任务队列
- 演示阶段只需要稳定完成核心链路

### 5.2 是否需要多实例 Socket

触发条件：

- 单实例连接数压力大
- 需要横向扩容

建议：

- 预留 Redis Adapter
- 会话与房间状态不要只放进程内存

### 5.3 数据一致性风险

常见问题：

- HTTP 写成功但 Socket 推送失败
- 异步任务重复执行
- 老师看板统计与最新提交短暂不一致

建议：

- 采用 outbox 思路或可靠事件记录
- 每个事件带唯一业务 ID，消费端去重
- 前端通过历史拉取 + 增量事件修正最终状态

## 6. 新手可直接使用的“向 AI 提需求”模板

请把需求写成下面结构：

1. 目标
- 我要实现什么功能（例如：阶段提交 + 教师待评价提醒）

2. 现状
- 我已有哪些模块（auth、course、group、assignment、submission、grading、collaboration）
- 技术栈是什么

3. 业务时效
- 哪些需要实时（秒级）
- 哪些允许延迟（分钟级）

4. 约束
- 开发周期
- 团队经验
- 成本优先或性能优先

5. 期望输出
- 通信方案结论（HTTP/Socket/Worker 分别做什么）
- 接口草案
- 风险点与回滚方案
- 本周可执行任务清单

## 7. 示例提问（可直接复制）

请基于当前 Linksee 架构，设计“阶段提交 + 教师待评价提醒”的通信方案。

已知：

- 前端 Vue 3 + TS，后端 Node.js，数据库 MySQL + Prisma，实时计划用 Socket.io
- 目前规划模块：auth、course、group、assignment、collaboration、submission、grading、worker
- GitHub commit 导入和 AI 助教暂不实现，但要保留后续接入能力

请输出：

1. 这个需求里 HTTP、Socket、Worker 分别承担什么
2. 需要新增的 6 到 10 个事件定义（名字、触发时机、关键字段）
3. 鉴权和权限校验放在哪一层
4. 失败重试与降级策略
5. 按后端/前端/测试拆分的一周开发计划

## 8. 推荐的当前决策

建议现在就确定：

1. MVP 使用 HTTP + Socket + 轻量 Worker 三层通信。
2. GitHub 自动同步、AI 助教和 RAG 只做接口与任务链路预留。
3. 所有新增功能先判定实时等级，再决定通信方式。
4. 两个月内优先完成“老师发布阶段要求 -> 小组协作 -> 小组提交 -> 老师评价反馈”的闭环。
