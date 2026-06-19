(function () {
    function initAssistantDashboard() {
        var assistantReviewMockPref = "";
        try {
            assistantReviewMockPref = window.localStorage ? String(window.localStorage.getItem("linksee_assistant_review_mock") || "") : "";
        } catch (_err) {
            assistantReviewMockPref = "";
        }
        var assistantReviewMockAllowed = assistantReviewMockPref !== "0";
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
            mockMode: assistantReviewMockAllowed,
        };

        function q(selector) {
            return document.querySelector(selector);
        }

        function escapeHtml(value) {
            if (window.linkseePage && typeof window.linkseePage.escapeHtml === "function") {
                return window.linkseePage.escapeHtml(value);
            }
            return String(value || "").replace(/[&<>"']/g, function (ch) {
                return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
            });
        }

        function formatDate(value) {
            if (window.linkseePage && typeof window.linkseePage.formatDateTime === "function") {
                return window.linkseePage.formatDateTime(value);
            }
            if (!value) return "--";
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
            return '<span class="assistant-review-empty-text">暂无信息</span>';
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
                        '<div class="assistant-review-file-row">',
                        '<span class="assistant-review-file-icon">' + renderFileIconSvg(file.name, file.mimeType) + "</span>",
                        '<div class="assistant-review-file-copy">',
                        '<strong>' + escapeHtml(file.name || "未命名附件") + "</strong>",
                        "</div>",
                        '<span class="assistant-review-file-size">' + escapeHtml(formatFileSize(file.size)) + "</span>",
                        '<button class="assistant-review-file-download" type="button"' + (file.downloadPath ? ' data-download-path="' + escapeHtml(file.downloadPath) + '"' : " disabled") + '>下载</button>',
                        "</div>",
                    ].join("");
                }).join("")
                : '<div class="assistant-review-file-empty">暂无附件</div>';

            return [
                '<div class="assistant-review-detail-layout">',
                '<div class="assistant-review-detail-main">',
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">提交标题</span><div class="assistant-review-richtext">' + (title || summary ? escapeHtml(title || summary) : renderEmptyInfoText()) + '</div></div>',
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">成果说明</span><div class="assistant-review-richtext">' + (description || summary ? escapeHtml(description || summary) : renderEmptyInfoText()) + "</div></div>",
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">贡献说明</span><div class="assistant-review-richtext">' + (contributionNote ? escapeHtml(contributionNote) : renderEmptyInfoText()) + "</div></div>",
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">仓库链接</span>' + (
                    repositoryUrl
                        ? '<a class="dashboard-inline-link" href="' + escapeHtml(repositoryUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(repositoryUrl) + "</a>"
                        : '<div class="assistant-review-richtext">' + renderEmptyInfoText() + "</div>"
                ) + "</div>",
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">参考链接</span>' + (
                    links.length
                        ? '<div class="assistant-review-link-list">' + links.map(function (link) {
                            return '<a class="dashboard-inline-link" href="' + escapeHtml(link) + '" target="_blank" rel="noreferrer">' + escapeHtml(link) + "</a>";
                        }).join("") + "</div>"
                        : '<div class="assistant-review-richtext">' + renderEmptyInfoText() + "</div>"
                ) + "</div>",
                "</div>",
                '<aside class="assistant-review-file-card">',
                '<div class="assistant-review-file-head"><span>附件列表</span><span>' + escapeHtml(files.length ? (String(files.length) + " 个文件") : "暂无附件") + "</span></div>",
                '<div class="assistant-review-file-list">' + fileList + "</div>",
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
                { id: "mock-sub-06", groupId: "mock-group-06", stageId: "mock-stage-03", status: "approved", submittedBy: "2024010128", submittedAt: new Date(now - 1000 * 60 * 660).toISOString(), createdAt: new Date(now - 1000 * 60 * 660).toISOString(), group: { groupNo: 6, name: "6" } },
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
            renderQueue();
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
            var color = "#6c8198";
            if (kind === "pdf") color = "#c85d52";
            else if (kind === "doc") color = "#4e79c7";
            else if (kind === "sheet") color = "#4f8b5d";
            else if (kind === "slide") color = "#d08a43";
            else if (kind === "image") color = "#8a68b8";
            return [
                '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
                '<path d="M7 3.5h6.8L19 8.7V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5Z" stroke="' + color + '" stroke-width="1.8"/>',
                '<path d="M13.5 3.8V9h5.2" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round"/>',
                '<path d="M8.8 13.2h6.4M8.8 16.2h4.6" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round"/>',
                "</svg>",
            ].join("");
        }

        function rowsOf(payload) {
            return Array.isArray(payload && payload.data) ? payload.data : [];
        }

        function asId(value) {
            return value === null || value === undefined ? "" : String(value);
        }

        function setResult(title, message, isError) {
            var node = q("#assistantActionResult");
            if (!node) return;
            node.hidden = false;
            node.classList.toggle("is-error", Boolean(isError));
            node.innerHTML = "<strong>" + escapeHtml(title) + "</strong><p>" + escapeHtml(message || "") + "</p>";
        }

        function clearResult() {
            var node = q("#assistantActionResult");
            if (!node) return;
            node.hidden = true;
            node.classList.remove("is-error");
            node.innerHTML = "";
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
            var stageNo = stage.stageNo ? "阶段 " + stage.stageNo : "阶段";
            return stageNo + " · " + (stage.title || "未命名阶段");
        }

        function getAssignmentLabel(assignment) {
            return assignment ? (assignment.title || "未命名项目") : "全部项目";
        }

        function getReviewStatusLabel(status) {
            if (status === "under_review") return "评审中";
            if (status === "submitted") return "已提交";
            if (status === "approved") return "已批改";
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

        function getQueueGroupTone(groupNo) {
            var value = Number(groupNo || 0);
            var index = Number.isFinite(value) && value > 0 ? ((value - 1) % 4) + 1 : 1;
            return "tone-" + index;
        }

        function getCurrentAssignmentStageIds() {
            return state.stages.map(function (row) { return asId(row.id); });
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

        function renderCourseOptions() {
            var courseSelect = q("#assistantCourseSelect");
            if (!courseSelect) return;
            var options = state.courses.map(function (course) {
                var label = course.name || course.courseNo || course.id;
                return '<option value="' + escapeHtml(course.id) + '">' + escapeHtml(label) + "</option>";
            }).join("");
            courseSelect.innerHTML = options || '<option value="">暂无绑定课程</option>';
            if (!state.currentCourseId && state.courses[0]) {
                state.currentCourseId = asId(state.courses[0].id);
            }
            courseSelect.value = state.currentCourseId;
        }

        function renderAssignmentOptions() {
            var assignmentSelect = q("#assistantAssignmentSelect");
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
            var stageSelect = q("#assistantStageSelect");
            if (!stageSelect) return;
            var options = ['<option value="">全部阶段</option>'].concat(state.stages.map(function (stage) {
                return '<option value="' + escapeHtml(stage.id) + '">' + escapeHtml(getStageLabel(stage)) + "</option>";
            })).join("");
            stageSelect.innerHTML = options;
            stageSelect.value = state.currentStageId || "";
        }

        function applyReviewFilters() {
            var stageIds = getCurrentAssignmentStageIds();
            var selectedStageId = asId(state.currentStageId);
            state.pendingReviews = state.pendingReviewsRaw.filter(function (review) {
                var reviewStageId = asId(review.stageId);
                if (selectedStageId) {
                    return reviewStageId === selectedStageId;
                }
                if (stageIds.length > 0) {
                    return stageIds.indexOf(reviewStageId) >= 0;
                }
                return true;
            });
            state.pendingReviews.sort(function (left, right) {
                var leftTime = new Date(left.submittedAt || left.createdAt || 0).getTime();
                var rightTime = new Date(right.submittedAt || right.createdAt || 0).getTime();
                return leftTime - rightTime;
            });
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
            q("#assistantPendingCount").textContent = "待批阅";
        }

        function renderQueue() {
            var list = q("#assistantSubmissionList");
            var pageNode = q("#assistantQueuePage");
            var prevBtn = q("#assistantQueuePrev");
            var nextBtn = q("#assistantQueueNext");
            if (!list) return;
            var totalPages = Math.max(1, Math.ceil(state.pendingReviews.length / state.queuePageSize));
            var pageRows = getPageReviews();
            if (pageNode) pageNode.textContent = state.currentQueuePage + " / " + totalPages;
            if (prevBtn) prevBtn.disabled = state.currentQueuePage <= 1;
            if (nextBtn) nextBtn.disabled = state.currentQueuePage >= totalPages;

            if (!state.pendingReviews.length) {
                list.innerHTML = '<div class="assistant-review-queue-empty">暂无组别提交</div>';
                return;
            }

            list.innerHTML = pageRows.map(function (review) {
                var groupNo = review.group && (review.group.groupNo || review.group.name) ? (review.group.groupNo || review.group.name) : "--";
                var leader = getLeaderMeta(review);
                var selected = state.selected && asId(state.selected.id) === asId(review.id);
                return [
                    '<div class="list-item dashboard-list-item-interactive assistant-review-queue-item' + (selected ? ' dashboard-list-item-selected' : "") + '" data-submission-id="' + escapeHtml(review.id) + '">',
                    '<div class="assistant-review-queue-group ' + getQueueGroupTone(groupNo) + '">第 ' + escapeHtml(groupNo) + " 组</div>",
                    '<div class="assistant-review-queue-status"><strong>' + escapeHtml(getReviewStatusLabel(review.status)) + "</strong><span>" + escapeHtml(formatQueueTime(review.submittedAt || review.createdAt)) + "</span></div>",
                    '<div class="assistant-review-queue-leader"><strong>' + escapeHtml(leader.realName || "--") + "</strong><span>" + escapeHtml(leader.accountNo || "--") + "</span></div>",
                    "</div>",
                ].join("");
            }).join("");

            Array.from(document.querySelectorAll("#assistantSubmissionList [data-submission-id]")).forEach(function (item) {
                item.addEventListener("click", function () {
                    selectReview(item.getAttribute("data-submission-id"));
                });
            });
        }

        function renderSelectedLegacy() {
            var selected = state.selected;
            var titleNode = q("#assistantSelectedTitle");
            var pathNode = q("#assistantSelectedPath");
            var contextNode = q("#assistantReviewContext");
            var detailNode = q("#assistantSubmissionDetail");
            var attemptNode = q("#assistantAttemptList");
            var startBtn = q("#assistantStartBtn");
            var saveBtn = q("#assistantReviewSaveBtn");

            if (!selected) {
                if (titleNode) titleNode.textContent = state.pendingReviews.length ? "请选择左侧提交" : "暂无组别提交";
                if (pathNode) pathNode.textContent = "课程 / 项目 / 阶段";
                if (contextNode) contextNode.textContent = "";
                if (detailNode) detailNode.innerHTML = buildSubmissionEmptyDetailHtml();
                if (attemptNode) attemptNode.innerHTML = '<div class="assistant-review-placeholder">暂无记录</div>';
                if (startBtn) startBtn.disabled = true;
                if (saveBtn) saveBtn.disabled = true;
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
            if (startBtn) {
                startBtn.disabled = selected.status !== "submitted";
            }
            if (saveBtn) {
                saveBtn.disabled = false;
            }

            renderSubmissionDetailLegacy();
            renderAttemptList();
        }

        function renderSubmissionDetailLegacy() {
            var node = q("#assistantSubmissionDetail");
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
                        '<div class="assistant-review-file-row">',
                        '<span class="assistant-review-file-name">' + escapeHtml(String(fileId)) + "</span>",
                        '<span class="assistant-review-file-meta">#' + escapeHtml(index + 1) + "</span>",
                        "</div>",
                    ].join("");
                }).join("")
                : '<div class="assistant-review-file-empty">无</div>';
            node.innerHTML = [
                '<div class="assistant-review-detail-layout">',
                '<div class="assistant-review-detail-main">',
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">提交标题</span><div class="assistant-review-richtext">' + escapeHtml(title || selectedSubmission.summary || "未填写") + "</div></div>",
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">提交内容</span><div class="assistant-review-richtext">' + escapeHtml(description || selectedSubmission.summary || "未填写") + "</div></div>",
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">贡献说明</span><div class="assistant-review-richtext">' + escapeHtml(contributionNote || "未填写") + "</div></div>",
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">仓库链接</span>' + (
                    repositoryUrl
                        ? '<a class="dashboard-inline-link" href="' + escapeHtml(repositoryUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(repositoryUrl) + "</a>"
                        : '<div class="assistant-review-richtext">未填写</div>'
                ) + "</div>",
                '<div class="assistant-review-detail-item"><span class="assistant-review-detail-label">参考链接</span>' + (
                    links.length
                        ? '<div class="assistant-review-link-list">' + links.map(function (link) {
                            return '<a class="dashboard-inline-link" href="' + escapeHtml(link) + '" target="_blank" rel="noreferrer">' + escapeHtml(link) + "</a>";
                        }).join("") + "</div>"
                        : '<div class="assistant-review-richtext">未填写</div>'
                ) + "</div>",
                "</div>",
                '<aside class="assistant-review-file-card">',
                '<div class="assistant-review-file-head"><span>文件索引</span><span>' + escapeHtml(fileIds.length) + " 项</span></div>",
                '<div class="assistant-review-file-list">' + fileList + "</div>",
                "</aside>",
                "</div>",
            ].join("");
        }

        function renderSelected() {
            var selected = state.selected;
            var titleNode = q("#assistantSelectedTitle");
            var pathNode = q("#assistantSelectedPath");
            var contextNode = q("#assistantReviewContext");
            var detailNode = q("#assistantSubmissionDetail");
            var attemptNode = q("#assistantAttemptList");
            var startBtn = q("#assistantStartBtn");
            var saveBtn = q("#assistantReviewSaveBtn");

            if (!selected) {
                if (titleNode) titleNode.textContent = state.pendingReviews.length ? "请选择左侧提交" : "暂无组别提交";
                if (pathNode) pathNode.textContent = "课程 / 项目 / 阶段";
                if (contextNode) contextNode.textContent = "";
                if (detailNode) detailNode.innerHTML = buildSubmissionEmptyDetailHtml();
                if (attemptNode) attemptNode.innerHTML = '<div class="assistant-review-placeholder">暂无记录</div>';
                if (startBtn) startBtn.disabled = true;
                if (saveBtn) saveBtn.disabled = true;
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
            if (startBtn) startBtn.disabled = selected.status !== "submitted";
            if (saveBtn) saveBtn.disabled = false;

            renderSubmissionDetail();
            renderAttemptList();
        }

        function renderSubmissionDetail() {
            var node = q("#assistantSubmissionDetail");
            if (!node) return;
            var selectedSubmission = state.selected && state.submissionAttempts.length
                ? (state.submissionAttempts.find(function (row) {
                return asId(row.id) === asId(state.selected.id);
            }) || state.submissionAttempts[0])
                : null;
            node.innerHTML = selectedSubmission ? buildSubmissionDetailHtml(selectedSubmission) : buildSubmissionEmptyDetailHtml();

            Array.from(node.querySelectorAll("[data-download-path]")).forEach(function (button) {
                button.addEventListener("click", async function () {
                    var downloadPath = button.getAttribute("data-download-path");
                    if (!downloadPath) return;
                    try {
                        if (/^(data:|blob:|https?:\/\/)/.test(downloadPath)) {
                            var directLink = document.createElement("a");
                            directLink.href = downloadPath;
                            directLink.target = "_blank";
                            directLink.rel = "noopener";
                            directLink.download = button.closest(".assistant-review-file-row")?.querySelector(".assistant-review-file-copy strong")?.textContent || "attachment";
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
                        setResult("附件下载失败", err.message || "请稍后重试", true);
                    }
                });
            });
        }

        function renderAttemptList() {
            var node = q("#assistantAttemptList");
            var countNode = q("#assistantAttemptCount");
            if (!node) return;
            if (!state.submissionAttempts.length) {
                if (countNode) countNode.textContent = "0 次";
                node.innerHTML = '<div class="assistant-review-placeholder">暂无记录</div>';
                return;
            }
            if (countNode) countNode.textContent = state.submissionAttempts.length + " 次";
            node.innerHTML = [
                '<div class="assistant-review-attempt-table">',
                '<div class="assistant-review-attempt-head">',
                "<span>次数</span>",
                "<span>提交时间</span>",
                "<span>状态</span>",
                "<span>摘要</span>",
                "</div>",
                state.submissionAttempts.map(function (attempt) {
                var isCurrent = state.selected && asId(state.selected.id) === asId(attempt.id);
                return [
                    '<div class="assistant-review-attempt-item' + (isCurrent ? " is-current" : "") + '">',
                    "<span>第 " + escapeHtml(attempt.attemptNo || "--") + " 次</span>",
                    "<span>" + escapeHtml(formatDate(attempt.submittedAt || attempt.createdAt)) + "</span>",
                    '<span class="assistant-review-attempt-status">' + escapeHtml(getReviewStatusLabel(attempt.status)) + "</span>",
                    "<span>" + escapeHtml(attempt.summary || "无") + "</span>",
                    "</div>",
                ].join("");
            }).join(""),
                "</div>",
            ].join("");
        }

        function selectReview(submissionId) {
            clearResult();
            state.selected = state.pendingReviews.find(function (row) { return asId(row.id) === asId(submissionId); }) || null;
            renderQueue();
            renderSelected();
            if (state.selected) {
                loadSubmissionAttempts(state.selected).catch(function (err) {
                    setResult("详情加载失败", err.message || "无法读取提交内容", true);
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
                renderQueue();
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
                renderQueue();
                renderSelected();
                return;
            }
            var payload = await window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(state.currentCourseId) + "/pending-reviews");
            state.pendingReviewsRaw = rowsOf(payload);
            state.currentQueuePage = 1;
            await enrichGroupLeaders(state.pendingReviewsRaw);
            applyReviewFilters();
            renderSummary();
            renderQueue();
            renderSelected();
            if (state.selected) {
                await loadSubmissionAttempts(state.selected);
            } else {
                state.submissionAttempts = [];
                renderAttemptList();
                renderSubmissionDetail();
            }
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

        function bindEvents() {
            q("#assistantCourseSelect").addEventListener("change", function () {
                state.currentCourseId = q("#assistantCourseSelect").value;
                state.currentAssignmentId = "";
                state.currentStageId = "";
                clearResult();
                refreshFromCourse(true).catch(function (err) {
                    setResult("课程加载失败", err.message || "请检查接口", true);
                });
            });

            q("#assistantAssignmentSelect").addEventListener("change", function () {
                state.currentAssignmentId = q("#assistantAssignmentSelect").value;
                state.currentStageId = "";
                clearResult();
                refreshFromAssignment(true).catch(function (err) {
                    setResult("项目加载失败", err.message || "请检查接口", true);
                });
            });

            q("#assistantStageSelect").addEventListener("change", function () {
                state.currentStageId = q("#assistantStageSelect").value;
                clearResult();
                applyReviewFilters();
                renderSummary();
                renderQueue();
                renderSelected();
                if (state.selected) {
                    loadSubmissionAttempts(state.selected).catch(function (err) {
                        setResult("阶段详情加载失败", err.message || "请检查接口", true);
                    });
                }
            });

            q("#assistantReloadBtn").addEventListener("click", function () {
                clearResult();
                loadPendingReviews().catch(function (err) {
                    setResult("刷新失败", err.message || "请检查接口", true);
                });
            });

            q("#assistantQueuePrev").addEventListener("click", function () {
                if (state.currentQueuePage <= 1) return;
                state.currentQueuePage -= 1;
                renderQueue();
            });

            q("#assistantQueueNext").addEventListener("click", function () {
                var totalPages = Math.max(1, Math.ceil(state.pendingReviews.length / state.queuePageSize));
                if (state.currentQueuePage >= totalPages) return;
                state.currentQueuePage += 1;
                renderQueue();
            });

            q("#assistantStartBtn").addEventListener("click", function () {
                if (!state.selected) {
                    setResult("无法开始", "请先选择提交。", true);
                    return;
                }
                clearResult();
                if (state.mockMode) {
                    state.selected.status = "under_review";
                    state.pendingReviewsRaw = state.pendingReviewsRaw.map(function (review) {
                        return asId(review.id) === asId(state.selected.id) ? state.selected : review;
                    });
                    applyReviewFilters();
                    renderQueue();
                    renderSelected();
                    setResult("已进入评审", "mock 数据已更新为评审中。", false);
                    return;
                }
                window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(state.selected.id) + "/reviews/start", {})
                    .then(function () {
                        setResult("已进入评审", "该提交状态已更新为评审中。", false);
                        return loadPendingReviews();
                    })
                    .catch(function (err) {
                        setResult("开始失败", err.message || "无法开始评审", true);
                    });
            });

            q("#assistantReviewSaveBtn").addEventListener("click", function () {
                if (!state.selected) {
                    setResult("无法提交", "请先选择提交。", true);
                    return;
                }
                var comment = q("#assistantCommentInput").value.trim();
                var status = q("#assistantReviewStatus").value;
                if (!comment) {
                    setResult("无法提交", "请先填写批阅意见。", true);
                    return;
                }
                clearResult();
                if (state.mockMode) {
                    state.selected.status = status;
                    state.selected.reviewComment = comment;
                    state.pendingReviewsRaw = state.pendingReviewsRaw.map(function (review) {
                        return asId(review.id) === asId(state.selected.id) ? state.selected : review;
                    });
                    q("#assistantCommentInput").value = "";
                    applyReviewFilters();
                    renderQueue();
                    renderSelected();
                    setResult("批阅已提交", "mock 数据已写入批阅结论。", false);
                    return;
                }
                window.linkseeApi.postJson("/api/v1/submissions/" + encodeURIComponent(state.selected.id) + "/reviews", {
                    status: status,
                    comment: comment,
                }).then(function () {
                    q("#assistantCommentInput").value = "";
                    setResult("批阅已提交", "本次小组阶段提交已写入批阅结论。", false);
                    return loadPendingReviews();
                }).catch(function (err) {
                    setResult("提交失败", err.message || "无法提交批阅", true);
                });
            });
        }

        bindEvents();
        if (state.mockMode) {
            loadMockData();
            return;
        }
        loadAll().catch(function (err) {
            setResult("加载失败", err.message || "请检查后端服务是否正常", true);
        });
    }

    window.initAssistantDashboard = initAssistantDashboard;
})();
