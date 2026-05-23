(function () {
    function escapeHtml(value) {
        return window.linkseePage && typeof window.linkseePage.escapeHtml === "function"
            ? window.linkseePage.escapeHtml(value)
            : String(value || "");
    }

    window.initAcademicDashboard = function initAcademicDashboard() {
        var list = document.getElementById("academicCourseList");
        var empty = document.getElementById("academicCourseEmpty");
        var courseMeta = document.getElementById("academicCourseMeta");
        var courseNote = document.getElementById("academicCourseNote");
        var courseSearch = document.getElementById("academicCourseSearch");
        var courseStatusFilter = document.getElementById("academicCourseStatusFilter");
        var monitorList = document.getElementById("academicMonitorList");
        var monitorEmpty = document.getElementById("academicMonitorEmpty");
        var monitorMeta = document.getElementById("academicMonitorMeta");
        var monitorNote = document.getElementById("academicMonitorNote");
        var editCourseSelect = document.getElementById("academicEditCourseSelect");
        var editCourseHint = document.getElementById("academicEditCourseHint");
        var editCourseMeta = document.getElementById("academicEditCourseMeta");
        var editCourseNo = document.getElementById("academicEditCourseNo");
        var editCourseName = document.getElementById("academicEditCourseName");
        var editCourseDescription = document.getElementById("academicEditCourseDescription");
        var editCourseStatus = document.getElementById("academicEditCourseStatus");
        var editSubmitBtn = document.getElementById("academicEditSubmitBtn");
        var editResetBtn = document.getElementById("academicEditResetBtn");
        var editResult = document.getElementById("academicEditResult");
        var staffCourseSelect = document.getElementById("academicStaffCourseSelect");
        var staffCourseHint = document.getElementById("academicStaffCourseHint");
        var staffTeacherId = document.getElementById("academicStaffTeacherId");
        var staffTeacherRole = document.getElementById("academicStaffTeacherRole");
        var staffAddTeacherBtn = document.getElementById("academicStaffAddTeacherBtn");
        var staffTeacherList = document.getElementById("academicStaffTeacherList");
        var staffAssistantList = document.getElementById("academicStaffAssistantList");
        var staffResult = document.getElementById("academicStaffResult");
        var batchDefaultPassword = document.getElementById("academicBatchDefaultPassword");
        var batchStudents = document.getElementById("academicBatchStudents");
        var batchTeachers = document.getElementById("academicBatchTeachers");
        var batchStudentSubmitBtn = document.getElementById("academicBatchStudentSubmitBtn");
        var batchStudentClearBtn = document.getElementById("academicBatchStudentClearBtn");
        var batchTeacherSubmitBtn = document.getElementById("academicBatchTeacherSubmitBtn");
        var batchTeacherClearBtn = document.getElementById("academicBatchTeacherClearBtn");
        var batchResult = document.getElementById("academicBatchResult");

        if (!list || !window.linkseeApi) {
            return;
        }

        var state = {
            courses: [],
            monitors: [],
            selectedEditCourseId: "",
            selectedStaffCourseId: "",
            selectedCourseTeachers: [],
            selectedCourseAssistants: [],
        };

        function openPanel(panelId) {
            var target = document.querySelector('.side-nav .nav-item[data-target="' + panelId + '"]');
            if (target) {
                target.click();
            }
        }

        function normalizeCsvLines(value) {
            return String(value || "")
                .split(/\r?\n/)
                .map(function (line) { return line.trim(); })
                .filter(Boolean)
                .map(function (line) {
                    return line.split(",").map(function (item) { return item.trim(); });
                });
        }

        function getStatusLabel(status) {
            if (status === "active") return "进行中";
            if (status === "draft") return "草稿";
            if (status === "archived") return "已存档";
            return status || "--";
        }

        function renderCourses() {
            var search = courseSearch && courseSearch.value ? courseSearch.value.trim().toLowerCase() : "";
            var statusMap = { "全部状态": "", "进行中": "active", "草稿": "draft", "已存档": "archived" };
            var selectedStatus = courseStatusFilter ? statusMap[courseStatusFilter.value] || "" : "";
            var filtered = state.courses.filter(function (course) {
                var matchesSearch = !search
                    || String(course.name || "").toLowerCase().indexOf(search) !== -1
                    || String(course.courseNo || course.id || "").toLowerCase().indexOf(search) !== -1;
                var matchesStatus = !selectedStatus || course.status === selectedStatus;
                return matchesSearch && matchesStatus;
            });

            list.querySelectorAll(".data-grid-row").forEach(function (row) {
                row.remove();
            });

            if (courseMeta) {
                courseMeta.innerHTML = '<span>当前结果 ' + filtered.length + ' / ' + state.courses.length + '</span><span class="dashboard-filter-tag">状态: ' + escapeHtml(courseStatusFilter ? courseStatusFilter.value : "全部状态") + '</span>';
            }
            if (courseNote) {
                courseNote.textContent = "课程列表来自 /api/v1/courses";
            }
            if (!filtered.length) {
                if (empty) empty.hidden = false;
                return;
            }
            if (empty) empty.hidden = true;

            list.insertAdjacentHTML("beforeend", filtered.map(function (course) {
                return [
                    '<div class="data-grid-row">',
                    '<span><span class="chip">' + escapeHtml(String(course.courseNo || course.id || "--")) + '</span></span>',
                    '<span><strong>' + escapeHtml(String(course.name || "--")) + "</strong></span>",
                    '<span>' + escapeHtml(String(course.academicYear || "--")) + " / " + escapeHtml(String(course.semester || "--")) + "</span>",
                    '<span><span class="badge badge-active">' + escapeHtml(getStatusLabel(course.status)) + "</span></span>",
                    '<span><button class="btn btn-secondary academic-row-action" type="button" data-course-edit="' + escapeHtml(String(course.id || "")) + '">编辑</button></span>',
                    "</div>",
                ].join("");
            }).join(""));

            document.querySelectorAll("[data-course-edit]").forEach(function (button) {
                button.addEventListener("click", function () {
                    state.selectedEditCourseId = button.getAttribute("data-course-edit") || "";
                    syncEditCourseForm();
                    openPanel("panel-courses");
                    var editSection = document.querySelector("#panel-courses .academic-course-editor-section");
                    if (editSection && typeof editSection.scrollIntoView === "function") {
                        editSection.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                });
            });

            syncCourseSelectors();
        }

        function renderMonitors() {
            if (monitorMeta) {
                var riskCount = state.monitors.filter(function (item) { return item.level === "high"; }).length;
                var watchCount = state.monitors.filter(function (item) { return item.level === "watch"; }).length;
                monitorMeta.innerHTML = '<span>已监控 ' + state.monitors.length + ' 个关键阶段</span><span class="dashboard-filter-tag">风险项: ' + riskCount + '</span><span class="dashboard-filter-tag">观察项: ' + watchCount + "</span>";
            }
            if (monitorList) {
                monitorList.innerHTML = state.monitors.map(function (item) {
                    var badgeClass = item.level === "high" ? "badge-error" : item.level === "watch" ? "badge-pending" : "badge-active";
                    var badgeText = item.level === "high" ? "高风险" : item.level === "watch" ? "需关注" : "正常推进";
                    return '<div class="config-item"><div class="config-meta"><strong>' + escapeHtml(item.title) + '</strong><span class="muted">' + escapeHtml(item.summary) + '</span></div><span class="badge ' + badgeClass + '">' + badgeText + "</span></div>";
                }).join("");
            }
            if (monitorEmpty) {
                monitorEmpty.hidden = state.monitors.length > 0;
            }
            if (monitorNote) {
                monitorNote.textContent = "监控数据来自 /api/v1/courses/:courseId/pipeline-health";
            }
        }

        function syncCourseSelectors() {
            var options = state.courses.map(function (course) {
                return '<option value="' + escapeHtml(String(course.id || "")) + '">' + escapeHtml(String(course.name || course.courseNo || course.id || "--")) + "</option>";
            }).join("");

            if (editCourseSelect) {
                editCourseSelect.innerHTML = options || '<option value="">暂无课程</option>';
                if (!state.selectedEditCourseId && state.courses[0]) {
                    state.selectedEditCourseId = String(state.courses[0].id || "");
                }
                if (state.selectedEditCourseId) {
                    editCourseSelect.value = state.selectedEditCourseId;
                }
            }
            if (staffCourseSelect) {
                staffCourseSelect.innerHTML = options || '<option value="">暂无课程</option>';
                if (!state.selectedStaffCourseId && state.courses[0]) {
                    state.selectedStaffCourseId = String(state.courses[0].id || "");
                }
                if (state.selectedStaffCourseId) {
                    staffCourseSelect.value = state.selectedStaffCourseId;
                }
            }
            syncEditCourseForm();
        }

        function syncEditCourseForm() {
            if (!editCourseSelect) return;

            var selectedId = state.selectedEditCourseId || editCourseSelect.value || "";
            var course = state.courses.find(function (item) {
                return String(item.id) === String(selectedId);
            }) || null;

            if (course) {
                state.selectedEditCourseId = String(course.id || "");
                editCourseSelect.value = state.selectedEditCourseId;
            }

            if (!course) {
                if (editCourseHint) editCourseHint.textContent = "请选择一门课程后编辑。";
                if (editCourseMeta) editCourseMeta.innerHTML = "<span>等待选择课程</span>";
                if (editCourseNo) editCourseNo.value = "";
                if (editCourseName) editCourseName.value = "";
                if (editCourseDescription) editCourseDescription.value = "";
                if (editCourseStatus) editCourseStatus.value = "draft";
                return;
            }

            if (editCourseHint) {
                editCourseHint.textContent = "只能修改课程名称、简介和状态。课程编号与学期信息只读。";
            }
            if (editCourseMeta) {
                editCourseMeta.innerHTML = [
                    '<span>课程编号: ' + escapeHtml(String(course.courseNo || course.id || "--")) + "</span>",
                    '<span class="dashboard-filter-tag">学年: ' + escapeHtml(String(course.academicYear || "--")) + "</span>",
                    '<span class="dashboard-filter-tag">学期: ' + escapeHtml(String(course.semester || "--")) + "</span>",
                ].join("");
            }
            if (editCourseNo) editCourseNo.value = String(course.courseNo || course.id || "");
            if (editCourseName) editCourseName.value = String(course.name || "");
            if (editCourseDescription) editCourseDescription.value = String(course.description || "");
            if (editCourseStatus) editCourseStatus.value = String(course.status || "draft");
        }

        function showResult(container, title, message, isError) {
            if (!container) return;
            container.hidden = false;
            container.innerHTML = "<strong>" + escapeHtml(title) + "</strong><p>" + escapeHtml(message) + "</p>";
            container.style.borderColor = isError ? "rgba(220, 38, 38, 0.3)" : "";
        }

        function hideResult(container) {
            if (!container) return;
            container.hidden = true;
            container.innerHTML = "";
            container.style.borderColor = "";
        }

        function showBatchResult(payload, typeLabel) {
            if (!batchResult) return;
            var data = payload && payload.data ? payload.data : {};
            var failed = Array.isArray(data.failed) ? data.failed : [];
            batchResult.hidden = false;
            batchResult.innerHTML = [
                "<strong>" + escapeHtml(typeLabel + "批量开通完成") + "</strong>",
                "<p>成功创建 " + escapeHtml(String(data.createdCount || 0)) + " 条，失败 " + escapeHtml(String(data.failedCount || 0)) + " 条，默认密码：" + escapeHtml(String(data.defaultPassword || "后端未返回")) + "</p>",
                failed.length ? "<p>失败明细：" + escapeHtml(failed.map(function (item) { return (item.id || "--") + " - " + (item.reason || "unknown"); }).join("；")) + "</p>" : "",
            ].join("");
        }

        function renderStaffLists() {
            if (staffCourseHint) {
                staffCourseHint.textContent = state.selectedStaffCourseId ? "当前课程的教师和助教关系来自实时接口。" : "选择课程后查看当前教师与助教。";
            }
            if (staffTeacherList) {
                staffTeacherList.innerHTML = state.selectedCourseTeachers.length
                    ? state.selectedCourseTeachers.map(function (teacher) {
                        var userId = teacher.user && teacher.user.id ? teacher.user.id : "--";
                        var name = teacher.user && teacher.user.profile && teacher.user.profile.realName ? teacher.user.profile.realName : "--";
                        var role = teacher.role === "lead" ? "主讲" : "协同";
                        return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + escapeHtml(name) + '</strong><span class="badge badge-active">' + escapeHtml(role) + '</span></div><div class="muted">用户 ID：' + escapeHtml(userId) + '</div><div class="dashboard-panel-actions"><button class="btn btn-secondary" type="button" data-teacher-role="' + escapeHtml(userId) + '" data-next-role="' + (teacher.role === "lead" ? "co" : "lead") + '">' + (teacher.role === "lead" ? "改为协同" : "改为主讲") + '</button><button class="btn btn-secondary" type="button" data-teacher-remove="' + escapeHtml(userId) + '">移出课程</button></div></div>';
                    }).join("")
                    : '<div class="dashboard-empty-state"><strong>暂无教师绑定</strong><p>当前课程还没有配置教师。</p></div>';
            }
            if (staffAssistantList) {
                staffAssistantList.innerHTML = state.selectedCourseAssistants.length
                    ? state.selectedCourseAssistants.map(function (assistant) {
                        var userId = assistant.assistantUserId || assistant.assistant && assistant.assistant.id || "--";
                        var name = assistant.assistant && assistant.assistant.profile && assistant.assistant.profile.realName ? assistant.assistant.profile.realName : "--";
                        return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + escapeHtml(name) + '</strong><span class="badge badge-pending">助教</span></div><div class="muted">用户 ID：' + escapeHtml(userId) + " · 绑定教师：" + escapeHtml(assistant.teacherUserId || "--") + "</div></div>";
                    }).join("")
                    : '<div class="dashboard-empty-state"><strong>暂无助教绑定</strong><p>当前课程还没有课程教师配置助教。</p></div>';
            }

            document.querySelectorAll("[data-teacher-role]").forEach(function (button) {
                button.addEventListener("click", function () {
                    var teacherId = button.getAttribute("data-teacher-role") || "";
                    var nextRole = button.getAttribute("data-next-role") || "co";
                    if (!state.selectedStaffCourseId || !teacherId) return;
                    hideResult(staffResult);
                    window.linkseeApi.patchJson("/api/v1/courses/" + encodeURIComponent(state.selectedStaffCourseId) + "/teachers/" + encodeURIComponent(teacherId), {
                        role: nextRole,
                    }).then(function () {
                        showResult(staffResult, "更新成功", "教师角色已调整。", false);
                        return refreshStaffData();
                    }).catch(function (err) {
                        showResult(staffResult, "更新失败", err.message || "教师角色更新失败。", true);
                    });
                });
            });

            document.querySelectorAll("[data-teacher-remove]").forEach(function (button) {
                button.addEventListener("click", function () {
                    var teacherId = button.getAttribute("data-teacher-remove") || "";
                    if (!state.selectedStaffCourseId || !teacherId) return;
                    hideResult(staffResult);
                    window.linkseeApi.request("/api/v1/courses/" + encodeURIComponent(state.selectedStaffCourseId) + "/teachers/" + encodeURIComponent(teacherId), {
                        method: "DELETE",
                        headers: window.linkseeApi.authHeaders(),
                    }).then(function () {
                        showResult(staffResult, "移除成功", "教师已移出当前课程。", false);
                        return refreshStaffData();
                    }).catch(function (err) {
                        showResult(staffResult, "移除失败", err.message || "教师移出失败。", true);
                    });
                });
            });
        }

        async function refreshStaffData() {
            if (!state.selectedStaffCourseId) {
                state.selectedCourseTeachers = [];
                state.selectedCourseAssistants = [];
                renderStaffLists();
                return;
            }

            var results = await Promise.all([
                window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.selectedStaffCourseId) + "/teachers").catch(function () { return { data: [] }; }),
                window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.selectedStaffCourseId) + "/assistants").catch(function () { return { data: [] }; }),
            ]);

            state.selectedCourseTeachers = Array.isArray(results[0].data) ? results[0].data : [];
            state.selectedCourseAssistants = Array.isArray(results[1].data) ? results[1].data : [];
            renderStaffLists();
        }

        async function refreshAcademicData() {
            state.monitors = [];

            var payload = await window.linkseeApi.getJson("/api/v1/courses");
            state.courses = Array.isArray(payload.data) ? payload.data : [];
            renderCourses();

            await Promise.all(state.courses.map(function (course) {
                return window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(course.id) + "/pipeline-health").catch(function () {
                    return { data: { stages: [] } };
                }).then(function (result) {
                    var pipelineStages = result.data && Array.isArray(result.data.stages) ? result.data.stages : [];
                    pipelineStages.forEach(function (stage) {
                        var pending = Number(stage.pendingReviewCount || 0);
                        var needsChanges = Number(stage.needsChangesCount || 0);
                        var approved = Number(stage.approvedCount || 0);
                        var level = pending > 0 && needsChanges > 0 ? "high" : (pending > 0 || needsChanges > 0 ? "watch" : "ok");
                        state.monitors.push({
                            level: level,
                            title: course.name + " · 阶段 " + stage.stageNo + " · " + stage.stageTitle,
                            summary: "待评审 " + pending + " · 待修改 " + needsChanges + " · 已通过 " + approved,
                        });
                    });
                });
            }));

            renderMonitors();
            await refreshStaffData();
        }

        Promise.resolve()
            .then(refreshAcademicData)
            .catch(function () {
                if (empty) {
                    empty.hidden = false;
                    empty.querySelector("strong").textContent = "课程加载失败";
                    empty.querySelector("p").textContent = "请检查后端服务是否启动。";
                }
            });

        if (courseSearch) courseSearch.addEventListener("input", renderCourses);
        if (courseStatusFilter) courseStatusFilter.addEventListener("change", renderCourses);

        if (editCourseSelect) {
            editCourseSelect.addEventListener("change", function () {
                state.selectedEditCourseId = editCourseSelect.value || "";
                hideResult(editResult);
                syncEditCourseForm();
            });
        }

        if (staffCourseSelect) {
            staffCourseSelect.addEventListener("change", function () {
                state.selectedStaffCourseId = staffCourseSelect.value || "";
                hideResult(staffResult);
                refreshStaffData().catch(function (err) {
                    showResult(staffResult, "加载失败", err.message || "课程教师数据加载失败。", true);
                });
            });
        }

        if (editResetBtn) {
            editResetBtn.addEventListener("click", function () {
                hideResult(editResult);
                syncEditCourseForm();
            });
        }

        if (editSubmitBtn) {
            editSubmitBtn.addEventListener("click", function () {
                var selectedId = state.selectedEditCourseId || editCourseSelect && editCourseSelect.value;
                if (!selectedId) {
                    showResult(editResult, "无法保存", "请先选择课程。", true);
                    return;
                }

                hideResult(editResult);
                window.linkseeApi.patchJson("/api/v1/courses/" + encodeURIComponent(selectedId), {
                    name: editCourseName ? editCourseName.value.trim() : "",
                    description: editCourseDescription ? editCourseDescription.value.trim() : "",
                    status: editCourseStatus ? editCourseStatus.value : "draft",
                }).then(function () {
                    showResult(editResult, "保存成功", "课程信息已更新。", false);
                    return refreshAcademicData();
                }).catch(function (err) {
                    showResult(editResult, "保存失败", err.message || "课程更新失败。", true);
                });
            });
        }

        if (staffAddTeacherBtn) {
            staffAddTeacherBtn.addEventListener("click", function () {
                var selectedCourseId = state.selectedStaffCourseId || staffCourseSelect && staffCourseSelect.value;
                var teacherId = staffTeacherId ? staffTeacherId.value.trim() : "";
                var roleValue = staffTeacherRole ? staffTeacherRole.value : "lead";
                if (!selectedCourseId) {
                    showResult(staffResult, "无法添加", "请先选择课程。", true);
                    return;
                }
                if (!teacherId) {
                    showResult(staffResult, "无法添加", "请输入教师用户 ID。", true);
                    return;
                }

                hideResult(staffResult);
                window.linkseeApi.postJson("/api/v1/courses/" + encodeURIComponent(selectedCourseId) + "/teachers", {
                    userId: teacherId,
                    role: roleValue,
                }).then(function () {
                    if (staffTeacherId) staffTeacherId.value = "";
                    showResult(staffResult, "添加成功", "教师已加入当前课程。", false);
                    return refreshAcademicData();
                }).catch(function (err) {
                    showResult(staffResult, "添加失败", err.message || "教师绑定失败。", true);
                });
            });
        }

        if (batchStudentClearBtn) {
            batchStudentClearBtn.addEventListener("click", function () {
                if (batchStudents) batchStudents.value = "";
                hideResult(batchResult);
            });
        }

        if (batchTeacherClearBtn) {
            batchTeacherClearBtn.addEventListener("click", function () {
                if (batchTeachers) batchTeachers.value = "";
                hideResult(batchResult);
            });
        }

        if (batchStudentSubmitBtn) {
            batchStudentSubmitBtn.addEventListener("click", function () {
                var rows = normalizeCsvLines(batchStudents ? batchStudents.value : "");
                if (!rows.length) {
                    showResult(batchResult, "无法创建", "请先输入学生批量数据。", true);
                    return;
                }

                hideResult(batchResult);
                var students = rows.map(function (cols) {
                    return {
                        id: cols[0] || "",
                        realName: cols[1] || "",
                        stuNo: cols[2] || "",
                        grade: cols[3] ? Number(cols[3]) : "",
                        cohort: cols[4] ? Number(cols[4]) : "",
                        major: cols[5] || "",
                        adminClass: cols[6] || "",
                    };
                });
                var body = { students: students };
                if (batchDefaultPassword && batchDefaultPassword.value.trim()) {
                    body.defaultPassword = batchDefaultPassword.value.trim();
                }

                window.linkseeApi.postJson("/api/v1/users/batch/students", body)
                    .then(function (payload) {
                        showBatchResult(payload, "学生");
                        if (batchStudents) batchStudents.value = "";
                    })
                    .catch(function (err) {
                        showResult(batchResult, "创建失败", err.message || "学生批量建号失败。", true);
                    });
            });
        }

        if (batchTeacherSubmitBtn) {
            batchTeacherSubmitBtn.addEventListener("click", function () {
                var rows = normalizeCsvLines(batchTeachers ? batchTeachers.value : "");
                if (!rows.length) {
                    showResult(batchResult, "无法创建", "请先输入教师批量数据。", true);
                    return;
                }

                hideResult(batchResult);
                var teachers = rows.map(function (cols) {
                    return {
                        id: cols[0] || "",
                        realName: cols[1] || "",
                        teacherNo: cols[2] || "",
                        title: cols[3] || "",
                        college: cols[4] || "",
                        researchDirection: cols[5] || "",
                    };
                });
                var body = { teachers: teachers };
                if (batchDefaultPassword && batchDefaultPassword.value.trim()) {
                    body.defaultPassword = batchDefaultPassword.value.trim();
                }

                window.linkseeApi.postJson("/api/v1/users/batch/teachers", body)
                    .then(function (payload) {
                        showBatchResult(payload, "教师");
                        if (batchTeachers) batchTeachers.value = "";
                    })
                    .catch(function (err) {
                        showResult(batchResult, "创建失败", err.message || "教师批量建号失败。", true);
                    });
            });
        }
    };
})();
