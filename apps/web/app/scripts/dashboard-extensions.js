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

    function getStoredUserId() {
        return localStorage.getItem("auth_user_id") || localStorage.getItem("user_id") || "";
    }

    function optionRows(rows, labeler) {
        return rows.map(function (row) {
            return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(labeler(row)) + '</option>';
        }).join("");
    }

    function ensureSelectValue(select, rows, includeEmpty) {
        if (!select) return;
        var current = String(select.value || "");
        var ids = rows.map(function (row) { return String(row.id); });
        if (current && ids.indexOf(current) >= 0) return;
        if (rows[0]) {
            select.value = String(rows[0].id);
            return;
        }
        if (includeEmpty) {
            select.value = "";
        }
    }

    function normalizeRows(payload) {
        return Array.isArray(payload && payload.data) ? payload.data : [];
    }

    function studentDashboardState() {
        return window.linkseeStudentDashboardState && typeof window.linkseeStudentDashboardState === "object"
            ? window.linkseeStudentDashboardState
            : null;
    }

    function dashboardAssignmentRows(courseId) {
        var state = studentDashboardState();
        var rows = state && Array.isArray(state.todoRows) ? state.todoRows : [];
        var map = new Map();
        rows.forEach(function (row) {
            if (!row || !row.course || !row.assignment) return;
            if (courseId && String(row.course.id) !== String(courseId)) return;
            if (!map.has(String(row.assignment.id))) {
                map.set(String(row.assignment.id), row.assignment);
            }
        });
        return Array.from(map.values());
    }

    function dashboardStageRows(assignmentId) {
        var state = studentDashboardState();
        var rows = state && Array.isArray(state.todoRows) ? state.todoRows : [];
        return rows
            .filter(function (row) {
                return row && row.assignment && row.stage && (!assignmentId || String(row.assignment.id) === String(assignmentId));
            })
            .map(function (row) { return row.stage; });
    }

    function preferredDashboardCourseId() {
        var state = studentDashboardState();
        var rows = state && Array.isArray(state.todoRows) ? state.todoRows : [];
        var first = rows.find(function (row) { return row && row.course && row.assignment; }) || null;
        return first && first.course ? String(first.course.id) : "";
    }

    function requestDelete(path, body) {
        return api().request(path, {
            method: "DELETE",
            headers: api().authHeaders(body ? { "Content-Type": "application/json" } : {}),
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    function ensureToastHost() {
        var host = document.getElementById("linkseeToastHost");
        if (host) return host;
        host = document.createElement("div");
        host.id = "linkseeToastHost";
        host.className = "linksee-toast-host";
        document.body.appendChild(host);
        return host;
    }

    function showToast(title, message, isError) {
        var host = ensureToastHost();
        var toast = document.createElement("div");
        var timerId = 0;
        toast.className = "linksee-toast" + (isError ? " is-error" : " is-success");
        toast.innerHTML = '<strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(message || "") + '</p>';
        host.appendChild(toast);

        window.requestAnimationFrame(function () {
            toast.classList.add("is-visible");
        });

        function dismissToast() {
            if (timerId) {
                window.clearTimeout(timerId);
                timerId = 0;
            }
            toast.classList.remove("is-visible");
            toast.classList.add("is-leaving");
            window.setTimeout(function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 260);
        }

        timerId = window.setTimeout(dismissToast, 3200);
        toast.addEventListener("click", dismissToast);
        return toast;
    }

    window.linkseeDashboardToast = showToast;

    function setResult(node, title, message, isError) {
        if (document.body.classList.contains("academic-shell")) {
            if (node) {
                node.hidden = true;
                node.innerHTML = "";
                node.classList.remove("is-error");
            }
            showToast(title, message, isError);
            return;
        }
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

    function addNavItem(targetId, label, iconSvg) {
        var nav = qs(".side-nav");
        if (!nav || qs('[data-target="' + targetId + '"]', nav)) return;
        var button = document.createElement("button");
        button.className = "nav-item";
        button.type = "button";
        button.setAttribute("data-target", targetId);
        button.title = label;
        button.innerHTML = [
            iconSvg ? '<span class="nav-item-icon" aria-hidden="true">' + iconSvg + '</span>' : "",
            '<span class="nav-item-label">' + escapeHtml(label) + '</span>',
        ].join("");
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
            '<select id="extCourseYear" class="dashboard-select"><option value="2025">2025 学年</option><option value="2026" selected>2026 学年</option><option value="2027">2027 学年</option><option value="2028">2028 学年</option></select>',
            '<select id="extCourseSemester" class="dashboard-select"><option value="1" selected>第 1 学期</option><option value="2">第 2 学期</option><option value="3">夏学期</option></select>',
            '<button id="extCourseCreateBtn" class="btn btn-primary" type="button">创建课程</button>',
            '</div>',
            '<textarea id="extCourseDescription" class="dashboard-textarea academic-create-description" placeholder="课程简介"></textarea>',
            '<div id="extCourseCreateResult" class="dashboard-empty-state" hidden></div>',
        ].join("")));

        addNavItem("panel-user-maintenance", "用户管理", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.6-3 8.8-7 10-4-1.2-7-5.4-7-10V6l7-3z"></path><path d="M9 11.5c.2-1.8 1.3-3 3-3s2.8 1.2 3 3"></path><circle cx="12" cy="8.25" r="1.25"></circle></svg>');
        addPanel("panel-user-maintenance", card("用户管理", "单个学生/教师开户与资料维护，对应 /api/v1/users。", [
            '<div class="academic-user-shell">',
            '<div class="dashboard-inline-grid academic-user-primary-grid">',
            '<div class="dashboard-subcard academic-user-subcard academic-user-create">',
            '<h3 class="dashboard-subcard-title">创建账号</h3>',
            field("用户 ID", '<input id="extUserId" class="dashboard-input" maxlength="10" />'),
            field("角色", '<select id="extUserRole" class="dashboard-select"><option value="student">学生</option><option value="teacher">教师</option></select>'),
            field("姓名", '<input id="extUserName" class="dashboard-input" />'),
            field("默认密码", '<input id="extUserPassword" class="dashboard-input" placeholder="留空自动生成" />'),
            field("学生字段", '<textarea id="extStudentFields" class="dashboard-textarea" placeholder="stuNo,grade,cohort,major,adminClass"></textarea>'),
            field("教师字段", '<textarea id="extTeacherFields" class="dashboard-textarea" placeholder="teacherNo,title,college,researchDirection"></textarea>'),
            '<button id="extUserCreateBtn" class="btn btn-primary academic-btn-block" type="button">创建账号</button>',
            '</div>',
            '<div class="dashboard-subcard academic-user-subcard academic-user-edit">',
            '<h3 class="dashboard-subcard-title">更新账号</h3>',
            field("目标用户 ID", '<input id="extEditUserId" class="dashboard-input" maxlength="10" />'),
            field("姓名", '<input id="extEditRealName" class="dashboard-input" />'),
            field("邮箱", '<input id="extEditEmail" class="dashboard-input" />'),
            field("启用状态", '<select id="extEditActive" class="dashboard-select"><option value="">不修改</option><option value="true">启用</option><option value="false">停用</option></select>'),
            '<button id="extUserPatchBtn" class="btn btn-secondary academic-btn-block" type="button">保存更新</button>',
            '</div>',
            '</div>',
            '<div id="extUserResult" class="dashboard-empty-state" hidden></div>',
            '</div>',
        ].join("")));

        mergePanelInto("panel-courses", "panel-course-create", "", {
            beforeSelector: ".academic-course-manage-section",
            className: "academic-course-create-section",
        });
        mergePanelInto("panel-user-maintenance", "panel-account-batch", "批量账号开通", {
            className: "academic-user-batch-section",
        });
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
                window.dispatchEvent(new CustomEvent("linksee:academic-refresh-request", {
                    detail: {
                        reason: "course-created",
                        courseId: payload.data && payload.data.id ? String(payload.data.id) : "",
                    },
                }));
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

    }

    function loadCourseOptions(select, next) {
        function applyRows(rows) {
            select.innerHTML = optionRows(rows, function (course) {
                return (course.name || course.courseNo || course.id) + " · " + (course.status || "--");
            });
            ensureSelectValue(select, rows, false);
            var preferredId = preferredDashboardCourseId();
            if (preferredId && Array.from(select.options || []).some(function (option) { return String(option.value) === preferredId; })) {
                select.value = preferredId;
            }
            if (next) return next(rows);
            return rows;
        }
        return api().getJson("/api/v1/courses").then(function (payload) {
            var rows = normalizeRows(payload);
            if (!rows.length) {
                var state = studentDashboardState();
                rows = state && Array.isArray(state.courses) ? state.courses : [];
            }
            return applyRows(rows);
        }).catch(function (err) {
            var state = studentDashboardState();
            var rows = state && Array.isArray(state.courses) ? state.courses : [];
            if (rows.length) {
                return applyRows(rows);
            }
            throw err;
        });
    }

    function loadAssignmentOptions(courseId, select, includeEmpty) {
        if (!courseId) {
            select.innerHTML = includeEmpty ? '<option value="">请选择课程</option>' : "";
            return Promise.resolve([]);
        }
        function applyRows(rows) {
            select.innerHTML = (includeEmpty ? '<option value="">请选择项目</option>' : "") + optionRows(rows, function (assignment) {
                return (assignment.title || assignment.id) + " · " + (assignment.status || "--");
            });
            ensureSelectValue(select, rows, includeEmpty);
            return rows;
        }
        return api().getJson("/api/v1/courses/" + encodeURIComponent(courseId) + "/assignments").then(function (payload) {
            var rows = normalizeRows(payload);
            if (!rows.length) {
                rows = dashboardAssignmentRows(courseId);
            }
            return applyRows(rows);
        }).catch(function (err) {
            var rows = dashboardAssignmentRows(courseId);
            if (rows.length) {
                return applyRows(rows);
            }
            throw err;
        });
    }

    function loadStageOptions(assignmentId, select, includeEmpty) {
        if (!assignmentId) {
            select.innerHTML = includeEmpty ? '<option value="">请选择项目</option>' : "";
            return Promise.resolve([]);
        }
        function applyRows(rows) {
            select.innerHTML = (includeEmpty ? '<option value="">请选择阶段</option>' : "") + rows.map(function (stage) {
                var label = (stage.title || ("阶段 " + stage.stageNo)) + " · " + (stage.status || "--");
                return '<option value="' + escapeHtml(stage.id) + '" data-stage-no="' + escapeHtml(stage.stageNo) + '" data-stage-title="' + escapeHtml(stage.title || ("阶段 " + stage.stageNo)) + '">' + escapeHtml(label) + '</option>';
            }).join("");
            ensureSelectValue(select, rows, includeEmpty);
            return rows;
        }
        return api().getJson("/api/v1/assignments/" + encodeURIComponent(assignmentId) + "/stages").then(function (payload) {
            var rows = normalizeRows(payload);
            if (!rows.length) {
                rows = dashboardStageRows(assignmentId);
            }
            return applyRows(rows);
        }).catch(function (err) {
            var rows = dashboardStageRows(assignmentId);
            if (rows.length) {
                return applyRows(rows);
            }
            throw err;
        });
    }

    function bindTeacherPanels() {
        addNavItem("panel-course-design", "项目与阶段");
        addPanel("panel-course-design", card("项目与阶段", "教师侧统一维护项目、阶段与过程材料；助教继续聚焦批阅与协同。", [
            '<div class="dashboard-window-stack">',
            '<div class="dashboard-merged-section teacher-course-design-section">',
            '<h3 class="dashboard-subcard-title">项目管理</h3>',
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
            '</div>',
            '<div class="dashboard-merged-section teacher-course-design-section">',
            '<h3 class="dashboard-subcard-title">阶段管理</h3>',
            '<div class="dashboard-inline-grid dashboard-split-scroll-grid">',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">阶段列表</h3>',
            field("课程", '<select id="extStageCourse" class="dashboard-select"></select>'),
            field("项目", '<select id="extStageAssignment" class="dashboard-select"></select>'),
            field("阶段", '<select id="extStageSelect" class="dashboard-select"><option value="">新建阶段</option></select>'),
            '<div id="extStageList" class="list dashboard-scroll-region"></div>',
            '</div>',
            '<div class="dashboard-subcard">',
            '<h3 class="dashboard-subcard-title">阶段设置</h3>',
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
            '</div>',
            '</div>',
        ].join("")));

        addNavItem("panel-group-manage", "分组管理");
        addPanel("panel-group-manage", card("分组管理", "教师统一处理项目分组、成员调整与兜底编排。", [
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

        addNavItem("panel-teacher-settings", "教师设置");
        addPanel("panel-teacher-settings", card("教师设置", "当前集中管理助教账号与课程绑定，后续可继续扩展教师侧配置。", [
            '<div class="dashboard-window-stack">',
            '<div class="dashboard-merged-section teacher-settings-section">',
            '<h3 class="dashboard-subcard-title">助教管理</h3>',
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
            '</div>',
            '</div>',
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
        function taskCreateBody() {
            var leaderAssignee = qs("#studentLeaderTaskAssignee");
            var leaderStage = qs("#studentLeaderTaskStage");
            return {
                title: qs("#studentLeaderTaskTitle") && qs("#studentLeaderTaskTitle").value.trim(),
                description: qs("#studentLeaderTaskDesc") && qs("#studentLeaderTaskDesc").value.trim() || null,
                assigneeIds: leaderAssignee && leaderAssignee.value.trim() ? [leaderAssignee.value.trim()] : [],
                dueAt: qs("#studentLeaderTaskDue") && qs("#studentLeaderTaskDue").value ? new Date(qs("#studentLeaderTaskDue").value).toISOString() : null,
                priority: qs("#studentLeaderTaskPriority") && qs("#studentLeaderTaskPriority").value || "medium",
                stageId: leaderStage && leaderStage.value ? leaderStage.value : undefined,
            };
        }

        function taskPatchBody() {
            return {
                title: qs("#extTaskTitle") && qs("#extTaskTitle").value.trim(),
                description: qs("#extTaskDesc") && qs("#extTaskDesc").value.trim() || null,
                dueAt: qs("#extTaskDue") && qs("#extTaskDue").value ? new Date(qs("#extTaskDue").value).toISOString() : null,
                priority: qs("#extTaskPriority") && qs("#extTaskPriority").value || "medium",
            };
        }

        function submitTaskPatch() {
            var taskIdNode = qs("#extTaskId");
            if (!taskIdNode || !taskIdNode.value.trim()) return Promise.resolve();
            if (state.mockEnabled) {
                var mockTask = (state.tasks || []).find(function (row) {
                    return String(row.id) === String(taskIdNode.value.trim());
                });
                if (!mockTask) return Promise.resolve();
                var nextMockTask = Object.assign({}, mockTask, taskPatchBody(), {
                    updatedAt: new Date().toISOString(),
                });
                upsertTaskRow(nextMockTask, { select: true });
                prependTaskActivity(nextMockTask, "edited", {
                    content: "任务要求已更新，请查看最新标题、说明、优先级或截止时间。",
                });
                setResult(taskResult, "已更新", "任务信息已保存。", false);
                return Promise.resolve();
            }
            return api().patchJson("/api/v1/minitasks/" + encodeURIComponent(taskIdNode.value.trim()), taskPatchBody()).then(function (payload) {
                var nextTask = payload && payload.data ? payload.data : null;
                upsertTaskRow(nextTask, { select: true });
                prependTaskActivity(nextTask, "edited", {
                    content: "任务要求已更新，请负责人留意最新要求。",
                });
                setResult(taskResult, "已更新", "任务信息已保存。", false);
            }).catch(function (err) {
                setResult(taskResult, "更新失败", err.message, true);
            });
        }

        function submitTaskStatus() {
            var taskIdNode = qs("#extTaskId");
            var statusNode = qs("#extTaskStatus");
            if (!taskIdNode || !statusNode || !taskIdNode.value.trim()) return Promise.resolve();
            var currentTask = (state.tasks || []).find(function (row) {
                return String(row.id) === String(taskIdNode.value.trim());
            }) || null;
            if (!currentTask) return Promise.resolve();
            if (!canCurrentUserUpdateTaskStatus(currentTask, statusNode.value)) {
                renderSelectedTask();
                setResult(taskResult, "状态更新失败", "当前账号无权把这条任务改成该状态。", true);
                return Promise.resolve();
            }
            if (state.mockEnabled) {
                var nextMockStatusTask = Object.assign({}, currentTask, {
                    status: statusNode.value,
                    updatedAt: new Date().toISOString(),
                });
                upsertTaskRow(nextMockStatusTask, { select: true });
                prependTaskActivity(nextMockStatusTask, "status_changed", {
                    status: statusNode.value,
                    content: "任务进度已更新为 " + taskStatusLabel(statusNode.value) + "。",
                });
                setResult(taskResult, "状态已更新", "任务状态已保存。", false);
                return Promise.resolve();
            }
            return api().patchJson("/api/v1/minitasks/" + encodeURIComponent(taskIdNode.value.trim()) + "/status", { status: statusNode.value }).then(function (payload) {
                var nextTask = payload && payload.data ? payload.data : null;
                upsertTaskRow(nextTask, { select: true });
                prependTaskActivity(nextTask, "status_changed", {
                    status: statusNode.value,
                    content: "任务进度已更新为 " + taskStatusLabel(statusNode.value) + "。",
                });
                setResult(taskResult, "状态已更新", "任务状态已保存。", false);
            }).catch(function (err) {
                renderSelectedTask();
                setResult(taskResult, "状态更新失败", err.message, true);
            });
        }

        var patchTaskBtn = qs("#extTaskPatch");
        if (patchTaskBtn) patchTaskBtn.onclick = function () {
            submitTaskPatch();
        };

        var submitCourse = qs("#extSubmitCourse");
        var submitAssignment = qs("#extSubmitAssignment");
        var submitStage = qs("#extSubmitStage");
        var submitResult = qs("#extSubmitResult");
        var submitCourseField = qs("#studentSubmitCourseField");
        var submitAssignmentField = qs("#studentSubmitAssignmentField");
        var submitStageField = qs("#studentSubmitStageField");
        var submitCourseOptions = qs("#studentSubmitCourseOptions");
        var submitAssignmentOptions = qs("#studentSubmitAssignmentOptions");
        var submitStageOptions = qs("#studentSubmitStageOptions");
        var submitCourseValue = qs("#studentSubmitCourseValue");
        var submitAssignmentValue = qs("#studentSubmitAssignmentValue");
        var submitStageValue = qs("#studentSubmitStageValue");
        var submitTreeOpen = { course: false, assignment: false, stage: false };
        var submitTreeCommitted = { course: false, assignment: false };
        function hydrateSubmitTreeData() {
            return loadCourseOptions(submitCourse, refreshSubmitAssignments).catch(function () {
                syncSubmitCascadeVisibility();
            });
        }
        function submitSelectedLabel(select, fallback) {
            if (!select || !select.options || !select.options.length) return fallback;
            var option = select.options[select.selectedIndex];
            return option && option.textContent ? String(option.textContent).trim() : fallback;
        }
        function applySubmitTreeOpenState() {
            [
                ["course", submitCourseField, submitCourseOptions],
                ["assignment", submitAssignmentField, submitAssignmentOptions],
                ["stage", submitStageField, submitStageOptions],
            ].forEach(function (entry) {
                var name = entry[0];
                var field = entry[1];
                var options = entry[2];
                var toggle = field && qs("[data-submit-tree-toggle]", field);
                var isOpen = Boolean(submitTreeOpen[name]);
                if (field) field.classList.toggle("is-open", Boolean(isOpen));
                if (options) options.hidden = !isOpen;
                if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
            });
        }
        function closeSubmitTreeSections() {
            submitTreeOpen.course = false;
            submitTreeOpen.assignment = false;
            submitTreeOpen.stage = false;
            applySubmitTreeOpenState();
        }
        function renderSubmitTreeOptions(select, container, emptyText) {
            if (!container) return;
            var options = Array.from(select && select.options || []).filter(function (option) {
                return option.value !== "";
            });
            if (!options.length) {
                container.innerHTML = '<div class="student-submit-tree-empty">' + escapeHtml(emptyText) + '</div>';
                return;
            }
            container.innerHTML = options.map(function (option) {
                var isActive = String(option.value) === String(select.value);
                return '<button class="student-submit-tree-option' + (isActive ? ' is-active' : '') + '" type="button" data-submit-tree-value="' + escapeHtml(option.value) + '">' + escapeHtml(option.textContent || "") + '</button>';
            }).join("");
        }
        function syncSubmitTreeUi() {
            var hasCourse = Boolean(submitCourse && submitCourse.value);
            var hasAssignment = Boolean(submitAssignment && submitAssignment.value);
            if (submitCourseValue) submitCourseValue.textContent = submitSelectedLabel(submitCourse, "展开查看全部课程");
            if (submitAssignmentValue) submitAssignmentValue.textContent = hasCourse ? submitSelectedLabel(submitAssignment, "展开查看全部项目") : "请先选择课程";
            if (submitStageValue) submitStageValue.textContent = hasAssignment ? submitSelectedLabel(submitStage, "展开查看全部阶段") : "请先选择项目";
            renderSubmitTreeOptions(submitCourse, submitCourseOptions, "暂无课程");
            renderSubmitTreeOptions(submitAssignment, submitAssignmentOptions, hasCourse ? "当前课程下暂无项目" : "请先选择课程");
            renderSubmitTreeOptions(submitStage, submitStageOptions, hasAssignment ? "当前项目下暂无阶段" : "请先选择项目");
        }
        function syncSubmitCascadeVisibility() {
            var hasCourse = Boolean(submitCourse && submitCourse.value);
            var hasAssignment = Boolean(submitAssignment && submitAssignment.value);
            if (!hasCourse) {
                submitTreeCommitted.course = false;
                submitTreeCommitted.assignment = false;
                submitTreeOpen.assignment = false;
                submitTreeOpen.stage = false;
            }
            if (!hasAssignment) {
                submitTreeCommitted.assignment = false;
                submitTreeOpen.stage = false;
            }
            if (submitAssignmentField) submitAssignmentField.hidden = !hasCourse || !submitTreeCommitted.course;
            if (submitStageField) submitStageField.hidden = !hasAssignment || !submitTreeCommitted.assignment;
            applySubmitTreeOpenState();
            syncSubmitTreeUi();
        }
        function refreshSubmitAssignments() {
            syncSubmitCascadeVisibility();
            return loadAssignmentOptions(submitCourse.value, submitAssignment, false).then(function () {
                syncSubmitCascadeVisibility();
                return refreshSubmitStageAndGroup();
            });
        }
        function refreshSubmitStageAndGroup() {
            syncSubmitCascadeVisibility();
            if (!submitAssignment.value) return Promise.resolve();
            return Promise.all([
                loadStageOptions(submitAssignment.value, submitStage, false),
                api().getJson("/api/v1/assignments/" + encodeURIComponent(submitAssignment.value) + "/my-group").catch(function () { return { data: null }; }),
            ]).then(function (payloads) {
                var myGroup = payloads[1].data || null;
                qs("#extSubmitGroup").value = myGroup && myGroup.id || "";
                qs("#extSubmitGroup").dataset.myRole = myGroup && myGroup.myRole || "";
                syncSubmitCascadeVisibility();
            });
        }
        if (submitCourse) {
            hydrateSubmitTreeData();
            submitCourse.onchange = refreshSubmitAssignments;
            submitAssignment.onchange = refreshSubmitStageAndGroup;
            submitStage.onchange = syncSubmitCascadeVisibility;
            submitCourse.addEventListener("change", syncSubmitCascadeVisibility);
            submitAssignment.addEventListener("change", syncSubmitCascadeVisibility);
            qsa("[data-submit-tree-toggle]", submitCourseField && submitCourseField.parentNode || document).forEach(function (toggle) {
                toggle.addEventListener("click", function () {
                    var type = toggle.getAttribute("data-submit-tree-toggle") || "";
                    if (type === "course") {
                        submitTreeOpen.course = !submitTreeOpen.course;
                        if (!submitTreeOpen.course) {
                            submitTreeOpen.assignment = false;
                            submitTreeOpen.stage = false;
                        }
                    } else if (type === "assignment") {
                        if (!(submitCourse && submitCourse.value)) return;
                        submitTreeOpen.assignment = !submitTreeOpen.assignment;
                        if (!submitTreeOpen.assignment) {
                            submitTreeOpen.stage = false;
                        }
                    } else if (type === "stage") {
                        if (!(submitAssignment && submitAssignment.value)) return;
                        submitTreeOpen.stage = !submitTreeOpen.stage;
                    }
                    syncSubmitCascadeVisibility();
                });
            });
            [
                [submitCourseOptions, submitCourse, "course"],
                [submitAssignmentOptions, submitAssignment, "assignment"],
                [submitStageOptions, submitStage, "stage"],
            ].forEach(function (entry) {
                var container = entry[0];
                var select = entry[1];
                var type = entry[2];
                if (!container || !select) return;
                container.addEventListener("click", function (event) {
                    var option = event.target.closest("[data-submit-tree-value]");
                    if (!option) return;
                    var nextValue = option.getAttribute("data-submit-tree-value") || "";
                    if (!nextValue) return;
                    select.value = nextValue;
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                    if (type === "course") {
                        submitTreeCommitted.course = true;
                        submitTreeCommitted.assignment = false;
                        submitTreeOpen.course = false;
                        submitTreeOpen.assignment = false;
                        submitTreeOpen.stage = false;
                    } else if (type === "assignment") {
                        submitTreeCommitted.assignment = true;
                        submitTreeOpen.assignment = false;
                        submitTreeOpen.stage = false;
                    } else {
                        submitTreeOpen.stage = false;
                    }
                    syncSubmitCascadeVisibility();
                });
            });
            syncSubmitCascadeVisibility();
            window.addEventListener("linksee:student-dashboard-ready", function () {
                hydrateSubmitTreeData();
            });
            qsa('[data-target="panel-file-submit"]').forEach(function (button) {
                button.addEventListener("click", function () {
                    window.setTimeout(hydrateSubmitTreeData, 120);
                });
            });
            window.setTimeout(hydrateSubmitTreeData, 1200);
            window.setTimeout(hydrateSubmitTreeData, 2600);
        }
        qs("#extSubmitSend").onclick = function () {
            var groupInput = qs("#extSubmitGroup");
            var stageOption = submitStage && submitStage.options ? submitStage.options[submitStage.selectedIndex] : null;
            var fileNames = Array.from(qs("#extSubmitFiles").files || []).map(function (file) { return file.name; });
            var titleValue = qs("#extSubmitTitle").value.trim();
            var repoValue = qs("#extSubmitRepo").value.trim();
            var linkValues = splitCsv(qs("#extSubmitLinks").value);
            if (!groupInput.value) {
                return setResult(submitResult, "提交失败", "当前项目还没有可提交的小组。", true);
            }
            if ((groupInput.dataset.myRole || "") !== "leader") {
                return setResult(submitResult, "提交失败", "当前阶段提交仅允许组长发起。", true);
            }
            var form = new FormData();
            form.append("title", titleValue);
            if (qs("#extSubmitDesc").value.trim()) form.append("description", qs("#extSubmitDesc").value.trim());
            if (qs("#extSubmitContribution").value.trim()) form.append("contributionNote", qs("#extSubmitContribution").value.trim());
            if (repoValue) form.append("repositoryUrl", repoValue);
            linkValues.forEach(function (link) { form.append("links[]", link); });
            Array.from(qs("#extSubmitFiles").files || []).forEach(function (file) { form.append("files", file); });
            api().postForm("/api/v1/stages/" + encodeURIComponent(submitStage.value) + "/groups/" + encodeURIComponent(groupInput.value) + "/submissions", form).then(function (payload) {
                setResult(submitResult, "提交成功", "submissionId：" + ((payload.data && payload.data.id) || "--"), false);
                window.dispatchEvent(new CustomEvent("linksee:submission-created", {
                    detail: {
                        submissionId: payload.data && payload.data.id || "",
                        groupId: groupInput.value,
                        stageId: submitStage.value,
                        stageNo: stageOption ? Number(stageOption.dataset.stageNo || 0) : 0,
                        stageTitle: stageOption ? String(stageOption.dataset.stageTitle || stageOption.textContent || "").trim() : "",
                        submissionTitle: titleValue,
                        attemptNo: payload.data && payload.data.attemptNo || 0,
                        fileNames: fileNames,
                        linkCount: linkValues.length,
                        repositoryUrl: repoValue || "",
                        operatorId: getStoredUserId(),
                        createdAt: new Date().toISOString(),
                        content: "",
                    }
                }));
            }).catch(function (err) {
                setResult(submitResult, "提交失败", err.message, true);
            });
        };
    }

    function install(options) {
        var role = getRole();
        if (role === "academic") bindAcademicPanels();
        if (role === "teacher") bindTeacherPanels();
        if (role === "student") {
            bindStudentPanels();
            bindStudentTools();
        }
    }

    window.linkseeDashboardExtensions = { install: install };
})();

(function () {
    if (window.linkseeStudentTeamExtensionsLoaded) {
        return;
    }
    window.linkseeStudentTeamExtensionsLoaded = true;

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

    function taskAssigneeIds(task) {
        if (!task) return [];
        if (Array.isArray(task.assigneeIds) && task.assigneeIds.length) {
            return task.assigneeIds.map(function (value) { return String(value); });
        }
        if (task.assigneeId) return [String(task.assigneeId)];
        return [];
    }

    function canCurrentUserUpdateTaskStatus(task, nextStatus) {
        if (!task) return false;
        if (task.status === "cancelled" && nextStatus !== "cancelled") return false;
        var me = String(currentUserId());
        var isAssignee = taskAssigneeIds(task).includes(me);
        if (nextStatus === "cancelled") {
            return Boolean(state.currentGroup && state.currentGroup.myRole === "leader");
        }
        return isAssignee;
    }

    function commitTaskRows(rows, selectedTaskId) {
        state.tasks = Array.isArray(rows) ? rows.map(function (task) {
            return Object.assign({}, task, {
                assigneeIds: taskAssigneeIds(task),
            });
        }) : [];
        if (state.mockEnabled) {
            var assignment = currentMockAssignment();
            if (assignment) {
                assignment.tasks = state.tasks.map(function (task) {
                    return Object.assign({}, task, {
                        assigneeIds: taskAssigneeIds(task),
                    });
                });
            }
        }
        if (selectedTaskId !== undefined) {
            state.selectedTaskId = selectedTaskId;
        }
        renderStageProgress(state.stages || [], state.tasks);
        renderTaskSummary(state.tasks);
        renderActivityFeed();
        renderWorkbenchState();
    }

    function upsertTaskRow(nextTask, options) {
        if (!nextTask || !nextTask.id) return;
        var rows = Array.isArray(state.tasks) ? state.tasks.slice() : [];
        var normalized = Object.assign({}, nextTask, {
            assigneeIds: taskAssigneeIds(nextTask),
        });
        var index = rows.findIndex(function (task) {
            return String(task.id) === String(normalized.id);
        });
        if (index >= 0) {
            rows[index] = Object.assign({}, rows[index], normalized);
        } else if (options && options.prepend) {
            rows.unshift(normalized);
        } else {
            rows.push(normalized);
        }
        commitTaskRows(rows, options && options.select ? normalized.id : state.selectedTaskId);
    }

    function roleIconMarkup(role) {
        if (role === "leader") {
            return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.2 12.2 7.4l4.6.6-3.3 3.2.8 4.6-4.3-2.2-4.3 2.2.8-4.6L3.2 8l4.6-.6L10 3.2Z"></path></svg>';
        }
        return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="6.6" r="2.7"></circle><path d="M4.8 15.4c1.2-2.4 3.1-3.6 5.2-3.6s4 1.2 5.2 3.6"></path></svg>';
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

    function isStudentTeamPage() {
        return Boolean(qs("#studentTeamViewTabs")) && document.body.classList.contains("student-shell");
    }

    if (!isStudentTeamPage()) return;

    var state = {
        currentGroup: null,
        groupRows: [],
        search: "",
        tasks: [],
        taskActivities: [],
        stages: [],
        members: [],
        activityFilter: "all",
        mockEnabled: true,
        selectedTaskId: "",
        syncingTaskEditor: false,
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

    function currentUserAvatarUrl() {
        return localStorage.getItem("student_avatar_data_url")
            || localStorage.getItem("auth_avatar_url")
            || "";
    }

    function resolveMiniAvatarUrl(label, explicitAvatarUrl, userId) {
        if (explicitAvatarUrl) return String(explicitAvatarUrl);
        if (userId && String(userId) === String(currentUserId())) {
            return currentUserAvatarUrl();
        }
        var normalizedLabel = String(label || "").trim();
        if (normalizedLabel && normalizedLabel === currentUserName()) {
            return currentUserAvatarUrl();
        }
        return "";
    }

    function miniAvatar(label, tone, explicitAvatarUrl, userId) {
        var raw = String(label || "?").trim();
        var initial = raw ? raw.charAt(0).toUpperCase() : "?";
        var avatarUrl = resolveMiniAvatarUrl(label, explicitAvatarUrl, userId);
        var numericFallback = !avatarUrl && /^\d+$/.test(raw);
        return '<span class="student-mini-avatar' + (tone ? (' is-' + tone) : '') + '"' + (avatarUrl ? '' : ' aria-hidden="true"') + '>'
            + (avatarUrl
                ? '<img src="' + escapeHtml(avatarUrl) + '" alt="' + escapeHtml(raw || "头像") + '" />'
                : (numericFallback
                    ? '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="7" r="3"></circle><path d="M4.6 15.2c1.3-2.4 3.2-3.6 5.4-3.6s4.1 1.2 5.4 3.6"></path></svg>'
                    : escapeHtml(initial)))
            + '</span>';
    }

    function leaderAssignableMembers() {
        var members = Array.isArray(state.members) ? state.members.slice() : [];
        if (!members.length && state.currentGroup) {
            members.push({
                userId: currentUserId(),
                displayName: currentUserName(),
                avatarUrl: currentUserAvatarUrl(),
                role: state.currentGroup.myRole || "member",
            });
        }
        return members.map(function (member) {
            return {
                id: String(member.userId || member.id || ""),
                label: member.displayName || member.name || member.userId || member.id || "--",
                avatarUrl: member.avatarUrl || "",
                role: member.role || "member",
            };
        }).filter(function (member) { return member.id; });
    }

    function updateLeaderTaskAssigneeButton() {
        var button = qs("#studentLeaderTaskAssigneeButton");
        var input = qs("#studentLeaderTaskAssignee");
        if (!button || !input) return;
        var selectedId = String(input.value || "");
        var rows = leaderAssignableMembers();
        var member = rows.find(function (row) { return row.id === selectedId; }) || null;
        button.innerHTML = member
            ? '<span class="student-assignee-picker-inner">' + miniAvatar(member.label, member.role === "leader" ? "amber" : "teal", member.avatarUrl, member.id) + '<span>' + escapeHtml(member.label) + '</span></span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5"></path></svg>'
            : '<span>选择成员</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5"></path></svg>';
    }

    function renderLeaderAssigneeMenu() {
        var menu = qs("#studentLeaderTaskAssigneeMenu");
        if (!menu) return;
        var rows = leaderAssignableMembers();
        if (!rows.length) {
            menu.innerHTML = '<div class="student-assignee-empty">暂无可选成员</div>';
            updateLeaderTaskAssigneeButton();
            return;
        }
        menu.innerHTML = rows.map(function (member) {
            return '<button class="student-assignee-option" type="button" data-leader-assignee="' + escapeHtml(member.id) + '">' +
                miniAvatar(member.label, member.role === "leader" ? "amber" : "teal", member.avatarUrl, member.id) +
                '<span class="student-assignee-option-copy"><strong>' + escapeHtml(member.label) + '</strong><small>' + escapeHtml(roleLabel(member.role)) + '</small></span></button>';
        }).join("");
        updateLeaderTaskAssigneeButton();
    }

    function setLeaderTaskPriority(priority) {
        var value = priority || "medium";
        var input = qs("#studentLeaderTaskPriority");
        if (input) input.value = value;
        qsa("#studentLeaderTaskPriorityGroup .student-priority-choice").forEach(function (button) {
            button.classList.toggle("is-active", button.getAttribute("data-priority-value") === value);
        });
    }

    function openLeaderTaskCreateModal() {
        var modal = qs("#studentTaskCreateModal");
        if (!modal) return;
        renderLeaderAssigneeMenu();
        updateLeaderTaskAssigneeButton();
        modal.hidden = false;
        document.body.classList.add("student-modal-open");
        var titleInput = qs("#studentLeaderTaskTitle");
        if (titleInput) window.setTimeout(function () { titleInput.focus(); }, 40);
    }

    function closeLeaderTaskCreateModal() {
        var modal = qs("#studentTaskCreateModal");
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove("student-modal-open");
        var assigneeMenu = qs("#studentLeaderTaskAssigneeMenu");
        var assigneeButton = qs("#studentLeaderTaskAssigneeButton");
        if (assigneeMenu) assigneeMenu.hidden = true;
        if (assigneeButton) assigneeButton.setAttribute("aria-expanded", "false");
    }

    function refreshTeamCustomSelect(select) {
        if (!select || select.dataset.teamSelectEnhanced !== "1") return;
        var box = select.nextElementSibling;
        if (!box || !box.classList.contains("student-team-selectbox")) return;
        var textNode = qs(".student-team-select-text", box);
        var menu = qs(".student-team-select-menu", box);
        var selectedOption = select.options[select.selectedIndex] || select.options[0] || null;
        if (textNode) textNode.textContent = selectedOption ? selectedOption.textContent : "请选择";
        if (menu) {
            menu.innerHTML = Array.from(select.options).map(function (option) {
                var active = String(option.value) === String(select.value);
                return '<button class="student-team-select-option' + (active ? ' is-active' : '') + '" type="button" data-team-select-value="' + escapeHtml(option.value) + '">' + escapeHtml(option.textContent) + '</button>';
            }).join("");
        }
    }

    function closeTeamCustomSelects() {
        qsa(".student-team-selectbox.is-open").forEach(function (box) {
            box.classList.remove("is-open");
            var button = qs(".student-team-select-button", box);
            var menu = qs(".student-team-select-menu", box);
            if (button) button.setAttribute("aria-expanded", "false");
            if (menu) menu.hidden = true;
        });
    }

    function ensureTeamCustomSelect(select) {
        if (!select || select.dataset.teamSelectEnhanced === "1") return;
        select.dataset.teamSelectEnhanced = "1";
        select.classList.add("student-team-native-select");
        var box = document.createElement("div");
        box.className = "student-team-selectbox";
        box.innerHTML = '<button class="student-team-select-button" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="student-team-select-text">请选择</span><span class="student-team-select-chevron" aria-hidden="true">⌃</span></button><div class="student-team-select-menu" role="listbox" hidden></div>';
        select.insertAdjacentElement("afterend", box);
        var button = qs(".student-team-select-button", box);
        var menu = qs(".student-team-select-menu", box);
        button.addEventListener("click", function (event) {
            event.preventDefault();
            var willOpen = !box.classList.contains("is-open");
            closeTeamCustomSelects();
            if (!willOpen) return;
            refreshTeamCustomSelect(select);
            box.classList.add("is-open");
            button.setAttribute("aria-expanded", "true");
            menu.hidden = false;
        });
        menu.addEventListener("click", function (event) {
            var option = event.target.closest("[data-team-select-value]");
            if (!option) return;
            select.value = option.getAttribute("data-team-select-value") || "";
            select.dispatchEvent(new Event("change", { bubbles: true }));
            refreshTeamCustomSelect(select);
            closeTeamCustomSelects();
        });
        select.addEventListener("change", function () {
            refreshTeamCustomSelect(select);
        });
        var observer = new MutationObserver(function () {
            refreshTeamCustomSelect(select);
        });
        observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "selected"] });
        refreshTeamCustomSelect(select);
    }

    function enhanceTeamCustomSelects() {
        ["#extTaskCourse", "#extTaskAssignment", "#extTaskStageId", "#studentTaskStatusFilter", "#extTaskStatus", "#studentLeaderTaskStage"].forEach(function (selector) {
            ensureTeamCustomSelect(qs(selector));
        });
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
        var roleIcon = qs("#studentTeamRoleIcon");
        if (roleIcon) roleIcon.innerHTML = roleIconMarkup(group ? group.myRole || "member" : "member");
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
        var leader = Boolean(mine && mine.myRole === "leader");
        text("#studentJoinRequestMeta", "待处理申请 " + pending);
        if (pendingJoinBadge) pendingJoinBadge.textContent = String(pending);
        requestList.innerHTML = rows.length ? rows.map(function (row) {
            var actions = leader && row.status === "pending"
                ? '<div class="student-request-actions"><button class="btn btn-secondary student-leader-mini-btn" type="button" data-request-approve="' + escapeHtml(row.id || "") + '">同意</button><button class="btn btn-secondary student-leader-mini-btn" type="button" data-request-reject="' + escapeHtml(row.id || "") + '">拒绝</button></div>'
                : "";
            var note = row.alreadyJoined ? '<em class="student-request-note">该同学已加入其他小组</em>' : "";
            return '<article class="student-request-card">' + miniAvatar(row.applicantUserId || "--", row.status === "pending" ? "rose" : "teal", "", row.applicantUserId) + '<div class="student-request-copy"><strong>' + escapeHtml(row.applicantUserId || "--") + '</strong><p>' + escapeHtml(row.reason || "申请加入小组") + '</p>' + note + '<div class="student-request-foot"><small>申请编号 ' + escapeHtml(row.id || "--") + '</small>' + actions + '</div></div><div class="student-request-meta"><span>' + escapeHtml(requestStatusLabel(row.status)) + '</span></div></article>';
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

    function formatRelativeTime(value) {
        if (!value) return "刚刚";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "刚刚";
        var diff = Date.now() - date.getTime();
        if (diff < 60 * 1000) return "刚刚";
        if (diff < 60 * 60 * 1000) return Math.max(1, Math.floor(diff / (60 * 1000))) + " 分钟前";
        if (diff < 24 * 60 * 60 * 1000) return Math.max(1, Math.floor(diff / (60 * 60 * 1000))) + " 小时前";
        if (diff < 48 * 60 * 60 * 1000) return "昨天 " + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
        return formatShortDate(value) || "刚刚";
    }

    function formatDeadline(value) {
        if (!value) return "未设置截止时间";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "未设置截止时间";
        var mm = String(date.getMonth() + 1).padStart(2, "0");
        var dd = String(date.getDate()).padStart(2, "0");
        return mm + "/" + dd + " 截止";
    }

    function deadlineOffsetLabel(value) {
        if (!value) return "未设截止";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "未设截止";
        var diff = date.getTime() - Date.now();
        var days = Math.ceil(diff / (24 * 60 * 60 * 1000));
        if (days < 0) return "已逾期 " + Math.abs(days) + " 天";
        if (days === 0) return "今天截止";
        if (days === 1) return "明天截止";
        return days + " 天后截止";
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
        return "offline";
    }

    function presenceLabel(value) {
        if (value === "online") return "在线";
        return "离线";
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

    function taskPriorityLabel(priority) {
        if (priority === "high") return "高";
        if (priority === "low") return "低";
        return "中";
    }

    function taskPriorityTone(priority) {
        if (priority === "high") return "is-high";
        if (priority === "low") return "is-low";
        return "is-medium";
    }

    function formatTaskDueDisplay(value) {
        if (!value) return "未设置";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "未设置";
        return [
            date.getFullYear(),
            "/",
            String(date.getMonth() + 1).padStart(2, "0"),
            "/",
            String(date.getDate()).padStart(2, "0"),
            " ",
            String(date.getHours()).padStart(2, "0"),
            ":",
            String(date.getMinutes()).padStart(2, "0")
        ].join("");
    }

    function nextTaskStatusValue(status) {
        if (status === "todo") return "in_progress";
        if (status === "in_progress") return "done";
        if (status === "done") return "done";
        return "cancelled";
    }

    function nextTaskPriorityValue(priority) {
        if (priority === "low") return "medium";
        if (priority === "medium") return "high";
        return "low";
    }

    function taskStatusTone(status) {
        if (status === "done") return "teal";
        if (status === "in_progress") return "amber";
        if (status === "file") return "teal";
        if (status === "cancelled") return "slate";
        return "rose";
    }

    function taskActivityActionTone(activity) {
        if (!activity) return "neutral";
        if (activity.action === "created") return "teal";
        if (activity.action === "edited") return "amber";
        if (activity.action === "status_changed") return taskStatusTone(taskActivityStatus(activity));
        if (activity.action === "submitted") return "sky";
        if (activity.action === "file_uploaded") return "cyan";
        return "neutral";
    }

    function taskActivityLabel(action) {
        if (action === "created") return "新建任务";
        if (action === "edited") return "要求更新";
        if (action === "status_changed") return "状态更新";
        if (action === "submitted") return "阶段提交";
        if (action === "file_uploaded") return "文件同步";
        return "协作动态";
    }

    function normalizeActivityFiles(files) {
        if (!Array.isArray(files)) return [];
        return files.map(function (file) {
            if (!file || typeof file !== "object") return null;
            return {
                name: String(file.name || "附件"),
                size: Number(file.size || 0),
                mimeType: String(file.mimeType || ""),
                uploadedAt: file.uploadedAt ? String(file.uploadedAt) : "",
            };
        }).filter(Boolean);
    }

    function activityFileKind(name) {
        var ext = String(name || "").split(".").pop().toLowerCase();
        if (["pdf"].indexOf(ext) >= 0) return "pdf";
        if (["zip", "rar", "7z", "tar", "gz"].indexOf(ext) >= 0) return "archive";
        if (["doc", "docx", "txt", "md"].indexOf(ext) >= 0) return "doc";
        if (["png", "jpg", "jpeg", "gif", "webp", "svg"].indexOf(ext) >= 0) return "image";
        return "file";
    }

    function activityFileTypeLabel(name) {
        var ext = String(name || "").split(".").pop().toUpperCase();
        return ext || "FILE";
    }

    function activityFileIconSvg(kind) {
        if (kind === "pdf") {
            return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.8h5l3 3v9.4a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 16.2V5.6A1.8 1.8 0 0 1 6 3.8Z"></path><path d="M11 3.8v3.1h3"></path><path d="M6.7 13.5h1.5a1.4 1.4 0 1 0 0-2.8H6.7z"></path><path d="M10 10.7v2.8"></path><path d="M10 13.5h1.1"></path><path d="M13 13.5v-2.8h1"></path></svg>';
        }
        if (kind === "archive") {
            return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.8" width="10" height="12.4" rx="1.8"></rect><path d="M8 3.8v3.2h4V3.8"></path><path d="M10 9.4v4.4"></path><path d="M8.6 11h2.8"></path></svg>';
        }
        if (kind === "doc") {
            return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.8h5l3 3v9.4a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 16.2V5.6A1.8 1.8 0 0 1 6 3.8Z"></path><path d="M11 3.8v3.1h3"></path><path d="M7 10h6"></path><path d="M7 12.7h6"></path></svg>';
        }
        if (kind === "image") {
            return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.8" y="4.2" width="12.4" height="11.6" rx="2"></rect><circle cx="8.1" cy="8.1" r="1.2"></circle><path d="m6 13.6 2.6-2.6 1.9 1.8 2.6-3 2.2 3.8"></path></svg>';
        }
        return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.8h5l3 3v9.4a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 16.2V5.6A1.8 1.8 0 0 1 6 3.8Z"></path><path d="M11 3.8v3.1h3"></path></svg>';
    }

    function activityFileSummary(activity) {
        var files = normalizeActivityFiles(activity && activity.files);
        if (!files.length) return "";
        var names = files.map(function (file) { return file.name; });
        return files.length > 3
            ? "文件：" + names.slice(0, 3).join("、") + " 等 " + files.length + " 个"
            : "文件：" + names.join("、");
    }

    function taskActivityChangedFieldChips(activity) {
        var text = String(activity && activity.content || "");
        var chips = [];
        [["标题", "标题"], ["任务说明", "说明"], ["优先级", "优先级"], ["截止时间", "截止"]].forEach(function (row) {
            if (text.indexOf(row[0]) >= 0) chips.push(row[1]);
        });
        return chips;
    }

    function submissionActivityFileSummary(activity) {
        if (!activity) return "";
        var fileNames = Array.isArray(activity.fileNames) ? activity.fileNames.filter(Boolean) : [];
        var parts = [];
        if (fileNames.length) {
            parts.push(fileNames.length > 3 ? "文件：" + fileNames.slice(0, 3).join("、") + " 等 " + fileNames.length + " 个" : "文件：" + fileNames.join("、"));
        }
        if (Number(activity.linkCount) > 0) {
            parts.push("链接 " + Number(activity.linkCount) + " 个");
        }
        if (activity.repositoryUrl) {
            parts.push("附带仓库链接");
        }
        return parts.join("；");
    }

    function taskActivityContent(activity) {
        if (!activity) return "暂无协作动态";
        var actor = taskActivityActor(activity);
        var actorLabel = actor && (actor.displayName || actor.name || actor.userId || actor.id) || "成员";
        var actorRole = actor && actor.role === "leader" ? "组长" : actorLabel;
        if (activity && activity.content && activity.action !== "edited") return activity.content;
        if (activity.action === "created") return "组长创建了新任务，请负责人及时查看。";
        if (activity.action === "edited") {
            var changed = taskActivityChangedFieldChips(activity);
            if (changed.length === 1) return actorRole + "修改了" + changed[0] + "。";
            if (changed.length > 1) return actorRole + "更新了" + changed.join("、") + "。";
            return actorRole + "更新了任务要求。";
        }
        if (activity.action === "status_changed") return actorLabel + "更新了任务状态。";
        if (activity.action === "submitted") {
            var stageLabel = activity.stageTitle ? "第 " + String(activity.stageNo || "--") + " 阶段 " + activity.stageTitle : "当前阶段";
            var submissionSummary = submissionActivityFileSummary(activity);
            return stageLabel + "已提交《" + String(activity.title || "未命名提交") + "》" + (submissionSummary ? "；" + submissionSummary : "。");
        }
        if (activity.action === "file_uploaded") {
            var fileSummary = activityFileSummary(activity);
            return fileSummary ? "群聊中上传了新文件；" + fileSummary : "群聊中上传了新文件。";
        }
        return "任务发生了新的协作变更。";
    }

    function taskActivityStatus(activity) {
        if (activity && activity.action === "submitted") return "done";
        if (activity && activity.action === "file_uploaded") return "file";
        return activity && activity.status ? activity.status : "todo";
    }

    function taskActivityActor(activity) {
        if (!activity) return null;
        return findMemberByUserId(activity.operatorId)
            || findMemberByUserId(Array.isArray(activity.assigneeIds) ? activity.assigneeIds[0] : "")
            || null;
    }

    function isLeaderActivity(activity) {
        var actor = taskActivityActor(activity);
        if (actor && actor.role === "leader") return true;
        return Boolean(state.currentGroup && state.currentGroup.myRole === "leader" && String(activity && activity.operatorId || "") === String(currentUserId()));
    }

    function isMineActivity(activity) {
        var me = String(currentUserId());
        if (String(activity && activity.operatorId || "") === me) return true;
        return Array.isArray(activity && activity.assigneeIds) && activity.assigneeIds.some(function (id) {
            return String(id) === me;
        });
    }

    function activityMatchesFilter(activity, filter) {
        if (filter === "all") return true;
        if (filter === "submission") return activity && activity.action === "submitted";
        if (filter === "file") return taskActivityStatus(activity) === "file";
        if (filter === "mine") return isMineActivity(activity);
        if (filter === "leader") return isLeaderActivity(activity);
        return taskActivityStatus(activity) === filter;
    }

    function activityDetailChips(activity) {
        if (!activity) return [];
        if (activity.action === "file_uploaded") {
            return normalizeActivityFiles(activity.files).slice(0, 3).map(function (file) {
                return { label: file.name, tone: "file", icon: activityFileIconSvg(activityFileKind(file.name)), meta: activityFileTypeLabel(file.name) };
            });
        }
        if (activity.action === "submitted") {
            var chips = [];
            if (activity.stageNo) chips.push({ label: "阶段 " + activity.stageNo, tone: "stage" });
            if (Array.isArray(activity.fileNames) && activity.fileNames.length) {
                chips.push({ label: activity.fileNames.length + " 个文件", tone: "file" });
            }
            if (Number(activity.linkCount) > 0) {
                chips.push({ label: activity.linkCount + " 个链接", tone: "neutral" });
            }
            return chips;
        }
        if (activity.action === "edited") {
            return taskActivityChangedFieldChips(activity).map(function (chip) {
                return { label: chip, tone: "edit" };
            });
        }
        if (activity.action === "status_changed") {
            return [{ label: taskStatusLabel(taskActivityStatus(activity)), tone: taskStatusTone(taskActivityStatus(activity)) }];
        }
        if (activity.action === "created") {
            return [{ label: "已分派", tone: "teal" }];
        }
        return [];
    }

    function activitySecondaryLine(activity) {
        if (!activity) return "";
        if (activity.action === "submitted") {
            var stageText = activity.stageTitle ? "第 " + String(activity.stageNo || "--") + " 阶段 · " + activity.stageTitle : "阶段提交";
            return stageText;
        }
        if (activity.action === "file_uploaded") {
            var files = normalizeActivityFiles(activity.files);
            return files.length > 1 ? "群聊中共上传 " + files.length + " 个文件" : "群聊文件同步";
        }
        if (activity.action === "created") return "已同步到负责人待办";
        if (activity.action === "edited") return "已同步到工作台";
        if (activity.action === "status_changed") return "已同步到协作进度";
        return "";
    }

    function switchTeamView(viewKey) {
        qsa("#studentTeamViewTabs .student-view-tab").forEach(function (node) {
            var active = node.getAttribute("data-team-view") === viewKey;
            node.classList.toggle("is-active", active);
        });
        qsa(".student-team-view").forEach(function (view) {
            var active = view.id === "studentTeam" + viewKey.charAt(0).toUpperCase() + viewKey.slice(1) + "View";
            view.hidden = !active;
            view.classList.toggle("is-active", active);
        });
    }

    function switchPanelById(panelId) {
        var navButton = qs('.side-nav .nav-item[data-target="' + panelId + '"]');
        if (navButton) {
            navButton.click();
            return;
        }
        qsa(".page-panel").forEach(function (panel) {
            var active = panel.id === panelId;
            panel.hidden = !active;
            panel.classList.toggle("is-active", active);
        });
    }

    function setSelectValue(select, value) {
        if (!select || value === undefined || value === null) return false;
        var next = String(value);
        var matched = Array.from(select.options || []).some(function (option) {
            return String(option.value) === next;
        });
        if (!matched) return false;
        select.value = next;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }

    function setSelectWithRetry(selectId, value, callback, attempts) {
        var remaining = attempts || 8;
        var select = qs("#" + selectId);
        if (setSelectValue(select, value)) {
            if (callback) callback();
            return;
        }
        if (remaining <= 0) return;
        window.setTimeout(function () {
            setSelectWithRetry(selectId, value, callback, remaining - 1);
        }, 120);
    }

    function navigateFromActivity(activity) {
        if (!activity) return;
        if (activity.taskId) {
            switchTeamView("workbench");
            state.selectedTaskId = String(activity.taskId);
            renderSelectedTask();
            return;
        }
        if (activity.action === "submitted") {
            switchPanelById("panel-file-submit");
            window.setTimeout(function () {
                if (taskCourse && taskCourse.value) {
                    setSelectWithRetry("extSubmitCourse", taskCourse.value, function () {
                        setSelectWithRetry("extSubmitAssignment", taskAssignment && taskAssignment.value || "", function () {
                            if (activity.stageId) {
                                setSelectWithRetry("extSubmitStage", activity.stageId, null, 10);
                            }
                        }, 10);
                    }, 10);
                }
            }, 80);
            return;
        }
        if (activity.action === "file_uploaded") {
            if (window.linkseeChatWidget && typeof window.linkseeChatWidget.openConversationByScope === "function" && state.currentGroup && state.currentGroup.id) {
                window.linkseeChatWidget.openConversationByScope("group", state.currentGroup.id).catch(function () {});
                return;
            }
            var launcher = qs("[data-chat-launcher]");
            if (launcher) launcher.click();
        }
    }

    function isTaskActivityMessage(message) {
        if (!message || message.messageType !== "announcement") return false;
        var files = message.files;
        return Boolean(files) && typeof files === "object" && !Array.isArray(files) && files.subType === "task_event";
    }

    function isSubmissionActivityMessage(message) {
        if (!message || message.messageType !== "announcement") return false;
        var files = message.files;
        return Boolean(files) && typeof files === "object" && !Array.isArray(files) && files.subType === "submission_event";
    }

    function isFileActivityMessage(message) {
        return Boolean(message && message.messageType === "file" && Array.isArray(message.files) && message.files.length);
    }

    function normalizeTaskActivityRows(messages) {
        var taskMap = new Map((state.tasks || []).map(function (task) {
            return [String(task.id || ""), task];
        }));
        return (Array.isArray(messages) ? messages : []).filter(function (message) {
            return isTaskActivityMessage(message) || isSubmissionActivityMessage(message) || isFileActivityMessage(message);
        }).map(function (message) {
            var files = message.files || {};
            if (isFileActivityMessage(message)) {
                var normalizedFiles = normalizeActivityFiles(message.files);
                return {
                    id: "file-activity-" + String(message.id || Date.now()),
                    taskId: "",
                    title: normalizedFiles.length > 1 ? "群聊文件更新" : (normalizedFiles[0] && normalizedFiles[0].name) || "群聊文件更新",
                    content: String(message.content || ""),
                    action: "file_uploaded",
                    status: "file",
                    assigneeIds: [],
                    operatorId: String(message.senderId || ""),
                    createdAt: message.createdAt || new Date().toISOString(),
                    files: normalizedFiles,
                    scopeType: "group",
                    scopeId: state.currentGroup && state.currentGroup.id ? String(state.currentGroup.id) : "",
                };
            }
            if (files.subType === "submission_event") {
                return {
                    id: "submission-activity-" + String(message.id || files.submissionId || Date.now()),
                    taskId: "",
                    title: String(files.submissionTitle || "未命名提交"),
                    content: String(message.content || ""),
                    action: "submitted",
                    status: "done",
                    assigneeIds: [],
                    operatorId: String(files.operatorId || message.senderId || ""),
                    createdAt: message.createdAt || new Date().toISOString(),
                    stageId: String(files.stageId || ""),
                    stageNo: Number(files.stageNo || 0),
                    stageTitle: String(files.stageTitle || ""),
                    submissionId: String(files.submissionId || ""),
                    attemptNo: Number(files.attemptNo || 0),
                    fileNames: Array.isArray(files.fileNames) ? files.fileNames.map(function (name) { return String(name); }) : [],
                    linkCount: Number(files.linkCount || 0),
                    repositoryUrl: files.repositoryUrl ? String(files.repositoryUrl) : "",
                };
            }
            var taskId = String(files.taskId || "");
            var task = taskMap.get(taskId) || null;
            var assigneeIds = Array.isArray(files.assigneeIds)
                ? files.assigneeIds.map(function (id) { return String(id); })
                : taskAssigneeIds(task);
            return {
                id: "activity-" + String(message.id || taskId || Date.now()),
                taskId: taskId,
                title: String(files.taskTitle || (task && task.title) || "未命名任务"),
                content: String(message.content || ""),
                action: String(files.taskEventType || "edited"),
                status: String(files.status || (task && task.status) || "todo"),
                assigneeIds: assigneeIds,
                operatorId: String(files.operatorId || message.senderId || ""),
                createdAt: message.createdAt || new Date().toISOString(),
            };
        }).sort(function (a, b) {
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
    }

    function buildFallbackTaskActivities(tasks) {
        return (tasks || []).slice().sort(function (a, b) {
            return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
        }).map(function (task) {
            var action = String(task.updatedAt || "") && String(task.createdAt || "") && String(task.updatedAt) !== String(task.createdAt)
                ? "status_changed"
                : "created";
            if (action === "status_changed" && task.status === "todo") {
                action = "edited";
            }
            return {
                id: "fallback-" + String(task.id),
                taskId: String(task.id),
                title: task.title || "未命名任务",
                content: "",
                action: action,
                status: task.status || "todo",
                assigneeIds: taskAssigneeIds(task),
                operatorId: Array.isArray(task.assigneeIds) ? String(task.assigneeIds[0] || "") : "",
                createdAt: task.updatedAt || task.createdAt || new Date().toISOString(),
            };
        });
    }

    function prependTaskActivity(task, action, options) {
        var activity = {
            id: "local-" + action + "-" + String(task && task.id || Date.now()) + "-" + Date.now(),
            taskId: String(task && task.id || ""),
            title: task && task.title || "未命名任务",
            content: options && options.content || "",
            action: action,
            status: options && options.status || task && task.status || "todo",
            assigneeIds: taskAssigneeIds(task),
            operatorId: currentUserId(),
            createdAt: new Date().toISOString(),
        };
        state.taskActivities = [activity].concat((state.taskActivities || []).filter(function (row) {
            return String(row.id) !== String(activity.id);
        })).slice(0, 20);
        renderActivityFeed();
    }

    function prependSubmissionActivity(detail) {
        var activity = {
            id: "local-submission-" + String(detail && detail.submissionId || Date.now()) + "-" + Date.now(),
            taskId: "",
            title: detail && detail.submissionTitle || "未命名提交",
            content: detail && detail.content || "",
            action: "submitted",
            status: "done",
            assigneeIds: [],
            operatorId: detail && detail.operatorId || currentUserId(),
            createdAt: detail && detail.createdAt || new Date().toISOString(),
            stageId: detail && detail.stageId || "",
            stageNo: Number(detail && detail.stageNo || 0),
            stageTitle: detail && detail.stageTitle || "",
            submissionId: detail && detail.submissionId || "",
            attemptNo: Number(detail && detail.attemptNo || 0),
            fileNames: Array.isArray(detail && detail.fileNames) ? detail.fileNames.slice() : [],
            linkCount: Number(detail && detail.linkCount || 0),
            repositoryUrl: detail && detail.repositoryUrl || "",
        };
        state.taskActivities = [activity].concat((state.taskActivities || []).filter(function (row) {
            return String(row.id) !== String(activity.id);
        })).slice(0, 20);
        renderActivityFeed();
    }

    function renderTaskSummary(tasks) {
        if (!taskSummary) return;
        var me = currentUserId();
        var rows = (tasks || []).filter(function (task) {
            return Array.isArray(task.assigneeIds) && task.assigneeIds.some(function (assigneeId) {
                return String(assigneeId) === String(me);
            }) && task.status !== "done" && task.status !== "cancelled";
        }).sort(function (a, b) {
            return new Date(a.dueAt || a.updatedAt || a.createdAt || 0).getTime() - new Date(b.dueAt || b.updatedAt || b.createdAt || 0).getTime();
        });
        if (!rows.length) {
            taskSummary.innerHTML = '<div class="student-inline-empty">你当前没有待跟进的任务。</div>';
            return;
        }
        taskSummary.innerHTML = rows.slice(0, 3).map(function (task) {
            return [
                '<button class="student-task-metric" type="button" data-summary-task-id="' + escapeHtml(task.id) + '">',
                '<span class="student-task-metric-dot is-' + escapeHtml(taskStatusTone(task.status)) + '"></span>',
                miniAvatar(resolveAssigneeLabels(task)[0] || currentUserName(), "own", "", Array.isArray(task.assigneeIds) ? task.assigneeIds[0] : ""),
                '<div class="student-task-metric-copy">',
                '<strong>' + escapeHtml(task.title || "未命名任务") + '</strong>',
                '<small>' + escapeHtml(taskStatusLabel(task.status)) + ' · ' + escapeHtml(deadlineOffsetLabel(task.dueAt)) + '</small>',
                '</div>',
                '<span class="student-task-metric-tail">' + escapeHtml(formatDeadline(task.dueAt)) + '</span>',
            '</button>'
            ].join("");
        }).join("");
    }

    function renderTaskSection(title, tone, rows) {
        if (!rows.length) return "";
        return [
            '<details class="student-task-section" open>',
            '<summary class="student-task-section-summary">',
            '<span class="student-task-section-dot is-' + escapeHtml(tone) + '"></span>',
            '<strong>' + escapeHtml(title) + '</strong>',
            '<span>' + escapeHtml(String(rows.length)) + '</span>',
            '</summary>',
            '<div class="student-task-section-body">',
            rows.map(function (task) {
                var selected = String(task.id) === String(state.selectedTaskId);
                return [
                    '<button class="student-task-row' + (selected ? ' is-active' : '') + '" type="button" data-student-task-id="' + escapeHtml(task.id) + '">',
                    '<div class="student-task-line">',
                    '<strong>' + escapeHtml(task.title || "未命名任务") + '</strong>',
                    '<small>' + escapeHtml(resolveAssigneeLabels(task).join("、")) + ' · ' + escapeHtml(formatDeadline(task.dueAt)) + '</small>',
                    '</div>',
                    '<span class="badge badge-' + escapeHtml(taskStatusTone(task.status)) + '">' + escapeHtml(taskStatusLabel(task.status)) + '</span>',
                    '</button>'
                ].join("");
            }).join(""),
            '</div>',
            '</details>'
        ].join("");
    }

    function renderActivityFeed() {
        if (!activityFeed) return;
        var rows = (state.taskActivities || []).slice();
        if (!rows.length) {
            rows = buildFallbackTaskActivities(state.tasks);
        }
        if (state.activityFilter !== "all") {
            rows = rows.filter(function (activity) { return activityMatchesFilter(activity, state.activityFilter); });
        }
        if (!rows.length) {
            activityFeed.innerHTML = '<div class="student-inline-empty">当前筛选下暂无协作动态。</div>';
            return;
        }
        activityFeed.innerHTML = rows.slice(0, 10).map(function (activity) {
            var actor = taskActivityActor(activity);
            var actorLabel = actor && (actor.displayName || actor.name || actor.userId || actor.id) || resolveAssigneeLabels({ assigneeIds: activity.assigneeIds || [] })[0] || "--";
            var activityStatus = taskActivityStatus(activity);
            var chips = activityDetailChips(activity);
            var subline = activitySecondaryLine(activity);
            var targetType = activity.taskId ? "task" : (activity.action === "submitted" ? "submission" : (activity.action === "file_uploaded" ? "file" : ""));
            return [
                '<article class="student-activity-row is-' + escapeHtml(taskActivityActionTone(activity)) + (targetType ? ' is-actionable' : '') + '" data-activity-id="' + escapeHtml(activity.id || "") + '" data-activity-target="' + escapeHtml(targetType) + '" data-activity-task-id="' + escapeHtml(activity.taskId || "") + '" data-activity-stage-id="' + escapeHtml(activity.stageId || "") + '" tabindex="' + (targetType ? '0' : '-1') + '">',
                '<div class="student-activity-avatar-wrap">' + miniAvatar(actorLabel, taskStatusTone(activityStatus), actor && actor.avatarUrl || "", actor && (actor.userId || actor.id) || "") + '</div>',
                '<div class="student-activity-copy">',
                '<span class="student-row-kicker is-' + escapeHtml(taskActivityActionTone(activity)) + '">' + escapeHtml(taskActivityLabel(activity.action)) + '</span>',
                '<strong>' + escapeHtml(activity.title || "未命名任务") + '</strong>',
                (subline ? '<div class="student-activity-subline">' + escapeHtml(subline) + '</div>' : ''),
                '<p>' + escapeHtml(taskActivityContent(activity)) + '</p>',
                (chips.length ? '<div class="student-activity-chip-row">' + chips.map(function (chip) {
                    return '<span class="student-activity-chip is-' + escapeHtml(chip.tone || "neutral") + '">' + (chip.icon ? '<span class="student-activity-chip-icon" aria-hidden="true">' + chip.icon + '</span>' : '') + (chip.meta ? '<span class="student-activity-chip-meta">' + escapeHtml(chip.meta) + '</span>' : '') + '<span>' + escapeHtml(chip.label || "") + '</span></span>';
                }).join("") + '</div>' : ''),
                '</div>',
                '<div class="student-activity-meta"><span class="badge badge-' + escapeHtml(taskStatusTone(activityStatus)) + '">' + escapeHtml(activityStatus === "file" ? "文件" : taskStatusLabel(activityStatus)) + '</span><small>' + escapeHtml(formatRelativeTime(activity.createdAt)) + '</small></div>',
                '</article>'
            ].join("");
        }).join("");
    }

    window.addEventListener("linksee:submission-created", function (event) {
        var detail = event && event.detail || null;
        if (!detail || !state.currentGroup) return;
        if (String(detail.groupId || "") !== String(state.currentGroup.id || "")) return;
        prependSubmissionActivity(detail);
    });

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
            var assignedTasks = (state.tasks || []).filter(function (task) {
                return taskAssigneeIds(task).some(function (assigneeId) {
                    return String(assigneeId) === String(member.userId || member.id || "");
                });
            });
            var overdueCount = assignedTasks.filter(function (task) {
                if (!task.dueAt || task.status === "done" || task.status === "cancelled") return false;
                var due = new Date(task.dueAt);
                return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
            }).length;
            var memberTrail = [presenceLabel(member.presence), assignedTasks.length + " 项任务"];
            if (overdueCount > 0) memberTrail.push(overdueCount + " 项逾期");
            return [
                '<article class="student-member-item">',
                miniAvatar(label, member.role === "leader" ? "amber" : "teal", member.avatarUrl || "", member.userId || member.id || ""),
                '<div class="student-member-copy"><strong>' + escapeHtml(label) + '</strong><small>' + escapeHtml(role) + '</small><span class="student-member-trail">' + escapeHtml(memberTrail.join(" · ")) + '</span></div>',
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
        refreshTeamCustomSelect(leaderStage);
    }

    function syncWorkbenchStageOptions() {
        var stageSelect = qs("#extTaskStageId");
        if (!stageSelect) return;
        var previousValue = stageSelect.value || "";
        var rows = (state.stages || []).slice().sort(function (a, b) {
            return Number(a.stageNo || 0) - Number(b.stageNo || 0);
        });
        stageSelect.innerHTML = ['<option value="">全部阶段</option>'].concat(rows.map(function (stage) {
            return '<option value="' + escapeHtml(stage.id) + '">' + escapeHtml((stage.stageNo ? ("阶段 " + stage.stageNo + " · ") : "") + (stage.title || "未命名阶段")) + '</option>';
        })).join("");
        if (previousValue && rows.some(function (stage) { return String(stage.id) === String(previousValue); })) {
            stageSelect.value = previousValue;
        }
        refreshTeamCustomSelect(stageSelect);
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
        var todoRows = rows.filter(function (task) { return task.status === "todo"; });
        var doingRows = rows.filter(function (task) { return task.status === "in_progress"; });
        var doneRows = rows.filter(function (task) { return task.status === "done"; });
        var cancelledRows = rows.filter(function (task) { return task.status === "cancelled"; });
        taskList.innerHTML = [
            renderTaskSection("TODO", "rose", todoRows),
            renderTaskSection("DOING", "amber", doingRows),
            renderTaskSection("完成", "teal", doneRows),
            renderTaskSection("已取消", "slate", cancelledRows)
        ].filter(Boolean).join("") || '<div class="student-inline-empty">当前筛选下没有可显示的任务。</div>';
    }

    function renderSelectedTask() {
        var rows = state.tasks || [];
        var task = rows.find(function (row) { return String(row.id) === String(state.selectedTaskId); }) || rows[0] || null;
        var patchBtn = qs("#extTaskPatch");
        var statusBtn = qs("#extTaskStatusSave");
        var nextBtn = qs("#studentTaskStatusNext");
        var titleView = qs("#studentTaskTitleView");
        var descView = qs("#studentTaskDescView");
        var titleEditWrap = qs("#studentTaskTitleEditWrap");
        var descEditWrap = qs("#studentTaskDescEditWrap");
        var priorityCycleBtn = qs("#studentTaskPriorityCycleBtn");
        var dueInput = qs("#extTaskDue");
        if (!task) {
            state.syncingTaskEditor = true;
            text("#studentEditorScope", "未绑定阶段");
            text("#studentEditorAssignee", "待填写");
            text("#studentTaskPriorityView", "中");
            text("#studentTaskDueView", "未设置");
            text("#studentTaskIdView", "# --");
            if (titleView) titleView.textContent = "请选择一条任务";
            if (descView) descView.textContent = "选择任务后查看详情描述。";
            var priorityView = qs("#studentTaskPriorityView");
            if (priorityView) priorityView.className = "student-task-priority-chip is-medium";
            var ids = ["#extTaskId", "#extTaskTitle", "#extTaskDesc", "#extTaskDue"];
            ids.forEach(function (selector) {
                var node = qs(selector);
                if (node) node.value = "";
            });
            if (qs("#extTaskPriority")) qs("#extTaskPriority").value = "medium";
            var emptyStatusSelect = qs("#extTaskStatus");
            if (emptyStatusSelect) {
                var emptyCancelledOption = Array.from(emptyStatusSelect.options).find(function (option) {
                    return option.value === "cancelled";
                });
                if (emptyCancelledOption) emptyCancelledOption.remove();
                emptyStatusSelect.value = "todo";
            }
            ["#extTaskTitle", "#extTaskDesc", "#extTaskDue", "#extTaskPriority", "#extTaskStatus"].forEach(function (selector) {
                var node = qs(selector);
                if (node) node.disabled = true;
            });
            if (titleEditWrap) titleEditWrap.hidden = true;
            if (descEditWrap) descEditWrap.hidden = true;
            if (priorityCycleBtn) priorityCycleBtn.hidden = true;
            if (dueInput) dueInput.hidden = true;
            if (titleView) titleView.hidden = false;
            if (descView) descView.hidden = false;
            if (patchBtn) {
                patchBtn.hidden = true;
                patchBtn.disabled = true;
            }
            if (statusBtn) statusBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            state.syncingTaskEditor = false;
            return;
        }
        state.syncingTaskEditor = true;
        state.selectedTaskId = task.id;
        var stage = (state.stages || []).find(function (row) { return String(row.id || "") === String(task.stageId || ""); }) || null;
        text("#studentEditorScope", stage ? (stage.title || "已绑定阶段") : "未绑定阶段");
        text("#studentEditorAssignee", resolveAssigneeLabels(task).join("、"));
        text("#studentTaskPriorityView", taskPriorityLabel(task.priority));
        text("#studentTaskDueView", formatTaskDueDisplay(task.dueAt));
        text("#studentTaskIdView", "# " + (task.id || "--"));
        var priorityView = qs("#studentTaskPriorityView");
        if (priorityView) priorityView.className = "student-task-priority-chip " + taskPriorityTone(task.priority);
        if (priorityCycleBtn) {
            priorityCycleBtn.className = "student-task-priority-chip " + taskPriorityTone(task.priority);
            priorityCycleBtn.textContent = taskPriorityLabel(task.priority);
        }
        if (titleView) titleView.textContent = task.title || "未命名任务";
        if (descView) descView.textContent = task.description || "暂无详情描述。";
        if (qs("#extTaskId")) qs("#extTaskId").value = task.id || "";
        if (qs("#extTaskTitle")) qs("#extTaskTitle").value = task.title || "";
        if (qs("#extTaskDesc")) qs("#extTaskDesc").value = task.description || "";
        if (qs("#extTaskDue")) qs("#extTaskDue").value = task.dueAt ? String(task.dueAt).slice(0, 16) : "";
        if (qs("#extTaskPriority")) qs("#extTaskPriority").value = task.priority || "medium";
        var statusSelect = qs("#extTaskStatus");
        if (statusSelect) {
            var cancelledOption = Array.from(statusSelect.options).find(function (option) {
                return option.value === "cancelled";
            });
            if (task.status === "cancelled") {
                if (!cancelledOption) {
                    cancelledOption = document.createElement("option");
                    cancelledOption.value = "cancelled";
                    cancelledOption.textContent = "已取消";
                    statusSelect.appendChild(cancelledOption);
                }
            } else if (cancelledOption) {
                cancelledOption.remove();
            }
        }
        if (qs("#extTaskStatus")) qs("#extTaskStatus").value = task.status || "todo";
        var isLeader = state.currentGroup && state.currentGroup.myRole === "leader";
        var canUpdateOwnStatus = task.status !== "cancelled" && canCurrentUserUpdateTaskStatus(task, task.status || "todo");
        if (titleView) titleView.hidden = isLeader;
        if (descView) descView.hidden = isLeader;
        if (priorityView) priorityView.hidden = isLeader;
        var canChangeStatus = canUpdateOwnStatus;
        var canAdvanceStatus = canChangeStatus && task.status !== "done";
        if (titleEditWrap) titleEditWrap.hidden = !isLeader;
        if (descEditWrap) descEditWrap.hidden = !isLeader;
        if (priorityCycleBtn) {
            priorityCycleBtn.hidden = !isLeader;
            priorityCycleBtn.disabled = !isLeader;
        }
        if (qs("#studentTaskDueView")) qs("#studentTaskDueView").hidden = isLeader;
        if (dueInput) {
            dueInput.hidden = !isLeader;
            dueInput.disabled = !isLeader;
        }
        if (patchBtn) {
            patchBtn.hidden = !isLeader;
            patchBtn.disabled = !isLeader;
        }
        if (statusBtn) statusBtn.disabled = !canChangeStatus;
        if (nextBtn) nextBtn.disabled = !canAdvanceStatus;
        ["#extTaskTitle", "#extTaskDesc", "#extTaskDue", "#extTaskPriority"].forEach(function (selector) {
            var node = qs(selector);
            if (node) node.disabled = !isLeader;
        });
        if (qs("#extTaskStatus")) qs("#extTaskStatus").disabled = !canChangeStatus;
        state.syncingTaskEditor = false;
        refreshTeamCustomSelect(qs("#extTaskStatus"));
        renderWorkbenchTaskList();
    }

    function renderWorkbenchState() {
        syncWorkbenchStageOptions();
        syncLeaderStageOptions();
        renderWorkbenchTaskList();
        renderSelectedTask();
    }

    function clearActivitySurfaces() {
        state.taskActivities = [];
        renderStageProgress([], []);
        renderTaskSummary([]);
        renderActivityFeed();
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
            state.tasks = (mockAssignment.tasks || []).map(function (task) {
                return Object.assign({}, task, { assigneeIds: taskAssigneeIds(task) });
            });
            state.taskActivities = buildFallbackTaskActivities(state.tasks);
            state.members = (mockAssignment.members || []).slice();
            renderStageProgress(state.stages, state.tasks);
            renderTaskSummary(state.tasks);
            renderActivityFeed();
            renderMemberList({ members: state.members });
            renderLeaderAssigneeMenu();
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
                api().getJson("/api/v1/groups/" + encodeURIComponent(state.currentGroup.id) + "/messages?limit=20").catch(function () { return { data: [] }; }),
            ]).then(function (payloads) {
                state.tasks = rowsOf(payloads[0]).map(function (task) {
                    return Object.assign({}, task, { assigneeIds: taskAssigneeIds(task) });
                });
                var detail = payloads[1] && payloads[1].data || state.currentGroup;
                state.taskActivities = normalizeTaskActivityRows(rowsOf(payloads[3]));
                state.members = Array.isArray(detail && detail.members) ? detail.members : [];
                renderStageProgress(state.stages, state.tasks);
                renderTaskSummary(state.tasks);
                renderActivityFeed();
                renderMemberList({ members: state.members });
                renderLeaderAssigneeMenu();
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
        var summary = qs("#studentActivitySummaryCard");
        var members = qs("#studentActivityMembersCard");
        var viewAll = qs("#studentTaskViewAllBtn");
        var leaderLaunch = qs("#studentLeaderCreateLauncher");
        if (gate) gate.hidden = grouped;
        if (editor) editor.hidden = !grouped;
        if (summary) summary.hidden = !grouped;
        if (members) members.hidden = !grouped;
        if (viewAll) viewAll.disabled = !grouped;
        if (leaderLaunch) leaderLaunch.hidden = !leader;
        if (!leader) closeLeaderTaskCreateModal();
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
                renderActivityFeed();
            });
        });
        var activityReload = qs("#extTaskReload");
        if (activityReload) activityReload.addEventListener("click", refreshActivityState);
        document.addEventListener("click", function (event) {
            if (!event.target.closest(".student-team-selectbox")) {
                closeTeamCustomSelects();
            }
            if (!event.target.closest(".student-assignee-picker") && !event.target.closest(".student-assignee-menu")) {
                var assigneeMenu = qs("#studentLeaderTaskAssigneeMenu");
                var assigneeButton = qs("#studentLeaderTaskAssigneeButton");
                if (assigneeMenu) assigneeMenu.hidden = true;
                if (assigneeButton) assigneeButton.setAttribute("aria-expanded", "false");
            }
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
        if (requestList) {
            requestList.addEventListener("click", function (event) {
                var approveNode = event.target.closest("[data-request-approve]");
                var rejectNode = event.target.closest("[data-request-reject]");
                var requestId = approveNode && approveNode.getAttribute("data-request-approve") || rejectNode && rejectNode.getAttribute("data-request-reject") || "";
                if (!requestId) return;
                if (approveNode) {
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
                    return;
                }
                if (rejectNode) {
                    if (state.mockEnabled) {
                        var assignmentReject = currentMockAssignment();
                        if (!assignmentReject) return setResult(groupResult, "无法处理", "当前项目不存在。", true);
                        var targetReject = (assignmentReject.joinRequests || []).find(function (row) { return row.id === requestId; });
                        if (!targetReject) return setResult(groupResult, "未找到申请", "请确认申请编号。", true);
                        targetReject.status = "rejected";
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
                }
            });
        }
        var leaderCreateBtn = qs("#studentLeaderCreateTaskBtn");
        if (leaderCreateBtn) {
            leaderCreateBtn.addEventListener("click", function () {
                if (!state.currentGroup) return setResult(qs("#studentLeaderTaskResult"), "无法创建", "请先加入或创建小组。", true);
                if (state.currentGroup.myRole !== "leader") return setResult(qs("#studentLeaderTaskResult"), "权限不足", "只有组长可以创建 MiniTask。", true);
                var title = qs("#studentLeaderTaskTitle") && qs("#studentLeaderTaskTitle").value.trim();
                var assignee = qs("#studentLeaderTaskAssignee") && qs("#studentLeaderTaskAssignee").value.trim();
                var description = qs("#studentLeaderTaskDesc") && qs("#studentLeaderTaskDesc").value.trim() || null;
                if (!title || !assignee) return setResult(qs("#studentLeaderTaskResult"), "信息不完整", "请填写任务标题并选择负责人。", true);
                var payload = {
                    title: title,
                    description: description,
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
                        description: description,
                        status: "todo",
                        assigneeIds: [assignee],
                        updatedAt: new Date().toISOString(),
                        dueAt: payload.dueAt,
                        priority: payload.priority,
                        stageId: payload.stageId || null,
                    });
                    state.selectedTaskId = assignment.tasks[0].id;
                    setResult(qs("#studentLeaderTaskResult"), "创建成功", "新任务已加入工作台。", false);
                    ["#studentLeaderTaskTitle", "#studentLeaderTaskDesc", "#studentLeaderTaskAssignee", "#studentLeaderTaskDue"].forEach(function (selector) {
                        var node = qs(selector);
                        if (node) node.value = "";
                    });
                    updateLeaderTaskAssigneeButton();
                    setLeaderTaskPriority("medium");
                    if (leaderStage) leaderStage.value = "";
                    closeLeaderTaskCreateModal();
                    commitTaskRows(assignment.tasks, state.selectedTaskId);
                    prependTaskActivity(assignment.tasks[0], "created", {
                        content: "组长创建了新任务，并已通知负责人处理。",
                    });
                    return;
                }
                api().postJson("/api/v1/groups/" + encodeURIComponent(state.currentGroup.id) + "/minitasks", payload).then(function (response) {
                    setResult(qs("#studentLeaderTaskResult"), "创建成功", "任务已创建。", false);
                    ["#studentLeaderTaskTitle", "#studentLeaderTaskDesc", "#studentLeaderTaskAssignee", "#studentLeaderTaskDue"].forEach(function (selector) {
                        var node = qs(selector);
                        if (node) node.value = "";
                    });
                    updateLeaderTaskAssigneeButton();
                    setLeaderTaskPriority("medium");
                    if (leaderStage) leaderStage.value = "";
                    closeLeaderTaskCreateModal();
                    var nextTask = response && response.data ? response.data : null;
                    upsertTaskRow(nextTask, { prepend: true, select: true });
                    prependTaskActivity(nextTask, "created", {
                        content: "组长创建了新任务，并已向负责人发送任务通知。",
                    });
                }).catch(function (err) {
                    setResult(qs("#studentLeaderTaskResult"), "创建失败", err && err.message || "请稍后重试。", true);
                });
            });
        }
        if (qs("#studentLeaderCreateLauncher")) {
            qs("#studentLeaderCreateLauncher").addEventListener("click", function () {
                if (!state.currentGroup || state.currentGroup.myRole !== "leader") return;
                openLeaderTaskCreateModal();
            });
        }
        if (qs("#studentTaskCreateClose")) qs("#studentTaskCreateClose").addEventListener("click", closeLeaderTaskCreateModal);
        if (qs("#studentTaskCreateModal")) {
            qs("#studentTaskCreateModal").addEventListener("click", function (event) {
                var closeNode = event.target.closest("[data-student-task-create-close]");
                if (closeNode) closeLeaderTaskCreateModal();
            });
        }
        if (qs("#studentLeaderTaskAssigneeButton")) {
            qs("#studentLeaderTaskAssigneeButton").addEventListener("click", function (event) {
                event.preventDefault();
                var menu = qs("#studentLeaderTaskAssigneeMenu");
                var button = qs("#studentLeaderTaskAssigneeButton");
                if (!menu || !button) return;
                var willOpen = Boolean(menu.hidden);
                menu.hidden = !willOpen;
                button.setAttribute("aria-expanded", willOpen ? "true" : "false");
                renderLeaderAssigneeMenu();
            });
        }
        if (qs("#studentLeaderTaskAssigneeMenu")) {
            qs("#studentLeaderTaskAssigneeMenu").addEventListener("click", function (event) {
                var option = event.target.closest("[data-leader-assignee]");
                if (!option) return;
                var input = qs("#studentLeaderTaskAssignee");
                var menu = qs("#studentLeaderTaskAssigneeMenu");
                var button = qs("#studentLeaderTaskAssigneeButton");
                if (input) input.value = option.getAttribute("data-leader-assignee") || "";
                updateLeaderTaskAssigneeButton();
                if (menu) menu.hidden = true;
                if (button) button.setAttribute("aria-expanded", "false");
            });
        }
        qsa("#studentLeaderTaskPriorityGroup .student-priority-choice").forEach(function (button) {
            button.addEventListener("click", function () {
                setLeaderTaskPriority(button.getAttribute("data-priority-value") || "medium");
            });
        });
        if (qs("#studentTaskSearch")) qs("#studentTaskSearch").addEventListener("input", renderWorkbenchTaskList);
        if (qs("#studentTaskStatusFilter")) qs("#studentTaskStatusFilter").addEventListener("change", renderWorkbenchTaskList);
        if (qs("#studentTaskMineOnly")) qs("#studentTaskMineOnly").addEventListener("change", renderWorkbenchTaskList);
        if (qs("#studentTaskSummaryMoreBtn")) {
            qs("#studentTaskSummaryMoreBtn").addEventListener("click", function () {
                switchTeamView("workbench");
                if (qs("#studentTaskMineOnly")) qs("#studentTaskMineOnly").checked = true;
                renderWorkbenchTaskList();
            });
        }
        if (taskSummary) {
            taskSummary.addEventListener("click", function (event) {
                var row = event.target.closest("[data-summary-task-id]");
                if (!row) return;
                state.selectedTaskId = row.getAttribute("data-summary-task-id") || "";
                switchTeamView("workbench");
                renderSelectedTask();
            });
        }
        if (activityFeed) {
            activityFeed.addEventListener("click", function (event) {
                var row = event.target.closest(".student-activity-row[data-activity-target]");
                if (!row) return;
                var targetType = row.getAttribute("data-activity-target") || "";
                if (!targetType) return;
                var activity = (state.taskActivities || []).find(function (entry) {
                    return String(entry.id) === String(row.getAttribute("data-activity-id") || "");
                });
                if (activity) navigateFromActivity(activity);
            });
            activityFeed.addEventListener("keydown", function (event) {
                if (event.key !== "Enter" && event.key !== " ") return;
                var row = event.target.closest(".student-activity-row[data-activity-target]");
                if (!row) return;
                event.preventDefault();
                var activity = (state.taskActivities || []).find(function (entry) {
                    return String(entry.id) === String(row.getAttribute("data-activity-id") || "");
                });
                if (activity) navigateFromActivity(activity);
            });
        }
        if (qs("#studentTaskStatusNext")) {
            qs("#studentTaskStatusNext").addEventListener("click", function () {
                var statusSelect = qs("#extTaskStatus");
                if (!statusSelect || statusSelect.disabled) return;
                statusSelect.value = nextTaskStatusValue(statusSelect.value || "todo");
                submitTaskStatus();
            });
        }
        if (qs("#extTaskStatus")) {
            qs("#extTaskStatus").addEventListener("change", function () {
                if (state.syncingTaskEditor || qs("#extTaskStatus").disabled) return;
                submitTaskStatus();
            });
        }
        ["#extTaskTitle", "#extTaskDesc", "#extTaskDue"].forEach(function (selector) {
            var node = qs(selector);
            if (!node) return;
            var eventName = selector === "#extTaskDue" ? "change" : "blur";
            node.addEventListener(eventName, function () {
                if (state.syncingTaskEditor || node.disabled) return;
                submitTaskPatch();
            });
        });
        if (qs("#studentTaskPriorityCycleBtn")) {
            qs("#studentTaskPriorityCycleBtn").addEventListener("click", function () {
                if (state.syncingTaskEditor || qs("#studentTaskPriorityCycleBtn").disabled) return;
                var task = (state.tasks || []).find(function (row) {
                    return String(row.id) === String(state.selectedTaskId);
                }) || null;
                var priorityInput = qs("#extTaskPriority");
                if (!task || !priorityInput) return;
                var nextPriority = nextTaskPriorityValue(priorityInput.value || task.priority || "medium");
                priorityInput.value = nextPriority;
                task.priority = nextPriority;
                qs("#studentTaskPriorityCycleBtn").className = "student-task-priority-chip " + taskPriorityTone(nextPriority);
                qs("#studentTaskPriorityCycleBtn").textContent = taskPriorityLabel(nextPriority);
                submitTaskPatch();
            });
        }
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

    enhanceTeamCustomSelects();
    setLeaderTaskPriority("medium");
    updateLeaderTaskAssigneeButton();
    applyViewTabs();
    bindStageWheel();
    bindJoinActions();
    ensureMockContext();
    if (taskCourse) taskCourse.addEventListener("change", function () { window.setTimeout(refreshJoinState, 280); });
    if (taskAssignment) taskAssignment.addEventListener("change", function () { window.setTimeout(refreshJoinState, 280); });
    window.addEventListener("load", function () { window.setTimeout(refreshJoinState, 800); });
})();
