# Skills 规范参考来源

本目录技能结构参考以下 GitHub 开源项目与公开规范：

## 主要参考

- GitHub Awesome Copilot
  - 仓库: https://github.com/github/awesome-copilot
  - 参考点: skills 目录结构、SKILL.md frontmatter、description 触发词写法、验证清单
- Agent Skills 规范
  - 规范站点: https://agentskills.io/specification

## 对齐原则

1. 每个技能独立目录，包含 SKILL.md。
2. frontmatter 至少包含 name 与 description。
3. name 使用小写连字符，且与目录名一致。
4. description 同时描述 WHAT + WHEN，并包含可检索关键词。
5. 正文优先采用通用章节：
   - When to Use This Skill
   - Prerequisites
   - Step-by-Step Workflows
   - References
6. 需要更多上下文时使用 references、templates、scripts、assets 子目录。

## 项目内落地路径

- 统一使用 skills/ 作为技能目录
- 细化说明使用每个技能目录下的 references/
