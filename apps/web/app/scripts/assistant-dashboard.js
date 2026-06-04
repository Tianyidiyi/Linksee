(function () {
    function initAssistantDashboard() {
        var state = {
            courses: [],
            reviews: [],
            grades: [],
            selected: null,
            currentCourseId: "",
            currentGradeId: "",
        };

        function q(selector) {
            return document.querySelector(selector);
        }

        function formatDate(value) {
            if (window.linkseePage && typeof window.linkseePage.formatDateTime === "function") {
                return window.linkseePage.formatDateTime(value);
            }
            if (!value) return "--";
            var date = new Date(value);
            return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
        }

        function pickCourseStatus(course) {
            if (!course || !course.status) return "--";
            if (course.status === "active") return "进行中";
            if (course.status === "draft") return "草稿";
            if (course.status === "archived") return "已归档";
            return course.status;
        }

        function rowsOf(payload) {
            return Array.isArray(payload && payload.data) ? payload.data : [];
        }

        function setResult(title, message, isError) {
            var node = q("#assistantActionResult");
            if (!node) return;
            node.hidden = false;
            node.classList.toggle("is-error", Boolean(isError));
            node.innerHTML = "<strong>" + linkseePage.escapeHtml(title) + "</strong><p>" + linkseePage.escapeHtml(message || "") + "</p>";
        }

        function clearResult() {
            var node = q("#assistantActionResult");
            if (!node) return;
            node.hidden = true;
            node.classList.remove("is-error");
            node.innerHTML = "";
        }

        function currentCourseName() {
            var course = state.courses.find(function (row) { return String(row.id) === String(state.currentCourseId); });
            return course ? (course.name || course.courseNo || course.id) : "--";
        }

        function renderCourseOptions() {
            var options = state.courses.map(function (course) {
                return '<option value="' + linkseePage.escapeHtml(course.id) + '">' + linkseePage.escapeHtml(course.name || course.courseNo || course.id) + '</option>';
            }).join("");
            q("#assistantCourseSelect").innerHTML = options || '<option value="">暂无绑定课程</option>';
            q("#assistantExportCourse").innerHTML = options || '<option value="">暂无绑定课程</option>';
            if (!state.currentCourseId && state.courses[0]) {
                state.currentCourseId = String(state.courses[0].id);
            }
            q("#assistantCourseSelect").value = state.currentCourseId;
            q("#assistantExportCourse").value = state.currentCourseId;
        }

        function renderCourseList() {
            var list = q("#assistantCourseList");
            list.innerHTML = state.courses.map(function (course) {
                return '<div class="list-item dashboard-list-item-vertical"><div class="dashboard-split-row"><strong>' + linkseePage.escapeHtml(course.name || "--") + '</strong><span class="badge badge-active">' + linkseePage.escapeHtml(pickCourseStatus(course)) + '</span></div><div class="muted">课程编号：' + linkseePage.escapeHtml(course.courseNo || course.id || "--") + ' · 学年学期：' + linkseePage.escapeHtml(String(course.academicYear || "--")) + ' / ' + linkseePage.escapeHtml(String(course.semester || "--")) + '</div></div>';
            }).join("") || '<div class="dashboard-empty-state"><strong>暂无负责课程</strong><p>当前账号尚未绑定课程。</p></div>';
        }

        function renderQueue() {
            var list = q("#assistantSubmissionList");
            var empty = q("#assistantSubmissionEmpty");
            var reviewing = state.reviews.filter(function (row) { return row.status === "under_review"; }).length;
            var submitted = state.reviews.filter(function (row) { return row.status === "submitted"; }).length;
            q("#assistantCourseCount").textContent = String(state.courses.length);
            q("#assistantNeedCheckCount").textContent = String(state.reviews.length);
            q("#assistantPendingCount").textContent = "当前待处理 " + state.reviews.length + " 条";
            q("#assistantReviewCount").textContent = "评审中: " + reviewing;
            q("#assistantNewCount").textContent = "新提交: " + submitted;

            if (!state.reviews.length) {
                list.innerHTML = "";
                empty.hidden = false;
                return;
            }
            empty.hidden = true;
            list.innerHTML = state.reviews.map(function (review) {
                var stageTitle = review.stage && review.stage.title ? review.stage.title : "未命名阶段";
                var groupNo = review.group && (review.group.groupNo || review.group.name) ? (review.group.groupNo || review.group.name) : "--";
                var selected = state.selected && String(state.selected.id) === String(review.id);
                return '<div class="list-item dashboard-list-item-interactive' + (selected ? ' dashboard-list-item-selected' : '') + '" data-submission-id="' + linkseePage.escapeHtml(review.id) + '"><div class="list-main"><div class="list-row"><strong>' + linkseePage.escapeHtml(stageTitle) + '</strong><span class="chip">' + linkseePage.escapeHtml(currentCourseName()) + '</span></div><div class="muted">状态：' + linkseePage.escapeHtml(review.status || "--") + ' · 小组：' + linkseePage.escapeHtml(String(groupNo)) + ' · 提交时间：' + linkseePage.escapeHtml(formatDate(review.submittedAt || review.createdAt)) + '</div></div><span class="badge badge-pending">' + linkseePage.escapeHtml(review.status || "--") + '</span></div>';
            }).join("");
            document.querySelectorAll("#assistantSubmissionList .list-item").forEach(function (item) {
                item.addEventListener("click", function () {
                    selectReview(item.getAttribute("data-submission-id"));
                });
            });
        }

        function renderHistory() {
            var list = q("#assistantHistoryList");
            var empty = q("#assistantHistoryEmpty");
            if (!state.grades.length) {
                list.innerHTML = "";
                empty.hidden = false;
                return;
            }
            empty.hidden = true;
            list.innerHTML = state.grades.slice(0, 20).map(function (grade) {
                var score = grade.score === null || grade.score === undefined ? "--" : String(grade.score);
                var stageTitle = grade.stage && grade.stage.title ? grade.stage.title : "未命名阶段";
                var statusLabel = grade.status === "published" ? "已发布" : "草稿";
                return '<div class="list-item"><div class="list-main"><div class="list-row"><strong>' + linkseePage.escapeHtml(stageTitle) + '</strong><span class="chip">分数 ' + linkseePage.escapeHtml(score) + '</span></div><div class="muted">课程：' + linkseePage.escapeHtml(currentCourseName()) + ' · 更新时间：' + linkseePage.escapeHtml(formatDate(grade.updatedAt || grade.createdAt)) + '</div></div><span class="badge badge-approved">' + linkseePage.escapeHtml(statusLabel) + '</span></div>';
            }).join("");
        }

        function selectReview(submissionId) {
            clearResult();
            state.selected = state.reviews.find(function (row) { return String(row.id) === String(submissionId); }) || null;
            state.currentGradeId = "";
            renderQueue();
            renderSelected();
        }

        function renderSelected() {
            var context = q("#assistantReviewContext");
            var startBtn = q("#assistantStartBtn");
            var reviewBtn = q("#assistantReviewSaveBtn");
            var draftBtn = q("#assistantDraftSaveBtn");
            if (!state.selected) {
                context.innerHTML = "请选择左侧提交";
                q("#assistantSubmissionId").value = "";
                startBtn.disabled = true;
                reviewBtn.disabled = true;
                draftBtn.disabled = true;
                return;
            }
            var review = state.selected;
            var stageTitle = review.stage && review.stage.title ? review.stage.title : "未命名阶段";
            var groupNo = review.group && (review.group.groupNo || review.group.name) ? (review.group.groupNo || review.group.name) : "--";
            q("#assistantSubmissionId").value = review.id || "";
            q("#assistantReviewId").value = "";
            q("#assistantCommentInput").value = "";
            q("#assistantScoreInput").value = "";
            context.innerHTML = '<strong>' + linkseePage.escapeHtml(stageTitle) + '</strong><p>课程：' + linkseePage.escapeHtml(currentCourseName()) + ' · 小组：' + linkseePage.escapeHtml(String(groupNo)) + ' · 提交人：' + linkseePage.escapeHtml(review.submittedBy || "--") + ' · 状态：' + linkseePage.escapeHtml(review.status || "--") + '</p>';
            startBtn.disabled = review.status !== "submitted";
            reviewBtn.disabled = false;
            draftBtn.disabled = review.status !== "approved" && review.status !== "reviewed";
        }

        async function loadCourseData(keepSelection) {
            if (!state.currentCourseId) {
                state.reviews = [];
                state.grades = [];
                state.selected = null;
                renderQueue();
                renderHistory();
                renderSelected();
                return;
            }
            var previousId = keepSelection && state.selected ? String(state.selected.id) : "";
            var payloads = await Promise.all([
                window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.currentCourseId) + "/pending-reviews"),
                window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.currentCourseId) + "/grades").catch(function () { return { data: [] }; }),
            ]);
            state.reviews = rowsOf(payloads[0]);
            state.grades = rowsOf(payloads[1]).sort(function (a, b) {
                return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
            });
            state.selected = previousId ? state.reviews.find(function (row) { return String(row.id) === previousId; }) || state.selected : state.reviews[0] || null;
            renderQueue();
            renderHistory();
            renderSelected();
        }

        async function loadAll() {
            var payload = await window.linkseeApi.getJson("/api/v1/courses");
            state.courses = rowsOf(payload);
            renderCourseOptions();
            renderCourseList();
            await loadCourseData(false);
        }

        q("#assistantCourseSelect").addEventListener("change", function () {
            state.currentCourseId = q("#assistantCourseSelect").value;
            q("#assistantExportCourse").value = state.currentCourseId;
            state.selected = null;
            loadCourseData(false).catch(function (err) { setResult("加载失败", err.message, true); });
        });
        q("#assistantReloadBtn").addEventListener("click", function () {
            loadCourseData(true).catch(function (err) { setResult("刷新失败", err.message, true); });
        });
        q("#assistantStartBtn").addEventListener("click", function () {
            var id = q("#assistantSubmissionId").value.trim();
            if (!id) return setResult("无法开始", "请先选择或输入 Submission ID", true);
            window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(id) + "/reviews/start", {})
                .then(function () {
                    setResult("已开始检查", "提交已进入评审中。", false);
                    return loadCourseData(true);
                })
                .catch(function (err) { setResult("开始失败", err.message, true); });
        });
        q("#assistantReviewSaveBtn").addEventListener("click", function () {
            var id = q("#assistantSubmissionId").value.trim();
            var comment = q("#assistantCommentInput").value.trim();
            var status = q("#assistantReviewStatus").value;
            if (!id) return setResult("无法提交", "请先选择或输入 Submission ID", true);
            window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(id) + "/reviews", { status: status, comment: comment })
                .then(function () {
                    setResult("复核已提交", "复核结论已保存。", false);
                    if (state.selected && String(state.selected.id) === String(id)) {
                        state.selected.status = status === "approved" ? "approved" : status;
                        q("#assistantDraftSaveBtn").disabled = status !== "approved";
                    }
                    return status === "approved" ? Promise.resolve() : loadCourseData(false);
                })
                .catch(function (err) { setResult("提交失败", err.message, true); });
        });
        q("#assistantReviewUpdateBtn").addEventListener("click", function () {
            var reviewId = q("#assistantReviewId").value.trim();
            var comment = q("#assistantCommentInput").value.trim();
            var status = q("#assistantReviewStatus").value;
            if (!reviewId) return setResult("无法更新", "请填写 Review ID", true);
            window.linkseeApi.patchJson("/api/v1/reviews/" + encodeURIComponent(reviewId), { status: status, comment: comment })
                .then(function () {
                    setResult("复核已更新", "复核意见已保存。", false);
                    return loadCourseData(true);
                })
                .catch(function (err) { setResult("更新失败", err.message, true); });
        });
        q("#assistantDraftSaveBtn").addEventListener("click", function () {
            var id = q("#assistantSubmissionId").value.trim();
            var score = Number(q("#assistantScoreInput").value);
            if (!id) return setResult("无法保存", "请先选择或输入 Submission ID", true);
            window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(id) + "/grade-drafts", { score: score })
                .then(function (payload) {
                    state.currentGradeId = payload && payload.data ? payload.data.id : "";
                    setResult("草稿已保存", "成绩草稿已保存，发布仍需教师完成。", false);
                    return loadCourseData(true);
                })
                .catch(function (err) { setResult("保存失败", err.message, true); });
        });
        q("#assistantMarkReviewedBtn").addEventListener("click", function () {
            var id = q("#assistantSubmissionId").value.trim();
            if (!id) return setResult("无法标记", "请填写 Submission ID", true);
            window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(id) + "/mark-reviewed", {})
                .then(function () {
                    setResult("已标记", "提交已标记为已阅。", false);
                    return loadCourseData(false);
                })
                .catch(function (err) { setResult("标记失败", err.message, true); });
        });

        function downloadWithAuth(path, filename) {
            return window.linkseeApi.getBlob(path)
                .then(function (blob) {
                    var url = URL.createObjectURL(blob);
                    var link = document.createElement("a");
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                });
        }

        q("#assistantExportReviews").addEventListener("click", function () {
            var courseId = q("#assistantExportCourse").value;
            if (!courseId) return;
            downloadWithAuth("/api/v1/courses/" + encodeURIComponent(courseId) + "/reviews/export", "reviews-export.csv")
                .catch(function (err) { setResult("导出失败", err.message, true); });
        });
        q("#assistantExportGrades").addEventListener("click", function () {
            var courseId = q("#assistantExportCourse").value;
            if (!courseId) return;
            downloadWithAuth("/api/v1/courses/" + encodeURIComponent(courseId) + "/grades/export", "grades-export.csv")
                .catch(function (err) { setResult("导出失败", err.message, true); });
        });

        loadAll().catch(function (err) {
            setResult("加载失败", err.message || "请检查后端服务是否正常", true);
        });
    }

    window.initAssistantDashboard = initAssistantDashboard;
})();
