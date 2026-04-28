---
name: layered-testing-strategy
description: '制定 unit, integration, e2e 分层测试策略并形成质量门禁。用于迭代测试范围规划、回归治理、CI 阻断规则设置。关键词: 测试矩阵, 质量门禁, 回归, CI.'
---

# Layered Testing Strategy

## When to Use This Skill

- 规划版本测试范围
- 线上回归后补齐测试防线
- 需要明确 CI 阻断条件

## Prerequisites

- 已识别本次迭代核心变更点
- 已确认关键业务链路与高风险模块

## Step-by-Step Workflows

1. 识别本次变更点与风险等级。
2. 对“修错优先”变更补齐迁移测试，禁止仅补丁不校验。
3. 映射到 unit、integration、e2e 三层测试。
4. 定义每层最小必测集合。
5. 设置 CI 通过阈值与阻断策略。
6. 汇总测试结论并沉淀可复用用例。

## References

- [references/test-matrix.md](references/test-matrix.md)
- [references/fix-first-test-gate.md](references/fix-first-test-gate.md)
- [tests/README.md](../../tests/README.md)
