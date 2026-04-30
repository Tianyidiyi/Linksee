# 鉴权与权限基线设计 v2

> 参照 `skills/auth-permission-baseline`（首选）和 `skills/api-contract-first`（API 契约）产出。  
> 覆盖：登录、改密、刷新 token、权限分离、数据表、密码安全存储。

## 版本说明

本文档是对原 `auth-design-v1.md` 的同步修订版，标题标记为 v2 是为了提醒评审者：这里不是单纯改字，而是将 auth 设计与当前 Linksee 主线文档、Prisma schema 和已存在的登录代码骨架对齐。

本次同步的原因：

- 主线 API 契约、skills 和架构文档已经使用 `teacher / assistant / student / academic` 作为角色枚举，因此将早期 auth 文档中的 `ta` 统一为 `assistant`。
- 当前表结构设计和 Prisma schema 使用一卡通号 `VARCHAR(10)` 作为 `users.id`，不再使用早期 UUID + username 方案。
- 当前 Refresh Token 方案是 Redis 存储，不建 `refresh_tokens` MySQL 表。
- 当前安全日志先用 winston 文件日志落地，不默认创建 `audit_logs` 表。
- 当前 auth 代码返回 `ok/data` 包装结构，本文档的登录、刷新、登出契约按现有代码骨架同步。

如果 auth 负责同学希望恢复某个 v1 决策，应先同步修改 `docs/api/auth/auth-tables-design-v2.md`、`apps/api/prisma/schema.prisma` 和相关 API 契约，避免出现两套事实来源。

---

## 一、对应的 Skill 说明

| 需求 | 使用 Skill |
|------|-----------|
| 登录态/token/角色权限/审计日志 | `auth-permission-baseline` |
| 登录/改密/刷新接口契约 | `api-contract-first` |

auth-permission-baseline 的五步流程本文档逐步落实：  
1. 定义身份认证和 token 生命周期 → §四  
2. 定义角色、资源、操作三元关系 → §二  
3. 每个接口先写权限断言再写业务逻辑 → §五  
4. 执行输入白名单校验和敏感日志脱敏 → §五注意事项  
5. 覆盖未登录、越权、正常访问三类测试 → §六  

---

## 二、角色与权限模型（RBAC）

### 2.1 四类账号身份

| 角色 `role` | 说明 | 账号来源 |
|------------|------|---------|
| `academic`（教务处） | 全局系统管理员，课程/用户管理 | 系统初始化导入 |
| `teacher`（老师） | 课程负责人，创建助教子账号、发最终成绩 | 教务处创建 |
| `assistant`（助教） | 老师创建的子账号，批改权限范围绑定到课程 | 老师创建 |
| `student`（学生） | 可参与多门课程/多个小组 | 教务处批量导入 |

### 2.2 权限三元关系（角色 × 资源 × 操作）

```
角色           资源                       允许的操作
─────────────────────────────────────────────────────────
academic    courses, users, imports    create/read/update/delete
teacher     course_members             read/add/remove
            assistant_accounts         create/update/deactivate
            assignments, stages        create/update/delete
            grades                     publish_final（唯一可发最终成绩方）
            security_logs              read
assistant   submissions                grade/comment（不能发最终成绩）
            minitasks                  read
student     group_slots                join/leave（自组阶段，受规则约束）
            minitasks                  create/update/close（本组内）
            submissions                create（本组内）
```

### 2.3 关键约束

- **助教无法发布最终成绩**，只能登记批改意见（`grade_comment`），老师确认后才变为最终成绩。
- **老师/助教强干预**（加人、改组）不受学生自组阶段人数/截止限制。
- **越权拒绝在后端**，前端仅做 UI 隐藏，后端每个接口独立校验角色。

---

## 三、数据表设计

### 3.1 `users`（核心身份表）

```sql
CREATE TABLE users (
  id            VARCHAR(10)  NOT NULL PRIMARY KEY,  -- 一卡通号，纯10位数字
  password_hash VARCHAR(128) NOT NULL,               -- Argon2id 散列值
  role          ENUM('academic','teacher','assistant','student') NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  force_change_password TINYINT(1) NOT NULL DEFAULT 0, -- 首次登录强制改密
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME     NULL,
  last_seen_at  DATETIME     NULL
);
```

### 3.2 `student_profiles`（学生附加信息）

