# Courses API v1 审查报告

> 审查时间：2026-05-07  
> 对标文档：[docs/api/courses/course-tables-design-v1.md](../api/courses/course-tables-design-v1.md)  
> 实现文件：[apps/api/src/courses/courses-router.ts](../../apps/api/src/courses/courses-router.ts)

---

## 一、接口完整性检查 ✅

### 设计文档要求的 10 个 Phase 1 端点

| # | 方法 | 路径 | 设计要求 | 实现状态 | 备注 |
|----|------|------|----------|---------|------|
| 1 | GET | `/api/v1/courses` | 列表（按角色过滤） | ✅ 已实现 | academic/teacher/assistant/student 各有对应查询逻辑 |
| 2 | POST | `/api/v1/courses` | 创建（academic only） | ✅ 已实现 | 验证 courseNo 唯一性，检查必填字段 |
| 3 | GET | `/api/v1/courses/:id` | 详情（权限校验） | ✅ 已实现 | 调用 getCourseWithAccessCheck 统一校验 |
| 4 | PATCH | `/api/v1/courses/:id` | 更新（academic only） | ✅ 已实现 | 支持修改 name/description/status |
| 5 | GET | `/api/v1/courses/:id/teachers` | 列出老师（权限校验） | ✅ 已实现 | 返回老师 role（lead/co）和指派时间 |
| 6 | POST | `/api/v1/courses/:id/teachers` | 指派老师（academic only） | ✅ 已实现 | 校验 userId 为 teacher 角色，支持 upsert |
| 7 | DELETE | `/api/v1/courses/:id/teachers/:userId` | 移除老师（academic only） | ✅ 已实现 | 物理删除，检查老师是否存在 |
| 8 | GET | `/api/v1/courses/:id/members` | 列出成员（权限校验） | ✅ 已实现 | 支持 status 筛选，默认只显示 active |
| 9 | POST | `/api/v1/courses/:id/members/batch` | 批量导入（academic only） | ✅ 已实现 | 最多 500 人，upsert 语义，校验 student 角色 |
| 10 | DELETE | `/api/v1/courses/:id/members/:userId` | 移除成员（academic only） | ✅ 已实现 | 软删除为 withdrawn 状态，保留历史 |

**结论：** 10 个端点齐备，功能完整 ✅

---

## 二、权限设置合理性分析

### 2.1 权限分层模式

**getCourseWithAccessCheck 权限树：**

```
role = academic
  └─ 全量读 + 写权限

role = teacher / assistant
  ├─ 检查 courseTeacher（teacher） 或 assistantBinding（assistant）
  └─ 有记录则读权限，无则拒绝

role = student
  └─ 检查 courseMember + status != withdrawn
     └─ 只读权限
```

**评价：** 权限模型清晰，符合设计文档 ✅

### 2.2 端点级权限检查

| 端点 | 权限模式 | 评价 |
|------|---------|------|
| GET /courses | 按角色过滤数据源（只查看有权限的课程） | ✅ 正确 |
| POST /courses | academic only（硬卡 role 字段） | ✅ 正确 |
| GET /courses/:id | getCourseWithAccessCheck（通用校验） | ✅ 正确 |
| PATCH /courses/:id | academic only | ✅ 正确 |
| GET /courses/:id/teachers | getCourseWithAccessCheck | ✅ 正确 |
| POST /courses/:id/teachers | academic only + 校验 userId 为 teacher 角色 | ✅ 正确 |
| DELETE /courses/:id/teachers/:userId | academic only | ✅ 正确 |
| GET /courses/:id/members | getCourseWithAccessCheck | ✅ 正确 |
| POST /courses/:id/members/batch | academic only + 校验 userIds 为 student 角色 | ✅ 正确 |
| DELETE /courses/:id/members/:userId | academic only | ✅ 正确 |

**结论：** 权限设置合理且层级清晰 ✅

---

## 三、发现的改进点

### 🟡 问题 1：GET /courses/:id 中 semester 字段重复

