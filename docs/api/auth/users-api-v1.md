# Users 模块 API 契约 v1

> 本文档覆盖 `/api/v1/users/` 下所有用户管理接口。  
> 鉴权与 token 接口见 [auth-design-v2.md](auth-design-v2.md)。  
> 数据表结构见 [auth-tables-design-v2.md](auth-tables-design-v2.md)。

---

## 0. 通用约定

- **基础路径**：`/api/v1/users`
- **认证**：所有接口均需 `Authorization: Bearer <accessToken>`
- **响应格式**：`{ ok: true, data: {...} }` / `{ ok: false, code: "...", message: "..." }`
- **id 格式**：一卡通号，纯 10 位数字（`/^\d{10}$/`）

### 统一错误码

| HTTP | code | 含义 |
|------|------|------|
| 400 | `VALIDATION_FAILED` | 格式/必填校验不通过 |
| 401 | `UNAUTHENTICATED` | token 缺失或过期 |
| 403 | `FORBIDDEN` | 已登录但无操作权限 |
| 403 | `FORCE_CHANGE_REQUIRED` | 首次登录未改密，被门卫拦截 |
| 404 | `USER_NOT_FOUND` | 目标用户不存在或已停用 |
| 409 | `CONFLICT` | ID 已存在（创建冲突） |
| 422 | `VALIDATION_FAILED` | 语义校验不通过（如密码强度） |

---

## 1. 个人信息

### 1.1 GET /users/me — 获取自己的 profile

**权限**：所有已登录且通过改密门卫的账号

**响应**：
```json
{
  "ok": true,
  "data": {
    "id": "2023010001",
    "role": "student",
    "forceChangePassword": false,
    "lastLoginAt": "2026-05-06T12:00:00.000Z",
    "profile": {
      "realName": "张三",
      "accountNo": "202301001",
      "avatarUrl": "http://localhost:3001/demo/default-avatar-gray.svg",
      "bio": null,
      "location": null,
      "email": null
    }
  }
}
```

**错误示例**：
```json
{ "ok": false, "code": "FORCE_CHANGE_REQUIRED", "message": "Password change required before accessing this resource" }
```

---

### 1.2 PATCH /users/me — 更新自己的 profile

**权限**：所有已登录且通过改密门卫的账号

**可修改字段**（均为可选，不传表示不更新）：

| 字段 | 类型 | 约束 |
|------|------|------|
| `realName` | string | 非空，≤ 40 字符 |
| `bio` | string \| null | ≤ 2000 字符 |
| `location` | string \| null | ≤ 100 字符 |
| `email` | string \| null | 合法邮箱格式，全局唯一 |
| `avatarUrl` | string \| null | 合法 URL（MinIO 地址） |

**禁止修改字段**：`stuNo`、`teacherNo` 及所有其他学籍/档案字段 → 返回 403

**请求示例**：
```json
{ "bio": "软件工程 2023 级", "location": "北京" }
```

**响应示例**：
```json
{
  "ok": true,
  "data": {
    "realName": "张三",
    "accountNo": "202301001",
    "avatarUrl": "http://...",
    "bio": "软件工程 2023 级",
    "location": "北京",
    "email": null
  }
}
```

---

## 2. 教务处账号管理（academic 专属）

> 以下接口仅 `role=academic` 可调用，其他角色返回 403。

### 2.1 POST /users — 创建单个学生或老师账号

**请求体**（学生）：

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | string | 必填，10 位数字 |
| `role` | `"student"` | 必填 |
| `realName` | string | 必填，非空 |
| `defaultPassword?` | string | 可选，不传则随机生成；需符合强度要求 |
| `stuNo` | string | 必填，唯一 |
| `grade` | number | 必填，入学年份 |
| `cohort` | number | 必填，预计毕业年份 |
| `major` | string | 必填 |
| `adminClass` | string | 必填 |

**请求体**（老师）：

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | string | 必填，10 位数字 |
| `role` | `"teacher"` | 必填 |
| `realName` | string | 必填，非空 |
| `defaultPassword?` | string | 可选 |
| `teacherNo` | string | 必填，唯一 |
| `title` | string | 必填（职称） |
| `college` | string | 必填 |
| `researchDirection?` | string | 可选 |

