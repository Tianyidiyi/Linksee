# packages

此目录存放跨应用共享的代码，减少重复实现。

## 子目录

- [shared-types](shared-types/)：前后端共享类型定义占位
- [shared-utils](shared-utils/)：无状态工具函数占位
- [ui-kit](ui-kit/)：可复用 UI 组件与样式规范占位

## 设计原则

- 只放通用能力，不放具体业务流程
- 保持向后兼容，避免频繁破坏性修改
- 对外暴露清晰 API，避免深层依赖
