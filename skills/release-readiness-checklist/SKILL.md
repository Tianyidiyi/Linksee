---
name: release-readiness-checklist
description: '执行发版前就绪检查和发布后观察。用于 Sprint 发布、紧急修复、数据库迁移上线。关键词: release, checklist, rollback, migration, monitoring.'
---

# Release Readiness Checklist

## When to Use This Skill

- Sprint 结束发版
- 紧急修复上线
- 涉及配置或数据库迁移的发布

## Prerequisites

- 已整理发布范围与变更清单
- 已准备数据库与配置变更说明

## Step-by-Step Workflows

1. 检查代码与分支状态。
2. 检查质量门禁是否全部通过。
3. 检查配置、密钥、迁移与备份方案。
4. 确认灰度策略与回滚路径。
5. 发布后观察核心指标并形成记录。

## References

- [references/release-checklist.md](references/release-checklist.md)
- [infra/README.md](../../infra/README.md)
