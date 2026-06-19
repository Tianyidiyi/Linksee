# 前端现状与待补清单 v1

> 最近更新：2026-05-07  
> 对标后端：auth/users/courses/assignments/stages 已实现并可联调；group/minitask/chat 已实现接口（待前端对接）；submission/review 已实现核心接口（待前端对接）。  
> 关联文档：[apps/web/README.md](../../apps/web/README.md) · [design-mapping-checklist.md](../../skills/design-md-ui-workflow/references/design-mapping-checklist.md)

---

## 一、已有前端文件

| 文件 | 说明 | 状态 |
| ---- | ---- | ---- |
| `apps/web/app/login.html` | 登录页（账号密码 → POST /auth/login，token 存 localStorage） | ✅ 可用 |
| `apps/web/app/dashboard.html` | 登录后占位工作台，展示账号 ID，支持退出登录 | ⚠️ 仅占位，无角色分发 |
| `apps/web/demo/login.html` | 演示用静态登录页 | ✅ 演示用 |
| `apps/web/demo/status.html` | 演示用 Socket 状态页 | ✅ 演示用 |
| `apps/web/src/api/client.ts` | 通用 HTTP 封装（requestJson + Idempotency-Key 支持） | ✅ 骨架完成 |
| `apps/web/src/realtime/socket-client.ts` | Socket 连接/订阅/事件分发骨架 | ✅ 骨架完成 |
| `apps/web/src/realtime/event-handlers.ts` | 事件名类型定义 + eventId 去重工具函数 | ✅ 骨架完成 |

---

## 二、前端与后端差距总览

| 模块 | 后端现状 | 前端现状 | 差距等级 |
| ---- | -------- | -------- | -------- |
| Auth / 登录 | ✅ 完整实现（36 个测试） | ✅ login.html 可用 | 🔴 缺强制改密拦截、个人信息、改密页 |
| Users / 个人信息 | ✅ GET + PATCH /me 接口已实现 | ❌ 无任何页面 | 🔴 最紧迫 |
| 角色路由分发 | ✅ role 字段在 token / me 响应中 | ❌ dashboard 未按 role 跳转 | 🔴 最紧迫 |
| Course（Phase 1） | ✅ API 已实现（可联调） | ❌ 无页面 | 🟡 需要联调 |
| Assignment / Stage（Phase 2） | ✅ API 已实现（可联调） | ❌ 无页面 | 🟡 需要联调 |
| Groups（Phase 3） | ✅ API 已实现 | ❌ 无页面 | 🟡 待前端对接 |
| MiniTask / Chat（Phase 4） | ✅ API 已实现 | ❌ 无页面 | 🟡 待前端对接 |
| Submissions / Reviews（Phase 5） | ✅ 后端已实现 | ❌ 无页面 | 🟡 待前端对接 |
| Socket 业务事件处理 | ✅ 网关/心跳/房间已实现 | ⚠️ 骨架有，无业务处理函数 | 🟡 联调时补 |

---

## 三、待补页面详细清单

### 3.1 用户个人信息（对应后端已完成接口，最高优先）

| 页面 / 功能 | 对应后端接口 | 要点 |
| ----------- | ------------ | ---- |
| 个人信息展示页 | `GET /api/v1/users/me` | 头像、姓名、学号/工号、邮箱、bio、location；按 role 展示不同扩展字段（见下方字段表） |
| 编辑个人信息 | `PATCH /api/v1/users/me` | 可改：realName / bio / location / email；不可改：stuNo / teacherNo（提示灰显） |
| 头像上传 | `POST /api/v1/users/me/avatar` | 选文件 → 预览 → 上传 MinIO → 回写 avatarUrl；上传中显示进度，成功后即时刷新 |
| 修改密码 | `POST /api/v1/auth/change-password` | 当前密码 + 新密码 + 确认新密码三段输入；实时强度提示（大写+小写+数字，8~72 位）；成功后保持登录态 |
| 首次登录强制改密 | `POST /api/v1/auth/change-password` | `forceChangePassword=true` 时，登录后必须先进改密页，完成后才能进工作台，不可跳过 |

**个人信息字段按角色展示规则**：

| 字段 | student | teacher | assistant | academic |
| ---- | :-----: | :-----: | :-------: | :------: |
| realName（姓名） | ✅ | ✅ | ✅ | ✅ |
| accountNo（学号 / 工号） | stuNo | teacherNo | — | — |
| grade / cohort / major / adminClass | ✅ | — | — | — |
| title / college / researchDirection | — | ✅ | — | — |
| email（可选） | ✅ | ✅ | ✅ | ✅ |
| bio / location（可选） | ✅ | ✅ | ✅ | ✅ |

---

### 3.2 登录后角色路由分发（最高优先）

当前 `dashboard.html` 是所有角色共用的占位页，需要改为登录成功后读取 `role` 字段并跳转：

