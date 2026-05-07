# 课程模块表结构设计 v1

> 本文件先于 Prisma schema 和 SQL 落地。最终以此为准写入 `apps/api/prisma/schema.prisma`。  
> 对应需求文档：[docs/product/course-scenario-requirements-v2.md](../../product/course-scenario-requirements-v2.md)  
> Auth 组表结构见：[docs/api/auth/auth-tables-design-v2.md](../auth/auth-tables-design-v2.md)

---

## 分阶段建表计划

| 阶段 | 表 | 状态 |
|------|---|------|
| **Phase 1（本文档）** | `courses` / `course_teachers` / `course_members` / `assistant_bindings`（补全 FK） | 待实现 |
| **Phase 2（本文档）** | `assignments` / `assignment_group_configs` / `assignment_stages` | 待实现 |
| Phase 3 | `groups` / `group_members` | 待设计 |
| Phase 4 | `mini_tasks` / `group_messages` | 待设计 |
| Phase 5 | `submissions` / `submission_files` / `reviews` | 待设计 |

---

## 表清单（Phase 1，共 4 张）

| 表名 | 作用 |
|------|------|
| `courses` | 课程基础信息（教务处创建） |
| `course_teachers` | 老师与课程的负责关系（academic 指派） |
| `course_members` | 学生课程成员名单（academic 导入，限定组队范围） |
| `assistant_bindings` | 助教课程分配关系（已有，补充 FK → courses.id） |

---

## 一、`courses`（课程基础信息）

**设计原则**：只放课程实体本身的属性，不混入人员关系字段。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键，供子表 FK 引用 |
| `course_no` | VARCHAR(30) NOT NULL UNIQUE | 完整课程号（如 `BSJ084-2026-1-01`），学校系统中的唯一编号 |
| `name` | VARCHAR(80) NOT NULL | 课程名称 |
| `academic_year` | SMALLINT NOT NULL | 学年（如 `2026` 表示 2025-2026 学年的下半段） |
| `semester` | TINYINT NOT NULL | 学期：`1`=春季，`2`=秋季 |
| `description` | TEXT NULL | 课程简介（选填） |
| `status` | ENUM NOT NULL | `draft`（草稿）/ `active`（进行中）/ `archived`（已归档）|
| `created_by` | VARCHAR(10) NOT NULL | FK → `users.id`（role=academic），创建者 |
| `created_at` | DATETIME NOT NULL | 创建时间 |
| `updated_at` | DATETIME NOT NULL | 最近更新时间 |

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

## 二、`course_teachers`（老师课程负责关系）

**设计说明**：  
记录"哪位老师负责哪门课程"（academic 指派）。一门课程可以有多位老师（主讲+合讲），但只有一位 `lead` 主负责人。

与 `assistant_bindings` 的区别：
- `course_teachers` — 老师与课程的负责关系（academic 指派，权限级别高）
- `assistant_bindings` — 助教与课程的分配关系（老师指派，权限范围受限）

| 字段 | 类型 | 说明 |
|------|------|------|
| `course_id` | BIGINT UNSIGNED | FK → `courses.id` |
| `teacher_user_id` | VARCHAR(10) | FK → `users.id`（role=teacher） |
| `role` | ENUM NOT NULL | `lead`（主负责人）/ `co`（合讲老师） |
| `assigned_by` | VARCHAR(10) NOT NULL | FK → `users.id`（role=academic），指派人 |
| `created_at` | DATETIME NOT NULL | 指派时间 |

**主键**：`(course_id, teacher_user_id)` 联合主键，同一老师不可重复指派同一课程。

**业务约束**：
- 每门课程有且只有一位 `lead` 老师（业务层校验）
- 只有 `role=academic` 可以指派或变更老师
- 老师被指派后，才可以在该课程下发布 Assignment、管理小组、创建助教分配

---

## 三、`course_members`（课程学生成员名单）

**设计说明**：  
记录"哪些学生属于本课程"，是组队资格的来源依据。  
只有 `course_members` 中的学生才能在该课程下参与小组组建。

| 字段 | 类型 | 说明 |
|------|------|------|
| `course_id` | BIGINT UNSIGNED | FK → `courses.id` |
| `student_user_id` | VARCHAR(10) | FK → `users.id`（role=student） |
| `status` | ENUM NOT NULL | `active`（在籍）/ `withdrawn`（已退课） |
| `imported_by` | VARCHAR(10) NOT NULL | FK → `users.id`（role=academic），导入操作人 |
| `created_at` | DATETIME NOT NULL | 加入时间 |

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

## 四、`assistant_bindings`（助教课程分配关系，补全 FK）

> 本表已在 Auth 组建立，此处仅记录 Phase 1 需补充的外键约束。

