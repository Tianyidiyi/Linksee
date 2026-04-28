---
name: architecture-review
description: '评审服务边界与系统职责划分。用于新增服务、模块拆分、跨服务耦合治理、架构评审前检查。关键词: 服务边界, 领域划分, 数据所有权, 跨服务调用, 降级策略.'
---

# Architecture Review

## When to Use This Skill

- 新增或拆分 services 下的领域服务
- 出现跨服务耦合、职责冲突、接口边界不清
- 架构评审前需要标准化检查

## Prerequisites

- 已明确本次变更涉及的服务目录与业务链路
- 已识别核心实体与跨服务依赖

## Step-by-Step Workflows

1. 列出本次变更涉及的服务与主实体。
2. 核对单一职责与数据所有权。
3. 对已识别错误接口执行“修错优先”，避免以补丁长期绕过。
4. 检查跨服务交互是否仅通过 API 或事件。
5. 核查失败策略：超时、重试、降级、回滚。
6. 如先修主路径有联动风险，先产出影响报告再实施。
7. 产出边界结论与风险列表，并同步到架构文档。

## Output Format

- 服务边界结论：职责、数据所有权、调用边界
- 风险与整改项：按高/中/低优先级排序

## References

- [references/service-boundary-checklist.md](references/service-boundary-checklist.md)
- [references/fix-first-risk-report-template.md](references/fix-first-risk-report-template.md)
- [docs/README.md](../../docs/README.md)
