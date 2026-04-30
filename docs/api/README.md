# docs/api 目录说明

| 子目录 | 存放内容 |
|--------|---------|
| `auth/` | 认证与鉴权设计：登录、改密、token 生命周期、RBAC 权限表、数据表结构 |
| `contracts/` | 通信契约：HTTP 接口契约、Socket 事件契约、错误码规范 |
| `openapi/` | 机器可读 API schema：OpenAPI YAML、后续可接 Swagger UI / Redoc |

## 当前入口

- [认证与鉴权设计 v2](auth/auth-design-v2.md)
- [HTTP + Socket + Worker 通信契约 v1](contracts/communication-contract-v1.md)
- [OpenAPI schema v1](openapi/linksee-v1.yaml)
- [前后端联调记录模板](frontend-backend-integration-record-template.md)

## 新增文档命名规范

```
{模块}-{类型}-v{版本}.md
例：auth-design-v2.md / assignment-contract-v1.md / review-contract-v1.md
```
