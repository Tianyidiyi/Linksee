# 课程模块表结构设计 v1

> 本文件先于 Prisma schema 和 SQL 落地。最终以此为准写入 `apps/api/prisma/schema.prisma`。
> 对应需求文档：[docs/product/course-scenario-requirements-v2.md](../../product/course-scenario-requirements-v2.md)
> Auth 组表结构见：[docs/api/auth/auth-tables-design-v2.md](../auth/auth-tables-design-v2.md)

---

## 分阶段建表计划

| 阶段                        | 表                                                                                         | 状态   |
| --------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| **Phase 1（本文档）** | `courses` / `course_teachers` / `course_members` / `assistant_bindings`（补全 FK） | 待实现 |
| **Phase 2（本文档）** | `assignments` / `assignment_group_configs` / `assignment_stages`                     | 待实现 |
| **Phase 3（本文档）** | `groups` / `group_members`                                                             | 待实现 |
| **Phase 4（本文档）** | `mini_tasks` / `chat_conversations` / `chat_messages`                               | 待实现 |
| Phase 5                     | `submissions` / `submission_files` / `reviews`                                       | 待设计 |

---

## Phase 1：`courses` / `course_teachers` / `course_members` / `assistant_bindings`

---

### 表清单（Phase 1，共 4 张）

| 表名                   | 作用                                            |
| ---------------------- | ----------------------------------------------- |
| `courses`            | 课程基础信息（教务处创建）                      |
| `course_teachers`    | 老师与课程的负责关系（academic 指派）           |
| `course_members`     | 学生课程成员名单（academic 导入，限定组队范围） |
| `assistant_bindings` | 助教课程分配关系（已有，补充 FK → courses.id） |

---

### 一、`courses`（课程基础信息）

**设计原则**：只放课程实体本身的属性，不混入人员关系字段。

| 字段              | 类型                              | 说明                                                            |
| ----------------- | --------------------------------- | --------------------------------------------------------------- |
| `id`            | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键，供子表 FK 引用                                        |
| `course_no`     | VARCHAR(30) NOT NULL UNIQUE       | 完整课程号（如 `BSJ084-2026-1-01`），学校系统中的唯一编号     |
| `name`          | VARCHAR(80) NOT NULL              | 课程名称                                                        |
| `academic_year` | SMALLINT NOT NULL                 | 学年（如 `2026` 表示 2025-2026 学年的下半段）                 |
| `semester`      | TINYINT NOT NULL                  | 学期：`1`=春季，`2`=秋季                                    |
| `description`   | TEXT NULL                         | 课程简介（选填）                                                |
| `status`        | ENUM NOT NULL                     | `draft`（草稿）/ `active`（进行中）/ `archived`（已归档） |
| `created_by`    | VARCHAR(10) NOT NULL              | FK →`users.id`（role=academic），创建者                      |
| `created_at`    | DATETIME NOT NULL                 | 创建时间                                                        |
| `updated_at`    | DATETIME NOT NULL                 | 最近更新时间                                                    |

**唯一约束**：`course_no` — 学校课程号全局唯一（含班次，已隐含学年/学期/班序信息）。

**索引**：`INDEX(academic_year, semester)` — 按学年学期筛选课程列表。

**状态流转**：

```
draft → active → archived
         ↑
    （也可从 draft 直接 archived，用于废弃草稿）
```

- `draft`：创建后默认状态，尚未对学生可见
- `active`：正在进行，学生可见、可参与组队和提交
- `archived`：课程结束，只读，不允许新提交和组队操作

**业务约束**（业务层校验，不在 DB 层约束）：

- 只有 `role=academic` 可创建课程
- 只有 `role=academic` 可修改 `status`

---

### 二、`course_teachers`（老师课程负责关系）

**设计说明**：
记录"哪位老师负责哪门课程"（academic 指派）。一门课程可以有多位老师（主讲+合讲），但只有一位 `lead` 主负责人。

与 `assistant_bindings` 的区别：

- `course_teachers` — 老师与课程的负责关系（academic 指派，权限级别高）
- `assistant_bindings` — 助教与课程的分配关系（老师指派，权限范围受限）

| 字段                | 类型                 | 说明                                       |
| ------------------- | -------------------- | ------------------------------------------ |
| `course_id`       | BIGINT UNSIGNED      | FK →`courses.id`                        |
| `teacher_user_id` | VARCHAR(10)          | FK →`users.id`（role=teacher）          |
| `role`            | ENUM NOT NULL        | `lead`（主负责人）/ `co`（合讲老师）   |
| `assigned_by`     | VARCHAR(10) NOT NULL | FK →`users.id`（role=academic），指派人 |
| `created_at`      | DATETIME NOT NULL    | 指派时间                                   |

**主键**：`(course_id, teacher_user_id)` 联合主键，同一老师不可重复指派同一课程。

**业务约束**：

- 每门课程有且只有一位 `lead` 老师（业务层校验）
- 只有 `role=academic` 可以指派或变更老师
- 老师被指派后，才可以在该课程下发布 Assignment、管理小组、创建助教分配

---

### 三、`course_members`（课程学生成员名单）

**设计说明**：
记录"哪些学生属于本课程"，是组队资格的来源依据。
只有 `course_members` 中的学生才能在该课程下参与小组组建。

