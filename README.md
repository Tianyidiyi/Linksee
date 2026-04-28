# Linksee - 教学项目协作与过程评价平台

Linksee 是面向高校课程项目、小组作业、实训课程和毕业设计过程管理的云端协作平台。它的目标不是再做一个普通线上提交系统，而是让学生小组真正在线协作完成项目，同时帮助老师实时看见协作过程、项目进度、代码贡献、文件提交、讨论记录和评分依据。

一句话定位：

> Linksee 让学生协作有空间，让老师评价有依据。

## 一、项目背景

在课程项目和小组作业中，老师通常只能在期末通过报告、PPT、压缩包或代码仓库评价最终成果。项目推进过程往往分散在微信群、网盘、GitHub、Excel、邮件和课堂汇报里，导致老师难以及时发现延期、跑偏、搭便车和材料缺失等问题。

Linksee 希望把小组项目从“期末交一个结果”变成“全过程协作、全过程可见、全过程可评价”：

- 学生在小组空间内协作写代码、拆任务、聊天讨论、传输文件、提交阶段成果。
- 老师实时查看各小组进度、风险、提交状态和贡献差异。
- 助教协助检查材料、测试结果和互评记录。
- 系统沉淀过程证据，用于形成更公平的过程性评价。

## 二、核心用户

- 老师：发布项目任务、追踪进度、评价阶段成果、给出最终成绩。
- 学生：小组协作、代码项目推进、文件共享、提交成果、记录个人贡献、接收反馈。
- 助教：辅助检查提交物、测试结果、互评记录和评分材料。
- 教务或学院：查看课程项目开展情况和过程性评价依据。

## 三、核心场景

1. 老师创建课程项目，并设置阶段里程碑。
2. 学生加入小组，围绕阶段任务协作。
3. 小组在平台内拆解任务、讨论问题、传输文件、关联代码仓库。
4. 小组提交报告、PPT、代码包、演示视频、仓库链接或测试结果。
5. 老师在班级总览中查看未提交、延期、风险、讨论活跃度和贡献异常。
6. 老师按 Rubric 评价阶段成果，并留下反馈。
7. 学生根据反馈继续协作迭代。
8. 期末系统汇总提交记录、代码贡献、讨论记录、互评结果、测试结果和教师评分。

## 四、MVP 功能范围

第一版建议聚焦“提交、追踪、评价”三件事。

### 1. 课程与小组

- 创建课程空间
- 创建项目作业
- 创建或导入学生小组
- 设置老师、助教、学生角色

### 2. 阶段任务与提交

- 设置阶段里程碑：选题、需求、设计、实现、测试、答辩
- 每个阶段支持提交文件、链接和说明
- 支持提交状态：未提交、已提交、需修改、已通过
- 支持截止时间和延期标记

### 3. 小组协作空间

- 小组任务看板：待办、进行中、已完成
- 小组讨论与教师反馈
- 文件传输与材料归档
- 代码仓库链接与提交记录汇总
- 小组动态时间线

### 4. 老师追踪看板

- 班级总览：所有小组进度
- 待评价列表：已提交但未评分
- 风险列表：延期、长期无进展、贡献异常
- 小组详情：任务、提交物、讨论、文件、代码贡献、反馈、评分记录

### 5. 过程评价

- Rubric 评分表
- 阶段评分与最终评分
- 组内互评
- 个人贡献记录
- 评分说明与教师评语

### 6. 测试与验收

- 支持上传软件包、报告、PPT、演示视频和仓库链接
- 支持记录测试用例、测试结果和验收状态
- 后续可接入 GitHub Actions、GitLab CI 或本地测试脚本

### 7. AI 助教增强

- 自动生成小组周报
- 自动总结阶段提交内容
- 自动提醒风险小组
- 生成教师评语草稿
- 基于课程资料和提交材料进行问答

## 五、与现有工具的区别

Linksee 不直接替代飞书、学习通或 GitHub Classroom，而是补齐课程项目过程管理中的空白。

| 工具 | 擅长 | Linksee 的差异 |
| --- | --- | --- |
| 飞书/钉钉 | 日常沟通、文档协作 | 不围绕课程评分和过程评价设计 |
| 学习通/雨课堂 | 作业发布、课程管理 | 对小组项目过程追踪较弱 |
| GitHub Classroom | 代码作业、仓库分发、自动测试 | 不覆盖小组聊天、文件协作、非代码材料、互评、Rubric 和教学看板 |
| Excel/网盘 | 灵活记录、文件存储 | 需要老师人工整理，证据分散 |

Linksee 的重点是：

> GitHub Classroom 偏代码仓库，学习通偏作业提交，飞书偏沟通协作；Linksee 把小组协作、代码贡献、文件提交、教师追踪和评分评价放进同一个课程项目空间。

## 六、系统架构

本仓库仍采用 Monorepo 结构，支持前后端、异步任务和共享代码统一管理。

- [apps](apps/)：应用入口（前端、后端、异步 Worker）
- [packages](packages/)：共享代码（类型、工具、UI）
- [services](services/)：领域服务边界（Auth/Course/Group/Task/Submission/Review/Grade 等）
- [docs](docs/)：产品文档、架构文档、接口文档、Sprint 文档
- [tests](tests/)：测试分层（unit/integration/e2e）
- [infra](infra/)：基础设施（容器、CI/CD、监控）
- [scripts](scripts/)：自动化脚本（初始化、迁移、发布）

## 七、技术选型建议

