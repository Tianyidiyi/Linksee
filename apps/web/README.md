# apps/web

前端客户端骨架目录（MVP 版本）。

## 角色定位

- [api](src/api/)：通过 HTTP 访问业务写接口和查询接口
- [realtime](src/realtime/)：处理 Socket 连接、订阅和事件分发
- [state](src/state/)：预留页面状态组织边界，用于后续合并 HTTP 结果与 Socket 增量更新

## 前端硬规则

1. 不通过 Socket 提交写操作。
2. 所有写操作统一走 HTTP。
3. Socket 只接收服务端变化推送。
4. 收到重复事件时按 eventId 去重。

### 已有

| 文件 | 说明 |
| ---- | ---- |
| `app/login.html` | 登录页（账号密码 → POST /auth/login，token 存 localStorage） |
| `app/dashboard.html` | 登录后占位工作台，展示账号 ID，支持退出登录 |
| `demo/login.html` | 演示用静态登录页 |
| `demo/status.html` | 演示用 Socket 状态页 |
| `src/api/client.ts` | 通用 HTTP 封装（requestJson + Idempotency-Key 支持） |
| `src/realtime/socket-client.ts` | Socket 连接/订阅/事件分发骨架 |
| `src/realtime/event-handlers.ts` | 事件名类型定义 + eventId 去重工具函数 |

### 待补充页面（按后端已完成接口排序）

> 所有页面均可用 mock 数据先做，不需要等后端联调。

#### 一、用户个人信息（对应后端 `/api/v1/users/me`，已完成）

| 页面/功能 | 对应后端接口 | 说明 |
| --------- | ------------ | ---- |
| 个人信息页 | `GET /users/me` | 展示头像、姓名、学号/工号、邮箱、bio、location；按角色展示不同扩展字段 |
| 编辑个人信息 | `PATCH /users/me` | 可修改：realName / bio / location / email；不可改：stuNo / teacherNo |
| 头像上传 | `POST /users/me/avatar` | 文件上传到 MinIO，回写 avatarUrl；上传前预览，上传后即时刷新头像 |
| 修改密码 | `POST /auth/change-password` | 输入当前密码 + 新密码 + 确认新密码；强度提示（大写+小写+数字，8~72位）；成功后保持登录态 |
| 首次登录强制改密 | `POST /auth/change-password` | `forceChangePassword=true` 时登录后拦截，强制进入改密流程才能继续，不可跳过 |

**字段展示规则（按 role）**：

| 字段 | student | teacher | assistant | academic |
| ---- | ------- | ------- | --------- | -------- |
| realName | ✅ | ✅ | ✅ | ✅ |
| accountNo（学号/工号） | 学号 stuNo | 工号 teacherNo | — | — |
| grade / cohort / major / adminClass | ✅ | — | — | — |
| title / college / researchDirection | — | ✅ | — | — |
| email | ✅ 可选 | ✅ 可选 | ✅ 可选 | ✅ 可选 |
| bio / location | ✅ | ✅ | ✅ | ✅ |

#### 二、课程模块（后端 Phase 1 待实现，可 mock 先做）

| 页面/功能 | 对应后端接口 | 说明 |
| --------- | ------------ | ---- |
| 课程列表页 | `GET /courses` | 卡片展示课程名/课程号/学期/状态；老师看管理入口，学生看进入入口 |
| 课程详情页 | `GET /courses/:id` | 课程基础信息 + 成员概览 + Assignment 列表入口 |
| 创建/编辑课程 | `POST /courses` / `PATCH /courses/:id` | 仅 academic 角色可用 |

#### 三、Assignment / Stage（后端 Phase 2 待实现）

| 页面/功能 | 对应后端接口 | 说明 |
| --------- | ------------ | ---- |
| Assignment 列表 | `GET /courses/:id/assignments` | 课程下的项目列表 |
| Assignment 详情 | `GET /assignments/:id` | 项目信息 + Stage 时间线 + 组队入口 |
| Stage 列表/详情 | `GET /assignments/:id/stages` | 按 stage_no 排序；展示状态徽章 planned/open/closed/archived |
| 老师创建/编辑 Stage | `POST/PATCH /assignments/:id/stages` | 标题、截止时间、权重、提交要求 |

#### 四、小组（后端 Phase 3 待实现）

| 页面/功能 | 对应后端接口 | 说明 |
| --------- | ------------ | ---- |
| 老师划分组页 | `POST /assignments/:id/groups`，`PATCH /groups/:id/members` | 表格化：左侧未分组学生，右侧组格子，直接分配 |
| 小组空间入口 | `GET /groups/:id` | 展示组号、组员、组长 |

#### 五、MiniTask + 群聊（后端 Phase 4 待实现）

| 页面/功能 | 对应后端接口 | 说明 |
| --------- | ------------ | ---- |
| MiniTask 看板 | `GET/POST/PATCH /groups/:id/tasks` | 三栏（todo/in_progress/done）+ 任务卡片 |
| 项目组群聊 | `GET /conversations/:id/messages`（HTTP 历史）+ socket `group:*` 房间 | 消息流 + 文件上传；实时推送靠 socket |
| 课程群聊（P1） | socket `course:*` 房间 | 仅订阅，不在 P0-A |

#### 六、提交与批改（后端 Phase 5 待设计）

| 页面/功能 | 对应后端接口 | 说明 |
| --------- | ------------ | ---- |
| 提交台 | `POST /stages/:id/submissions` | 上传文件 + 填仓库链接 + 贡献说明 + 提交状态展示 |
| 批改台（老师/助教） | `POST /submissions/:id/reviews` | 提交物预览 + Review 输入 + 评分 + 状态操作 |
| 助教检查台 | 同上，筛选视图 | 待检查/缺材料/需复核/已处理 四态筛选 |

---

## 前端与后端差距总结

| 维度 | 后端现状 | 前端现状 | 差距 |
| ---- | -------- | -------- | ---- |
| Auth/登录 | ✅ 完整实现（36 个测试） | ✅ login.html 可用 | 缺：强制改密拦截页、个人信息页、改密页 |
| Users/个人信息 | ✅ GET+PATCH /me 接口已设计 | ❌ 无任何页面 | 需补：个人信息展示、编辑、头像上传、改密 |
| Course（Phase 1） | ⏳ 表设计完成，代码未写 | ❌ 无页面 | 可 mock 先做课程列表/详情 |
| Assignment/Stage（Phase 2） | ⏳ 表设计完成，代码未写 | ❌ 无页面 | 可 mock 先做 |
| Groups（Phase 3） | ⏳ 表设计完成，代码未写 | ❌ 无页面 | 可 mock 先做 |
| MiniTask/Chat（Phase 4） | ⏳ 表设计完成，代码未写 | ❌ 无页面 | 可 mock 先做 |
| Submissions/Reviews（Phase 5） | ❌ 未设计 | ❌ 无页面 | 等后端设计完成 |
| Socket 实时推送 | ✅ 网关/心跳/房间已实现 | ✅ socket-client.ts 骨架完成 | 缺：业务事件处理函数（消息气泡、状态更新） |
| 角色路由分发 | ✅ role 字段在 token/me 接口 | ❌ dashboard 未按角色分发 | 需补：登录后按 role 跳转不同工作台 |
