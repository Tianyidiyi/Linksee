# Skills 使用流程（开发到测试到发布）

本文定义团队在日常迭代中如何使用 skills。

## 标准流程

1. 需求分析阶段
- 使用 [architecture-review](architecture-review/) 明确服务边界与职责。
- 输出：边界结论和风险清单。

2. 方案设计阶段
- 使用 [api-contract-first](api-contract-first/) 定义接口契约与兼容策略。
- 同步维护 [OpenAPI schema](../docs/api/openapi/linksee-v1.yaml)，并在联调后填写 [前后端联调记录模板](../docs/api/frontend-backend-integration-record-template.md)。
- 使用 [design-md-ui-workflow](design-md-ui-workflow/) 统一页面视觉与组件映射。
- 输出：接口契约文档、OpenAPI schema、联调记录、UI 变量映射说明。

3. 开发实施阶段
- 按契约编码，优先复用组件。
- 涉及权限逻辑时使用 [auth-permission-baseline](auth-permission-baseline/) 做实现前检查。
- 输出：实现代码与自检记录。

4. 测试与回归阶段
- 使用 [layered-testing-strategy](layered-testing-strategy/) 规划 unit/integration/e2e 测试矩阵。
- 输出：测试覆盖矩阵与 CI 阻断规则。

5. 发布与观测阶段
- 使用 [release-readiness-checklist](release-readiness-checklist/) 完成发布前检查和发布后观测。
- 输出：发版检查记录与回滚预案。

## 一次完整示例（阶段提交与反馈功能）

场景：新增课程项目阶段提交功能（含提交材料、教师反馈、状态变更、权限控制）。

1. 架构
- 调用 [architecture-review](architecture-review/)，确认阶段提交归属 `services/submission`，评分反馈归属 `services/grading`，禁止协作讨论模块直接写提交和评分表。

2. 契约
- 调用 [api-contract-first](api-contract-first/)，定义：
  - POST /api/v1/stages/{stageId}/groups/{groupId}/submissions
  - POST /api/v1/submissions/{submissionId}/reviews
  - GET /api/v1/courses/{courseId}/dashboard
  - 错误码：未登录、无权限、阶段不存在、小组不存在、重复提交
- 同步更新 [OpenAPI schema](../docs/api/openapi/linksee-v1.yaml)。
- 联调后填写 [前后端联调记录模板](../docs/api/frontend-backend-integration-record-template.md)，记录成功路径、失败路径、字段偏差和权限验证结论。

3. UI
- 调用 [design-md-ui-workflow](design-md-ui-workflow/)，选定 [Notion](../docs/UI设计参考/awesome-design-md/design-md/notion/) 与 [Vercel](../docs/UI设计参考/awesome-design-md/design-md/vercel/) 作为参考。
- 把颜色、间距、输入框状态映射到 [apps/web](../apps/web/) 或 `packages/ui-kit` 主题层。

4. 安全
- 调用 [auth-permission-baseline](auth-permission-baseline/)，明确学生只能提交自己小组材料，老师和助教只能评价授权课程内的小组。
- 对齐 [API 权限矩阵](../docs/api/contracts/communication-contract-v1.md#7-权限约定)，覆盖 teacher / assistant / student 的正反路径。

5. 测试
- 调用 [layered-testing-strategy](layered-testing-strategy/)，最小集合：
  - unit：提交材料字段校验、Rubric 分数边界校验
  - integration：阶段提交、状态流转、教师反馈与课程权限联合校验
  - e2e：学生提交阶段成果，老师在看板中查看并给出反馈
  - 阻断规则：学生越权提交其他小组成果、学生创建 Review / Grade、助教最终发布 Grade 均必须被拒绝

6. 发布
- 调用 [release-readiness-checklist](release-readiness-checklist/)，确认迁移脚本、回滚脚本、监控指标后上线。

## 最小执行要求

- 每个 PR 至少引用一个技能。
- 跨服务改动至少使用 [architecture-review](architecture-review/) + [api-contract-first](api-contract-first/)。
- 上线改动必须附 [release-readiness-checklist](release-readiness-checklist/) 的结果。
