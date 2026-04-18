# docs

此目录存放项目文档，保证需求、设计、实现一致。

## 子目录

- architecture：架构图、模块边界、演进计划
- api：接口契约、错误码、版本说明
- sprints：Sprint 计划、评审与复盘记录

## 推荐先读

- architecture/communication-design-mvp.md：MVP 通信架构与 RAG 预留策略
- architecture/communication-governance.md：通信治理硬规则与 PR 审查清单
- architecture/communication-decision-template.md：需求开发前通信决策表模板
- architecture/engineering-flow-mvp.md：客户端/服务端、本地测试、构建打包流程
- api/communication-contract-v1.md：HTTP + Socket + Worker 通信契约
- architecture/current-architecture-status.md：当前架构状态与下一步落地建议
- architecture/skills-prompt-template-communication.md：通信需求的 skills 提问模板
- architecture/newcomer-install-and-daily-commands.md：新人首次安装与日常命令清单

## 与 skills 库协同

- skills/architecture-review 与 docs/architecture 对齐
- skills/api-contract-first 与 docs/api 对齐
- skills/release-readiness-checklist 与 docs/sprints 对齐
- skills/design-md-ui-workflow 结合 docs/UI设计参考/awesome-design-md 统一 UI 落地方式

## 文档要求

- 文档与代码同 Sprint 演进
- 需求变更必须更新 API 与架构说明
- 每次发版补充变更说明与迁移指引
