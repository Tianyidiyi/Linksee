# DESIGN.md 映射检查清单

## 执行步骤

1. 从 [docs/UI设计参考/awesome-design-md/design-md](../../../docs/UI设计参考/awesome-design-md/design-md/) 中选择 1 到 2 个风格作为基线。
2. 提取核心设计变量：色板、字体、间距、圆角、阴影、动效节奏。
3. 将变量映射到项目可复用层：`packages/ui-kit` 或 [apps/web](../../../apps/web/) 的主题文件。
4. 明确 Linksee 页面映射：登录/注册、老师看板、学生小组空间、提交台、批改台、助教检查台。
5. 页面实现优先复用组件，不在业务页面硬编码样式。
6. 在 PR 中附上设计来源与映射说明，便于复盘和迭代。

## 推荐起步风格

- 首选组合：极简产品型 [Notion](../../../docs/UI设计参考/awesome-design-md/design-md/notion/README.md) + 技术工具型 [Vercel](../../../docs/UI设计参考/awesome-design-md/design-md/vercel/README.md)
- 备选企业专业型：[IBM](../../../docs/UI设计参考/awesome-design-md/design-md/ibm/README.md)
- 备选活力型：[Spotify](../../../docs/UI设计参考/awesome-design-md/design-md/spotify/README.md)

## Linksee 页面映射清单

| 页面 | 设计重点 |
| --- | --- |
| 登录 / 注册 | 账号密码清晰、注册入口明确、登录后按角色进入工作台 |
| 老师看板 | 快速扫描未提交、待批改、延期、协作不活跃小组 |
| 学生小组空间 | Stage、MiniTask、讨论、文件、仓库链接和提交入口集中呈现 |
| 提交台 | 上传材料、填写链接、贡献说明、提交状态明确 |
| 批改台 | 提交物预览、Review、Rubric、状态更新放在同一工作流 |
| 助教检查台 | 待检查、材料缺失、需复核和已处理记录可快速筛选 |

## 检查清单

- [ ] 颜色与字体以变量形式管理
- [ ] 组件状态齐全：default、hover、active、disabled
- [ ] 移动端可用，关键断点已验证
- [ ] 页面动效有节奏且不过度
- [ ] 无明显视觉漂移或风格混搭
- [ ] 页面没有做成营销落地页，首屏直接服务核心任务
- [ ] 老师、学生、助教三类角色的主路径入口清楚
