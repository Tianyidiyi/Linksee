# 当前架构状态（2026-05-06）

## 1. 产品方向调整

项目已从通用"云端团队协作平台"调整为：

> Linksee 教学项目协作与过程评价平台

新的核心场景是高校课程项目、小组作业、实训课程和毕业设计过程管理。平台重点支持老师实时追踪小组进度、学生阶段提交、教师反馈、互评和 Rubric 评分。自动测试、GitHub 贡献统计和 AI 助教属于后续增强。

产品大纲见：[docs/product/teaching-collaboration-outline.md](../product/teaching-collaboration-outline.md)。

## 2. 已完成

1. 通信治理规范与契约文档已建立。
2. [apps/api](../../apps/api/) 与 [apps/web](../../apps/web/) 已创建通信骨架目录与类型占位。
3. 根工作区已配置 workspaces 构建与打包脚本。
4. 已补充最小构建/打包流程文档。
5. 已完成教学协作平台的新产品定位与 MVP 大纲。
6. 通信契约已从通用任务评论切换为课程、作业、阶段、小组、提交、反馈、评分等教学场景接口。
7. **Auth 模块全量实现（2026-05-06）**：
   - JWT 鉴权中间件（`requireAuth` / `optionalAuth` / `forceChangeGuard`）
   - 登录 / 刷新 Token / 登出 / 修改密码 / 单人重置密码 / 批量重置密码
   - 用户 profile 读写（GET/PATCH /me）
   - 教务处账号管理（单个/批量创建学生、老师；更新账号状态）
   - 教师创建助教账号（含 `teacher_assistants` 归属记录）
   - MinIO 默认灰色头像集成
   - Redis 登录频率限制（15 分钟内超 5 次锁定）
   - 集成测试 36 PASS / 0 FAIL

## 3. 当前形态

- 产品层：已明确从泛协作转向教学项目过程评价。
- 架构层：文档驱动 + 目录骨架就绪；Auth 模块完整实现。
- 代码层：`apps/api` Auth + Users 模块可运行，`apps/web` 通信框架占位就绪。
- 运行层：Auth API 服务在 `localhost:3001` 可用；MySQL 8 + Redis + MinIO 均通过 Docker Compose 启动。

## 4. 数据库表（Auth 组，已落库）

| 表名 | 状态 | 说明 |
|------|------|------|
| `users` | ✅ 已建 | 鉴权核心 |
| `user_profiles` | ✅ 已建 | 通用展示信息 |
| `student_profiles` | ✅ 已建 | 学生学籍扩展 |
| `teacher_profiles` | ✅ 已建 | 教师学术扩展 |
| `teacher_assistants` | ✅ 已建 | 教师-助教归属关系 |
| `assistant_bindings` | ✅ 已建 | 助教-课程分配关系（待课程模块激活） |

## 5. 概念映射

当前工程中的 Team/Project/Task/Docs/Feed 概念可以复用，但需要切换为教学语义。

| 原概念 | 教学版概念 |
| --- | --- |
| Team | Course / Class |
| Project | Assignment / Course Project |
| Task | Stage / MiniTask |
| Chat | Group Discussion / Teacher Feedback |
| Docs | Submissions / Course Materials |
| Feed | Progress Timeline |
| RAG | Course Knowledge Q&A |
| AI 站会助手 | AI Teaching Assistant |

## 6. 风险状态

| 风险项 | 级别 | 说明 |
|--------|------|------|
| `assistant_bindings.teacherUserId` 无 FK | 低 | 目前作审计字段，课程表建立后需补充外键 |
| 课程模块尚未开始 | 中 | `assistant_bindings` 暂时空表，需课程模块激活 |
| OpenAPI schema 未同步 Auth/Users 接口 | 低 | `linksee-v1.yaml` 仍以 Assignment/Stage 为主，Auth 接口待补 |
| `apps/web` 未对接真实 API | 中 | 前端通信框架占位，Auth 联调待启动 |

## 7. 下一步建议

1. **课程模块**：设计 `courses` 表 + 课程管理 API，激活 `assistant_bindings`。
2. **前端 Auth 联调**：基于 [users-api-v1.md](../api/auth/users-api-v1.md) 和 [auth-design-v2.md](../api/auth/auth-design-v2.md) 开始联调。
3. **OpenAPI 补全**：将 Auth + Users 接口补入 `linksee-v1.yaml`。
4. **核心数据模型**：Course → Group → Assignment → Stage → Submission → Review → Grade。
5. **端到端链路**：以"老师发布阶段要求 → 小组提交 → 老师评价反馈"为第一条端到端功能链路。

## 1. 产品方向调整

项目已从通用“云端团队协作平台”调整为：

> Linksee 教学项目协作与过程评价平台

新的核心场景是高校课程项目、小组作业、实训课程和毕业设计过程管理。平台重点支持老师实时追踪小组进度、学生阶段提交、教师反馈、互评和 Rubric 评分。自动测试、GitHub 贡献统计和 AI 助教属于后续增强。

产品大纲见：[docs/product/teaching-collaboration-outline.md](../product/teaching-collaboration-outline.md)。

## 2. 已完成

1. 通信治理规范与契约文档已建立。
2. [apps/api](../../apps/api/) 与 [apps/web](../../apps/web/) 已创建通信骨架目录与类型占位。
3. 根工作区已配置 workspaces 构建与打包脚本。
4. 已补充最小构建/打包流程文档。
5. 已完成教学协作平台的新产品定位与 MVP 大纲。
6. 通信契约已从通用任务评论切换为课程、作业、阶段、小组、提交、反馈、评分等教学场景接口。

## 3. 当前形态

- 产品层：已明确从泛协作转向教学项目过程评价。
- 架构层：文档驱动 + 目录骨架就绪。
- 代码层：通信框架占位文件已就位。
- 运行层：已有 Socket 登录与在线状态 demo，但尚未形成完整业务服务。

## 4. 概念映射

当前工程中的 Team/Project/Task/Docs/Feed 概念可以复用，但需要切换为教学语义。

| 原概念 | 教学版概念 |
| --- | --- |
| Team | Course / Class |
| Project | Assignment / Course Project |
| Task | Stage / MiniTask |
| Chat | Group Discussion / Teacher Feedback |
| Docs | Submissions / Course Materials |
| Feed | Progress Timeline |
| RAG | Course Knowledge Q&A |
| AI 站会助手 | AI Teaching Assistant |

## 5. MVP 风险状态

- 产品范围风险：中。需要避免继续做成大而全协作平台。
- 通信边界风险：低。已有 HTTP/Socket/Worker 分层规则。
- 工程可运行性风险：中。需要尽快初始化真实 api/web 服务。
- 教学场景验证风险：中。需要用老师端看板和学生端提交台验证价值。

## 6. 下一步建议

1. 确认 [docs/product/teaching-collaboration-outline.md](../product/teaching-collaboration-outline.md) 是否作为组内统一方向。
2. 初始化 [apps/api](../../apps/api/) 与 [apps/web](../../apps/web/) 可运行脚手架。
3. 设计核心数据模型：Course、Group、Assignment、Stage、Submission、Review、Grade。
4. 以“老师发布阶段要求 -> 小组提交 -> 老师评价反馈”作为第一条端到端功能链路。
5. 围绕通信契约补齐真实业务模型与端到端实现。