| 字段                | 类型                 | 说明                                           |
| ------------------- | -------------------- | ---------------------------------------------- |
| `course_id`       | BIGINT UNSIGNED      | FK →`courses.id`                            |
| `student_user_id` | VARCHAR(10)          | FK →`users.id`（role=student）              |
| `status`          | ENUM NOT NULL        | `active`（在籍）/ `withdrawn`（已退课）    |
| `imported_by`     | VARCHAR(10) NOT NULL | FK →`users.id`（role=academic），导入操作人 |
| `created_at`      | DATETIME NOT NULL    | 加入时间                                       |

**主键**：`(course_id, student_user_id)` 联合主键，防止重复导入。

**索引**：

- `INDEX(student_user_id)` — 查询某学生参与的所有课程

**业务约束**：

- 只有 `role=academic` 可导入/维护学生名单
- `withdrawn` 状态的学生不可参与新的组队操作，但历史数据保留
- 同一学生可加入多门课程（跨课程独立记录）

**P0 说明**：
需求文档提到"班级层"（课程 → 班级 → 项目 → 小组）。P0 阶段暂不建独立的 `course_classes` 表，
`course_members` 作为扁平名单使用。若后续需要按行政班分组展示，可新增 `course_classes` 表并在本表加 `class_id` 字段。

---

### 四、`assistant_bindings`（助教课程分配关系，补全 FK）

> 本表已在 Auth 组建立，此处仅记录 Phase 1 需补充的外键约束。

**现有结构**（已存在）：

| 字段                  | 类型            | 说明                                |
| --------------------- | --------------- | ----------------------------------- |
| `assistant_user_id` | VARCHAR(10)     | FK →`users.id`（role=assistant） |
| `teacher_user_id`   | VARCHAR(10)     | 执行分配操作的老师（审计字段）      |
| `course_id`         | BIGINT UNSIGNED | 待补充 FK →`courses.id`          |
| `created_at`        | DATETIME        | 分配时间                            |

**Phase 1 需执行的变更**：

```sql
ALTER TABLE assistant_bindings
  ADD CONSTRAINT fk_ab_course
  FOREIGN KEY (course_id) REFERENCES courses(id);
```

> 建表顺序：`courses` 必须在 `assistant_bindings` 补充 FK 之前存在。

**补全后的完整业务流程**：

```
POST /users/assistants          → teacher_assistants（归属记录）
POST /courses/{id}/assistants   → assistant_bindings（分配记录，需校验归属）
```

---

### 五、ID 规范

| 实体                         | ID 类型                        | 说明                                        |
| ---------------------------- | ------------------------------ | ------------------------------------------- |
| 课程 `courses.id`          | BIGINT UNSIGNED AUTO_INCREMENT | 内部主键，子表 FK 引用                      |
| 课程号 `courses.course_no` | VARCHAR(30) UNIQUE             | 给人看的完整课程号，如 `BSJ084-2026-1-01` |
| 用户 `users.id`            | VARCHAR(10)                    | 一卡通号，如 `2000000001`                 |

**设计原则**：`id` 只供数据库内部关联使用，`course_no` 是对外展示和 API 查询用的业务标识。两者职责分离，互不混用。

后续课程组实体（Assignment、Stage、Group 等）的主键类型待各阶段设计时确定，不强制统一为 UUID。

---

### 六、与 Auth 组的跨表关系总览

```
users (id)
  ├── course_teachers.teacher_user_id   (老师负责课程)
  ├── course_teachers.assigned_by        (教务指派人)
  ├── course_members.student_user_id    (学生课程成员)
  ├── course_members.imported_by         (教务导入人)
  ├── assistant_bindings.assistant_user_id
  └── courses.created_by                 (教务创建人)

courses (id)
  ├── course_teachers.course_id
  ├── course_members.course_id
  └── assistant_bindings.course_id      (Phase 1 补充 FK)
```

---

### 七、决策记录

| 问题                                             | 决策                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 课程 ID 格式                                     | BIGINT AUTO_INCREMENT，`course_no` VARCHAR(30) UNIQUE 存完整课程号（如 `BSJ084-2026-1-01`）                            |
| 是否建独立班级表（`course_classes`）           | P0 不建，`course_members` 扁平名单代替；P1 视需要补充                                                                    |
| 一门课程可以有几位老师                           | 多位（lead + co），但业务层保证只有一位 lead                                                                               |
| 老师与助教是否合并为一张表                       | 不合并；teacher 由 academic 指派（`course_teachers`）；assistant 由 teacher 分配（`assistant_bindings`），权限来源不同 |
| `course_members.status` 软删除还是枚举         | 枚举（active/withdrawn），保留历史数据，不物理删除                                                                         |
| `assistant_bindings.teacher_user_id` 是否加 FK | Phase 1 维持审计字段（无 FK），外键随 `course_id` FK 一起在 Phase 1 评估                                                 |
| 操作留痕（审计日志）                             | 后置，暂不建表；成绩相关留痕在 Phase 5 评估                                                                                |

---

---

## Phase 2：`assignments` / `assignment_group_configs` / `assignment_stages`

> 对应需求文档：场景 A（项目发布）、场景 D（Stage-MiniTask）、第八节（Stage-MiniTask 机制细化）

---

### 表清单（Phase 2，共 3 张）

| 表名                         | 作用                                                 |
| ---------------------------- | ---------------------------------------------------- |
| `assignments`              | 老师在课程下发布的项目主体信息                       |
| `assignment_group_configs` | 项目组队规则（1:1，可选）                            |
| `assignment_stages`        | 项目下的阶段（老师定义"做什么、何时提交、怎么验收"） |

