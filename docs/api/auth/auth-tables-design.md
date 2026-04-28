# Auth 表结构设计草稿

> 本文件记录表结构设计决策，先于 SQL / Prisma schema 落地。
> 最终以此为准写入 schema.prisma。

---

## 表清单（Auth 组共 5 张，MySQL）

| 表名 | 作用 | 对应角色 |
|------|------|---------|
| `users` | 鉴权核心，最精简 | 所有角色 |
| `user_profiles` | 通用展示信息 | 所有角色 |
| `student_profiles` | 学生学籍扩展信息 | student |
| `teacher_profiles` | 教师学术扩展信息 | teacher |
| `ta_bindings` | 助教子账号与课程绑定关系 | ta |

> 教务处（academic）无单独 profile 表，通用信息存 `user_profiles` 即可。

## 不建表的部分（存 Redis）

| 数据 | Key 格式 | TTL | 原因 |
|------|---------|-----|------|
| Refresh Token | `rt:{token_hash}` | 7天 | 需要主动撤销（改密/登出），TTL 自动处理过期 |
| 在线状态 | `online:{userId}` | 5分钟滚动刷新 | 高频写，不适合落 DB |
| 登录失败计数 | `rate:login:{userId}` | 15分钟 | 短暂计数，不需要持久化 |

## 日志策略

- 操作日志（登录/改密/撤销 token）用 **winston** 输出 JSON 文件，不建表
- `audit_logs` 表留待后续需要"在管理界面查询操作记录"时再建

---

## 一、`users`（鉴权核心）

**设计原则**：只放每次鉴权都要查的字段，保持最精简。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | VARCHAR(10) PK | **一卡通号**，纯10位数字，系统唯一登录标识，自然主键，不用 UUID |
| `password_hash` | VARCHAR(128) | Argon2id 散列，含内嵌 salt |
| `role` | ENUM | `academic` / `teacher` / `ta` / `student` |
| `is_active` | BOOLEAN | 账号是否允许登录（软停用，不删记录）|
| `force_change_password` | BOOLEAN | 批量导入后首次登录强制改密，改完置 false |
| `created_at` | DATETIME | 账号创建时间 |
| `last_login_at` | DATETIME NULL | 最近一次登录时间 |
| `last_seen_at` | DATETIME NULL | 最近活跃时间，用于在线状态展示 |

**关于在线状态联动**：
- DB 层只记 `last_seen_at`（Socket 心跳时更新）
- 实时的 `is_online` 布尔状态存 Redis：key = `online:{userId}`，Socket 连接时写入，断连时删除，TTL 兜底
- 这样 DB 不承受高频写压力，Redis 承担实时性

**关于邮箱**：放在 `user_profiles`（nullable）。理由：
- 主登录凭据是一卡通号 + 密码，邮箱不是必须的
- 邮箱用于密码重置通知、系统消息推送（选填）
- 后续可扩展为第二登录方式，改动只在 profiles 层

---

## 二、`user_profiles`（通用展示信息，所有角色共用）

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | VARCHAR(10) PK | FK → `users.id`，一对一 |
| `real_name` | VARCHAR(40) | 真实姓名 |
| `account_no` | VARCHAR(20) NULL | 学号（学生）或工号（教师/教务），快速展示用，保留 |
| `avatar_url` | VARCHAR(255) NULL | 头像存 MinIO，此处存 URL |
| `bio` | TEXT NULL | 个人简介 |
| `location` | VARCHAR(100) NULL | 地区（选填） |
| `email` | VARCHAR(100) NULL | 邮箱（选填，用于通知/改密） |

**关于 `account_no`**：
- 对 student：与 `student_profiles.stu_no` 一致，来源同一条导入记录
- 对 teacher：与 `teacher_profiles.teacher_no` 一致
- 此字段目的是"快速在 profile 页显示编号"，不作为唯一约束的业务主键

---

## 三、`student_profiles`（学生学籍扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | VARCHAR(10) PK | FK → `users.id` |
| `stu_no` | VARCHAR(20) UNIQUE | **学号**（教务学籍号，是学生在教务系统中的唯一编号，区别于一卡通号 `users.id`） |
| `grade` | SMALLINT | 年级（入学年份，如 2023） |
| `cohort` | SMALLINT | 届数（预计毕业年份，如 2027） |
| `major` | VARCHAR(60) | 专业名称 |
| `admin_class` | VARCHAR(40) | 行政班编号（如软工2301） |

**注释说明**：
- `stu_no`：教务学籍号，格式由学校决定（如 `202301001`），与一卡通号 `users.id` 是两个不同的编号体系，不可混用

---

## 四、`teacher_profiles`（教师学术扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | VARCHAR(10) PK | FK → `users.id` |
| `teacher_no` | VARCHAR(20) UNIQUE | 教师号（学校人事编号） |
| `title` | VARCHAR(30) NULL | 职称（如教授、副教授、讲师） |
| `research_direction` | VARCHAR(200) NULL | 研究方向 |
| `college` | VARCHAR(60) NULL | 所属学院 |
| `description` | TEXT NULL | 学术成果简介 |

---

## 五、`ta_bindings`（助教子账号绑定）

| 字段 | 类型 | 说明 |
|------|------|------|
| `ta_user_id` | VARCHAR(10) | **子账号 ID**，FK → `users.id`（助教本身是一个完整的 users 记录）|
| `teacher_user_id` | VARCHAR(10) | 创建该助教子账号的老师 ID，FK → `users.id` |
| `course_id` | CHAR(36) | 绑定的课程 ID，FK → `courses.id` |
| `created_at` | DATETIME | 绑定时间 |

**关于"子账号密码"**：
- 助教账号是 `users` 表中一条 `role=ta` 的记录，密码存在 `users.password_hash`
- `ta_bindings` 不重复存密码，避免两处维护
- 老师创建助教账号时：在 `users` 插入一条 ta 记录 + 在 `ta_bindings` 插入绑定关系
- 子账号 ID 即 `ta_user_id`，就是 `users.id`（一卡通号）

**主键**：`(ta_user_id, course_id)` 联合主键，同一助教可绑定多门课程

---

## 六、Refresh Token（存 Redis，不建表）

**存储方式**：

```
SET rt:{SHA-256(token原始值)}  "{userId}"  EX 604800
```

- key 用散列，原始 token 不落任何存储
- 撤销（登出/改密）：`DEL rt:{token_hash}`
- 撤销该用户所有 token：按 `rt:*` 扫描该用户相关 key（或用 Set 维护用户的 token 集合）
- 过期：TTL 到期 Redis 自动清理，无需定时任务

---

## 决策记录

| 问题 | 决策 |
|------|------|
| `users.id` 格式 | 纯10位数字，VARCHAR(10)，如 `2023010001` |
| `user_profiles.account_no` 保留？ | 是，保留作为快速展示字段 |
| Refresh Token 存哪里 | Redis（不建 MySQL 表），TTL 7天自动过期 |
| Audit Log 现阶段如何处理 | winston 文件日志，不建表，后续有界面查询需求再补 |
| `ta_bindings` 备注/昵称 | 暂不加，保持最简 |

---

## 决策记录

| 问题 | 决策 |
|------|------|
| `users.id` 格式 | 纯10位数字，VARCHAR(10)，如 `2023010001` |
| `user_profiles.account_no` 保留？ | 是，保留作为快速展示字段 |
| `audit_logs.actor_id` 类型 | 暂保持原设计，后续 migration 时统一对齐 |
| `ta_bindings` 备注/昵称 | 暂不加，保持最简 |
