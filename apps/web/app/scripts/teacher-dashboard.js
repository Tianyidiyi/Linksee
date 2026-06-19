(function () {
    function initTeacherDashboard() {
        var teacherReviewMockPref = "";
        try {
            teacherReviewMockPref = window.localStorage ? String(window.localStorage.getItem("linksee_teacher_review_mock") || "") : "";
        } catch (_err) {
            teacherReviewMockPref = "";
        }
        var teacherReviewMockAllowed = teacherReviewMockPref !== "0";
        var state = {
            courses: [],
            assignments: [],
            stages: [],
            pendingReviewsRaw: [],
            pendingReviews: [],
            submissionAttempts: [],
            groupLeaderMap: {},
            selected: null,
            currentCourseId: "",
            currentAssignmentId: "",
            currentStageId: "",
            currentQueuePage: 1,
            queuePageSize: 6,
            mockMode: teacherReviewMockAllowed,
        };

        function q(selector) {
            return document.querySelector(selector);
        }

        function qsa(selector) {
            return Array.from(document.querySelectorAll(selector));
        }

        function escapeHtml(value) {
            return String(value || "").replace(/[&<>"']/g, function (ch) {
                return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
            });
        }

        function formatDate(value) {
            if (!value) return "--";
            if (window.linkseePage && typeof window.linkseePage.formatDateTime === "function") {
                return window.linkseePage.formatDateTime(value);
            }
            var date = new Date(value);
            return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
        }

        function formatQueueTime(value) {
            if (!value) return "--";
            var date = new Date(value);
            if (Number.isNaN(date.getTime())) return String(value);
            var now = new Date();
            var sameDay = date.getFullYear() === now.getFullYear()
                && date.getMonth() === now.getMonth()
                && date.getDate() === now.getDate();
            var timeText = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
            if (sameDay) return "今天 " + timeText;
            return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) + " " + timeText;
        }

        function formatFileSize(value) {
            var size = Number(value || 0);
            if (!Number.isFinite(size) || size <= 0) return "--";
            if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + " MB";
            if (size >= 1024) return (size / 1024).toFixed(1) + " KB";
            return size + " B";
        }

        function getFileKind(fileName, mimeType) {
            var raw = String(fileName || "").toLowerCase();
            var ext = raw.indexOf(".") >= 0 ? raw.split(".").pop() : "";
            if ((mimeType || "").indexOf("pdf") >= 0 || ext === "pdf") return "pdf";
            if (["doc", "docx"].indexOf(ext) >= 0) return "doc";
            if (["xls", "xlsx", "csv"].indexOf(ext) >= 0) return "sheet";
            if (["ppt", "pptx"].indexOf(ext) >= 0) return "slide";
            if ((mimeType || "").indexOf("image/") === 0 || ["png", "jpg", "jpeg", "webp"].indexOf(ext) >= 0) return "image";
            if (["zip", "rar", "7z"].indexOf(ext) >= 0) return "archive";
            return "file";
        }

        function renderFileIconSvg(fileName, mimeType) {
            var kind = getFileKind(fileName, mimeType);
            if (kind === "pdf") {
                return [
                    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
                    '<path d="M7 3.5h6.7L19 8.8V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5Z" fill="#FFE5E2" stroke="#D5574A" stroke-width="1.5"/>',
                    '<path d="M13.4 3.8V8.9H18.5" stroke="#D5574A" stroke-width="1.5" stroke-linejoin="round"/>',
                    '<path d="M8.4 15.8v-3.9h1.9c1 0 1.7.7 1.7 1.6 0 1-.7 1.6-1.7 1.6H9.7v.7H8.4Zm1.3-1.8h.5c.4 0 .7-.2.7-.6s-.3-.6-.7-.6h-.5V14Zm3 1.8v-3.9H14c1.2 0 2 .8 2 1.9 0 1.2-.8 2-2 2h-1.3Zm1.2-1.1h.1c.5 0 .9-.3.9-.9 0-.5-.4-.9-.9-.9h-.1v1.8Zm2.9 1.1v-3.9h2.6v1.1h-1.3v.4h1.1v1h-1.1v1.4h-1.3Z" fill="#D5574A"/>',
                    "</svg>",
                ].join("");
            }
            if (kind === "doc") {
                return [
                    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
                    '<path d="M7 3.5h6.7L19 8.8V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5Z" fill="#E6F0FF" stroke="#4E79C7" stroke-width="1.5"/>',
                    '<path d="M13.4 3.8V8.9H18.5" stroke="#4E79C7" stroke-width="1.5" stroke-linejoin="round"/>',
                    '<path d="M8.5 12h1.7c1.3 0 2.2.8 2.2 1.9 0 1.2-.9 1.9-2.2 1.9H8.5V12Zm1.3 2.8h.3c.6 0 1-.3 1-.9s-.4-.9-1-.9h-.3v1.8Zm3.2 1v-3.9h1.2l1.3 1.9V12h1.2v3.9h-1.1l-1.4-2v2h-1.2Z" fill="#4E79C7"/>',
                    "</svg>",
                ].join("");
            }
            if (kind === "sheet") {
                return [
                    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
                    '<path d="M7 3.5h6.7L19 8.8V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5Z" fill="#E7F7EC" stroke="#4F8B5D" stroke-width="1.5"/>',
                    '<path d="M13.4 3.8V8.9H18.5" stroke="#4F8B5D" stroke-width="1.5" stroke-linejoin="round"/>',
                    '<path d="M8.6 12.1h6.8M8.6 14h6.8M8.6 15.9h6.8M10.2 11.4v5.1M13 11.4v5.1" stroke="#4F8B5D" stroke-width="1.2" stroke-linecap="round"/>',
                    "</svg>",
                ].join("");
            }
            if (kind === "slide") {
                return [
                    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
                    '<rect x="5" y="4.5" width="14" height="11" rx="2" fill="#FFF0DE" stroke="#D08A43" stroke-width="1.5"/>',
                    '<path d="M12 15.8v3.2M9.4 19h5.2" stroke="#D08A43" stroke-width="1.5" stroke-linecap="round"/>',
                    '<path d="M8 8.3h8M8 10.8h5.2" stroke="#D08A43" stroke-width="1.4" stroke-linecap="round"/>',
                    "</svg>",
                ].join("");
            }
            if (kind === "image") {
                return [
                    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
                    '<rect x="4.5" y="5" width="15" height="14" rx="2" fill="#F2E9FF" stroke="#8A68B8" stroke-width="1.5"/>',
                    '<circle cx="9" cy="10" r="1.5" fill="#8A68B8"/>',
                    '<path d="m7.5 16 3.1-3 2.2 2.1 2.1-1.9 2.6 2.8" stroke="#8A68B8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
                    "</svg>",
                ].join("");
            }
            if (kind === "archive") {
                return [
                    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
                    '<rect x="5.5" y="4.5" width="13" height="15" rx="2" fill="#F0E9FF" stroke="#7B61C9" stroke-width="1.5"/>',
                    '<path d="M10 7.5h4M10 10.2h4M11.2 12.9h1.6v3.1h-1.6z" stroke="#7B61C9" stroke-width="1.3" stroke-linecap="round"/>',
                    '<path d="M12 15.8v1.2" stroke="#7B61C9" stroke-width="1.3" stroke-linecap="round"/>',
                    "</svg>",
                ].join("");
            }
            return [
                '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
                '<path d="M7 3.5h6.8L19 8.7V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5Z" fill="#F3F6FA" stroke="#6C8198" stroke-width="1.5"/>',
                '<path d="M13.5 3.8V9h5.2" stroke="#6C8198" stroke-width="1.5" stroke-linejoin="round"/>',
                '<path d="M8.8 13.2h6.4M8.8 16.2h4.6" stroke="#6C8198" stroke-width="1.6" stroke-linecap="round"/>',
                "</svg>",
            ].join("");
        }

        function fileTypeLabel(fileName, mimeType) {
            var kind = getFileKind(fileName, mimeType);
            if (kind === "pdf") return "PDF";
            if (kind === "doc") return "DOC/DOCX";
            if (kind === "sheet") return "XLS/XLSX";
            if (kind === "slide") return "PPT/PPTX";
            if (kind === "image") return "图片";
            if (kind === "archive") return "压缩包";
            return "文件";
        }

        function renderEmptyInfoText() {
            return '<span class="teacher-review-empty-text">暂无信息</span>';
        }

        function buildSubmissionDetailHtml(selectedSubmission) {
            var payload = selectedSubmission && selectedSubmission.payload && typeof selectedSubmission.payload === "object"
                ? selectedSubmission.payload
                : {};
            var links = Array.isArray(payload.links) ? payload.links : [];
            var repositoryUrl = typeof payload.repositoryUrl === "string" ? payload.repositoryUrl : "";
            var description = typeof payload.description === "string" ? payload.description : "";
            var contributionNote = typeof payload.contributionNote === "string" ? payload.contributionNote : "";
            var title = typeof payload.title === "string" ? payload.title : "";
            var files = Array.isArray(selectedSubmission && selectedSubmission.files) ? selectedSubmission.files : [];
            var summary = selectedSubmission && selectedSubmission.summary ? selectedSubmission.summary : "";
            var fileList = files.length
                ? files.map(function (file) {
                    return [
                        '<div class="teacher-review-file-row">',
                        '<span class="teacher-review-file-icon">' + renderFileIconSvg(file.name, file.mimeType) + "</span>",
                        '<div class="teacher-review-file-copy">',
                        '<strong>' + escapeHtml(file.name || "未命名附件") + "</strong>",
                        "</div>",
                        '<span class="teacher-review-file-size">' + escapeHtml(formatFileSize(file.size)) + "</span>",
                        '<button class="teacher-review-file-download" type="button"' + (file.downloadPath ? ' data-download-path="' + escapeHtml(file.downloadPath) + '"' : " disabled") + '>下载</button>',
                        "</div>",
                    ].join("");
                }).join("")
                : '<div class="teacher-review-file-empty">暂无附件</div>';

            return [
                '<div class="teacher-review-detail-layout">',
                '<div class="teacher-review-detail-main">',
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">提交标题</span><div class="teacher-review-richtext">' + (title || summary ? escapeHtml(title || summary) : renderEmptyInfoText()) + '</div></div>',
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">成果说明</span><div class="teacher-review-richtext">' + (description || summary ? escapeHtml(description || summary) : renderEmptyInfoText()) + "</div></div>",
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">贡献说明</span><div class="teacher-review-richtext">' + (contributionNote ? escapeHtml(contributionNote) : renderEmptyInfoText()) + "</div></div>",
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">仓库链接</span>' + (
                    repositoryUrl
                        ? '<a class="dashboard-inline-link" href="' + escapeHtml(repositoryUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(repositoryUrl) + "</a>"
                        : '<div class="teacher-review-richtext">' + renderEmptyInfoText() + "</div>"
                ) + "</div>",
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">参考链接</span>' + (
                    links.length
                        ? '<div class="teacher-review-link-list">' + links.map(function (link) {
                            return '<a class="dashboard-inline-link" href="' + escapeHtml(link) + '" target="_blank" rel="noreferrer">' + escapeHtml(link) + "</a>";
                        }).join("") + "</div>"
                        : '<div class="teacher-review-richtext">' + renderEmptyInfoText() + "</div>"
                ) + "</div>",
                "</div>",
                '<aside class="teacher-review-file-card">',
                '<div class="teacher-review-file-head"><span>附件列表</span><span>' + escapeHtml(files.length ? (String(files.length) + " 个文件") : "暂无附件") + "</span></div>",
                '<div class="teacher-review-file-list">' + fileList + "</div>",
                "</aside>",
                "</div>",
            ].join("");
        }

        function buildSubmissionEmptyDetailHtml() {
            return buildSubmissionDetailHtml({
                summary: "",
                payload: {},
                files: [],
            });
        }

        function mockDownloadUrl(name, mimeType, text) {
            return "data:" + (mimeType || "text/plain") + ";charset=utf-8," + encodeURIComponent(text || name || "Linksee mock attachment");
        }

        function mockReviewRows() {
            var now = Date.now();
            return [
                { id: "mock-sub-01", groupId: "mock-group-01", stageId: "mock-stage-01", status: "submitted", submittedBy: "2024010101", submittedAt: new Date(now - 1000 * 60 * 62).toISOString(), createdAt: new Date(now - 1000 * 60 * 62).toISOString(), group: { groupNo: 1, name: "1" } },
                { id: "mock-sub-02", groupId: "mock-group-02", stageId: "mock-stage-01", status: "under_review", submittedBy: "2024010107", submittedAt: new Date(now - 1000 * 60 * 138).toISOString(), createdAt: new Date(now - 1000 * 60 * 138).toISOString(), group: { groupNo: 2, name: "2" } },
                { id: "mock-sub-03", groupId: "mock-group-03", stageId: "mock-stage-02", status: "needs_changes", submittedBy: "2024010112", submittedAt: new Date(now - 1000 * 60 * 260).toISOString(), createdAt: new Date(now - 1000 * 60 * 260).toISOString(), group: { groupNo: 3, name: "3" } },
                { id: "mock-sub-04", groupId: "mock-group-04", stageId: "mock-stage-02", status: "submitted", submittedBy: "2024010118", submittedAt: new Date(now - 1000 * 60 * 380).toISOString(), createdAt: new Date(now - 1000 * 60 * 380).toISOString(), group: { groupNo: 4, name: "4" } },
                { id: "mock-sub-05", groupId: "mock-group-05", stageId: "mock-stage-03", status: "submitted", submittedBy: "2024010123", submittedAt: new Date(now - 1000 * 60 * 520).toISOString(), createdAt: new Date(now - 1000 * 60 * 520).toISOString(), group: { groupNo: 5, name: "5" } },
                { id: "mock-sub-06", groupId: "mock-group-06", stageId: "mock-stage-03", status: "approved", submittedBy: "2024010128", submittedAt: new Date(now - 1000 * 60 * 660).toISOString(), createdAt: new Date(now - 1000 * 60 * 660).toISOString(), group: { groupNo: 6, name: "6" }, gradeId: "mock-grade-06", grade: { id: "mock-grade-06", score: 91 } },
                { id: "mock-sub-07", groupId: "mock-group-07", stageId: "mock-stage-01", status: "submitted", submittedBy: "2024010134", submittedAt: new Date(now - 1000 * 60 * 800).toISOString(), createdAt: new Date(now - 1000 * 60 * 800).toISOString(), group: { groupNo: 7, name: "7" } },
            ];
        }

        function loadMockData() {
            state.courses = [{ id: "mock-course-01", name: "软件工程课程设计", courseNo: "SE-2026" }];
            state.assignments = [{ id: "mock-assignment-01", title: "Linksee 课程协作平台迭代项目", status: "active" }];
            state.stages = [
                { id: "mock-stage-01", stageNo: 1, title: "需求分析与原型", status: "active" },
                { id: "mock-stage-02", stageNo: 2, title: "前后端联调", status: "active" },
                { id: "mock-stage-03", stageNo: 3, title: "验收材料整理", status: "active" },
            ];
            state.groupLeaderMap = {
                "mock-group-01": { realName: "林可", accountNo: "2024010101" },
                "mock-group-02": { realName: "周予安", accountNo: "2024010107" },
                "mock-group-03": { realName: "沈嘉禾", accountNo: "2024010112" },
                "mock-group-04": { realName: "陈知远", accountNo: "2024010118" },
                "mock-group-05": { realName: "许明月", accountNo: "2024010123" },
                "mock-group-06": { realName: "何一舟", accountNo: "2024010128" },
                "mock-group-07": { realName: "赵南星", accountNo: "2024010134" },
            };
            state.currentCourseId = "mock-course-01";
            state.currentAssignmentId = "mock-assignment-01";
            state.currentStageId = "";
            state.pendingReviewsRaw = mockReviewRows();
            state.currentQueuePage = 1;
            renderCourseOptions();
            renderAssignmentOptions();
            renderStageOptions();
            applyReviewFilters();
            renderSummary();
            renderReviewList();
            renderSelected();
            if (state.selected) {
                state.submissionAttempts = mockSubmissionAttempts(state.selected);
                renderSubmissionDetail();
                renderAttemptList();
            }
        }

        function mockSubmissionAttempts(review) {
            var groupNo = review && review.group && (review.group.groupNo || review.group.name) ? review.group.groupNo || review.group.name : "1";
            var status = review && review.status || "submitted";
            var title = "第 " + groupNo + " 组阶段成果包";
            return [
                {
                    id: asId(review && review.id || "mock-attempt-1"),
                    attemptNo: 1,
                    summary: title,
                    submittedAt: review && (review.submittedAt || review.createdAt) || new Date().toISOString(),
                    createdAt: review && (review.createdAt || review.submittedAt) || new Date().toISOString(),
                    status: status,
                    payload: {
                        title: title,
                        description: "已完成阶段页面、提交记录、附件整理与批阅状态联调，成果包内容齐全，可直接进入批阅。",
                        contributionNote: "组长负责需求拆分与联调推进，前端成员负责工作台界面，后端成员负责提交与附件接口。",
                        repositoryUrl: "https://github.com/linksee/mock-course-work",
                        links: ["https://linksee.example/mock/review-note", "https://linksee.example/mock/checklist"],
                    },
                    files: [
                        { name: "阶段成果说明.pdf", mimeType: "application/pdf", size: 348160, downloadPath: mockDownloadUrl("阶段成果说明.pdf", "application/pdf", "Linksee mock PDF attachment for group " + groupNo) },
                        { name: "接口联调记录.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 86420, downloadPath: mockDownloadUrl("接口联调记录.docx", "text/plain", "接口联调记录 mock file") },
                        { name: "测试用例汇总.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 54272, downloadPath: mockDownloadUrl("测试用例汇总.xlsx", "text/csv", "case,result\nsubmit,pass\nreview,pass") },
                        { name: "页面截图.png", mimeType: "image/png", size: 128400, downloadPath: mockDownloadUrl("页面截图.png", "text/plain", "mock image attachment") },
                        { name: "source.zip", mimeType: "application/zip", size: 742900, downloadPath: mockDownloadUrl("source.zip", "application/zip", "mock zip attachment") },
                    ],
                },
                {
                    id: asId(review && review.id || "mock-attempt-1") + "-prev",
                    attemptNo: 0,
                    summary: "上一版提交：缺少附件说明",
                    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
                    status: "needs_changes",
                    payload: { title: "上一版阶段成果", description: "用于查看历次提交区域的 mock 记录。", links: [] },
                    files: [],
                },
            ];
        }

        function rowsOf(payload) {
            return Array.isArray(payload && payload.data) ? payload.data : [];
        }

        function asId(value) {
            return value === null || value === undefined ? "" : String(value);
        }

        function getCurrentCourse() {
            return state.courses.find(function (row) { return asId(row.id) === asId(state.currentCourseId); }) || null;
        }

        function getCurrentAssignment() {
            return state.assignments.find(function (row) { return asId(row.id) === asId(state.currentAssignmentId); }) || null;
        }

        function getCurrentStage() {
            return state.stages.find(function (row) { return asId(row.id) === asId(state.currentStageId); }) || null;
        }

        function getStageLabel(stage) {
            if (!stage) return "全部阶段";
            return "阶段 " + (stage.stageNo || "--") + " · " + (stage.title || "未命名阶段");
        }

        function getAssignmentLabel(assignment) {
            return assignment ? (assignment.title || "未命名项目") : "全部项目";
        }

        function getReviewStatusLabel(status) {
            if (status === "under_review") return "评审中";
            if (status === "submitted") return "已提交";
            if (status === "approved") return "已通过";
            if (status === "reviewed") return "已评阅";
            if (status === "needs_changes") return "待修改";
            if (status === "rejected") return "未通过";
            return status || "--";
        }

        function getReviewBadgeClass(status) {
            if (status === "under_review") return "badge-reviewing";
            if (status === "submitted") return "badge-pending";
            if (status === "approved") return "badge-approved";
            return "badge-pending";
        }

        function canStartReview(status) {
            return status === "submitted";
        }

        function canSubmitReview(status) {
            return status === "submitted" || status === "under_review";
        }

        function canSaveGradeDraft(status) {
            return status === "approved" || status === "reviewed";
        }

        function hasPublishedGrade(selected) {
            return !!(selected && selected.grade && selected.grade.status === "published");
        }

        function canPublishGrade(selected) {
            if (!selected) return false;
            if (hasPublishedGrade(selected)) return false;
            if (!canSaveGradeDraft(selected.status)) return false;
            var grade = selected.grade || null;
            return !!(selected.gradeId || grade && grade.id);
        }

        function getQueueGroupTone(groupNo) {
            var value = Number(groupNo || 0);
            var index = Number.isFinite(value) && value > 0 ? ((value - 1) % 4) + 1 : 1;
            return "tone-" + index;
        }

        function getPageReviews() {
            var start = (state.currentQueuePage - 1) * state.queuePageSize;
            return state.pendingReviews.slice(start, start + state.queuePageSize);
        }

        function getLeaderMeta(review) {
            var leader = state.groupLeaderMap[asId(review.groupId)] || null;
            if (leader) return leader;
            return {
                realName: review.submittedBy || "--",
                accountNo: review.submittedBy || "--",
            };
        }

        async function enrichGroupLeaders(reviews) {
            var groupIds = Array.from(new Set((reviews || []).map(function (review) {
                return asId(review.groupId);
            }).filter(Boolean)));
            var missingIds = groupIds.filter(function (groupId) {
                return !state.groupLeaderMap[groupId];
            });
            if (!missingIds.length) return;

            await Promise.all(missingIds.map(async function (groupId) {
                try {
                    var payload = await window.linkseeApi.getJson("/api/v1/groups/" + encodeURIComponent(groupId) + "/members");
                    var members = rowsOf(payload);
                    var leader = members.find(function (member) { return member.role === "leader"; }) || members[0] || null;
                    state.groupLeaderMap[groupId] = {
                        realName: leader && leader.user && leader.user.profile && leader.user.profile.realName ? leader.user.profile.realName : (leader ? leader.userId : "--"),
                        accountNo: leader && leader.user && leader.user.profile && leader.user.profile.accountNo ? leader.user.profile.accountNo : (leader ? leader.userId : "--"),
                    };
                } catch (err) {
                    state.groupLeaderMap[groupId] = { realName: "--", accountNo: "--" };
                }
            }));
        }

        function showResult(message, isError) {
            var result = q("#teacherActionResult");
            if (!result) return;
            result.hidden = false;
            result.classList.toggle("is-error", Boolean(isError));
            result.innerHTML = "<strong>" + escapeHtml(isError ? "操作失败" : "操作成功") + "</strong><p>" + escapeHtml(message) + "</p>";
        }

        function hideResult() {
            var result = q("#teacherActionResult");
            if (!result) return;
            result.hidden = true;
            result.classList.remove("is-error");
            result.innerHTML = "";
        }

        function renderCourseOptions() {
            var courseSelect = q("#teacherCourseSelect");
            if (!courseSelect) return;
            var options = state.courses.map(function (course) {
                return '<option value="' + escapeHtml(course.id) + '">' + escapeHtml(course.name || course.courseNo || course.id) + "</option>";
            }).join("");
            courseSelect.innerHTML = options || '<option value="">暂无课程</option>';
            if (!state.currentCourseId && state.courses[0]) {
                state.currentCourseId = asId(state.courses[0].id);
            }
            courseSelect.value = state.currentCourseId;
        }

        function renderAssignmentOptions() {
            var assignmentSelect = q("#teacherAssignmentSelect");
            if (!assignmentSelect) return;
            var options = state.assignments.map(function (assignment) {
                return '<option value="' + escapeHtml(assignment.id) + '">' + escapeHtml(assignment.title || "未命名项目") + "</option>";
            }).join("");
            assignmentSelect.innerHTML = options || '<option value="">暂无项目</option>';
            if (!state.currentAssignmentId && state.assignments[0]) {
                state.currentAssignmentId = asId(state.assignments[0].id);
            }
            assignmentSelect.value = state.currentAssignmentId;
        }

        function renderStageOptions() {
            var stageSelect = q("#teacherStageSelect");
            if (!stageSelect) return;
            var options = ['<option value="">全部阶段</option>'].concat(state.stages.map(function (stage) {
                return '<option value="' + escapeHtml(stage.id) + '">' + escapeHtml(getStageLabel(stage)) + "</option>";
            })).join("");
            stageSelect.innerHTML = options;
            stageSelect.value = state.currentStageId || "";
        }

        function sortPendingReviews() {
            var sortMode = "oldest";
            state.pendingReviews.sort(function (left, right) {
                var leftTime = new Date(left.submittedAt || left.createdAt || 0).getTime();
                var rightTime = new Date(right.submittedAt || right.createdAt || 0).getTime();
                return sortMode === "latest" ? rightTime - leftTime : leftTime - rightTime;
            });
        }

        function applyReviewFilters() {
            var stageIds = state.stages.map(function (row) { return asId(row.id); });
            var selectedStageId = asId(state.currentStageId);
            state.pendingReviews = state.pendingReviewsRaw.filter(function (review) {
                var reviewStageId = asId(review.stageId);
                if (selectedStageId) return reviewStageId === selectedStageId;
                if (stageIds.length > 0) return stageIds.indexOf(reviewStageId) >= 0;
                return true;
            });
            sortPendingReviews();
            var totalPages = Math.max(1, Math.ceil(state.pendingReviews.length / state.queuePageSize));
            if (state.currentQueuePage > totalPages) state.currentQueuePage = totalPages;
            if (state.currentQueuePage < 1) state.currentQueuePage = 1;
            if (state.selected) {
                var selectedId = asId(state.selected.id);
                state.selected = state.pendingReviews.find(function (row) { return asId(row.id) === selectedId; }) || null;
            }
            if (!state.selected && state.pendingReviews[0]) {
                state.selected = state.pendingReviews[0];
            }
        }

        function renderSummary() {
            var pendingCount = state.pendingReviews.filter(function (review) {
                return canSubmitReview(review.status);
            }).length;
            var gradingCount = state.pendingReviews.filter(function (review) {
                return canSaveGradeDraft(review.status) && !(review.grade && review.grade.status === "published");
            }).length;
            q("#teacherPendingCount").textContent = "待批阅 " + pendingCount + " · 待评分 " + gradingCount;
        }

        function renderReviewList() {
            var list = q("#teacherReviewList");
            var pageNode = q("#teacherQueuePage");
            var prevBtn = q("#teacherQueuePrev");
            var nextBtn = q("#teacherQueueNext");
            if (!list) return;
            var totalPages = Math.max(1, Math.ceil(state.pendingReviews.length / state.queuePageSize));
            var pageRows = getPageReviews();
            if (pageNode) pageNode.textContent = state.currentQueuePage + " / " + totalPages;
            if (prevBtn) prevBtn.disabled = state.currentQueuePage <= 1;
            if (nextBtn) nextBtn.disabled = state.currentQueuePage >= totalPages;
            if (!state.pendingReviews.length) {
                list.innerHTML = '<div class="teacher-review-queue-empty">暂无组别提交</div>';
                return;
            }
            list.innerHTML = pageRows.map(function (review) {
                var groupNo = review.group && (review.group.groupNo || review.group.name) ? (review.group.groupNo || review.group.name) : "--";
                var leader = getLeaderMeta(review);
                var selected = state.selected && asId(state.selected.id) === asId(review.id);
                return [
                    '<div class="list-item dashboard-list-item-interactive teacher-review-queue-item' + (selected ? ' dashboard-list-item-selected' : "") + '" data-review-id="' + escapeHtml(review.id) + '">',
                    '<div class="teacher-review-queue-group ' + getQueueGroupTone(groupNo) + '">第 ' + escapeHtml(groupNo) + " 组</div>",
                    '<div class="teacher-review-queue-status"><strong>' + escapeHtml(getReviewStatusLabel(review.status)) + "</strong><span>" + escapeHtml(formatQueueTime(review.submittedAt || review.createdAt)) + "</span></div>",
                    '<div class="teacher-review-queue-leader"><strong>' + escapeHtml(leader.realName || "--") + "</strong><span>" + escapeHtml(leader.accountNo || "--") + "</span></div>",
                    "</div>",
                ].join("");
            }).join("");
            qsa("#teacherReviewList [data-review-id]").forEach(function (item) {
                item.addEventListener("click", function () {
                    selectReview(item.getAttribute("data-review-id"));
                });
            });
        }

        function renderSelectedLegacy() {
            var selected = state.selected;
            var titleNode = q("#teacherSelectedTitle");
            var pathNode = q("#teacherSelectedPath");
            var statusNode = q("#teacherSelectedStatus");
            var contextNode = q("#selectedReviewContext");
            var detailNode = q("#teacherSubmissionDetail");
            var attemptNode = q("#teacherAttemptList");
            var scoreInput = q("#gradeScoreInput");
            var feedbackInput = q("#gradeFeedbackInput");
            var startBtn = q("#startReviewBtn");
            var reviewBtn = q("#saveReviewBtn");
            var draftBtn = q("#saveDraftBtn");
            var publishBtn = q("#publishGradeBtn");

            if (!selected) {
                if (titleNode) titleNode.textContent = state.pendingReviews.length ? "请选择左侧提交" : "暂无组别提交";
                if (pathNode) pathNode.textContent = "课程 / 项目 / 阶段";
                if (statusNode) {
                    statusNode.className = "badge badge-pending";
                    statusNode.textContent = state.pendingReviews.length ? "待选择" : "暂无提交";
                }
                if (contextNode) contextNode.textContent = "";
                if (detailNode) detailNode.innerHTML = buildSubmissionEmptyDetailHtml();
                if (attemptNode) attemptNode.innerHTML = '<div class="teacher-review-placeholder">暂无记录</div>';
                if (scoreInput) scoreInput.value = "";
                if (feedbackInput) feedbackInput.value = "";
                if (startBtn) startBtn.disabled = true;
                if (reviewBtn) reviewBtn.disabled = true;
                if (draftBtn) draftBtn.disabled = true;
                if (publishBtn) publishBtn.disabled = true;
                return;
            }

            var course = getCurrentCourse();
            var assignment = getCurrentAssignment();
            var stage = getCurrentStage() || (state.stages.find(function (row) { return asId(row.id) === asId(selected.stageId); }) || null);
            var groupLabel = selected.group && (selected.group.groupNo || selected.group.name) ? "第 " + (selected.group.groupNo || selected.group.name) + " 组" : "未命名小组";
            if (titleNode) titleNode.textContent = stage && stage.title ? stage.title : "阶段提交";
            if (pathNode) {
                pathNode.textContent = [
                    course ? (course.name || course.courseNo || course.id) : "--",
                    assignment ? assignment.title : "--",
                    stage ? (stage.title || "--") : "--",
                ].join(" / ");
            }
            if (statusNode) {
                statusNode.className = "badge " + getReviewBadgeClass(selected.status);
                statusNode.textContent = getReviewStatusLabel(selected.status);
            }
            if (contextNode) {
                contextNode.innerHTML = [
                    '<span>小组：' + escapeHtml(groupLabel) + "</span>",
                    '<span>提交人：' + escapeHtml(selected.submittedBy || "--") + "</span>",
                    '<span>提交时间：' + escapeHtml(formatDate(selected.submittedAt || selected.createdAt)) + "</span>",
                ].join(" · ");
            }
            if (scoreInput) scoreInput.value = selected.grade && selected.grade.score !== undefined && selected.grade.score !== null ? selected.grade.score : "";
            if (feedbackInput) feedbackInput.value = "";
            if (startBtn) startBtn.disabled = selected.status !== "submitted";
            if (reviewBtn) reviewBtn.disabled = false;
            if (draftBtn) draftBtn.disabled = false;
            if (publishBtn) publishBtn.disabled = !(selected.gradeId || selected.grade && selected.grade.id);

            renderSubmissionDetailLegacy();
            renderAttemptList();
        }

        function renderSubmissionDetailLegacy() {
            var node = q("#teacherSubmissionDetail");
            if (!node) return;
            if (!state.selected || !state.submissionAttempts.length) {
                node.innerHTML = buildSubmissionEmptyDetailHtml();
                return;
            }
            var selectedSubmission = state.submissionAttempts.find(function (row) {
                return asId(row.id) === asId(state.selected.id);
            }) || state.submissionAttempts[0];
            var payload = selectedSubmission && selectedSubmission.payload && typeof selectedSubmission.payload === "object"
                ? selectedSubmission.payload
                : {};
            var links = Array.isArray(payload.links) ? payload.links : [];
            var repositoryUrl = typeof payload.repositoryUrl === "string" ? payload.repositoryUrl : "";
            var description = typeof payload.description === "string" ? payload.description : "";
            var contributionNote = typeof payload.contributionNote === "string" ? payload.contributionNote : "";
            var title = typeof payload.title === "string" ? payload.title : "";
            var fileIds = Array.isArray(payload.fileIds) ? payload.fileIds : [];
            var fileList = fileIds.length
                ? fileIds.map(function (fileId, index) {
                    return [
                        '<div class="teacher-review-file-row">',
                        '<span class="teacher-review-file-name">' + escapeHtml(String(fileId)) + "</span>",
                        '<span class="teacher-review-file-meta">#' + escapeHtml(index + 1) + "</span>",
                        "</div>",
                    ].join("");
                }).join("")
                : '<div class="teacher-review-file-empty">无</div>';
            node.innerHTML = [
                '<div class="teacher-review-detail-layout">',
                '<div class="teacher-review-detail-main">',
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">提交标题</span><div class="teacher-review-richtext">' + escapeHtml(title || selectedSubmission.summary || "未填写") + "</div></div>",
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">提交内容</span><div class="teacher-review-richtext">' + escapeHtml(description || selectedSubmission.summary || "未填写") + "</div></div>",
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">贡献说明</span><div class="teacher-review-richtext">' + escapeHtml(contributionNote || "未填写") + "</div></div>",
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">仓库链接</span>' + (
                    repositoryUrl
                        ? '<a class="dashboard-inline-link" href="' + escapeHtml(repositoryUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(repositoryUrl) + "</a>"
                        : '<div class="teacher-review-richtext">未填写</div>'
                ) + "</div>",
                '<div class="teacher-review-detail-item"><span class="teacher-review-detail-label">参考链接</span>' + (
                    links.length
                        ? '<div class="teacher-review-link-list">' + links.map(function (link) {
                            return '<a class="dashboard-inline-link" href="' + escapeHtml(link) + '" target="_blank" rel="noreferrer">' + escapeHtml(link) + "</a>";
                        }).join("") + "</div>"
                        : '<div class="teacher-review-richtext">未填写</div>'
                ) + "</div>",
                "</div>",
                '<aside class="teacher-review-file-card">',
                '<div class="teacher-review-file-head"><span>文件索引</span><span>' + escapeHtml(fileIds.length) + " 项</span></div>",
                '<div class="teacher-review-file-list">' + fileList + "</div>",
                "</aside>",
                "</div>",
            ].join("");
        }

        function renderSelected() {
            var selected = state.selected;
            var titleNode = q("#teacherSelectedTitle");
            var pathNode = q("#teacherSelectedPath");
            var contextNode = q("#selectedReviewContext");
            var detailNode = q("#teacherSubmissionDetail");
            var attemptNode = q("#teacherAttemptList");
            var scoreInput = q("#gradeScoreInput");
            var feedbackInput = q("#gradeFeedbackInput");
            var startBtn = q("#startReviewBtn");
            var reviewBtn = q("#saveReviewBtn");
            var draftBtn = q("#saveDraftBtn");
            var publishBtn = q("#publishGradeBtn");

            if (!selected) {
                if (titleNode) titleNode.textContent = state.pendingReviews.length ? "请选择左侧提交" : "暂无组别提交";
                if (pathNode) pathNode.textContent = "课程 / 项目 / 阶段";
                if (contextNode) contextNode.textContent = "";
                if (detailNode) detailNode.innerHTML = buildSubmissionEmptyDetailHtml();
                if (attemptNode) attemptNode.innerHTML = '<div class="teacher-review-placeholder">暂无记录</div>';
                if (scoreInput) scoreInput.value = "";
                if (feedbackInput) feedbackInput.value = "";
                if (startBtn) startBtn.disabled = true;
                if (reviewBtn) reviewBtn.disabled = true;
                if (draftBtn) draftBtn.disabled = true;
                if (publishBtn) publishBtn.disabled = true;
                return;
            }

            var course = getCurrentCourse();
            var assignment = getCurrentAssignment();
            var stage = getCurrentStage() || (state.stages.find(function (row) { return asId(row.id) === asId(selected.stageId); }) || null);
            var groupLabel = selected.group && (selected.group.groupNo || selected.group.name) ? "第 " + (selected.group.groupNo || selected.group.name) + " 组" : "未命名小组";
            if (titleNode) titleNode.textContent = groupLabel;
            if (pathNode) {
                pathNode.textContent = [
                    course ? (course.name || course.courseNo || course.id) : "--",
                    assignment ? assignment.title : "--",
                    stage ? (stage.title || "--") : "--",
                ].join(" / ");
            }
            if (contextNode) {
                contextNode.textContent = "提交时间：" + formatDate(selected.submittedAt || selected.createdAt);
            }
            if (scoreInput) scoreInput.value = selected.grade && selected.grade.score !== undefined && selected.grade.score !== null ? selected.grade.score : "";
            if (feedbackInput) feedbackInput.value = "";
            if (startBtn) startBtn.disabled = !canStartReview(selected.status);
            if (reviewBtn) reviewBtn.disabled = !canSubmitReview(selected.status);
            if (draftBtn) draftBtn.disabled = !canSaveGradeDraft(selected.status) || hasPublishedGrade(selected);
            if (publishBtn) publishBtn.disabled = !canPublishGrade(selected);

            renderSubmissionDetail();
            renderAttemptList();
        }

        function renderSubmissionDetail() {
            var node = q("#teacherSubmissionDetail");
            if (!node) return;
            var selectedSubmission = state.selected && state.submissionAttempts.length
                ? (state.submissionAttempts.find(function (row) {
                return asId(row.id) === asId(state.selected.id);
            }) || state.submissionAttempts[0])
                : null;
            node.innerHTML = selectedSubmission ? buildSubmissionDetailHtml(selectedSubmission) : buildSubmissionEmptyDetailHtml();

            qsa("#teacherSubmissionDetail [data-download-path]").forEach(function (button) {
                button.addEventListener("click", async function () {
                    var downloadPath = button.getAttribute("data-download-path");
                    if (!downloadPath) return;
                    try {
                        if (/^(data:|blob:|https?:\/\/)/.test(downloadPath)) {
                            var directLink = document.createElement("a");
                            directLink.href = downloadPath;
                            directLink.target = "_blank";
                            directLink.rel = "noopener";
                            directLink.download = button.closest(".teacher-review-file-row")?.querySelector(".teacher-review-file-copy strong")?.textContent || "attachment";
                            document.body.appendChild(directLink);
                            directLink.click();
                            directLink.remove();
                            return;
                        }
                        var payload = await window.linkseeApi.getJson(downloadPath);
                        if (payload && payload.data && payload.data.downloadUrl) {
                            window.open(payload.data.downloadUrl, "_blank", "noopener");
                        } else {
                            throw new Error("下载地址获取失败");
                        }
                    } catch (err) {
                        showResult(err.message || "附件下载失败", true);
                    }
                });
            });
        }

        function renderAttemptList() {
            var node = q("#teacherAttemptList");
            var countNode = q("#teacherAttemptCount");
            if (!node) return;
            if (!state.submissionAttempts.length) {
                if (countNode) countNode.textContent = "0 次";
                node.innerHTML = '<div class="teacher-review-placeholder">暂无记录</div>';
                return;
            }
            if (countNode) countNode.textContent = state.submissionAttempts.length + " 次";
            node.innerHTML = [
                '<div class="teacher-review-attempt-table">',
                '<div class="teacher-review-attempt-head">',
                "<span>次数</span>",
                "<span>提交时间</span>",
                "<span>状态</span>",
                "<span>摘要</span>",
                "</div>",
                state.submissionAttempts.map(function (attempt) {
                var isCurrent = state.selected && asId(state.selected.id) === asId(attempt.id);
                return [
                    '<div class="teacher-review-attempt-item' + (isCurrent ? " is-current" : "") + '">',
                    "<span>第 " + escapeHtml(attempt.attemptNo || "--") + " 次</span>",
                    "<span>" + escapeHtml(formatDate(attempt.submittedAt || attempt.createdAt)) + "</span>",
                    '<span class="teacher-review-attempt-status">' + escapeHtml(getReviewStatusLabel(attempt.status)) + "</span>",
                    "<span>" + escapeHtml(attempt.summary || "无") + "</span>",
                    "</div>",
                ].join("");
            }).join(""),
                "</div>",
            ].join("");
        }

        function selectReview(reviewId) {
            hideResult();
            state.selected = state.pendingReviews.find(function (row) { return asId(row.id) === asId(reviewId); }) || null;
            renderReviewList();
            renderSelected();
            if (state.selected) {
                loadSubmissionAttempts(state.selected).catch(function (err) {
                    showResult(err.message || "无法读取提交内容", true);
                });
            }
        }

        async function loadAssignments() {
            if (state.mockMode) {
                renderAssignmentOptions();
                return;
            }
            if (!state.currentCourseId) {
                state.assignments = [];
                state.currentAssignmentId = "";
                renderAssignmentOptions();
                return;
            }
            var payload = await window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.currentCourseId) + "/assignments");
            state.assignments = rowsOf(payload).filter(function (row) { return row.status !== "archived"; });
            if (!state.assignments.find(function (row) { return asId(row.id) === asId(state.currentAssignmentId); })) {
                state.currentAssignmentId = state.assignments[0] ? asId(state.assignments[0].id) : "";
            }
            renderAssignmentOptions();
        }

        async function loadStages() {
            if (state.mockMode) {
                renderStageOptions();
                return;
            }
            if (!state.currentAssignmentId) {
                state.stages = [];
                state.currentStageId = "";
                renderStageOptions();
                return;
            }
            var payload = await window.linkseeApi.getJson("/api/v1/assignments/" + encodeURIComponent(state.currentAssignmentId) + "/stages");
            state.stages = rowsOf(payload).filter(function (row) { return row.status !== "archived"; });
            if (state.currentStageId && !state.stages.find(function (row) { return asId(row.id) === asId(state.currentStageId); })) {
                state.currentStageId = "";
            }
            renderStageOptions();
        }

        async function loadPendingReviews() {
            if (state.mockMode) {
                var selectedId = asId(state.selected && state.selected.id);
                state.pendingReviewsRaw = mockReviewRows();
                state.currentQueuePage = 1;
                applyReviewFilters();
                state.selected = selectedId
                    ? (state.pendingReviews.find(function (row) { return asId(row.id) === selectedId; }) || state.pendingReviews[0] || null)
                    : (state.pendingReviews[0] || null);
                renderSummary();
                renderReviewList();
                renderSelected();
                if (state.selected) {
                    state.submissionAttempts = mockSubmissionAttempts(state.selected);
                } else {
                    state.submissionAttempts = [];
                }
                renderSubmissionDetail();
                renderAttemptList();
                return;
            }
            if (!state.currentCourseId) {
                state.pendingReviewsRaw = [];
                state.pendingReviews = [];
                state.selected = null;
                state.currentQueuePage = 1;
                renderSummary();
                renderReviewList();
                renderSelected();
                return;
            }
            var payload = await window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.currentCourseId) + "/pending-reviews?scope=workbench");
            state.pendingReviewsRaw = rowsOf(payload);
            state.currentQueuePage = 1;
            await enrichGroupLeaders(state.pendingReviewsRaw);
            applyReviewFilters();
            await loadGrades();
            renderSummary();
            renderReviewList();
            renderSelected();
            if (state.selected) {
                await loadSubmissionAttempts(state.selected);
            } else {
                state.submissionAttempts = [];
                renderAttemptList();
                renderSubmissionDetail();
            }
        }

        async function loadGrades() {
            if (state.mockMode) return;
            if (!state.currentCourseId) return;
            var payload = await window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.currentCourseId) + "/grades");
            var grades = rowsOf(payload);
            state.pendingReviews = state.pendingReviews.map(function (review) {
                var grade = grades.find(function (item) { return asId(item.submissionId) === asId(review.id); });
                if (grade) {
                    review.grade = grade;
                    review.gradeId = grade.id;
                }
                return review;
            });
        }

        async function loadSubmissionAttempts(review) {
            if (!review) return;
            if (state.mockMode) {
                state.submissionAttempts = mockSubmissionAttempts(review);
                renderSubmissionDetail();
                renderAttemptList();
                return;
            }
            var payload = await window.linkseeApi.getJson(
                "/api/v1/stages/" + encodeURIComponent(review.stageId) + "/groups/" + encodeURIComponent(review.groupId) + "/submissions"
            );
            state.submissionAttempts = rowsOf(payload);
            if (!state.submissionAttempts.length && state.mockMode) {
                state.submissionAttempts = mockSubmissionAttempts(review);
            }
            renderSubmissionDetail();
            renderAttemptList();
        }

        async function loadAll() {
            var payload = await window.linkseeApi.getJson("/api/v1/courses");
            state.courses = rowsOf(payload);
            renderCourseOptions();
            await loadAssignments();
            await loadStages();
            await loadPendingReviews();
        }

        async function refreshFromCourse(resetSelection) {
            if (resetSelection) {
                state.selected = null;
                state.submissionAttempts = [];
            }
            await loadAssignments();
            await loadStages();
            await loadPendingReviews();
        }

        async function refreshFromAssignment(resetSelection) {
            if (resetSelection) {
                state.selected = null;
                state.submissionAttempts = [];
            }
            await loadStages();
            await loadPendingReviews();
        }

        async function startReview() {
            if (!state.selected) return;
            if (state.mockMode) {
                state.selected.status = "under_review";
                state.pendingReviewsRaw = state.pendingReviewsRaw.map(function (review) {
                    return asId(review.id) === asId(state.selected.id) ? state.selected : review;
                });
                applyReviewFilters();
                renderReviewList();
                renderSelected();
                return;
            }
            await window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(state.selected.id) + "/reviews/start", {});
        }

        async function saveReview() {
            if (!state.selected) return;
            var comment = q("#gradeFeedbackInput") ? q("#gradeFeedbackInput").value.trim() : "";
            var status = q("#teacherReviewStatus") ? q("#teacherReviewStatus").value : "approved";
            if (!comment) {
                throw new Error("请先填写批阅意见");
            }
            if (state.mockMode) {
                state.selected.status = status;
                state.selected.reviewComment = comment;
                state.pendingReviewsRaw = state.pendingReviewsRaw.map(function (review) {
                    return asId(review.id) === asId(state.selected.id) ? state.selected : review;
                });
                applyReviewFilters();
                renderReviewList();
                renderSelected();
                return;
            }
            await window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(state.selected.id) + "/reviews", {
                status: status,
                comment: comment,
            });
            await loadPendingReviews();
        }

        async function saveGradeDraft() {
            if (!state.selected) return;
            if (!canSaveGradeDraft(state.selected.status)) {
                throw new Error("当前提交状态还不能评分");
            }
            if (hasPublishedGrade(state.selected)) {
                throw new Error("该成绩已发布，如需修改请走已发布成绩调整接口");
            }
            var scoreInput = q("#gradeScoreInput");
            var scoreValue = scoreInput && scoreInput.value !== "" ? Number(scoreInput.value) : Number.NaN;
            if (!Number.isFinite(scoreValue)) {
                throw new Error("请先输入 0-100 的分数");
            }
            if (state.mockMode) {
                state.selected.gradeId = state.selected.gradeId || "mock-grade-" + asId(state.selected.id);
                state.selected.grade = { id: state.selected.gradeId, score: scoreValue };
                state.pendingReviewsRaw = state.pendingReviewsRaw.map(function (review) {
                    return asId(review.id) === asId(state.selected.id) ? state.selected : review;
                });
                applyReviewFilters();
                renderReviewList();
                renderSelected();
                return;
            }
            await window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(state.selected.id) + "/grade-drafts", {
                score: scoreValue,
            });
            await loadPendingReviews();
        }

        async function publishGrade() {
            if (!state.selected) return;
            if (!canSaveGradeDraft(state.selected.status)) {
                throw new Error("当前提交状态还不能发布成绩");
            }
            var gradeId = state.selected.gradeId || state.selected.grade && state.selected.grade.id;
            if (!gradeId) {
                throw new Error("请先保存分数草稿");
            }
            if (state.mockMode) {
                state.selected.status = "approved";
                state.selected.publishedAt = new Date().toISOString();
                state.pendingReviewsRaw = state.pendingReviewsRaw.map(function (review) {
                    return asId(review.id) === asId(state.selected.id) ? state.selected : review;
                });
                applyReviewFilters();
                renderReviewList();
                renderSelected();
                return;
            }
            await window.linkseeApi.postJson("/api/v1/grades/" + encodeURIComponent(gradeId) + "/publish", {});
            await loadPendingReviews();
        }

        function bindEvents() {
            q("#teacherCourseSelect").addEventListener("change", function () {
                state.currentCourseId = q("#teacherCourseSelect").value;
                state.currentAssignmentId = "";
                state.currentStageId = "";
                hideResult();
                refreshFromCourse(true).catch(function (err) {
                    showResult(err.message || "课程加载失败", true);
                });
            });

            q("#teacherAssignmentSelect").addEventListener("change", function () {
                state.currentAssignmentId = q("#teacherAssignmentSelect").value;
                state.currentStageId = "";
                hideResult();
                refreshFromAssignment(true).catch(function (err) {
                    showResult(err.message || "项目加载失败", true);
                });
            });

            q("#teacherStageSelect").addEventListener("change", function () {
                state.currentStageId = q("#teacherStageSelect").value;
                hideResult();
                applyReviewFilters();
                renderSummary();
                renderReviewList();
                renderSelected();
                if (state.selected) {
                    loadSubmissionAttempts(state.selected).catch(function (err) {
                        showResult(err.message || "阶段详情加载失败", true);
                    });
                }
            });

            q("#teacherReloadBtn").addEventListener("click", function () {
                hideResult();
                loadPendingReviews().catch(function (err) {
                    showResult(err.message || "刷新失败", true);
                });
            });

            q("#teacherQueuePrev").addEventListener("click", function () {
                if (state.currentQueuePage <= 1) return;
                state.currentQueuePage -= 1;
                renderReviewList();
            });

            q("#teacherQueueNext").addEventListener("click", function () {
                var totalPages = Math.max(1, Math.ceil(state.pendingReviews.length / state.queuePageSize));
                if (state.currentQueuePage >= totalPages) return;
                state.currentQueuePage += 1;
                renderReviewList();
            });

            q("#startReviewBtn").addEventListener("click", function () {
                hideResult();
                startReview().then(function () {
                    showResult("已进入评审状态。", false);
                    return loadPendingReviews();
                }).catch(function (err) {
                    showResult(err.message || "开始评审失败", true);
                });
            });

            q("#saveReviewBtn").addEventListener("click", function () {
                hideResult();
                saveReview().then(function () {
                    showResult("批阅结果已提交。", false);
                }).catch(function (err) {
                    showResult(err.message || "保存批阅失败", true);
                });
            });

            q("#saveDraftBtn").addEventListener("click", function () {
                hideResult();
                saveGradeDraft().then(function () {
                    showResult("分数草稿已保存。", false);
                }).catch(function (err) {
                    showResult(err.message || "保存草稿失败", true);
                });
            });

            q("#publishGradeBtn").addEventListener("click", function () {
                hideResult();
                publishGrade().then(function () {
                    showResult("成绩已确定并发布。", false);
                }).catch(function (err) {
                    showResult(err.message || "发布成绩失败", true);
                });
            });
        }

        bindEvents();
        if (state.mockMode) {
            loadMockData();
            return;
        }
        loadAll().catch(function (err) {
            var reviewList = q("#teacherReviewList");
            if (reviewList) {
                reviewList.innerHTML = '<div class="dashboard-empty-state"><strong>课程加载失败</strong><p>' + escapeHtml(err.message || "请检查后端服务是否正常") + "</p></div>";
            }
        });
    }

    window.initTeacherDashboard = initTeacherDashboard;
})();
