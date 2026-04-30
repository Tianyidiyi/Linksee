# docs

此目录存放项目文档，保证需求、设计、实现一致。

## 子目录

- [product](product/)：产品定位、用户场景、MVP 范围、商业说明
- [architecture](architecture/)：架构图、模块边界、演进计划
- [api](api/)：接口契约、错误码、版本说明
- [sprints](sprints/)：Sprint 计划、评审与复盘记录

## 推荐先读

- [教学项目协作与过程评价平台产品大纲](product/teaching-collaboration-outline.md)
- [课程场景与需求整理](product/course-scenario-requirements-v2.md)
- [五人团队两个月开发分工与进度计划](product/two-month-team-plan.md)
- [MVP P0 任务与后续跟进任务](product/mvp-p0-and-follow-up-tasks.md)
- [当前架构状态与下一步落地建议](architecture/current-architecture-status.md)
- [MVP 通信架构与 RAG 预留策略](architecture/communication-design-mvp.md)
- [通信治理硬规则与 PR 审查清单](architecture/communication-governance.md)
- [需求开发前通信决策表模板](architecture/communication-decision-template.md)
- [客户端/服务端、本地测试、构建打包流程](architecture/engineering-flow-mvp.md)
- [HTTP + Socket + Worker 通信契约](api/contracts/communication-contract-v1.md)
- [通信需求的 skills 提问模板](architecture/skills-prompt-template-communication.md)
- [新人首次安装与日常命令清单](architecture/首次安装步骤与日常命令清单.md)

## 与 skills 库协同

- [skills/architecture-review](../skills/architecture-review/) 与 [docs/architecture](architecture/) 对齐
- [skills/api-contract-first](../skills/api-contract-first/) 与 [docs/api](api/) 对齐
- [skills/release-readiness-checklist](../skills/release-readiness-checklist/) 与后续 Sprint 文档对齐
- [skills/design-md-ui-workflow](../skills/design-md-ui-workflow/) 结合 [UI 设计参考](UI设计参考/awesome-design-md/) 统一 UI 落地方式

## 文档要求

- 产品定位变更必须同步更新 README 与 product 文档
- 文档与代码同 Sprint 演进
- 需求变更必须更新 API 与架构说明
- 每次发版补充变更说明与迁移指引
