# 分层测试策略矩阵

## 执行步骤

1. 识别本次迭代的关键变更点。
2. 将每个变更映射到 unit、integration、e2e 三层。
3. 定义每层最小必测项与失败阈值。
4. 在 CI 中设置阻断策略。

## 建议矩阵

| 测试层 | 关注点 | 位置 | 阻断建议 |
| --- | --- | --- | --- |
| unit | 纯逻辑、边界值、工具函数 | `tests/unit` | 必须阻断 |
| integration | 服务协作、数据库读写、外部依赖 | `tests/integration` | 核心用例阻断 |
| e2e | 用户主链路、关键页面流程 | `tests/e2e` | 主链路阻断 |

## Linksee P0 最小测试集合

| 测试层 | 必测内容 | 示例 |
| --- | --- | --- |
| unit | 字段约束 | Assignment title 长度、Stage dueAt 必填、Submission fileIds 数量上限 |
| unit | 状态流转 | `submitted -> needs_changes -> resubmitted -> approved` |
| unit | 评分边界 | Rubric score 不能小于 0，不能大于 maxScore |
| unit | 权限判断 | student / teacher / assistant / academic 对资源操作的允许与拒绝 |
| integration | 阶段提交 | 学生在自己 Group 下创建 Submission，服务端写入提交人与提交时间 |
| integration | 教师反馈 | teacher / assistant 对授权 Submission 创建 Review 并更新状态 |
| integration | 越权拒绝 | 学生提交其他 Group、学生创建 Review、助教发布 Grade 均被拒绝 |
| integration | 看板聚合 | Course dashboard 返回 pendingReviewCount、overdueCount、inactive |
| e2e | 学生提交与老师反馈闭环 | 学生登录 -> 进入小组 -> 提交成果 -> 老师查看 -> 老师反馈 -> 学生查看反馈 |
| e2e | 助教检查闭环 | 助教登录 -> 查看待评价列表 -> 创建 Review -> 老师确认最终 Grade |

## P0 主链路阻断规则

- 学生提交阶段成果失败，阻断合入。
- 老师或助教无法查看提交并创建 Review，阻断合入。
- 学生越权提交其他 Group 成果未被拒绝，阻断合入。
- 学生可创建或修改 Review / Grade，阻断合入。
- OpenAPI schema 与 Markdown 契约明显不一致，阻断合入。

## 检查清单

- [ ] 新增业务规则有 unit
- [ ] 跨服务调用有 integration
- [ ] 关键用户路径有 e2e
- [ ] 失败用例可稳定复现
- [ ] P0 主链路已覆盖学生提交、老师反馈、学生查看反馈
- [ ] 权限正反路径已覆盖 teacher / assistant / student
