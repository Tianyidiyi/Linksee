---
name: api-contract-first
description: '按契约先行方式交付 API。用于新增接口、字段变更、版本演进、联调准备。关键词: OpenAPI, 错误码, 兼容性, 版本化, 契约测试.'
---

# API Contract First

## When to Use This Skill

- 新增 REST API
- 调整接口字段或语义
- 需要并行前后端开发

## Prerequisites

- 已明确接口归属服务与调用方
- 已整理请求、响应、错误路径

## Step-by-Step Workflows

1. 在 [docs/api](../../docs/api/) 定义接口契约与错误码。
2. 明确字段约束与空值语义。
3. 标注兼容性策略与版本规则。
4. 后端按契约实现并补最小集成测试。
5. 联调完成后回写偏差与结论。

## Output Format

- 契约文档：路径、请求、响应、错误码、版本策略
- 联调结论：偏差清单、修复状态、兼容性结论

## References

- [references/contract-checklist.md](references/contract-checklist.md)
- [docs/README.md](../../docs/README.md)
