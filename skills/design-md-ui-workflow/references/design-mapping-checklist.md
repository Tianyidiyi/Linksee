# DESIGN.md 映射检查清单

## 执行步骤

1. 从 docs/UI设计参考/awesome-design-md/design-md 中选择 1 到 2 个风格作为基线。
2. 提取核心设计变量：色板、字体、间距、圆角、阴影、动效节奏。
3. 将变量映射到项目可复用层：packages/ui-kit 或 apps/web 的主题文件。
4. 页面实现优先复用组件，不在业务页面硬编码样式。
5. 在 PR 中附上设计来源与映射说明，便于复盘和迭代。

## 推荐起步风格

- 企业专业型：docs/UI设计参考/awesome-design-md/design-md/ibm/README.md
- 极简产品型：docs/UI设计参考/awesome-design-md/design-md/notion/README.md
- 技术工具型：docs/UI设计参考/awesome-design-md/design-md/vercel/README.md
- 活力营销型：docs/UI设计参考/awesome-design-md/design-md/spotify/README.md

## 检查清单

- [ ] 颜色与字体以变量形式管理
- [ ] 组件状态齐全：default、hover、active、disabled
- [ ] 移动端可用，关键断点已验证
- [ ] 页面动效有节奏且不过度
- [ ] 无明显视觉漂移或风格混搭