**现有结构**（已存在）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `assistant_user_id` | VARCHAR(10) | FK → `users.id`（role=assistant） |
| `teacher_user_id` | VARCHAR(10) | 执行分配操作的老师（审计字段） |
| `course_id` | BIGINT UNSIGNED | 待补充 FK → `courses.id` |
| `created_at` | DATETIME | 分配时间 |

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

## 五、ID 规范

| 实体 | ID 类型 | 说明 |
|------|---------|------|
| 课程 `courses.id` | BIGINT UNSIGNED AUTO_INCREMENT | 内部主键，子表 FK 引用 |
| 课程号 `courses.course_no` | VARCHAR(30) UNIQUE | 给人看的完整课程号，如 `BSJ084-2026-1-01` |
| 用户 `users.id` | VARCHAR(10) | 一卡通号，如 `2000000001` |

**设计原则**：`id` 只供数据库内部关联使用，`course_no` 是对外展示和 API 查询用的业务标识。两者职责分离，互不混用。

后续课程组实体（Assignment、Stage、Group 等）的主键类型待各阶段设计时确定，不强制统一为 UUID。

---

## 六、与 Auth 组的跨表关系总览

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

## 七、决策记录

| 问题 | 决策 |
|------|------|
| 课程 ID 格式 | BIGINT AUTO_INCREMENT，`course_no` VARCHAR(30) UNIQUE 存完整课程号（如 `BSJ084-2026-1-01`） |
| 是否建独立班级表（`course_classes`） | P0 不建，`course_members` 扁平名单代替；P1 视需要补充 |
| 一门课程可以有几位老师 | 多位（lead + co），但业务层保证只有一位 lead |
| 老师与助教是否合并为一张表 | 不合并；teacher 由 academic 指派（`course_teachers`）；assistant 由 teacher 分配（`assistant_bindings`），权限来源不同 |
| `course_members.status` 软删除还是枚举 | 枚举（active/withdrawn），保留历史数据，不物理删除 |
| `assistant_bindings.teacher_user_id` 是否加 FK | Phase 1 维持审计字段（无 FK），外键随 `course_id` FK 一起在 Phase 1 评估 |
| 操作留痕（审计日志） | 后置，暂不建表；成绩相关留痕在 Phase 5 评估 |

---

---

# Phase 2：`assignments` / `assignment_group_configs` / `assignment_stages`

> 对应需求文档：场景 A（项目发布）、场景 D（Stage-MiniTask）、第八节（Stage-MiniTask 机制细化）

---

## 表清单（Phase 2，共 3 张）

| 表名 | 作用 |
|------|------|
| `assignments` | 老师在课程下发布的项目主体信息 |
| `assignment_group_configs` | 项目组队规则（1:1，可选） |
| `assignment_stages` | 项目下的阶段（老师定义"做什么、何时提交、怎么验收"） |

---

## 一、`assignments`（课程项目）

**设计说明**：  
老师在课程下发布的项目。一门课程可以有多个 Assignment（但 P0 通常只有一个）。  
Assignment 是组队与提交的业务上层实体：学生围绕某个 Assignment 组建 Group，后续所有 Stage 都归属于 Assignment。  
本表只保留项目主体信息；组队规则拆分到 `assignment_group_configs`，降低耦合与写放大。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键 |
| `course_id` | BIGINT UNSIGNED NOT NULL | FK → `courses.id` |
| `title` | VARCHAR(120) NOT NULL | 项目标题 |
| `description` | TEXT NULL | 项目说明（选填） |
| `description_files` | JSON NULL | 项目描述附件清单（选填），如任务书/模板文档；业务层可为空 |
| `status` | ENUM NOT NULL | `draft`（草稿）/ `active`（进行中）/ `archived`（已归档） |
| `created_by` | VARCHAR(10) NOT NULL | FK → `users.id`（role=teacher），发布者 |
| `created_at` | DATETIME NOT NULL | 创建时间 |
| `updated_at` | DATETIME NOT NULL | 最近更新时间 |

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

## 二、`assignment_group_configs`（项目组队规则）

**设计说明**：  
将组队策略从 `assignments` 拆出，避免老师修改组队时间时频繁更新项目主体行。  
本表为 1:1 可选关系：Assignment 创建后可立即有配置，也可后续补录。

| 字段 | 类型 | 说明 |
|------|------|------|
| `assignment_id` | BIGINT UNSIGNED PK | FK → `assignments.id`，一对一主键 |
| `group_form_start` | DATETIME NULL | 组队开放时间（NULL = 立即开放） |
| `group_form_end` | DATETIME NULL | 组队截止时间（NULL = 不设截止） |
| `group_min_size` | TINYINT UNSIGNED NOT NULL DEFAULT 1 | 每组最少人数（仅约束学生自助组队） |
| `group_max_size` | TINYINT UNSIGNED NOT NULL DEFAULT 6 | 每组最多人数（仅约束学生自助组队） |
| `max_groups` | SMALLINT UNSIGNED NULL | 项目最大小组数（NULL = 不限；仅约束学生自助组队） |
| `regroup_policy` | ENUM NOT NULL DEFAULT 'teacher_decides' | 截止后整理策略：`teacher_decides` / `auto_then_teacher_confirm` |
| `updated_by` | VARCHAR(10) NOT NULL | FK → `users.id`（teacher 或 academic），最近修改人 |
| `updated_at` | DATETIME NOT NULL | 最近修改时间 |