---

### 一、`assignments`（课程项目）

**设计说明**：
老师在课程下发布的项目。一门课程可以有多个 Assignment（但 P0 通常只有一个）。
Assignment 是组队与提交的业务上层实体：学生围绕某个 Assignment 组建 Group，后续所有 Stage 都归属于 Assignment。
本表只保留项目主体信息；组队规则拆分到 `assignment_group_configs`，降低耦合与写放大。

| 字段                  | 类型                              | 说明                                                            |
| --------------------- | --------------------------------- | --------------------------------------------------------------- |
| `id`                | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键                                                        |
| `course_id`         | BIGINT UNSIGNED NOT NULL          | FK →`courses.id`                                             |
| `title`             | VARCHAR(120) NOT NULL             | 项目标题                                                        |
| `description`       | TEXT NULL                         | 项目说明（选填）                                                |
| `description_files` | JSON NULL                         | 项目描述附件清单（选填），如任务书/模板文档；业务层可为空       |
| `status`            | ENUM NOT NULL                     | `draft`（草稿）/ `active`（进行中）/ `archived`（已归档） |
| `created_by`        | VARCHAR(10) NOT NULL              | FK →`users.id`（role=teacher），发布者                       |
| `created_at`        | DATETIME NOT NULL                 | 创建时间                                                        |
| `updated_at`        | DATETIME NOT NULL                 | 最近更新时间                                                    |

**索引**：

- P0 暂不新增 `course_id` 单列索引（每课程通常仅 1-2 个项目，收益有限）
- 若后续进入 P1/P2 且单课程项目数显著增长，再补 `INDEX(course_id)`

**状态流转**：

```
draft → active → archived
```

- `draft`：发布前，学生不可见
- `active`：发布后，学生可见、可组队、可提交
- `archived`：课程结束，只读

**业务约束**（业务层校验）：

- 只有 `course_teachers` 中该课程的 teacher 或 academic 可创建 Assignment
- `description_files` 允许为空；非空时建议校验为文件元数据数组（例如 `{name,objectKey,size,mimeType,uploadedAt}`）
- `description_files` 仅保存元数据，不保存文件二进制

**附件存储与拉取（约定）**：

- 文件实体存放在对象存储（MinIO，建议单独 bucket 如 `course-materials`）
- `description_files[].objectKey` 保存对象键（例如 `courses/{courseId}/assignments/{assignmentId}/spec-v1.pdf`）
- 学生拉取流程：
  1. 学生请求 Assignment 详情接口
  2. 后端返回附件元数据列表（不回传文件内容）
  3. 学生点击下载时，后端校验课程成员权限后，返回短时效下载链接（presigned URL）
  4. 前端用该下载链接直连对象存储拉取文件
- 若部署阶段先采用公开读 bucket，也可直接返回公开 URL；生产环境优先使用短时效签名链接

---

### 二、`assignment_group_configs`（项目组队规则）

**设计说明**：
将组队策略从 `assignments` 拆出，避免老师修改组队时间时频繁更新项目主体行。
本表为 1:1 可选关系：Assignment 创建后可立即有配置，也可后续补录。

| 字段                 | 类型                                    | 说明                                                                |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| `assignment_id`    | BIGINT UNSIGNED PK                      | FK →`assignments.id`，一对一主键                                 |
| `group_form_start` | DATETIME NULL                           | 组队开放时间（NULL = 立即开放）                                     |
| `group_form_end`   | DATETIME NULL                           | 组队截止时间（NULL = 不设截止）                                     |
| `group_min_size`   | TINYINT UNSIGNED NOT NULL DEFAULT 1     | 每组最少人数（仅约束学生自助组队）                                  |
| `group_max_size`   | TINYINT UNSIGNED NOT NULL DEFAULT 6     | 每组最多人数（仅约束学生自助组队）                                  |
| `max_groups`       | SMALLINT UNSIGNED NULL                  | 项目最大小组数（NULL = 不限；仅约束学生自助组队）                   |
| `regroup_policy`   | ENUM NOT NULL DEFAULT 'teacher_decides' | 截止后整理策略：`teacher_decides` / `auto_then_teacher_confirm` |
| `updated_by`       | VARCHAR(10) NOT NULL                    | FK →`users.id`（teacher 或 academic），最近修改人                |
| `updated_at`       | DATETIME NOT NULL                       | 最近修改时间                                                        |

**业务约束**：

- `group_min_size <= group_max_size`
- `group_form_start < group_form_end`（如两者均不为 NULL）
- 上述限制仅在学生自助操作时强制校验；老师/助教直接操作不受约束

---

### 三、`assignment_stages`（项目阶段）

**设计说明**：
老师在 Assignment 下定义阶段。Stage 是"小组需要在什么时候交什么"的框架，MiniTask 是小组内部执行拆分（Phase 4 建表）。
Stage 默认不可删除，只能归档（保留历史）。