**响应（201）**：
```json
{
  "ok": true,
  "data": {
    "id": "2023010001",
    "role": "student",
    "temporaryPassword": "Abc12345",
    "forceChangePassword": true
  }
}
```

---

### 2.2 POST /users/batch/students — 批量创建学生

**请求体**：
```json
{
  "students": [
    {
      "id": "2023010001",
      "realName": "张三",
      "stuNo": "202301001",
      "grade": 2023,
      "cohort": 2027,
      "major": "软件工程",
      "adminClass": "软工2301"
    }
  ]
}
```

**响应（200）**：
```json
{
  "ok": true,
  "data": {
    "createdCount": 3,
    "failedCount": 1,
    "defaultPassword": "Xyz98765",
    "forceChangePassword": true,
    "failures": [
      { "index": 3, "id": "bad", "reason": "id must be a 10-digit string" }
    ]
  }
}
```

> 逐条校验，成功的提交，失败的记录到 `failures`，不回滚已成功项。

---

### 2.3 POST /users/batch/teachers — 批量创建老师

结构与 `batch/students` 一致，字段为教师档案字段。

**请求体**：
```json
{
  "teachers": [
    {
      "id": "2000000001",
      "realName": "李老师",
      "teacherNo": "T20000001",
      "title": "副教授",
      "college": "软件学院",
      "researchDirection": "软件工程"
    }
  ]
}
```

---

### 2.4 PATCH /users/:id — 更新用户信息

**路径参数**：`id` — 目标用户的一卡通号

**可修改字段**（均可选）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `isActive` | boolean | 启停账号（布尔型，字符串 `"false"` 拒绝） |
| `realName` | string | 真实姓名 |

**响应（200）**：
```json
{
  "ok": true,
  "data": {
    "id": "2023010001",
    "role": "student",
    "isActive": false,
    "realName": "张三（已更新）"
  }
}
```

---

## 3. 助教管理（teacher 专属）

### 3.1 POST /users/assistants — 创建助教账号

**权限**：仅 `role=teacher`

**说明**：创建账号的同时在 `teacher_assistants` 表写入归属记录，确保该老师可对此助教执行密码重置等管理操作。

**请求体**：

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | string | 必填，10 位数字 |
| `realName` | string | 必填，非空 |
| `defaultPassword?` | string | 可选，不传则随机生成；需符合强度要求 |

**响应（201）**：
```json
{
  "ok": true,
  "data": {
    "id": "3500000001",
    "temporaryPassword": "Rand@2026",
    "forceChangePassword": true
  }
}
```

**错误示例**：
```json
{ "ok": false, "code": "FORBIDDEN", "message": "Only teachers can create assistants" }
{ "ok": false, "code": "CONFLICT",  "message": "User ID already exists" }
```

---

## 4. 密码管理策略

### 密码强度要求

- 长度 8 ~ 72 字符
- 至少含大写字母、小写字母、数字各一个
- 违反时响应 `422 VALIDATION_FAILED`

### 临时密码生成规则

- 随机生成，不传 `defaultPassword` 时由服务端生成并在响应中返回一次
- 账号初始 `forceChangePassword=true`，首次登录必须修改密码

---

## 5. 数据库依赖

| 表 | 操作 | 接口 |
|----|------|------|
| `users` | 读/写 | 所有 |
| `user_profiles` | 读/写 | GET/PATCH /me, POST /users, POST /users/assistants |
| `student_profiles` | 读/写 | POST /users (student), POST /users/batch/students |
| `teacher_profiles` | 读/写 | POST /users (teacher), POST /users/batch/teachers |
| `teacher_assistants` | 写 | POST /users/assistants |

---

## 6. 相关文档

- [鉴权与权限基线设计 v2](auth-design-v2.md)
- [数据表结构设计 v2](auth-tables-design-v2.md)
- [Auth API 契约（登录/改密/重置）](auth-design-v2.md#五接口契约)
- [OpenAPI schema v1](../openapi/linksee-v1.yaml)
