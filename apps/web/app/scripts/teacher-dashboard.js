(function () {
    function mergeTeacherReviewWorkbench() {
        var workbench = document.getElementById("panel-review-workbench");
        var grading = document.getElementById("panel-review-detail-source");
        if (!workbench) return;

        var body = workbench.querySelector(".dashboard-card-body");
        if (!body || body.querySelector(".teacher-review-workbench")) {
            if (grading) grading.remove();
            return;
        }

        var toolbar = workbench.querySelector(".dashboard-toolbar-row");
        var gradingBody = grading ? grading.querySelector(".dashboard-card-body") : null;
        var layout = document.createElement("div");
        var queue = document.createElement("section");
        var editor = document.createElement("section");

        layout.className = "teacher-review-workbench";
        queue.className = "dashboard-subcard teacher-review-queue";
        editor.className = "teacher-review-editor";

        if (toolbar) {
            queue.appendChild(toolbar);
        }
        while (body.firstChild) {
            queue.appendChild(body.firstChild);
        }
        if (gradingBody) {
            while (gradingBody.firstChild) {
                editor.appendChild(gradingBody.firstChild);
            }
        }

        layout.appendChild(queue);
        layout.appendChild(editor);
        body.appendChild(layout);
        if (grading) grading.remove();
    }

    function bindPanelLinks() {
        document.querySelectorAll("[data-panel-link]").forEach(function (button) {
            if (button.dataset.boundPanelLink === "1") return;
            button.dataset.boundPanelLink = "1";
            button.addEventListener("click", function () {
                var targetId = button.getAttribute("data-panel-link");
                var sideNavButton = document.querySelector('.side-nav .nav-item[data-target="' + targetId + '"]');
                if (sideNavButton) {
                    sideNavButton.click();
                }
            });
        });
    }

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.from((root || document).querySelectorAll(selector));
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (ch) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            }[ch];
        });
    }

    function formatDate(value) {
        if (!value) {
            return "--";
        }
        if (window.linkseePage && typeof window.linkseePage.formatDateTime === "function") {
            return window.linkseePage.formatDateTime(value);
        }
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleString("zh-CN", { hour12: false });
    }

    function getCourseId(course) {
        return course && (course.id || course.courseId || course.course_id);
    }

    function getCourseLabel(course) {
        return (course && (course.name || course.title || course.courseName || course.courseTitle)) || "未命名课程";
    }

    function getReviewStage(review) {
        return review && (review.stage || review.submission && review.submission.stage) || {};
    }

    function getReviewGroup(review) {
        return review && (review.group || review.submission && review.submission.group) || {};
    }

    function ensureCourseIdState(state, courseId) {
        if (courseId && state.courseId !== courseId) {
            state.courseId = courseId;
            state.pendingReviews = [];
            state.selectedReviewId = "";
            state.selectedReview = null;
        }
    }

    function showResult(message, isError) {
        var result = qs("#teacherActionResult");
        if (!result) {
            return;
        }
        result.hidden = false;
        result.innerHTML = "<strong>" + escapeHtml(isError ? "操作失败" : "操作成功") + "</strong><p>" + escapeHtml(message) + "</p>";
        result.classList.toggle("is-error", Boolean(isError));
    }

    function hideResult() {
        var result = qs("#teacherActionResult");
        if (!result) {
            return;
        }
        result.hidden = true;
        result.classList.remove("is-error");
        result.innerHTML = "";
    }

    function sortPendingReviews(state) {
        var sortSelect = qs("#teacherQueueSort");
        var sortMode = sortSelect ? sortSelect.value : "oldest";
        state.pendingReviews.sort(function (left, right) {
            var leftTime = new Date(left.submittedAt || left.createdAt || 0).getTime();
            var rightTime = new Date(right.submittedAt || right.createdAt || 0).getTime();
            return sortMode === "latest" ? rightTime - leftTime : leftTime - rightTime;
        });
    }

    function renderCourseOptions(state) {
        var courseSelect = qs("#teacherCourseSelect");
        if (!courseSelect) {
            return;
        }

        var options = ['<option value="">选择课程</option>']
            .concat(state.courses.map(function (course) {
                var courseId = getCourseId(course);
                return '<option value="' + escapeHtml(courseId) + '">' + escapeHtml(getCourseLabel(course)) + '</option>';
            }))
            .join("");

        courseSelect.innerHTML = options;
        if (state.courseId) {
            courseSelect.value = state.courseId;
        } else if (state.courses[0]) {
            courseSelect.value = getCourseId(state.courses[0]) || "";
            state.courseId = courseSelect.value;
        }
    }

    function renderOverview(state) {
        var overview = qs("#panel-overview .dashboard-stat-grid-thirds");
        if (!overview) {
            return;
        }

        var totalCourses = state.courses.length;
        var pendingCount = state.pendingReviews.length;
        var activeCourses = state.courses.filter(function (course) {
            return !course.status || course.status === "active" || course.status === "ongoing" || course.status === "进行中";
        }).length;

        var stats = overview.querySelectorAll(".stat strong");
        if (stats[0]) {
            stats[0].textContent = String(activeCourses || totalCourses || 0);
        }
        if (stats[1]) {
            stats[1].textContent = String(state.pipelineHealth ? state.pipelineHealth.pendingStageCount : 0);
        }
        if (stats[2]) {
            stats[2].textContent = String(pendingCount);
        }
    }

    function renderReviewList(state) {
        var list = qs("#teacherReviewList");
        var emptyState = qs("#teacherReviewEmpty");
        if (!list) {
            return;
        }

        if (!state.pendingReviews.length) {
            list.innerHTML = "";
            if (emptyState) {
                emptyState.hidden = false;
            }
            return;
        }

        sortPendingReviews(state);
        if (emptyState) {
            emptyState.hidden = true;
        }

        list.innerHTML = state.pendingReviews.map(function (review) {
            var stage = getReviewStage(review);
            var group = getReviewGroup(review);
            var submittedAt = formatDate(review.submittedAt || review.createdAt);
            var label = review.status === "reviewing" ? "评审中" : review.status === "submitted" ? "新提交" : "待批改";
            return [
                '<div class="list-item dashboard-list-item-interactive' + (state.selectedReviewId === review.id ? " dashboard-list-item-selected" : "") + '" data-review-id="' + escapeHtml(review.id) + '">',
                '<div class="list-main">',
                '<div class="list-row"><strong>' + escapeHtml(stage.title || review.title || "未命名提交") + '</strong><span class="chip">小组 ' + escapeHtml(group.groupNo || group.name || "--") + '</span></div>',
                '<div class="muted">状态：' + escapeHtml(review.status || "submitted") + ' · 提交时间：' + escapeHtml(submittedAt) + ' · 学生：' + escapeHtml(review.submittedBy || "--") + '</div>',
                '</div>',
                '<span class="badge ' + (state.selectedReviewId === review.id ? "badge-pending" : "badge-submitted") + '">' + escapeHtml(label) + '</span>',
                '</div>',
            ].join("");
        }).join("");

        qsa("#teacherReviewList .list-item").forEach(function (item) {
            item.addEventListener("click", function () {
                selectReview(state, item.getAttribute("data-review-id"));
            });
        });
    }

    function renderSelectedReview(state) {
        var review = state.selectedReview;
        var target = qs("#selectedReviewContext");
        var attachmentLink = qs("#selectedReviewAttachment");
        var scoreInput = qs("#gradeScoreInput");
        var feedbackInput = qs("#gradeFeedbackInput");
        var publishBtn = qs("#publishGradeBtn");
        var startReviewBtn = qs("#startReviewBtn");
        var saveReviewBtn = qs("#saveReviewBtn");
        var saveDraftBtn = qs("#saveDraftBtn");

        if (!target) {
            return;
        }

        if (!review) {
            target.innerHTML = '<div class="muted">请先从左侧选择一条待批改提交。</div>';
            if (attachmentLink) {
                attachmentLink.removeAttribute("href");
            }
            return;
        }

        var stage = getReviewStage(review);
        var group = getReviewGroup(review);
        target.innerHTML = [
            '<div class="list-item dashboard-list-item-static">',
            '<div class="review-meta">',
            '<strong>' + escapeHtml(stage.title || review.title || "未命名提交") + '</strong>',
            '<span class="muted">提交人: ' + escapeHtml(review.submittedBy || "--") + '</span>',
            '<span class="muted">小组: ' + escapeHtml(group.groupNo || group.name || "--") + '</span>',
            '<span class="muted">提交时间: ' + escapeHtml(formatDate(review.submittedAt || review.createdAt)) + '</span>',
            '</div>',
            '</div>',
        ].join("");

        if (attachmentLink) {
            var targetUrl = review.attachmentUrl || review.url || "";
            if (targetUrl) {
                attachmentLink.href = targetUrl;
                attachmentLink.target = "_blank";
                attachmentLink.removeAttribute("aria-disabled");
            } else {
                attachmentLink.removeAttribute("href");
                attachmentLink.removeAttribute("target");
                attachmentLink.setAttribute("aria-disabled", "true");
            }
        }

        if (scoreInput) {
            scoreInput.value = review.grade?.score ?? review.score ?? "";
        }
        if (feedbackInput) {
            feedbackInput.value = review.grade?.comment ?? review.feedback ?? "";
        }
        if (startReviewBtn) {
            startReviewBtn.disabled = false;
        }
        if (saveReviewBtn) {
            saveReviewBtn.disabled = false;
        }
        if (saveDraftBtn) {
            saveDraftBtn.disabled = false;
        }
        if (publishBtn) {
            publishBtn.disabled = !review.gradeId && !review.grade?.id;
        }
    }

    function renderCourseSummary(state) {
        var summary = qs("#teacherReviewMeta");
        if (!summary) {
            return;
        }

        if (!state.courseId) {
            summary.innerHTML = "<span>请选择课程后查看待批改队列。</span>";
            return;
        }

        var course = state.courses.find(function (item) {
            return String(getCourseId(item)) === String(state.courseId);
        });
        var currentTitle = course ? getCourseLabel(course) : state.courseId;
        var urgentCount = state.pendingReviews.filter(function (item) {
            return item.status === "under_review";
        }).length;
        summary.innerHTML = [
            "<span>当前课程: " + escapeHtml(currentTitle) + "</span>",
            '<span class="dashboard-filter-tag">待批改: ' + escapeHtml(String(state.pendingReviews.length)) + "</span>",
            '<span class="dashboard-filter-tag">评审中: ' + escapeHtml(String(urgentCount)) + "</span>",
        ].join("");
    }

    async function loadCourses(state) {
        if (!window.linkseeApi) {
            return;
        }

        var payload = await window.linkseeApi.getJson("/api/v1/courses");
        state.courses = Array.isArray(payload.data) ? payload.data : (payload.data && payload.data.items) || [];
        renderCourseOptions(state);
        if (!state.courseId && state.courses[0]) {
            state.courseId = getCourseId(state.courses[0]) || "";
        }
        await loadPendingReviews(state);
    }

    async function loadPendingReviews(state) {
        if (!window.linkseeApi || !state.courseId) {
            state.pendingReviews = [];
            state.pipelineHealth = null;
            renderReviewList(state);
            renderOverview(state);
            renderCourseSummary(state);
            renderSelectedReview(state);
            return;
        }

        var responses = await Promise.all([
            window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.courseId) + "/pending-reviews"),
            window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.courseId) + "/pipeline-health").catch(function () {
                return { data: { stages: [] } };
            }),
        ]);
        var payload = responses[0];
        var pipelinePayload = responses[1];
        state.pendingReviews = Array.isArray(payload.data) ? payload.data : [];
        var stageRows = pipelinePayload && pipelinePayload.data && Array.isArray(pipelinePayload.data.stages)
            ? pipelinePayload.data.stages
            : [];
        state.pipelineHealth = {
            pendingStageCount: stageRows.filter(function (row) {
                return Number(row.pendingReviewCount || 0) > 0 || Number(row.needsChangesCount || 0) > 0;
            }).length,
        };
        if (!state.selectedReviewId && state.pendingReviews[0]) {
            state.selectedReviewId = state.pendingReviews[0].id;
        }
        state.selectedReview = state.pendingReviews.find(function (item) {
            return item.id === state.selectedReviewId;
        }) || state.pendingReviews[0] || null;
        state.selectedReviewId = state.selectedReview ? state.selectedReview.id : "";
        await loadDrafts(state);
        renderReviewList(state);
        renderOverview(state);
        renderCourseSummary(state);
        renderSelectedReview(state);
    }

    async function loadDrafts(state) {
        if (!window.linkseeApi || !state.courseId) {
            return;
        }

        var payload = await window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.courseId) + "/grade-drafts");
        var drafts = Array.isArray(payload.data) ? payload.data : [];
        state.pendingReviews = state.pendingReviews.map(function (review) {
            var draft = drafts.find(function (item) {
                return String(item.submissionId) === String(review.id);
            });
            if (draft) {
                review.grade = draft;
                review.gradeId = draft.id;
            }
            return review;
        });
    }

    function selectReview(state, reviewId) {
        state.selectedReviewId = reviewId;
        state.selectedReview = state.pendingReviews.find(function (item) {
            return item.id === reviewId;
        }) || null;
        renderReviewList(state);
        renderSelectedReview(state);
        renderCourseSummary(state);
    }

    async function startReview(state) {
        if (!state.selectedReview) {
            return;
        }

        await window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(state.selectedReview.id) + "/reviews/start", {});
    }

    async function saveReview(state, decision) {
        if (!state.selectedReview) {
            return;
        }

        var payload = {
            status: decision,
            comment: qs("#gradeFeedbackInput") ? qs("#gradeFeedbackInput").value.trim() : "",
        };

        await window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(state.selectedReview.id) + "/reviews", payload);
        await loadPendingReviews(state);
    }

    async function saveGradeDraft(state) {
        if (!state.selectedReview) {
            return;
        }

        var scoreInput = qs("#gradeScoreInput");
        var scoreValue = scoreInput && scoreInput.value !== "" ? Number(scoreInput.value) : Number.NaN;
        if (!Number.isFinite(scoreValue)) {
            throw new Error("请先输入 0-100 的分数");
        }
        var payload = {
            score: scoreValue,
            comment: qs("#gradeFeedbackInput") ? qs("#gradeFeedbackInput").value.trim() : "",
        };

        await window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(state.selectedReview.id) + "/grade-drafts", payload);
    }

    async function publishGrade(state) {
        if (!state.selectedReview) {
            return;
        }

        var gradeId = state.selectedReview.grade?.id || state.selectedReview.gradeId;
        if (!gradeId) {
            return;
        }

        await window.linkseeApi.postJson("/api/v1/grades/" + encodeURIComponent(gradeId) + "/publish", {});
        await loadPendingReviews(state);
    }

    function bindControls(state) {
        var courseSelect = qs("#teacherCourseSelect");
        var startReviewBtn = qs("#startReviewBtn");
        var saveReviewBtn = qs("#saveReviewBtn");
        var saveDraftBtn = qs("#saveDraftBtn");
        var publishBtn = qs("#publishGradeBtn");

        if (courseSelect) {
            courseSelect.addEventListener("change", function () {
                ensureCourseIdState(state, courseSelect.value);
                hideResult();
                loadPendingReviews(state).catch(function () {});
            });
        }

        var sortSelect = qs("#teacherQueueSort");
        if (sortSelect) {
            sortSelect.addEventListener("change", function () {
                renderReviewList(state);
            });
        }

        if (startReviewBtn) {
            startReviewBtn.addEventListener("click", function () {
                hideResult();
                startReview(state).then(function () {
                    showResult("已进入评审状态。", false);
                }).catch(function (err) {
                    showResult(err.message || "开始评审失败", true);
                });
            });
        }

        if (saveReviewBtn) {
            saveReviewBtn.addEventListener("click", function () {
                hideResult();
                saveReview(state, "approved").then(function () {
                    showResult("批改结果已提交。", false);
                }).catch(function (err) {
                    showResult(err.message || "保存批改失败", true);
                });
            });
        }

        if (saveDraftBtn) {
            saveDraftBtn.addEventListener("click", function () {
                hideResult();
                saveGradeDraft(state).then(function () {
                    showResult("成绩草稿已保存。", false);
                }).catch(function (err) {
                    showResult(err.message || "保存草稿失败", true);
                });
            });
        }

        if (publishBtn) {
            publishBtn.addEventListener("click", function () {
                hideResult();
                publishGrade(state).then(function () {
                    showResult("成绩已发布。", false);
                }).catch(function (err) {
                    showResult(err.message || "发布成绩失败", true);
                });
            });
        }
    }

    window.initTeacherDashboard = function initTeacherDashboard() {
        mergeTeacherReviewWorkbench();
        bindPanelLinks();

        var state = {
            courses: [],
            pendingReviews: [],
            dashboard: null,
            pipelineHealth: null,
            courseId: "",
            selectedReviewId: "",
            selectedReview: null,
        };

        bindControls(state);
        loadCourses(state).catch(function (err) {
            var reviewList = qs("#teacherReviewList");
            if (reviewList) {
                reviewList.innerHTML = '<div class="dashboard-empty-state"><strong>课程加载失败</strong><p>' + escapeHtml(err.message || "请检查后端服务是否正常") + '</p></div>';
            }
        });
    };
})();