| 字段                  | 类型                              | 说明                                                                                                      |
| --------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`                | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键                                                                                                  |
| `assignment_id`     | BIGINT UNSIGNED NOT NULL          | FK →`assignments.id`                                                                                   |
| `stage_no`          | TINYINT UNSIGNED NOT NULL         | 阶段序号（第几阶段，建议从 1 开始）                                                                       |
| `title`             | VARCHAR(120) NOT NULL             | 阶段标题（如"第一阶段：需求调研报告"）                                                                    |
| `description`       | TEXT NULL                         | 阶段目标说明                                                                                              |
| `start_at`          | DATETIME NULL                     | 阶段开始时间（NULL = 由 Assignment 激活时立即开始）                                                       |
| `due_at`            | DATETIME NULL                     | 提交截止时间（NULL = 不设截止）                                                                           |
| `weight`            | DECIMAL(5,2) NULL                 | 本阶段占项目总分的权重（如 `30.00` 表示 30%；NULL = 不计权重）                                          |
| `submission_desc`   | TEXT NULL                         | 提交要求说明（老师写给学生的提交指引）                                                                    |
| `requirement_files` | JSON NULL                         | 提交要求附件清单（选填，多文件），如模板/规范/评分细则                                                    |
| `accept_criteria`   | TEXT NULL                         | 验收标准（老师写给助教/自己的批改参考）                                                                   |
| `status`            | ENUM NOT NULL DEFAULT 'planned'   | `planned`（已配置未开始）/ `open`（进行中可提交）/ `closed`（截止后关闭提交）/ `archived`（归档） |
| `created_by`        | VARCHAR(10) NOT NULL              | FK →`users.id`（role=teacher）                                                                         |
| `created_at`        | DATETIME NOT NULL                 | 创建时间                                                                                                  |
| `updated_at`        | DATETIME NOT NULL                 | 最近更新时间                                                                                              |

**索引**：

- `INDEX(assignment_id, stage_no)` — 按顺序列出某项目下所有阶段
- `UNIQUE(assignment_id, stage_no)` — 同一项目内阶段序号唯一

**业务约束**：

- 只有该 Assignment 所在课程的 teacher 可创建/修改 Stage
- Stage 不可物理删除，状态只能改为 `archived`
- 同一 Assignment 下各 Stage 的 `weight` 之和若全部填写，业务层建议校验是否超过 100（但不强制，允许未填或灵活分配）
- `stage_no` 用于业务识别"第几阶段"，创建时自动赋值 `MAX(stage_no) + 1`，`ORDER BY stage_no ASC` 即为展示顺序；如需调整阶段顺序，通过 API swap `stage_no` 实现
- 时间窗口建议满足：`start_at < due_at`（如两者均不为 NULL）
- `grading` / `completed` 不作为 Stage 持久状态，统一由 `submissions` / `reviews` 实时计算展示
- `requirement_files` 允许为空；非空时建议校验为文件元数据数组（例如 `{name,objectKey,size,mimeType,uploadedAt}`）

**状态流转建议（灵活但可审计）**：

```
planned -> open -> closed -> archived
  |         |
  |         +-> archived
  +----------------------> archived
```

- `planned`：老师已配置但尚未开放（可预排多个阶段）
- `open`：学生可提交
- `closed`：超过截止时间或老师手动关闭，不再接收新提交
- `archived`：历史归档

**计算态展示（不落库）**：

- `grading`：当该 Stage 存在 `submitted/under_review/resubmitted` 等未完成提交流程时，前端可展示“批改中”
- `completed`：当该 Stage 覆盖的目标小组都达到 `approved`（或等价完成态）时，前端可展示“已完成”

**开始时间语义**：

- 若 `start_at` 为 NULL，且 Assignment 进入 `active`，该阶段默认可按 `planned -> open` 规则自动开放（由业务层决定是否自动）
- 若设置了 `start_at`，到点前保持 `planned`，到点后可自动切换 `open`

---

### 四、与 Phase 1 的跨表关系

```
courses (id)
  └── assignments.course_id

assignments (id)
  ├── assignment_group_configs.assignment_id
  └── assignment_stages.assignment_id

users (id)
  ├── assignments.created_by       (老师)
  ├── assignment_group_configs.updated_by
  └── assignment_stages.created_by (老师)