**业务约束**：
- `group_min_size <= group_max_size`
- `group_form_start < group_form_end`（如两者均不为 NULL）
- 上述限制仅在学生自助操作时强制校验；老师/助教直接操作不受约束

---

## 三、`assignment_stages`（项目阶段）

**设计说明**：  
老师在 Assignment 下定义阶段。Stage 是"小组需要在什么时候交什么"的框架，MiniTask 是小组内部执行拆分（Phase 4 建表）。  
Stage 默认不可删除，只能归档（保留历史）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT PK | 内部主键 |
| `assignment_id` | BIGINT UNSIGNED NOT NULL | FK → `assignments.id` |
| `title` | VARCHAR(120) NOT NULL | 阶段标题（如"第一阶段：需求调研报告"） |
| `description` | TEXT NULL | 阶段目标说明 |
| `display_order` | TINYINT UNSIGNED NOT NULL DEFAULT 0 | 展示顺序（可调整，数字越小越靠前） |
| `due_at` | DATETIME NULL | 提交截止时间（NULL = 不设截止） |
| `weight` | DECIMAL(5,2) NULL | 本阶段占项目总分的权重（如 `30.00` 表示 30%；NULL = 不计权重） |
| `submission_desc` | TEXT NULL | 提交要求说明（老师写给学生的提交指引） |
| `accept_criteria` | TEXT NULL | 验收标准（老师写给助教/自己的批改参考） |
| `status` | ENUM NOT NULL DEFAULT 'active' | `active`（进行中）/ `archived`（已归档，不可提交） |
| `created_by` | VARCHAR(10) NOT NULL | FK → `users.id`（role=teacher） |
| `created_at` | DATETIME NOT NULL | 创建时间 |
| `updated_at` | DATETIME NOT NULL | 最近更新时间 |

**索引**：
- `INDEX(assignment_id, display_order)` — 按顺序列出某项目下所有阶段

**业务约束**：
- 只有该 Assignment 所在课程的 teacher 可创建/修改 Stage
- Stage 不可物理删除，状态只能改为 `archived`
- 同一 Assignment 下各 Stage 的 `weight` 之和若全部填写，业务层建议校验是否超过 100（但不强制，允许未填或灵活分配）
- `display_order` 由老师手动排序，允许相同值（不强制唯一）

---

## 四、与 Phase 1 的跨表关系

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

## 五、Phase 2 决策记录

| 问题 | 决策 |
|------|------|
| Assignment ID 格式 | BIGINT AUTO_INCREMENT，与 courses 一致 |
| Assignment 描述文件怎么存 | 文件存 MinIO；`assignments.description_files` 用 JSON（可空）存附件元数据与 objectKey |
| 是否给 `assignments.course_id` 单独建索引 | P0 不建（课程项目数少）；数据量上来后再按实际查询补索引 |
| Stage ID 格式 | BIGINT AUTO_INCREMENT |
| 组队规则存在哪 | 独立 `assignment_group_configs`（1:1，可选），与项目主体解耦 |
| Stage 可否删除 | 不可删除，只能 archived（需求文档：Stage 默认不可删除，可归档） |
| `weight` 是否强制合计 100 | 不强制（业务层建议提示，但允许留空或灵活分配） |
| `display_order` 是否唯一 | 不强制唯一，允许相同值，排序以 display_order ASC 为准 |
| 提交要求字段粒度 | `submission_desc`（给学生看）+ `accept_criteria`（给批改人看）分两列，职责清晰 |

---

## 六、扩展考虑（按需启用）

以下字段在真实教学场景中常见，但建议按需求分批落地，不要一次性全开：

| 建议项 | 推荐位置 | 作用 | P0 是否必需 |
|------|------|------|------|
| `visibility`（private/internal/public） | `assignments` | 控制项目对课程成员可见性 | 否 |
| `allow_late_submission` + `late_penalty_rate` | `assignment_stages` | 支持迟交和扣分策略 | 否 |
| `repo_template_url` | `assignments` | 给小组统一仓库模板 | 否 |
| `submission_schema`（JSON） | `assignment_stages` | 约束提交字段（如必须含 repo_url/demo_url） | 否 |
| `rubric_template_id` | `assignment_stages` | 绑定评分模板，提升批改一致性 | 否 |
| `frozen_at` | `assignment_group_configs` | 标记组队名单冻结时间点 | 否 |

**实施建议**：先落地当前三表和基础字段，等 Phase 5（提交与批改）联调时，再启用 `submission_schema` 与 `rubric_template_id` 两项，收益最高。
