(function () {
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
            stats[1].textContent = String(state.dashboard?.pendingStageCount ?? pendingCount);
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
            attachmentLink.href = review.attachmentUrl || review.url || "#";
            attachmentLink.target = review.attachmentUrl || review.url ? "_blank" : "_self";
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
        var summary = qs("#teacherCourseSummary");
        if (!summary) {
            return;
        }

        if (!state.courseId) {
            summary.textContent = "请选择课程后查看待批改队列。";
            return;
        }

        var course = state.courses.find(function (item) {
            return String(getCourseId(item)) === String(state.courseId);
        });
        summary.textContent = course
            ? "当前课程: " + getCourseLabel(course) + " · 待批改 " + state.pendingReviews.length + " 条"
            : "当前课程: " + state.courseId + " · 待批改 " + state.pendingReviews.length + " 条";
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
            renderReviewList(state);
            renderOverview(state);
            renderCourseSummary(state);
            renderSelectedReview(state);
            return;
        }

        var payload = await window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.courseId) + "/pending-reviews");
        state.pendingReviews = Array.isArray(payload.data) ? payload.data : [];
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
                loadPendingReviews(state).catch(function () {});
            });
        }

        if (startReviewBtn) {
            startReviewBtn.addEventListener("click", function () {
                startReview(state).catch(function (err) {
                    window.alert(err.message || "开始评审失败");
                });
            });
        }

        if (saveReviewBtn) {
            saveReviewBtn.addEventListener("click", function () {
                saveReview(state, "approved").catch(function (err) {
                    window.alert(err.message || "保存批改失败");
                });
            });
        }

        if (saveDraftBtn) {
            saveDraftBtn.addEventListener("click", function () {
                saveGradeDraft(state).catch(function (err) {
                    window.alert(err.message || "保存草稿失败");
                });
            });
        }

        if (publishBtn) {
            publishBtn.addEventListener("click", function () {
                publishGrade(state).catch(function (err) {
                    window.alert(err.message || "发布成绩失败");
                });
            });
        }
    }

    window.initTeacherDashboard = function initTeacherDashboard() {
        var state = {
            courses: [],
            pendingReviews: [],
            dashboard: null,
            courseId: "",
            selectedReviewId: "",
            selectedReview: null,
        };

        var reviewPanel = qs("#panel-review-list .card");
        if (reviewPanel && !qs("#teacherCourseSelect")) {
            var toolbar = reviewPanel.querySelector(".dashboard-toolbar-row");
            if (toolbar) {
                var courseSelect = document.createElement("select");
                courseSelect.id = "teacherCourseSelect";
                courseSelect.className = "dashboard-select";
                courseSelect.innerHTML = "<option value=\"\">加载课程中...</option>";
                toolbar.appendChild(courseSelect);
            }
            var summaryBar = reviewPanel.querySelector(".dashboard-filter-bar");
            if (summaryBar) {
                var summary = document.createElement("span");
                summary.id = "teacherCourseSummary";
                summary.className = "dashboard-soft-note";
                summary.textContent = "请选择课程后查看待批改队列。";
                summaryBar.appendChild(summary);
            }
            var list = qs("#teacherReviewList");
            if (list && !qs("#teacherReviewEmpty")) {
                var empty = document.createElement("div");
                empty.id = "teacherReviewEmpty";
                empty.className = "dashboard-empty-state";
                empty.hidden = true;
                empty.innerHTML = "<strong>暂无待批改提交</strong><p>当前课程没有待处理提交。</p>";
                list.parentNode.insertBefore(empty, list.nextSibling);
            }
        }

        var gradingPanel = qs("#panel-grading .card");
        if (gradingPanel && !qs("#selectedReviewContext")) {
            var currentContext = gradingPanel.querySelector(".nav-section");
            if (currentContext) {
                currentContext.innerHTML = '<div id="selectedReviewContext" class="review-item dashboard-list-item-static"><div class="review-meta"><strong>请选择左侧提交</strong><span class="muted">这里会显示当前评审上下文</span></div></div>';
            }
            var controls = gradingPanel.querySelector(".dashboard-panel-actions");
            if (controls) {
                controls.innerHTML = [
                    '<button class="btn btn-secondary academic-btn-block" id="startReviewBtn" type="button">开始评审</button>',
                    '<button class="btn btn-secondary academic-btn-block" id="saveDraftBtn" type="button">保存草稿</button>',
                    '<button class="btn btn-primary academic-btn-block" id="saveReviewBtn" type="button">确认通过 ✓</button>',
                    '<button class="btn btn-secondary academic-btn-block" id="publishGradeBtn" type="button">发布成绩</button>',
                ].join("");
            }
            var scoreSection = gradingPanel.querySelector(".nav-section.dashboard-section-md");
            if (scoreSection) {
                scoreSection.innerHTML = '<div class="nav-section-title dashboard-section-sm">打分 (0-100)</div><input id="gradeScoreInput" class="dashboard-input" type="number" placeholder="输入分数" min="0" max="100">';
            }
            var feedbackSection = gradingPanel.querySelector(".nav-section.dashboard-section-lg");
            if (feedbackSection) {
                feedbackSection.innerHTML = '<div class="nav-section-title dashboard-section-sm">批改反馈意见</div><textarea id="gradeFeedbackInput" class="dashboard-textarea" placeholder="请输入建设性的反馈意见，指出优点与不足..."></textarea>';
            }
            var reviewLink = gradingPanel.querySelector(".dashboard-inline-link");
            if (reviewLink) {
                reviewLink.id = "selectedReviewAttachment";
            }
        }

        bindControls(state);
        loadCourses(state).catch(function (err) {
            var reviewList = qs("#teacherReviewList");
            if (reviewList) {
                reviewList.innerHTML = '<div class="dashboard-empty-state"><strong>课程加载失败</strong><p>' + escapeHtml(err.message || "请检查后端服务是否正常") + '</p></div>';
            }
        });
    };
})();
