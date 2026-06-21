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

    function allowExplicitMock(queryKey) {
        try {
            var search = new URLSearchParams(window.location.search || "");
            return search.get(queryKey) === "1";
        } catch (_err) {
            return false;
        }
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

    function preferredDashboardRow(matcher) {
        var state = studentDashboardState();
        var rows = state && Array.isArray(state.todoRows) ? state.todoRows : [];
        var scopedRows = typeof matcher === "function"
            ? rows.filter(function (row) { return row && matcher(row); })
            : rows.filter(Boolean);
        return scopedRows.find(function (row) {
            return row && row.group && row.stage && row.stage.status === "open";
        }) || scopedRows.find(function (row) {
            return row && row.group;
        }) || scopedRows.find(function (row) {
            return row && row.stage && row.stage.status === "open";
        }) || scopedRows[0] || null;
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

    function preferredDashboardAssignmentId(courseId) {
        var row = preferredDashboardRow(function (item) {
            return item && item.course && item.assignment
                && (!courseId || String(item.course.id) === String(courseId));
        });
        return row && row.assignment ? String(row.assignment.id) : "";
    }

    function preferredDashboardStageId(assignmentId) {
        var row = preferredDashboardRow(function (item) {
            return item && item.assignment && item.stage
                && (!assignmentId || String(item.assignment.id) === String(assignmentId));
        });
        return row && row.stage ? String(row.stage.id) : "";
    }

    function fileTypeIconSvg(ext) {
        var value = String(ext || "").toLowerCase();
        if (value === "pdf") {
            return '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 2.75h5.3L15 6.46V16a1.25 1.25 0 0 1-1.25 1.25h-7.5A1.25 1.25 0 0 1 5 16V4A1.25 1.25 0 0 1 6.25 2.75Z" stroke="currentColor" stroke-width="1.5"/><path d="M11 2.9V6.3h3.4" stroke="currentColor" stroke-width="1.5"/><path d="M7.2 12.9h1.2c.8 0 1.3-.43 1.3-1.12 0-.7-.5-1.13-1.3-1.13H7.2v3.6Zm3.8 0h.97c1.1 0 1.83-.69 1.83-1.8 0-1.12-.73-1.8-1.83-1.8H11v3.6Zm-3.8-1.33h1.02c.34 0 .54-.18.54-.47 0-.28-.2-.46-.54-.46H7.2v.93Zm4.78 0h.18c.45 0 .73-.28.73-.74 0-.45-.28-.73-.73-.73h-.18v1.47Zm2.5 1.33v-3.6H16" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        if (value === "xls" || value === "xlsx" || value === "csv") {
            return '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 2.75h5.3L15 6.46V16a1.25 1.25 0 0 1-1.25 1.25h-7.5A1.25 1.25 0 0 1 5 16V4A1.25 1.25 0 0 1 6.25 2.75Z" stroke="currentColor" stroke-width="1.5"/><path d="M11 2.9V6.3h3.4" stroke="currentColor" stroke-width="1.5"/><path d="m7.35 10.1 1.1 1.42 1.1-1.42m-2.2 3 1.1-1.42 1.1 1.42m1.15-3v3m1.82-3h1.55m-1.55 1.5h1.4m-1.4 1.5h1.55" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        if (value === "doc" || value === "docx") {
            return '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 2.75h5.3L15 6.46V16a1.25 1.25 0 0 1-1.25 1.25h-7.5A1.25 1.25 0 0 1 5 16V4A1.25 1.25 0 0 1 6.25 2.75Z" stroke="currentColor" stroke-width="1.5"/><path d="M11 2.9V6.3h3.4" stroke="currentColor" stroke-width="1.5"/><path d="M7.25 10.1v3h1.06c.96 0 1.59-.6 1.59-1.5 0-.9-.63-1.5-1.6-1.5H7.25Zm3.68 0v3l1-.98 1 .98v-3m1.08 0v3H16" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        return '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 2.75h5.3L15 6.46V16a1.25 1.25 0 0 1-1.25 1.25h-7.5A1.25 1.25 0 0 1 5 16V4A1.25 1.25 0 0 1 6.25 2.75Z" stroke="currentColor" stroke-width="1.5"/><path d="M11 2.9V6.3h3.4" stroke="currentColor" stroke-width="1.5"/><path d="M7.4 10.2h5.2M7.4 12h5.2M7.4 13.8h3.6" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>';
    }

    function teacherCourseMockData() {
        return {
            courses: [
                {
                    id: "mock-teacher-course-01",
                    courseNo: "SE-2026-01",
                    name: "软件工程综合实践",
                    academicYear: 2026,
                    semester: "2",
                    status: "active",
                }
            ],
            assignmentsByCourse: {
                "mock-teacher-course-01": [
                    {
                        id: "mock-teacher-assignment-01",
                        courseId: "mock-teacher-course-01",
                        title: "项目 1：需求分析与原型设计",
                        description: "围绕课程主题完成需求拆解、用户旅程梳理与原型方案设计。",
                        status: "active",
                        descriptionFiles: [
                            { id: "maf-1", originalName: "需求说明模板.docx", size: 82432, uploadedAt: "2026-06-01T10:20:00+08:00" }
                        ]
                    },
                    {
                        id: "mock-teacher-assignment-02",
                        courseId: "mock-teacher-course-01",
                        title: "项目 2：系统实现与联调测试",
                        description: "进入前后端实现阶段，完成接口联调、测试和演示准备。",
                        status: "draft",
                        descriptionFiles: []
                    },
                    {
                        id: "mock-teacher-assignment-03",
                        courseId: "mock-teacher-course-01",
                        title: "项目 3：课程总结与答辩",
                        description: "整理阶段成果，提交课程总结材料并准备结题答辩。",
                        status: "draft",
                        descriptionFiles: []
                    }
                ]
            },
            stagesByAssignment: {
                "mock-teacher-assignment-01": [
                    {
                        id: "mock-teacher-stage-01",
                        assignmentId: "mock-teacher-assignment-01",
                        stageNo: 1,
                        title: "选题确认",
                        description: "确认小组题目、方向与成员分工，完成开题登记。",
                        submissionDesc: "提交选题登记表与分工说明。",
                        acceptCriteria: "选题明确、方向可行、成员职责清晰。",
                        startAt: "2026-06-02T08:00:00+08:00",
                        dueAt: "2026-06-05T23:59:00+08:00",
                        weight: 15,
                        status: "closed",
                        requirementFiles: []
                    },
                    {
                        id: "mock-teacher-stage-02",
                        assignmentId: "mock-teacher-assignment-01",
                        stageNo: 2,
                        title: "需求文档提交",
                        description: "提交需求规格说明与用户流程梳理。",
                        submissionDesc: "上传需求规格说明书、用户流程图和原型初稿。",
                        acceptCriteria: "需求边界清晰，流程闭环完整，可支持后续原型设计。",
                        startAt: "2026-06-06T08:00:00+08:00",
                        dueAt: "2026-06-11T23:59:00+08:00",
                        weight: 30,
                        status: "closed",
                        requirementFiles: []
                    },
                    {
                        id: "mock-teacher-stage-03",
                        assignmentId: "mock-teacher-assignment-01",
                        stageNo: 3,
                        title: "原型评审",
                        description: "按小组展示交互原型，进行课堂评审与修改反馈。",
                        submissionDesc: "提交高保真原型链接、说明文档与评审记录。",
                        acceptCriteria: "原型逻辑自洽、关键流程完整、评审意见可追踪。",
                        startAt: "2026-06-12T08:00:00+08:00",
                        dueAt: "2026-06-18T23:59:00+08:00",
                        weight: 25,
                        status: "open",
                        requirementFiles: [
                            { id: "msf-1", originalName: "原型评审说明.pdf", size: 552960, uploadedAt: "2026-06-12T09:00:00+08:00" },
                            { id: "msf-2", originalName: "评分标准.xlsx", size: 59392, uploadedAt: "2026-06-12T09:05:00+08:00" }
                        ]
                    }
                ],
                "mock-teacher-assignment-02": [
                    {
                        id: "mock-teacher-stage-04",
                        assignmentId: "mock-teacher-assignment-02",
                        stageNo: 1,
                        title: "迭代开发",
                        description: "完成主要模块实现与版本迭代。",
                        submissionDesc: "提交里程碑代码与联调说明。",
                        acceptCriteria: "核心功能完整，版本可运行。",
                        startAt: "2026-06-20T08:00:00+08:00",
                        dueAt: "2026-06-28T23:59:00+08:00",
                        weight: 35,
                        status: "planned",
                        requirementFiles: []
                    },
                    {
                        id: "mock-teacher-stage-05",
                        assignmentId: "mock-teacher-assignment-02",
                        stageNo: 2,
                        title: "联调测试",
                        description: "完成测试用例执行与问题修复。",
                        submissionDesc: "提交测试报告与缺陷清单。",
                        acceptCriteria: "主要问题收敛，测试记录完整。",
                        startAt: "2026-06-29T08:00:00+08:00",
                        dueAt: "2026-07-05T23:59:00+08:00",
                        weight: 35,
                        status: "planned",
                        requirementFiles: []
                    }
                ],
                "mock-teacher-assignment-03": [
                    {
                        id: "mock-teacher-stage-06",
                        assignmentId: "mock-teacher-assignment-03",
                        stageNo: 1,
                        title: "结题汇报",
                        description: "整理课程成果并准备结题展示。",
                        submissionDesc: "提交 PPT、项目总结与归档材料。",
                        acceptCriteria: "成果完整，展示结构清晰。",
                        startAt: "2026-07-06T08:00:00+08:00",
                        dueAt: "2026-07-12T23:59:00+08:00",
                        weight: 20,
                        status: "planned",
                        requirementFiles: []
                    }
                ]
            },
            groupsByAssignment: {
                "mock-teacher-assignment-01": [
                    { id: "mock-group-01", assignmentId: "mock-teacher-assignment-01", groupNo: 1, name: "交互体验组", status: "active", _count: { members: 4 } },
                    { id: "mock-group-02", assignmentId: "mock-teacher-assignment-01", groupNo: 2, name: "数据可视化组", status: "active", _count: { members: 4 } },
                    { id: "mock-group-03", assignmentId: "mock-teacher-assignment-01", groupNo: 3, name: "原型实现组", status: "forming", _count: { members: 3 } },
                    { id: "mock-group-04", assignmentId: "mock-teacher-assignment-01", groupNo: 4, name: "系统分析组", status: "active", _count: { members: 5 } }
                ],
                "mock-teacher-assignment-02": [
                    { id: "mock-group-05", assignmentId: "mock-teacher-assignment-02", groupNo: 1, name: "前后端联调组", status: "forming", _count: { members: 5 } }
                ],
                "mock-teacher-assignment-03": []
            },
            groupMembersByGroup: {
                "mock-group-01": [
                    { userId: "2026010001", user: { profile: { realName: "张三", accountNo: "2026010001", avatarUrl: "" } } },
                    { userId: "2026010002", user: { profile: { realName: "李四", accountNo: "2026010002", avatarUrl: "" } } },
                    { userId: "2026010003", user: { profile: { realName: "王五", accountNo: "2026010003", avatarUrl: "" } } },
                    { userId: "2026010004", user: { profile: { realName: "赵六", accountNo: "2026010004", avatarUrl: "" } } }
                ],
                "mock-group-02": [
                    { userId: "2026010011", user: { profile: { realName: "陈一", accountNo: "2026010011", avatarUrl: "" } } },
                    { userId: "2026010012", user: { profile: { realName: "吴二", accountNo: "2026010012", avatarUrl: "" } } },
                    { userId: "2026010013", user: { profile: { realName: "郑三", accountNo: "2026010013", avatarUrl: "" } } },
                    { userId: "2026010014", user: { profile: { realName: "周四", accountNo: "2026010014", avatarUrl: "" } } }
                ],
                "mock-group-03": [
                    { userId: "2026010021", user: { profile: { realName: "冯五", accountNo: "2026010021", avatarUrl: "" } } },
                    { userId: "2026010022", user: { profile: { realName: "钱六", accountNo: "2026010022", avatarUrl: "" } } },
                    { userId: "2026010023", user: { profile: { realName: "孙七", accountNo: "2026010023", avatarUrl: "" } } }
                ],
                "mock-group-04": [
                    { userId: "2026010031", user: { profile: { realName: "蒋八", accountNo: "2026010031", avatarUrl: "" } } },
                    { userId: "2026010032", user: { profile: { realName: "沈九", accountNo: "2026010032", avatarUrl: "" } } },
                    { userId: "2026010033", user: { profile: { realName: "韩十", accountNo: "2026010033", avatarUrl: "" } } },
                    { userId: "2026010034", user: { profile: { realName: "杨十一", accountNo: "2026010034", avatarUrl: "" } } },
                    { userId: "2026010035", user: { profile: { realName: "朱十二", accountNo: "2026010035", avatarUrl: "" } } }
                ],
                "mock-group-05": [
                    { userId: "2026010041", user: { profile: { realName: "秦十三", accountNo: "2026010041", avatarUrl: "" } } },
                    { userId: "2026010042", user: { profile: { realName: "尤十四", accountNo: "2026010042", avatarUrl: "" } } },
                    { userId: "2026010043", user: { profile: { realName: "许十五", accountNo: "2026010043", avatarUrl: "" } } },
                    { userId: "2026010044", user: { profile: { realName: "何十六", accountNo: "2026010044", avatarUrl: "" } } },
                    { userId: "2026010045", user: { profile: { realName: "吕十七", accountNo: "2026010045", avatarUrl: "" } } }
                ]
            },
            assistantsByCourse: {
                "mock-teacher-course-01": [
                    {
                        assistantUserId: "9477883033",
                        assistant: {
                            id: "9477883033",
                            profile: { realName: "Smoke Assistant", accountNo: "9477883033", avatarUrl: "" }
                        }
                    },
                    {
                        assistantUserId: "9477883044",
                        assistant: {
                            id: "9477883044",
                            profile: { realName: "陈助教", accountNo: "9477883044", avatarUrl: "" }
                        }
                    }
                ]
            },
            ownedAssistants: [
                { assistantUserId: "9477883033", realName: "Smoke Assistant", accountNo: "9477883033" },
                { assistantUserId: "9477883044", realName: "陈助教", accountNo: "9477883044" },
                { assistantUserId: "9477883055", realName: "李助教", accountNo: "9477883055" }
            ]
        };
    }

    function preferredDashboardCourseId() {
        var row = preferredDashboardRow(function (item) {
            return item && item.course && item.assignment;
        });
        return row && row.course ? String(row.course.id) : "";
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

    function removeNavItem(targetId) {
        var node = qs('.side-nav [data-target="' + targetId + '"]');
        if (node && node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }

    function removePanel(id) {
        var node = document.getElementById(id);
        if (node && node.parentNode) {
            node.parentNode.removeChild(node);
        }
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
            var preferredId = preferredDashboardAssignmentId(courseId);
            if (preferredId && Array.from(select.options || []).some(function (option) { return String(option.value) === preferredId; })) {
                select.value = preferredId;
            }
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
            var preferredId = preferredDashboardStageId(assignmentId);
            if (preferredId && Array.from(select.options || []).some(function (option) { return String(option.value) === preferredId; })) {
                select.value = preferredId;
            }
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
        removeNavItem("panel-course-design");
        removeNavItem("panel-group-manage");
        removeNavItem("panel-teacher-settings");
        removePanel("panel-course-design");
        removePanel("panel-group-manage");
        removePanel("panel-teacher-settings");

        addNavItem("panel-course-manage", "课程管理", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16"></path><path d="M4 12h16"></path><path d="M4 17.5h10"></path><path d="M18 16v4"></path><path d="M16 18h4"></path></svg>');
        addPanel("panel-course-manage", card("课程管理", "", [
            '<div class="teacher-course-manage-shell">',
            '<div class="teacher-course-hero">',
            '<div class="teacher-course-hero-copy">',
            '<h3>课程管理</h3>',
            '</div>',
            '<div class="teacher-course-hero-actions">',
            '<div class="teacher-course-hero-topline">',
            '<label class="teacher-course-inline-field teacher-course-inline-field-course"><select id="extTeacherCourseContext" class="dashboard-select"></select></label>',
            '<span id="extTeacherCourseYear" class="teacher-course-hero-pill is-year">-- 学年</span>',
            '<span id="extTeacherCourseSemester" class="teacher-course-hero-pill is-semester">-- 学期</span>',
            '<span id="extTeacherCourseStatus" class="teacher-course-hero-pill is-status">--</span>',
            '<button id="extTeacherCourseRefresh" class="teacher-course-icon-btn" type="button" aria-label="刷新课程管理"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg></button>',
            '</div>',
            '<div class="teacher-course-hero-summary">',
            '<span id="extTeacherProjectCount" class="teacher-course-hero-metric">项目 0</span>',
            '<span id="extTeacherStageCount" class="teacher-course-hero-metric">阶段 0</span>',
            '<span id="extTeacherAssistantCount" class="teacher-course-hero-metric">助教 0</span>',
            '<span id="extTeacherGroupCount" class="teacher-course-hero-metric">小组 0</span>',
            '</div>',
            '<div id="extAssistantResult" class="dashboard-empty-state" hidden></div>',
            '</div>',
            '<div hidden><select id="extAssignCourse"></select><select id="extStageCourse"></select><select id="extStageAssignment"></select><select id="extGroupCourse"></select><select id="extGroupAssignment"></select><select id="extAssistantCourse"></select><input id="extAssistantBindId" /></div>',
            '<div id="extTeacherAssistantDialog" class="teacher-course-dialog-backdrop" hidden><div class="teacher-course-dialog" role="dialog" aria-modal="true" aria-labelledby="extTeacherAssistantDialogTitle"><div class="teacher-course-dialog-head"><div><strong id="extTeacherAssistantDialogTitle">绑定课程助教</strong></div><button id="extTeacherAssistantClose" class="teacher-course-dialog-close" type="button" aria-label="关闭">×</button></div><div class="teacher-course-dialog-body"><label class="teacher-course-inline-field"><span>助教子账号</span><select id="extAssistantOwnedSelect" class="dashboard-select"><option value="">从子账号中选择助教</option></select></label></div><div class="teacher-course-dialog-actions teacher-course-dialog-actions-split"><button id="extAssistantUnbindAll" class="teacher-course-danger-btn" type="button">解除绑定</button><span class="teacher-course-dialog-action-spacer"></span><button id="extTeacherAssistantCancel" class="teacher-course-secondary-btn" type="button">取消</button><button id="extAssistantBind" class="teacher-course-primary-btn" type="button">确认绑定</button></div></div></div>',
            '<div id="extTeacherStageEditorDialog" class="teacher-course-dialog-backdrop" hidden><div class="teacher-course-dialog teacher-course-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="extTeacherStageEditorTitle"><div class="teacher-course-dialog-head"><div><strong id="extTeacherStageEditorTitle">编辑层级</strong></div><button id="extTeacherStageEditorClose" class="teacher-course-dialog-close" type="button" aria-label="关闭">×</button></div><div class="teacher-course-dialog-body teacher-course-edit-dialog-body"><div class="teacher-course-edit-dialog-context"><span id="extTeacherEditCourseMeta">当前课程：--</span><span id="extTeacherEditAssignmentMeta">当前项目：未选择</span><span id="extTeacherEditStageMeta">当前阶段：未选择</span></div><div class="teacher-course-edit-modebar"><span id="extTeacherEditModeBadge" class="teacher-course-edit-mode-badge">课程层级</span><p id="extTeacherEditModeHint" class="teacher-course-edit-mode-hint">当前仅选择课程，可在该课程下新建项目。</p></div><section id="extTeacherAssignmentSection" class="teacher-course-edit-section"><div class="teacher-course-edit-section-head"><strong>项目</strong><span id="extTeacherAssignmentHint">当前可新建项目，或在选中项目后修改标题、说明与状态。</span></div><div class="teacher-course-editor-grid"><label class="user-settings-field"><span>项目标题</span><input id="extAssignTitle" class="dashboard-input" /></label><label class="user-settings-field"><span>项目状态</span><select id="extAssignStatus" class="dashboard-select"><option value="draft">draft</option><option value="active">active</option><option value="archived">archived</option></select></label></div><label class="user-settings-field"><span>项目说明</span><textarea id="extAssignDesc" class="dashboard-textarea"></textarea></label><div class="teacher-course-edit-actions"><button id="extAssignCreate" class="teacher-course-secondary-btn" type="button">新建项目</button><button id="extAssignPatch" class="teacher-course-primary-btn" type="button">保存项目</button></div><div id="extAssignResult" class="dashboard-empty-state" hidden></div></section><section id="extTeacherStageSection" class="teacher-course-edit-section"><div class="teacher-course-edit-section-head"><strong>阶段</strong><span id="extTeacherStageHint">当前选中项目后，可在该项目下新建阶段；选中阶段后，可修改当前阶段。</span></div><div class="teacher-course-editor-grid"><label class="user-settings-field"><span>阶段标题</span><input id="extStageTitle" class="dashboard-input" /></label><label class="user-settings-field"><span>阶段状态</span><select id="extStageStatus" class="dashboard-select"><option value="planned">planned</option><option value="open">open</option><option value="closed">closed</option><option value="archived">archived</option></select></label><label class="user-settings-field"><span>开始时间</span><input id="extStageStart" class="dashboard-input" type="datetime-local" /></label><label class="user-settings-field"><span>截止时间</span><input id="extStageDue" class="dashboard-input" type="datetime-local" /></label><label class="user-settings-field"><span>阶段权重</span><input id="extStageWeight" class="dashboard-input" type="number" min="0" max="100" step="0.1" /></label><label class="user-settings-field"><span>所属项目</span><div id="extStageProjectSummary" class="teacher-course-stage-project-summary"></div></label></div><div class="teacher-course-editor-grid teacher-course-editor-grid-notes"><label class="user-settings-field"><span>阶段说明</span><textarea id="extStageDesc" class="dashboard-textarea"></textarea></label><label class="user-settings-field"><span>提交说明</span><textarea id="extStageSubmission" class="dashboard-textarea"></textarea></label></div><label class="user-settings-field"><span>验收标准</span><textarea id="extStageCriteria" class="dashboard-textarea"></textarea></label><div class="teacher-course-edit-actions"><button id="extStageCreate" class="teacher-course-secondary-btn" type="button">新建阶段</button><button id="extStagePatch" class="teacher-course-primary-btn" type="button">保存阶段</button><button id="extStageArchive" class="teacher-course-danger-btn" type="button">归档阶段</button></div><div id="extStageResult" class="dashboard-empty-state" hidden></div></section></div></div></div>',
            '<div id="extTeacherAssignmentCreateDialog" class="teacher-course-dialog-backdrop" hidden><div class="teacher-course-dialog" role="dialog" aria-modal="true" aria-labelledby="extTeacherAssignmentCreateTitleBar"><div class="teacher-course-dialog-head"><div><strong id="extTeacherAssignmentCreateTitleBar">新建项目</strong></div><button id="extTeacherAssignmentCreateClose" class="teacher-course-dialog-close" type="button" aria-label="关闭">×</button></div><div class="teacher-course-dialog-body"><div class="teacher-course-edit-dialog-context"><span id="extTeacherAssignmentCreateCourseMeta">当前课程：--</span></div><div class="teacher-course-editor-grid"><label class="user-settings-field"><span>项目标题</span><input id="extTeacherAssignmentCreateTitle" class="dashboard-input" /></label><label class="user-settings-field"><span>项目状态</span><select id="extTeacherAssignmentCreateStatus" class="dashboard-select"><option value="draft">draft</option><option value="active">active</option><option value="archived">archived</option></select></label></div><label class="user-settings-field"><span>项目说明</span><textarea id="extTeacherAssignmentCreateDesc" class="dashboard-textarea"></textarea></label><div id="extTeacherAssignmentCreateResult" class="dashboard-empty-state" hidden></div></div><div class="teacher-course-dialog-actions"><button id="extTeacherAssignmentCreateCancel" class="teacher-course-secondary-btn" type="button">取消</button><button id="extTeacherAssignmentCreateSubmit" class="teacher-course-primary-btn" type="button">新建项目</button></div></div></div>',
            '<div id="extTeacherAssignmentManageDialog" class="teacher-course-dialog-backdrop" hidden><div class="teacher-course-dialog teacher-course-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="extTeacherAssignmentManageTitleBar"><div class="teacher-course-dialog-head"><div><strong id="extTeacherAssignmentManageTitleBar">编辑项目</strong></div><button id="extTeacherAssignmentManageClose" class="teacher-course-dialog-close" type="button" aria-label="关闭">×</button></div><div class="teacher-course-dialog-body teacher-course-edit-dialog-body"><div class="teacher-course-edit-dialog-context"><span id="extTeacherAssignmentManageCourseMeta">当前课程：--</span><span id="extTeacherAssignmentManageMeta">当前项目：--</span></div><section class="teacher-course-edit-section"><div class="teacher-course-edit-section-head"><strong>项目信息</strong></div><div class="teacher-course-editor-grid"><label class="user-settings-field"><span>项目标题</span><input id="extTeacherAssignmentManageTitle" class="dashboard-input" /></label><label class="user-settings-field"><span>项目状态</span><select id="extTeacherAssignmentManageStatus" class="dashboard-select"><option value="draft">draft</option><option value="active">active</option><option value="archived">archived</option></select></label></div><label class="user-settings-field"><span>项目说明</span><textarea id="extTeacherAssignmentManageDesc" class="dashboard-textarea"></textarea></label><div class="teacher-course-edit-actions"><button id="extTeacherAssignmentManageSave" class="teacher-course-primary-btn" type="button">保存项目</button><button id="extTeacherAssignmentDelete" class="teacher-course-danger-btn" type="button">删除项目</button></div><div id="extTeacherAssignmentManageResult" class="dashboard-empty-state" hidden></div></section><section class="teacher-course-edit-section"><div class="teacher-course-edit-section-head"><strong>新建阶段</strong></div><div class="teacher-course-editor-grid"><label class="user-settings-field"><span>阶段标题</span><input id="extTeacherAssignmentStageTitle" class="dashboard-input" /></label><label class="user-settings-field"><span>阶段状态</span><select id="extTeacherAssignmentStageStatus" class="dashboard-select"><option value="planned">planned</option><option value="open">open</option><option value="closed">closed</option><option value="archived">archived</option></select></label><label class="user-settings-field"><span>开始时间</span><input id="extTeacherAssignmentStageStart" class="dashboard-input" type="datetime-local" /></label><label class="user-settings-field"><span>截止时间</span><input id="extTeacherAssignmentStageDue" class="dashboard-input" type="datetime-local" /></label><label class="user-settings-field"><span>阶段权重</span><input id="extTeacherAssignmentStageWeight" class="dashboard-input" type="number" min="0" max="100" step="0.1" /></label></div><div class="teacher-course-editor-grid teacher-course-editor-grid-notes"><label class="user-settings-field"><span>阶段说明</span><textarea id="extTeacherAssignmentStageDesc" class="dashboard-textarea"></textarea></label><label class="user-settings-field"><span>提交说明</span><textarea id="extTeacherAssignmentStageSubmission" class="dashboard-textarea"></textarea></label></div><label class="user-settings-field"><span>验收标准</span><textarea id="extTeacherAssignmentStageCriteria" class="dashboard-textarea"></textarea></label><div class="teacher-course-edit-actions"><button id="extTeacherAssignmentStageCreate" class="teacher-course-secondary-btn" type="button">新建阶段</button></div><div id="extTeacherAssignmentStageResult" class="dashboard-empty-state" hidden></div></section></div><div class="teacher-course-dialog-actions"><button id="extTeacherAssignmentManageCancel" class="teacher-course-secondary-btn" type="button">关闭</button></div></div></div>',
            '<div id="extTeacherStageManageDialog" class="teacher-course-dialog-backdrop" hidden><div class="teacher-course-dialog teacher-course-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="extTeacherStageManageTitleBar"><div class="teacher-course-dialog-head"><div><strong id="extTeacherStageManageTitleBar">编辑阶段</strong></div><button id="extTeacherStageManageClose" class="teacher-course-dialog-close" type="button" aria-label="关闭">×</button></div><div class="teacher-course-dialog-body teacher-course-edit-dialog-body"><div class="teacher-course-edit-dialog-context"><span id="extTeacherStageManageCourseMeta">当前课程：--</span><span id="extTeacherStageManageAssignmentMeta">当前项目：--</span><span id="extTeacherStageManageMeta">当前阶段：--</span></div><section class="teacher-course-edit-section"><div class="teacher-course-edit-section-head"><strong>阶段信息</strong></div><div class="teacher-course-editor-grid"><label class="user-settings-field"><span>阶段标题</span><input id="extTeacherStageManageTitle" class="dashboard-input" /></label><label class="user-settings-field"><span>阶段状态</span><select id="extTeacherStageManageStatus" class="dashboard-select"><option value="planned">planned</option><option value="open">open</option><option value="closed">closed</option><option value="archived">archived</option></select></label><label class="user-settings-field"><span>开始时间</span><input id="extTeacherStageManageStart" class="dashboard-input" type="datetime-local" /></label><label class="user-settings-field"><span>截止时间</span><input id="extTeacherStageManageDue" class="dashboard-input" type="datetime-local" /></label><label class="user-settings-field"><span>阶段权重</span><input id="extTeacherStageManageWeight" class="dashboard-input" type="number" min="0" max="100" step="0.1" /></label></div><div class="teacher-course-editor-grid teacher-course-editor-grid-notes"><label class="user-settings-field"><span>阶段说明</span><textarea id="extTeacherStageManageDesc" class="dashboard-textarea"></textarea></label><label class="user-settings-field"><span>提交说明</span><textarea id="extTeacherStageManageSubmission" class="dashboard-textarea"></textarea></label></div><label class="user-settings-field"><span>验收标准</span><textarea id="extTeacherStageManageCriteria" class="dashboard-textarea"></textarea></label><div class="teacher-course-edit-actions"><button id="extTeacherStageManageSave" class="teacher-course-primary-btn" type="button">保存阶段</button><button id="extTeacherStageDelete" class="teacher-course-danger-btn" type="button">归档阶段</button></div><div id="extTeacherStageManageResult" class="dashboard-empty-state" hidden></div></section></div><div class="teacher-course-dialog-actions"><button id="extTeacherStageManageCancel" class="teacher-course-secondary-btn" type="button">关闭</button></div></div></div>',
            '<div id="extTeacherGroupEditorDialog" class="teacher-course-dialog-backdrop" hidden><div class="teacher-course-dialog teacher-course-dialog-wide teacher-course-group-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="extTeacherGroupEditorTitle"><div class="teacher-course-dialog-head"><div><strong id="extTeacherGroupEditorTitle">小组编辑</strong></div><button id="extTeacherGroupEditorClose" class="teacher-course-dialog-close" type="button" aria-label="关闭">×</button></div><div class="teacher-course-dialog-body teacher-course-group-editor-body"><div class="teacher-course-edit-dialog-context"><span id="extTeacherGroupEditorCourseMeta">当前课程：--</span><span id="extTeacherGroupEditorAssignmentMeta">当前项目：未选择</span><span id="extTeacherGroupEditorSelectionMeta">当前小组：未选择</span></div><div class="teacher-course-group-editor-grid"><section class="teacher-course-group-editor-panel"><div class="teacher-course-edit-section-head"><strong>分组操作</strong></div><div class="teacher-course-group-editor-toolbar teacher-course-group-editor-toolbar-top"><label class="user-settings-field"><span>小组名称</span><input id="extTeacherGroupCreateName" class="dashboard-input" /></label><label class="user-settings-field"><span>小组号</span><input id="extTeacherGroupCreateNo" class="dashboard-input" type="number" /></label><div class="teacher-course-group-editor-toolbar-icons"><button id="extTeacherGroupCreate" class="teacher-course-group-icon-action teacher-course-group-toolbar-icon" type="button" aria-label="新建小组" title="新建小组"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4.2v11.6M4.2 10h11.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button id="extTeacherGroupEditorRefresh" class="teacher-course-group-icon-action teacher-course-group-toolbar-icon" type="button" aria-label="刷新数据" title="刷新数据"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.8 8.2A6.1 6.1 0 0 0 5.4 6.6M4.2 4.7v2.9h2.9M4.2 11.8A6.1 6.1 0 0 0 14.6 13.4m1.2 2v-2.9h-2.9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div><div class="teacher-course-group-editor-toolbar teacher-course-group-editor-toolbar-bottom"><label class="user-settings-field"><span>自动分组人数</span><input id="extTeacherGroupAutoSize" class="dashboard-input" type="number" min="2" max="10" value="4" /></label><div class="teacher-course-group-editor-toolbar-actions"><button id="extTeacherGroupAutoCreate" class="teacher-course-primary-btn" type="button">一键分组</button></div></div><div class="teacher-course-group-editor-subhead"><strong>未分组学生</strong><span id="extTeacherUngroupedMeta">0 人</span></div><div id="extTeacherUngroupedList" class="teacher-course-group-editor-ungrouped-list"></div></section><section class="teacher-course-group-editor-panel"><div class="teacher-course-edit-section-head"><strong>小组详情</strong></div><div class="teacher-course-group-editor-selectrow"><select id="extTeacherManagedGroupSelect" class="dashboard-select" aria-label="选择当前小组"></select><div class="teacher-course-group-editor-inline-actions"><button id="extTeacherGroupActivate" class="teacher-course-group-icon-action" type="button" aria-label="确认成组" title="确认成组"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.8 10.4 8.3 13.9 15.2 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button id="extTeacherGroupDelete" class="teacher-course-group-icon-action is-danger" type="button" aria-label="删除" title="删除"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.9 6.2h8.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 6.2V4.9c0-.5.4-.9.9-.9h2.2c.5 0 .9.4.9.9v1.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 8.2v5.2M10 8.2v5.2M13 8.2v5.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.6 6.2h6.8v8.1c0 .9-.7 1.6-1.6 1.6H8.2c-.9 0-1.6-.7-1.6-1.6V6.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button></div></div><div id="extTeacherManagedGroupMembers" class="teacher-course-group-editor-member-list"></div><div class="teacher-course-group-editor-member-actions"><label class="user-settings-field"><span>添加成员</span><div class="teacher-course-group-add-inline"><input id="extTeacherGroupMemberAddInput" class="dashboard-input" maxlength="10" placeholder="输入学生一卡通号" /><button id="extTeacherGroupMemberAdd" class="teacher-course-group-icon-action teacher-course-group-submit-arrow" type="button" aria-label="添加到当前小组" title="添加到当前小组"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 10h10.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="m10.8 5.8 4.2 4.2-4.2 4.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></label></div></section></div><div id="extTeacherGroupEditorResult" class="dashboard-empty-state" hidden></div></div><div class="teacher-course-dialog-actions"><button id="extTeacherGroupEditorCancel" class="teacher-course-secondary-btn" type="button">关闭</button></div></div></div>',
            '<div id="extTeacherGroupMoveDialog" class="teacher-course-dialog-backdrop" hidden><div class="teacher-course-dialog teacher-course-group-move-dialog" role="dialog" aria-modal="true" aria-labelledby="extTeacherGroupMoveTitle"><div class="teacher-course-dialog-head"><div><strong id="extTeacherGroupMoveTitle">更换小组</strong></div><button id="extTeacherGroupMoveClose" class="teacher-course-dialog-close" type="button" aria-label="关闭">×</button></div><div class="teacher-course-dialog-body"><div class="teacher-course-edit-dialog-context"><span id="extTeacherGroupMoveMemberMeta">成员：--</span><span id="extTeacherGroupMoveSourceMeta">当前小组：--</span></div><label class="user-settings-field"><span>目标小组</span><select id="extTeacherGroupMoveTarget" class="dashboard-select"></select></label><div id="extTeacherGroupMoveResult" class="dashboard-empty-state" hidden></div></div><div class="teacher-course-dialog-actions"><button id="extTeacherGroupMoveCancel" class="teacher-course-secondary-btn" type="button">取消</button><button id="extTeacherGroupMoveConfirm" class="teacher-course-primary-btn" type="button">确认换组</button></div></div></div>',
            '</div>',
            '<div class="teacher-course-workspace">',
            '<aside class="teacher-course-structure">',
            '<div class="teacher-course-panel-head"><strong>课程结构</strong><span id="extTeacherStructureMeta" class="teacher-course-panel-meta">请选择课程</span></div>',
            '<div id="extTeacherCourseTree" class="teacher-course-structure-tree"></div>',
            '<div class="teacher-course-structure-footer"><button id="extTeacherAssignmentCreateOpen" class="teacher-course-tree-create-btn" type="button" aria-label="新建项目" title="新建项目"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4.2v11.6M4.2 10h11.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button></div>',
            '</aside>',
            '<section class="teacher-course-detail">',
            '<div class="teacher-course-detail-topline">',
            '<div id="extTeacherStagePath" class="teacher-course-stage-path">请选择左侧项目与阶段</div>',
            '</div>',
            '<div class="teacher-course-stage-summary">',
            '<div class="teacher-course-stage-summary-grid">',
            '<div class="teacher-course-stage-summary-item"><span>截止时间</span><strong id="extTeacherStageDeadline">--</strong></div>',
            '<div class="teacher-course-stage-summary-item"><span>当前状态</span><strong id="extTeacherStageState">--</strong></div>',
            '<div class="teacher-course-stage-summary-item"><span>已提交小组数</span><strong id="extTeacherStageGroupProgress">0 / 0</strong></div>',
            '<div class="teacher-course-stage-summary-item teacher-course-stage-summary-item-assistant"><span>负责助教</span><div class="teacher-course-stage-summary-inline"><strong id="extTeacherAssistantSummary">暂未配置</strong><button id="extTeacherAssistantOpen" class="teacher-course-inline-icon" type="button" aria-label="配置课程助教"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .72 1.7 1.7 0 0 0-.28 1v.18a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.72-1 1.7 1.7 0 0 0-1-.28H2.7a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.72 1.7 1.7 0 0 0 .28-1V2.7a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.32.28.57.63.72 1 .12.31.18.64.18 1h.18a2 2 0 1 1 0 4h-.1A1.7 1.7 0 0 0 19.4 15z"></path></svg></button></div></div>',
            '</div>',
            '<div class="teacher-course-stage-summary-actions">',
            '<button id="extTeacherStageEditToggle" class="teacher-course-primary-btn" type="button">编辑项目</button>',
            '</div>',
            '</div>',
            '<div hidden><select id="extAssignSelect"><option value="">新建项目</option></select><select id="extStageSelect"><option value="">新建阶段</option></select></div>',
            '<section class="teacher-course-section">',
            '<div class="teacher-course-subsection-head"><strong>小组阅览</strong><span id="extTeacherGroupMeta">当前项目全部小组</span><button id="extTeacherGroupEditorOpen" class="teacher-course-ghost-btn" type="button">编辑小组</button></div>',
            '<div class="teacher-course-group-table-wrap">',
            '<div class="teacher-course-group-table-head"><span>组号</span><span>小组名称</span><span>成员概览</span><span>人数</span><span>提交状态</span><span>操作</span></div>',
            '<div id="extGroupList" class="teacher-course-group-table-body"></div>',
            '</div>',
            '</section>',
            '<section class="teacher-course-section teacher-course-section-bottom">',
            '<div class="teacher-course-subsection-head teacher-course-subsection-head-materials"><strong>阶段说明 / 附件</strong><button id="extTeacherAttachmentUpload" class="teacher-course-ghost-btn teacher-course-upload-btn" type="button">上传附件</button></div>',
            '<div class="teacher-course-bottom-grid teacher-course-bottom-grid-materials">',
            '<div class="teacher-course-stage-note-card teacher-course-stage-note-card-materials">',
            '<div class="teacher-course-material-panel-head"><strong>阶段说明</strong></div>',
            '<div class="teacher-course-material-note"><span>说明内容</span><p id="extTeacherStageDescription">当前阶段暂无说明。</p></div>',
            '<div class="teacher-course-material-meta-list">',
            '<div class="teacher-course-material-meta-item"><span>提交说明</span><p id="extTeacherStageSubmission">当前阶段暂无提交要求。</p></div>',
            '<div class="teacher-course-material-meta-item"><span>验收标准</span><p id="extTeacherStageCriteriaView">当前阶段暂无验收标准。</p></div>',
            '</div>',
            '</div>',
            '<div class="teacher-course-file-card teacher-course-file-card-materials">',
            '<div class="teacher-course-material-panel-head"><strong>附件</strong></div>',
            '<div class="teacher-course-attachment-head"><span>附件名称</span><span>大小</span><span>时间</span></div>',
            '<div id="extTeacherAttachmentList" class="teacher-course-attachment-list"></div>',
            '<input id="extAssignFiles" class="teacher-course-file-input" type="file" multiple />',
            '<input id="extStageFiles" class="teacher-course-file-input" type="file" multiple />',
            '</div>',
            '</div>',
            '</div>',
            '</div>',
        ].join("")));

        bindTeacherTools();
    }

    function bindTeacherTools() {
        var courseContext = qs("#extTeacherCourseContext");
        var courseRefresh = qs("#extTeacherCourseRefresh");
        var assignCourse = qs("#extAssignCourse");
        var assignSelect = qs("#extAssignSelect");
        var assignResult = qs("#extAssignResult");
        var stageCourse = qs("#extStageCourse");
        var stageAssignment = qs("#extStageAssignment");
        var stageSelect = qs("#extStageSelect");
        var stageSelectMirror = qs("#extStageSelectMirror");
        var stageResult = qs("#extStageResult");
        var groupCourse = qs("#extGroupCourse");
        var groupAssignment = qs("#extGroupAssignment");
        var groupResult = qs("#extTeacherGroupEditorResult");
        var assistantCourse = qs("#extAssistantCourse");
        var assistantResult = qs("#extAssistantResult");
        var assistantOwnedSelect = qs("#extAssistantOwnedSelect");
        var stageProjectSummary = qs("#extStageProjectSummary");
        var assistantDialog = qs("#extTeacherAssistantDialog");
        var stageEditorDialog = qs("#extTeacherStageEditorDialog");
        var assignmentCreateDialog = qs("#extTeacherAssignmentCreateDialog");
        var assignmentManageDialog = qs("#extTeacherAssignmentManageDialog");
        var stageManageDialog = qs("#extTeacherStageManageDialog");
        var groupEditorDialog = qs("#extTeacherGroupEditorDialog");
        var groupMoveDialog = qs("#extTeacherGroupMoveDialog");
        var teacherMock = teacherCourseMockData();
        var teacherMockAllowed = allowExplicitMock("teacherCourseMock");
        var teacherToolState = {
            courses: [],
            assignments: [],
            stages: [],
            groups: [],
            assistants: [],
            ownedAssistants: [],
            courseMembers: [],
            groupMembers: {},
            groupStageSubmissions: {},
            mockMode: teacherMockAllowed,
            collapsedAssignments: {},
            selectedGroupId: "",
            pendingMoveUserId: "",
            editTarget: "assignment",
        };

        function teacherErrorMessage(err, fallbackText) {
            if (err && err.message) return err.message;
            return fallbackText || "真实接口请求失败";
        }

        function reportTeacherLoadError(err, title) {
            setResult(assistantResult || groupResult || stageResult || assignResult, title || "加载失败", teacherErrorMessage(err, "真实链路加载失败"), true);
        }

        function mockCourseRows() {
            return (teacherMock.courses || []).slice();
        }

        function mockAssignmentRows(courseId) {
            return ((teacherMock.assignmentsByCourse && teacherMock.assignmentsByCourse[String(courseId)]) || []).slice();
        }

        function mockStageRows(assignmentId) {
            return ((teacherMock.stagesByAssignment && teacherMock.stagesByAssignment[String(assignmentId)]) || []).slice();
        }

        function ensureMockAssignmentsForCourse(courseId) {
            if (!teacherMock.assignmentsByCourse) teacherMock.assignmentsByCourse = {};
            if (!teacherMock.assignmentsByCourse[String(courseId)]) {
                teacherMock.assignmentsByCourse[String(courseId)] = [];
            }
            return teacherMock.assignmentsByCourse[String(courseId)];
        }

        function ensureMockStagesForAssignment(assignmentId) {
            if (!teacherMock.stagesByAssignment) teacherMock.stagesByAssignment = {};
            if (!teacherMock.stagesByAssignment[String(assignmentId)]) {
                teacherMock.stagesByAssignment[String(assignmentId)] = [];
            }
            return teacherMock.stagesByAssignment[String(assignmentId)];
        }

        function findMockAssignment(assignmentId) {
            var found = null;
            Object.keys(teacherMock.assignmentsByCourse || {}).some(function (courseId) {
                var rows = teacherMock.assignmentsByCourse[String(courseId)] || [];
                var match = rows.find(function (row) {
                    return String(row.id) === String(assignmentId);
                }) || null;
                if (match) {
                    found = { assignment: match, courseId: courseId, rows: rows };
                    return true;
                }
                return false;
            });
            return found;
        }

        function findMockStage(stageId) {
            var found = null;
            Object.keys(teacherMock.stagesByAssignment || {}).some(function (assignmentId) {
                var rows = teacherMock.stagesByAssignment[String(assignmentId)] || [];
                var match = rows.find(function (row) {
                    return String(row.id) === String(stageId);
                }) || null;
                if (match) {
                    found = { stage: match, assignmentId: assignmentId, rows: rows };
                    return true;
                }
                return false;
            });
            return found;
        }

        function mockCreateAssignment(courseId, body) {
            if (!courseId) return mockError("请先选择课程。");
            var rows = ensureMockAssignmentsForCourse(courseId);
            var title = String(body && body.title || "").trim();
            if (!title) return mockError("项目标题不能为空。");
            var assignment = {
                id: "mock-teacher-assignment-" + Date.now(),
                courseId: String(courseId),
                title: title,
                description: body && body.description != null ? body.description : null,
                status: body && body.status ? body.status : "draft",
                descriptionFiles: []
            };
            rows.unshift(assignment);
            ensureMockStagesForAssignment(assignment.id);
            return Promise.resolve({ ok: true, data: assignment });
        }

        function mockPatchAssignment(assignmentId, body) {
            var found = findMockAssignment(assignmentId);
            if (!found || !found.assignment) return mockError("未找到当前项目。");
            if (body && body.title !== undefined) {
                var title = String(body.title || "").trim();
                if (!title) return mockError("项目标题不能为空。");
                found.assignment.title = title;
            }
            if (body && body.description !== undefined) found.assignment.description = body.description;
            if (body && body.status !== undefined) found.assignment.status = body.status;
            return Promise.resolve({ ok: true, data: found.assignment });
        }

        function mockDeleteAssignment(assignmentId) {
            var found = findMockAssignment(assignmentId);
            if (!found || !found.assignment) return mockError("未找到当前项目。");
            if (String(found.assignment.status || "") !== "draft") {
                return mockError("只有 draft 项目才可以删除。");
            }
            if (ensureMockStagesForAssignment(assignmentId).length > 0) {
                return mockError("当前项目下还有阶段，不能删除。");
            }
            if (mockGroupRows(assignmentId).length > 0) {
                return mockError("当前项目下还有小组，不能删除。");
            }
            var index = found.rows.findIndex(function (row) {
                return String(row.id) === String(assignmentId);
            });
            if (index >= 0) found.rows.splice(index, 1);
            delete teacherMock.stagesByAssignment[String(assignmentId)];
            delete teacherMock.groupsByAssignment[String(assignmentId)];
            return Promise.resolve({ ok: true });
        }

        function mockCreateStage(assignmentId, body) {
            if (!assignmentId) return mockError("请先选择项目。");
            var rows = ensureMockStagesForAssignment(assignmentId);
            var title = String(body && body.title || "").trim();
            if (!title) return mockError("阶段标题不能为空。");
            if (!body || !body.dueAt) return mockError("截止时间不能为空。");
            var nextStageNo = rows.reduce(function (max, row) {
                return Math.max(max, Number(row.stageNo || 0));
            }, 0) + 1;
            var stage = {
                id: "mock-teacher-stage-" + Date.now(),
                assignmentId: String(assignmentId),
                stageNo: nextStageNo,
                title: title,
                description: body.description != null ? body.description : null,
                startAt: body.startAt || null,
                dueAt: body.dueAt,
                weight: body.weight != null ? body.weight : null,
                submissionDesc: body.submissionDesc != null ? body.submissionDesc : null,
                acceptCriteria: body.acceptCriteria != null ? body.acceptCriteria : null,
                status: body.status || "planned",
                requirementFiles: []
            };
            rows.push(stage);
            return Promise.resolve({ ok: true, data: stage });
        }

        function mockPatchStage(stageId, body) {
            var found = findMockStage(stageId);
            if (!found || !found.stage) return mockError("未找到当前阶段。");
            Object.keys(body || {}).forEach(function (key) {
                if (body[key] !== undefined) found.stage[key] = body[key];
            });
            return Promise.resolve({ ok: true, data: found.stage });
        }

        function mockArchiveStage(stageId) {
            var found = findMockStage(stageId);
            if (!found || !found.stage) return mockError("未找到当前阶段。");
            found.stage.status = "archived";
            return Promise.resolve({ ok: true });
        }

        function mockGroupRows(assignmentId) {
            return ((teacherMock.groupsByAssignment && teacherMock.groupsByAssignment[String(assignmentId)]) || []).slice();
        }

        function mockGroupMemberRows(groupId) {
            return ((teacherMock.groupMembersByGroup && teacherMock.groupMembersByGroup[String(groupId)]) || []).slice();
        }

        function ensureMockAssignmentGroups(assignmentId) {
            if (!teacherMock.groupsByAssignment) teacherMock.groupsByAssignment = {};
            if (!teacherMock.groupsByAssignment[String(assignmentId)]) {
                teacherMock.groupsByAssignment[String(assignmentId)] = [];
            }
            return teacherMock.groupsByAssignment[String(assignmentId)];
        }

        function ensureMockGroupMembers(groupId) {
            if (!teacherMock.groupMembersByGroup) teacherMock.groupMembersByGroup = {};
            if (!teacherMock.groupMembersByGroup[String(groupId)]) {
                teacherMock.groupMembersByGroup[String(groupId)] = [];
            }
            return teacherMock.groupMembersByGroup[String(groupId)];
        }

        function syncMockGroupMemberCount(groupId) {
            var assignmentId = String(groupAssignment && groupAssignment.value || "");
            var groups = ensureMockAssignmentGroups(assignmentId);
            var group = groups.find(function (row) {
                return String(row.id) === String(groupId);
            });
            if (group) {
                group._count = group._count || {};
                group._count.members = ensureMockGroupMembers(groupId).length;
            }
        }

        function findMockCourseMemberByAccount(accountNo) {
            return mockCourseMemberRows(courseContext && courseContext.value).find(function (row) {
                return String(courseMemberAccountNo(row)) === String(accountNo);
            }) || null;
        }

        function mockGroupMemberFromCourseRow(row, role) {
            var accountNo = courseMemberAccountNo(row);
            return {
                userId: accountNo,
                role: role || "member",
                user: {
                    id: courseMemberUserId(row) || accountNo,
                    profile: {
                        realName: courseMemberRealName(row),
                        accountNo: accountNo,
                        avatarUrl: row && row.user && row.user.profile && row.user.profile.avatarUrl || ""
                    },
                    studentProfile: row && row.user && row.user.studentProfile ? row.user.studentProfile : { stuNo: accountNo }
                }
            };
        }

        function mockError(message) {
            return Promise.reject(new Error(message));
        }

        function mockCreateGroup(body) {
            var assignmentId = String(groupAssignment && groupAssignment.value || "");
            if (!assignmentId) return mockError("请先选择项目。");
            var groups = ensureMockAssignmentGroups(assignmentId);
            var nextNo = body && body.groupNo ? Number(body.groupNo) : groups.reduce(function (max, row) {
                return Math.max(max, Number(row.groupNo || 0));
            }, 0) + 1;
            if (groups.some(function (row) { return Number(row.groupNo) === Number(nextNo); })) {
                return mockError("组号已存在。");
            }
            var createdId = "mock-group-" + Date.now();
            var group = {
                id: createdId,
                assignmentId: assignmentId,
                groupNo: nextNo,
                name: body && body.name ? body.name : ("第 " + nextNo + " 组"),
                status: "forming",
                _count: { members: 0 }
            };
            groups.push(group);
            ensureMockGroupMembers(createdId);
            return Promise.resolve({ ok: true, data: { id: createdId } });
        }

        function mockAutoGroup(groupSize) {
            var assignmentId = String(groupAssignment && groupAssignment.value || "");
            if (!assignmentId) return mockError("请先选择项目。");
            var size = Number(groupSize || 0);
            if (!Number.isInteger(size) || size < 2) return mockError("自动分组人数至少为 2。");
            var groups = ensureMockAssignmentGroups(assignmentId);
            var ungroupedRows = ungroupedCourseMembers();
            if (!ungroupedRows.length) {
                return Promise.resolve({ ok: true, data: { assignmentId: assignmentId, createdGroups: 0, groupedStudents: 0, groupSize: size } });
            }
            var nextNo = groups.reduce(function (max, row) {
                return Math.max(max, Number(row.groupNo || 0));
            }, 0) + 1;
            var createdGroups = 0;
            var groupedStudents = 0;
            for (var index = 0; index < ungroupedRows.length; index += size) {
                var chunk = ungroupedRows.slice(index, index + size);
                var groupId = "mock-group-" + Date.now() + "-" + createdGroups;
                var groupNo = nextNo++;
                groups.push({
                    id: groupId,
                    assignmentId: assignmentId,
                    groupNo: groupNo,
                    name: "第 " + groupNo + " 组",
                    status: "forming",
                    _count: { members: chunk.length }
                });
                teacherMock.groupMembersByGroup[String(groupId)] = chunk.map(function (row, rowIndex) {
                    return mockGroupMemberFromCourseRow(row, rowIndex === 0 ? "leader" : "member");
                });
                createdGroups += 1;
                groupedStudents += chunk.length;
            }
            return Promise.resolve({ ok: true, data: { assignmentId: assignmentId, createdGroups: createdGroups, groupedStudents: groupedStudents, groupSize: size } });
        }

        function mockActivateGroup(groupId) {
            var assignmentId = String(groupAssignment && groupAssignment.value || "");
            var group = ensureMockAssignmentGroups(assignmentId).find(function (row) {
                return String(row.id) === String(groupId);
            });
            if (!group) return mockError("未找到当前小组。");
            group.status = "active";
            return Promise.resolve({ ok: true, data: group });
        }

        function mockDeleteGroup(groupId) {
            var assignmentId = String(groupAssignment && groupAssignment.value || "");
            var groups = ensureMockAssignmentGroups(assignmentId);
            var index = groups.findIndex(function (row) {
                return String(row.id) === String(groupId);
            });
            if (index < 0) return mockError("未找到当前小组。");
            if (ensureMockGroupMembers(groupId).length > 0) {
                return mockError("当前小组仍有成员，必须先清空后才可以删除。");
            }
            groups.splice(index, 1);
            delete teacherMock.groupMembersByGroup[String(groupId)];
            return Promise.resolve({ ok: true });
        }

        function mockAddGroupMember(groupId, userId) {
            var assignmentId = String(groupAssignment && groupAssignment.value || "");
            var groups = ensureMockAssignmentGroups(assignmentId);
            var group = groups.find(function (row) {
                return String(row.id) === String(groupId);
            });
            if (!group) return mockError("未找到当前小组。");
            var row = findMockCourseMemberByAccount(userId);
            if (!row) return mockError("未找到该学生。");
            if (groups.some(function (otherGroup) {
                return String(otherGroup.id) !== String(groupId) && ensureMockGroupMembers(otherGroup.id).some(function (member) {
                    return String(memberAccountNo(member)) === String(userId);
                });
            })) {
                return mockError("该学生已经在当前项目的其他小组中。");
            }
            ensureMockGroupMembers(groupId).push(mockGroupMemberFromCourseRow(row, ensureMockGroupMembers(groupId).length ? "member" : "leader"));
            syncMockGroupMemberCount(groupId);
            return Promise.resolve({ ok: true });
        }

        function mockRemoveGroupMember(groupId, userId) {
            var members = ensureMockGroupMembers(groupId);
            var index = members.findIndex(function (row) {
                return String(memberAccountNo(row)) === String(userId);
            });
            if (index < 0) return mockError("未找到该成员。");
            members.splice(index, 1);
            if (members.length && !members.some(function (row) { return row.role === "leader"; })) {
                members[0].role = "leader";
            }
            syncMockGroupMemberCount(groupId);
            return Promise.resolve({ ok: true });
        }

        function mockMoveGroupMember(groupId, userId, targetGroupId) {
            if (!targetGroupId) return mockError("请选择目标小组。");
            var sourceMembers = ensureMockGroupMembers(groupId);
            var index = sourceMembers.findIndex(function (row) {
                return String(memberAccountNo(row)) === String(userId);
            });
            if (index < 0) return mockError("未找到该成员。");
            var moved = sourceMembers.splice(index, 1)[0];
            moved.role = "member";
            if (sourceMembers.length && !sourceMembers.some(function (row) { return row.role === "leader"; })) {
                sourceMembers[0].role = "leader";
            }
            var targetMembers = ensureMockGroupMembers(targetGroupId);
            if (!targetMembers.length) moved.role = "leader";
            targetMembers.push(moved);
            syncMockGroupMemberCount(groupId);
            syncMockGroupMemberCount(targetGroupId);
            return Promise.resolve({ ok: true });
        }

        function mockAssistantRows(courseId) {
            return ((teacherMock.assistantsByCourse && teacherMock.assistantsByCourse[String(courseId)]) || []).slice();
        }

        function mockCourseMemberRows(courseId) {
            var rows = ((teacherMock.courseMembersByCourse && teacherMock.courseMembersByCourse[String(courseId)]) || []).slice();
            if (rows.length) return rows;
            if (String(courseId) !== "mock-teacher-course-01") return [];
            return [
                { user: { id: "2026010001", profile: { realName: "张三", accountNo: "2026010001", avatarUrl: "" }, studentProfile: { stuNo: "2026010001" } } },
                { user: { id: "2026010002", profile: { realName: "李四", accountNo: "2026010002", avatarUrl: "" }, studentProfile: { stuNo: "2026010002" } } },
                { user: { id: "2026010003", profile: { realName: "王五", accountNo: "2026010003", avatarUrl: "" }, studentProfile: { stuNo: "2026010003" } } },
                { user: { id: "2026010004", profile: { realName: "赵六", accountNo: "2026010004", avatarUrl: "" }, studentProfile: { stuNo: "2026010004" } } },
                { user: { id: "2026010011", profile: { realName: "陈一", accountNo: "2026010011", avatarUrl: "" }, studentProfile: { stuNo: "2026010011" } } },
                { user: { id: "2026010012", profile: { realName: "吴二", accountNo: "2026010012", avatarUrl: "" }, studentProfile: { stuNo: "2026010012" } } },
                { user: { id: "2026010013", profile: { realName: "郑三", accountNo: "2026010013", avatarUrl: "" }, studentProfile: { stuNo: "2026010013" } } },
                { user: { id: "2026010014", profile: { realName: "周四", accountNo: "2026010014", avatarUrl: "" }, studentProfile: { stuNo: "2026010014" } } },
                { user: { id: "2026010021", profile: { realName: "冯五", accountNo: "2026010021", avatarUrl: "" }, studentProfile: { stuNo: "2026010021" } } },
                { user: { id: "2026010022", profile: { realName: "钱六", accountNo: "2026010022", avatarUrl: "" }, studentProfile: { stuNo: "2026010022" } } },
                { user: { id: "2026010023", profile: { realName: "孙七", accountNo: "2026010023", avatarUrl: "" }, studentProfile: { stuNo: "2026010023" } } },
                { user: { id: "2026010031", profile: { realName: "蒋八", accountNo: "2026010031", avatarUrl: "" }, studentProfile: { stuNo: "2026010031" } } },
                { user: { id: "2026010032", profile: { realName: "沈九", accountNo: "2026010032", avatarUrl: "" }, studentProfile: { stuNo: "2026010032" } } },
                { user: { id: "2026010033", profile: { realName: "韩十", accountNo: "2026010033", avatarUrl: "" }, studentProfile: { stuNo: "2026010033" } } },
                { user: { id: "2026010034", profile: { realName: "杨十一", accountNo: "2026010034", avatarUrl: "" }, studentProfile: { stuNo: "2026010034" } } },
                { user: { id: "2026010035", profile: { realName: "朱十二", accountNo: "2026010035", avatarUrl: "" }, studentProfile: { stuNo: "2026010035" } } },
                { user: { id: "2026010041", profile: { realName: "秦十三", accountNo: "2026010041", avatarUrl: "" }, studentProfile: { stuNo: "2026010041" } } },
                { user: { id: "2026010042", profile: { realName: "尤十四", accountNo: "2026010042", avatarUrl: "" }, studentProfile: { stuNo: "2026010042" } } },
                { user: { id: "2026010043", profile: { realName: "许十五", accountNo: "2026010043", avatarUrl: "" }, studentProfile: { stuNo: "2026010043" } } },
                { user: { id: "2026010044", profile: { realName: "何十六", accountNo: "2026010044", avatarUrl: "" }, studentProfile: { stuNo: "2026010044" } } },
                { user: { id: "2026010045", profile: { realName: "吕十七", accountNo: "2026010045", avatarUrl: "" }, studentProfile: { stuNo: "2026010045" } } },
                { user: { id: "2026010051", profile: { realName: "罗十八", accountNo: "2026010051", avatarUrl: "" }, studentProfile: { stuNo: "2026010051" } } },
                { user: { id: "2026010052", profile: { realName: "魏十九", accountNo: "2026010052", avatarUrl: "" }, studentProfile: { stuNo: "2026010052" } } },
                { user: { id: "2026010053", profile: { realName: "陶二十", accountNo: "2026010053", avatarUrl: "" }, studentProfile: { stuNo: "2026010053" } } }
            ];
        }

        function selectedCourse() {
            return teacherToolState.courses.find(function (row) {
                return String(row.id) === String(courseContext && courseContext.value || "");
            }) || null;
        }

        function selectedAssignment() {
            return teacherToolState.assignments.find(function (row) {
                return String(row.id) === String(assignSelect && assignSelect.value || "");
            }) || null;
        }

        function selectedStage() {
            return teacherToolState.stages.find(function (row) {
                return String(row.id) === String(stageSelect && stageSelect.value || "");
            }) || null;
        }

        function activeEditTarget() {
            if (teacherToolState.editTarget === "stage" && selectedStage()) {
                return "stage";
            }
            if (selectedAssignment()) {
                return "assignment";
            }
            return "";
        }

        function setEditTarget(target) {
            teacherToolState.editTarget = target === "stage" ? "stage" : "assignment";
        }

        function selectedManagedGroup() {
            return teacherToolState.groups.find(function (row) {
                return String(row.id) === String(teacherToolState.selectedGroupId || "");
            }) || null;
        }

        function formatCourseStatus(status) {
            if (status === "draft") return "草稿";
            if (status === "active") return "已发布";
            if (status === "archived") return "已归档";
            return status || "--";
        }

        function formatStageStatus(status) {
            if (status === "planned") return "待开始";
            if (status === "open") return "进行中";
            if (status === "closed") return "已截止";
            if (status === "archived") return "已归档";
            return status || "--";
        }

        function formatGroupStatus(status) {
            if (status === "forming") return "组队中";
            if (status === "active") return "已成组";
            if (status === "archived") return "已归档";
            return status || "--";
        }

        function isStageComplete(status) {
            var value = String(status || "").toLowerCase();
            return value === "closed" || value === "archived";
        }

        function assignmentTreeTitle(title, index) {
            var raw = String(title || "").trim();
            if (!raw) return "项目 " + String(index + 1);
            return raw.replace(/^项目\s*\d+\s*[：:]\s*/u, "");
        }

        function formatSemester(value) {
            var text = String(value || "").trim();
            if (!text) return "-- 学期";
            if (/^\d+$/.test(text)) return "第 " + text + " 学期";
            return text;
        }

        function formatDateText(value) {
            if (!value) return "--";
            var date = new Date(value);
            if (Number.isNaN(date.getTime())) return String(value);
            var year = date.getFullYear();
            var month = String(date.getMonth() + 1).padStart(2, "0");
            var day = String(date.getDate()).padStart(2, "0");
            var hour = String(date.getHours()).padStart(2, "0");
            var minute = String(date.getMinutes()).padStart(2, "0");
            return year + "-" + month + "-" + day + " " + hour + ":" + minute;
        }

        function fileDisplayName(file) {
            return file.originalName || file.filename || file.name || file.fileName || file.storageKey || "未命名附件";
        }

        function fileDisplaySize(file) {
            var size = Number(file.size || file.sizeBytes || file.byteSize || 0);
            if (!size) return "--";
            if (size < 1024) return String(size) + " B";
            if (size < 1024 * 1024) return (size / 1024).toFixed(1).replace(/\.0$/, "") + " KB";
            return (size / 1024 / 1024).toFixed(1).replace(/\.0$/, "") + " MB";
        }

        function groupMemberNames(groupId) {
            var rows = teacherToolState.groupMembers[String(groupId)] || [];
            if (!rows.length) return "暂无成员";
            return rows.slice(0, 4).map(function (row) {
                return row.user && row.user.profile && row.user.profile.realName || row.userId || "--";
            }).join("、");
        }

        function memberAccountNo(row) {
            return row && row.user && row.user.profile && row.user.profile.accountNo || row && row.userId || "";
        }

        function memberRealName(row) {
            return row && row.user && row.user.profile && row.user.profile.realName || memberAccountNo(row) || "--";
        }

        function courseMemberUserId(row) {
            return row && row.user && row.user.id || row && row.userId || "";
        }

        function courseMemberAccountNo(row) {
            return row && row.user && row.user.profile && row.user.profile.accountNo || courseMemberUserId(row) || "";
        }

        function courseMemberRealName(row) {
            return row && row.user && row.user.profile && row.user.profile.realName || courseMemberAccountNo(row) || "--";
        }

        function assignmentGroupedUserIds() {
            var ids = {};
            Object.keys(teacherToolState.groupMembers || {}).forEach(function (groupId) {
                (teacherToolState.groupMembers[groupId] || []).forEach(function (row) {
                    var userId = memberAccountNo(row);
                    if (userId) ids[String(userId)] = true;
                });
            });
            return ids;
        }

        function ungroupedCourseMembers() {
            var groupedIds = assignmentGroupedUserIds();
            return (teacherToolState.courseMembers || []).filter(function (row) {
                var userId = courseMemberAccountNo(row);
                var isStudent = Boolean(row && row.user && row.user.studentProfile);
                return isStudent && userId && !groupedIds[String(userId)];
            });
        }

        function avatarMarkup(url, name, tone) {
            if (url) {
                return '<img class="teacher-course-avatar" src="' + escapeHtml(url) + '" alt="' + escapeHtml(name || "") + '" />';
            }
            return '<span class="teacher-course-avatar teacher-course-avatar-fallback is-' + escapeHtml(tone || "teal") + '">' + escapeHtml((name || "U").slice(0, 2)) + '</span>';
        }

        function syncCourseSelection(nextValue) {
            var value = String(nextValue || "");
            [assignCourse, stageCourse, groupCourse, assistantCourse].forEach(function (select) {
                if (select) {
                    if (!select.options.length && courseContext && courseContext.options.length) {
                        select.innerHTML = courseContext.innerHTML;
                    }
                    select.value = value;
                }
            });
        }

        function updateTeacherCourseMetrics() {
            var projectCount = qs("#extTeacherProjectCount");
            var stageCount = qs("#extTeacherStageCount");
            var assistantCount = qs("#extTeacherAssistantCount");
            var groupCount = qs("#extTeacherGroupCount");
            if (projectCount) projectCount.textContent = "项目 " + String(teacherToolState.assignments.length || 0);
            if (stageCount) stageCount.textContent = "阶段 " + String(teacherToolState.stages.length || 0);
            if (assistantCount) assistantCount.textContent = "助教 " + String(teacherToolState.assistants.length || 0);
            if (groupCount) groupCount.textContent = "小组 " + String(teacherToolState.groups.length || 0);

            var course = selectedCourse();
            var yearNode = qs("#extTeacherCourseYear");
            var semesterNode = qs("#extTeacherCourseSemester");
            var statusNode = qs("#extTeacherCourseStatus");
            var structureMeta = qs("#extTeacherStructureMeta");
            if (yearNode) yearNode.textContent = course ? String(course.academicYear || "--") + " 学年" : "-- 学年";
            if (semesterNode) semesterNode.textContent = course ? formatSemester(course.semester) : "-- 学期";
            if (statusNode) statusNode.textContent = course ? formatCourseStatus(course.status) : "--";
            if (structureMeta) structureMeta.textContent = course ? ((course.courseNo || "--") + " · " + (course.name || "--")) : "请选择课程";
        }

        function updateMaterialMeta() {
            var assignMeta = qs("#extAssignMaterialMeta");
            var stageMeta = qs("#extStageMaterialMeta");
            var selectedAssignmentRow = selectedAssignment();
            var selectedStageRow = selectedStage();
            var assignmentFiles = selectedAssignmentRow && Array.isArray(selectedAssignmentRow.descriptionFiles) ? selectedAssignmentRow.descriptionFiles.length : 0;
            var stageFiles = selectedStageRow && Array.isArray(selectedStageRow.requirementFiles) ? selectedStageRow.requirementFiles.length : 0;
            if (assignMeta) assignMeta.textContent = "附件 " + String(assignmentFiles);
            if (stageMeta) stageMeta.textContent = "材料 " + String(stageFiles);
        }

        function fillAssignmentForm(row) {
            var selected = row || null;
            if (qs("#extAssignTitle")) qs("#extAssignTitle").value = selected ? (selected.title || "") : "";
            if (qs("#extAssignDesc")) qs("#extAssignDesc").value = selected ? (selected.description || "") : "";
            if (qs("#extAssignStatus")) qs("#extAssignStatus").value = selected ? (selected.status || "draft") : "draft";
            var assignmentMeta = qs("#extTeacherEditAssignmentMeta");
            if (assignmentMeta) {
                assignmentMeta.textContent = "当前项目：" + (selected ? (selected.title || "未命名项目") : "未选择");
            }
            updateMaterialMeta();
        }

        function toLocalDateTime(value) {
            if (!value) return "";
            var date = new Date(value);
            if (Number.isNaN(date.getTime())) return "";
            var year = date.getFullYear();
            var month = String(date.getMonth() + 1).padStart(2, "0");
            var day = String(date.getDate()).padStart(2, "0");
            var hour = String(date.getHours()).padStart(2, "0");
            var minute = String(date.getMinutes()).padStart(2, "0");
            return year + "-" + month + "-" + day + "T" + hour + ":" + minute;
        }

        function fillStageForm(row) {
            var selected = row || null;
            if (qs("#extStageTitle")) qs("#extStageTitle").value = selected ? (selected.title || "") : "";
            if (qs("#extStageStart")) qs("#extStageStart").value = selected ? toLocalDateTime(selected.startAt) : "";
            if (qs("#extStageDue")) qs("#extStageDue").value = selected ? toLocalDateTime(selected.dueAt) : "";
            if (qs("#extStageWeight")) qs("#extStageWeight").value = selected && selected.weight != null ? String(selected.weight) : "";
            if (qs("#extStageStatus")) qs("#extStageStatus").value = selected ? (selected.status || "planned") : "planned";
            if (qs("#extStageDesc")) qs("#extStageDesc").value = selected ? (selected.description || "") : "";
            if (qs("#extStageSubmission")) qs("#extStageSubmission").value = selected ? (selected.submissionDesc || "") : "";
            if (qs("#extStageCriteria")) qs("#extStageCriteria").value = selected ? (selected.acceptCriteria || "") : "";
            var stageMeta = qs("#extTeacherEditStageMeta");
            if (stageMeta) {
                stageMeta.textContent = "当前阶段：" + (selected ? ((selected.stageNo ? ("阶段 " + selected.stageNo + " · ") : "") + (selected.title || "未命名阶段")) : "未选择");
            }
            if (stageProjectSummary) {
                var assignment = teacherToolState.assignments.find(function (item) { return String(item.id) === String(stageAssignment && stageAssignment.value || ""); }) || null;
                stageProjectSummary.innerHTML = assignment
                    ? '<strong>' + escapeHtml(assignment.title || "--") + '</strong><small>' + escapeHtml(assignment.status || "--") + '</small>'
                    : '<span class="muted">请选择项目后查看阶段。</span>';
            }
            updateMaterialMeta();
        }

        function toggleHidden(node, hidden) {
            if (!node) return;
            node.hidden = Boolean(hidden);
        }

        function toggleButton(node, visible) {
            if (!node) return;
            node.hidden = !visible;
            node.disabled = !visible;
        }

        function teacherEditMode() {
            if (!selectedCourse()) return "disabled";
            if (selectedStage()) return "stage";
            if (selectedAssignment()) return "assignment";
            return "course";
        }

        function applyTeacherEditMode() {
            var mode = teacherEditMode();
            var titleNode = qs("#extTeacherStageEditorTitle");
            var badgeNode = qs("#extTeacherEditModeBadge");
            var hintNode = qs("#extTeacherEditModeHint");
            var assignmentSection = qs("#extTeacherAssignmentSection");
            var stageSection = qs("#extTeacherStageSection");
            var assignmentHint = qs("#extTeacherAssignmentHint");
            var stageHint = qs("#extTeacherStageHint");
            var course = selectedCourse();
            var assignment = selectedAssignment();
            var stage = selectedStage();

            if (mode === "disabled") {
                if (titleNode) titleNode.textContent = "编辑层级";
                if (badgeNode) badgeNode.textContent = "未选择课程";
                if (hintNode) hintNode.textContent = "请先选择课程，再创建项目或编辑项目、阶段。";
                if (assignmentHint) assignmentHint.textContent = "请先选择课程。";
                if (stageHint) stageHint.textContent = "请先选择课程与项目。";
                toggleHidden(assignmentSection, false);
                toggleHidden(stageSection, true);
                fillAssignmentForm(null);
                fillStageForm(null);
                toggleButton(qs("#extAssignCreate"), false);
                toggleButton(qs("#extAssignPatch"), false);
                toggleButton(qs("#extStageCreate"), false);
                toggleButton(qs("#extStagePatch"), false);
                toggleButton(qs("#extStageArchive"), false);
                return;
            }

            if (mode === "course") {
                if (titleNode) titleNode.textContent = "新建项目";
                if (badgeNode) badgeNode.textContent = "课程层级";
                if (hintNode) hintNode.textContent = "当前仅选择课程，可在该课程下新建项目。";
                if (assignmentHint) assignmentHint.textContent = "项目创建后，才可以继续为该项目新增阶段。";
                if (stageHint) stageHint.textContent = "请先在左侧选择项目，再为该项目创建阶段。";
                toggleHidden(assignmentSection, false);
                toggleHidden(stageSection, true);
                fillAssignmentForm(null);
                if (stageAssignment) stageAssignment.value = "";
                fillStageForm(null);
                toggleButton(qs("#extAssignCreate"), true);
                toggleButton(qs("#extAssignPatch"), false);
                toggleButton(qs("#extStageCreate"), false);
                toggleButton(qs("#extStagePatch"), false);
                toggleButton(qs("#extStageArchive"), false);
                return;
            }

            if (mode === "assignment") {
                if (titleNode) titleNode.textContent = "编辑项目 / 新建阶段";
                if (badgeNode) badgeNode.textContent = "项目层级";
                if (hintNode) hintNode.textContent = "当前选中项目，可修改项目信息，并在该项目下继续新建阶段。";
                if (assignmentHint) assignmentHint.textContent = "当前正在编辑已选项目，可修改项目标题、说明与状态。";
                if (stageHint) stageHint.textContent = "新阶段会创建在当前项目下，阶段创建后可再单独进入编辑。";
                toggleHidden(assignmentSection, false);
                toggleHidden(stageSection, false);
                fillAssignmentForm(assignment);
                if (stageAssignment) stageAssignment.value = assignment ? String(assignment.id || "") : "";
                if (stageSelect) stageSelect.value = "";
                fillStageForm(null);
                toggleButton(qs("#extAssignCreate"), false);
                toggleButton(qs("#extAssignPatch"), true);
                toggleButton(qs("#extStageCreate"), true);
                toggleButton(qs("#extStagePatch"), false);
                toggleButton(qs("#extStageArchive"), false);
                return;
            }

            if (titleNode) titleNode.textContent = "编辑阶段";
            if (badgeNode) badgeNode.textContent = "阶段层级";
            if (hintNode) hintNode.textContent = "当前选中阶段，仅可修改该阶段本身；如需新增阶段，请先回到项目层级。";
            if (assignmentHint) assignmentHint.textContent = "项目信息请回到项目层级后再修改。";
            if (stageHint) stageHint.textContent = "当前可修改阶段标题、时间、权重、说明、提交说明、验收标准与状态。";
            toggleHidden(assignmentSection, true);
            toggleHidden(stageSection, false);
            if (stageAssignment) {
                stageAssignment.value = stage && stage.assignmentId ? String(stage.assignmentId) : (assignment ? String(assignment.id || "") : "");
            }
            fillStageForm(stage);
            toggleButton(qs("#extAssignCreate"), false);
            toggleButton(qs("#extAssignPatch"), false);
            toggleButton(qs("#extStageCreate"), false);
            toggleButton(qs("#extStagePatch"), true);
            toggleButton(qs("#extStageArchive"), true);
        }

        function renderTeacherCourseTree() {
            var treeNode = qs("#extTeacherCourseTree");
            if (!treeNode) return;
            var assignmentRows = teacherToolState.assignments || [];
            var stageRows = teacherToolState.stages || [];
            if (!assignmentRows.length) {
                treeNode.innerHTML = '<div class="teacher-course-empty"><strong>暂无项目</strong><p>当前课程还没有项目与阶段。</p></div>';
                return;
            }
            var currentAssignmentId = String(assignSelect && assignSelect.value || "");
            var currentStageId = String(stageSelect && stageSelect.value || "");
            var html = [];
            var course = selectedCourse();
            html.push('<div class="teacher-course-tree-course"><span class="teacher-course-tree-course-dot"></span><strong>' + escapeHtml(course && course.name || "当前课程") + '</strong></div>');
            assignmentRows.forEach(function (assignment, index) {
                var relatedStages = stageRows.filter(function (stage) {
                    return String(stage.assignmentId || "") === String(assignment.id || currentAssignmentId)
                        && String(stage.status || "").toLowerCase() !== "archived";
                });
                var hasPendingStage = relatedStages.some(function (stage) { return !isStageComplete(stage.status); });
                var isCollapsed = Boolean(teacherToolState.collapsedAssignments[String(assignment.id)]);
                var activeClass = currentAssignmentId === String(assignment.id) ? " is-active" : "";
                html.push('<section class="teacher-course-tree-section' + activeClass + (isCollapsed ? ' is-collapsed' : '') + '">');
                html.push(
                    '<div class="teacher-course-tree-project">' +
                    '<button class="teacher-course-tree-toggle" type="button" data-assignment-toggle="' + escapeHtml(assignment.id) + '" aria-label="' + (isCollapsed ? "展开项目" : "收起项目") + '">' +
                    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (isCollapsed ? 'M7 5.5 12 10 7 14.5' : 'M5.5 7 10 12 14.5 7') + '"></path></svg>' +
                    '</button>' +
                    '<button class="teacher-course-tree-project-main" type="button" data-assignment-pick="' + escapeHtml(assignment.id) + '">' +
                    '<span class="teacher-course-tree-project-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 5.25A1.75 1.75 0 0 1 4.25 3.5H7.1c.4 0 .78.14 1.08.4l1.18 1.03c.12.1.27.16.43.16h5.96a1.75 1.75 0 0 1 1.75 1.75v.9H2.5v-2.5Z"></path><path d="M2.5 8.5h15v6.25a1.75 1.75 0 0 1-1.75 1.75H4.25A1.75 1.75 0 0 1 2.5 14.75V8.5Z"></path></svg></span>' +
                    '<strong>项目 ' + escapeHtml(String(index + 1)) + '：' + escapeHtml(assignmentTreeTitle(assignment.title, index)) + '</strong>' +
                    '</button>' +
                    '<span class="teacher-course-tree-project-tail">' +
                    '<span class="teacher-course-tree-project-count">' + escapeHtml(String(relatedStages.length)) + '</span>' +
                    (hasPendingStage ? '<span class="teacher-course-tree-state-dot is-pending" aria-hidden="true"></span>' : '<span class="teacher-course-tree-state-check" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10.5 8.5 14 15 6.5"></path></svg></span>') +
                    '</span>' +
                    '</div>'
                );
                if (!isCollapsed && relatedStages.length) {
                    html.push('<div class="teacher-course-tree-stage-list">');
                    relatedStages.forEach(function (stage, stageIndex) {
                        var stageClass = currentStageId === String(stage.id) ? " is-active" : "";
                        html.push(
                            '<button class="teacher-course-tree-stage' + stageClass + '" type="button" data-stage-pick="' + escapeHtml(stage.id) + '">' +
                            '<span class="teacher-course-tree-stage-line">' +
                            '<span class="teacher-course-tree-stage-text">阶段 ' + escapeHtml(String(stage.stageNo || stageIndex + 1)) + ' ' + escapeHtml(stage.title || "--") + '</span>' +
                            (isStageComplete(stage.status)
                                ? '<span class="teacher-course-tree-state-check" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10.5 8.5 14 15 6.5"></path></svg></span>'
                                : '<span class="teacher-course-tree-state-dot is-pending" aria-hidden="true"></span>') +
                            '</span>' +
                            '</button>'
                        );
                    });
                    html.push('</div>');
                } else if (!isCollapsed) {
                    html.push('<div class="teacher-course-tree-stage-empty">该项目暂未创建阶段</div>');
                }
                html.push('</section>');
            });
            treeNode.innerHTML = html.join("");
        }

        function renderTeacherStageOverview() {
            var course = selectedCourse();
            var assignment = selectedAssignment();
            var stage = selectedStage();
            var pathNode = qs("#extTeacherStagePath");
            var deadlineNode = qs("#extTeacherStageDeadline");
            var stateNode = qs("#extTeacherStageState");
            var groupProgressNode = qs("#extTeacherStageGroupProgress");
            var assistantSummaryNode = qs("#extTeacherAssistantSummary");
            var descNode = qs("#extTeacherStageDescription");
            var submissionNode = qs("#extTeacherStageSubmission");
            var criteriaNode = qs("#extTeacherStageCriteriaView");
            var groupMeta = qs("#extTeacherGroupMeta");
            var editToggle = qs("#extTeacherStageEditToggle");
            var totalGroups = teacherToolState.groups.length || 0;
            var submittedGroups = teacherToolState.groups.filter(function (row) {
                var summary = groupStageSubmissionSummary(row.id, stage);
                return summary.submitState === "done";
            }).length;
            var editTarget = activeEditTarget();

            if (pathNode) {
                if (!course || !assignment) {
                    pathNode.textContent = "请选择左侧项目与阶段";
                } else {
                    var assignmentIndex = teacherToolState.assignments.findIndex(function (row) {
                        return String(row.id) === String(assignment.id);
                    });
                    var pathHtml = [
                        '<span class="teacher-course-stage-path-root">' + escapeHtml(course.name || course.courseNo || "--") + '</span>',
                        '<span class="teacher-course-stage-path-sep">/</span>',
                        '<button class="teacher-course-stage-path-btn' + (editTarget === "assignment" ? ' is-active' : '') + '" type="button" data-edit-target="assignment">' +
                        escapeHtml("项目 " + String(assignmentIndex + 1) + "：" + assignmentTreeTitle(assignment.title, 0)) +
                        '</button>'
                    ];
                    if (stage) {
                        pathHtml.push('<span class="teacher-course-stage-path-sep">/</span>');
                        pathHtml.push('<button class="teacher-course-stage-path-btn' + (editTarget === "stage" ? ' is-active' : '') + '" type="button" data-edit-target="stage">' + escapeHtml("阶段 " + String(stage.stageNo || "--") + " " + (stage.title || "--")) + '</button>');
                    }
                    pathNode.innerHTML = pathHtml.join("");
                }
            }
            if (deadlineNode) deadlineNode.textContent = stage ? formatDateText(stage.dueAt) : "--";
            if (stateNode) stateNode.textContent = stage ? formatStageStatus(stage.status) : "--";
            if (groupProgressNode) groupProgressNode.textContent = String(submittedGroups) + " / " + String(totalGroups);
            if (assistantSummaryNode) assistantSummaryNode.textContent = teacherToolState.assistants.length
                ? teacherToolState.assistants.map(function (row) {
                    var profile = row.assistant && row.assistant.profile ? row.assistant.profile : {};
                    return profile.realName || row.assistantUserId || "--";
                }).join("、")
                : "暂未配置";
            if (descNode) descNode.textContent = stage && stage.description ? stage.description : "当前阶段暂无说明。";
            if (submissionNode) submissionNode.textContent = stage && stage.submissionDesc ? stage.submissionDesc : "当前阶段暂无提交要求。";
            if (criteriaNode) criteriaNode.textContent = stage && stage.acceptCriteria ? stage.acceptCriteria : "当前阶段暂无验收标准。";
            if (groupMeta) groupMeta.textContent = assignment ? ("项目 · " + assignmentTreeTitle(assignment.title, 0) + " · " + String(totalGroups) + " 个小组") : "当前项目全部小组";
            if (editToggle) {
                editToggle.disabled = !assignment;
                editToggle.textContent = editTarget === "stage" ? "编辑阶段" : "编辑项目";
            }
        }

        function groupStageSubmissionSummary(groupId, stage) {
            if (!stage) return { submitState: "pending", submitLabel: "待提交" };
            if (String(stage.status || "").toLowerCase() === "archived") {
                return { submitState: "ended", submitLabel: "已结束" };
            }
            var rows = teacherToolState.groupStageSubmissions[String(groupId)] || [];
            if (!rows.length) return { submitState: "pending", submitLabel: "待提交" };
            var latest = rows[0] || null;
            var status = String(latest && latest.status || "").toLowerCase();
            if (!status || status === "not_submitted") {
                return { submitState: "pending", submitLabel: "待提交" };
            }
            return { submitState: "done", submitLabel: "已提交" };
        }

        function renderTeacherAssistants() {
            renderBoundAssistants();
        }

        function renderTeacherGroups() {
            var listNode = qs("#extGroupList");
            if (!listNode) return;
            var stage = selectedStage();
            if (!teacherToolState.groups.length) {
                teacherToolState.selectedGroupId = "";
                listNode.innerHTML = '<div class="teacher-course-group-empty"><strong>暂未分组</strong><span>当前项目下还没有小组</span></div>';
                return;
            }
            listNode.innerHTML = teacherToolState.groups.map(function (group) {
                var summary = groupStageSubmissionSummary(group.id, stage);
                var submitState = summary.submitState;
                var submitLabel = summary.submitLabel;
                var memberRows = teacherToolState.groupMembers[String(group.id)] || [];
                var memberCount = memberRows.length || group._count && group._count.members || 0;
                var isSelected = String(teacherToolState.selectedGroupId || "") === String(group.id);
                var stageTitle = stage && stage.title ? stage.title : "未关联阶段";
                var actionHtml = '<button class="teacher-course-table-btn is-compact" type="button" data-group-edit="' + escapeHtml(group.id) + '">编辑</button>';
                return [
                    '<div class="teacher-course-group-table-row' + (isSelected ? ' is-selected' : '') + '" data-group-pick="' + escapeHtml(group.id) + '">',
                    '<span>第 ' + escapeHtml(String(group.groupNo || "--")) + ' 组</span>',
                    '<span class="teacher-course-group-name-cell"><strong>' + escapeHtml(group.name || ("第 " + group.groupNo + " 组")) + '</strong><small>' + escapeHtml(stageTitle) + '</small></span>',
                    '<span class="teacher-course-group-members">' + escapeHtml(groupMemberNames(group.id)) + '</span>',
                    '<span>' + escapeHtml(String(memberCount)) + ' 人</span>',
                    '<span class="teacher-course-group-submit is-' + escapeHtml(submitState) + '"><i></i>' + escapeHtml(submitLabel) + '</span>',
                    '<span class="teacher-course-group-actions">' + actionHtml + '</span>',
                    '</div>',
                ].join("");
            }).join("");
        }

        function renderTeacherGroupEditor() {
            if (!groupEditorDialog) return;
            var course = selectedCourse();
            var assignment = selectedAssignment();
            var managedGroup = selectedManagedGroup();
            var selectionMeta = qs("#extTeacherGroupEditorSelectionMeta");
            var courseMeta = qs("#extTeacherGroupEditorCourseMeta");
            var assignmentMeta = qs("#extTeacherGroupEditorAssignmentMeta");
            var managedSelect = qs("#extTeacherManagedGroupSelect");
            var memberList = qs("#extTeacherManagedGroupMembers");
            var ungroupedList = qs("#extTeacherUngroupedList");
            var ungroupedMeta = qs("#extTeacherUngroupedMeta");
            var ungroupedRows = ungroupedCourseMembers();

            if (courseMeta) courseMeta.textContent = "当前课程：" + (course ? ((course.courseNo || "--") + " · " + (course.name || "--")) : "--");
            if (assignmentMeta) assignmentMeta.textContent = "当前项目：" + (assignment ? (assignment.title || "未命名项目") : "未选择");
            if (selectionMeta) selectionMeta.textContent = "当前小组：" + (managedGroup ? (managedGroup.name || ("第 " + managedGroup.groupNo + " 组")) : "未选择");

            if (managedSelect) {
                managedSelect.innerHTML = teacherToolState.groups.length
                    ? teacherToolState.groups.map(function (group) {
                        var label = "第 " + String(group.groupNo || "--") + " 组 · " + (group.name || "未命名小组");
                        return '<option value="' + escapeHtml(group.id) + '">' + escapeHtml(label) + '</option>';
                    }).join("")
                    : '<option value="">暂无小组</option>';
                managedSelect.value = managedGroup ? String(managedGroup.id) : "";
            }

            if (ungroupedMeta) {
                ungroupedMeta.textContent = String(ungroupedRows.length) + " 人";
            }
            if (ungroupedList) {
                ungroupedList.innerHTML = ungroupedRows.length
                    ? ungroupedRows.map(function (row) {
                        return '<div class="teacher-course-group-student-row"><div class="teacher-course-group-student-main"><strong>' + escapeHtml(courseMemberRealName(row)) + '</strong><small>' + escapeHtml(courseMemberAccountNo(row)) + '</small></div><button class="teacher-course-group-icon-action teacher-course-group-list-arrow" type="button" data-ungrouped-add="' + escapeHtml(courseMemberAccountNo(row)) + '"' + (managedGroup ? "" : " disabled") + ' aria-label="加入当前小组" title="加入当前小组"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 10h10.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="m10.8 5.8 4.2 4.2-4.2 4.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';
                    }).join("")
                    : '<div class="teacher-course-group-editor-empty">当前项目下没有未分组学生。</div>';
            }

            if (memberList) {
                var memberRows = managedGroup ? (teacherToolState.groupMembers[String(managedGroup.id)] || []) : [];
                memberList.innerHTML = managedGroup
                    ? (
                        '<div class="teacher-course-group-editor-member-head"><span>成员</span><span>账号</span><span>角色</span><span>操作</span></div>' +
                        (memberRows.length ? memberRows.map(function (row) {
                            var role = row.role === "leader" ? "组长" : "成员";
                            var userId = memberAccountNo(row);
                            return '<div class="teacher-course-group-editor-member-row"><span><strong>' + escapeHtml(memberRealName(row)) + '</strong></span><span>' + escapeHtml(userId) + '</span><span>' + escapeHtml(role) + '</span><span class="teacher-course-group-editor-member-ops"><button class="teacher-course-text-btn" type="button" data-member-move="' + escapeHtml(userId) + '">换组</button><button class="teacher-course-text-btn is-danger" type="button" data-member-remove="' + escapeHtml(userId) + '">移除</button></span></div>';
                        }).join("") : '<div class="teacher-course-group-editor-empty">当前小组还没有成员。</div>')
                    )
                    : '<div class="teacher-course-group-editor-empty">请先在上方选择要编辑的小组。</div>';
            }
        }

        function renderTeacherGroupMoveDialog() {
            if (!groupMoveDialog) return;
            var managedGroup = selectedManagedGroup();
            var userId = teacherToolState.pendingMoveUserId || "";
            var memberRows = managedGroup ? (teacherToolState.groupMembers[String(managedGroup.id)] || []) : [];
            var pickedMember = memberRows.find(function (row) {
                return String(memberAccountNo(row)) === String(userId);
            }) || null;
            var targetNode = qs("#extTeacherGroupMoveTarget");
            var memberMeta = qs("#extTeacherGroupMoveMemberMeta");
            var sourceMeta = qs("#extTeacherGroupMoveSourceMeta");

            if (memberMeta) {
                memberMeta.textContent = "成员：" + (pickedMember ? (memberRealName(pickedMember) + " · " + memberAccountNo(pickedMember)) : "--");
            }
            if (sourceMeta) {
                sourceMeta.textContent = "当前小组：" + (managedGroup ? (managedGroup.name || ("第 " + managedGroup.groupNo + " 组")) : "--");
            }
            if (targetNode) {
                targetNode.innerHTML = '<option value="">选择目标小组</option>' + teacherToolState.groups.filter(function (group) {
                    return !managedGroup || String(group.id) !== String(managedGroup.id);
                }).map(function (group) {
                    var label = "第 " + String(group.groupNo || "--") + " 组 · " + (group.name || "未命名小组");
                    return '<option value="' + escapeHtml(group.id) + '">' + escapeHtml(label) + '</option>';
                }).join("");
            }
        }

        function openTeacherGroupMoveDialog(userId) {
            if (!groupMoveDialog) return;
            teacherToolState.pendingMoveUserId = String(userId || "");
            renderTeacherGroupMoveDialog();
            clearResult(qs("#extTeacherGroupMoveResult"));
            groupMoveDialog.hidden = false;
        }

        function closeTeacherGroupMoveDialog() {
            if (!groupMoveDialog) return;
            teacherToolState.pendingMoveUserId = "";
            clearResult(qs("#extTeacherGroupMoveResult"));
            if (qs("#extTeacherGroupMoveTarget")) qs("#extTeacherGroupMoveTarget").value = "";
            groupMoveDialog.hidden = true;
        }

        function renderTeacherAttachments() {
            var listNode = qs("#extTeacherAttachmentList");
            if (!listNode) return;
            var assignment = selectedAssignment();
            var stage = selectedStage();
            var files = [];
            if (assignment && Array.isArray(assignment.descriptionFiles)) {
                files = files.concat(assignment.descriptionFiles.map(function (file) {
                    return { scope: "项目", file: file };
                }));
            }
            if (stage && Array.isArray(stage.requirementFiles)) {
                files = files.concat(stage.requirementFiles.map(function (file) {
                    return { scope: "阶段", file: file };
                }));
            }
            if (!files.length) {
                listNode.innerHTML = '<div class="teacher-course-attachment-empty">当前阶段暂时没有附件</div>';
                return;
            }
            listNode.innerHTML = files.map(function (entry) {
                var file = entry.file || {};
                var fileName = fileDisplayName(file);
                var ext = String(fileName.split(".").pop() || "").toLowerCase();
                var iconClass = /pdf/.test(ext) ? "is-pdf" : /(xls|xlsx|csv)/.test(ext) ? "is-sheet" : /(doc|docx)/.test(ext) ? "is-doc" : "is-file";
                return [
                    '<div class="teacher-course-attachment-item">',
                    '<div class="teacher-course-attachment-main">',
                    '<span class="teacher-course-attachment-icon ' + iconClass + '" aria-hidden="true">' + fileTypeIconSvg(ext) + '</span>',
                    '<div class="teacher-course-attachment-copy"><strong>' + escapeHtml(fileName) + '</strong></div>',
                    '</div>',
                    '<span class="teacher-course-attachment-size">' + escapeHtml(fileDisplaySize(file)) + '</span>',
                    '<span class="teacher-course-attachment-date">' + escapeHtml(formatDateText(file.uploadedAt || file.createdAt || file.updatedAt || "")) + '</span>',
                    '</div>',
                ].join("");
            }).join("");
        }

        function renderTeacherWorkspace() {
            updateTeacherCourseMetrics();
            var courseMeta = qs("#extTeacherEditCourseMeta");
            var course = selectedCourse();
            if (courseMeta) {
                courseMeta.textContent = "当前课程：" + (course ? ((course.courseNo || "--") + " · " + (course.name || "--")) : "--");
            }
            renderTeacherCourseTree();
            renderTeacherStageOverview();
            renderTeacherAssistants();
            renderTeacherGroups();
            renderTeacherAttachments();
            renderTeacherGroupEditor();
            if (stageEditorDialog && !stageEditorDialog.hidden) {
                applyTeacherEditMode();
            }
            if (assignmentManageDialog && !assignmentManageDialog.hidden) {
                fillAssignmentManageDialog();
            }
            if (stageManageDialog && !stageManageDialog.hidden) {
                fillStageManageDialog();
            }
        }

        function renderOwnedAssistants() {
            if (!assistantOwnedSelect) return;
            assistantOwnedSelect.innerHTML = '<option value="">从子账号中选择助教</option>' + teacherToolState.ownedAssistants.map(function (row) {
                var label = (row.realName || row.accountNo || row.assistantUserId || "--") + " · " + (row.accountNo || row.assistantUserId || "--");
                return '<option value="' + escapeHtml(row.assistantUserId || row.id || "") + '">' + escapeHtml(label) + '</option>';
            }).join("");
        }

        function renderBoundAssistants() {
            updateTeacherCourseMetrics();
        }

        function openAssistantDialog() {
            if (!assistantDialog) return;
            assistantDialog.hidden = false;
            document.body.classList.add("teacher-course-dialog-open");
        }

        function closeAssistantDialog() {
            if (!assistantDialog) return;
            assistantDialog.hidden = true;
            document.body.classList.remove("teacher-course-dialog-open");
        }

        function openDialog(dialog) {
            if (!dialog) return;
            dialog.hidden = false;
            document.body.classList.add("teacher-course-dialog-open");
        }

        function closeDialog(dialog) {
            if (!dialog) return;
            dialog.hidden = true;
            document.body.classList.remove("teacher-course-dialog-open");
        }

        function fillAssignmentCreateDialog() {
            var course = selectedCourse();
            var courseMeta = qs("#extTeacherAssignmentCreateCourseMeta");
            if (courseMeta) courseMeta.textContent = "当前课程：" + (course ? ((course.courseNo || "--") + " · " + (course.name || "--")) : "--");
            if (qs("#extTeacherAssignmentCreateTitle")) qs("#extTeacherAssignmentCreateTitle").value = "";
            if (qs("#extTeacherAssignmentCreateStatus")) qs("#extTeacherAssignmentCreateStatus").value = "draft";
            if (qs("#extTeacherAssignmentCreateDesc")) qs("#extTeacherAssignmentCreateDesc").value = "";
        }

        function fillAssignmentManageDialog() {
            var course = selectedCourse();
            var assignment = selectedAssignment();
            var courseMeta = qs("#extTeacherAssignmentManageCourseMeta");
            var assignmentMeta = qs("#extTeacherAssignmentManageMeta");
            if (courseMeta) courseMeta.textContent = "当前课程：" + (course ? ((course.courseNo || "--") + " · " + (course.name || "--")) : "--");
            if (assignmentMeta) assignmentMeta.textContent = "当前项目：" + (assignment ? (assignment.title || "未命名项目") : "--");
            if (qs("#extTeacherAssignmentManageTitle")) qs("#extTeacherAssignmentManageTitle").value = assignment ? (assignment.title || "") : "";
            if (qs("#extTeacherAssignmentManageStatus")) qs("#extTeacherAssignmentManageStatus").value = assignment ? (assignment.status || "draft") : "draft";
            if (qs("#extTeacherAssignmentManageDesc")) qs("#extTeacherAssignmentManageDesc").value = assignment ? (assignment.description || "") : "";
            if (qs("#extTeacherAssignmentStageTitle")) qs("#extTeacherAssignmentStageTitle").value = "";
            if (qs("#extTeacherAssignmentStageStatus")) qs("#extTeacherAssignmentStageStatus").value = "planned";
            if (qs("#extTeacherAssignmentStageStart")) qs("#extTeacherAssignmentStageStart").value = "";
            if (qs("#extTeacherAssignmentStageDue")) qs("#extTeacherAssignmentStageDue").value = "";
            if (qs("#extTeacherAssignmentStageWeight")) qs("#extTeacherAssignmentStageWeight").value = "";
            if (qs("#extTeacherAssignmentStageDesc")) qs("#extTeacherAssignmentStageDesc").value = "";
            if (qs("#extTeacherAssignmentStageSubmission")) qs("#extTeacherAssignmentStageSubmission").value = "";
            if (qs("#extTeacherAssignmentStageCriteria")) qs("#extTeacherAssignmentStageCriteria").value = "";
            if (qs("#extTeacherAssignmentDelete")) {
                qs("#extTeacherAssignmentDelete").hidden = !(assignment && String(assignment.status || "") === "draft");
            }
        }

        function fillStageManageDialog() {
            var course = selectedCourse();
            var assignment = selectedAssignment();
            var stage = selectedStage();
            var courseMeta = qs("#extTeacherStageManageCourseMeta");
            var assignmentMeta = qs("#extTeacherStageManageAssignmentMeta");
            var stageMeta = qs("#extTeacherStageManageMeta");
            if (courseMeta) courseMeta.textContent = "当前课程：" + (course ? ((course.courseNo || "--") + " · " + (course.name || "--")) : "--");
            if (assignmentMeta) assignmentMeta.textContent = "当前项目：" + (assignment ? (assignment.title || "未命名项目") : "--");
            if (stageMeta) stageMeta.textContent = "当前阶段：" + (stage ? ((stage.stageNo ? ("阶段 " + stage.stageNo + " · ") : "") + (stage.title || "未命名阶段")) : "--");
            if (qs("#extTeacherStageManageTitle")) qs("#extTeacherStageManageTitle").value = stage ? (stage.title || "") : "";
            if (qs("#extTeacherStageManageStatus")) qs("#extTeacherStageManageStatus").value = stage ? (stage.status || "planned") : "planned";
            if (qs("#extTeacherStageManageStart")) qs("#extTeacherStageManageStart").value = stage ? toLocalDateTime(stage.startAt) : "";
            if (qs("#extTeacherStageManageDue")) qs("#extTeacherStageManageDue").value = stage ? toLocalDateTime(stage.dueAt) : "";
            if (qs("#extTeacherStageManageWeight")) qs("#extTeacherStageManageWeight").value = stage && stage.weight != null ? String(stage.weight) : "";
            if (qs("#extTeacherStageManageDesc")) qs("#extTeacherStageManageDesc").value = stage ? (stage.description || "") : "";
            if (qs("#extTeacherStageManageSubmission")) qs("#extTeacherStageManageSubmission").value = stage ? (stage.submissionDesc || "") : "";
            if (qs("#extTeacherStageManageCriteria")) qs("#extTeacherStageManageCriteria").value = stage ? (stage.acceptCriteria || "") : "";
            if (qs("#extTeacherStageDelete")) {
                qs("#extTeacherStageDelete").hidden = !stage || String(stage.status || "") === "archived";
                qs("#extTeacherStageDelete").textContent = "归档阶段";
            }
        }

        function buildAssignmentBody(prefix) {
            return {
                title: qs(prefix + "Title").value.trim(),
                description: qs(prefix + "Desc").value.trim() || null,
                status: qs(prefix + "Status").value,
            };
        }

        function buildStageBody(prefix) {
            var start = qs(prefix + "Start").value;
            return {
                title: qs(prefix + "Title").value.trim(),
                description: qs(prefix + "Desc").value.trim() || null,
                startAt: start ? new Date(start).toISOString() : null,
                dueAt: qs(prefix + "Due").value ? new Date(qs(prefix + "Due").value).toISOString() : undefined,
                weight: qs(prefix + "Weight").value ? Number(qs(prefix + "Weight").value) : null,
                status: qs(prefix + "Status").value,
                submissionDesc: qs(prefix + "Submission").value.trim() || null,
                acceptCriteria: qs(prefix + "Criteria").value.trim() || null,
            };
        }

        function openAssignmentCreateDialog() {
            clearResult(qs("#extTeacherAssignmentCreateResult"));
            fillAssignmentCreateDialog();
            openDialog(assignmentCreateDialog);
        }

        function closeAssignmentCreateDialog() {
            closeDialog(assignmentCreateDialog);
        }

        function openAssignmentManageDialog() {
            if (!selectedAssignment()) return;
            clearResult(qs("#extTeacherAssignmentManageResult"));
            clearResult(qs("#extTeacherAssignmentStageResult"));
            fillAssignmentManageDialog();
            openDialog(assignmentManageDialog);
        }

        function closeAssignmentManageDialog() {
            closeDialog(assignmentManageDialog);
        }

        function openStageManageDialog() {
            if (!selectedStage()) return;
            clearResult(qs("#extTeacherStageManageResult"));
            fillStageManageDialog();
            openDialog(stageManageDialog);
        }

        function closeStageManageDialog() {
            closeDialog(stageManageDialog);
        }

        function openStageEditorDialog() {
            if (activeEditTarget() === "stage") {
                openStageManageDialog();
                return;
            }
            if (activeEditTarget() === "assignment") {
                openAssignmentManageDialog();
            }
        }

        function closeStageEditorDialog() {
            closeDialog(stageEditorDialog);
        }

        function openGroupEditorDialog(groupId) {
            if (!groupEditorDialog) return;
            if (groupId) {
                teacherToolState.selectedGroupId = String(groupId);
            } else if (!teacherToolState.selectedGroupId && teacherToolState.groups[0]) {
                teacherToolState.selectedGroupId = String(teacherToolState.groups[0].id);
            }
            clearResult(groupResult);
            renderTeacherGroupEditor();
            groupEditorDialog.hidden = false;
            document.body.classList.add("teacher-course-dialog-open");
        }

        function closeGroupEditorDialog() {
            if (!groupEditorDialog) return;
            closeTeacherGroupMoveDialog();
            groupEditorDialog.hidden = true;
            document.body.classList.remove("teacher-course-dialog-open");
        }

        function activateGroup(groupId) {
            if (!groupId) return Promise.resolve();
            if (teacherToolState.mockMode) {
                return mockActivateGroup(groupId).then(function () {
                    setResult(groupResult, "操作成功", "该小组已确认成组。", false);
                    return refreshGroups();
                }).catch(function (err) {
                    setResult(groupResult, "操作失败", err.message, true);
                });
            }
            return api().patchJson("/api/v1/groups/" + encodeURIComponent(groupId) + "/status", { status: "active" }).then(function () {
                setResult(groupResult, "操作成功", "该小组已确认成组。", false);
                return refreshGroups();
            }).catch(function (err) {
                setResult(groupResult, "操作失败", err.message, true);
            });
        }

        function syncAssignmentTargets() {
            if (stageAssignment) {
                stageAssignment.innerHTML = assignSelect ? assignSelect.innerHTML : '<option value="">请选择项目</option>';
                stageAssignment.value = assignSelect && assignSelect.value ? assignSelect.value : "";
            }
            if (groupAssignment) {
                groupAssignment.innerHTML = assignSelect ? assignSelect.innerHTML : '<option value="">请选择项目</option>';
                groupAssignment.value = assignSelect && assignSelect.value ? assignSelect.value : "";
            }
        }

        function refreshCourseMembers() {
            if (!courseContext || !courseContext.value) {
                teacherToolState.courseMembers = [];
                return Promise.resolve([]);
            }
            if (teacherToolState.mockMode) {
                teacherToolState.courseMembers = mockCourseMemberRows(courseContext.value);
                return Promise.resolve(teacherToolState.courseMembers);
            }
            return api().getJson("/api/v1/courses/" + encodeURIComponent(courseContext.value) + "/members?status=active&limit=500&offset=0").then(function (payload) {
                teacherToolState.courseMembers = normalizeRows(payload);
                return teacherToolState.courseMembers;
            });
        }

        function loadOwnedAssistants() {
            if (teacherToolState.mockMode) {
                teacherToolState.ownedAssistants = (teacherMock.ownedAssistants || []).slice();
                renderOwnedAssistants();
                return Promise.resolve(teacherToolState.ownedAssistants);
            }
            return api().getJson("/api/v1/users/assistants/mine").then(function (payload) {
                teacherToolState.ownedAssistants = normalizeRows(payload);
                renderOwnedAssistants();
            });
        }

        function refreshTeacherWorkspace() {
            syncCourseSelection(courseContext && courseContext.value);
            return Promise.all([
                refreshCourseMembers(),
                refreshAssignments(),
                refreshAssistants(),
            ]).then(function () {
                syncAssignmentTargets();
                return Promise.all([
                    refreshStageAssignments(),
                    refreshGroupAssignments(),
                ]);
            });
        }

        function refreshAssignments() {
            if (teacherToolState.mockMode) {
                var mockRows = mockAssignmentRows(assignCourse.value);
                assignSelect.innerHTML = '<option value="">请选择项目</option>' + optionRows(mockRows, function (assignment) {
                    return (assignment.title || assignment.id) + " · " + (assignment.status || "--");
                });
                ensureSelectValue(assignSelect, mockRows, true);
                teacherToolState.assignments = mockRows;
                fillAssignmentForm(selectedAssignment());
                syncAssignmentTargets();
                renderTeacherWorkspace();
                return Promise.resolve(mockRows);
            }
            return loadAssignmentOptions(assignCourse.value, assignSelect, true).then(function (rows) {
                teacherToolState.assignments = rows;
                var selectedAssignment = rows.find(function (row) { return String(row.id) === String(assignSelect.value || ""); }) || null;
                fillAssignmentForm(selectedAssignment);
                syncAssignmentTargets();
                renderTeacherWorkspace();
                return rows;
            });
        }
        if (assignCourse && courseContext) {
            if (teacherToolState.mockMode) {
                var mockRows = mockCourseRows();
                courseContext.innerHTML = optionRows(mockRows, function (course) {
                    return (course.name || course.courseNo || course.id) + " · " + (course.status || "--");
                });
                ensureSelectValue(courseContext, mockRows, false);
                teacherToolState.courses = mockRows;
                syncCourseSelection(courseContext.value);
                [assignCourse, stageCourse, groupCourse, assistantCourse].forEach(function (select) {
                    if (select) {
                        select.innerHTML = courseContext.innerHTML;
                        select.value = courseContext.value;
                    }
                });
                refreshTeacherWorkspace().then(function () {
                    syncCourseSelection(courseContext.value);
                    renderTeacherWorkspace();
                }).catch(function (err) {
                    reportTeacherLoadError(err, "课程加载失败");
                });
            } else {
                loadCourseOptions(courseContext, function (rows) {
                    teacherToolState.courses = rows;
                    syncCourseSelection(courseContext.value);
                    return refreshTeacherWorkspace();
                }).then(function () {
                    syncCourseSelection(courseContext.value);
                    renderTeacherWorkspace();
                }).catch(function (err) {
                    reportTeacherLoadError(err, "课程加载失败");
                });
            }
            courseContext.onchange = function () {
                syncCourseSelection(courseContext.value);
                refreshTeacherWorkspace().catch(function (err) {
                    reportTeacherLoadError(err, "课程刷新失败");
                });
            };
            assignCourse.onchange = function () {
                if (courseContext) {
                    courseContext.value = assignCourse.value;
                }
                syncCourseSelection(assignCourse.value);
                refreshTeacherWorkspace().catch(function (err) {
                    reportTeacherLoadError(err, "课程刷新失败");
                });
            };
            if (courseRefresh) {
                courseRefresh.onclick = function () {
                    return refreshTeacherWorkspace().catch(function (err) {
                        reportTeacherLoadError(err, "刷新失败");
                    });
                };
            }
        }
        if (qs("#extAssignCreate")) qs("#extAssignCreate").onclick = function () {
            if (!assignCourse.value) return setResult(assignResult, "无法创建", "请先选择课程。", true);
            api().postJson("/api/v1/courses/" + encodeURIComponent(assignCourse.value) + "/assignments", {
                title: qs("#extAssignTitle").value.trim(),
                description: qs("#extAssignDesc").value.trim() || null,
                status: qs("#extAssignStatus").value,
            }).then(function (payload) {
                setResult(assignResult, "创建成功", "项目已创建。", false);
                return refreshAssignments().then(function () {
                    var createdId = payload && payload.data && payload.data.id ? String(payload.data.id) : "";
                    if (createdId && assignSelect) {
                        assignSelect.value = createdId;
                        syncAssignmentTargets();
                        fillAssignmentForm(selectedAssignment());
                    }
                    return refreshStages();
                });
            }).catch(function (err) {
                setResult(assignResult, "创建失败", err.message, true);
            });
        };
        if (qs("#extAssignPatch")) qs("#extAssignPatch").onclick = function () {
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
        function uploadAssignmentFiles() {
            var id = assignSelect.value;
            var input = qs("#extAssignFiles");
            if (!id || !input.files.length) return setResult(assignResult, "无法上传", "请先选择项目和附件。", true);
            var form = new FormData();
            Array.from(input.files).forEach(function (file) { form.append("files", file); });
            return api().postForm("/api/v1/assignments/" + encodeURIComponent(id) + "/materials", form).then(function () {
                input.value = "";
                setResult(assignResult, "上传成功", "项目附件已上传。", false);
                return refreshAssignments();
            }).catch(function (err) {
                setResult(assignResult, "上传失败", err.message, true);
            });
        }
        function refreshStageAssignments() {
            if (teacherToolState.mockMode) {
                var rows = mockAssignmentRows(stageCourse.value);
                stageAssignment.innerHTML = optionRows(rows, function (assignment) {
                    return (assignment.title || assignment.id) + " · " + (assignment.status || "--");
                });
                ensureSelectValue(stageAssignment, rows, false);
                return refreshStages();
            }
            return loadAssignmentOptions(stageCourse.value, stageAssignment, false).then(refreshStages);
        }
        function refreshStages() {
            var keepBlankSelection = !String(stageSelect && stageSelect.value || "");
            if (teacherToolState.mockMode) {
                var rows = mockStageRows(stageAssignment.value);
                stageSelect.innerHTML = '<option value="">请选择阶段</option>' + rows.map(function (stage) {
                    var label = (stage.title || ("阶段 " + stage.stageNo)) + " · " + (stage.status || "--");
                    return '<option value="' + escapeHtml(stage.id) + '" data-stage-no="' + escapeHtml(stage.stageNo) + '" data-stage-title="' + escapeHtml(stage.title || ("阶段 " + stage.stageNo)) + '">' + escapeHtml(label) + '</option>';
                }).join("");
                ensureSelectValue(stageSelect, rows, true);
                if (keepBlankSelection) stageSelect.value = "";
                if (stageSelectMirror) {
                    stageSelectMirror.innerHTML = stageSelect.innerHTML;
                    stageSelectMirror.value = stageSelect.value;
                }
                teacherToolState.stages = teacherToolState.assignments.reduce(function (all, assignment) {
                    return all.concat(mockStageRows(assignment.id).map(function (stage) {
                        stage.assignmentId = assignment.id;
                        return stage;
                    }));
                }, []);
                fillStageForm(selectedStage());
                renderTeacherWorkspace();
                return Promise.resolve(rows);
            }
            return loadStageOptions(stageAssignment.value, stageSelect, true).then(function (rows) {
                if (keepBlankSelection && stageSelect) stageSelect.value = "";
                if (stageSelectMirror) {
                    stageSelectMirror.innerHTML = stageSelect.innerHTML;
                    stageSelectMirror.value = stageSelect.value;
                }
                return Promise.all((teacherToolState.assignments || []).map(function (assignment) {
                    var scratch = document.createElement("select");
                    return loadStageOptions(assignment.id, scratch, false).then(function (assignmentStages) {
                        return assignmentStages.map(function (stage) {
                            stage.assignmentId = assignment.id;
                            return stage;
                        });
                    }).catch(function () {
                        return [];
                    });
                })).then(function (stageBuckets) {
                    teacherToolState.stages = stageBuckets.reduce(function (all, bucket) {
                        return all.concat(bucket);
                    }, []);
                    var selectedStage = teacherToolState.stages.find(function (row) { return String(row.id) === String(stageSelect.value || ""); }) || null;
                    fillStageForm(selectedStage);
                    renderTeacherWorkspace();
                });
            });
        }
        if (stageCourse) {
            stageCourse.onchange = function () {
                if (courseContext) courseContext.value = stageCourse.value;
                syncCourseSelection(stageCourse.value);
                refreshTeacherWorkspace().catch(function (err) {
                    reportTeacherLoadError(err, "阶段刷新失败");
                });
            };
            stageAssignment.onchange = function () {
                refreshStages().catch(function (err) {
                    reportTeacherLoadError(err, "阶段加载失败");
                });
            };
            stageSelect.onchange = function () {
                var selectedStage = teacherToolState.stages.find(function (row) { return String(row.id) === String(stageSelect.value || ""); }) || null;
                setEditTarget(selectedStage ? "stage" : "assignment");
                fillStageForm(selectedStage);
                refreshGroups().catch(function (err) {
                    reportTeacherLoadError(err, "小组阶段状态刷新失败");
                });
            };
        }
        function stageBody() {
            var start = qs("#extStageStart").value;
            return {
                title: qs("#extStageTitle").value.trim(),
                description: qs("#extStageDesc").value.trim() || null,
                startAt: start ? new Date(start).toISOString() : null,
                dueAt: qs("#extStageDue").value ? new Date(qs("#extStageDue").value).toISOString() : undefined,
                weight: qs("#extStageWeight").value ? Number(qs("#extStageWeight").value) : null,
                status: qs("#extStageStatus").value,
                submissionDesc: qs("#extStageSubmission").value.trim() || null,
                acceptCriteria: qs("#extStageCriteria").value.trim() || null,
            };
        }
        if (qs("#extStageCreate")) qs("#extStageCreate").onclick = function () {
            if (!stageAssignment.value) return setResult(stageResult, "无法创建", "请先选择项目，再新建阶段。", true);
            api().postJson("/api/v1/assignments/" + encodeURIComponent(stageAssignment.value) + "/stages", stageBody()).then(function (payload) {
                setResult(stageResult, "创建成功", "阶段已创建。", false);
                return refreshStages().then(function () {
                    var createdId = payload && payload.data && payload.data.id ? String(payload.data.id) : "";
                    if (createdId && stageSelect) {
                        stageSelect.value = createdId;
                        if (stageSelectMirror) stageSelectMirror.value = createdId;
                        fillStageForm(selectedStage());
                        renderTeacherWorkspace();
                    }
                });
            }).catch(function (err) {
                setResult(stageResult, "创建失败", err.message, true);
            });
        };
        if (qs("#extStagePatch")) qs("#extStagePatch").onclick = function () {
            if (!stageSelect.value) return setResult(stageResult, "无法保存", "请先选择阶段。", true);
            api().patchJson("/api/v1/stages/" + encodeURIComponent(stageSelect.value), stageBody()).then(function () {
                setResult(stageResult, "保存成功", "阶段已更新。", false);
                return refreshStages();
            }).catch(function (err) {
                setResult(stageResult, "保存失败", err.message, true);
            });
        };

        function submitAssignmentCreate() {
            var resultNode = qs("#extTeacherAssignmentCreateResult");
            if (!courseContext.value) return setResult(resultNode, "无法创建", "请先选择课程。", true);
            var body = buildAssignmentBody("#extTeacherAssignmentCreate");
            var action = teacherToolState.mockMode
                ? mockCreateAssignment(courseContext.value, body)
                : api().postJson("/api/v1/courses/" + encodeURIComponent(courseContext.value) + "/assignments", body);
            return action.then(function (payload) {
                var createdId = payload && payload.data && payload.data.id ? String(payload.data.id) : "";
                setResult(resultNode, "创建成功", "项目已创建。", false);
                return refreshAssignments().then(function () {
                    if (createdId && assignSelect) {
                        assignSelect.value = createdId;
                        syncAssignmentTargets();
                        if (stageSelect) stageSelect.value = "";
                        if (stageSelectMirror) stageSelectMirror.value = "";
                        setEditTarget("assignment");
                    }
                    renderTeacherWorkspace();
                    closeAssignmentCreateDialog();
                });
            }).catch(function (err) {
                setResult(resultNode, "创建失败", err.message, true);
            });
        }

        function submitAssignmentManageSave() {
            var assignment = selectedAssignment();
            var resultNode = qs("#extTeacherAssignmentManageResult");
            if (!assignment) return setResult(resultNode, "无法保存", "请先选择项目。", true);
            var body = buildAssignmentBody("#extTeacherAssignmentManage");
            var action = teacherToolState.mockMode
                ? mockPatchAssignment(assignment.id, body)
                : api().patchJson("/api/v1/assignments/" + encodeURIComponent(assignment.id), body);
            return action.then(function () {
                setResult(resultNode, "保存成功", "项目已更新。", false);
                return refreshAssignments().then(function () {
                    if (assignSelect) assignSelect.value = String(assignment.id);
                    syncAssignmentTargets();
                    renderTeacherWorkspace();
                    fillAssignmentManageDialog();
                });
            }).catch(function (err) {
                setResult(resultNode, "保存失败", err.message, true);
            });
        }

        function submitAssignmentDelete() {
            var assignment = selectedAssignment();
            var resultNode = qs("#extTeacherAssignmentManageResult");
            if (!assignment) return setResult(resultNode, "无法删除", "请先选择项目。", true);
            var action = teacherToolState.mockMode
                ? mockDeleteAssignment(assignment.id)
                : requestDelete("/api/v1/assignments/" + encodeURIComponent(assignment.id));
            return action.then(function () {
                setResult(resultNode, "删除成功", "项目已删除。", false);
                if (assignSelect) assignSelect.value = "";
                if (stageSelect) stageSelect.value = "";
                if (stageSelectMirror) stageSelectMirror.value = "";
                setEditTarget("assignment");
                return refreshTeacherWorkspace().then(function () {
                    closeAssignmentManageDialog();
                });
            }).catch(function (err) {
                setResult(resultNode, "删除失败", err.message, true);
            });
        }

        function submitAssignmentStageCreate() {
            var assignment = selectedAssignment();
            var resultNode = qs("#extTeacherAssignmentStageResult");
            if (!assignment) return setResult(resultNode, "无法创建", "请先选择项目。", true);
            var body = buildStageBody("#extTeacherAssignmentStage");
            var action = teacherToolState.mockMode
                ? mockCreateStage(assignment.id, body)
                : api().postJson("/api/v1/assignments/" + encodeURIComponent(assignment.id) + "/stages", body);
            return action.then(function (payload) {
                var createdId = payload && payload.data && payload.data.id ? String(payload.data.id) : "";
                setResult(resultNode, "创建成功", "阶段已创建。", false);
                return refreshStages().then(function () {
                    if (stageSelect) stageSelect.value = createdId || "";
                    if (stageSelectMirror) stageSelectMirror.value = createdId || "";
                    setEditTarget("stage");
                    renderTeacherWorkspace();
                    closeAssignmentManageDialog();
                });
            }).catch(function (err) {
                setResult(resultNode, "创建失败", err.message, true);
            });
        }

        function submitStageManageSave() {
            var stage = selectedStage();
            var resultNode = qs("#extTeacherStageManageResult");
            if (!stage) return setResult(resultNode, "无法保存", "请先选择阶段。", true);
            var body = buildStageBody("#extTeacherStageManage");
            var action = teacherToolState.mockMode
                ? mockPatchStage(stage.id, body)
                : api().patchJson("/api/v1/stages/" + encodeURIComponent(stage.id), body);
            return action.then(function () {
                setResult(resultNode, "保存成功", "阶段已更新。", false);
                return refreshStages().then(function () {
                    if (stageSelect) stageSelect.value = String(stage.id);
                    if (stageSelectMirror) stageSelectMirror.value = String(stage.id);
                    setEditTarget("stage");
                    renderTeacherWorkspace();
                    fillStageManageDialog();
                });
            }).catch(function (err) {
                setResult(resultNode, "保存失败", err.message, true);
            });
        }

        function submitStageDelete() {
            var stage = selectedStage();
            var resultNode = qs("#extTeacherStageManageResult");
            if (!stage) return setResult(resultNode, "无法归档", "请先选择阶段。", true);
            var stageId = String(stage.id);
            var action = teacherToolState.mockMode
                ? mockArchiveStage(stageId)
                : requestDelete("/api/v1/stages/" + encodeURIComponent(stageId));
            return action.then(function () {
                setResult(resultNode, "归档成功", "阶段已归档。", false);
                if (stageSelect) stageSelect.value = "";
                if (stageSelectMirror) stageSelectMirror.value = "";
                setEditTarget("assignment");
                return refreshStages().then(function () {
                    renderTeacherWorkspace();
                    closeStageManageDialog();
                });
            }).catch(function (err) {
                setResult(resultNode, "归档失败", err.message, true);
            });
        }
        function uploadStageFiles() {
            var input = qs("#extStageFiles");
            if (!stageSelect.value || !input.files.length) return setResult(stageResult, "无法上传", "请先选择阶段和附件。", true);
            var form = new FormData();
            Array.from(input.files).forEach(function (file) { form.append("files", file); });
            return api().postForm("/api/v1/stages/" + encodeURIComponent(stageSelect.value) + "/materials", form).then(function () {
                input.value = "";
                setResult(stageResult, "上传成功", "阶段附件已上传。", false);
                return refreshStages();
            }).catch(function (err) {
                setResult(stageResult, "上传失败", err.message, true);
            });
        }
        if (qs("#extTeacherAttachmentUpload")) qs("#extTeacherAttachmentUpload").onclick = function () {
            if (stageSelect && stageSelect.value) {
                qs("#extStageFiles").click();
                return;
            }
            if (assignSelect && assignSelect.value) {
                qs("#extAssignFiles").click();
                return;
            }
            setResult(stageResult || assignResult, "无法上传", "请先选择项目或阶段。", true);
        };
        if (qs("#extAssignFiles")) qs("#extAssignFiles").addEventListener("change", function () {
            if (this.files && this.files.length) uploadAssignmentFiles();
        });
        if (qs("#extStageFiles")) qs("#extStageFiles").addEventListener("change", function () {
            if (this.files && this.files.length) uploadStageFiles();
        });
        if (qs("#extStageArchive")) qs("#extStageArchive").onclick = function () {
            if (!stageSelect.value) return setResult(stageResult, "无法归档", "请先选择阶段。", true);
            requestDelete("/api/v1/stages/" + encodeURIComponent(stageSelect.value)).then(function () {
                setResult(stageResult, "归档成功", "阶段已归档。", false);
                return refreshStages();
            }).catch(function (err) {
                setResult(stageResult, "归档失败", err.message, true);
            });
        };
        function refreshGroupAssignments() {
            if (teacherToolState.mockMode) {
                var rows = mockAssignmentRows(groupCourse.value);
                groupAssignment.innerHTML = optionRows(rows, function (assignment) {
                    return (assignment.title || assignment.id) + " · " + (assignment.status || "--");
                });
                ensureSelectValue(groupAssignment, rows, false);
                return refreshGroups();
            }
            return loadAssignmentOptions(groupCourse.value, groupAssignment, false).then(refreshGroups);
        }
        function refreshGroups() {
            if (!groupAssignment.value) {
                teacherToolState.groups = [];
                teacherToolState.groupMembers = {};
                teacherToolState.groupStageSubmissions = {};
                teacherToolState.selectedGroupId = "";
                renderTeacherWorkspace();
                return Promise.resolve();
            }
            if (teacherToolState.mockMode) {
                var groupRows = mockGroupRows(groupAssignment.value);
                teacherToolState.groups = groupRows;
                if (!groupRows.some(function (group) { return String(group.id) === String(teacherToolState.selectedGroupId || ""); })) {
                    teacherToolState.selectedGroupId = groupRows[0] ? String(groupRows[0].id) : "";
                }
                teacherToolState.groupMembers = {};
                teacherToolState.groupStageSubmissions = {};
                groupRows.forEach(function (group) {
                    teacherToolState.groupMembers[String(group.id)] = mockGroupMemberRows(group.id);
                    teacherToolState.groupStageSubmissions[String(group.id)] = [];
                });
                renderTeacherWorkspace();
                return Promise.resolve(groupRows);
            }
            return api().getJson("/api/v1/assignments/" + encodeURIComponent(groupAssignment.value) + "/groups").then(function (payload) {
                var rows = normalizeRows(payload);
                teacherToolState.groups = rows;
                if (!rows.some(function (group) { return String(group.id) === String(teacherToolState.selectedGroupId || ""); })) {
                    teacherToolState.selectedGroupId = rows[0] ? String(rows[0].id) : "";
                }
                teacherToolState.groupMembers = {};
                teacherToolState.groupStageSubmissions = {};
                var stage = selectedStage();
                return Promise.all(rows.map(function (group) {
                    var requests = [
                        api().getJson("/api/v1/groups/" + encodeURIComponent(group.id) + "/members").then(function (membersPayload) {
                            teacherToolState.groupMembers[String(group.id)] = normalizeRows(membersPayload);
                        }).catch(function () {
                            teacherToolState.groupMembers[String(group.id)] = [];
                        })
                    ];
                    if (stage && stage.id) {
                        requests.push(
                            api().getJson("/api/v1/stages/" + encodeURIComponent(stage.id) + "/groups/" + encodeURIComponent(group.id) + "/submissions").then(function (submissionPayload) {
                                teacherToolState.groupStageSubmissions[String(group.id)] = normalizeRows(submissionPayload);
                            }).catch(function () {
                                teacherToolState.groupStageSubmissions[String(group.id)] = [];
                            })
                        );
                    } else {
                        teacherToolState.groupStageSubmissions[String(group.id)] = [];
                    }
                    return Promise.all(requests);
                })).then(function () {
                    renderTeacherWorkspace();
                });
            });
        }
        if (groupCourse) {
            groupCourse.onchange = function () {
                if (courseContext) courseContext.value = groupCourse.value;
                syncCourseSelection(groupCourse.value);
                refreshTeacherWorkspace().catch(function (err) {
                    reportTeacherLoadError(err, "小组刷新失败");
                });
            };
            groupAssignment.onchange = function () {
                refreshGroups().catch(function (err) {
                    reportTeacherLoadError(err, "小组加载失败");
                });
            };
        }
        if (qs("#extTeacherGroupEditorOpen")) {
            qs("#extTeacherGroupEditorOpen").onclick = function () {
                openGroupEditorDialog();
            };
        }
        if (qs("#extTeacherGroupEditorClose")) {
            qs("#extTeacherGroupEditorClose").onclick = closeGroupEditorDialog;
        }
        if (qs("#extTeacherGroupEditorCancel")) {
            qs("#extTeacherGroupEditorCancel").onclick = closeGroupEditorDialog;
        }
        if (qs("#extTeacherGroupEditorRefresh")) {
            qs("#extTeacherGroupEditorRefresh").onclick = function () {
                refreshTeacherWorkspace().then(function () {
                    setResult(groupResult, "已刷新", "小组与未分组学生数据已更新。", false);
                });
            };
        }
        if (qs("#extTeacherManagedGroupSelect")) {
            qs("#extTeacherManagedGroupSelect").onchange = function () {
                teacherToolState.selectedGroupId = this.value || "";
                closeTeacherGroupMoveDialog();
                renderTeacherWorkspace();
            };
        }
        if (qs("#extTeacherGroupCreate")) {
            qs("#extTeacherGroupCreate").onclick = function () {
                var body = { name: qs("#extTeacherGroupCreateName").value.trim() || undefined };
                if (qs("#extTeacherGroupCreateNo").value) body.groupNo = Number(qs("#extTeacherGroupCreateNo").value);
                var request = teacherToolState.mockMode
                    ? mockCreateGroup(body)
                    : api().postJson("/api/v1/assignments/" + encodeURIComponent(groupAssignment.value) + "/groups", body);
                request.then(function (payload) {
                    var createdId = payload && payload.data && payload.data.id ? String(payload.data.id) : "";
                    if (createdId) teacherToolState.selectedGroupId = createdId;
                    setResult(groupResult, "创建成功", "小组已创建，可继续在右侧维护成员。", false);
                    return refreshGroups();
                }).catch(function (err) {
                    setResult(groupResult, "创建失败", err.message, true);
                });
            };
        }
        if (qs("#extTeacherGroupAutoCreate")) {
            qs("#extTeacherGroupAutoCreate").onclick = function () {
                var size = Number(qs("#extTeacherGroupAutoSize").value || 4);
                var request = teacherToolState.mockMode
                    ? mockAutoGroup(size)
                    : api().postJson("/api/v1/assignments/" + encodeURIComponent(groupAssignment.value) + "/groups/auto", {
                        groupSize: size
                    });
                request.then(function (payload) {
                    var data = payload && payload.data ? payload.data : payload;
                    setResult(groupResult, "自动分组完成", "已生成 " + String(data && data.createdGroups || 0) + " 个小组，覆盖 " + String(data && data.groupedStudents || 0) + " 名学生。", false);
                    return refreshGroups();
                }).catch(function (err) {
                    setResult(groupResult, "自动分组失败", err.message, true);
                });
            };
        }
        if (qs("#extTeacherGroupActivate")) {
            qs("#extTeacherGroupActivate").onclick = function () {
                activateGroup(teacherToolState.selectedGroupId || "");
            };
        }
        if (qs("#extTeacherGroupDelete")) {
            qs("#extTeacherGroupDelete").onclick = function () {
                var groupId = teacherToolState.selectedGroupId || "";
                if (!groupId) return setResult(groupResult, "无法删除", "请先选择要删除的小组。", true);
                var request = teacherToolState.mockMode
                    ? mockDeleteGroup(groupId)
                    : requestDelete("/api/v1/groups/" + encodeURIComponent(groupId));
                request.then(function () {
                    setResult(groupResult, "删除成功", "空小组已删除。", false);
                    teacherToolState.selectedGroupId = "";
                    return refreshGroups();
                }).catch(function (err) {
                    setResult(groupResult, "删除失败", err.message, true);
                });
            };
        }
        if (qs("#extTeacherGroupMemberAdd")) {
            qs("#extTeacherGroupMemberAdd").onclick = function () {
                var groupId = teacherToolState.selectedGroupId || "";
                var userId = qs("#extTeacherGroupMemberAddInput").value.trim();
                if (!groupId) return setResult(groupResult, "无法添加", "请先选择一个小组。", true);
                if (!userId) return setResult(groupResult, "无法添加", "请先输入学生一卡通号。", true);
                var request = teacherToolState.mockMode
                    ? mockAddGroupMember(groupId, userId)
                    : api().postJson("/api/v1/groups/" + encodeURIComponent(groupId) + "/members", { userId: userId });
                request.then(function () {
                    setResult(groupResult, "添加成功", "成员已加入当前小组。", false);
                    qs("#extTeacherGroupMemberAddInput").value = "";
                    return refreshGroups();
                }).catch(function (err) {
                    setResult(groupResult, "添加失败", err.message, true);
                });
            };
        }
        if (qs("#extTeacherGroupMoveConfirm")) {
            qs("#extTeacherGroupMoveConfirm").onclick = function () {
                var groupId = teacherToolState.selectedGroupId || "";
                var userId = teacherToolState.pendingMoveUserId || "";
                var targetGroupId = qs("#extTeacherGroupMoveTarget").value;
                var moveResult = qs("#extTeacherGroupMoveResult");
                if (!groupId) return setResult(moveResult, "无法转移", "请先选择源小组。", true);
                if (!userId) return setResult(moveResult, "无法转移", "请先选择要换组的成员。", true);
                if (!targetGroupId) return setResult(moveResult, "无法转移", "请选择目标小组。", true);
                var request = teacherToolState.mockMode
                    ? mockMoveGroupMember(groupId, userId, targetGroupId)
                    : api().postJson("/api/v1/groups/" + encodeURIComponent(groupId) + "/members/" + encodeURIComponent(userId) + "/move", { targetGroupId: targetGroupId });
                request.then(function () {
                    closeTeacherGroupMoveDialog();
                    setResult(groupResult, "转移成功", "成员已转移到目标小组。", false);
                    return refreshGroups();
                }).catch(function (err) {
                    setResult(moveResult, "转移失败", err.message, true);
                });
            };
        }
        function refreshAssistants() {
            var courseId = assistantCourse.value;
            if (!courseId) {
                teacherToolState.assistants = [];
                renderTeacherWorkspace();
                return Promise.resolve();
            }
            if (teacherToolState.mockMode) {
                teacherToolState.assistants = mockAssistantRows(courseId);
                renderTeacherWorkspace();
                return Promise.resolve(teacherToolState.assistants);
            }
            return api().getJson("/api/v1/courses/" + encodeURIComponent(courseId) + "/assistants").then(function (payload) {
                var rows = normalizeRows(payload);
                teacherToolState.assistants = rows;
                renderTeacherWorkspace();
            });
        }
        if (assistantCourse) {
            assistantCourse.onchange = function () {
                if (courseContext) courseContext.value = assistantCourse.value;
                syncCourseSelection(assistantCourse.value);
                refreshTeacherWorkspace().catch(function (err) {
                    reportTeacherLoadError(err, "助教刷新失败");
                });
            };
        }
        if (qs("#extAssistantCreate")) {
            qs("#extAssistantCreate").onclick = function () {
                var body = { id: qs("#extAssistantId").value.trim(), realName: qs("#extAssistantName").value.trim() };
                if (qs("#extAssistantPassword").value.trim()) {
                    body.defaultPassword = qs("#extAssistantPassword").value.trim();
                }
                api().postJson("/api/v1/users/assistants", body).then(function (payload) {
                    setResult(assistantResult, "创建成功", "临时密码：" + ((payload.data && payload.data.temporaryPassword) || "已按输入设置"), false);
                    return loadOwnedAssistants();
                }).catch(function (err) {
                    setResult(assistantResult, "创建失败", err.message, true);
                });
            };
        }
        qs("#extAssistantBind").onclick = function () {
            var assistantUserId = assistantOwnedSelect && assistantOwnedSelect.value ? assistantOwnedSelect.value : qs("#extAssistantBindId").value.trim();
            if (!assistantUserId) return setResult(assistantResult, "无法绑定", "请先从已有子账号中选择助教。", true);
            api().postJson("/api/v1/courses/" + encodeURIComponent(assistantCourse.value) + "/assistants", { assistantUserId: assistantUserId }).then(function () {
                setResult(assistantResult, "绑定成功", "助教已绑定课程。", false);
                closeAssistantDialog();
                return refreshAssistants();
            }).catch(function (err) {
                setResult(assistantResult, "绑定失败", err.message, true);
            });
        };
        if (qs("#extAssistantUnbindAll")) {
            qs("#extAssistantUnbindAll").onclick = function () {
                var courseId = assistantCourse && assistantCourse.value ? assistantCourse.value : "";
                var assistants = (teacherToolState.assistants || []).filter(function (row) {
                    return row && (row.assistantUserId || row.id);
                });
                if (!courseId) return setResult(assistantResult, "无法解除", "请先选择课程。", true);
                if (!assistants.length) return setResult(assistantResult, "无需解除", "当前课程还没有绑定助教。", false);
                if (!window.confirm("确认解除当前课程的全部助教绑定吗？")) return;
                var unbindRequest = teacherToolState.mockMode
                    ? Promise.resolve().then(function () {
                        teacherToolState.assistants = [];
                    })
                    : Promise.all(assistants.map(function (row) {
                        var assistantUserId = row.assistantUserId || row.id;
                        return api().request("/api/v1/courses/" + encodeURIComponent(courseId) + "/assistants/" + encodeURIComponent(assistantUserId), {
                            method: "DELETE",
                            headers: api().authHeaders(),
                        });
                    }));
                unbindRequest.then(function () {
                    setResult(assistantResult, "解除成功", "当前课程助教绑定已解除。", false);
                    closeAssistantDialog();
                    return refreshAssistants();
                }).catch(function (err) {
                    setResult(assistantResult, "解除失败", err.message, true);
                });
            };
        }
        if (qs("#extTeacherAssistantOpen")) {
            qs("#extTeacherAssistantOpen").onclick = openAssistantDialog;
        }
        if (qs("#extTeacherAssistantClose")) {
            qs("#extTeacherAssistantClose").onclick = closeAssistantDialog;
        }
        if (qs("#extTeacherAssistantCancel")) {
            qs("#extTeacherAssistantCancel").onclick = closeAssistantDialog;
        }

        if (assignSelect) {
            assignSelect.onchange = function () {
                if (stageSelect) stageSelect.value = "";
                if (stageSelectMirror) stageSelectMirror.value = "";
                var selectedAssignment = teacherToolState.assignments.find(function (row) { return String(row.id) === String(assignSelect.value || ""); }) || null;
                fillAssignmentForm(selectedAssignment);
                syncAssignmentTargets();
                Promise.all([
                    refreshStages(),
                    refreshGroups(),
                ]).then(renderTeacherWorkspace);
            };
        }

        if (stageSelectMirror) {
            stageSelectMirror.onchange = function () {
                if (stageSelect) {
                    stageSelect.value = stageSelectMirror.value;
                    if (typeof stageSelect.onchange === "function") stageSelect.onchange();
                }
            };
        }

        if (qs("#extTeacherStageEditToggle")) {
            qs("#extTeacherStageEditToggle").onclick = openStageEditorDialog;
        }
        if (qs("#extTeacherAssignmentCreateOpen")) {
            qs("#extTeacherAssignmentCreateOpen").onclick = openAssignmentCreateDialog;
        }
        if (qs("#extTeacherStageEditorClose")) {
            qs("#extTeacherStageEditorClose").onclick = closeStageEditorDialog;
        }
        if (qs("#extTeacherAssignmentCreateClose")) qs("#extTeacherAssignmentCreateClose").onclick = closeAssignmentCreateDialog;
        if (qs("#extTeacherAssignmentCreateCancel")) qs("#extTeacherAssignmentCreateCancel").onclick = closeAssignmentCreateDialog;
        if (qs("#extTeacherAssignmentCreateSubmit")) qs("#extTeacherAssignmentCreateSubmit").onclick = submitAssignmentCreate;
        if (qs("#extTeacherAssignmentManageClose")) qs("#extTeacherAssignmentManageClose").onclick = closeAssignmentManageDialog;
        if (qs("#extTeacherAssignmentManageCancel")) qs("#extTeacherAssignmentManageCancel").onclick = closeAssignmentManageDialog;
        if (qs("#extTeacherAssignmentManageSave")) qs("#extTeacherAssignmentManageSave").onclick = submitAssignmentManageSave;
        if (qs("#extTeacherAssignmentDelete")) qs("#extTeacherAssignmentDelete").onclick = submitAssignmentDelete;
        if (qs("#extTeacherAssignmentStageCreate")) qs("#extTeacherAssignmentStageCreate").onclick = submitAssignmentStageCreate;
        if (qs("#extTeacherStageManageClose")) qs("#extTeacherStageManageClose").onclick = closeStageManageDialog;
        if (qs("#extTeacherStageManageCancel")) qs("#extTeacherStageManageCancel").onclick = closeStageManageDialog;
        if (qs("#extTeacherStageManageSave")) qs("#extTeacherStageManageSave").onclick = submitStageManageSave;
        if (qs("#extTeacherStageDelete")) qs("#extTeacherStageDelete").onclick = submitStageDelete;
        if (stageEditorDialog) {
            stageEditorDialog.addEventListener("click", function (event) {
                if (event.target === stageEditorDialog) {
                    closeStageEditorDialog();
                }
            });
        }
        [assignmentCreateDialog, assignmentManageDialog, stageManageDialog].forEach(function (dialog) {
            if (!dialog) return;
            dialog.addEventListener("click", function (event) {
                if (event.target === dialog) {
                    closeDialog(dialog);
                }
            });
        });

        if (qs("#panel-course-manage")) {
            qs("#panel-course-manage").addEventListener("click", function (event) {
                var editTargetPick = event.target && event.target.closest ? event.target.closest("[data-edit-target]") : null;
                if (editTargetPick) {
                    setEditTarget(editTargetPick.getAttribute("data-edit-target") || "assignment");
                    renderTeacherWorkspace();
                    return;
                }
                var assignmentToggle = event.target && event.target.closest ? event.target.closest("[data-assignment-toggle]") : null;
                if (assignmentToggle) {
                    var toggleId = assignmentToggle.getAttribute("data-assignment-toggle") || "";
                    teacherToolState.collapsedAssignments[String(toggleId)] = !teacherToolState.collapsedAssignments[String(toggleId)];
                    renderTeacherCourseTree();
                    return;
                }
                var assignmentPick = event.target && event.target.closest ? event.target.closest("[data-assignment-pick]") : null;
                if (assignmentPick && assignSelect) {
                    assignSelect.value = assignmentPick.getAttribute("data-assignment-pick") || "";
                    syncAssignmentTargets();
                    setEditTarget("assignment");
                    Promise.all([refreshStages(), refreshGroups()]).then(function () {
                        if (stageSelect) stageSelect.value = "";
                        if (stageSelectMirror) stageSelectMirror.value = "";
                        renderTeacherWorkspace();
                    });
                    return;
                }
                var stagePick = event.target && event.target.closest ? event.target.closest("[data-stage-pick]") : null;
                if (stagePick && stageSelect) {
                    var pickedStageId = stagePick.getAttribute("data-stage-pick") || "";
                    var pickedStage = teacherToolState.stages.find(function (row) {
                        return String(row.id) === String(pickedStageId);
                    }) || null;
                    if (pickedStage && assignSelect) {
                        assignSelect.value = String(pickedStage.assignmentId || "");
                        syncAssignmentTargets();
                        Promise.all([refreshStages(), refreshGroups()]).then(function () {
                            stageSelect.value = pickedStageId;
                            if (stageSelectMirror) stageSelectMirror.value = pickedStageId;
                            setEditTarget("stage");
                            if (typeof stageSelect.onchange === "function") stageSelect.onchange();
                        });
                    } else {
                        stageSelect.value = pickedStageId;
                        setEditTarget("stage");
                        if (typeof stageSelect.onchange === "function") stageSelect.onchange();
                    }
                    return;
                }
                var groupEdit = event.target && event.target.closest ? event.target.closest("[data-group-edit]") : null;
                if (groupEdit) {
                    openGroupEditorDialog(groupEdit.getAttribute("data-group-edit") || "");
                    return;
                }
                var groupPick = event.target && event.target.closest ? event.target.closest("[data-group-pick]") : null;
                if (groupPick) {
                    teacherToolState.selectedGroupId = groupPick.getAttribute("data-group-pick") || "";
                    renderTeacherWorkspace();
                    return;
                }
                var ungroupedAdd = event.target && event.target.closest ? event.target.closest("[data-ungrouped-add]") : null;
                if (ungroupedAdd) {
                    var pickedUserId = ungroupedAdd.getAttribute("data-ungrouped-add") || "";
                    var currentGroupId = teacherToolState.selectedGroupId || "";
                    if (!currentGroupId || !pickedUserId) return;
                    var addRequest = teacherToolState.mockMode
                        ? mockAddGroupMember(currentGroupId, pickedUserId)
                        : api().postJson("/api/v1/groups/" + encodeURIComponent(currentGroupId) + "/members", { userId: pickedUserId });
                    addRequest.then(function () {
                        setResult(groupResult, "添加成功", "未分组学生已加入当前小组。", false);
                        return refreshGroups();
                    }).catch(function (err) {
                        setResult(groupResult, "添加失败", err.message, true);
                    });
                    return;
                }
                var memberRemove = event.target && event.target.closest ? event.target.closest("[data-member-remove]") : null;
                if (memberRemove) {
                    var removeUserId = memberRemove.getAttribute("data-member-remove") || "";
                    var removeGroupId = teacherToolState.selectedGroupId || "";
                    if (!removeGroupId || !removeUserId) return;
                    var removeRequest = teacherToolState.mockMode
                        ? mockRemoveGroupMember(removeGroupId, removeUserId)
                        : requestDelete("/api/v1/groups/" + encodeURIComponent(removeGroupId) + "/members/" + encodeURIComponent(removeUserId));
                    removeRequest.then(function () {
                        setResult(groupResult, "移出成功", "成员已移出当前小组。", false);
                        return refreshGroups();
                    }).catch(function (err) {
                        setResult(groupResult, "移出失败", err.message, true);
                    });
                    return;
                }
                var memberMove = event.target && event.target.closest ? event.target.closest("[data-member-move]") : null;
                if (memberMove) {
                    openTeacherGroupMoveDialog(memberMove.getAttribute("data-member-move") || "");
                    return;
                }
            });
        }
        if (assistantDialog) {
            assistantDialog.addEventListener("click", function (event) {
                if (event.target === assistantDialog) {
                    closeAssistantDialog();
                }
            });
        }
        if (groupEditorDialog) {
            groupEditorDialog.addEventListener("click", function (event) {
                if (event.target === groupEditorDialog) {
                    closeGroupEditorDialog();
                }
            });
        }
        if (groupMoveDialog) {
            groupMoveDialog.addEventListener("click", function (event) {
                if (event.target === groupMoveDialog) {
                    closeTeacherGroupMoveDialog();
                }
            });
        }
        if (qs("#extTeacherGroupMoveClose")) {
            qs("#extTeacherGroupMoveClose").onclick = closeTeacherGroupMoveDialog;
        }
        if (qs("#extTeacherGroupMoveCancel")) {
            qs("#extTeacherGroupMoveCancel").onclick = closeTeacherGroupMoveDialog;
        }

        loadOwnedAssistants().catch(function (err) {
            reportTeacherLoadError(err, "助教账号加载失败");
        });
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
        mockEnabled: allowExplicitMock("studentTeamMock"),
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