**位置：** [L184-185](../../apps/api/src/courses/courses-router.ts#L184)

```typescript
semester: true,
semester: true,  // ← 重复声明
```

**修复方案：** 删除第二行

---

### 🟡 问题 2：POST /courses/:id/teachers 缺少 lead 唯一性检查

**设计文档要求：** "每门课程有且只有一位 lead 老师（业务层校验）"

**当前实现：** 使用 upsert，允许将已有的 lead 改为 co，或将 co 改为 lead，无唯一性约束

**场景：**
```
1. 老师 A 作为 lead 被指派到课程 C
2. 尝试将老师 B 也作为 lead 指派到课程 C
3. 当前代码允许！（应该返回 409 Conflict）
```

**修复建议：**
```typescript
// POST /courses/:id/teachers 中增加检查
if (roleValue === CourseTeacherRole.lead) {
  const existingLead = await prisma.courseTeacher.findFirst({
    where: { courseId, role: CourseTeacherRole.lead }
  });
  if (existingLead && existingLead.userId !== userId) {
    return res.status(409).json({
      ok: false,
      code: "CONFLICT",
      message: `Course already has a lead teacher: ${existingLead.userId}. Use PUT to change lead.`
    });
  }
}
```

---

### 🟡 问题 3：DELETE /courses/:id/teachers/:userId 缺少课程存在性检查

**当前实现：** 直接查询 courseTeacher，若无记录则返回 NOT_FOUND

**潜在问题：** 无法区分"课程不存在"vs"老师不在课程中"

**改进方案：**
```typescript
// 先检查课程是否存在（与其他端点保持一致）
const course = await prisma.course.findUnique({ where: { id: courseId } });
if (!course) return notFound(res);

// 再检查老师是否在课程中
const record = await prisma.courseTeacher.findUnique({...});
if (!record) {
  return res.status(404).json({
    ok: false,
    code: "NOT_FOUND",
    message: "Teacher not assigned to this course"
  });
}
```

---

### 🟡 问题 4：DELETE /courses/:id/members/:userId 缺少课程存在性检查

**同问题 3，** 建议同步改进。

---

### 🟡 问题 5：POST /courses/:id/teachers 中新增老师时未检查是否已是 withdrawn 状态

**当前情况：** POST 成功会创建新 courseTeacher 记录，但已 withdrawn 的成员可被重新指派为老师

**问题分析：** 无严重影响（teacher 和 student 是不同角色），但逻辑上应该允许重新激活 withdrawn 成员

**建议：** 当前实现可接受，无需改动（因为 teacher 角色本身不在 course_members 中）

---

## 四、未来扩展建议（Phase 2+）

### 与 assignment 级别的权限关系

设计文档提到："老师被指派后，才可以在该课程下发布 Assignment、管理小组"

**当前进展：** Phase 2 assignment API 还未实现

**建议规划：**
- [ ] Assignment 创建时检查 course_teachers 权限（只有 lead/co 可创建）
- [ ] Stage 和 Group 操作同样需要此权限校验
- [ ] 考虑添加 `GET /courses/:id/permissions` 端点供前端查询当前用户在该课程的权限等级

### 老师与助教的权限差异

当前实现中，teacher 和 assistant 在读课程权限上无差异。

**未来考虑：**
- assistant 是否应该有更受限的权限（如只读课程，不可修改）
- 这取决于业务流程定义（见 socket-risks-and-errors.md 风险 3）

---

## 五、代码质量检查

### ✅ 通过项

- [x] 所有端点都有 `requireAuth` 中间件
- [x] 所有读取 courseId 的地方都用 `BigInt()` 转换
- [x] 所有响应都用 `serializeBigInt()` 处理
- [x] 错误响应格式统一（ok/code/message）
- [x] 批量操作使用事务（`prisma.$transaction`）
- [x] 参数校验齐全（courseNo 唯一性、userIds 非空、role 有效值等）

### ⚠️ 待改进

| 项目 | 优先级 | 说明 |
|------|--------|------|
| semester 重复 | 低 | 纯代码整洁问题 |
| lead 唯一性检查 | 中 | 设计文档要求，非函数式缺陷 |
| 课程存在性前置检查 | 低 | 一致性问题，不影响功能 |

---

## 六、总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 接口完整性 | 10/10 | 10 个设计端点全部实现 |
| 权限设置 | 9/10 | 正确，但缺少 lead 唯一性业务约束 |
| 代码质量 | 8/10 | 整体清晰，3 处小瑕疵 |
| 错误处理 | 9/10 | 错误码与消息清晰，缺少少量防御检查 |
| **总体** | **9/10** | **可合并，建议修复 3 个 🟡 问题后 release** |

---

## 七、修复代码片段

### P1 问题 2 修复：lead 唯一性检查

**文件：** `apps/api/src/courses/courses-router.ts` 中 POST `/courses/:id/teachers` 端点

```typescript
const roleValue: CourseTeacherRole =
  teacherRole === CourseTeacherRole.co ? CourseTeacherRole.co : CourseTeacherRole.lead;

// ← 在这里加入 lead 唯一性检查
if (roleValue === CourseTeacherRole.lead) {
  const existingLead = await prisma.courseTeacher.findFirst({
    where: { courseId, role: CourseTeacherRole.lead }
  });
  if (existingLead && existingLead.userId !== userId) {
    return res.status(409).json({
      ok: false,
      code: "CONFLICT",
      message: `Course already has a lead teacher: ${existingLead.userId}`
    });
  }
}

const record = await prisma.courseTeacher.upsert({...});
```

---

### P1 问题 3 & 4 修复：课程存在性检查

**文件：** `apps/api/src/courses/courses-router.ts` DELETE 端点

```typescript
// DELETE /api/v1/courses/:id/teachers/:userId
coursesRouter.delete("/:id/teachers/:userId", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = BigInt(req.params.id);
  const { userId } = req.params;

  // ← 加入课程存在性检查（与其他 GET/PATCH 端点保持一致）
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return notFound(res);

  const record = await prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!record) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Teacher not assigned to this course" });
  }

  await prisma.courseTeacher.delete({ where: { courseId_userId: { courseId, userId } } });
  res.json({ ok: true });
});

// 同样修复 DELETE /api/v1/courses/:id/members/:userId
coursesRouter.delete("/:id/members/:userId", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== Role.academic) return forbidden(res);

  const courseId = BigInt(req.params.id);
  const { userId } = req.params;

  // ← 加入课程存在性检查
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return notFound(res);

  const member = await prisma.courseMember.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!member || member.status === CourseMemberStatus.withdrawn) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Member not found in this course" });
  }

  await prisma.courseMember.update({
    where: { courseId_userId: { courseId, userId } },
    data: { status: CourseMemberStatus.withdrawn },
  });

  res.json({ ok: true });
});
```

---



**立即修复（P0）：**
- [ ] 问题 1：删除 semester 重复声明

**近期修复（P1，Phase 2 开始前）：**
- [ ] 问题 2：POST /courses/:id/teachers 加 lead 唯一性检查
- [ ] 问题 3：DELETE /courses/:id/teachers/:userId 加课程存在性检查
- [ ] 问题 4：DELETE /courses/:id/members/:userId 加课程存在性检查

**可选（提高一致性）：**
- [ ] 所有查询前加 course 存在性检查（与 POST 保持一致）
- [ ] 添加 `PATCH /courses/:id/teachers/:userId` 用于修改 role（目前只能 delete + create）