| role | 跳转目标 |
| ---- | -------- |
| `teacher` | 老师看板（课程列表 + 待批改概览） |
| `assistant` | 助教检查台（待批改 + 所属课程） |
| `student` | 学生课程列表（我参与的课程） |
| `academic` | 教务处后台（课程管理，P1） |

逻辑位置：登录接口成功回调处，或 dashboard 入口统一处理。

---

### 3.3 课程模块（Phase 1，后端已实现，可联调）

| 页面 / 功能 | 对应后端接口 | 要点 |
| ----------- | ------------ | ---- |
| 课程列表页 | `GET /api/v1/courses` | 卡片式：课程名 + 课程号 + 学期 + 状态徽章；老师看管理入口，学生看进入入口 |
| 课程详情页 | `GET /api/v1/courses/:id` | 课程基础信息 + 成员人数 + Assignment 列表入口 |
| 创建 / 编辑课程 | `POST / PATCH /api/v1/courses` | 仅 academic 角色可见此入口 |

---

### 3.4 Assignment / Stage（Phase 2，后端已实现，可联调）

| 页面 / 功能 | 对应后端接口 | 要点 |
| ----------- | ------------ | ---- |
| Assignment 列表 | `GET /api/v1/courses/:id/assignments` | 课程下的项目列表；状态徽章 draft/active/archived |
| Assignment 详情 | `GET /api/v1/assignments/:id` | 项目信息 + Stage 时间线 + 组队状态入口 |
| Stage 列表 | `GET /api/v1/assignments/:id/stages` | 按 stage_no 排序；状态徽章 planned/open/closed/archived；截止时间倒计时 |
| 老师创建 / 编辑 Stage | `POST / PATCH /api/v1/assignments/:id/stages` | 标题、截止时间、权重、提交要求文字、附件上传 |

---

### 3.5 小组（Phase 3，后端已实现，待前端对接）

| 页面 / 功能 | 对应后端接口 | 要点 |
| ----------- | ------------ | ---- |
| 老师划分组页 | `POST /api/v1/assignments/:id/groups` + 成员调整 | 左侧：未分组学生名单；右侧：组格子；下拉/拖拽分配 |
| 小组空间入口 | `GET /api/v1/groups/:id` | 展示组号、组员头像列表、组长标识 |

---

### 3.6 MiniTask + 群聊（Phase 4，后端已实现，待前端对接）

| 页面 / 功能 | 对应后端接口 | 要点 |
| ----------- | ------------ | ---- |
| MiniTask 看板 | `GET / POST /api/v1/groups/:id/minitasks` + `PATCH /api/v1/minitasks/:taskId` | 三栏（todo / in_progress / done）+ 任务卡片（负责人、截止时间、优先级色标） |
| 项目组群聊 | `GET /api/v1/conversations/:id/messages`（HTTP 历史）+ socket `group:*` | 消息气泡流 + 文件上传；首屏走 HTTP 拉历史，实时推送靠 socket `group.message.created` 事件 |
| 课程群聊（P1） | socket `course:*` 房间 + `course.message.created` | P0-A 暂不实现；入口可先隐藏 |

---

### 3.7 提交与批改（Phase 5，后端待设计）

| 页面 / 功能 | 对应后端接口 | 要点 |
| ----------- | ------------ | ---- |
| 提交台 | `POST /api/v1/stages/:id/submissions` | 当前 Stage 要求说明 → 上传文件 → 填仓库链接 → 贡献说明 → 提交；状态流转明确展示 |
| 批改台（老师 / 助教） | `POST /api/v1/submissions/:id/reviews` + `PATCH /api/v1/reviews/:id` | 两栏：左侧提交物预览（文件列表 + 链接），右侧 Review 输入 + 评分 + 状态操作 |
| 待评审列表 | `GET /api/v1/courses/:id/pending-reviews` | 老师/助教查看待处理提交 |
| 助教检查台 | 同上，筛选视图 | 待检查 / 缺材料 / 需复核 / 已处理 四态快速筛选 |
| 老师看板 | `GET /api/v1/courses/:id/dashboard` | 4 个数字卡片：未提交小组 / 待批改 / 已延期 / 协作不活跃；可点击钻取 |

---

## 四、可复用组件建议

以下组件在多个页面重复出现，建议提前沉淀为公共组件，避免重复实现：

| 组件 | 使用场景 |
| ---- | -------- |
| 状态徽章（StatusBadge） | Stage 状态、Submission 状态、课程状态、Group 状态全部共用 |
| 文件上传（FileUploader） | 提交台 / Stage 附件 / 群聊附件 / 头像上传 |
| 用户头像（UserAvatar） | 群聊气泡、组员列表、任务卡片负责人 |
| 分页消息列表（MessageList） | 项目组群聊、课程群聊 |
| 空态占位（EmptyState） | 所有列表页无数据时统一展示 |
| Skeleton 加载骨架 | 所有数据驱动页面的首屏加载状态 |