```

---

### 五、小组完成态表达（为 Phase 5 预留）

你提到的“某小组完成一个 stage / 完成整个 assignment”，建议按以下方式表达：

- 小组完成某 Stage：以 `submissions`（Phase 5）中 `(group_id, stage_id)` 的最新记录状态判定
- 小组完成整个 Assignment：该 Assignment 下所有必做 Stage 都达到“完成条件”（例如对应提交流程为 `approved`）后判定

建议的 Stage 提交流转（小组视角）：

```
not_started -> draft -> submitted -> under_review -> needs_changes -> resubmitted -> approved
```

实现建议：

- 源数据放在 `submissions` / `reviews`，不要在 `groups` 表冗余存“是否完成 assignment”
- 列表页性能需要时，可加一张汇总快照表（如 `group_assignment_progress`）异步回填

---

### 六、Phase 2 决策记录

| 问题                                        | 决策                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Assignment ID 格式                          | BIGINT AUTO_INCREMENT，与 courses 一致                                                                |
| Assignment 描述文件怎么存                   | 文件存 MinIO；`assignments.description_files` 用 JSON（可空）存附件元数据与 objectKey               |
| 是否给 `assignments.course_id` 单独建索引 | P0 不建（课程项目数少）；数据量上来后再按实际查询补索引                                               |
| Stage ID 格式                               | BIGINT AUTO_INCREMENT                                                                                 |
| 组队规则存在哪                              | 独立 `assignment_group_configs`（1:1，可选），与项目主体解耦                                        |
| Stage 状态如何设计                          | 持久层采用四态 `planned/open/closed/archived`；`grading/completed` 作为计算态展示                 |
| 是否增加“第几阶段”字段                    | 增加 `stage_no`，并在同 assignment 内唯一                                                           |
| Stage 是否要开始时间                        | 增加 `start_at`（可空），支持预排与自动开启                                                         |
| `display_order` 是否保留                  | **不保留**；`stage_no` 即为展示顺序，创建时自动赋 MAX+1，重排时 swap stage_no 值                   |
| Stage 可否删除                              | 不可删除，只能 archived（需求文档：Stage 默认不可删除，可归档）                                       |
| `weight` 是否强制合计 100                 | 不强制（业务层建议提示，但允许留空或灵活分配）                                                        |
| 提交要求字段粒度                            | `submission_desc`（文本）+ `requirement_files`（多附件）+ `accept_criteria`（验收口径）分层表达 |
| 小组完成 stage/assignment 如何表达          | 基于 `submissions/reviews` 计算，不在 `groups` 冗余硬编码完成态                                   |

---

### 七、扩展考虑（按需启用）

以下字段在真实教学场景中常见，但建议按需求分批落地，不要一次性全开：

| 建议项                                            | 推荐位置                     | 作用                                       | P0 是否必需 |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------ | ----------- |
| `visibility`（private/internal/public）         | `assignments`              | 控制项目对课程成员可见性                   | 否          |
| `allow_late_submission` + `late_penalty_rate` | `assignment_stages`        | 支持迟交和扣分策略                         | 否          |
| `repo_template_url`                             | `assignments`              | 给小组统一仓库模板                         | 否          |
| `submission_schema`（JSON）                     | `assignment_stages`        | 约束提交字段（如必须含 repo_url/demo_url） | 否          |
| `rubric_template_id`                            | `assignment_stages`        | 绑定评分模板，提升批改一致性               | 否          |
| `frozen_at`                                     | `assignment_group_configs` | 标记组队名单冻结时间点                     | 否          |

**实施建议**：先落地当前三表和基础字段，等 Phase 5（提交与批改）联调时，再启用 `submission_schema` 与 `rubric_template_id` 两项，收益最高。

---

## Phase 3：`groups` / `group_members`

---

### 表清单（Phase 3，共 2 张）

| 表名             | 作用                                                   |
| ---------------- | ------------------------------------------------------ |
| `groups`       | 小组实体（隶属于 Assignment）                          |
| `group_members` | 小组成员关系，含角色与加入时间                         |

> `group_no` 是对外展示与管理用的编号（可重排），`groups.id` 是内部稳定主键供子表 FK 引用。

---

### 一、`groups`（小组）

**设计原则**：小组归属于 Assignment（非 Stage、非 Course）。`group_no` 负责展示与排序，`id` 负责稳定引用。

| 字段            | 类型                              | 说明                                                                               |
| --------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `id`          | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键，供子表（group_members / submissions）FK 引用                            |
| `assignment_id` | BIGINT UNSIGNED NOT NULL          | FK → `assignments.id`，小组所属项目                                             |
| `group_no`    | TINYINT UNSIGNED NOT NULL         | 展示组号（如"第3组"）；先占先得；可被重排；UNIQUE per assignment                |
| `name`        | VARCHAR(60) NULL                  | 小组自定义名称（选填；为空时前端可回退展示"第 N 组"）                            |
| `status`      | ENUM NOT NULL DEFAULT 'forming'   | `forming`（组队中）/ `active`（已锁定/正式）/ `archived`（已解散/合并归档） |
| `created_by`  | VARCHAR(10) NOT NULL              | FK → `users.id`（role=student），创建小组的学生（初始组长）                    |
| `created_at`  | DATETIME NOT NULL                 | 创建时间                                                                           |
| `updated_at`  | DATETIME NOT NULL                 | 最近更新时间                                                                       |

**索引**：

- `UNIQUE(assignment_id, group_no)` — 同一项目内组号唯一

**业务约束**：

- 小组不可物理删除，只能 `archived`（合并/解散场景）
- 组长通过 `group_members.role = 'leader'` 标记，不在本表冗余 `leader_id`
- `forming` → `active`：由老师手动触发"锁定组队"，或到达 `assignment_group_configs.grouping_deadline` 后系统自动切换
- `group_no` 重排：截止后老师触发，应用层 swap `group_no` 值，不影响 `id` 引用
- 老师/助教操作不受 `assignment_group_configs` 人数与组数上限约束（约束仅作用于学生自助组队阶段）

**状态流转**：

```
forming -> active -> archived
  |
  +-> archived（直接解散）
```

---

### 二、`group_members`（小组成员）

**设计原则**：P0 采用硬删除（退组时物理删行）保持简单；`assignment_id` 作为冗余列以实现 DB 级"同一学生在同一项目只能属于一个小组"约束。

| 字段            | 类型                        | 说明                                                         |
| --------------- | --------------------------- | ------------------------------------------------------------ |
| `id`          | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键                                                 |
| `group_id`    | BIGINT UNSIGNED NOT NULL    | FK → `groups.id`                                          |
| `assignment_id` | BIGINT UNSIGNED NOT NULL  | 冗余列（= groups.assignment_id），用于 UNIQUE 约束         |
| `user_id`     | VARCHAR(10) NOT NULL        | FK → `users.id`（role=student）                           |
| `role`        | ENUM NOT NULL DEFAULT 'member' | `leader`（组长）/ `member`（普通成员）                  |
| `joined_at`   | DATETIME NOT NULL           | 加入时间（创建时写入 `NOW()`）                              |

**索引**：

- `UNIQUE(assignment_id, user_id)` — DB 级强制：同一项目每名学生只能属于一个小组
- `INDEX(group_id)` — 按小组查成员列表

**业务约束**：

- 每个小组有且仅有一名 `role='leader'`（应用层保证，不在 DB 层强制）
- 组长转让：更新原组长 `role='member'`，新组长 `role='leader'`（同一事务）
- 退组/踢出：物理删除该行；应用层可写审计日志（Phase 5 或独立审计表）
- 学生自助加入/申请流程（join_requests）不在本表，见下方注
- 学生自助加入/申请流程（join_requests）属于扩展功能，P0-A 不实现；见下方"五、扩展考虑"说明

---

### 三、与上层表的跨表关系

```
courses (id)
  └── assignments.course_id

