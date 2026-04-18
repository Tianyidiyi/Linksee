# 云端团队协作平台 - 项目总体架构

本仓库采用 Monorepo 结构，目标是支持敏捷迭代、每个 Sprint 可发布、代码长期可维护。

## 一、架构目标

- 先做 MVP：任务管理 + 即时通讯 + 文档中心
- 再做增强：RAG 检索问答、AI 站会助手
- 业务主线：Team -> Project -> Task
- 工程主线：高内聚、低耦合、模块化单体优先

## 二、技术选型建议

- 前端：Vue 3 + TypeScript + Pinia + Element Plus
- 后端：Node.js + Express 或 NestJS
- 数据库：MySQL 8 + Prisma
- 缓存与实时：Redis + Socket.io
- 文档与检索：对象存储 + 向量检索服务

## 三、目录导览

- apps：应用入口（前端、后端、异步 Worker）
- packages：共享代码（类型、工具、UI）
- skills：项目技能库（官方 Agent Skills 结构）
- services：领域服务边界（Auth/Team/Task/Chat/Docs 等）
- tests：测试分层（unit/integration/e2e）
- infra：基础设施（容器、CI/CD、监控）
- docs：架构文档、接口文档、Sprint 文档
- scripts：自动化脚本（初始化、迁移、发布）

## 四、开发约定

- 分支策略：主干开发 + 短分支
- 提交流程：小步提交、Code Review 后合并
- API 先契约：先维护 OpenAPI，再并行开发
- 发布策略：每个 Sprint 结束产出可发布版本
- 质量门禁：Lint + Unit Test + 关键集成测试

## 五、下一步推荐

1. 在 apps/api 中初始化后端框架并接入 Prisma
2. 在 apps/web 中初始化前端框架并接入 API SDK
3. 在 docs/api 中定义 v1 核心接口
4. 在 tests 中补齐最小回归用例

## 六、技能库入口

- 官方技能入口：skills/README.md
- 全流程使用说明：skills/USAGE-FLOW.md
- UI 设计落地技能：skills/design-md-ui-workflow/SKILL.md
- UI 参考素材库：docs/UI设计参考/awesome-design-md/

## 七、通信与工程流程入口

- 通信架构基线：docs/architecture/communication-design-mvp.md
- 通信治理规范：docs/architecture/communication-governance.md
- 通信决策模板：docs/architecture/communication-decision-template.md
- 工程流程（测试/构建/打包）：docs/architecture/engineering-flow-mvp.md
- 通信契约：docs/api/communication-contract-v1.md

## 八、构建与打包入口

- 本地与 CI 构建打包流程：infra/ci-cd/build-package-flow.md
- 根命令：npm run build / npm run pack:apps / npm run verify:build
