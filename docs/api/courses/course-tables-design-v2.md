# 课程域表结构设计 v2（基于当前实现）

> 更新时间：2026-05-11  
> 对照来源：`apps/api/prisma/schema.prisma`

## 1. 文档目标
- 保留 v1 设计语义，不删除原始设计文档。
- 用 v2 记录“当前后端真实表结构”。
- 明确新增表、变更点、已实现范围与缺口。

## 2. 范围说明（Course 大框架）
- Phase 1：课程与成员（Course）
- Phase 2：作业与阶段（Assignment / Stage）
- Phase 3：组队与成员（Group）
- Phase 4：组内协作（MiniTask / Chat）

## 3. 真实表结构（按 Phase）

### 3.1 Phase 1：课程基础
- `courses`
- `course_teachers`
- `course_members`
- `assistant_bindings`

说明：
- `courses.id` 使用 `BigInt`（无符号）。
- `course_members` 通过 `(courseId, userId)` 唯一约束控制同课程唯一成员身份。

### 3.2 Phase 2：作业与阶段
- `assignments`
- `assignment_group_configs`
- `assignment_stages`

说明：
- `assignment_group_configs` 为 1:1 可选配置，包含 `groupFormStart/groupFormEnd/groupMinSize/groupMaxSize/maxGroups/regroupPolicy`。
- `assignment_stages` 以 `(assignmentId, stageNo)` 唯一约束保证阶段编号唯一。

### 3.3 Phase 3：组队与组成员（含本次新增）
- `groups`
- `group_members`
- `group_join_requests`（新增）
- `group_leader_transfer_requests`（新增）

新增说明：
- `group_join_requests`
  - 目的：学生申请加入小组，组长审批。
  - 状态枚举：`pending/approved/rejected/cancelled/expired`
- `group_leader_transfer_requests`
  - 目的：组长转让双向确认。
  - 状态枚举：`pending/accepted/rejected/cancelled/expired`

现有关键约束：
- `groups`：`@@unique([assignmentId, groupNo])`
- `group_members`：`@@unique([assignmentId, userId])`（同作业仅能在一个组）

### 3.4 Phase 4：组内协作
- `mini_tasks`
- `chat_conversations`
- `chat_messages`
- `chat_files`
- `chat_conversation_reads`

说明：
- `chat_files` 与 `chat_conversation_reads` 已纳入真实 schema（不是临时结构）。

## 4. 与 v1 的差异摘要（保留 v1 不删）

### 4.1 新增
- `group_join_requests`
- `group_leader_transfer_requests`

### 4.2 明确化
- 组队截止与人数规则由 `assignment_group_configs` 承载。
- 组内协作文件与已读跟踪为独立表，不再仅依赖 JSON 字段表达。

### 4.3 未引入
- 本版未引入审计日志表（按当前产品决策）。

## 5. 当前实现对齐结论
- 表结构层面：Phase 1-4 的主干表已落地。
- 组队流程：已具备“申请入组 + 组长审批 + 组长转让双向确认”的数据结构支撑。
- 后续建议：如需流程追踪历史，再单独评估是否补充审计日志模型（当前不做）。