assignments (id)
  ├── assignment_group_configs.assignment_id   (组队规则)
  └── groups.assignment_id

groups (id)
  └── group_members.group_id

users (id)
  ├── groups.created_by            (创建小组的学生)
  └── group_members.user_id        (成员)
```

---

### 四、Phase 3 决策记录

| 问题                                      | 决策                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 小组归属层级                              | Assignment（非 Stage、非 Course）；Stage 级约束通过 submissions 表关联 stage_id 体现                                      |
| group_no vs id 分离                       | `id` 稳定供 FK；`group_no` 仅展示与排序，截止后可重排不影响引用完整性                                                   |
| 组长字段位置                              | 放在 `group_members.role='leader'`，不在 `groups` 冗余 `leader_id`；leader 唯一性由应用层保证                           |
| 同一学生同一项目只能在一个组              | `group_members` 加冗余列 `assignment_id` + `UNIQUE(assignment_id, user_id)`，DB 层强制                                   |
| 退组是否保留历史                          | P0 硬删除；若需审计留痕，应用层写日志或后续加 `group_member_logs` 表                                                     |
| group 是否可删除                          | 不可物理删除，`status='archived'` 软归档                                                                                 |
| 加入申请/邀请流程                         | 不在本 Phase；`group_join_requests` 作为 Phase 4 待设计表（P0-A 若只做老师直接调组可跳过）                              |
| 学生自助组队 P0-A 实现范围                | **只实现老师/助教直接调组**；申请加入与邀请机制不在 P0-A 范围内                                                          |
| 人数/组数限制在哪层校验                   | 应用层读 `assignment_group_configs` 校验；老师/助教操作绕过此限制；DB 层不设 trigger                                     |
| group_no 重排触发方式                     | 应用层 batch update（swap group_no），老师手动触发或到达 `grouping_deadline` 自动触发；DB 无存储过程                     |

---

### 五、扩展考虑（按需启用）

以下为学生自助组队场景所需，P0-A 跳过，P0-B/P1 按需落地：

**`group_join_requests`（申请/邀请流水表）**

| 字段           | 类型                    | 说明                                                        |
| -------------- | ----------------------- | ----------------------------------------------------------- |
| `id`         | BIGINT UNSIGNED PK      | 内部主键                                                    |
| `group_id`   | BIGINT UNSIGNED NOT NULL | FK → `groups.id`，目标小组                               |
| `assignment_id` | BIGINT UNSIGNED NOT NULL | 冗余列，方便查询同一项目下的待处理请求                  |
| `user_id`    | VARCHAR(10) NOT NULL    | 被申请人/被邀请人（FK → `users.id`）                     |
| `type`       | ENUM NOT NULL           | `apply`（学生主动申请加入）/ `invite`（组长邀请成员）   |
| `status`     | ENUM NOT NULL DEFAULT 'pending' | `pending` / `accepted` / `rejected` / `expired`   |
| `created_by` | VARCHAR(10) NOT NULL    | 发起人（FK → `users.id`）                                |
| `resolved_by` | VARCHAR(10) NULL       | 处理人（FK → `users.id`）                                |
| `resolved_at` | DATETIME NULL          | 处理时间                                                    |
| `expires_at` | DATETIME NULL           | 过期时间（可选；超时后应用层/定时任务置为 `expired`）     |
| `created_at` | DATETIME NOT NULL       | 创建时间                                                    |

**业务说明**：
- `apply`：学生主动发起，由目标组长或老师/助教审批
- `invite`：组长发起，由被邀请学生确认
- 审批通过后写入 `group_members`；校验逻辑（是否超员、是否已在其他组）在应用层执行
- 同一 `(group_id, user_id)` 同时只允许存在一条 `pending` 记录（应用层或 UNIQUE 约束控制）
- 同一 `(group_id, user_id)` 同时只允许存在一条 `pending` 记录（应用层或 UNIQUE 约束控制）

---

## Phase 4：`mini_tasks` / `chat_conversations` / `chat_messages`

---

### 表清单（Phase 4，共 3 张）

| 表名                   | 作用                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| `mini_tasks`         | 小组内部执行任务（由组员拆分，对应 Stage 下的具体分工）                       |
| `chat_conversations` | 统一会话表：既支持项目组内群聊（group），也支持课程群聊（course）             |
| `chat_messages`      | 统一消息表：会话下的文本/附件消息，供 HTTP 历史查询与 Socket 实时推送共用      |

---

### 一、`mini_tasks`（小组执行任务）

**设计原则**：MiniTask 是 Stage 框架下小组自己拆分的执行单元。可选挂靠 Stage（`stage_id` 可空），也可以是小组独立的自由任务。

| 字段             | 类型                              | 说明                                                                                                          |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`           | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键                                                                                                      |
| `group_id`     | BIGINT UNSIGNED NOT NULL          | FK → `groups.id`，所属小组                                                                                 |
| `stage_id`     | BIGINT UNSIGNED NULL              | FK → `assignment_stages.id`，挂靠的阶段（可空；为空表示小组自由任务，不挂靠任何 Stage）                    |
| `title`        | VARCHAR(120) NOT NULL             | 任务标题                                                                                                      |
| `description`  | TEXT NULL                         | 任务详情                                                                                                      |
| `assignee_id`  | VARCHAR(10) NULL                  | FK → `users.id`，负责人（可空；可为空表示暂未指派）                                                       |
| `priority`     | ENUM NOT NULL DEFAULT 'medium'    | `low` / `medium` / `high`                                                                                 |
| `status`       | ENUM NOT NULL DEFAULT 'todo'      | `todo`（待开始）/ `in_progress`（进行中）/ `done`（已完成）/ `cancelled`（已取消）                    |
| `due_at`       | DATETIME NULL                     | 任务截止时间（可空）                                                                                          |
| `created_by`   | VARCHAR(10) NOT NULL              | FK → `users.id`，创建人（组长或组员）                                                                     |
| `created_at`   | DATETIME NOT NULL                 | 创建时间                                                                                                      |
| `updated_at`   | DATETIME NOT NULL                 | 最近更新时间                                                                                                  |

