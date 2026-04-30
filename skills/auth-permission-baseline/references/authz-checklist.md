# 鉴权与权限基线检查清单

## 执行步骤

1. 明确身份认证方案和 token 生命周期。
2. 明确授权模型：角色、资源、操作，并对齐 [API 权限矩阵](../../../docs/api/contracts/communication-contract-v1.md#7-权限约定)。
3. 每个 API 先写权限断言，再实现业务逻辑。
4. 对输入参数做白名单校验。
5. 敏感操作写审计日志并脱敏。

## Linksee 权限对象

角色：

- academic：教务或课程监管角色。
- teacher：课程负责人。
- assistant：助教，必须绑定授权课程范围。
- student：学生，只能访问自己课程与小组相关资源。

核心资源：

- Course
- Class / roster
- Assignment
- Stage
- Group
- MiniTask
- Group Message
- Submission
- Review
- Grade
- Dashboard

## 检查清单

- [ ] 未登录请求被拒绝
- [ ] 越权访问被拒绝
- [ ] token 过期与刷新策略清晰
- [ ] 日志无密码、token、隐私数据明文
- [ ] 权限相关用例覆盖正反两种路径
- [ ] 学生只能提交自己所在 Group 的 Submission
- [ ] 学生不能创建、修改或删除 Review / Grade
- [ ] 助教只能操作授权 Course 内的 Review 和建议分数，不能最终发布 Grade
- [ ] 老师只能管理自己负责 Course 下的 Assignment / Stage / Group / Submission / Review / Grade
- [ ] Grade 发布、Grade 修改、Review 修改、强制调组等敏感操作已写审计日志

## 常见反例

- 在前端做权限判断，后端不校验
- 用角色名硬编码权限逻辑
- 错误日志输出完整请求体与敏感字段
- 只校验角色，不校验资源归属，例如学生传入其他小组的 groupId 仍可提交
- 助教账号未绑定课程范围，导致跨课程查看或批改