```sql
CREATE TABLE student_profiles (
  user_id VARCHAR(10) NOT NULL PRIMARY KEY,
  stu_no  VARCHAR(20) NOT NULL UNIQUE,  -- 学号（教务学籍号）
  grade   SMALLINT    NOT NULL,
  cohort  SMALLINT    NOT NULL,
  major   VARCHAR(60) NOT NULL,
  admin_class VARCHAR(40) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3.3 `assistant_bindings`（助教子账号绑定关系）

```sql
CREATE TABLE assistant_bindings (
  assistant_user_id VARCHAR(10) NOT NULL,
  teacher_user_id   VARCHAR(10) NOT NULL,
  course_id         CHAR(36)    NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assistant_user_id, course_id),
  FOREIGN KEY (assistant_user_id) REFERENCES users(id),
  FOREIGN KEY (teacher_user_id) REFERENCES users(id),
  FOREIGN KEY (course_id)       REFERENCES courses(id)
);
-- 助教的权限范围 = 本表中 course_id 列举的课程。
-- 课程表建立前，course_id 可暂不加外键约束；建立后补齐 FK。
```

### 3.4 Refresh Token（存 Redis，不建 MySQL 表）

```text
SET rt:{SHA-256(refreshToken)} "{userId}" EX 604800
```

说明：

- Refresh Token 原文只返回给客户端一次，服务端只存 SHA-256 后的 Redis key。
- 登出或改密时删除 Redis key；过期由 Redis TTL 自动处理。
- 现阶段不建 `refresh_tokens` 表，避免和 [auth-tables-design-v2.md](auth-tables-design-v2.md) 冲突。

### 3.5 审计日志（先用文件日志，不建表）

- 登录、登出、改密、重置密码等安全事件先用 winston 输出 JSON 日志。
- 日志不记录密码、token 原文、身份证明材料等敏感字段。
- 如果后续需要管理后台查询审计记录，再补 `audit_logs` 表和迁移脚本。

---

## 四、密码安全存储

### 4.1 推荐方案：Argon2id

```
算法：Argon2id（OWASP 2024 推荐，抗 GPU 暴力破解）
参数：
  memoryCost: 65536  (64 MB)
  timeCost:   3      (迭代次数)
  parallelism: 1
  hashLength:  32