**索引**：

- `INDEX(group_id, stage_id)` — 查某小组在某 Stage 下的任务列表
- `INDEX(group_id, status)` — 按状态筛任务
- `INDEX(assignee_id)` — 按负责人查任务

**业务约束**：

- MiniTask 可物理删除（小组内部执行项，无强制审计要求）；也可改为 `cancelled` 软删除，P0 按实际需求决定
- `stage_id` 为空时，该任务不计入任何 Stage 的进度统计
- 负责人必须是该 `group_id` 对应小组的成员（应用层校验）
- 不设复杂审批流（无"提案-组长审核"），P0 任何组员均可直接创建和修改任务

---

### 二、`chat_conversations`（统一会话：项目组群聊 + 课程群聊）

**设计原则**：
- 会话按业务对象一一绑定：`course` 会话绑定课程，`group` 会话绑定小组
- 保证"每门课程一个课程群"、"每个小组一个项目群"（稳定会话，不随展示编号变化）
- Socket 房间与会话实体对齐，避免一套房间规则、另一套数据库规则

| 字段               | 类型                               | 说明                                                                 |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------- |
| `id`             | BIGINT UNSIGNED AUTO_INCREMENT PK  | 内部主键                                                             |
| `scope_type`     | ENUM NOT NULL                      | `course` / `group`                                                   |
| `scope_id`       | BIGINT UNSIGNED NOT NULL           | 业务对象主键：`course` 对应 `courses.id`，`group` 对应 `groups.id`  |
| `room_key`       | VARCHAR(64) NOT NULL UNIQUE        | Socket 房间键：`course:{courseId}` 或 `group:{groupId}`            |
| `status`         | ENUM NOT NULL DEFAULT 'active'     | `active` / `archived`                                                |
| `created_by`     | VARCHAR(10) NOT NULL               | FK → `users.id`                                                      |
| `created_at`     | DATETIME NOT NULL                  | 创建时间                                                             |
| `updated_at`     | DATETIME NOT NULL                  | 最近更新时间                                                         |

**索引与约束**：

- `UNIQUE(scope_type, scope_id)` — 每个课程/小组只有一个固定会话
- `UNIQUE(room_key)` — 与 socket room 一一映射

**业务约束**：

- 课程创建时自动创建 `scope_type='course'` 会话
- 小组创建时自动创建 `scope_type='group'` 会话
- `group_no` 变化不影响会话：会话绑定 `groups.id`（稳定主键）
- `archived` 会话仅历史可读，不再允许发新消息

---

### 三、`chat_messages`（统一消息）

**设计原则**：
- 所有群聊消息统一落库（课程群 + 项目组群）
- Socket 只做"实时分发"，消息真相源在 DB（用于补拉、追溯、审计）

| 字段                | 类型                               | 说明                                                                                                      |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`              | BIGINT UNSIGNED AUTO_INCREMENT PK  | 内部主键                                                                                                  |
| `conversation_id` | BIGINT UNSIGNED NOT NULL           | FK → `chat_conversations.id`                                                                             |
| `sender_id`       | VARCHAR(10) NOT NULL               | FK → `users.id`                                                                                           |
| `content`         | TEXT NULL                          | 文本内容（可空；纯附件消息时为空）                                                                        |
| `files`           | JSON NULL                          | 附件元数据数组：`{name, objectKey, size, mimeType, uploadedAt}`                                          |
| `reply_to_id`     | BIGINT UNSIGNED NULL               | FK → `chat_messages.id`，回复引用（可空）                                                                 |
| `event_id`        | VARCHAR(64) NOT NULL UNIQUE        | 对应 `EventEnvelope.id`，用于幂等与排查                                                                   |
| `trace_id`        | VARCHAR(64) NOT NULL               | 对应链路追踪 ID                                                                                            |
| `created_at`      | DATETIME NOT NULL                  | 消息创建时间                                                                                                |
| `deleted_at`      | DATETIME NULL                      | 撤回时间（可空；P0 可先不开放撤回能力）                                                                   |

**索引**：

- `INDEX(conversation_id, created_at, id)` — 历史消息分页（按时间 + 主键稳定排序）
- `INDEX(sender_id, created_at)` — 查用户发言轨迹（审计/排障）

**业务约束**：

- `content` 与 `files` 不能同时为空（应用层校验）
- 消息默认不可编辑；撤回采用 `deleted_at` 软删除语义
- 发言权限按会话类型校验：
  - 课程群：课程内老师/助教/课程成员学生可发言
  - 项目组群：该组成员可发言；老师/助教默认可读（是否可发言由策略开关控制）

---

### 四、与上层表的跨表关系

```
assignments (id)
  └── assignment_stages.assignment_id

