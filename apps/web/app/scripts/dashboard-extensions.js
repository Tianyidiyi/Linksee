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
        addNavItem("panel-group-join", "组队申请");
        addPanel("panel-group-join", card("组队申请", "创建小组、申请入组，并处理组长视角下的入组申请。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            field("课程", '<select id="extStudentGroupCourse" class="dashboard-select"></select>'),
            field("项目", '<select id="extStudentGroupAssignment" class="dashboard-select"></select>'),
            '<button id="extStudentGroupReload" class="btn btn-secondary academic-btn-block" type="button">刷新组队信息</button>',
            '<div id="extStudentGroupList" class="list dashboard-scroll-region"></div>',
            '</div>',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">组队操作</h3>',
            field("新小组名称", '<input id="extStudentNewGroupName" class="dashboard-input" />'),
            field("目标小组 ID", '<input id="extStudentTargetGroup" class="dashboard-input" />'),
            field("申请/转让 ID", '<input id="extStudentRequestId" class="dashboard-input" />'),
            field("目标成员 ID", '<input id="extStudentTransferTarget" class="dashboard-input" maxlength="10" />'),
            '<div class="dashboard-panel-actions">',
            '<button id="extStudentCreateGroup" class="btn btn-primary academic-btn-block" type="button">创建小组</button>',
            '<button id="extStudentJoinGroup" class="btn btn-secondary academic-btn-block" type="button">申请入组</button>',
            '<button id="extStudentApproveJoin" class="btn btn-secondary academic-btn-block" type="button">同意申请</button>',
            '<button id="extStudentRejectJoin" class="btn btn-secondary academic-btn-block" type="button">拒绝申请</button>',
            '<button id="extStudentTransferLeader" class="btn btn-secondary academic-btn-block" type="button">发起组长转让</button>',
            '</div>',
            '</div>',
            '</div>',
            '<div id="extStudentGroupResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        addNavItem("panel-minitask-manage", "小组任务");
        addPanel("panel-minitask-manage", card("小组任务", "按小组维护 MiniTask，支持创建、更新和状态流转。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            field("课程", '<select id="extTaskCourse" class="dashboard-select"></select>'),
            field("项目", '<select id="extTaskAssignment" class="dashboard-select"></select>'),
            field("我的小组", '<input id="extTaskGroupId" class="dashboard-input" readonly />'),
            '<button id="extTaskReload" class="btn btn-secondary academic-btn-block" type="button">刷新任务</button>',
            '<div id="extTaskGroupSummary" class="list dashboard-list-tight"></div>',
            '<div id="extTaskList" class="list dashboard-scroll-region"></div>',
            '</div>',
            '<div class="dashboard-subcard">',
            field("任务 ID", '<input id="extTaskId" class="dashboard-input" placeholder="更新时填写" />'),
            field("标题", '<input id="extTaskTitle" class="dashboard-input" />'),
            field("负责人 ID", '<input id="extTaskAssignee" class="dashboard-input" maxlength="10" />'),
            field("截止时间", '<input id="extTaskDue" class="dashboard-input" type="datetime-local" />'),
            field("优先级", '<select id="extTaskPriority" class="dashboard-select"><option value="medium">medium</option><option value="low">low</option><option value="high">high</option></select>'),
            field("状态", '<select id="extTaskStatus" class="dashboard-select"><option value="todo">todo</option><option value="in_progress">in_progress</option><option value="done">done</option></select>'),
            field("说明", '<textarea id="extTaskDesc" class="dashboard-textarea"></textarea>'),
            '<div class="dashboard-panel-actions">',
            '<button id="extTaskCreate" class="btn btn-primary academic-btn-block" type="button">创建任务</button>',
            '<button id="extTaskPatch" class="btn btn-secondary academic-btn-block" type="button">保存任务</button>',
            '<button id="extTaskStatusSave" class="btn btn-secondary academic-btn-block" type="button">更新状态</button>',
            '</div>',
            '</div>',
            '</div>',
            '<div id="extTaskResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        addNavItem("panel-file-submit", "成果提交");
        addPanel("panel-file-submit", card("成果提交", "带文件、链接和贡献说明的完整提交入口。", [
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            field("课程", '<select id="extSubmitCourse" class="dashboard-select"></select>'),
            field("项目", '<select id="extSubmitAssignment" class="dashboard-select"></select>'),
            field("阶段", '<select id="extSubmitStage" class="dashboard-select"></select>'),
            field("小组 ID", '<input id="extSubmitGroup" class="dashboard-input" readonly />'),
            '</div>',
            '<div class="dashboard-subcard">',
            field("标题", '<input id="extSubmitTitle" class="dashboard-input" />'),
            field("仓库链接", '<input id="extSubmitRepo" class="dashboard-input" placeholder="https://..." />'),
            field("其他链接", '<textarea id="extSubmitLinks" class="dashboard-textarea" placeholder="每行一个链接"></textarea>'),
            field("说明", '<textarea id="extSubmitDesc" class="dashboard-textarea"></textarea>'),
            field("贡献说明", '<textarea id="extSubmitContribution" class="dashboard-textarea"></textarea>'),
            field("文件", '<input id="extSubmitFiles" class="dashboard-input" type="file" multiple />'),
            '<button id="extSubmitSend" class="btn btn-primary academic-btn-block" type="button">提交成果</button>',
            '</div>',
            '</div>',
            '<div id="extSubmitResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        mergePanelInto("panel-minitask-manage", "panel-group-join", "组队申请", {
            titleInsideFirstSubcard: true,
        });
        bindStudentTools();
    }

    function bindStudentTools() {
        var groupCourse = qs("#extStudentGroupCourse");
        var groupAssignment = qs("#extStudentGroupAssignment");
        var groupResult = qs("#extStudentGroupResult");
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
                qs("#extStudentGroupList").innerHTML = [
                    mine ? '<div class="list-item dashboard-list-item-vertical"><strong>我的小组：' + escapeHtml(mine.name || ("第 " + mine.groupNo + " 组")) + '</strong><div class="muted">ID: ' + escapeHtml(mine.id) + ' · 我的角色：' + escapeHtml(mine.myRole || "--") + '</div></div>' : '<div class="dashboard-empty-state"><strong>尚未入组</strong><p>可以创建小组或申请加入。</p></div>',
                    rows.map(function (g) {
                        return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + escapeHtml(g.name || ("第 " + g.groupNo + " 组")) + '</strong><span class="badge badge-active">' + escapeHtml(g.status) + '</span></div><div class="muted">ID: ' + escapeHtml(g.id) + ' · 成员：' + escapeHtml(g._count && g._count.members || 0) + '</div></div>';
                    }).join(""),
                ].join("");
            });
        }
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
            return {
                title: qs("#extTaskTitle").value.trim(),
                description: qs("#extTaskDesc").value.trim() || null,
                assigneeIds: qs("#extTaskAssignee").value.trim() ? [qs("#extTaskAssignee").value.trim()] : [],
                dueAt: qs("#extTaskDue").value ? new Date(qs("#extTaskDue").value).toISOString() : null,
                priority: qs("#extTaskPriority").value,
                status: qs("#extTaskStatus").value,
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
