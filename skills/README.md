# Project Skills (Official-Compatible)

本目录采用官方 Agent Skills 结构，可被支持 SKILL.md 的 Agent 自动发现与按需加载。

## 结构说明

- 每个技能目录必须包含 `SKILL.md`
- `SKILL.md` 使用 YAML frontmatter，name 必须与目录名一致
- description 需包含触发关键词，便于 Agent 检索

## 当前技能

- [architecture-review](architecture-review/)
- [api-contract-first](api-contract-first/)
- [design-md-ui-workflow](design-md-ui-workflow/)
- [layered-testing-strategy](layered-testing-strategy/)
- [auth-permission-baseline](auth-permission-baseline/)
- [release-readiness-checklist](release-readiness-checklist/)

## 使用方式

- 开发测试发布全流程示例：[USAGE-FLOW.md](USAGE-FLOW.md)

## 规范来源

- 规范来源说明：[SPEC-REFERENCES.md](SPEC-REFERENCES.md)

## 核心工程规则（新增）

- 修错优先：发现错误接口或错误实现时，优先修正该接口/实现本身，不通过外围补丁长期绕过。
- 最小重写：仅重写错误最小闭环（函数/接口/模块边界），避免扩大变更面。
- 风险先报：若先修主路径会带来联动风险，先提交影响报告再执行改造。
- 兼容有期限：确需兼容层时必须标注退役条件与截止时间，不允许无限期保留。

## 内容组织建议

- `SKILL.md`：触发条件与主流程
- references/：详细清单、矩阵、反例与扩展说明
