(function () {
    if (window.linkseeDashboardExtensions) {
        return;
    }

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.from((root || document).querySelectorAll(selector));
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    function api() {
        if (!window.linkseeApi) {
            throw new Error("API 客户端尚未加载");
        }
        return window.linkseeApi;
    }

    function getRole() {
        if (document.body.classList.contains("academic-shell") && !document.body.classList.contains("teacher-shell") && !document.body.classList.contains("assistant-shell") && !document.body.classList.contains("student-shell")) {
            return "academic";
        }
        if (document.body.classList.contains("teacher-shell")) return "teacher";
        if (document.body.classList.contains("assistant-shell")) return "assistant";
        if (document.body.classList.contains("student-shell")) return "student";
        return localStorage.getItem("auth_role") || "";
    }

    function optionRows(rows, labeler) {
        return rows.map(function (row) {
            return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(labeler(row)) + '</option>';
        }).join("");
    }

    function normalizeRows(payload) {
        return Array.isArray(payload && payload.data) ? payload.data : [];
    }

    function requestDelete(path, body) {
        return api().request(path, {
            method: "DELETE",
            headers: api().authHeaders(body ? { "Content-Type": "application/json" } : {}),
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    function setResult(node, title, message, isError) {
        if (!node) return;
        node.hidden = false;
        node.classList.toggle("is-error", Boolean(isError));
        node.innerHTML = '<strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(message || "") + '</p>';
    }

    function clearResult(node) {
        if (!node) return;
        node.hidden = true;
        node.innerHTML = "";
        node.classList.remove("is-error");
    }

    function addNavItem(targetId, label) {
        var nav = qs(".side-nav");
        if (!nav || qs('[data-target="' + targetId + '"]', nav)) return;
        var button = document.createElement("button");
        button.className = "nav-item";
        button.type = "button";
        button.setAttribute("data-target", targetId);
        button.textContent = label;
        nav.appendChild(button);
    }

    function addPanel(id, html) {
        var container = qs(".content-container");
        if (!container || document.getElementById(id)) return;
        var wrapper = document.createElement("div");
        wrapper.className = "page-panel";
        wrapper.id = id;
        wrapper.innerHTML = html;
        container.appendChild(wrapper);
    }

    function card(title, note, body) {
        return [
            '<section class="card">',
            '<div class="dashboard-section-intro">',
            '<h2 class="card-title">' + title + '</h2>',
            '</div>',
            '<div class="dashboard-card-body">',
            body,
            '</div>',
            '</section>',
        ].join("");
    }

    function field(label, html) {
        return '<label class="user-settings-field"><span>' + label + '</span>' + html + '</label>';
    }

    function mergePanelInto(targetId, sourceId, title, options) {
        var targetBody = qs("#" + targetId + " .dashboard-card-body");
        var sourcePanel = qs("#" + sourceId);
        var sourceBody = sourcePanel ? qs(".dashboard-card-body", sourcePanel) : null;
        if (!targetBody || !sourcePanel || !sourceBody) return;

        var settings = options || {};
        var section = document.createElement("div");
        section.className = "dashboard-merged-section";
        if (settings.className) {
            section.classList.add(settings.className);
        }
        if (title && !settings.titleInsideFirstSubcard) {
            section.innerHTML = '<h3 class="dashboard-subcard-title">' + escapeHtml(title) + '</h3>';
        }
        while (sourceBody.firstChild) {
            section.appendChild(sourceBody.firstChild);
        }
        if (title && settings.titleInsideFirstSubcard) {
            var titleTarget = qs(".dashboard-subcard", section) || section;
            titleTarget.insertAdjacentHTML("afterbegin", '<h3 class="dashboard-subcard-title">' + escapeHtml(title) + '</h3>');
        }
        if (settings.beforeSelector) {
            var anchor = qs(settings.beforeSelector, targetBody);
            if (anchor) {
                targetBody.insertBefore(section, anchor);
            } else {
                targetBody.appendChild(section);
            }
        } else {
            targetBody.appendChild(section);
        }

        qsa('.side-nav .nav-item[data-target="' + sourceId + '"]').forEach(function (button) {
            button.remove();
        });
        sourcePanel.remove();
    }

    function bindAcademicPanels() {
        addPanel("panel-course-create", card("课程创建", "对应 POST /api/v1/courses。课程激活仍由课程编辑面板控制。", [
            '<div class="academic-toolbar academic-toolbar-create-course">',
            '<input id="extCourseNo" class="dashboard-input" placeholder="课程编号，例如 SE-2026-01" />',
            '<input id="extCourseName" class="dashboard-input" placeholder="课程名称" />',
            '<input id="extCourseYear" class="dashboard-input" type="number" min="2000" value="2026" placeholder="学年" />',
            '<input id="extCourseSemester" class="dashboard-input" type="number" min="1" max="3" value="1" placeholder="学期" />',
            '<button id="extCourseCreateBtn" class="btn btn-primary" type="button">创建课程</button>',
            '</div>',
            '<textarea id="extCourseDescription" class="dashboard-textarea academic-create-description" placeholder="课程简介"></textarea>',
            '<div class="dashboard-filter-bar academic-create-meta">',
            '<span class="dashboard-soft-note">创建后会自动出现在上方课程列表中。</span>',
            '</div>',
            '<div id="extCourseCreateResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        addNavItem("panel-user-maintenance", "用户维护");
        addPanel("panel-user-maintenance", card("用户维护", "单个学生/教师开户与资料维护，对应 /api/v1/users。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">创建账号</h3>',
            field("用户 ID", '<input id="extUserId" class="dashboard-input" maxlength="10" />'),
            field("角色", '<select id="extUserRole" class="dashboard-select"><option value="student">学生</option><option value="teacher">教师</option></select>'),
            field("姓名", '<input id="extUserName" class="dashboard-input" />'),
            field("默认密码", '<input id="extUserPassword" class="dashboard-input" placeholder="留空自动生成" />'),
            field("学生字段", '<textarea id="extStudentFields" class="dashboard-textarea" placeholder="stuNo,grade,cohort,major,adminClass"></textarea>'),
            field("教师字段", '<textarea id="extTeacherFields" class="dashboard-textarea" placeholder="teacherNo,title,college,researchDirection"></textarea>'),
            '<button id="extUserCreateBtn" class="btn btn-primary academic-btn-block" type="button">创建账号</button>',
            '</div>',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">更新账号</h3>',
            field("目标用户 ID", '<input id="extEditUserId" class="dashboard-input" maxlength="10" />'),
            field("姓名", '<input id="extEditRealName" class="dashboard-input" />'),
            field("邮箱", '<input id="extEditEmail" class="dashboard-input" />'),
            field("启用状态", '<select id="extEditActive" class="dashboard-select"><option value="">不修改</option><option value="true">启用</option><option value="false">停用</option></select>'),
            '<button id="extUserPatchBtn" class="btn btn-secondary academic-btn-block" type="button">保存更新</button>',
            '</div>',
            '</div>',
            '<div id="extUserResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        addNavItem("panel-password-reset", "密码重置");
        addPanel("panel-password-reset", card("密码重置", "重置单个账号或按条件批量重置，重置后目标用户需强制改密。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">单个重置</h3>',
            field("用户 ID", '<input id="extResetUserId" class="dashboard-input" maxlength="10" />'),
            field("新密码", '<input id="extResetPassword" class="dashboard-input" placeholder="留空自动生成" />'),
            '<button id="extResetBtn" class="btn btn-primary academic-btn-block" type="button">重置密码</button>',
            '</div>',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">批量重置</h3>',
            field("用户 ID 列表", '<textarea id="extBatchResetIds" class="dashboard-textarea" placeholder="每行或逗号分隔一个 10 位 ID"></textarea>'),
            field("统一新密码", '<input id="extBatchResetPassword" class="dashboard-input" placeholder="留空自动生成" />'),
            '<button id="extBatchResetBtn" class="btn btn-secondary academic-btn-block" type="button">批量重置</button>',
            '</div>',
            '</div>',
            '<div id="extResetResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        mergePanelInto("panel-courses", "panel-course-create", "", {
            beforeSelector: ".academic-course-manage-section",
            className: "academic-course-create-section",
        });
        mergePanelInto("panel-courses", "panel-course-editor", "", {
            className: "academic-course-editor-section",
        });
        mergePanelInto("panel-user-maintenance", "panel-account-batch", "批量账号开通");
        mergePanelInto("panel-user-maintenance", "panel-password-reset", "密码重置");
        bindAcademicTools();
    }

    function splitCsv(value) {
        return String(value || "").split(/[\n,，]/).map(function (item) { return item.trim(); }).filter(Boolean);
    }

    function bindAcademicTools() {
        var courseResult = qs("#extCourseCreateResult");
        qs("#extCourseCreateBtn").onclick = function () {
            clearResult(courseResult);
            api().postJson("/api/v1/courses", {
                courseNo: qs("#extCourseNo").value.trim(),
                name: qs("#extCourseName").value.trim(),
                academicYear: Number(qs("#extCourseYear").value),
                semester: Number(qs("#extCourseSemester").value),
                description: qs("#extCourseDescription").value.trim() || null,
            }).then(function (payload) {
                setResult(courseResult, "创建成功", "课程 ID：" + ((payload.data && payload.data.id) || "--"), false);
            }).catch(function (err) {
                setResult(courseResult, "创建失败", err.message, true);
            });
        };

        var userResult = qs("#extUserResult");
        qs("#extUserCreateBtn").onclick = function () {
            clearResult(userResult);
            var role = qs("#extUserRole").value;
            var body = {
                id: qs("#extUserId").value.trim(),
                role: role,
                realName: qs("#extUserName").value.trim(),
            };
            var defaultPassword = qs("#extUserPassword").value.trim();
            if (defaultPassword) body.defaultPassword = defaultPassword;
            if (role === "student") {
                var s = splitCsv(qs("#extStudentFields").value);
                body.stuNo = s[0] || body.id;
                body.grade = Number(s[1] || new Date().getFullYear());
                body.cohort = Number(s[2] || body.grade + 4);
                body.major = s[3] || "未填写";
                body.adminClass = s[4] || "未填写";
            } else {
                var t = splitCsv(qs("#extTeacherFields").value);
                body.teacherNo = t[0] || body.id;
                body.title = t[1] || "教师";
                body.college = t[2] || "未填写学院";
                body.researchDirection = t[3] || "";
            }
            api().postJson("/api/v1/users", body).then(function (payload) {
                var data = payload.data || {};
                setResult(userResult, "创建成功", "临时密码：" + (data.temporaryPassword || "已按输入设置"), false);
            }).catch(function (err) {
                setResult(userResult, "创建失败", err.message, true);
            });
        };
        qs("#extUserPatchBtn").onclick = function () {
            var id = qs("#extEditUserId").value.trim();
            if (!id) {
                setResult(userResult, "无法更新", "请填写目标用户 ID。", true);
                return;
            }
            var body = {};
            if (qs("#extEditRealName").value.trim()) body.realName = qs("#extEditRealName").value.trim();
            if (qs("#extEditEmail").value.trim()) body.email = qs("#extEditEmail").value.trim();
            if (qs("#extEditActive").value) body.isActive = qs("#extEditActive").value === "true";
            api().patchJson("/api/v1/users/" + encodeURIComponent(id), body).then(function () {
                setResult(userResult, "更新成功", "用户资料已保存。", false);
            }).catch(function (err) {
                setResult(userResult, "更新失败", err.message, true);
            });
        };

        var resetResult = qs("#extResetResult");
        qs("#extResetBtn").onclick = function () {
            var body = { targetUserId: qs("#extResetUserId").value.trim() };
            var password = qs("#extResetPassword").value.trim();
            if (password) body.newPassword = password;
            api().postJson("/api/v1/auth/admin/reset-password", body).then(function (payload) {
                var data = payload.data || {};
                setResult(resetResult, "重置成功", "临时密码：" + (data.temporaryPassword || "已按输入设置"), false);
            }).catch(function (err) {
                setResult(resetResult, "重置失败", err.message, true);
            });
        };
        qs("#extBatchResetBtn").onclick = function () {
            var body = { userIds: splitCsv(qs("#extBatchResetIds").value) };
            var password = qs("#extBatchResetPassword").value.trim();
            if (password) body.newPassword = password;
            api().postJson("/api/v1/auth/admin/batch-reset-password", body).then(function (payload) {
                var data = payload.data || {};
                setResult(resetResult, "批量重置成功", "影响人数：" + (data.affectedCount || 0) + "，默认密码：" + (data.defaultPassword || "已按输入设置"), false);
            }).catch(function (err) {
                setResult(resetResult, "批量重置失败", err.message, true);
            });
        };
    }

    function loadCourseOptions(select, next) {
        return api().getJson("/api/v1/courses").then(function (payload) {
            var rows = normalizeRows(payload);
            select.innerHTML = optionRows(rows, function (course) {
                return (course.name || course.courseNo || course.id) + " · " + (course.status || "--");
            });
            if (rows[0] && !select.value) select.value = rows[0].id;
            if (next) return next(rows);
            return rows;
        });
    }

    function loadAssignmentOptions(courseId, select, includeEmpty) {
        if (!courseId) {
            select.innerHTML = includeEmpty ? '<option value="">请选择课程</option>' : "";
            return Promise.resolve([]);
        }
        return api().getJson("/api/v1/courses/" + encodeURIComponent(courseId) + "/assignments").then(function (payload) {
            var rows = normalizeRows(payload);
            select.innerHTML = (includeEmpty ? '<option value="">请选择项目</option>' : "") + optionRows(rows, function (assignment) {
                return (assignment.title || assignment.id) + " · " + (assignment.status || "--");
            });
            if (rows[0] && !select.value && !includeEmpty) select.value = rows[0].id;
            return rows;
        });
    }

    function loadStageOptions(assignmentId, select, includeEmpty) {
        if (!assignmentId) {
            select.innerHTML = includeEmpty ? '<option value="">请选择项目</option>' : "";
            return Promise.resolve([]);
        }
        return api().getJson("/api/v1/assignments/" + encodeURIComponent(assignmentId) + "/stages").then(function (payload) {
            var rows = normalizeRows(payload);
            select.innerHTML = (includeEmpty ? '<option value="">请选择阶段</option>' : "") + optionRows(rows, function (stage) {
                return (stage.title || ("阶段 " + stage.stageNo)) + " · " + (stage.status || "--");
            });
            return rows;
        });
    }

    function bindTeacherPanels() {
        addNavItem("panel-assignment-manage", "作业管理");
        addPanel("panel-assignment-manage", card("作业管理", "创建、编辑、发布课程项目，并上传项目说明材料。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">项目列表</h3>',
            field("课程", '<select id="extAssignCourse" class="dashboard-select"></select>'),
            '<div id="extAssignmentList" class="list dashboard-scroll-region"></div>',
            '</div>',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">创建/编辑项目</h3>',
            field("选中项目", '<select id="extAssignSelect" class="dashboard-select"><option value="">新建项目</option></select>'),
            field("标题", '<input id="extAssignTitle" class="dashboard-input" />'),
            field("状态", '<select id="extAssignStatus" class="dashboard-select"><option value="draft">draft</option><option value="active">active</option><option value="archived">archived</option></select>'),
            field("说明", '<textarea id="extAssignDesc" class="dashboard-textarea"></textarea>'),
            field("说明附件", '<input id="extAssignFiles" class="dashboard-input" type="file" multiple />'),
            '<div class="dashboard-panel-actions">',
            '<button id="extAssignCreate" class="btn btn-primary academic-btn-block" type="button">创建项目</button>',
            '<button id="extAssignPatch" class="btn btn-secondary academic-btn-block" type="button">保存项目</button>',
            '<button id="extAssignUpload" class="btn btn-secondary academic-btn-block" type="button">上传附件</button>',
            '</div>',
            '</div>',
            '</div>',
            '<div id="extAssignResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        addNavItem("panel-stage-manage", "阶段管理");
        addPanel("panel-stage-manage", card("阶段管理", "维护阶段要求、截止时间、权重和材料。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            field("课程", '<select id="extStageCourse" class="dashboard-select"></select>'),
            field("项目", '<select id="extStageAssignment" class="dashboard-select"></select>'),
            field("阶段", '<select id="extStageSelect" class="dashboard-select"><option value="">新建阶段</option></select>'),
            '<div id="extStageList" class="list dashboard-scroll-region"></div>',
            '</div>',
            '<div class="dashboard-subcard">',
            field("标题", '<input id="extStageTitle" class="dashboard-input" />'),
            field("开始时间", '<input id="extStageStart" class="dashboard-input" type="datetime-local" />'),
            field("截止时间", '<input id="extStageDue" class="dashboard-input" type="datetime-local" />'),
            field("权重", '<input id="extStageWeight" class="dashboard-input" type="number" min="0" max="100" step="0.1" />'),
            field("状态", '<select id="extStageStatus" class="dashboard-select"><option value="planned">planned</option><option value="open">open</option><option value="closed">closed</option><option value="archived">archived</option></select>'),
            field("提交说明", '<textarea id="extStageSubmission" class="dashboard-textarea"></textarea>'),
            field("验收标准", '<textarea id="extStageCriteria" class="dashboard-textarea"></textarea>'),
            field("阶段材料", '<input id="extStageFiles" class="dashboard-input" type="file" multiple />'),
            '<div class="dashboard-panel-actions">',
            '<button id="extStageCreate" class="btn btn-primary academic-btn-block" type="button">创建阶段</button>',
            '<button id="extStagePatch" class="btn btn-secondary academic-btn-block" type="button">保存阶段</button>',
            '<button id="extStageUpload" class="btn btn-secondary academic-btn-block" type="button">上传材料</button>',
            '<button id="extStageArchive" class="btn btn-secondary academic-btn-block" type="button">归档阶段</button>',
            '</div>',
            '</div>',
            '</div>',
            '<div id="extStageResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        addNavItem("panel-group-manage", "分组管理");
        addPanel("panel-group-manage", card("分组管理", "教师/助教手动建组、查看小组并兜底调整成员。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            field("课程", '<select id="extGroupCourse" class="dashboard-select"></select>'),
            field("项目", '<select id="extGroupAssignment" class="dashboard-select"></select>'),
            '<button id="extGroupReload" class="btn btn-secondary academic-btn-block" type="button">刷新小组</button>',
            '<div id="extGroupList" class="list dashboard-scroll-region"></div>',
            '</div>',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">小组操作</h3>',
            field("小组名称", '<input id="extGroupName" class="dashboard-input" />'),
            field("小组号", '<input id="extGroupNo" class="dashboard-input" type="number" />'),
            field("目标小组 ID", '<input id="extGroupId" class="dashboard-input" />'),
            field("学生用户 ID", '<input id="extGroupUserId" class="dashboard-input" maxlength="10" />'),
            '<div class="dashboard-panel-actions">',
            '<button id="extGroupCreate" class="btn btn-primary academic-btn-block" type="button">创建小组</button>',
            '<button id="extGroupAddMember" class="btn btn-secondary academic-btn-block" type="button">加入成员</button>',
            '<button id="extGroupRemoveMember" class="btn btn-secondary academic-btn-block" type="button">移出成员</button>',
            '</div>',
            '</div>',
            '</div>',
            '<div id="extGroupResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        addNavItem("panel-assistant-manage", "助教管理");
        addPanel("panel-assistant-manage", card("助教管理", "创建自己的助教账号，并绑定到当前课程。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">创建助教</h3>',
            field("助教 ID", '<input id="extAssistantId" class="dashboard-input" maxlength="10" />'),
            field("姓名", '<input id="extAssistantName" class="dashboard-input" />'),
            field("默认密码", '<input id="extAssistantPassword" class="dashboard-input" placeholder="留空自动生成" />'),
            '<button id="extAssistantCreate" class="btn btn-primary academic-btn-block" type="button">创建助教账号</button>',
            '</div>',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">课程绑定</h3>',
            field("课程", '<select id="extAssistantCourse" class="dashboard-select"></select>'),
            field("助教 ID", '<input id="extAssistantBindId" class="dashboard-input" maxlength="10" />'),
            '<div class="dashboard-panel-actions">',
            '<button id="extAssistantBind" class="btn btn-secondary academic-btn-block" type="button">绑定助教</button>',
            '<button id="extAssistantUnbind" class="btn btn-secondary academic-btn-block" type="button">解绑助教</button>',
            '</div>',
            '<div id="extAssistantList" class="list dashboard-scroll-region"></div>',
            '</div>',
            '</div>',
            '<div id="extAssistantResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        bindTeacherTools();
    }

    function bindTeacherTools() {
        var assignCourse = qs("#extAssignCourse");
        var assignSelect = qs("#extAssignSelect");
        var assignResult = qs("#extAssignResult");
        function refreshAssignments() {
            return loadAssignmentOptions(assignCourse.value, assignSelect, true).then(function (rows) {
                qs("#extAssignmentList").innerHTML = rows.map(function (a) {
                    return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + escapeHtml(a.title) + '</strong><span class="badge badge-active">' + escapeHtml(a.status) + '</span></div><div class="muted">ID: ' + escapeHtml(a.id) + '</div></div>';
                }).join("") || '<div class="dashboard-empty-state"><strong>暂无项目</strong><p>当前课程还没有项目。</p></div>';
                return rows;
            });
        }
        if (assignCourse) {
            loadCourseOptions(assignCourse, refreshAssignments);
            assignCourse.onchange = refreshAssignments;
        }
        qs("#extAssignCreate").onclick = function () {
            api().postJson("/api/v1/courses/" + encodeURIComponent(assignCourse.value) + "/assignments", {
                title: qs("#extAssignTitle").value.trim(),
                description: qs("#extAssignDesc").value.trim() || null,
                status: qs("#extAssignStatus").value,
            }).then(function () {
                setResult(assignResult, "创建成功", "项目已创建。", false);
                return refreshAssignments();
            }).catch(function (err) {
                setResult(assignResult, "创建失败", err.message, true);
            });
        };
        qs("#extAssignPatch").onclick = function () {
            var id = assignSelect.value;
            if (!id) return setResult(assignResult, "无法保存", "请先选择项目。", true);
            api().patchJson("/api/v1/assignments/" + encodeURIComponent(id), {
                title: qs("#extAssignTitle").value.trim(),
                description: qs("#extAssignDesc").value.trim() || null,
                status: qs("#extAssignStatus").value,
            }).then(function () {
                setResult(assignResult, "保存成功", "项目已更新。", false);
                return refreshAssignments();
            }).catch(function (err) {
                setResult(assignResult, "保存失败", err.message, true);
            });
        };
        qs("#extAssignUpload").onclick = function () {
            var id = assignSelect.value;
            var input = qs("#extAssignFiles");
            if (!id || !input.files.length) return setResult(assignResult, "无法上传", "请选择项目和附件。", true);
            var form = new FormData();
            qsa("#extAssignFiles")[0].files && Array.from(input.files).forEach(function (file) { form.append("files", file); });
            api().postForm("/api/v1/assignments/" + encodeURIComponent(id) + "/materials", form).then(function () {
                setResult(assignResult, "上传成功", "项目说明附件已上传。", false);
            }).catch(function (err) {
                setResult(assignResult, "上传失败", err.message, true);
            });
        };

        var stageCourse = qs("#extStageCourse");
        var stageAssignment = qs("#extStageAssignment");
        var stageSelect = qs("#extStageSelect");
        var stageResult = qs("#extStageResult");
        function refreshStageAssignments() {
            return loadAssignmentOptions(stageCourse.value, stageAssignment, false).then(refreshStages);
        }
        function refreshStages() {
            return loadStageOptions(stageAssignment.value, stageSelect, true).then(function (rows) {
                qs("#extStageList").innerHTML = rows.map(function (s) {
                    return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + escapeHtml(s.title) + '</strong><span class="badge badge-active">' + escapeHtml(s.status) + '</span></div><div class="muted">ID: ' + escapeHtml(s.id) + ' · 截止：' + escapeHtml(s.dueAt || "--") + '</div></div>';
                }).join("") || '<div class="dashboard-empty-state"><strong>暂无阶段</strong><p>当前项目还没有阶段。</p></div>';
            });
        }
        if (stageCourse) {
            loadCourseOptions(stageCourse, refreshStageAssignments);
            stageCourse.onchange = refreshStageAssignments;
            stageAssignment.onchange = refreshStages;
        }
        function stageBody() {
            var start = qs("#extStageStart").value;
            return {
                title: qs("#extStageTitle").value.trim(),
                startAt: start ? new Date(start).toISOString() : null,
                dueAt: qs("#extStageDue").value ? new Date(qs("#extStageDue").value).toISOString() : undefined,
                weight: qs("#extStageWeight").value ? Number(qs("#extStageWeight").value) : null,
                status: qs("#extStageStatus").value,
                submissionDesc: qs("#extStageSubmission").value.trim() || null,
                acceptCriteria: qs("#extStageCriteria").value.trim() || null,
            };
        }
        qs("#extStageCreate").onclick = function () {
            api().postJson("/api/v1/assignments/" + encodeURIComponent(stageAssignment.value) + "/stages", stageBody()).then(function () {
                setResult(stageResult, "创建成功", "阶段已创建。", false);
                return refreshStages();
            }).catch(function (err) {
                setResult(stageResult, "创建失败", err.message, true);
            });
        };
        qs("#extStagePatch").onclick = function () {
            if (!stageSelect.value) return setResult(stageResult, "无法保存", "请先选择阶段。", true);
            api().patchJson("/api/v1/stages/" + encodeURIComponent(stageSelect.value), stageBody()).then(function () {
                setResult(stageResult, "保存成功", "阶段已更新。", false);
                return refreshStages();
            }).catch(function (err) {
                setResult(stageResult, "保存失败", err.message, true);
            });
        };
        qs("#extStageUpload").onclick = function () {
            var input = qs("#extStageFiles");
            if (!stageSelect.value || !input.files.length) return setResult(stageResult, "无法上传", "请选择阶段和材料。", true);
            var form = new FormData();
            Array.from(input.files).forEach(function (file) { form.append("files", file); });
            api().postForm("/api/v1/stages/" + encodeURIComponent(stageSelect.value) + "/materials", form).then(function () {
                setResult(stageResult, "上传成功", "阶段材料已上传。", false);
            }).catch(function (err) {
                setResult(stageResult, "上传失败", err.message, true);
            });
        };
        qs("#extStageArchive").onclick = function () {
            if (!stageSelect.value) return setResult(stageResult, "无法归档", "请先选择阶段。", true);
            requestDelete("/api/v1/stages/" + encodeURIComponent(stageSelect.value)).then(function () {
                setResult(stageResult, "归档成功", "阶段已归档。", false);
                return refreshStages();
            }).catch(function (err) {
                setResult(stageResult, "归档失败", err.message, true);
            });
        };

        var groupCourse = qs("#extGroupCourse");
        var groupAssignment = qs("#extGroupAssignment");
        var groupResult = qs("#extGroupResult");
        function refreshGroupAssignments() {
            return loadAssignmentOptions(groupCourse.value, groupAssignment, false).then(refreshGroups);
        }
        function refreshGroups() {
            if (!groupAssignment.value) return Promise.resolve();
            return api().getJson("/api/v1/assignments/" + encodeURIComponent(groupAssignment.value) + "/groups").then(function (payload) {
                var rows = normalizeRows(payload);
                qs("#extGroupList").innerHTML = rows.map(function (g) {
                    return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + escapeHtml(g.name || ("第 " + g.groupNo + " 组")) + '</strong><span class="badge badge-active">' + escapeHtml(g.status) + '</span></div><div class="muted">ID: ' + escapeHtml(g.id) + ' · 成员：' + escapeHtml(g._count && g._count.members || 0) + '</div></div>';
                }).join("") || '<div class="dashboard-empty-state"><strong>暂无小组</strong><p>当前项目还没有小组。</p></div>';
            });
        }
        if (groupCourse) {
            loadCourseOptions(groupCourse, refreshGroupAssignments);
            groupCourse.onchange = refreshGroupAssignments;
            groupAssignment.onchange = refreshGroups;
            qs("#extGroupReload").onclick = refreshGroups;
        }
        qs("#extGroupCreate").onclick = function () {
            var body = { name: qs("#extGroupName").value.trim() || undefined };
            if (qs("#extGroupNo").value) body.groupNo = Number(qs("#extGroupNo").value);
            api().postJson("/api/v1/assignments/" + encodeURIComponent(groupAssignment.value) + "/groups", body).then(function (payload) {
                setResult(groupResult, "创建成功", "小组 ID：" + ((payload.data && payload.data.id) || "--"), false);
                return refreshGroups();
            }).catch(function (err) {
                setResult(groupResult, "创建失败", err.message, true);
            });
        };
        qs("#extGroupAddMember").onclick = function () {
            api().postJson("/api/v1/groups/" + encodeURIComponent(qs("#extGroupId").value.trim()) + "/members", { userId: qs("#extGroupUserId").value.trim() }).then(function () {
                setResult(groupResult, "加入成功", "成员已加入小组。", false);
                return refreshGroups();
            }).catch(function (err) {
                setResult(groupResult, "加入失败", err.message, true);
            });
        };
        qs("#extGroupRemoveMember").onclick = function () {
            requestDelete("/api/v1/groups/" + encodeURIComponent(qs("#extGroupId").value.trim()) + "/members/" + encodeURIComponent(qs("#extGroupUserId").value.trim())).then(function () {
                setResult(groupResult, "移出成功", "成员已移出小组。", false);
                return refreshGroups();
            }).catch(function (err) {
                setResult(groupResult, "移出失败", err.message, true);
            });
        };

        var assistantResult = qs("#extAssistantResult");
        loadCourseOptions(qs("#extAssistantCourse"), refreshAssistants);
        function refreshAssistants() {
            var courseId = qs("#extAssistantCourse").value;
            if (!courseId) return Promise.resolve();
            return api().getJson("/api/v1/courses/" + encodeURIComponent(courseId) + "/assistants").then(function (payload) {
                var rows = normalizeRows(payload);
                qs("#extAssistantList").innerHTML = rows.map(function (row) {
                    var name = row.assistant && row.assistant.profile && row.assistant.profile.realName;
                    return '<div class="list-item dashboard-list-item-vertical"><strong>' + escapeHtml(name || row.assistantUserId) + '</strong><div class="muted">ID: ' + escapeHtml(row.assistantUserId) + '</div></div>';
                }).join("") || '<div class="dashboard-empty-state"><strong>暂无助教</strong><p>当前课程还没有绑定助教。</p></div>';
            });
        }
        qs("#extAssistantCourse").onchange = refreshAssistants;
        qs("#extAssistantCreate").onclick = function () {
            var body = { id: qs("#extAssistantId").value.trim(), realName: qs("#extAssistantName").value.trim() };
            if (qs("#extAssistantPassword").value.trim()) {
                body.defaultPassword = qs("#extAssistantPassword").value.trim();
            }
            api().postJson("/api/v1/users/assistants", body).then(function (payload) {
                setResult(assistantResult, "创建成功", "临时密码：" + ((payload.data && payload.data.temporaryPassword) || "已按输入设置"), false);
            }).catch(function (err) {
                setResult(assistantResult, "创建失败", err.message, true);
            });
        };
        qs("#extAssistantBind").onclick = function () {
            api().postJson("/api/v1/courses/" + encodeURIComponent(qs("#extAssistantCourse").value) + "/assistants", { assistantUserId: qs("#extAssistantBindId").value.trim() }).then(function () {
                setResult(assistantResult, "绑定成功", "助教已绑定课程。", false);
                return refreshAssistants();
            }).catch(function (err) {
                setResult(assistantResult, "绑定失败", err.message, true);
            });
        };
        qs("#extAssistantUnbind").onclick = function () {
            requestDelete("/api/v1/courses/" + encodeURIComponent(qs("#extAssistantCourse").value) + "/assistants/" + encodeURIComponent(qs("#extAssistantBindId").value.trim())).then(function () {
                setResult(assistantResult, "解绑成功", "助教已解绑。", false);
                return refreshAssistants();
            }).catch(function (err) {
                setResult(assistantResult, "解绑失败", err.message, true);
            });
        };
    }

    function bindStudentPanels() {
        // 学生端已经使用 student-dashboard.html 中的真实页面结构。
        // 旧版动态注入的组队 / 任务 / 提交面板在这里彻底停用，避免和当前页面并存。
    }

    function bindStudentTools() {
        var groupCourse = qs("#extStudentGroupCourse");
        var groupAssignment = qs("#extStudentGroupAssignment");
        var groupResult = qs("#extStudentGroupResult");
        function roleLabel(role) {
            if (role === "leader") return "组长";
            if (role === "member") return "成员";
            return role || "--";
        }
        function groupStatusLabel(status) {
            if (status === "forming") return "组队中";
            if (status === "active") return "协作中";
            if (status === "archived") return "已归档";
            return status || "--";
        }
        function requestStatusLabel(status) {
            if (status === "pending") return "待审核";
            if (status === "approved") return "已通过";
            if (status === "rejected") return "已拒绝";
            if (status === "cancelled") return "已取消";
            return status || "--";
        }
        function notifyStudentGroupsChanged() {
            if (typeof window.CustomEvent === "function") {
                window.dispatchEvent(new CustomEvent("linksee:student-groups-changed"));
            }
        }
        function refreshStudentGroupAssignments() {
            return loadAssignmentOptions(groupCourse.value, groupAssignment, false).then(refreshStudentGroups);
        }
        function refreshStudentGroups() {
            if (!groupAssignment.value) return Promise.resolve();
            return Promise.all([
                api().getJson("/api/v1/assignments/" + encodeURIComponent(groupAssignment.value) + "/groups").catch(function () { return { data: [] }; }),
                api().getJson("/api/v1/assignments/" + encodeURIComponent(groupAssignment.value) + "/my-group").catch(function () { return { data: null }; }),
            ]).then(function (payloads) {
                var rows = normalizeRows(payloads[0]);
                var mine = payloads[1].data;
                var market = qs("#extStudentGroupList");
                var summary = qs("#extStudentCurrentGroupSummary");
                var requestList = qs("#extStudentRequestList");
                if (summary) {
                    summary.innerHTML = mine
                        ? '<div class="student-join-current-inline"><strong>' + escapeHtml(mine.name || ("第 " + mine.groupNo + " 组")) + '</strong><span>' + escapeHtml(roleLabel(mine.myRole || "--")) + '</span><small>小组编号 ' + escapeHtml(mine.id || "--") + '</small></div>'
                        : '<div class="student-join-current-empty">当前项目尚未入组</div>';
                }
                if (market) {
                    var visible = rows.filter(function (g) { return !mine || String(g.id) !== String(mine.id); });
                    market.innerHTML = visible.length ? visible.map(function (g) {
                        return '<div class="student-join-market-row"><div class="student-join-market-main"><strong>' + escapeHtml(g.name || ("第 " + g.groupNo + " 组")) + '</strong><small>第 ' + escapeHtml(String(g.groupNo || "--")) + ' 组 · 组长 ' + escapeHtml(g.leaderUserId || "--") + '</small></div><span class="student-join-market-cell">' + escapeHtml(String(g._count && g._count.members || 0)) + ' 人</span><span class="student-join-market-cell is-status">' + escapeHtml(groupStatusLabel(g.status || "--")) + '</span><div class="student-join-market-actions"><button class="btn btn-secondary student-join-mini-btn" type="button" data-group-fill="' + escapeHtml(g.id) + '">填入</button><button class="btn btn-primary student-join-mini-btn" type="button" data-group-join="' + escapeHtml(g.id) + '">申请</button></div></div>';
                    }).join("") : '<div class="student-join-market-empty">当前没有更多可加入的小组。</div>';
                }
                if (!mine) {
                    if (requestList) requestList.innerHTML = '<div class="student-join-side-empty">加入小组后，这里会显示你的申请记录。</div>';
                    return;
                }
                return api().getJson("/api/v1/groups/" + encodeURIComponent(mine.id) + "/join-requests").then(function (requestPayload) {
                    var requestRows = normalizeRows(requestPayload);
                    if (requestList) {
                        requestList.innerHTML = requestRows.length ? requestRows.map(function (row) {
                            return '<div class="student-join-request-row"><strong>' + escapeHtml(row.applicantUserId || "--") + '</strong><span>' + escapeHtml(requestStatusLabel(row.status || "--")) + '</span></div>';
                        }).join("") : '<div class="student-join-side-empty">暂无申请记录</div>';
                    }
                }).catch(function () {
                    if (requestList) requestList.innerHTML = '<div class="student-join-side-empty">当前没有可查看的申请记录。</div>';
                });
            });
        }
        var useLegacyStudentGroupPanel = !qs("#studentTeamViewTabs");
        if (useLegacyStudentGroupPanel) {
            if (groupCourse) {
                loadCourseOptions(groupCourse, refreshStudentGroupAssignments);
                groupCourse.onchange = refreshStudentGroupAssignments;
                groupAssignment.onchange = refreshStudentGroups;
                qs("#extStudentGroupReload").onclick = refreshStudentGroups;
            }
            qs("#extStudentCreateGroup").onclick = function () {
                api().postJson("/api/v1/assignments/" + encodeURIComponent(groupAssignment.value) + "/groups", { name: qs("#extStudentNewGroupName").value.trim() || undefined }).then(function () {
                    setResult(groupResult, "创建成功", "你已创建并加入小组。", false);
                    return refreshStudentGroups().then(notifyStudentGroupsChanged);
                }).catch(function (err) {
                    setResult(groupResult, "创建失败", err.message, true);
                });
            };
            qs("#extStudentJoinGroup").onclick = function () {
                api().postJson("/api/v1/groups/" + encodeURIComponent(qs("#extStudentTargetGroup").value.trim()) + "/join-requests", {}).then(function () {
                    setResult(groupResult, "申请成功", "入组申请已提交，通过后会自动出现在我的小组。", false);
                    return refreshStudentGroups();
                }).catch(function (err) {
                    setResult(groupResult, "申请失败", err.message, true);
                });
            };
            qs("#extStudentApproveJoin").onclick = function () {
                api().postJson("/api/v1/group-join-requests/" + encodeURIComponent(qs("#extStudentRequestId").value.trim()) + "/approve", {}).then(function () {
                    setResult(groupResult, "已同意", "入组申请已通过。", false);
                    return refreshStudentGroups().then(notifyStudentGroupsChanged);
                }).catch(function (err) {
                    setResult(groupResult, "操作失败", err.message, true);
                });
            };
            qs("#extStudentRejectJoin").onclick = function () {
                api().postJson("/api/v1/group-join-requests/" + encodeURIComponent(qs("#extStudentRequestId").value.trim()) + "/reject", {}).then(function () {
                    setResult(groupResult, "已拒绝", "入组申请已拒绝。", false);
                    return refreshStudentGroups();
                }).catch(function (err) {
                    setResult(groupResult, "操作失败", err.message, true);
                });
            };
            qs("#extStudentTransferLeader").onclick = function () {
                api().postJson("/api/v1/groups/" + encodeURIComponent(qs("#extStudentTargetGroup").value.trim()) + "/leader-transfer-requests", { toUserId: qs("#extStudentTransferTarget").value.trim() }).then(function () {
                    setResult(groupResult, "已发起", "组长转让请求已发送。", false);
                }).catch(function (err) {
                    setResult(groupResult, "发起失败", err.message, true);
                });
            };
            document.addEventListener("click", function (event) {
                var fillBtn = event.target.closest("[data-group-fill]");
                if (fillBtn && qs("#extStudentTargetGroup")) {
                    qs("#extStudentTargetGroup").value = fillBtn.getAttribute("data-group-fill") || "";
                }
                var joinBtn = event.target.closest("[data-group-join]");
                if (joinBtn && qs("#extStudentTargetGroup") && qs("#extStudentJoinGroup")) {
                    qs("#extStudentTargetGroup").value = joinBtn.getAttribute("data-group-join") || "";
                    qs("#extStudentJoinGroup").click();
                }
            });
        }

        var taskCourse = qs("#extTaskCourse");
        var taskAssignment = qs("#extTaskAssignment");
        var taskResult = qs("#extTaskResult");
        function refreshTaskAssignment() {
            return loadAssignmentOptions(taskCourse.value, taskAssignment, false).then(refreshTaskGroup);
        }
        function renderTaskContextEmpty(title, message) {
            qs("#extTaskGroupSummary").innerHTML = '<div class="dashboard-empty-state"><strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(message) + '</p></div>';
        }
        function refreshTaskContext(group) {
            var groupId = group && group.id;
            if (!groupId || !taskAssignment.value) {
                renderTaskContextEmpty("尚未入组", "加入小组后可以查看小组信息并维护任务。");
                return Promise.resolve();
            }

            var label = group.name || ("第 " + (group.groupNo || "--") + " 组");
            qs("#extTaskGroupSummary").innerHTML = '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + escapeHtml(label) + '</strong><span class="badge badge-active">' + escapeHtml(group.status || "--") + '</span></div><div class="muted">小组 ID：' + escapeHtml(group.id) + ' · 我的角色：' + escapeHtml(group.myRole || "--") + ' · 成员数：' + escapeHtml(group._count && group._count.members || "--") + '</div></div>';
            return Promise.resolve();
        }
        function refreshTaskGroup() {
            if (!taskAssignment.value) return Promise.resolve();
            return api().getJson("/api/v1/assignments/" + encodeURIComponent(taskAssignment.value) + "/my-group").then(function (payload) {
                var group = payload.data || null;
                qs("#extTaskGroupId").value = group && group.id || "";
                return Promise.all([refreshTaskContext(group), refreshTasks()]);
            }).catch(function () {
                qs("#extTaskGroupId").value = "";
                renderTaskContextEmpty("尚未入组", "加入小组后可以维护任务。");
                qs("#extTaskList").innerHTML = '<div class="dashboard-empty-state"><strong>尚未入组</strong><p>加入小组后可以维护任务。</p></div>';
            });
        }
        function refreshTasks() {
            var groupId = qs("#extTaskGroupId").value;
            if (!groupId) return Promise.resolve();
            return api().getJson("/api/v1/groups/" + encodeURIComponent(groupId) + "/minitasks").then(function (payload) {
                var rows = normalizeRows(payload);
                qs("#extTaskList").innerHTML = rows.map(function (task) {
                    return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + escapeHtml(task.title) + '</strong><span class="badge badge-pending">' + escapeHtml(task.status) + '</span></div><div class="muted">ID: ' + escapeHtml(task.id) + ' · 优先级：' + escapeHtml(task.priority || "--") + '</div></div>';
                }).join("") || '<div class="dashboard-empty-state"><strong>暂无任务</strong><p>可以创建第一条 MiniTask。</p></div>';
            });
        }
        if (taskCourse) {
            loadCourseOptions(taskCourse, refreshTaskAssignment);
            taskCourse.onchange = refreshTaskAssignment;
            taskAssignment.onchange = refreshTaskGroup;
            qs("#extTaskReload").onclick = refreshTasks;
        }
        function taskBody() {
            var stageSelect = qs("#extTaskStageId");
            return {
                title: qs("#extTaskTitle").value.trim(),
                description: qs("#extTaskDesc").value.trim() || null,
                assigneeIds: qs("#extTaskAssignee").value.trim() ? [qs("#extTaskAssignee").value.trim()] : [],
                dueAt: qs("#extTaskDue").value ? new Date(qs("#extTaskDue").value).toISOString() : null,
                priority: qs("#extTaskPriority").value,
                status: qs("#extTaskStatus").value,
                stageId: stageSelect && stageSelect.value ? stageSelect.value : undefined,
            };
        }
        qs("#extTaskCreate").onclick = function () {
            api().postJson("/api/v1/groups/" + encodeURIComponent(qs("#extTaskGroupId").value) + "/minitasks", taskBody()).then(function () {
                setResult(taskResult, "创建成功", "任务已创建。", false);
                return refreshTasks();
            }).catch(function (err) {
                setResult(taskResult, "创建失败", err.message, true);
            });
        };
        qs("#extTaskPatch").onclick = function () {
            api().patchJson("/api/v1/minitasks/" + encodeURIComponent(qs("#extTaskId").value.trim()), taskBody()).then(function () {
                setResult(taskResult, "保存成功", "任务已更新。", false);
                return refreshTasks();
            }).catch(function (err) {
                setResult(taskResult, "保存失败", err.message, true);
            });
        };
        qs("#extTaskStatusSave").onclick = function () {
            api().patchJson("/api/v1/minitasks/" + encodeURIComponent(qs("#extTaskId").value.trim()) + "/status", { status: qs("#extTaskStatus").value }).then(function () {
                setResult(taskResult, "状态已更新", "任务状态已保存。", false);
                return refreshTasks();
            }).catch(function (err) {
                setResult(taskResult, "状态更新失败", err.message, true);
            });
        };

        var submitCourse = qs("#extSubmitCourse");
        var submitAssignment = qs("#extSubmitAssignment");
        var submitStage = qs("#extSubmitStage");
        var submitResult = qs("#extSubmitResult");
        function refreshSubmitAssignments() {
            return loadAssignmentOptions(submitCourse.value, submitAssignment, false).then(refreshSubmitStageAndGroup);
        }
        function refreshSubmitStageAndGroup() {
            if (!submitAssignment.value) return Promise.resolve();
            return Promise.all([
                loadStageOptions(submitAssignment.value, submitStage, false),
                api().getJson("/api/v1/assignments/" + encodeURIComponent(submitAssignment.value) + "/my-group").catch(function () { return { data: null }; }),
            ]).then(function (payloads) {
                qs("#extSubmitGroup").value = payloads[1].data && payloads[1].data.id || "";
            });
        }
        if (submitCourse) {
            loadCourseOptions(submitCourse, refreshSubmitAssignments);
            submitCourse.onchange = refreshSubmitAssignments;
            submitAssignment.onchange = refreshSubmitStageAndGroup;
        }
        qs("#extSubmitSend").onclick = function () {
            var form = new FormData();
            form.append("title", qs("#extSubmitTitle").value.trim());
            if (qs("#extSubmitDesc").value.trim()) form.append("description", qs("#extSubmitDesc").value.trim());
            if (qs("#extSubmitContribution").value.trim()) form.append("contributionNote", qs("#extSubmitContribution").value.trim());
            if (qs("#extSubmitRepo").value.trim()) form.append("repositoryUrl", qs("#extSubmitRepo").value.trim());
            splitCsv(qs("#extSubmitLinks").value).forEach(function (link) { form.append("links[]", link); });
            Array.from(qs("#extSubmitFiles").files || []).forEach(function (file) { form.append("files", file); });
            api().postForm("/api/v1/stages/" + encodeURIComponent(submitStage.value) + "/groups/" + encodeURIComponent(qs("#extSubmitGroup").value) + "/submissions", form).then(function (payload) {
                setResult(submitResult, "提交成功", "submissionId：" + ((payload.data && payload.data.id) || "--"), false);
            }).catch(function (err) {
                setResult(submitResult, "提交失败", err.message, true);
            });
        };
    }

    function install(options) {
        var role = getRole();
        if (role === "academic") bindAcademicPanels();
        if (role === "teacher") bindTeacherPanels();
        if (role === "student") bindStudentPanels();
    }

    window.linkseeDashboardExtensions = { install: install };
})();

(function () {
    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.from((root || document).querySelectorAll(selector));
    }

    function text(selector, value) {
        var node = qs(selector);
        if (node) node.textContent = value == null ? "" : String(value);
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    function api() {
        if (!window.linkseeApi) throw new Error("API 客户端尚未加载");
        return window.linkseeApi;
    }

    function rowsOf(payload) {
        if (!payload) return [];
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.rows)) return payload.rows;
        if (Array.isArray(payload)) return payload;
        return [];
    }

    function currentRole() {
        return localStorage.getItem("auth_role") || "";
    }

    function roleLabel(role) {
        if (role === "leader") return "组长";
        if (role === "member") return "成员";
        return role || "--";
    }

    function groupStatusLabel(status) {
        if (status === "forming") return "组队进行中";
        if (status === "active") return "协作中";
        if (status === "archived") return "已归档";
        return status || "--";
    }

    function requestStatusLabel(status) {
        if (status === "pending") return "待审核";
        if (status === "approved") return "已通过";
        if (status === "rejected") return "已拒绝";
        if (status === "cancelled") return "已取消";
        return status || "--";
    }

    function miniAvatar(label, tone) {
        var raw = String(label || "?").trim();
        var initial = raw ? raw.charAt(0).toUpperCase() : "?";
        return '<span class="student-mini-avatar' + (tone ? (' is-' + tone) : '') + '" aria-hidden="true">' + escapeHtml(initial) + '</span>';
    }

    function isStudentTeamPage() {
        return Boolean(qs("#studentTeamViewTabs")) && document.body.classList.contains("student-shell");
    }

    if (!isStudentTeamPage()) return;

    var state = {
        currentGroup: null,
        groupRows: [],
        search: "",
        tasks: [],
        stages: [],
        members: [],
        activityFilter: "all",
        mockEnabled: true,
        selectedTaskId: "",
    };

    var mockTeamData = [
        {
            id: "mock-course-se",
            name: "软件工程项目协作",
            meta: "2025-2026 春",
            assignments: [
                {
                    id: "mock-assignment-join",
                    name: "智能客服服务台",
                    meta: "阶段 1 · 需求梳理",
                    stages: [
                        { id: "s1", stageNo: 1, title: "需求梳理", status: "pending", dueAt: "2026-06-18T23:59:00+08:00" },
                        { id: "s2", stageNo: 2, title: "原型设计", status: "pending", dueAt: "2026-06-25T23:59:00+08:00" },
                        { id: "s3", stageNo: 3, title: "联调实现", status: "pending", dueAt: "2026-07-03T23:59:00+08:00" }
                    ],
                    myGroup: null,
                    groups: [
                        { id: "g101", groupNo: 1, name: "交互调研小组", leaderUserId: "2023010101", status: "forming", _count: { members: 4 } },
                        { id: "g102", groupNo: 2, name: "原型实现小组", leaderUserId: "2023010102", status: "forming", _count: { members: 3 } },
                        { id: "g103", groupNo: 3, name: "接口联调小组", leaderUserId: "2023010103", status: "forming", _count: { members: 5 } }
                    ],
                    joinRequests: [
                        { id: "jr1", applicantUserId: "2023010001", reason: "希望参与原型设计和前端体验梳理。", status: "pending" },
                        { id: "jr2", applicantUserId: "2023010001", reason: "之前申请过文档方向小组。", status: "rejected" }
                    ],
                    tasks: [],
                    members: []
                },
                {
                    id: "mock-assignment-member",
                    name: "智慧排课助手",
                    meta: "阶段 3 · 开发实现",
                    stages: [
                        { id: "m1", stageNo: 1, title: "需求分析", status: "done", dueAt: "2026-05-20T23:59:00+08:00" },
                        { id: "m2", stageNo: 2, title: "原型设计", status: "done", dueAt: "2026-05-30T23:59:00+08:00" },
                        { id: "m3", stageNo: 3, title: "开发实现", status: "current", dueAt: "2026-06-15T23:59:00+08:00" },
                        { id: "m4", stageNo: 4, title: "联调测试", status: "pending", dueAt: "2026-06-28T23:59:00+08:00" },
                        { id: "m5", stageNo: 5, title: "答辩提交", status: "pending", dueAt: "2026-07-06T23:59:00+08:00" },
                        { id: "m6", stageNo: 6, title: "归档复盘", status: "pending", dueAt: "2026-07-12T23:59:00+08:00" },
                        { id: "m7", stageNo: 7, title: "展示优化", status: "pending", dueAt: "2026-07-18T23:59:00+08:00" }
                    ],
                    myGroup: { id: "g201", groupNo: 2, name: "洛谷学术组", myRole: "member", status: "active", _count: { members: 5 } },
                    groups: [],
                    joinRequests: [
                        { id: "jr3", applicantUserId: "2023010001", reason: "已加入当前小组。", status: "approved" }
                    ],
                    tasks: [
                        { id: "t201", title: "梳理排课冲突规则", description: "整理课程冲突的优先级和例外规则。", status: "todo", assigneeIds: ["2023010001"], updatedAt: "2026-06-09T10:00:00+08:00", dueAt: "2026-06-12T20:00:00+08:00", priority: "medium", stageId: "m3" },
                        { id: "t202", title: "实现拖拽排课面板", description: "完成课表拖拽交互与保存。", status: "in_progress", assigneeIds: ["2023010001"], updatedAt: "2026-06-09T09:00:00+08:00", dueAt: "2026-06-15T18:00:00+08:00", priority: "high", stageId: "m3" },
                        { id: "t203", title: "复查周视图适配", description: "检查移动端周视图断点。", status: "done", assigneeIds: ["2023010002"], updatedAt: "2026-06-08T17:00:00+08:00", dueAt: "2026-06-11T18:00:00+08:00", priority: "low", stageId: "m4" }
                    ],
                    members: [
                        { userId: "2023010001", displayName: "小泉", role: "member", presence: "online" },
                        { userId: "2023010002", displayName: "李同学", role: "member", presence: "online" },
                        { userId: "2023010003", displayName: "周同学", role: "member", presence: "away" },
                        { userId: "2023010004", displayName: "王同学", role: "member", presence: "offline" },
                        { userId: "2023010005", displayName: "陈同学", role: "leader", presence: "online" }
                    ]
                },
                {
                    id: "mock-assignment-leader",
                    name: "可视化评审工作台",
                    meta: "阶段 2 · 原型设计",
                    stages: [
                        { id: "l1", stageNo: 1, title: "方案梳理", status: "done", dueAt: "2026-05-18T23:59:00+08:00" },
                        { id: "l2", stageNo: 2, title: "原型设计", status: "current", dueAt: "2026-06-12T23:59:00+08:00" },
                        { id: "l3", stageNo: 3, title: "前端实现", status: "pending", dueAt: "2026-06-24T23:59:00+08:00" },
                        { id: "l4", stageNo: 4, title: "数据联调", status: "pending", dueAt: "2026-07-02T23:59:00+08:00" }
                    ],
                    myGroup: { id: "g301", groupNo: 5, name: "前端体验研究组", myRole: "leader", status: "active", _count: { members: 4 } },
                    groups: [],
                    joinRequests: [
                        { id: "jr4", applicantUserId: "2023010120", reason: "擅长界面细化和交互样式实现。", status: "pending", alreadyJoined: true },
                        { id: "jr5", applicantUserId: "2023010128", reason: "希望参与原型联调。", status: "pending" }
                    ],
                    tasks: [
                        { id: "t301", title: "细化右侧任务工具区", description: "整理工作台工具区的层级与表单排版。", status: "in_progress", assigneeIds: ["2023010001"], updatedAt: "2026-06-09T11:20:00+08:00", dueAt: "2026-06-14T18:00:00+08:00", priority: "high", stageId: "l2" },
                        { id: "t302", title: "整理阶段视觉轨道", description: "补齐阶段时间轴的状态与节点交互。", status: "todo", assigneeIds: ["2023010002"], updatedAt: "2026-06-09T08:40:00+08:00", dueAt: "2026-06-16T18:00:00+08:00", priority: "medium", stageId: "l2" },
                        { id: "t303", title: "同步申请记录样式", description: "收紧右侧申请记录侧栏。", status: "done", assigneeIds: ["2023010003"], updatedAt: "2026-06-08T19:00:00+08:00", dueAt: "2026-06-10T18:00:00+08:00", priority: "low", stageId: "l1" }
                    ],
                    members: [
                        { userId: "2023010001", displayName: "小泉", role: "leader", presence: "online" },
                        { userId: "2023010002", displayName: "李同学", role: "member", presence: "away" },
                        { userId: "2023010003", displayName: "周同学", role: "member", presence: "online" },
                        { userId: "2023010004", displayName: "王同学", role: "member", presence: "offline" }
                    ]
                }
            ]
        }
    ];

    function currentUserId() {
        return localStorage.getItem("auth_user_id") || "2023010001";
    }

    function currentUserName() {
        return localStorage.getItem("auth_real_name") || "小泉";
    }

    function mockCourseRows() {
        return mockTeamData.slice();
    }

    function mockAssignmentRows(courseId) {
        var course = mockTeamData.find(function (row) { return row.id === courseId; });
        return course ? course.assignments.slice() : [];
    }

    function currentMockAssignment() {
        var courseId = taskCourse && taskCourse.value;
        var assignmentId = taskAssignment && taskAssignment.value;
        return mockAssignmentRows(courseId).find(function (row) {
            return row.id === assignmentId;
        }) || null;
    }

    function ensureMockContext() {
        if (!state.mockEnabled || !taskCourse || !taskAssignment) return;
        if (!taskCourse.options.length) {
            taskCourse.innerHTML = mockCourseRows().map(function (course) {
                return '<option value="' + escapeHtml(course.id) + '">' + escapeHtml(course.name + " · " + course.meta) + '</option>';
            }).join("");
        }
        if (!taskCourse.value && taskCourse.options.length) {
            taskCourse.value = taskCourse.options[0].value;
        }
        var previousAssignment = taskAssignment.value || "";
        var assignments = mockAssignmentRows(taskCourse.value);
        taskAssignment.innerHTML = assignments.map(function (assignment) {
            return '<option value="' + escapeHtml(assignment.id) + '">' + escapeHtml(assignment.name + " · " + assignment.meta) + '</option>';
        }).join("");
        if (previousAssignment && assignments.some(function (assignment) { return String(assignment.id) === String(previousAssignment); })) {
            taskAssignment.value = previousAssignment;
        }
        if (!taskAssignment.value && taskAssignment.options.length) {
            taskAssignment.value = taskAssignment.options[0].value;
        }
    }

    var taskCourse = qs("#extTaskCourse");
    var taskAssignment = qs("#extTaskAssignment");
    var groupResult = qs("#extStudentGroupResult");
    var joinList = qs("#extStudentGroupList");
    var requestList = qs("#studentJoinRequestList");
    var currentGroupBox = qs("#studentJoinCurrentGroup");
    var createDetails = qs("#studentInlineCreateGroup");
    var stageRail = qs(".student-stage-progress-rail");
    var stageProgress = qs("#studentTeamStageProgress");
    var activityFeed = qs("#studentTeamActivityFeed");
    var taskSummary = qs("#studentTaskSummary");
    var memberList = qs("#studentTeamMemberList");
    var pendingJoinBadge = qs("#studentPendingJoinBadge");
    var joinRequestMeta = qs("#studentJoinRequestMeta");
    var createToggleButton = qs("#studentJoinCreateToggleBtn");
    var inviteButton = qs("#studentGenerateInviteBtn");
    var inviteCode = qs("#studentInviteCode");
    var workbenchInviteButton = qs("#studentWorkbenchGenerateInviteBtn");
    var workbenchInviteCode = qs("#studentWorkbenchInviteCode");

    function setResult(host, title, detail, isError) {
        if (!host) return;
        host.hidden = false;
        host.innerHTML = '<strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(detail || "") + '</p>';
        host.classList.toggle("is-error", Boolean(isError));
    }

    function clearResult(host) {
        if (!host) return;
        host.hidden = true;
        host.innerHTML = "";
        host.classList.remove("is-error");
    }

    function applyViewTabs() {
        qsa("#studentTeamViewTabs .student-view-tab").forEach(function (button) {
            button.addEventListener("click", function () {
                var key = button.getAttribute("data-team-view");
                qsa("#studentTeamViewTabs .student-view-tab").forEach(function (node) {
                    node.classList.toggle("is-active", node === button);
                });
                qsa(".student-team-view").forEach(function (view) {
                    var active = view.id === "studentTeam" + key.charAt(0).toUpperCase() + key.slice(1) + "View";
                    view.hidden = !active;
                    view.classList.toggle("is-active", active);
                });
            });
        });
    }

    function updateContext(group) {
        var courseText = taskCourse && taskCourse.options[taskCourse.selectedIndex] ? taskCourse.options[taskCourse.selectedIndex].text.split(" · ")[0] : "--";
        var assignmentText = taskAssignment && taskAssignment.options[taskAssignment.selectedIndex] ? taskAssignment.options[taskAssignment.selectedIndex].text.split(" · ")[0] : "--";
        text("#studentTeamCourseName", courseText || "--");
        text("#studentTeamAssignmentName", assignmentText || "--");
        text("#studentTeamCourseMeta", taskCourse && taskCourse.value ? "已选课程" : "请选择课程");
        text("#studentTeamAssignmentMeta", taskAssignment && taskAssignment.value ? "已选项目" : "请选择项目");
        text("#studentTeamGroupName", group ? (group.name || ("第 " + group.groupNo + " 组")) : "--");
        text("#studentTeamGroupStatus", group ? groupStatusLabel(group.status) : "尚未入组");
        text("#studentTeamRole", group ? roleLabel(group.myRole || "member") : "--");
        text("#studentTeamMemberCount", group && group._count ? ("成员数 " + (group._count.members || 0)) : "成员数 0");
        if (createDetails) createDetails.hidden = Boolean(group);
        if (currentGroupBox) currentGroupBox.hidden = !group;
    }

    function renderCurrentGroup(group) {
        if (!currentGroupBox) return;
        if (!group) {
            currentGroupBox.hidden = true;
            currentGroupBox.innerHTML = "";
            return;
        }
        currentGroupBox.hidden = false;
        currentGroupBox.innerHTML = [
            '<div class="student-join-side-current">',
            '<div class="student-join-side-heading student-join-side-heading-row">',
            '<strong>当前小组</strong>',
            '<small>' + escapeHtml(roleLabel(group.myRole || "member")) + '</small>',
            '</div>',
            '<div class="student-group-current-inline-head">',
            miniAvatar(group.name || ("第 " + group.groupNo + " 组"), "own"),
            '<div class="student-group-current-inline-copy">',
            '<strong>' + escapeHtml(group.name || ("第 " + group.groupNo + " 组")) + '</strong>',
            '<p>可直接查看协作动态和 MiniTask 工作台。</p>',
            '</div>',
            '<span class="badge badge-active">已加入</span>',
            '</div>',
            '<div class="student-group-current-inline-meta">',
            '<span class="student-row-chip">小组编号 ' + escapeHtml(group.id || "--") + '</span>',
            '<span class="student-row-chip">成员 ' + escapeHtml(String(group._count && group._count.members || 0)) + '</span>',
            '</div>',
            '</div>'
        ].join("");
    }

    function renderGroupRows(rows) {
        if (!joinList) return;
        var search = state.search.trim().toLowerCase();
        var visible = rows.filter(function (group) {
            if (state.currentGroup && String(group.id) === String(state.currentGroup.id)) return false;
            if (!search) return true;
            return [group.name, group.groupNo, group.leaderUserId].join(" ").toLowerCase().indexOf(search) >= 0;
        });
        if (!visible.length) {
            joinList.innerHTML = '<div class="student-group-market-inline-empty">当前没有更多可加入的小组，你可以直接在下方创建自己的小组。</div>';
            return;
        }
        joinList.innerHTML = visible.map(function (group) {
            return [
                '<div class="student-group-market-row">',
                '<div class="student-group-market-row-main">',
                miniAvatar(group.name || ("第 " + group.groupNo + " 组"), "teal"),
                '<div class="student-group-market-row-copy">',
                '<strong>' + escapeHtml(group.name || ("第 " + group.groupNo + " 组")) + '</strong>',
                '<p>第 ' + escapeHtml(String(group.groupNo || "--")) + ' 组</p>',
                '</div>',
                '</div>',
                '<span class="student-group-market-cell">' + escapeHtml(String(group._count && group._count.members || 0)) + ' 人</span>',
                '<span class="student-group-market-cell is-dim">' + escapeHtml(group.leaderUserId || "--") + '</span>',
                '<span class="badge badge-pending">' + escapeHtml(groupStatusLabel(group.status || "--")) + '</span>',
                '<div class="student-group-market-row-actions">',
                '<button class="btn btn-primary student-inline-action" type="button" data-group-join="' + escapeHtml(group.id) + '" data-group-name="' + escapeHtml(group.name || ("第 " + group.groupNo + " 组")) + '">加入</button>',
                '</div>',
                '</div>'
            ].join("");
        }).join("");
    }

    function renderRequestRows(rows, mine) {
        if (!requestList) return;
        if (!mine) {
            requestList.innerHTML = '<div class="student-inline-empty">加入小组后，这里会显示你的申请记录。</div>';
            text("#studentJoinRequestMeta", "待处理申请 0");
            if (pendingJoinBadge) pendingJoinBadge.textContent = "0";
            return;
        }
        var pending = rows.filter(function (row) { return row.status === "pending"; }).length;
        text("#studentJoinRequestMeta", "待处理申请 " + pending);
        if (pendingJoinBadge) pendingJoinBadge.textContent = String(pending);
        requestList.innerHTML = rows.length ? rows.map(function (row) {
            return '<article class="student-request-card">' + miniAvatar(row.applicantUserId || "--", row.status === "pending" ? "rose" : "teal") + '<div class="student-request-copy"><strong>' + escapeHtml(row.applicantUserId || "--") + '</strong><p>' + escapeHtml(row.reason || "申请加入小组") + '</p><small>申请编号 ' + escapeHtml(row.id || "--") + '</small></div><div class="student-request-meta"><span>' + escapeHtml(requestStatusLabel(row.status)) + '</span></div></article>';
        }).join("") : '<div class="student-inline-empty">暂无申请记录</div>';
    }

    function normalizedStageStatus(stage) {
        var raw = String(stage && stage.status || "").toLowerCase();
        if (/done|completed|finished|archived|closed/.test(raw)) return "complete";
        if (/active|current|in_progress|ongoing|started|open|running/.test(raw)) return "current";
        return "pending";
    }

    function stageLabel(status) {
        if (status === "complete") return "已完成";
        if (status === "current") return "进行中";
        return "待开始";
    }

    function formatShortDate(value) {
        if (!value) return "";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        var mm = String(date.getMonth() + 1).padStart(2, "0");
        var dd = String(date.getDate()).padStart(2, "0");
        return mm + "/" + dd;
    }

    function formatDeadline(value) {
        if (!value) return "未设置截止时间";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "未设置截止时间";
        var mm = String(date.getMonth() + 1).padStart(2, "0");
        var dd = String(date.getDate()).padStart(2, "0");
        return mm + "/" + dd + " 截止";
    }

    function findMemberByUserId(userId) {
        return (state.members || []).find(function (member) {
            return String(member.userId || member.id || "") === String(userId || "");
        }) || null;
    }

    function resolveAssigneeLabels(task) {
        var ids = Array.isArray(task && task.assigneeIds) ? task.assigneeIds : [];
        if (!ids.length) return ["未分配"];
        return ids.map(function (assigneeId) {
            var member = findMemberByUserId(assigneeId);
            return member && (member.displayName || member.name || member.userId) || assigneeId;
        });
    }

    function presenceTone(value) {
        if (value === "online") return "online";
        if (value === "away") return "away";
        if (value === "offline") return "offline";
        return "unknown";
    }

    function presenceLabel(value) {
        if (value === "online") return "在线";
        if (value === "away") return "暂离";
        if (value === "offline") return "离线";
        return "未知";
    }

    function renderStageProgress(stages, tasks) {
        if (!stageProgress) return;
        var rows = (stages || []).slice().sort(function (a, b) {
            return Number(a.stageNo || 0) - Number(b.stageNo || 0);
        });
        var hasStarted = rows.some(function (stage) {
            return normalizedStageStatus(stage) !== "pending";
        }) || (tasks || []).length > 0;
        if (!rows.length || !hasStarted) {
            stageProgress.innerHTML = [
                '<article class="student-stage-progress-item is-pending is-single">',
                '<span class="student-stage-progress-index">•</span>',
                '<strong>待开始</strong>',
                '<small>项目尚未进入执行阶段</small>',
                '</article>'
            ].join("");
            return;
        }
        var currentMarked = false;
        var firstPendingIndex = rows.findIndex(function (stage) {
            return normalizedStageStatus(stage) === "pending";
        });
        stageProgress.innerHTML = rows.map(function (stage, index) {
            var status = normalizedStageStatus(stage);
            if (status === "current") currentMarked = true;
            return {
                stage: stage,
                index: index,
                status: status,
            };
        }).map(function (entry) {
            var status = entry.status;
            if (!currentMarked && firstPendingIndex >= 0) {
                if (entry.index < firstPendingIndex) status = "complete";
                if (entry.index === firstPendingIndex) status = "current";
            }
            return [
                '<article class="student-stage-progress-item is-' + status + '">',
                '<span class="student-stage-progress-index">' + escapeHtml(String(entry.stage.stageNo || (entry.index + 1))) + '</span>',
                '<strong>' + escapeHtml(entry.stage.title || ("阶段 " + (entry.stage.stageNo || (entry.index + 1)))) + '</strong>',
                '<p>' + escapeHtml(stageLabel(status)) + '</p>',
                '<small>' + escapeHtml(formatShortDate(entry.stage.deadlineAt || entry.stage.dueAt || entry.stage.endAt) || " ") + '</small>',
                '</article>'
            ].join("");
        }).join("");
    }

    function taskStatusLabel(status) {
        if (status === "todo") return "待办";
        if (status === "in_progress") return "进行中";
        if (status === "done") return "已完成";
        if (status === "cancelled") return "已取消";
        return status || "--";
    }

    function taskStatusTone(status) {
        if (status === "done") return "teal";
        if (status === "in_progress") return "amber";
        if (status === "cancelled") return "slate";
        return "rose";
    }

    function renderTaskSummary(tasks) {
        if (!taskSummary) return;
        var me = currentUserId();
        var rows = (tasks || []).filter(function (task) {
            return Array.isArray(task.assigneeIds) && task.assigneeIds.some(function (assigneeId) {
                return String(assigneeId) === String(me);
            });
        }).sort(function (a, b) {
            return new Date(a.dueAt || a.updatedAt || a.createdAt || 0).getTime() - new Date(b.dueAt || b.updatedAt || b.createdAt || 0).getTime();
        });
        if (!rows.length) {
            taskSummary.innerHTML = '<div class="student-inline-empty">你当前没有待跟进的任务。</div>';
            return;
        }
        taskSummary.innerHTML = rows.slice(0, 3).map(function (task) {
            return [
                '<article class="student-task-metric">',
                '<span class="student-task-metric-dot is-' + escapeHtml(taskStatusTone(task.status)) + '"></span>',
                '<div class="student-task-metric-copy">',
                '<strong>' + escapeHtml(task.title || "未命名任务") + '</strong>',
                '<small>' + escapeHtml(taskStatusLabel(task.status)) + ' · ' + escapeHtml(formatDeadline(task.dueAt)) + '</small>',
                '</div>',
            '</article>'
            ].join("");
        }).join("");
    }

    function renderActivityFeed(tasks) {
        if (!activityFeed) return;
        var rows = (tasks || []).slice();
        if (state.activityFilter !== "all") {
            rows = rows.filter(function (task) { return task.status === state.activityFilter; });
        }
        rows.sort(function (a, b) {
            return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
        });
        if (!rows.length) {
            activityFeed.innerHTML = '<div class="student-inline-empty">当前筛选下暂无协作动态。</div>';
            return;
        }
        activityFeed.innerHTML = rows.slice(0, 10).map(function (task) {
            var assignee = resolveAssigneeLabels(task)[0] || "--";
            return [
                '<article class="student-activity-row">',
                '<div class="student-activity-avatar-wrap">' + miniAvatar(assignee, taskStatusTone(task.status)) + '</div>',
                '<div class="student-activity-copy">',
                '<strong>' + escapeHtml(task.title || "未命名任务") + '</strong>',
                '<p>负责人 ' + escapeHtml(assignee) + ' · ' + escapeHtml(task.description || stageLabel(task.status)) + '</p>',
                '</div>',
                '<div class="student-activity-meta"><span class="badge badge-' + escapeHtml(taskStatusTone(task.status)) + '">' + escapeHtml(taskStatusLabel(task.status)) + '</span></div>',
                '</article>'
            ].join("");
        }).join("");
    }

    function renderMemberList(group) {
        if (!memberList) return;
        var members = Array.isArray(group && group.members) ? group.members : [];
        if (!members.length) {
            var count = state.currentGroup && state.currentGroup._count ? state.currentGroup._count.members || 0 : 0;
            memberList.innerHTML = '<div class="student-inline-empty">当前已登记成员 ' + escapeHtml(String(count)) + ' 人。</div>';
            return;
        }
        memberList.innerHTML = members.map(function (member) {
            var label = member.displayName || member.name || member.userId || member.id || "--";
            var role = member.role === "leader" ? "组长" : "成员";
            var tone = presenceTone(member.presence);
            return [
                '<article class="student-member-item">',
                miniAvatar(label, member.role === "leader" ? "amber" : "teal"),
                '<div class="student-member-copy"><strong>' + escapeHtml(label) + '</strong><small>' + escapeHtml(role) + '</small></div>',
                '<span class="student-member-state is-' + escapeHtml(tone) + '">' + escapeHtml(presenceLabel(member.presence)) + '</span>',
                '</article>'
            ].join("");
        }).join("");
    }

    function syncLeaderStageOptions() {
        var leaderStage = qs("#studentLeaderTaskStage");
        if (!leaderStage) return;
        var previousValue = leaderStage.value || "";
        var rows = (state.stages || []).slice().sort(function (a, b) {
            return Number(a.stageNo || 0) - Number(b.stageNo || 0);
        });
        leaderStage.innerHTML = ['<option value="">不绑定阶段</option>'].concat(rows.map(function (stage) {
            return '<option value="' + escapeHtml(stage.id) + '">' + escapeHtml((stage.stageNo ? ("阶段 " + stage.stageNo + " · ") : "") + (stage.title || "未命名阶段")) + '</option>';
        })).join("");
        if (previousValue && rows.some(function (stage) { return String(stage.id) === String(previousValue); })) {
            leaderStage.value = previousValue;
        }
    }

    function syncWorkbenchStageOptions() {
        var stageSelect = qs("#extTaskStageId");
        if (!stageSelect) return;
        var previousValue = stageSelect.value || "";
        var rows = (state.stages || []).slice().sort(function (a, b) {
            return Number(a.stageNo || 0) - Number(b.stageNo || 0);
        });
        stageSelect.innerHTML = ['<option value="">全部阶段（含未绑定任务）</option>'].concat(rows.map(function (stage) {
            return '<option value="' + escapeHtml(stage.id) + '">' + escapeHtml((stage.stageNo ? ("阶段 " + stage.stageNo + " · ") : "") + (stage.title || "未命名阶段")) + '</option>';
        })).join("");
        if (previousValue && rows.some(function (stage) { return String(stage.id) === String(previousValue); })) {
            stageSelect.value = previousValue;
        }
    }

    function renderWorkbenchTaskList() {
        var taskList = qs("#extTaskList");
        if (!taskList) return;
        var rows = (state.tasks || []).slice();
        var search = (qs("#studentTaskSearch") && qs("#studentTaskSearch").value || "").trim().toLowerCase();
        var stageId = qs("#extTaskStageId") && qs("#extTaskStageId").value || "";
        var status = qs("#studentTaskStatusFilter") && qs("#studentTaskStatusFilter").value || "";
        var mineOnly = Boolean(qs("#studentTaskMineOnly") && qs("#studentTaskMineOnly").checked);
        var me = currentUserId();
        rows = rows.filter(function (task) {
            if (search) {
                var hay = [task.title, task.description].join(" ").toLowerCase();
                if (hay.indexOf(search) < 0) return false;
            }
            if (stageId && String(task.stageId || "") !== String(stageId)) return false;
            if (status && String(task.status || "") !== String(status)) return false;
            if (mineOnly && (!Array.isArray(task.assigneeIds) || !task.assigneeIds.some(function (id) { return String(id) === String(me); }))) return false;
            return true;
        });
        if (!rows.length) {
            taskList.innerHTML = '<div class="student-inline-empty">当前筛选下没有可显示的任务。</div>';
            return;
        }
        taskList.innerHTML = rows.map(function (task) {
            var selected = String(task.id) === String(state.selectedTaskId);
            return [
                '<button class="student-task-row' + (selected ? ' is-active' : '') + '" type="button" data-student-task-id="' + escapeHtml(task.id) + '">',
                '<div class="student-task-copy">',
                '<strong>' + escapeHtml(task.title || "未命名任务") + '</strong>',
                '<p>' + escapeHtml(resolveAssigneeLabels(task).join("、")) + ' · ' + escapeHtml(formatDeadline(task.dueAt)) + '</p>',
                '</div>',
                '<span class="badge badge-' + escapeHtml(taskStatusTone(task.status)) + '">' + escapeHtml(taskStatusLabel(task.status)) + '</span>',
                '</button>'
            ].join("");
        }).join("");
    }

    function renderSelectedTask() {
        var rows = state.tasks || [];
        var task = rows.find(function (row) { return String(row.id) === String(state.selectedTaskId); }) || rows[0] || null;
        var patchBtn = qs("#extTaskPatch");
        var statusBtn = qs("#extTaskStatusSave");
        if (!task) {
            text("#studentEditorScope", "未绑定阶段");
            text("#studentEditorAssignee", "待填写");
            text("#studentEditorState", "待办");
            var ids = ["#extTaskId", "#extTaskTitle", "#extTaskDesc", "#extTaskAssignee", "#extTaskDue"];
            ids.forEach(function (selector) {
                var node = qs(selector);
                if (node) node.value = "";
            });
            if (qs("#extTaskPriority")) qs("#extTaskPriority").value = "medium";
            if (qs("#extTaskStatus")) qs("#extTaskStatus").value = "todo";
            ["#extTaskTitle", "#extTaskDesc", "#extTaskAssignee", "#extTaskDue", "#extTaskPriority", "#extTaskStatus"].forEach(function (selector) {
                var node = qs(selector);
                if (node) node.disabled = true;
            });
            if (patchBtn) patchBtn.disabled = true;
            if (statusBtn) statusBtn.disabled = true;
            return;
        }
        state.selectedTaskId = task.id;
        var stage = (state.stages || []).find(function (row) { return String(row.id || "") === String(task.stageId || ""); }) || null;
        text("#studentEditorScope", stage ? (stage.title || "已绑定阶段") : "未绑定阶段");
        text("#studentEditorAssignee", resolveAssigneeLabels(task).join("、"));
        text("#studentEditorState", taskStatusLabel(task.status));
        if (qs("#extTaskId")) qs("#extTaskId").value = task.id || "";
        if (qs("#extTaskTitle")) qs("#extTaskTitle").value = task.title || "";
        if (qs("#extTaskDesc")) qs("#extTaskDesc").value = task.description || "";
        if (qs("#extTaskAssignee")) qs("#extTaskAssignee").value = Array.isArray(task.assigneeIds) ? (task.assigneeIds[0] || "") : "";
        if (qs("#extTaskDue")) qs("#extTaskDue").value = task.dueAt ? String(task.dueAt).slice(0, 16) : "";
        if (qs("#extTaskPriority")) qs("#extTaskPriority").value = task.priority || "medium";
        if (qs("#extTaskStatus")) qs("#extTaskStatus").value = task.status || "todo";
        var isLeader = state.currentGroup && state.currentGroup.myRole === "leader";
        var canUpdateOwnStatus = task.status !== "cancelled" && Array.isArray(task.assigneeIds) && task.assigneeIds.some(function (assigneeId) {
            return String(assigneeId) === String(currentUserId());
        });
        if (patchBtn) patchBtn.disabled = !isLeader;
        if (statusBtn) statusBtn.disabled = !(canUpdateOwnStatus || isLeader);
        ["#extTaskTitle", "#extTaskDesc", "#extTaskAssignee", "#extTaskDue", "#extTaskPriority"].forEach(function (selector) {
            var node = qs(selector);
            if (node) node.disabled = !isLeader;
        });
        if (qs("#extTaskStatus")) qs("#extTaskStatus").disabled = !(canUpdateOwnStatus || isLeader);
        renderWorkbenchTaskList();
    }

    function renderWorkbenchState() {
        syncWorkbenchStageOptions();
        syncLeaderStageOptions();
        renderWorkbenchTaskList();
        renderSelectedTask();
    }

    function clearActivitySurfaces() {
        renderStageProgress([], []);
        renderTaskSummary([]);
        renderActivityFeed([]);
        renderMemberList(null);
        if (pendingJoinBadge) pendingJoinBadge.textContent = "0";
    }

    function refreshActivityState() {
        if (state.mockEnabled) {
            var mockAssignment = currentMockAssignment();
            if (!mockAssignment) {
                clearActivitySurfaces();
                return Promise.resolve();
            }
            state.stages = mockAssignment.stages.slice();
            state.tasks = mockAssignment.tasks.slice();
            renderStageProgress(state.stages, state.tasks);
            renderTaskSummary(state.tasks);
            renderActivityFeed(state.tasks);
            state.members = (mockAssignment.members || []).slice();
            renderMemberList({ members: state.members });
            var pendingCount = (mockAssignment.joinRequests || []).filter(function (row) { return row.status === "pending"; }).length;
            if (pendingJoinBadge) pendingJoinBadge.textContent = String(pendingCount);
            renderWorkbenchState();
            return Promise.resolve();
        }
        if (!taskAssignment || !taskAssignment.value) {
            clearActivitySurfaces();
            return Promise.resolve();
        }
        return api().getJson("/api/v1/assignments/" + encodeURIComponent(taskAssignment.value) + "/stages").catch(function () {
            return { data: [] };
        }).then(function (payload) {
            state.stages = rowsOf(payload);
            if (!state.currentGroup) {
                clearActivitySurfaces();
                renderStageProgress(state.stages, []);
                return;
            }
            return Promise.all([
                api().getJson("/api/v1/groups/" + encodeURIComponent(state.currentGroup.id) + "/minitasks").catch(function () { return { data: [] }; }),
                api().getJson("/api/v1/groups/" + encodeURIComponent(state.currentGroup.id)).catch(function () { return { data: null }; }),
                api().getJson("/api/v1/groups/" + encodeURIComponent(state.currentGroup.id) + "/join-requests").catch(function () { return { data: [] }; }),
            ]).then(function (payloads) {
                state.tasks = rowsOf(payloads[0]);
                var detail = payloads[1] && payloads[1].data || state.currentGroup;
                renderStageProgress(state.stages, state.tasks);
                renderTaskSummary(state.tasks);
                renderActivityFeed(state.tasks);
                state.members = Array.isArray(detail && detail.members) ? detail.members : [];
                renderMemberList({ members: state.members });
                var pending = rowsOf(payloads[2]).filter(function (row) { return row.status === "pending"; }).length;
                if (pendingJoinBadge) pendingJoinBadge.textContent = String(pending);
                renderWorkbenchState();
            });
        });
    }

    function applyCapabilityState(group) {
        var grouped = Boolean(group);
        var leader = grouped && group.myRole === "leader";
        var gate = qs("#studentWorkbenchGate");
        var editor = qs("#studentWorkbenchEditor");
        var invite = qs("#studentWorkbenchInviteCard");
        var discuss = qs("#studentActivityDiscussCard");
        var leaderOps = qs("#studentLeaderOpsPanel");
        var summary = qs("#studentActivitySummaryCard");
        var members = qs("#studentActivityMembersCard");
        var viewAll = qs("#studentTaskViewAllBtn");
        if (gate) gate.hidden = grouped;
        if (editor) editor.hidden = !grouped;
        if (invite) invite.hidden = !leader;
        if (discuss) discuss.hidden = !grouped;
        if (summary) summary.hidden = !grouped;
        if (members) members.hidden = !grouped;
        if (leaderOps) leaderOps.hidden = !leader;
        if (viewAll) viewAll.disabled = !grouped;
        var createBox = qs(".student-leader-create-box");
        if (createBox) createBox.hidden = !leader;
    }

    function refreshJoinState() {
        if (state.mockEnabled) {
            ensureMockContext();
            var mockAssignment = currentMockAssignment();
            if (!mockAssignment) {
                state.currentGroup = null;
                updateContext(null);
                renderCurrentGroup(null);
                if (joinList) joinList.innerHTML = '<div class="student-group-market-inline-empty">当前没有可展示的小组。</div>';
                if (requestList) requestList.innerHTML = '<div class="student-inline-empty">暂无申请记录。</div>';
                applyCapabilityState(null);
                clearActivitySurfaces();
                return Promise.resolve();
            }
            state.groupRows = mockAssignment.groups.slice();
            state.currentGroup = mockAssignment.myGroup ? JSON.parse(JSON.stringify(mockAssignment.myGroup)) : null;
            updateContext(state.currentGroup);
            renderCurrentGroup(state.currentGroup);
            renderGroupRows(state.groupRows);
            applyCapabilityState(state.currentGroup);
            renderRequestRows((mockAssignment.joinRequests || []).slice(), state.currentGroup);
            return refreshActivityState();
        }
        if (!taskAssignment || !taskAssignment.value) {
            state.currentGroup = null;
            updateContext(null);
            renderCurrentGroup(null);
            if (joinList) joinList.innerHTML = '<div class="student-group-market-inline-empty">请先选择课程和项目，再查看可加入的小组。</div>';
            if (requestList) requestList.innerHTML = '<div class="student-inline-empty">请选择项目后查看申请记录。</div>';
            applyCapabilityState(null);
            clearActivitySurfaces();
            return Promise.resolve();
        }
        return Promise.all([
            api().getJson("/api/v1/assignments/" + encodeURIComponent(taskAssignment.value) + "/groups").catch(function () { return { data: [] }; }),
            api().getJson("/api/v1/assignments/" + encodeURIComponent(taskAssignment.value) + "/my-group").catch(function () { return { data: null }; }),
        ]).then(function (payloads) {
            state.groupRows = rowsOf(payloads[0]);
            state.currentGroup = payloads[1].data || null;
            updateContext(state.currentGroup);
            renderCurrentGroup(state.currentGroup);
            renderGroupRows(state.groupRows);
            applyCapabilityState(state.currentGroup);
            if (!state.currentGroup) {
                if (requestList) requestList.innerHTML = '<div class="student-inline-empty">加入小组后，这里会显示你的申请记录和相关状态。</div>';
                return refreshActivityState();
            }
            return api().getJson("/api/v1/groups/" + encodeURIComponent(state.currentGroup.id) + "/join-requests").then(function (payload) {
                renderRequestRows(rowsOf(payload), state.currentGroup);
                return refreshActivityState();
            }).catch(function () {
                renderRequestRows([], state.currentGroup);
                return refreshActivityState();
            });
        });
    }

    function bindStageWheel() {
        if (!stageRail) return;
        stageRail.addEventListener("wheel", function (event) {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            if (stageRail.scrollWidth <= stageRail.clientWidth + 2) return;
            event.preventDefault();
            stageRail.scrollLeft += event.deltaY;
        }, { passive: false });
    }

    function bindJoinActions() {
        var joinSearch = qs("#studentJoinSearch");
        if (joinSearch) {
            joinSearch.addEventListener("input", function () {
                state.search = joinSearch.value || "";
                renderGroupRows(state.groupRows || []);
            });
        }
        if (taskCourse && state.mockEnabled) {
            taskCourse.addEventListener("change", function () {
                ensureMockContext();
                refreshJoinState();
            });
        }
        var createBtn = qs("#extStudentCreateGroup");
        if (createBtn) {
            createBtn.addEventListener("click", function () {
                var input = qs("#extStudentNewGroupName");
                if (!taskAssignment || !taskAssignment.value) return setResult(groupResult, "无法创建", "请先选择项目。", true);
                if (state.mockEnabled) {
                    var assignment = currentMockAssignment();
                    if (!assignment) return setResult(groupResult, "无法创建", "当前项目不存在。", true);
                    var nextName = input && input.value.trim() || "我的新小组";
                    assignment.myGroup = {
                        id: "g-mock-" + Date.now(),
                        groupNo: (assignment.groups.length + 1),
                        name: nextName,
                        myRole: "leader",
                        status: "active",
                        _count: { members: 1 }
                    };
                    assignment.members = [
                        { userId: "2023010001", displayName: "小泉", role: "leader" }
                    ];
                    assignment.joinRequests = [];
                    assignment.tasks = assignment.tasks || [];
                    clearResult(groupResult);
                    if (createDetails) createDetails.open = false;
                    if (input) input.value = "";
                    setResult(groupResult, "创建成功", "你已创建并加入新的小组。", false);
                    refreshJoinState();
                    return;
                }
                api().postJson("/api/v1/assignments/" + encodeURIComponent(taskAssignment.value) + "/groups", {
                    name: input && input.value.trim() || undefined,
                }).then(function () {
                    clearResult(groupResult);
                    if (createDetails) createDetails.open = false;
                    if (input) input.value = "";
                    setResult(groupResult, "创建成功", "你已创建并加入小组。", false);
                    return refreshJoinState();
                }).catch(function (err) {
                    setResult(groupResult, "创建失败", err && err.message || "请稍后重试。", true);
                });
            });
        }
        if (createToggleButton && createDetails) {
            createToggleButton.addEventListener("click", function () {
                createDetails.open = !createDetails.open;
                if (createDetails.open) {
                    var input = qs("#extStudentNewGroupName");
                    if (input) window.setTimeout(function () { input.focus(); }, 40);
                }
            });
        }
        var reloadBtn = qs("#extStudentGroupReload");
        if (reloadBtn) reloadBtn.addEventListener("click", refreshJoinState);
        qsa("#studentActivityFilterTabs .student-activity-filter").forEach(function (button) {
            button.addEventListener("click", function () {
                state.activityFilter = button.getAttribute("data-activity-filter") || "all";
                qsa("#studentActivityFilterTabs .student-activity-filter").forEach(function (node) {
                    node.classList.toggle("is-active", node === button);
                });
                renderActivityFeed(state.tasks);
            });
        });
        var activityReload = qs("#extTaskReload");
        if (activityReload) activityReload.addEventListener("click", refreshActivityState);
        if (inviteButton) {
            inviteButton.addEventListener("click", function () {
                if (!state.currentGroup) return setResult(groupResult, "无法生成", "请先加入或创建小组。", true);
                var code = "INV-" + String(state.currentGroup.groupNo || "00").padStart(2, "0") + "-" + String(Date.now()).slice(-4);
                if (inviteCode) inviteCode.textContent = code;
                setResult(groupResult, "已生成", "可将邀请口令发给待加入成员。", false);
            });
        }
        if (workbenchInviteButton) {
            workbenchInviteButton.addEventListener("click", function () {
                if (!state.currentGroup) return setResult(qs("#studentLeaderTaskResult"), "无法生成", "请先加入或创建小组。", true);
                var code = "INV-" + String(state.currentGroup.groupNo || "00").padStart(2, "0") + "-" + String(Date.now()).slice(-4);
                if (workbenchInviteCode) workbenchInviteCode.textContent = code;
                setResult(qs("#studentLeaderTaskResult"), "已生成", "邀请口令已生成，可转发给待加入成员。", false);
            });
        }
        document.addEventListener("click", function (event) {
            var join = event.target.closest("[data-group-join]");
            if (join) {
                var groupId = join.getAttribute("data-group-join") || "";
                var groupName = join.getAttribute("data-group-name") || "该小组";
                if (!groupId) return;
                if (!window.confirm("确认申请加入“" + groupName + "”吗？")) return;
                if (state.mockEnabled) {
                    var assignment = currentMockAssignment();
                    if (!assignment) return;
                    if (assignment.myGroup) {
                        return setResult(groupResult, "无法申请", "你已经加入或创建了当前项目的小组。", true);
                    }
                    assignment.joinRequests = assignment.joinRequests || [];
                    assignment.joinRequests.unshift({
                        id: "jr-mock-" + Date.now(),
                        applicantUserId: "2023010001",
                        reason: "希望加入“" + groupName + "”参与项目协作。",
                        status: "pending"
                    });
                    setResult(groupResult, "申请已提交", "已加入模拟申请记录，方便你检查界面。", false);
                    refreshJoinState();
                    return;
                }
                api().postJson("/api/v1/groups/" + encodeURIComponent(groupId) + "/join-requests", {}).then(function () {
                    setResult(groupResult, "申请已提交", "通过后会自动同步到协作动态和工作台。", false);
                    return refreshJoinState();
                }).catch(function (err) {
                    setResult(groupResult, "申请失败", err && err.message || "请稍后重试。", true);
                });
            }
        });
        var approveBtn = qs("#extStudentApproveJoin");
        if (approveBtn) {
            approveBtn.addEventListener("click", function () {
                var requestId = qs("#extStudentRequestId") && qs("#extStudentRequestId").value.trim();
                if (!requestId) return setResult(groupResult, "无法处理", "请填写申请编号。", true);
                if (state.mockEnabled) {
                    var assignment = currentMockAssignment();
                    if (!assignment) return setResult(groupResult, "无法处理", "当前项目不存在。", true);
                    var target = (assignment.joinRequests || []).find(function (row) { return row.id === requestId; });
                    if (!target) return setResult(groupResult, "未找到申请", "请确认申请编号。", true);
                    if (target.alreadyJoined) {
                        target.status = "rejected";
                        return setResult(groupResult, "无法通过", "该申请对应学生已经加入或创建了其他小组。", true);
                    }
                    target.status = "approved";
                    setResult(groupResult, "已同意", "模拟申请已通过。", false);
                    refreshJoinState();
                    return;
                }
                api().postJson("/api/v1/group-join-requests/" + encodeURIComponent(requestId) + "/approve", {}).then(function (payload) {
                    var result = payload && payload.data ? payload.data : payload;
                    if (result && result.reason === "applicant_already_joined") {
                        setResult(groupResult, "无法通过", "该申请对应学生已经加入或创建了其他小组。", true);
                    } else {
                        setResult(groupResult, "已同意", "该申请已通过。", false);
                    }
                    return refreshJoinState();
                }).catch(function (err) {
                    setResult(groupResult, "处理失败", err && err.message || "请稍后重试。", true);
                });
            });
        }
        var rejectBtn = qs("#extStudentRejectJoin");
        if (rejectBtn) {
            rejectBtn.addEventListener("click", function () {
                var requestId = qs("#extStudentRequestId") && qs("#extStudentRequestId").value.trim();
                if (!requestId) return setResult(groupResult, "无法处理", "请填写申请编号。", true);
                if (state.mockEnabled) {
                    var assignment = currentMockAssignment();
                    if (!assignment) return setResult(groupResult, "无法处理", "当前项目不存在。", true);
                    var target = (assignment.joinRequests || []).find(function (row) { return row.id === requestId; });
                    if (!target) return setResult(groupResult, "未找到申请", "请确认申请编号。", true);
                    target.status = "rejected";
                    setResult(groupResult, "已拒绝", "模拟申请已拒绝。", false);
                    refreshJoinState();
                    return;
                }
                api().postJson("/api/v1/group-join-requests/" + encodeURIComponent(requestId) + "/reject", {}).then(function () {
                    setResult(groupResult, "已拒绝", "该申请已拒绝。", false);
                    return refreshJoinState();
                }).catch(function (err) {
                    setResult(groupResult, "处理失败", err && err.message || "请稍后重试。", true);
                });
            });
        }
        if (qs("#studentCopyInviteBtn")) {
            qs("#studentCopyInviteBtn").addEventListener("click", function () {
                if (!inviteCode || !inviteCode.textContent || inviteCode.textContent === "--") return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(inviteCode.textContent);
                }
                setResult(groupResult, "已复制", "邀请口令已复制到剪贴板。", false);
            });
        }
        if (qs("#studentWorkbenchCopyInviteBtn")) {
            qs("#studentWorkbenchCopyInviteBtn").addEventListener("click", function () {
                if (!workbenchInviteCode || !workbenchInviteCode.textContent || workbenchInviteCode.textContent === "--") return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(workbenchInviteCode.textContent);
                }
                setResult(qs("#studentLeaderTaskResult"), "已复制", "邀请口令已复制到剪贴板。", false);
            });
        }
        var leaderCreateBtn = qs("#studentLeaderCreateTaskBtn");
        if (leaderCreateBtn) {
            leaderCreateBtn.addEventListener("click", function () {
                if (!state.currentGroup) return setResult(qs("#studentLeaderTaskResult"), "无法创建", "请先加入或创建小组。", true);
                if (state.currentGroup.myRole !== "leader") return setResult(qs("#studentLeaderTaskResult"), "权限不足", "只有组长可以创建 MiniTask。", true);
                var title = qs("#studentLeaderTaskTitle") && qs("#studentLeaderTaskTitle").value.trim();
                var assignee = qs("#studentLeaderTaskAssignee") && qs("#studentLeaderTaskAssignee").value.trim();
                if (!title || !assignee) return setResult(qs("#studentLeaderTaskResult"), "信息不完整", "请填写任务标题和负责人学号。", true);
                var payload = {
                    title: title,
                    assigneeIds: [assignee],
                    priority: qs("#studentLeaderTaskPriority") && qs("#studentLeaderTaskPriority").value || "medium",
                    dueAt: qs("#studentLeaderTaskDue") && qs("#studentLeaderTaskDue").value ? new Date(qs("#studentLeaderTaskDue").value).toISOString() : null,
                };
                var leaderStage = qs("#studentLeaderTaskStage");
                if (leaderStage && leaderStage.value) payload.stageId = leaderStage.value;
                if (state.mockEnabled) {
                    var assignment = currentMockAssignment();
                    if (!assignment) return;
                    assignment.tasks = assignment.tasks || [];
                    assignment.tasks.unshift({
                        id: "t-mock-" + Date.now(),
                        title: title,
                        description: "",
                        status: "todo",
                        assigneeIds: [assignee],
                        updatedAt: new Date().toISOString(),
                        dueAt: payload.dueAt,
                        priority: payload.priority,
                        stageId: payload.stageId || null,
                    });
                    state.selectedTaskId = assignment.tasks[0].id;
                    setResult(qs("#studentLeaderTaskResult"), "创建成功", "新任务已加入工作台。", false);
                    ["#studentLeaderTaskTitle", "#studentLeaderTaskAssignee", "#studentLeaderTaskDue"].forEach(function (selector) {
                        var node = qs(selector);
                        if (node) node.value = "";
                    });
                    if (leaderStage) leaderStage.value = "";
                    refreshActivityState();
                    return;
                }
                api().postJson("/api/v1/groups/" + encodeURIComponent(state.currentGroup.id) + "/minitasks", payload).then(function () {
                    setResult(qs("#studentLeaderTaskResult"), "创建成功", "任务已创建。", false);
                    return refreshActivityState();
                }).catch(function (err) {
                    setResult(qs("#studentLeaderTaskResult"), "创建失败", err && err.message || "请稍后重试。", true);
                });
            });
        }
        if (qs("#studentTaskSearch")) qs("#studentTaskSearch").addEventListener("input", renderWorkbenchTaskList);
        if (qs("#studentTaskStatusFilter")) qs("#studentTaskStatusFilter").addEventListener("change", renderWorkbenchTaskList);
        if (qs("#studentTaskMineOnly")) qs("#studentTaskMineOnly").addEventListener("change", renderWorkbenchTaskList);
        if (qs("#extTaskStageId")) qs("#extTaskStageId").addEventListener("change", function () {
            renderWorkbenchTaskList();
            renderSelectedTask();
        });
        if (qs("#extTaskList")) {
            qs("#extTaskList").addEventListener("click", function (event) {
                var taskButton = event.target.closest("[data-student-task-id]");
                if (!taskButton) return;
                state.selectedTaskId = taskButton.getAttribute("data-student-task-id") || "";
                renderSelectedTask();
            });
        }
    }

    applyViewTabs();
    bindStageWheel();
    bindJoinActions();
    ensureMockContext();
    if (taskCourse) taskCourse.addEventListener("change", function () { window.setTimeout(refreshJoinState, 280); });
    if (taskAssignment) taskAssignment.addEventListener("change", function () { window.setTimeout(refreshJoinState, 280); });
    window.addEventListener("load", function () { window.setTimeout(refreshJoinState, 800); });
})();
