# Skills 提问模板（教学协作通信需求）

适用场景：

- 你是后端或架构负责人，需要 AI 给出可落地通信方案
- 需求涉及 HTTP、Socket、异步 Worker 的取舍
- 目标是先保两个月 MVP，再考虑 GitHub/AI/RAG 扩展

## 1. 如何使用（建议流程）

1. 先选 skills
- architecture-review
- api-contract-first
- layered-testing-strategy
- release-readiness-checklist

2. 再发结构化提问
- 不要只说“帮我设计通信”
- 要写清教学角色、业务目标、实时性、权限与期望输出

3. 输出后做二次确认
- 要求 AI 给出风险、降级、回滚、测试门禁

## 2. 可复制模板（通信需求）

标题：请基于 skills 设计本教学协作需求的通信方案

项目背景：
- 项目：Linksee 教学项目协作与过程评价平台
- 当前阶段：MVP
- 技术栈：Vue 3 + TypeScript，Node.js，MySQL + Prisma，Redis + Socket.io
- GitHub/AI/RAG 状态：当前非必做，仅预留扩展能力

本次需求：
- 功能名称：
- 用户场景：
- 业务目标：
- 涉及角色：teacher / student / assistant

现状与边界：
- 已有或规划模块：auth, course, group, assignment, collaboration, submission, grading, worker
- 本次涉及模块：
- 是否改数据库：是/否
- 是否要求秒级实时：是/否

约束条件：
- 交付周期：
- 团队经验：偏课程项目经验
- 优先级：稳定性优先 / 开发速度优先

请你输出：
1. 通信分层结论
- 哪些走 HTTP
- 哪些走 Socket
- 哪些走 Worker

2. 契约草案
- HTTP 接口列表（方法、路径、关键字段、错误码）
- Socket 事件列表（事件名、payload、房间模型、鉴权方式）
- Worker 事件列表（入队条件、重试、失败处理）

3. 一致性与安全
- 幂等策略
- 角色权限校验点
- 失败降级策略
- 回滚方案

4. 测试与发布
- unit/integration/e2e 最小用例
- 发布前检查项
- 监控与告警建议

5. 一周开发计划
- 按后端、前端、测试分别拆分任务

## 3. 可复制模板（短版）

请你以后端视角给我一份 Linksee MVP 可落地通信方案。

需求：
- 功能：
- 涉及角色：
- 改库：
- 实时性要求：

请基于以下 skills 输出：
- architecture-review
- api-contract-first
- layered-testing-strategy

输出要求：
- 先给结论，再给接口与事件清单
- 必须包含权限、幂等、失败降级
- 给出本周可执行任务拆分

## 4. 质量自检清单

在发送给 AI 前，先确认：

- [ ] 写清楚了功能目标
- [ ] 标明了涉及老师、学生还是助教
- [ ] 标明了是否改数据库
- [ ] 标明了是否需要秒级实时
- [ ] 写清楚了交付周期与团队约束
- [ ] 指定了希望 AI 产出的格式