- 前端：Vue 3 + TypeScript + Pinia + Element Plus
- 后端：Node.js + Express 或 NestJS
- 数据库：MySQL 8 + Prisma
- 缓存与实时：Redis + Socket.io
- 文档与检索：对象存储 + 向量检索服务
- 测试集成：GitHub Actions / GitLab CI / 本地脚本任务

## 八、开发约定

- 产品先行：先明确课程场景、用户角色和评分流程。
- API 先契约：先维护接口文档，再并行开发。
- 小步交付：每个 Sprint 完成一条可演示链路。
- 质量门禁：Lint + Unit Test + 关键集成测试。
- 数据可追溯：提交、反馈、评分和互评都要保留记录。

## 九、下一步推荐

1. 确认产品大纲：[docs/product/teaching-collaboration-outline.md](docs/product/teaching-collaboration-outline.md)。
2. 将现有 Team/Project/Task 概念映射为 Course/Group/Assignment/Stage。
3. 设计老师端“班级追踪看板”和学生端“提交台”。
4. 定义课程、小组、阶段提交、评分 Rubric 的核心数据模型。
5. 完成第一条端到端链路：老师发布阶段任务 -> 小组协作推进 -> 小组提交 -> 老师实时查看并评价。

## 十、文档入口

- [产品大纲](docs/product/teaching-collaboration-outline.md)
- [五人两个月开发计划](docs/product/two-month-team-plan.md)
- [当前架构状态](docs/architecture/current-architecture-status.md)
- [通信架构基线](docs/architecture/communication-design-mvp.md)
- [通信治理规范](docs/architecture/communication-governance.md)
- [工程流程](docs/architecture/engineering-flow-mvp.md)
- [通信契约](docs/api/communication-contract-v1.md)
- [UI 设计参考](docs/UI设计参考/awesome-design-md/)

## 十一、构建与打包入口

- 本地与 CI 构建打包流程：[infra/ci-cd/build-package-flow.md](infra/ci-cd/build-package-flow.md)
- 根命令：npm run build / npm run pack:apps / npm run verify:build

## 十二、通信规范

> 完整规范见 [docs/architecture/communication-governance.md](docs/architecture/communication-governance.md)

### 决策三原则

| 场景 | 通道 |
| --- | --- |
| 改数据（写入、更新、删除） | HTTP |
| 推变化（实时通知页面状态） | Socket |
| 重任务（文件处理、AI、通知汇总） | Worker |

若一个需求同时涉及三者，必须先填写通信决策表再实现。

### 后端规范

1. API 层负责输入校验、权限校验、调用业务层。
2. 业务层写入成功后，生成事件并发布。
3. Socket 层只分发事件，不写业务数据。
4. Worker 层只消费异步事件，不回写跨模块私有表。
5. 学生、老师、助教权限必须在业务层再次校验，不能只依赖前端隐藏入口。

### 前端规范

1. 写请求只调 HTTP。
2. Socket 只用于增量更新页面状态。
3. 本地状态合并顺序：HTTP 确认结果优先，Socket 增量补齐。
4. 事件去重基于 `eventId`。
5. 老师看板必须支持刷新兜底，不能完全依赖 Socket。

### 事件命名

- 格式：`entity.action`，例如 `submission.created`、`review.created`、`group.message.created`
- 包结构必含：`id`、`name`、`occurredAt`、`producer`、`traceId`、`payload`

### 降级策略

- Socket 不可用 → 前端回退到手动刷新或短轮询
- Worker 堵塞 → 任务状态保持 pending，前端显示"处理中"
- 事件重复 → 按 `eventId` 幂等消费
- 看板短暂不一致 → 以 HTTP 查询结果为准

### PR 必过审查清单

- [ ] 写操作未使用 Socket
- [ ] Socket 网关未直接写库
- [ ] 事件命名符合 `entity.action` 规范
- [ ] 角色与权限校验明确
- [ ] 失败重试与降级策略明确
- [ ] 教学语义未退回旧的 team/project-task/feed 命名

## 十三、工程 Skills

> Skills 目录：[skills/](skills/)，使用流程：[skills/USAGE-FLOW.md](skills/USAGE-FLOW.md)

项目内置六个工程 Skill，覆盖从设计到发布的完整链路，供 AI Agent 按需自动加载：

| Skill | 用途 | 触发时机 |
| --- | --- | --- |
| [architecture-review](skills/architecture-review/) | 服务边界与职责审查，输出边界结论和风险清单 | 新增服务或跨模块调用时 |
| [api-contract-first](skills/api-contract-first/) | 接口契约先行定义，兼容策略与错误码规范 | 设计阶段开始前 |
| [design-md-ui-workflow](skills/design-md-ui-workflow/) | UI 设计参考映射，页面组件与主题层对齐 | 前端页面开发前 |
| [auth-permission-baseline](skills/auth-permission-baseline/) | 权限模型校验基线，角色与资源授权自检 | 涉及权限逻辑时 |
| [layered-testing-strategy](skills/layered-testing-strategy/) | 分层测试矩阵，unit/integration/e2e 覆盖规划 | 测试与回归阶段 |
| [release-readiness-checklist](skills/release-readiness-checklist/) | 发布前检查与发布后观测，回滚预案 | 每次发版前 |

### 核心工程规则

- **修错优先**：发现错误接口或错误实现时，优先修正本身，不通过外围补丁长期绕过。
- **最小重写**：仅重写错误最小闭环（函数 / 接口 / 模块边界），避免扩大变更面。
- **风险先报**：若修主路径会带来联动风险，先提交影响报告再执行改造。
- **兼容有期限**：确需兼容层时必须标注退役条件与截止时间，不允许无限期保留。
