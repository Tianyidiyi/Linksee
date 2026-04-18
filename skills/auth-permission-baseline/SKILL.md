---
name: auth-permission-baseline
description: '建立鉴权与授权基线，防止未授权访问与越权。用于新增账号体系、角色权限、敏感接口上线检查。关键词: authentication, authorization, RBAC, 输入校验, 审计日志.'
---

# Auth Permission Baseline

## When to Use This Skill

- 新增登录态或令牌机制
- 新增角色权限与资源访问控制
- 敏感操作接口上线前检查

## Prerequisites

- 已定义角色、资源、操作的基本模型
- 已明确鉴权组件与日志策略

## Step-by-Step Workflows

1. 定义身份认证和 token 生命周期。
2. 定义角色、资源、操作三元关系。
3. 每个接口先写权限断言再写业务逻辑。
4. 执行输入白名单校验和敏感日志脱敏。
5. 覆盖未登录、越权、正常访问三类测试。

## References

- [references/authz-checklist.md](references/authz-checklist.md)
- [services/README.md](../../../services/README.md)
