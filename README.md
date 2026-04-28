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
