# docs/api 目录说明

| 子目录 | 存放内容 |
|--------|---------|
| `auth/` | 认证与鉴权设计：登录、改密、token 生命周期、RBAC 权限表、数据表结构 |
| `contracts/` | 通信契约：HTTP 接口契约、Socket 事件契约、错误码规范 |

## 当前入口

- [认证与鉴权设计 v1](auth/auth-design-v1.md)
- [HTTP + Socket + Worker 通信契约 v1](contracts/communication-contract-v1.md)

## 新增文档命名规范

```
{模块}-{类型}-v{版本}.md
例：auth-design-v1.md / assignment-contract-v1.md / review-contract-v1.md
```