Node.js 库：argon2（npm install argon2）
```

备选：`bcrypt`（cost factor ≥ 12），不推荐 `md5/sha1/sha256` 直接哈希。

### 4.2 存储规则

| 规则 | 说明 |
|------|------|
| 只存散列，从不存明文 | `password_hash` 字段仅存 `$argon2id$...` 格式散列 |
| 散列含 salt | Argon2id 已内嵌随机 salt，无需额外字段 |
| 日志脱敏 | 任何日志（audit_log / 应用日志）不得输出 `password` 字段 |
| 改密需验旧密 | 修改密码接口必须提供当前密码并验证通过后才能变更 |
| 首次登录强制改密 | `force_change_password = 1` 时，登录后立即跳转改密页，未改密前所有其他接口返回 403 |

### 4.3 批量导入账号密码策略

教务处导入学生/老师名单时，系统生成随机初始密码（8位，字母+数字混合），通过独立渠道（如导出 Excel）下发，`force_change_password` 置 1，首次登录后强制修改。

---

## 五、Token 生命周期与 API 契约

### 5.1 Token 策略

```
Access Token（JWT）：有效期 30 分钟，签名算法 HS256/RS256
Refresh Token：有效期 7 天，不透明随机字符串，SHA-256 散列后存 Redis
登出：删除对应 Redis refresh token key，access token 自然过期
```

### 5.2 API 契约（api-contract-first 格式）

---

#### `POST /api/v1/auth/login`

**说明**：账号密码登录，返回 access token 和 refresh token。

**权限断言**：无需登录（公开接口），但需限流（防暴力破解）。

请求：
```json
{
  "userId": "string, 必填, 10位数字一卡通号",
  "password": "string, 必填, 8-72字符"
}
```

响应 200：
```json
{
  "ok": true,
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresIn": "30m",
    "forceChangePassword": false
  }
}
```

错误码：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `UNAUTHENTICATED` | 401 | 用户 ID 或密码错误（两者合并，不区分，防枚举） |
| `FORBIDDEN` | 403 | 账号已停用 |
| `VALIDATION_FAILED` | 400 | 入参格式不合法 |

注意事项：
- 错误响应不得说明"用户不存在"还是"密码错误"——统一返回同一条错误信息。
- 连续失败 5 次后锁定 15 分钟（Redis 计数器实现）。

---

#### `POST /api/v1/auth/refresh`

**说明**：用 refresh token 换新 access token。

**权限断言**：无需 access token，但 refresh token 必须合法且未撤销。

请求：
```json
{ "refreshToken": "string, 必填" }
```

响应 200：
```json
{
  "ok": true,
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresIn": "30m"
  }
}
```

错误码：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `VALIDATION_FAILED` | 400 | 未提供 refreshToken |
| `UNAUTHENTICATED` | 401 | token 无效/过期/已撤销 |

---

#### `POST /api/v1/auth/logout`

**说明**：撤销当前 refresh token。

**权限断言**：无需 access token，但请求体必须携带 refresh token；服务端按 refresh token 定位并撤销会话。

请求：
```json
{ "refreshToken": "string, 必填" }
```

响应 200：`{ "ok": true }`

---

#### `POST /api/v1/auth/change-password`

**说明**：修改密码，登录后操作。

**权限断言**：需要有效 access token，所有角色均可调用本接口（改自己的密码）。

请求：
```json
{
  "currentPassword": "string, 必填",
  "newPassword":     "string, 必填, 8-72字符, 含大小写+数字"
}
```

响应 200：`{ "ok": true }`

错误码：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `UNAUTHENTICATED` | 401 | 未登录 |
| `FORBIDDEN` | 403 | `currentPassword` 错误 |
| `VALIDATION_FAILED` | 422 | `newPassword` 不满足强度要求 |

注意事项：
- 改密成功后，撤销当前用户所有 refresh token（强制重新登录）。
- `force_change_password` 置 0。
- 写入结构化安全日志（action = `change_password`，不记录密码本身）。

---

#### `POST /api/v1/auth/admin/reset-password`（仅 teacher/academic）

**说明**：老师重置学生/助教密码（不需知道旧密码），生成新随机密码。

**权限断言**：`role = teacher OR role = academic`；teacher 只能重置所辖课程内的成员。

请求：
```json
{ "targetUserId": "string, 必填" }
```

响应 200：
```json
{ "temporaryPassword": "string", "forceChangePassword": true }
```

注意事项：
- `temporaryPassword` 仅本次响应返回，不落库（只存散列）。
- 写入结构化安全日志（action = `admin_reset_password`，记录 `targetUserId`）。

---

## 六、实现要点与反例

来自 `skills/auth-permission-baseline/references/authz-checklist.md`：

### 检查清单（实现时逐项勾选）

- [ ] 未登录请求返回 401，不返回资源数据
- [ ] 越权访问返回 403（assistant 不能发最终成绩，学生不能改他人 minitask）
- [ ] access token 过期返回 401，前端凭 refresh token 换新
- [ ] 日志中无 `password`、`token`、`student_number` 等隐私字段明文
- [ ] 登录接口有限流保护（Redis 计数器）
- [ ] 修改密码要求旧密码验证
- [ ] 助教权限范围仅限 `assistant_bindings` 中绑定的课程

### 常见反例（避免）

| 反例 | 正确做法 |
|------|---------|
| 前端判断 `role === 'teacher'` 就不渲染按钮，后端不校验 | 后端每个接口独立检查角色 |
| 错误日志输出完整请求体（含 password 字段） | 日志中间件过滤 `password` 字段 |
| 用角色名字符串硬编码：`if (role === 'assistant') ...` 散落全代码 | 集中权限中间件或 guard，单点维护 |
| refresh token 存明文 | SHA-256 散列后入库，原始值只在响应中出现一次 |
| 改密不撤销旧 token | 改密后立即 revoke 所有 refresh token |

---

## 七、后续接入建议

1. **先实现登录 + 改密 + 刷新**，把 `auth` 中间件跑通后再接业务接口。
2. **助教权限** 在中间件里加一层课程范围检查：`assistant_bindings` 查 `course_id`，不在范围内返回 403。
3. **首次改密门卫**：在全局中间件检查 `forceChangePassword`，如为 `true` 则除 `change-password` 外所有接口返回 403 + `{ code: "FORCE_CHANGE_PASSWORD" }`。
4. **安全日志** 先用 winston 文件日志落地；后续如引入任务队列，再改为异步写入。
