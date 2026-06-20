---
name: design-md-ui-workflow
description: '基于 DESIGN.md 快速落地一致的 UI 风格。用于新页面设计实现、视觉重构、组件主题统一。关键词: DESIGN.md, 设计变量, 主题映射, 组件复用, 响应式.'
---

# DESIGN.md UI Workflow

## When to Use This Skill

- 新页面从 0 到 1 的视觉和交互实现
- 现有页面风格不一致，需要统一
- 需要复用现有 UI 参考库

## Prerequisites

- 已明确页面目标、核心模块与主要交互
- 已选定 1 到 2 个 UI 参考风格

## Step-by-Step Workflows

1. 在 [docs/参考资料/UI设计参考](../../docs/参考资料/UI设计参考/) 选择 1 到 2 个风格基线。
2. 提取色板、字体、间距、圆角、阴影与动效节奏。
3. 映射到 [apps/web](../../apps/web/) 的页面样式和组件层。
4. 对齐 Linksee 关键页面：登录/注册、老师看板、学生小组空间、提交台、批改台、助教检查台。
5. 优先复用组件，不在业务页面散落样式。
6. 检查移动端可用性并完成 PR 说明。

## Suggested Design References

- 首选组合：[Notion](../../docs/参考资料/UI设计参考/DESIGN-notion.md) + [Vercel](../../docs/参考资料/UI设计参考/DESIGN-vercel.md)
- 备选企业专业型：[IBM](../../docs/参考资料/UI设计参考/DESIGN-ibm.md)
- 备选活力型：[Spotify](../../docs/参考资料/UI设计参考/DESIGN-spotify.md)

## References

- [references/design-mapping-checklist.md](references/design-mapping-checklist.md)
- [UI设计参考-全量审查总结.md](../../docs/参考资料/UI设计参考/UI设计参考-全量审查总结.md)
