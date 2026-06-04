(function () {
    async function initStudentDashboard() {
        if (!window.linkseeApi) return;
        var todoToggle = document.getElementById("studentTodoToggle");
        var todoClose = document.getElementById("studentTodoClose");
        var todoPopover = document.getElementById("studentTodoPopover");
        var todoMemoList = document.getElementById("studentTodoMemoList");
        var todoCountBadge = document.getElementById("studentTodoCountBadge");

        function toggleTodoPopover(forceOpen) {
            if (!todoPopover || !todoToggle) return;
            var shouldOpen = typeof forceOpen === "boolean" ? forceOpen : todoPopover.hidden;
            todoPopover.hidden = !shouldOpen;
            todoToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        }

        if (todoToggle) {
            todoToggle.addEventListener("click", function (event) {
                event.stopPropagation();
                toggleTodoPopover();
            });
        }
        if (todoClose) {
            todoClose.addEventListener("click", function () {
                toggleTodoPopover(false);
            });
        }
        document.addEventListener("click", function (event) {
            var widget = document.getElementById("studentTodoWidget");
            if (widget && !widget.contains(event.target)) {
                toggleTodoPopover(false);
            }
        });

        function getTodoStatus(row) {
            return row.submission && row.submission.status ? row.submission.status : "not_submitted";
        }

        function isTodoDone(row) {
            var status = getTodoStatus(row);
            return status === "approved" || status === "reviewed";
        }

        try {
            var dashboard = await window.linkseeApi.getJson("/api/v1/students/dashboard");
            var dashboardData = dashboard && dashboard.data ? dashboard.data : {};
            var courseRows = Array.isArray(dashboardData.courses) ? dashboardData.courses : [];
            var courseList = document.getElementById("studentCourseList");
            var courseScopeSelect = document.getElementById("studentCourseScopeSelect");
            var courseCount = document.getElementById("studentCourseCount");
            var stageList = document.getElementById("studentStageList");
            var artifactList = document.getElementById("studentArtifactList");
            var gradeList = document.getElementById("studentGradeList");
            var gradeEmpty = document.getElementById("studentGradeEmpty");
            if (courseCount) courseCount.textContent = String(courseRows.length);
            if (courseScopeSelect) {
                courseScopeSelect.innerHTML = '<option value="">全部课程</option>' + courseRows.map(function (course) {
                    return '<option value="' + linkseePage.escapeHtml(course.id) + '">' + linkseePage.escapeHtml(course.name || course.courseNo || course.id) + '</option>';
                }).join("");
            }
            var todoRows = Array.isArray(dashboardData.todoRows) ? dashboardData.todoRows : [];
            var gradeRows = Array.isArray(dashboardData.gradeRows) ? dashboardData.gradeRows : [];

            todoRows.sort(function (a, b) {
                return new Date(a.stage.dueAt || 0).getTime() - new Date(b.stage.dueAt || 0).getTime();
            });
            gradeRows.sort(function (a, b) {
                return new Date(b.grade.updatedAt || b.grade.createdAt || 0).getTime() - new Date(a.grade.updatedAt || a.grade.createdAt || 0).getTime();
            });
            var activeTodoRows = todoRows.filter(function (row) {
                return !isTodoDone(row);
            });

            function isSelectedCourse(row, courseId) {
                return !courseId || String(row.course && row.course.id) === String(courseId);
            }

            function renderCourseScope(courseId) {
                var scopedCourses = courseId
                    ? courseRows.filter(function (course) { return String(course.id) === String(courseId); })
                    : courseRows;
                var scopedTodos = todoRows.filter(function (row) { return isSelectedCourse(row, courseId); });
                if (courseList) {
                    courseList.innerHTML = scopedCourses.map(function (course) {
                        return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + linkseePage.escapeHtml(course.name || "--") + '</strong><span class="badge badge-active">' + linkseePage.escapeHtml(course.status || "--") + '</span></div><div class="muted">课程编号：' + linkseePage.escapeHtml(course.courseNo || course.id || "--") + ' · 学年学期：' + linkseePage.escapeHtml(String(course.academicYear || "--")) + ' / ' + linkseePage.escapeHtml(String(course.semester || "--")) + '</div></div>';
                    }).join("") || '<div class="dashboard-empty-state"><strong>暂无课程</strong><p>当前没有可展示的课程。</p></div>';
                }
                if (stageList) {
                    stageList.innerHTML = scopedTodos.map(function (row) {
                        var status = getTodoStatus(row);
                        var dueLabel = row.stage.dueAt ? linkseePage.formatDate(row.stage.dueAt) : "--";
                        return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + linkseePage.escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</strong><span class="badge badge-pending">' + linkseePage.escapeHtml(status) + '</span></div><div class="muted">课程：' + linkseePage.escapeHtml(row.course.name || "--") + ' · 项目：' + linkseePage.escapeHtml(row.assignment.title || "--") + ' · 截止：' + linkseePage.escapeHtml(dueLabel) + '</div></div>';
                    }).join("") || '<div class="dashboard-empty-state"><strong>暂无项目阶段</strong><p>当前课程没有可展示的阶段。</p></div>';
                }
                if (artifactList) {
                    var submittedRows = scopedTodos.filter(function (row) { return row.submission; });
                    artifactList.innerHTML = submittedRows.map(function (row) {
                        var submittedAt = row.submission.submittedAt || row.submission.createdAt;
                        return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + linkseePage.escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</strong><span class="badge badge-active">' + linkseePage.escapeHtml(row.submission.status || "--") + '</span></div><div class="muted">课程：' + linkseePage.escapeHtml(row.course.name || "--") + ' · 提交时间：' + linkseePage.escapeHtml(submittedAt ? linkseePage.formatDateTime(submittedAt) : "--") + ' · attempt=' + linkseePage.escapeHtml(String(row.submission.attemptNo || "--")) + '</div></div>';
                    }).join("") || '<div class="dashboard-empty-state"><strong>暂无提交记录</strong><p>当前课程还没有阶段材料记录。</p></div>';
                }
            }

            renderCourseScope("");
            if (courseScopeSelect) {
                courseScopeSelect.addEventListener("change", function () {
                    renderCourseScope(courseScopeSelect.value);
                });
            }

            if (todoCountBadge) {
                todoCountBadge.textContent = String(activeTodoRows.length);
                todoCountBadge.hidden = activeTodoRows.length === 0;
            }
            if (todoMemoList) {
                todoMemoList.innerHTML = activeTodoRows.map(function (row) {
                    var status = getTodoStatus(row);
                    var dueLabel = row.stage.dueAt ? linkseePage.formatDate(row.stage.dueAt) : "--";
                    var isOverdue = row.stage.dueAt && new Date(row.stage.dueAt).getTime() < Date.now();
                    return '<article class="student-todo-note' + (isOverdue ? ' is-overdue' : '') + '"><div><strong>' + linkseePage.escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</strong><p>课程：' + linkseePage.escapeHtml(row.course.name || "--") + '</p><p>截止：' + linkseePage.escapeHtml(dueLabel) + ' · 状态：' + linkseePage.escapeHtml(status) + '</p></div><button class="btn btn-secondary student-todo-submit" type="button" data-submit-panel="true">提交</button></article>';
                }).join("") || '<div class="student-todo-empty"><strong>暂无待办</strong><p>当前没有需要处理的阶段任务。</p></div>';
                todoMemoList.querySelectorAll("[data-submit-panel]").forEach(function (button) {
                    button.addEventListener("click", function () {
                        var submitNav = document.querySelector('.side-nav .nav-item[data-target="panel-file-submit"]');
                        toggleTodoPopover(false);
                        if (submitNav) {
                            submitNav.click();
                            return;
                        }
                        window.location.href = "./submission-hub.html";
                    });
                });
            }
            if (gradeList) {
                gradeList.innerHTML = gradeRows.map(function (row) {
                    var score = row.grade.score === null || row.grade.score === undefined ? "--" : String(row.grade.score);
                    var publishedAt = row.grade.publishedAt || row.grade.updatedAt || row.grade.createdAt;
                    return '<div class="list-item"><div class="list-main"><div class="list-row"><strong>' + linkseePage.escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</strong><span class="chip">分数 ' + linkseePage.escapeHtml(score) + '</span></div><div class="muted">课程：' + linkseePage.escapeHtml(row.course.name || "--") + ' · 发布时间：' + linkseePage.escapeHtml(publishedAt ? linkseePage.formatDateTime(publishedAt) : "--") + '</div></div><span class="badge badge-approved">' + linkseePage.escapeHtml(row.grade.status || "--") + '</span></div>';
                }).join("");
            }
            if (gradeEmpty) {
                gradeEmpty.hidden = gradeRows.length > 0;
            }
        } catch (err) {
            if (todoMemoList) {
                todoMemoList.innerHTML = '<div class="student-todo-empty"><strong>加载失败</strong><p>' + linkseePage.escapeHtml(err.message || "请稍后重试") + '</p></div>';
            }
        }
    }

    window.initStudentDashboard = initStudentDashboard;
})();
