# Skills 使用流程（开发到测试到发布）

本文定义团队在日常迭代中如何使用 skills。

## 标准流程

1. 需求分析阶段
- 使用 architecture-review 明确服务边界与职责。
- 输出：边界结论和风险清单。

2. 方案设计阶段
- 使用 api-contract-first 定义接口契约与兼容策略。
- 使用 design-md-ui-workflow 统一页面视觉与组件映射。
- 输出：接口契约文档、UI 变量映射说明。

3. 开发实施阶段
- 按契约编码，优先复用组件。
- 涉及权限逻辑时使用 auth-permission-baseline 做实现前检查。
- 输出：实现代码与自检记录。

4. 测试与回归阶段
- 使用 layered-testing-strategy 规划 unit/integration/e2e 测试矩阵。
- 输出：测试覆盖矩阵与 CI 阻断规则。

5. 发布与观测阶段
- 使用 release-readiness-checklist 完成发布前检查和发布后观测。
- 输出：发版检查记录与回滚预案。

## 一次完整示例（任务评论功能）

场景：新增任务评论功能（含评论列表、发送评论、权限控制）。

1. 架构
- 调用 architecture-review，确认评论归属 services/project-task，禁止 chat 服务直接写评论表。

2. 契约
- 调用 api-contract-first，定义：
  - POST /tasks/{taskId}/comments
  - GET /tasks/{taskId}/comments
  - 错误码：未登录、无权限、任务不存在

3. UI
- 调用 design-md-ui-workflow，选定 docs/UI设计参考/awesome-design-md/design-md/notion 与 vercel 作为参考。
- 把颜色、间距、输入框状态映射到 apps/web 或 packages/ui-kit 主题层。

4. 安全
- 调用 auth-permission-baseline，明确只有任务成员可读写评论。

5. 测试
- 调用 layered-testing-strategy，最小集合：
  - unit：评论长度校验、分页参数校验
  - integration：评论写入与任务权限联合校验
  - e2e：用户在任务详情页发送并看到最新评论

6. 发布
- 调用 release-readiness-checklist，确认迁移脚本、回滚脚本、监控指标后上线。

## 最小执行要求

- 每个 PR 至少引用一个技能。
- 跨服务改动至少使用 architecture-review + api-contract-first。
- 上线改动必须附 release-readiness-checklist 的结果。