groups (id)
  ├── mini_tasks.group_id
  └── chat_conversations(scope_type='group').scope_id

courses (id)
  └── chat_conversations(scope_type='course').scope_id

chat_conversations (id)
  └── chat_messages.conversation_id

assignment_stages (id)
  └── mini_tasks.stage_id   (可空)

users (id)
  ├── mini_tasks.assignee_id
  ├── mini_tasks.created_by
  ├── chat_conversations.created_by
  └── chat_messages.sender_id
```

---

### 五、Phase 4 决策记录

| 问题                                          | 决策                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 是否保留 `group_messages` 单表                 | 不保留；改为 `chat_conversations` + `chat_messages` 统一模型，支持课程群与项目组群                    |
| 课程群与项目组群如何绑定                       | 通过 `scope_type + scope_id` 绑定业务对象，且 `UNIQUE(scope_type, scope_id)`                        |
| Socket room 如何与 DB 对齐                     | `room_key` 固定为 `course:{courseId}` / `group:{groupId}`，与现有网关 `validateRealtimeRoom` 对齐   |
| 消息是否只靠 Socket                            | 否；先写 DB 再推 Socket，历史查询永远走 DB，实时仅做增量推送                                          |
| 每个学生在每个项目是否有固定群                 | 是；学生所在 `groups.id` 对应一个固定 group 会话，成员变更只影响权限，不新建会话                      |
| 老师直接划分组对群聊影响                       | 调整 `group_members` 后即时影响该组会话发言权限，不改会话主键与 room_key                              |
| 课程群是否本 Phase 纳入                        | 纳入；课程群与项目组群在同一实时框架下实现                                                              |

---

## Phase 4 扩展：Socket 群聊对齐设计（项目组群 + 课程群）

---

### 一、与现有 Socket 基建对齐点

- 房间命名复用现有规则：`course:{courseId}`、`group:{groupId}`（见 `socket-events.ts`）
- 服务端推送复用 `SERVER_SOCKET_EVENTS.realtimeEvent`（事件载荷为 `EventEnvelope`）
- 网关职责不变：连接鉴权、订阅房间、转发事件，不执行业务写库（见 `gateway.ts` 注释）

### 二、建议新增/对齐事件名

当前已存在：`group.message.created`。

建议在契约中补充：
- `course.message.created`：课程群消息新增推送
- `conversation.archived`（可选）：会话归档通知

事件 payload 建议最小化：

```json
{
  "conversationId": 1001,
  "scopeType": "group",
  "scopeId": 23,
  "messageId": 89001,
  "senderId": "2023010001",
  "preview": "今晚 8 点前提交原型图",
  "createdAt": "2026-05-07T10:00:00+08:00"
}
```

### 三、写入与推送时序（强一致体验）

1. 客户端调用 HTTP 发送消息（带 `Idempotency-Key`）
2. 应用层做权限校验（是否该课程/小组成员）
3. DB 事务写入 `chat_messages`
4. 事务成功后发布 `EventEnvelope` 到事件发布器（`publisher.ts`）
5. Realtime Gateway `push(room, event)` 推送到 `course:*` 或 `group:*`
6. 客户端收到 `realtime:event` 后增量渲染；必要时按 `conversationId` 补拉历史

> 关键原则：**先落库，后推送**。Socket 投递失败不影响消息持久化，客户端可通过历史接口补偿。

### 四、客户端订阅策略（与现有 `socket-client.ts` 对齐）

- 登录后默认订阅：用户所属课程房间（`course:*`）+ 所属小组房间（`group:*`）
- 切换到具体会话页时可再次显式 `subscribe(room)`（幂等）
- `onEvent` 仅处理增量事件；首次进入页面必须调用 HTTP 拉首屏消息

### 五、权限与边界

**课程群（`course:{courseId}`）**
- 可订阅 Socket 房间：老师、助教、课程内学生成员
- 可发言：同上

**项目组群（`group:{groupId}`）**
- 可订阅 Socket 房间：**仅该小组成员（学生）**
- 老师/助教**不订阅** `group:*` 房间，不通过 Socket 接收组内消息实时推送
- 老师/助教查阅组内历史消息走 HTTP 接口（按需拉取，不实时订阅）
- 可发言：仅组成员，应用层校验 `group_members` 表

**Gateway 侧执行**：`gateway.ts` 中 `authenticate()` 返回的 `groupIds` 只注入该用户实际所在的小组 ID；老师/助教返回空 `groupIds`，不自动加入任何 `group:*` 房间。

### 六、扩展能力（非 P0 强制）

- `chat_message_reads`：已读回执
- `chat_pins`：置顶消息
- `chat_mentions`：@ 提及
- Outbox 重试：`event_outbox` 表保障"写库成功但推送失败"的重放
