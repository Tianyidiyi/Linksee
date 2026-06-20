(function () {
    function allowExplicitMock(queryKey) {
        try {
            var search = new URLSearchParams(window.location.search || "");
            var raw = String(search.get(queryKey) || "").trim().toLowerCase();
            return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
        } catch (_err) {
            return false;
        }
    }

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.from((root || document).querySelectorAll(selector));
    }

    function rowsOf(payload, key) {
        var data = payload && payload.data ? payload.data : {};
        var rows = key ? data[key] : data;
        return Array.isArray(rows) ? rows : [];
    }

    function escapeHtml(value) {
        return window.linkseePage ? window.linkseePage.escapeHtml(value) : String(value || "");
    }

    function formatDate(value) {
        return value && window.linkseePage ? window.linkseePage.formatDate(value) : "--";
    }

    function formatDateTime(value) {
        return value && window.linkseePage ? window.linkseePage.formatDateTime(value) : "--";
    }

    function labelStatus(status) {
        var map = {
            submitted: "已提交",
            approved: "已通过",
            reviewed: "已评审",
            rejected: "已拒绝",
            needs_changes: "需修改",
            pending: "待处理",
            open: "进行中",
            closed: "已截止",
            archived: "已归档",
            not_submitted: "待提交",
            in_progress: "进行中",
            todo: "待开始",
            done: "已完成",
            active: "进行中",
            forming: "组队中",
            published: "已发布",
        };
        return map[status] || status || "--";
    }

    function badgeClass(status) {
        var key = String(status || "").toLowerCase();
        if (key === "approved" || key === "published" || key === "done" || key === "active" || key === "submitted") {
            return "badge badge-active";
        }
        if (key === "needs_changes" || key === "rejected" || key === "overdue") {
            return "badge badge-error";
        }
        if (key === "open" || key === "pending" || key === "in_progress" || key === "forming" || key === "reviewing") {
            return "badge badge-pending";
        }
        return "badge";
    }

    function safeText(node, value) {
        if (node) node.textContent = value;
    }

    function toArrayMap(rows, keyFn) {
        return rows.reduce(function (map, row) {
            var key = keyFn(row);
            if (!map[key]) map[key] = [];
            map[key].push(row);
            return map;
        }, {});
    }

    function uniqueBy(rows, keyFn) {
        var seen = new Set();
        return rows.filter(function (row) {
            var key = keyFn(row);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function summarizeDue(dueAt) {
        if (!dueAt) return "暂无截止信息";
        var diff = new Date(dueAt).getTime() - Date.now();
        var day = 24 * 60 * 60 * 1000;
        if (diff < 0) return "已截止";
        var days = Math.floor(diff / day);
        if (days > 0) return "剩余 " + days + " 天";
        var hours = Math.max(1, Math.floor(diff / (60 * 60 * 1000)));
        return "剩余 " + hours + " 小时";
    }

    function isPastDue(dueAt) {
        return Boolean(dueAt) && new Date(dueAt).getTime() < Date.now();
    }

    function displayStageStatus(row) {
        var submissionStatus = row && row.submission && row.submission.status ? String(row.submission.status) : "";
        if (submissionStatus) {
            return {
                key: submissionStatus,
                label: labelStatus(submissionStatus),
            };
        }
        if (row && row.stage && isPastDue(row.stage.dueAt)) {
            return {
                key: "closed",
                label: labelStatus("closed"),
            };
        }
        return {
            key: "not_submitted",
            label: labelStatus("not_submitted"),
        };
    }

    function formatSize(size) {
        var value = Number(size || 0);
        if (!value) return "--";
        if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + " MB";
        if (value >= 1024) return Math.max(1, Math.round(value / 1024)) + " KB";
        return value + " B";
    }

    function splitLines(value) {
        return String(value || "").split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean);
    }

    function normalizeRequirementFiles(value) {
        return Array.isArray(value) ? value.filter(function (item) { return item && typeof item === "object"; }) : [];
    }

    function fileExt(name) {
        var text = String(name || "");
        var idx = text.lastIndexOf(".");
        return idx >= 0 ? text.slice(idx + 1).toLowerCase() : "";
    }

    function materialTypeIcon(name) {
        var ext = fileExt(name);
        if (ext === "pdf") return "pdf";
        if (ext === "doc" || ext === "docx") return "doc";
        if (ext === "ppt" || ext === "pptx" || ext === "key") return "slides";
        if (ext === "xls" || ext === "xlsx" || ext === "csv") return "sheet";
        if (ext === "tex") return "tex";
        if (ext === "md" || ext === "markdown") return "markdown";
        if (ext === "mp4" || ext === "mov" || ext === "avi" || ext === "mkv" || ext === "webm") return "media";
        if (ext === "zip" || ext === "rar" || ext === "7z") return "archive";
        return "file";
    }

    function materialIconSvg(type) {
        if (type === "pdf") {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path><path d="M8.7 16.8h1v-1.9h1.2c1.4 0 2.4-.8 2.4-2.1s-.9-2-2.4-2H8.7v6Zm1-2.8v-2.2h1.1c.9 0 1.5.4 1.5 1.1 0 .8-.6 1.1-1.5 1.1H9.7Zm4 2.8h2c1.8 0 3.1-1.2 3.1-3.1s-1.3-3.1-3.1-3.1h-2v6.2Zm1-1v-4.2h.9c1.3 0 2.1.8 2.1 2.1s-.8 2.1-2.1 2.1h-.9Z"></path></svg>';
        }
        if (type === "doc") {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path><path d="M8.5 12.2h2c1.6 0 2.7 1 2.7 2.8 0 1.7-1.1 2.8-2.7 2.8h-2v-5.6Zm1 4.7h.9c1 0 1.8-.6 1.8-1.9 0-1.3-.8-1.9-1.8-1.9h-.9v3.8Zm4.3.9h1v-2.2h2.4v-.9h-2.4V13h2.7v-.8h-3.7v5.6Z"></path></svg>';
        }
        if (type === "sheet") {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path><path d="M8.5 12.3h4.4v1H8.5v-1Zm0 2.1h4.4v1H8.5v-1Zm0 2.1h7v1h-7v-1Zm5-5.2h2v3.2h-2z"></path></svg>';
        }
        if (type === "slides") {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path><path d="M8.8 12h6.4v1.2H8.8zm0 2.2H14v1.2H8.8zm0 2.2h4.4v1.2H8.8z"></path></svg>';
        }
        if (type === "tex") {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path><path d="M8.6 12h6.8v1.1h-2.8v4.7h-1.2v-4.7H8.6V12Z"></path></svg>';
        }
        if (type === "markdown") {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path><path d="M8 16v-4h1.2l1.3 1.7 1.3-1.7H13v4h-1.1v-2.3l-1.3 1.6-1.4-1.6V16H8Zm6.1 0v-4h1.2v2l1.4-1.2v1.3l-1.4 1.1Z"></path></svg>';
        }
        if (type === "media") {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path><path d="m10.2 11.9 4.6 2.6-4.6 2.6z"></path></svg>';
        }
        if (type === "archive") {
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path><path d="M9 12h6v1H9zm1 2h4v1h-4zm0 2h4v1h-4zm1-7h2v2h-2z"></path></svg>';
        }
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 1.5V9h4.5"></path></svg>';
    }

    function memberDisplayName(member, index) {
        var profile = member && member.user && member.user.profile;
        return profile && (profile.realName || profile.accountNo) || ("成员" + (index + 1));
    }

    function memberAvatarText(member, index) {
        var name = memberDisplayName(member, index);
        return String(name).slice(0, 1).toUpperCase();
    }

    function courseIconVariant(course) {
        var text = [course && course.name, course && course.courseNo].join(" ").toLowerCase();
        if (text.indexOf("数据库") >= 0 || text.indexOf("db") >= 0) return "db";
        if (text.indexOf("人工智能") >= 0 || text.indexOf("ai") >= 0) return "ai";
        if (text.indexOf("软件") >= 0 || text.indexOf("程序") >= 0 || text.indexOf("se") >= 0) return "se";
        return "default";
    }

    function courseIconSvg(variant) {
        if (variant === "db") {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="7" ry="3"></ellipse><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"></path><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"></path></svg>';
        }
        if (variant === "ai") {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 12 7l5 10"></path><path d="M9.2 13h5.6"></path><path d="M5 20h14"></path></svg>';
        }
        if (variant === "se") {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18-6-6 6-6"></path><path d="m15 6 6 6-6 6"></path><path d="m14 4-4 16"></path></svg>';
        }
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5V5.5A2.5 2.5 0 0 1 6.5 3Z"></path></svg>';
    }

    function projectFolderVariant(index) {
        return ["green", "blue", "purple"][index % 3];
    }

    function projectFolderSvg() {
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4 12 6h7a2 2 0 0 1 2 2v2H3V6a2 2 0 0 1 2-2h5Zm11 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6h18Z"></path></svg>';
    }

    function stageTone(row) {
        var status = row.submission && row.submission.status ? row.submission.status : "";
        if (status === "submitted" || status === "approved" || status === "reviewed") return "submitted";
        if (!status && row.stage && isPastDue(row.stage.dueAt)) return "idle";
        if (status === "needs_changes" || status === "rejected" || row.stage.status === "open") return "pending";
        return "idle";
    }

    function mockIso(daysOffset, hour) {
        var date = new Date();
        date.setDate(date.getDate() + daysOffset);
        date.setHours(hour || 9, 0, 0, 0);
        return date.toISOString();
    }

    function createMockStudentDashboard() {
        var course = {
            id: "mock-course-se",
            name: "软件工程课程设计",
            courseNo: "SE-2026-01",
            academicYear: 2026,
            semester: 2,
            status: "active",
        };
        var assignment = {
            id: "mock-assignment-linksee",
            courseId: course.id,
            title: "Linksee 协作平台项目",
            status: "active",
            updatedAt: mockIso(-1, 18),
        };
        var group = {
            id: "mock-group-aurora",
            name: "极光小组",
            myRole: "leader",
            _count: { members: 4 },
        };
        var members = [
            { id: "m-1", role: "leader", user: { id: "2023010001", profile: { realName: "小泉", avatarUrl: "" } } },
            { id: "m-2", role: "member", user: { id: "2023010002", profile: { realName: "林夏", avatarUrl: "" } } },
            { id: "m-3", role: "member", user: { id: "2023010003", profile: { realName: "陈北", avatarUrl: "" } } },
            { id: "m-4", role: "member", user: { id: "2023010004", profile: { realName: "许言", avatarUrl: "" } } },
        ];
        var stage1 = {
            id: "mock-stage-1",
            assignmentId: assignment.id,
            stageNo: 1,
            title: "需求分析与原型",
            status: "open",
            dueAt: mockIso(-8, 23),
            description: "完成需求梳理、业务流程图与页面原型。",
            acceptCriteria: "提交用户故事图\n补齐原型图链接\n说明角色权限边界",
            submissionDesc: "重点检查需求是否完整、界面流程是否闭环。",
            requirementFiles: [
                { name: "阶段一需求说明.pdf", size: 238000, url: "#" },
                { name: "原型参考稿.fig", size: 482000, url: "#" },
            ],
        };
        var stage2 = {
            id: "mock-stage-2",
            assignmentId: assignment.id,
            stageNo: 2,
            title: "前后端联调",
            status: "open",
            dueAt: mockIso(-1, 23),
            description: "完成聊天、组队、提交、成绩四个核心模块联调。",
            acceptCriteria: "录制联调演示视频\n补齐接口对齐清单\n说明异常处理策略",
            submissionDesc: "本阶段关注接口闭环、交互稳定性与异常状态处理。",
            requirementFiles: [
                { name: "联调检查表.xlsx", size: 126000, url: "#" },
                { name: "接口对齐说明.docx", size: 164000, url: "#" },
                { name: "演示视频脚本.md", size: 12000, url: "#" },
            ],
        };
        var stage3 = {
            id: "mock-stage-3",
            assignmentId: assignment.id,
            stageNo: 3,
            title: "发布准备与展示答辩",
            status: "open",
            dueAt: mockIso(5, 20),
            description: "整理展示材料，准备答辩演示与最终版本说明。",
            acceptCriteria: "完善最终展示稿\n上传部署说明\n准备答辩问答要点",
            submissionDesc: "当前阶段重点关注展示表达、交付质量与部署说明。",
            requirementFiles: [
                { name: "答辩模板.pptx", size: 336000, url: "#" },
            ],
        };
        var todoRows = [
            {
                course: course,
                assignment: assignment,
                stage: stage1,
                group: group,
                submission: {
                    id: "mock-submission-1",
                    title: "需求分析稿 v1",
                    status: "reviewed",
                    submittedAt: mockIso(-10, 21),
                    createdAt: mockIso(-10, 21),
                    attemptNo: 1,
                    files: [
                        { name: "需求分析.pdf", size: 348000 },
                        { name: "原型说明.docx", size: 92000 },
                    ],
                },
            },
            {
                course: course,
                assignment: assignment,
                stage: stage2,
                group: group,
                submission: {
                    id: "mock-submission-2",
                    title: "联调结果包",
                    status: "submitted",
                    submittedAt: mockIso(-2, 22),
                    createdAt: mockIso(-2, 22),
                    attemptNo: 2,
                    files: [
                        { name: "联调记录.zip", size: 1448000 },
                        { name: "演示视频.mp4", size: 24800000 },
                    ],
                },
            },
            {
                course: course,
                assignment: assignment,
                stage: stage3,
                group: group,
                submission: null,
            },
        ];
        var gradeRows = [
            {
                course: course,
                assignment: assignment,
                stage: stage1,
                submission: todoRows[0].submission,
                grade: {
                    id: "mock-grade-1",
                    score: 88,
                    status: "published",
                    publishedAt: mockIso(-7, 15),
                    updatedAt: mockIso(-7, 15),
                    createdAt: mockIso(-7, 15),
                },
            },
            {
                course: course,
                assignment: assignment,
                stage: stage2,
                submission: todoRows[1].submission,
                grade: {
                    id: "mock-grade-2",
                    score: 92,
                    status: "published",
                    publishedAt: mockIso(-1, 16),
                    updatedAt: mockIso(-1, 16),
                    createdAt: mockIso(-1, 16),
                },
            },
        ];
        return {
            courses: [course],
            todoRows: todoRows,
            gradeRows: gradeRows,
            stageDetailMap: {
                "mock-stage-1": stage1,
                "mock-stage-2": stage2,
                "mock-stage-3": stage3,
            },
            groupDetailMap: {
                "mock-group-aurora": {
                    id: group.id,
                    name: group.name,
                    members: members,
                },
            },
        };
    }

    async function initStudentDashboard() {
        if (!window.linkseeApi || !window.linkseePage) return;

        var todoToggle = document.getElementById("studentTodoToggle");
        var todoClose = document.getElementById("studentTodoClose");
        var todoPopover = document.getElementById("studentTodoPopover");
        var todoMemoList = document.getElementById("studentTodoMemoList");
        var todoCountBadge = document.getElementById("studentTodoCountBadge");
        var courseScopePicker = document.getElementById("studentCourseScopePicker");
        var courseScopeButton = document.getElementById("studentCourseScopeButton");
        var courseScopeText = document.getElementById("studentCourseScopeText");
        var courseScopeMenu = document.getElementById("studentCourseScopeMenu");
        var courseSearch = document.getElementById("studentCourseSearch");
        var courseSearchForm = document.getElementById("studentCourseSearchForm");
        var materialDialogBackdrop = document.getElementById("studentMaterialDialogBackdrop");
        var materialDialogClose = document.getElementById("studentMaterialDialogClose");
        var materialDialogList = document.getElementById("studentMaterialDialogList");
        var materialDialogMeta = document.getElementById("studentMaterialDialogMeta");
        var materialDialogToggleAll = document.getElementById("studentMaterialDialogToggleAll");
        var materialDialogDownload = document.getElementById("studentMaterialDialogDownload");
        var noticeDialogBackdrop = document.getElementById("studentNoticeDialogBackdrop");
        var noticeDialogClose = document.getElementById("studentNoticeDialogClose");
        var noticeDialogConfirm = document.getElementById("studentNoticeDialogConfirm");
        var noticeDialogTitle = document.getElementById("studentNoticeDialogTitle");
        var noticeDialogText = document.getElementById("studentNoticeDialogText");
        var gradeCourseSelect = document.getElementById("studentGradeCourseSelect");
        var gradeAssignmentSelect = document.getElementById("studentGradeAssignmentSelect");
        var gradePublishedOnly = document.getElementById("studentGradePublishedOnly");
        var teamTabs = qsa(".student-view-tab");
        var submitDraftBtn = document.getElementById("studentSubmitDraftBtn");
        var submitFiles = document.getElementById("extSubmitFiles");
        var submitQueue = document.getElementById("studentSubmitFileQueue");
        var openDiscussBtn = document.getElementById("studentOpenDiscussBtn");
        var openChatBtn = document.getElementById("studentOpenChatBtn");
        var copyInviteBtn = document.getElementById("studentCopyInviteBtn");
        var generateInviteBtn = document.getElementById("studentGenerateInviteBtn");
        var viewAllCoursesBtn = document.getElementById("studentGradeViewAllCourses");

        var state = {
            dashboard: null,
            selectedCourseId: "",
            selectedAssignmentId: "",
            selectedStageId: "",
            gradeCourseId: "",
            gradeAssignmentId: "",
            gradeStageId: "",
            courseSearch: "",
            inviteCode: "",
            stageDetailMap: {},
            groupDetailMap: {},
            materialDialogFiles: [],
            selectedMaterialKeys: [],
        };

        function toggleTodoPopover(forceOpen) {
            if (!todoPopover || !todoToggle) return;
            var shouldOpen = typeof forceOpen === "boolean" ? forceOpen : todoPopover.hidden;
            todoPopover.hidden = !shouldOpen;
            todoToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        }

        function closeCourseScopeMenu() {
            if (!courseScopeMenu || !courseScopeButton) return;
            courseScopeMenu.hidden = true;
            courseScopeButton.setAttribute("aria-expanded", "false");
            if (courseScopePicker) {
                courseScopePicker.classList.remove("is-open");
            }
            var hero = courseScopePicker ? courseScopePicker.closest(".student-course-hero") : null;
            if (hero) {
                hero.classList.remove("is-select-open");
            }
        }

        function openCourseScopeMenu() {
            if (!courseScopeMenu || !courseScopeButton) return;
            courseScopeMenu.hidden = false;
            courseScopeButton.setAttribute("aria-expanded", "true");
            if (courseScopePicker) {
                courseScopePicker.classList.add("is-open");
            }
            var hero = courseScopePicker ? courseScopePicker.closest(".student-course-hero") : null;
            if (hero) {
                hero.classList.add("is-select-open");
            }
        }

        function toggleCourseScopeMenu(forceOpen) {
            var shouldOpen = typeof forceOpen === "boolean" ? forceOpen : (courseScopeMenu ? courseScopeMenu.hidden : false);
            if (shouldOpen) {
                openCourseScopeMenu();
            } else {
                closeCourseScopeMenu();
            }
        }

        function switchPanel(targetId) {
            var nav = qs('.side-nav .nav-item[data-target="' + targetId + '"]');
            if (nav) nav.click();
        }

        function toggleTeamView(view) {
            var targetIdMap = {
                join: "studentTeamJoinView",
                activity: "studentTeamActivityView",
                workbench: "studentTeamWorkbenchView",
            };
            var targetId = targetIdMap[view] || "studentTeamJoinView";
            qsa(".student-team-view").forEach(function (node) {
                var active = node.id === targetId;
                node.hidden = !active;
                node.classList.toggle("is-active", active);
            });
            teamTabs.forEach(function (button) {
                var active = button.getAttribute("data-team-view") === view;
                button.classList.toggle("is-active", active);
            });
        }

        function closeMaterialDialog() {
            if (!materialDialogBackdrop) return;
            materialDialogBackdrop.hidden = true;
        }

        function openNoticeDialog(title, text) {
            if (noticeDialogTitle) noticeDialogTitle.textContent = title || "提示";
            if (noticeDialogText) noticeDialogText.textContent = text || "";
            if (noticeDialogBackdrop) {
                noticeDialogBackdrop.hidden = false;
            }
        }

        function closeNoticeDialog() {
            if (!noticeDialogBackdrop) return;
            noticeDialogBackdrop.hidden = true;
        }

        function setSelectValue(select, value) {
            if (!select || value === undefined || value === null) return false;
            var next = String(value);
            var options = Array.from(select.options || []);
            var matched = options.some(function (option) { return String(option.value) === next; });
            if (!matched) return false;
            select.value = next;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            if (typeof select.onchange === "function") {
                select.onchange(new Event("change"));
            }
            return true;
        }

        function setPanelContextWithRetry(selectId, value, callback, attempts) {
            var remaining = attempts || 10;
            var select = document.getElementById(selectId);
            if (setSelectValue(select, value)) {
                if (callback) callback();
                return;
            }
            if (remaining <= 0) return;
            window.setTimeout(function () {
                setPanelContextWithRetry(selectId, value, callback, remaining - 1);
            }, 120);
        }

        function goToSubmitPanel(row) {
            if (!row) return;
            if (isPastDue(row.stage && row.stage.dueAt)) {
                openNoticeDialog("阶段已截止", "当前阶段已经截止，不能继续在线提交。如需补交，请联系课程教师或助教。");
                return;
            }
            switchPanel("panel-file-submit");
            window.setTimeout(function () {
                setPanelContextWithRetry("extSubmitCourse", row.course && row.course.id, function () {
                    setPanelContextWithRetry("extSubmitAssignment", row.assignment && row.assignment.id, function () {
                        setPanelContextWithRetry("extSubmitStage", row.stage && row.stage.id, null, 10);
                    }, 10);
                }, 10);
            }, 90);
        }

        function goToWorkflowPanel(row) {
            if (!row) return;
            switchPanel("panel-minitask-manage");
            window.setTimeout(function () {
                setPanelContextWithRetry("extTaskCourse", row.course && row.course.id, function () {
                    setPanelContextWithRetry("extTaskAssignment", row.assignment && row.assignment.id, null, 10);
                }, 10);
            }, 90);
        }

        function renderMaterialDialog() {
            if (!materialDialogList || !materialDialogMeta || !materialDialogToggleAll) return;
            var files = state.materialDialogFiles || [];
            var selectedKeys = state.selectedMaterialKeys || [];
            materialDialogMeta.textContent = "已选择 " + selectedKeys.length + " / " + files.length + " 个文件";
            materialDialogToggleAll.textContent = files.length && selectedKeys.length === files.length ? "取消全选" : "全选";
            materialDialogList.innerHTML = files.map(function (file, index) {
                var key = String(file.url || file.name || index);
                var checked = selectedKeys.indexOf(key) >= 0;
                var iconType = materialTypeIcon(file.name);
                return [
                    '<button class="student-material-dialog-item' + (checked ? ' is-selected' : '') + '" type="button" data-material-key="' + escapeHtml(key) + '">',
                    '<span class="student-material-icon is-' + escapeHtml(iconType) + '">' + materialIconSvg(iconType) + '</span>',
                    '<span class="student-material-dialog-copy">',
                    '<strong>' + escapeHtml(file.name || "未命名材料") + '</strong>',
                    '<small>' + escapeHtml((fileExt(file.name || "").toUpperCase() || "FILE") + " · " + formatSize(file.size)) + '</small>',
                    '</span>',
                    '<span class="student-material-dialog-check' + (checked ? ' is-selected' : '') + '" aria-hidden="true"></span>',
                    '</button>',
                ].join("");
            }).join("") || '<div class="student-inline-empty">当前没有可下载材料</div>';
            qsa("[data-material-key]", materialDialogList).forEach(function (button) {
                button.addEventListener("click", function () {
                    var key = button.getAttribute("data-material-key") || "";
                    var next = state.selectedMaterialKeys.slice();
                    var index = next.indexOf(key);
                    if (index >= 0) {
                        next.splice(index, 1);
                    } else {
                        next.push(key);
                    }
                    state.selectedMaterialKeys = next;
                    renderMaterialDialog();
                });
            });
        }

        function openMaterialDialog(files) {
            state.materialDialogFiles = Array.isArray(files) ? files.slice() : [];
            state.selectedMaterialKeys = state.materialDialogFiles.map(function (file, index) {
                return String(file.url || file.name || index);
            });
            renderMaterialDialog();
            if (materialDialogBackdrop) {
                materialDialogBackdrop.hidden = false;
            }
        }

        function downloadMaterialFiles(files) {
            files.forEach(function (file) {
                if (!file || !file.url) return;
                var anchor = document.createElement("a");
                anchor.href = file.url;
                anchor.target = "_blank";
                anchor.rel = "noreferrer";
                anchor.download = file.name || "";
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
            });
        }

        async function ensureStageDetail(stageId) {
            if (!stageId) return null;
            if (state.stageDetailMap[stageId]) return state.stageDetailMap[stageId];
            try {
                var payload = await window.linkseeApi.getJson("/api/v1/stages/" + encodeURIComponent(stageId));
                state.stageDetailMap[stageId] = payload && payload.data ? payload.data : null;
                return state.stageDetailMap[stageId];
            } catch (_err) {
                state.stageDetailMap[stageId] = null;
                return null;
            }
        }

        async function ensureGroupDetail(groupId) {
            if (!groupId) return null;
            if (state.groupDetailMap[groupId]) return state.groupDetailMap[groupId];
            try {
                var payload = await window.linkseeApi.getJson("/api/v1/groups/" + encodeURIComponent(groupId));
                state.groupDetailMap[groupId] = payload && payload.data ? payload.data : null;
                return state.groupDetailMap[groupId];
            } catch (_err) {
                state.groupDetailMap[groupId] = null;
                return null;
            }
        }

        function renderSubmitFileQueue() {
            if (!submitQueue) return;
            function fileKind(name) {
                var ext = String(name || "").split(".").pop().toLowerCase();
                if (["pdf"].indexOf(ext) >= 0) return "pdf";
                if (["doc", "docx", "txt", "md"].indexOf(ext) >= 0) return "doc";
                if (["xls", "xlsx", "csv"].indexOf(ext) >= 0) return "sheet";
                if (["ppt", "pptx"].indexOf(ext) >= 0) return "slides";
                if (["zip", "rar", "7z", "tar", "gz"].indexOf(ext) >= 0) return "archive";
                if (["mp4", "mov", "avi", "mkv"].indexOf(ext) >= 0) return "media";
                return "file";
            }
            function fileIcon(kind) {
                if (kind === "pdf") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4h6l4 4v12H8z" stroke-linejoin="round"/><path d="M14 4v4h4M10 13h4M10 16h3" stroke-linecap="round"/></svg>';
                if (kind === "doc") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4h6l4 4v12H8z" stroke-linejoin="round"/><path d="M10 12h4M10 15h5" stroke-linecap="round"/><path d="M14 4v4h4" stroke-linejoin="round"/></svg>';
                if (kind === "sheet") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h3" stroke-linecap="round"/></svg>';
                if (kind === "slides") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="5" width="14" height="10" rx="2"/><path d="M9 19h6M12 15v4" stroke-linecap="round"/></svg>';
                if (kind === "archive") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h10v16H7z" stroke-linejoin="round"/><path d="M10 4v4h4V4M10 12h4" stroke-linecap="round"/></svg>';
                if (kind === "media") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z" stroke-linejoin="round"/></svg>';
                return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4h6l4 4v12H8z" stroke-linejoin="round"/><path d="M14 4v4h4" stroke-linejoin="round"/></svg>';
            }
            var files = Array.from((submitFiles && submitFiles.files) || []);
            submitQueue.innerHTML = files.map(function (file) {
                var size = file.size > 1024 * 1024
                    ? (file.size / (1024 * 1024)).toFixed(2) + " MB"
                    : Math.max(1, Math.round(file.size / 1024)) + " KB";
                var kind = fileKind(file.name);
                return [
                    '<div class="student-file-chip">',
                    '<span class="student-submit-file-icon is-' + escapeHtml(kind) + '" aria-hidden="true">' + fileIcon(kind) + '</span>',
                    '<span class="student-submit-file-copy"><strong>' + escapeHtml(file.name) + '</strong><span>' + escapeHtml(size) + '</span><small>' + escapeHtml((fileExt(file.name).toUpperCase() || "FILE") + " · 已加入本次提交") + '</small></span>',
                    '</div>',
                ].join("");
            }).join("") || '<div class="student-inline-empty">尚未选择文件</div>';
        }

        function buildAssignments(todoRows) {
            return uniqueBy(todoRows.map(function (row) {
                return {
                    id: row.assignment.id,
                    courseId: row.course.id,
                    title: row.assignment.title,
                    status: row.assignment.status,
                    updatedAt: row.assignment.updatedAt || row.assignment.createdAt || row.stage.dueAt || null,
                    group: row.group,
                };
            }), function (row) { return String(row.id); });
        }

        function syncCurrentSelections(courseRows, todoRows) {
            function pickPreferred(rows) {
                return rows.find(function (row) {
                    return row.stage && row.stage.status === "open";
                }) || rows.find(function (row) {
                    return !row.submission || (row.submission.status !== "approved" && row.submission.status !== "reviewed");
                }) || rows[0] || null;
            }
            if (!state.selectedCourseId && courseRows.length) {
                var preferredCourseRow = pickPreferred(todoRows);
                state.selectedCourseId = String(preferredCourseRow ? preferredCourseRow.course.id : courseRows[0].id);
            }
            var filteredRows = todoRows.filter(function (row) {
                return !state.selectedCourseId || String(row.course.id) === String(state.selectedCourseId);
            });
            if (!state.selectedAssignmentId && filteredRows.length) {
                var preferredAssignmentRow = pickPreferred(filteredRows);
                state.selectedAssignmentId = String(preferredAssignmentRow ? preferredAssignmentRow.assignment.id : filteredRows[0].assignment.id);
            }
            var filteredStages = filteredRows.filter(function (row) {
                return !state.selectedAssignmentId || String(row.assignment.id) === String(state.selectedAssignmentId);
            });
            if (!state.selectedStageId && filteredStages.length) {
                var preferredStageRow = pickPreferred(filteredStages);
                state.selectedStageId = String(preferredStageRow ? preferredStageRow.stage.id : filteredStages[0].stage.id);
            }
            if (!state.gradeCourseId && courseRows.length) {
                state.gradeCourseId = String(courseRows[0].id);
            }
        }

        function renderTodoPopover(activeTodoRows) {
            if (todoCountBadge) {
                todoCountBadge.textContent = String(activeTodoRows.length);
                todoCountBadge.hidden = activeTodoRows.length === 0;
            }
            if (!todoMemoList) return;
            todoMemoList.innerHTML = activeTodoRows.map(function (row) {
                var isOverdue = row.stage.dueAt && new Date(row.stage.dueAt).getTime() < Date.now();
                var displayStatus = displayStageStatus(row);
                return '<article class="student-todo-note' + (isOverdue ? ' is-overdue' : '') + '"><div><strong>' + escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</strong><p>课程：' + escapeHtml(row.course.name || "--") + '</p><p>截止：' + escapeHtml(formatDate(row.stage.dueAt)) + ' · 状态：' + escapeHtml(displayStatus.label) + '</p></div><button class="btn btn-secondary student-todo-submit" type="button" data-submit-panel="true" data-stage-id="' + escapeHtml(row.stage.id) + '">提交</button></article>';
            }).join("") || '<div class="student-todo-empty"><strong>暂无待办</strong><p>当前没有需要处理的阶段任务。</p></div>';
            qsa("[data-submit-panel]", todoMemoList).forEach(function (button) {
                button.addEventListener("click", function () {
                    toggleTodoPopover(false);
                    switchPanel("panel-file-submit");
                });
            });
        }

        function renderCoursePanel(courseRows, todoRows, gradeRows) {
            var searchKeyword = (state.courseSearch || "").trim().toLowerCase();
            var filteredCourseRows = courseRows.filter(function (course) {
                if (!searchKeyword) return true;
                return [course.name, course.courseNo].join(" ").toLowerCase().indexOf(searchKeyword) >= 0;
            });
            var selectedCourseRows = filteredCourseRows.filter(function (course) {
                return !state.selectedCourseId || String(course.id) === String(state.selectedCourseId);
            });
            var selectedCourse = selectedCourseRows[0] || filteredCourseRows[0] || null;
            var effectiveCourseId = selectedCourse ? String(selectedCourse.id) : "";
            var courseScopedRows = todoRows.filter(function (row) {
                return !effectiveCourseId || String(row.course.id) === effectiveCourseId;
            });
            var assignmentRows = buildAssignments(courseScopedRows);
            if (assignmentRows.length && !assignmentRows.some(function (row) { return String(row.id) === String(state.selectedAssignmentId); })) {
                state.selectedAssignmentId = String(assignmentRows[0].id);
            }
            var assignmentScopedRows = courseScopedRows.filter(function (row) {
                return !state.selectedAssignmentId || String(row.assignment.id) === String(state.selectedAssignmentId);
            });
            if (assignmentScopedRows.length && !assignmentScopedRows.some(function (row) { return String(row.stage.id) === String(state.selectedStageId); })) {
                state.selectedStageId = String(assignmentScopedRows[0].stage.id);
            }
            var stageRows = assignmentScopedRows.slice().sort(function (a, b) {
                return Number(a.stage.stageNo || 0) - Number(b.stage.stageNo || 0);
            });
            var selectedStageRow = stageRows.find(function (row) { return String(row.stage.id) === String(state.selectedStageId); }) || stageRows[0] || null;

            safeText(qs("#studentCourseCount"), String(courseRows.length));
            safeText(qs("#studentCurrentCourseName"), selectedCourse ? selectedCourse.name || "--" : "--");
            safeText(qs("#studentCurrentCourseMeta"), selectedCourse ? ("课程编号 " + (selectedCourse.courseNo || "--")) : "暂无激活课程");
            safeText(qs("#studentCurrentAssignmentName"), selectedStageRow ? selectedStageRow.assignment.title || "--" : "--");
            safeText(qs("#studentCurrentStageTitle"), selectedStageRow ? (selectedStageRow.stage.title || ("阶段 " + selectedStageRow.stage.stageNo)) : "暂无阶段");
            safeText(qs("#studentCurrentStageCount"), String(stageRows.length));
            safeText(qs("#studentLatestGradeCount"), String(gradeRows.length));
            safeText(qs("#studentUnreadFeedbackCount"), String(courseScopedRows.filter(function (row) {
                return !row.submission || (row.submission.status !== "approved" && row.submission.status !== "reviewed");
            }).length));
            safeText(qs("#studentSubmissionCount"), String(courseScopedRows.filter(function (row) { return Boolean(row.submission); }).length));

            if (courseScopeText) {
                safeText(courseScopeText, selectedCourse ? (selectedCourse.name || selectedCourse.courseNo || selectedCourse.id) : "暂无课程");
            }
            if (courseScopeMenu) {
                courseScopeMenu.innerHTML = courseRows.map(function (course) {
                    var active = String(course.id) === String(state.selectedCourseId);
                    return [
                        '<button class="student-course-option' + (active ? ' is-active' : '') + '" type="button" role="option" aria-selected="' + (active ? "true" : "false") + '" data-course-scope-id="' + escapeHtml(course.id) + '">',
                        '<span class="student-course-option-copy">',
                        '<strong>' + escapeHtml(course.name || course.courseNo || course.id) + '</strong>',
                        '<small>' + escapeHtml(String(course.academicYear || "--")) + ' 春 · ' + escapeHtml(course.courseNo || "--") + '</small>',
                        '</span>',
                        '</button>',
                    ].join("");
                }).join("") || '<div class="student-inline-empty">暂无课程</div>';
                qsa("[data-course-scope-id]", courseScopeMenu).forEach(function (button) {
                    button.addEventListener("click", function () {
                        state.selectedCourseId = button.getAttribute("data-course-scope-id") || "";
                        state.selectedAssignmentId = "";
                        state.selectedStageId = "";
                        closeCourseScopeMenu();
                        renderCoursePanel(courseRows, todoRows, gradeRows);
                    });
                });
            }

            var courseList = qs("#studentCourseList");
            if (courseList) {
                courseList.innerHTML = filteredCourseRows.map(function (course) {
                    var active = selectedCourse && String(course.id) === String(selectedCourse.id);
                    var variant = courseIconVariant(course);
                    return '<button class="student-kanban-card' + (active ? ' is-active' : '') + '" type="button" data-course-id="' + escapeHtml(course.id) + '"><div class="student-course-entry"><span class="student-course-icon is-' + escapeHtml(variant) + '">' + courseIconSvg(variant) + '</span><div class="student-course-entry-copy"><strong>' + escapeHtml(course.name || "--") + '</strong><p>' + escapeHtml(String(course.academicYear || "--")) + ' 春 · ' + escapeHtml(course.courseNo || "--") + '</p></div><span class="' + badgeClass(course.status) + '">' + escapeHtml(labelStatus(course.status)) + '</span></div></button>';
                }).join("") || '<div class="student-inline-empty">没有匹配的课程</div>';
                qsa("[data-course-id]", courseList).forEach(function (button) {
                    button.addEventListener("click", function () {
                        state.selectedCourseId = button.getAttribute("data-course-id") || "";
                        state.selectedAssignmentId = "";
                        state.selectedStageId = "";
                        renderCoursePanel(courseRows, todoRows, gradeRows);
                    });
                });
            }

            var assignmentList = qs("#studentAssignmentList");
            if (assignmentList) {
                assignmentList.innerHTML = assignmentRows.map(function (row, index) {
                    var active = String(row.id) === String(state.selectedAssignmentId);
                    var folderVariant = projectFolderVariant(index);
                    return '<button class="student-kanban-card' + (active ? ' is-active' : '') + '" type="button" data-assignment-id="' + escapeHtml(row.id) + '"><div class="student-project-entry"><span class="student-project-icon is-' + escapeHtml(folderVariant) + '">' + projectFolderSvg() + '</span><div class="student-project-entry-copy"><strong>' + escapeHtml(row.title || "--") + '</strong><p>小组 ' + escapeHtml(row.group && row.group._count ? row.group._count.members || 0 : 0) + ' 人 · 更新于 ' + escapeHtml(formatDate(row.updatedAt)) + '</p></div><span class="' + badgeClass(row.status) + '">' + escapeHtml(labelStatus(row.status)) + '</span></div></button>';
                }).join("") || '<div class="student-inline-empty">暂无项目</div>';
                qsa("[data-assignment-id]", assignmentList).forEach(function (button) {
                    button.addEventListener("click", function () {
                        state.selectedAssignmentId = button.getAttribute("data-assignment-id") || "";
                        state.selectedStageId = "";
                        renderCoursePanel(courseRows, todoRows, gradeRows);
                    });
                });
            }

            var stageList = qs("#studentStageList");
            if (stageList) {
                stageList.innerHTML = stageRows.map(function (row) {
                    var active = String(row.stage.id) === String(state.selectedStageId);
                    var stageDisplay = displayStageStatus(row);
                    var tone = stageTone(row);
                    return '<button class="student-kanban-card student-stage-card' + (active ? ' is-active' : '') + '" type="button" data-stage-id="' + escapeHtml(row.stage.id) + '"><div class="student-stage-entry"><span class="student-stage-seq is-' + escapeHtml(tone) + '">' + escapeHtml(String(row.stage.stageNo || "--")) + '</span><div class="student-stage-entry-copy"><strong>' + escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</strong><p>截止至 ' + escapeHtml(formatDateTime(row.stage.dueAt)) + '</p></div><span class="' + badgeClass(stageDisplay.key) + '">' + escapeHtml(stageDisplay.label) + '</span></div></button>';
                }).join("") || '<div class="student-inline-empty">暂无阶段</div>';
                qsa("[data-stage-id]", stageList).forEach(function (button) {
                    button.addEventListener("click", function () {
                        state.selectedStageId = button.getAttribute("data-stage-id") || "";
                        renderCoursePanel(courseRows, todoRows, gradeRows);
                    });
                });
            }

            function renderStageDetailPane(extraStage, extraGroup) {
                var detail = qs("#studentStageDetail");
                if (!detail) return;
                if (!selectedStageRow) {
                    detail.innerHTML = [
                        '<div class="student-stage-pane-empty">',
                        '<strong>没有可展示的课程阶段</strong>',
                        '<p>请检查当前课程下是否已有项目、阶段或组队信息。</p>',
                        '<button class="btn btn-secondary student-detail-action" type="button" id="studentCourseJumpTeam">查看组队</button>',
                        '</div>',
                    ].join("");
                    var jumpTeam = qs("#studentCourseJumpTeam");
                    if (jumpTeam) {
                        jumpTeam.addEventListener("click", function () {
                            switchPanel("panel-minitask-manage");
                        });
                    }
                    return;
                }

                var stageInfo = extraStage || selectedStageRow.stage || {};
                var groupInfo = extraGroup || null;
                var members = groupInfo && Array.isArray(groupInfo.members) ? groupInfo.members.slice(0, 7) : [];
                var requirements = []
                    .concat(splitLines(stageInfo.acceptCriteria))
                    .concat(splitLines(stageInfo.description))
                    .concat(splitLines(stageInfo.submissionDesc))
                    .filter(function (item, index, list) { return item && list.indexOf(item) === index; });
                var requirementPreview = requirements.slice(0, 5);
                var materials = normalizeRequirementFiles(stageInfo.requirementFiles);
                var visibleMaterials = materials.slice(0, 3);
                var activityRows = stageRows.slice().sort(function (a, b) {
                    return new Date(b.submission && (b.submission.submittedAt || b.submission.createdAt) || b.stage.dueAt || 0).getTime()
                        - new Date(a.submission && (a.submission.submittedAt || a.submission.createdAt) || a.stage.dueAt || 0).getTime();
                }).slice(0, 3);
                var submitActionLabel = selectedStageRow.submission ? "前往修改 >" : "前往提交 >";

                detail.innerHTML = [
                    '<div class="student-stage-pane">',
                    '<div class="student-stage-pane-head">',
                    '<div class="student-stage-pane-title-row"><span class="' + badgeClass(displayStageStatus(selectedStageRow).key) + '">' + escapeHtml(displayStageStatus(selectedStageRow).label) + '</span><button class="student-stage-pane-more" type="button" aria-label="更多操作"><svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="4" r="1.4"></circle><circle cx="10" cy="10" r="1.4"></circle><circle cx="10" cy="16" r="1.4"></circle></svg></button></div>',
                    '<div class="student-stage-pane-heading-row"><h3>' + escapeHtml(stageInfo.title || ("阶段 " + stageInfo.stageNo)) + '</h3><button class="student-stage-pane-submit-link" type="button" id="studentCourseJumpSubmit">' + escapeHtml(submitActionLabel) + '</button></div>',
                    '</div>',
                    '<div class="student-stage-pane-meta">',
                    '<div class="student-stage-pane-meta-row"><span class="student-stage-pane-meta-label"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6.5"></circle><path d="M10 6.5v4l2.5 1.5"></path></svg>截止时间</span><strong>' + escapeHtml(formatDateTime(stageInfo.dueAt)) + '</strong><small>' + escapeHtml(summarizeDue(stageInfo.dueAt)) + '</small></div>',
                    '<div class="student-stage-pane-meta-row"><span class="student-stage-pane-meta-label"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 8 14l8-8"></path></svg>提交状态</span><strong>' + escapeHtml(displayStageStatus(selectedStageRow).label) + '</strong><small>' + escapeHtml(selectedStageRow.submission ? ("(" + formatDateTime(selectedStageRow.submission.submittedAt || selectedStageRow.submission.createdAt) + ")") : (isPastDue(stageInfo.dueAt) ? "已截止且未提交" : "尚未提交")) + '</small></div>',
                    '<div class="student-stage-pane-meta-row"><span class="student-stage-pane-meta-label"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 16.5v-1a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v1"></path><circle cx="8.5" cy="7" r="2.5"></circle><path d="M16 16.5v-1a2.6 2.6 0 0 0-2-2.5"></path><path d="M13.5 4.8a2.4 2.4 0 0 1 0 4.7"></path></svg>小组成员</span><div class="student-stage-member-stack">' + (members.map(function (member, index) {
                        var profile = member && member.user && member.user.profile;
                        return '<span class="student-stage-member-avatar" title="' + escapeHtml(memberDisplayName(member, index)) + '">' + (profile && profile.avatarUrl ? '<img src="' + escapeHtml(profile.avatarUrl) + '" alt="' + escapeHtml(memberDisplayName(member, index)) + '" />' : '<span>' + escapeHtml(memberAvatarText(member, index)) + '</span>') + '</span>';
                    }).join("") || '<span class="student-stage-member-empty">暂无成员</span>') + '</div><small>共 ' + escapeHtml(String(groupInfo && groupInfo.members ? groupInfo.members.length : selectedStageRow.group && selectedStageRow.group._count ? selectedStageRow.group._count.members || 0 : 0)) + ' 人</small></div>',
                    '</div>',
                    '<section class="student-stage-pane-section"><h4>阶段要求</h4><div class="student-stage-requirements">' + (requirementPreview.map(function (item) {
                        return '<div class="student-stage-requirement-item"><span class="student-stage-bullet"></span><p>' + escapeHtml(item) + '</p></div>';
                    }).join("") || '<div class="student-inline-empty">当前阶段暂未配置详细要求</div>') + '</div></section>',
                    '<section class="student-stage-pane-section"><h4>阶段材料</h4><div class="student-stage-materials">' + (visibleMaterials.map(function (file) {
                        var iconType = materialTypeIcon(file.name);
                        return '<div class="student-stage-material-item"><span class="student-material-icon is-' + escapeHtml(iconType) + '">' + materialIconSvg(iconType) + '</span><div class="student-stage-material-copy"><strong>' + escapeHtml(file.name || "未命名材料") + '</strong><small>' + escapeHtml((fileExt(file.name || "").toUpperCase() || "FILE") + " · " + formatSize(file.size)) + '</small></div><button class="student-stage-material-download" type="button" data-material-download="' + escapeHtml(file.url || "") + '" aria-label="下载材料"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4v8"></path><path d="m6.5 9.5 3.5 3.5 3.5-3.5"></path><path d="M4 15.5h12"></path></svg></button></div>';
                    }).join("") || '<div class="student-inline-empty">当前阶段暂无教师材料</div>') + '</div>' + (materials.length > 3 ? '<button class="student-stage-material-more" type="button" id="studentOpenMaterialDialog">查看全部材料</button>' : '') + '</section>',
                    '<section class="student-stage-pane-section"><h4>最新协作动态</h4><div class="student-stage-activity-list">' + (activityRows.map(function (row) {
                        var text = row.submission ? "你提交了该阶段成果" : "阶段进行中，等待协作更新";
                        return '<div class="student-stage-activity-item"><span class="student-stage-activity-avatar">' + escapeHtml(String((row.group && row.group.name || "组").slice(0, 1))) + '</span><div class="student-stage-activity-copy"><strong>' + escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</strong><p>' + escapeHtml(text) + '</p></div><small>' + escapeHtml(formatDateTime(row.submission && (row.submission.submittedAt || row.submission.createdAt) || row.stage.dueAt)) + '</small></div>';
                    }).join("") || '<div class="student-inline-empty">暂无协作动态</div>') + '</div><button class="student-stage-activity-more" type="button" id="studentViewAllWorkflowActivity">查看全部动态 &gt;</button></section>',
                    '</div>',
                ].join("");

                var jumpSubmit = qs("#studentCourseJumpSubmit");
                if (jumpSubmit) {
                    jumpSubmit.addEventListener("click", function () {
                        goToSubmitPanel(selectedStageRow);
                    });
                }
                qsa("[data-material-download]", detail).forEach(function (button) {
                    button.addEventListener("click", function () {
                        downloadMaterialFiles([{ url: button.getAttribute("data-material-download") || "", name: "" }]);
                    });
                });
                var openDialog = qs("#studentOpenMaterialDialog");
                if (openDialog) {
                    openDialog.addEventListener("click", function () {
                        openMaterialDialog(materials);
                    });
                }
                var viewAllWorkflow = qs("#studentViewAllWorkflowActivity");
                if (viewAllWorkflow) {
                    viewAllWorkflow.addEventListener("click", function () {
                        goToWorkflowPanel(selectedStageRow);
                    });
                }
            }

            renderStageDetailPane(null, null);
            if (selectedStageRow) {
                Promise.all([
                    ensureStageDetail(String(selectedStageRow.stage.id)),
                    ensureGroupDetail(String(selectedStageRow.group && selectedStageRow.group.id || "")),
                ]).then(function (payloads) {
                    if (String(state.selectedStageId) !== String(selectedStageRow.stage.id)) return;
                    renderStageDetailPane(payloads[0], payloads[1]);
                });
            }
        }

        function renderGradesPanel(courseRows, todoRows, gradeRows) {
            var selectedCourseId = state.gradeCourseId || (courseRows[0] && courseRows[0].id) || "";
            var courseScopedGrades = gradeRows.filter(function (row) {
                return !selectedCourseId || String(row.course.id) === String(selectedCourseId);
            });
            var assignmentOptions = uniqueBy(courseScopedGrades.map(function (row) {
                return row.assignment;
            }), function (row) { return String(row.id); });
            if (!state.gradeAssignmentId && assignmentOptions.length) {
                state.gradeAssignmentId = String(assignmentOptions[0].id);
            }
            if (state.gradeAssignmentId && !assignmentOptions.some(function (row) { return String(row.id) === String(state.gradeAssignmentId); })) {
                state.gradeAssignmentId = "";
            }
            var filteredGrades = courseScopedGrades.filter(function (row) {
                var passAssignment = !state.gradeAssignmentId || String(row.assignment.id) === String(state.gradeAssignmentId);
                var passPublished = !gradePublishedOnly || !gradePublishedOnly.checked || row.grade.status === "published";
                return passAssignment && passPublished;
            }).sort(function (a, b) {
                return Number(a.stage.stageNo || 0) - Number(b.stage.stageNo || 0);
            });
            var latestGrade = filteredGrades[filteredGrades.length - 1] || gradeRows[0] || null;
            var selectedCourse = courseRows.find(function (course) {
                return String(course.id) === String(selectedCourseId);
            }) || courseRows[0] || null;
            var activeTodo = todoRows.filter(function (row) {
                return !selectedCourseId || String(row.course.id) === String(selectedCourseId);
            });

            if (gradeCourseSelect) {
                gradeCourseSelect.innerHTML = '<option value="">全部课程</option>' + courseRows.map(function (course) {
                    return '<option value="' + escapeHtml(course.id) + '"' + (String(course.id) === String(selectedCourseId) ? " selected" : "") + '>' + escapeHtml(course.name || "--") + '</option>';
                }).join("");
            }
            if (gradeAssignmentSelect) {
                gradeAssignmentSelect.innerHTML = '<option value="">全部项目</option>' + assignmentOptions.map(function (assignment) {
                    return '<option value="' + escapeHtml(assignment.id) + '"' + (String(assignment.id) === String(state.gradeAssignmentId) ? " selected" : "") + '>' + escapeHtml(assignment.title || "--") + '</option>';
                }).join("");
            }

            safeText(qs("#studentGradeCourseName"), selectedCourse ? selectedCourse.name || "--" : "--");
            safeText(qs("#studentGradeCourseMeta"), selectedCourse ? (String(selectedCourse.academicYear || "--") + "-" + String(selectedCourse.semester || "--")) : "暂无课程");
            safeText(qs("#studentGradeAssignmentName"), latestGrade ? latestGrade.assignment.title || "--" : "--");
            safeText(qs("#studentGradeStageMeta"), latestGrade ? (latestGrade.stage.title || ("阶段 " + latestGrade.stage.stageNo)) : "暂无阶段");
            safeText(qs("#studentLatestScore"), latestGrade && latestGrade.grade.score !== null && latestGrade.grade.score !== undefined ? String(latestGrade.grade.score) + "/100" : "--");
            safeText(qs("#studentLatestScoreStage"), latestGrade ? (latestGrade.stage.title || ("阶段 " + latestGrade.stage.stageNo)) : "尚无已发布成绩");
            safeText(qs("#studentPublishedGradeCount"), String(gradeRows.length));
            safeText(qs("#studentPendingFeedbackCount"), String(activeTodo.filter(function (row) {
                return !row.submission || (row.submission.status !== "approved" && row.submission.status !== "reviewed");
            }).length));

            var trend = qs("#studentScoreTrend");
            if (trend) {
                var average = filteredGrades.length
                    ? (filteredGrades.reduce(function (sum, row) {
                        return sum + Number(row.grade.score || 0);
                    }, 0) / filteredGrades.length).toFixed(1)
                    : "--";
                trend.innerHTML = filteredGrades.map(function (row) {
                    return '<div class="student-trend-card' + (latestGrade && String(latestGrade.stage.id) === String(row.stage.id) ? ' is-active' : '') + '"><span>阶段 ' + escapeHtml(String(row.stage.stageNo || "--")) + '</span><strong>' + escapeHtml(row.grade.score === null || row.grade.score === undefined ? "--" : String(row.grade.score)) + '</strong></div>';
                }).join("") + '<div class="student-trend-card student-trend-card-average"><span>平均分</span><strong>' + escapeHtml(String(average)) + '</strong></div>';
            }

            var feedbackList = qs("#studentFeedbackList");
            if (feedbackList) {
                feedbackList.innerHTML = filteredGrades.slice().reverse().map(function (row, index) {
                    var score = Number(row.grade.score || 0);
                    var tone = score >= 85 ? "评审完成" : "需复盘";
                    var signal = score >= 90 ? "优势保持" : (score >= 75 ? "继续优化" : "优先修正");
                    var owner = index % 2 === 0 ? "教师反馈" : "助教反馈";
                    return [
                        '<article class="student-feedback-card">',
                        '<div class="student-feedback-head">',
                        '<strong>' + escapeHtml(owner) + '</strong>',
                        '<span>' + escapeHtml(formatDateTime(row.grade.publishedAt || row.grade.updatedAt || row.grade.createdAt)) + '</span>',
                        '</div>',
                        '<div class="student-feedback-title-row">',
                        '<h4>' + escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</h4>',
                        '<span class="student-feedback-score">' + escapeHtml(row.grade.score === null || row.grade.score === undefined ? "--" : String(row.grade.score)) + '</span>',
                        '</div>',
                        '<p>当前聚合接口尚未返回完整评语详情。建议结合该阶段提交内容、课堂批注和组内复盘，优先检查交付完整性、说明清晰度与实现质量。</p>',
                        '<div class="student-feedback-tags">',
                        '<span class="' + badgeClass(row.grade.status) + '">' + escapeHtml(tone) + '</span>',
                        '<span class="tag tag--quiet">' + escapeHtml(row.assignment.title || "--") + '</span>',
                        '<span class="student-feedback-signal is-' + escapeHtml(score >= 90 ? "teal" : (score >= 75 ? "amber" : "rose")) + '">' + escapeHtml(signal) + '</span>',
                        '</div>',
                        '</article>',
                    ].join("");
                }).join("") || '<div class="student-inline-empty">暂无反馈内容</div>';
            }

            var timeline = qs("#studentGradeTimeline");
            if (timeline) {
                timeline.innerHTML = filteredGrades.map(function (row) {
                    var score = row.grade.score === null || row.grade.score === undefined ? "--" : String(row.grade.score);
                    var active = latestGrade && String(latestGrade.stage.id) === String(row.stage.id);
                    return [
                        '<button class="student-grade-step' + (active ? ' is-active' : '') + '" type="button" data-grade-stage-id="' + escapeHtml(row.stage.id) + '">',
                        '<span class="student-grade-step-index">' + escapeHtml(String(row.stage.stageNo || "--")) + '</span>',
                        '<div class="student-grade-step-copy">',
                        '<strong>' + escapeHtml(row.stage.title || ("阶段 " + row.stage.stageNo)) + '</strong>',
                        '<p>' + escapeHtml(formatDate(row.grade.publishedAt || row.grade.updatedAt || row.grade.createdAt)) + '</p>',
                        '</div>',
                        '<div class="student-grade-step-meta">',
                        '<span class="' + badgeClass(row.grade.status) + '">' + escapeHtml(labelStatus(row.grade.status)) + '</span>',
                        '<span class="student-grade-step-score">' + escapeHtml(score) + '</span>',
                        '</div>',
                        '</button>',
                    ].join("");
                }).join("") || '<div class="student-inline-empty">暂无成绩阶段</div>';
            }

            var gradeList = qs("#studentGradeList");
            var gradeEmpty = qs("#studentGradeEmpty");
            if (gradeList) {
                gradeList.innerHTML = filteredGrades.map(function (row) {
                    var score = row.grade.score === null || row.grade.score === undefined ? "--" : String(row.grade.score);
                    var stageLabel = row.stage.title || ("阶段 " + row.stage.stageNo);
                    return [
                        '<article class="student-grade-record">',
                        '<div class="student-grade-record-head">',
                        '<div class="student-grade-record-main">',
                        '<strong>' + escapeHtml(stageLabel) + '</strong>',
                        '<p>' + escapeHtml(row.assignment.title || "--") + '</p>',
                        '</div>',
                        '<div class="student-grade-record-meta">',
                        '<span class="student-grade-record-time">' + escapeHtml(formatDateTime(row.grade.publishedAt || row.grade.updatedAt || row.grade.createdAt)) + '</span>',
                        '<span class="' + badgeClass(row.grade.status) + '">' + escapeHtml(labelStatus(row.grade.status)) + '</span>',
                        '</div>',
                        '</div>',
                        '<div class="student-grade-record-body">',
                        '<div class="student-grade-record-summary">' + escapeHtml(row.stage.submissionDesc || "本阶段已完成成绩发布，可结合提交记录和课堂反馈继续复盘。") + '</div>',
                        '<div class="student-grade-record-side">',
                        '<div class="student-grade-record-score">' + escapeHtml(score) + '<small>/100</small></div>',
                        '<div class="student-grade-record-chips"><span>阶段 ' + escapeHtml(String(row.stage.stageNo || "--")) + '</span><span>' + escapeHtml(score === "--" ? "待同步" : (Number(score) >= 85 ? "表现稳定" : "继续改进")) + '</span></div>',
                        '</div>',
                        '</div>',
                        '</article>',
                    ].join("");
                }).join("");
            }
            if (gradeEmpty) {
                gradeEmpty.hidden = filteredGrades.length > 0;
            }

            qsa("[data-grade-stage-id]", timeline).forEach(function (button) {
                button.addEventListener("click", function () {
                    var targetId = button.getAttribute("data-grade-stage-id") || "";
                    var target = filteredGrades.find(function (row) {
                        return String(row.stage.id) === String(targetId);
                    }) || null;
                    if (!target || !gradeList) return;
                    var record = qsa(".student-grade-record", gradeList)[filteredGrades.findIndex(function (row) {
                        return String(row.stage.id) === String(targetId);
                    })];
                    if (record && typeof record.scrollIntoView === "function") {
                        record.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                });
            });
        }

        function renderSubmitPanel(courseRows, todoRows) {
            var submitCourseSelect = document.getElementById("extSubmitCourse");
            var submitAssignmentSelect = document.getElementById("extSubmitAssignment");
            var submitStageSelect = document.getElementById("extSubmitStage");
            var courseId = submitCourseSelect && submitCourseSelect.value || state.selectedCourseId || (courseRows[0] && String(courseRows[0].id)) || "";
            var courseScopedRows = todoRows.filter(function (row) {
                return !courseId || String(row.course.id) === String(courseId);
            });
            var assignmentId = submitAssignmentSelect && submitAssignmentSelect.value || (courseScopedRows[0] && String(courseScopedRows[0].assignment.id)) || "";
            var assignmentScopedRows = courseScopedRows.filter(function (row) {
                return !assignmentId || String(row.assignment.id) === String(assignmentId);
            }).sort(function (a, b) {
                return Number(a.stage.stageNo || 0) - Number(b.stage.stageNo || 0);
            });
            var stageId = submitStageSelect && submitStageSelect.value || (assignmentScopedRows[0] && String(assignmentScopedRows[0].stage.id)) || "";
            var selectedStageRow = assignmentScopedRows.find(function (row) {
                return String(row.stage.id) === String(stageId);
            }) || assignmentScopedRows[0] || null;
            var selectedCourse = courseRows.find(function (row) {
                return String(row.id) === String(courseId);
            }) || (courseRows[0] || null);
            var selectedAssignment = selectedStageRow ? selectedStageRow.assignment : (assignmentScopedRows[0] ? assignmentScopedRows[0].assignment : null);
            var stageInfo = selectedStageRow ? selectedStageRow.stage : null;
            var stageStatus = selectedStageRow ? displayStageStatus(selectedStageRow) : { key: "not_submitted", label: "待提交" };
            var requirementList = qs("#studentSubmitRequirementList");
            var materialList = qs("#studentSubmitMaterialList");
            var historyList = qs("#studentSubmitHistoryList");
            var requirementLines = stageInfo ? []
                .concat(splitLines(stageInfo.acceptCriteria))
                .concat(splitLines(stageInfo.description))
                .filter(function (item, index, list) { return item && list.indexOf(item) === index; })
                : [];
            var materials = stageInfo ? normalizeRequirementFiles(stageInfo.requirementFiles) : [];
            var submissionHistory = assignmentScopedRows.filter(function (row) {
                return Boolean(row.submission);
            }).slice().sort(function (a, b) {
                return new Date(b.submission.submittedAt || b.submission.createdAt || 0).getTime()
                    - new Date(a.submission.submittedAt || a.submission.createdAt || 0).getTime();
            });

            safeText(qs("#studentSubmitCourseName"), selectedCourse ? (selectedCourse.name || "--") : "--");
            safeText(qs("#studentSubmitCourseMeta"), selectedCourse ? (selectedCourse.courseNo || "暂无课程") : "暂无课程");
            safeText(qs("#studentSubmitAssignmentName"), selectedAssignment ? (selectedAssignment.title || "--") : "--");
            safeText(qs("#studentSubmitAssignmentMeta"), selectedStageRow ? ("当前共 " + assignmentScopedRows.length + " 个阶段") : "请选择项目");
            safeText(qs("#studentSubmitStageName"), stageInfo ? (stageInfo.title || ("阶段 " + stageInfo.stageNo)) : "--");
            safeText(qs("#studentSubmitStageMeta"), stageInfo ? ("阶段 " + String(stageInfo.stageNo || "--")) : "请选择阶段");
            safeText(qs("#studentSubmitDueAt"), stageInfo ? formatDateTime(stageInfo.dueAt) : "--");
            safeText(qs("#studentSubmitDueMeta"), stageInfo ? summarizeDue(stageInfo.dueAt) : "暂无截止信息");
            safeText(qs("#studentSubmitStatus"), stageStatus.label);
            safeText(qs("#studentSubmitStatusMeta"), selectedStageRow && selectedStageRow.submission ? ("最近提交于 " + formatDateTime(selectedStageRow.submission.submittedAt || selectedStageRow.submission.createdAt)) : (stageInfo ? "等待本阶段提交" : "暂无阶段"));

            if (requirementList) {
                requirementList.innerHTML = requirementLines.map(function (item) {
                    return '<div class="student-requirement-item"><span class="student-submit-bullet"></span><p>' + escapeHtml(item) + '</p></div>';
                }).join("") || '<div class="student-inline-empty">展开阶段后可查看要求</div>';
            }

            if (materialList) {
                materialList.innerHTML = materials.map(function (file) {
                    var icon = materialTypeIcon(file.name);
                    return '<a class="student-material-item" href="' + escapeHtml(file.url || "#") + '" target="_blank" rel="noreferrer"><span class="student-submit-file-icon is-' + escapeHtml(icon) + '">' + materialIconSvg(icon) + '</span><div class="student-submit-file-copy"><strong>' + escapeHtml(file.name || "未命名材料") + '</strong><span>' + escapeHtml(formatSize(file.size)) + '</span></div></a>';
                }).join("") || '<div class="student-inline-empty">当前阶段暂无教师材料</div>';
            }

            if (historyList) {
                historyList.innerHTML = submissionHistory.map(function (row) {
                    var submission = row.submission || {};
                    var files = Array.isArray(submission.files) ? submission.files : [];
                    return [
                        '<article class="student-submit-history-item">',
                        '<div class="student-submit-history-copy">',
                        '<strong>' + escapeHtml(submission.title || row.stage.title || "未命名提交") + '</strong>',
                        '<p>阶段 ' + escapeHtml(String(row.stage.stageNo || "--")) + ' · ' + escapeHtml(row.stage.title || "--") + '</p>',
                        '</div>',
                        '<div class="student-submit-history-meta">',
                        '<span class="' + badgeClass(submission.status) + '">' + escapeHtml(labelStatus(submission.status)) + '</span>',
                        '<small>' + escapeHtml(formatDateTime(submission.submittedAt || submission.createdAt)) + (files.length ? ' · ' + escapeHtml(String(files.length)) + ' 个文件' : "") + '</small>',
                        '</div>',
                        '</article>',
                    ].join("");
                }).join("") || '<div class="student-inline-empty">当前项目暂无提交记录</div>';
            }
        }

        function rerenderStudentDashboardPanels() {
            if (!state.dashboard) return;
            var activeTodoRows = (state.dashboard.todoRows || []).filter(function (row) {
                var status = displayStageStatus(row).key;
                return status !== "approved" && status !== "reviewed";
            });
            renderTodoPopover(activeTodoRows);
            renderCoursePanel(state.dashboard.courses || [], state.dashboard.todoRows || [], state.dashboard.gradeRows || []);
            renderSubmitPanel(state.dashboard.courses || [], state.dashboard.todoRows || []);
            renderGradesPanel(state.dashboard.courses || [], state.dashboard.todoRows || [], state.dashboard.gradeRows || []);
        }

        function wireInteractions() {
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
            if (materialDialogClose) {
                materialDialogClose.addEventListener("click", closeMaterialDialog);
            }
            if (noticeDialogClose) {
                noticeDialogClose.addEventListener("click", closeNoticeDialog);
            }
            if (noticeDialogConfirm) {
                noticeDialogConfirm.addEventListener("click", closeNoticeDialog);
            }
            document.addEventListener("click", function (event) {
                var widget = document.getElementById("studentTodoWidget");
                if (widget && !widget.contains(event.target)) {
                    toggleTodoPopover(false);
                }
                if (courseScopePicker && !courseScopePicker.contains(event.target)) {
                    closeCourseScopeMenu();
                }
                if (materialDialogBackdrop && event.target === materialDialogBackdrop) {
                    closeMaterialDialog();
                }
                if (noticeDialogBackdrop && event.target === noticeDialogBackdrop) {
                    closeNoticeDialog();
                }
            });
            if (courseSearch) {
                courseSearch.addEventListener("input", function () {
                    if (!courseSearch.value.trim()) {
                        state.courseSearch = "";
                        if (state.dashboard) {
                            renderCoursePanel(state.dashboard.courses, state.dashboard.todoRows, state.dashboard.gradeRows);
                        }
                    }
                });
            }
            if (courseSearchForm) {
                courseSearchForm.addEventListener("submit", function (event) {
                    event.preventDefault();
                    state.courseSearch = courseSearch ? courseSearch.value : "";
                    if (state.dashboard) {
                        renderCoursePanel(state.dashboard.courses, state.dashboard.todoRows, state.dashboard.gradeRows);
                    }
                });
            }
            if (courseScopeButton) {
                courseScopeButton.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleCourseScopeMenu();
                });
            }
            if (gradeCourseSelect) {
                gradeCourseSelect.addEventListener("change", function () {
                    state.gradeCourseId = gradeCourseSelect.value;
                    state.gradeAssignmentId = "";
                    if (state.dashboard) {
                        renderGradesPanel(state.dashboard.courses, state.dashboard.todoRows, state.dashboard.gradeRows);
                    }
                });
            }
            if (gradeAssignmentSelect) {
                gradeAssignmentSelect.addEventListener("change", function () {
                    state.gradeAssignmentId = gradeAssignmentSelect.value;
                    if (state.dashboard) {
                        renderGradesPanel(state.dashboard.courses, state.dashboard.todoRows, state.dashboard.gradeRows);
                    }
                });
            }
            if (gradePublishedOnly) {
                gradePublishedOnly.addEventListener("change", function () {
                    if (state.dashboard) {
                        renderGradesPanel(state.dashboard.courses, state.dashboard.todoRows, state.dashboard.gradeRows);
                    }
                });
            }
            ["extSubmitCourse", "extSubmitAssignment", "extSubmitStage"].forEach(function (id) {
                var select = document.getElementById(id);
                if (!select) return;
                select.addEventListener("change", function () {
                    if (state.dashboard) {
                        window.setTimeout(function () {
                            renderSubmitPanel(state.dashboard.courses, state.dashboard.todoRows);
                        }, 40);
                    }
                });
            });
            teamTabs.forEach(function (button) {
                button.addEventListener("click", function () {
                    toggleTeamView(button.getAttribute("data-team-view") || "join");
                });
            });
            qsa("[data-team-switch]").forEach(function (button) {
                button.addEventListener("click", function () {
                    toggleTeamView(button.getAttribute("data-team-switch") || "join");
                });
            });
            if (submitFiles) {
                submitFiles.addEventListener("change", renderSubmitFileQueue);
            }
            if (submitDraftBtn) {
                submitDraftBtn.addEventListener("click", function () {
                    var draft = {
                        title: qs("#extSubmitTitle") && qs("#extSubmitTitle").value || "",
                        repo: qs("#extSubmitRepo") && qs("#extSubmitRepo").value || "",
                        links: qs("#extSubmitLinks") && qs("#extSubmitLinks").value || "",
                        desc: qs("#extSubmitDesc") && qs("#extSubmitDesc").value || "",
                        contribution: qs("#extSubmitContribution") && qs("#extSubmitContribution").value || "",
                    };
                    localStorage.setItem("linksee_student_submit_draft", JSON.stringify(draft));
                    var result = qs("#extSubmitResult");
                    if (result) {
                        result.hidden = false;
                        result.classList.remove("is-error");
                        result.innerHTML = "<strong>草稿已保存</strong><p>已暂存当前填写内容，仅保存在当前浏览器。</p>";
                    }
                });
            }
            function openChat() {
                var launcher = qs("[data-chat-launcher]");
                if (launcher) launcher.click();
            }
            if (openDiscussBtn) openDiscussBtn.addEventListener("click", openChat);
            if (openChatBtn) openChatBtn.addEventListener("click", openChat);
            if (viewAllCoursesBtn) {
                viewAllCoursesBtn.addEventListener("click", function () {
                    switchPanel("panel-courses");
                });
            }
            if (generateInviteBtn) {
                generateInviteBtn.addEventListener("click", function () {
                    var groupId = qs("#extTaskGroupId") && qs("#extTaskGroupId").value || "";
                    state.inviteCode = groupId ? "LKS6-" + String(groupId).slice(-4).toUpperCase() : "LKS6-DEMO";
                    safeText(qs("#studentInviteCode"), state.inviteCode);
                });
            }
            if (copyInviteBtn) {
                copyInviteBtn.addEventListener("click", async function () {
                    var code = state.inviteCode || (qs("#studentInviteCode") && qs("#studentInviteCode").textContent) || "";
                    if (!code || code === "--") return;
                    try {
                        await navigator.clipboard.writeText(code);
                        copyInviteBtn.textContent = "已复制";
                        window.setTimeout(function () {
                            copyInviteBtn.textContent = "复制";
                        }, 1200);
                    } catch (_err) {
                        copyInviteBtn.textContent = "复制失败";
                    }
                });
            }
            if (materialDialogToggleAll) {
                materialDialogToggleAll.addEventListener("click", function () {
                    var files = state.materialDialogFiles || [];
                    if (state.selectedMaterialKeys.length === files.length) {
                        state.selectedMaterialKeys = [];
                    } else {
                        state.selectedMaterialKeys = files.map(function (file, index) {
                            return String(file.url || file.name || index);
                        });
                    }
                    renderMaterialDialog();
                });
            }
            if (materialDialogDownload) {
                materialDialogDownload.addEventListener("click", function () {
                    var files = (state.materialDialogFiles || []).filter(function (file, index) {
                        var key = String(file.url || file.name || index);
                        return state.selectedMaterialKeys.indexOf(key) >= 0;
                    });
                    downloadMaterialFiles(files);
                });
            }
            document.addEventListener("keydown", function (event) {
                if (event.key === "Escape") {
                    closeCourseScopeMenu();
                    closeMaterialDialog();
                    closeNoticeDialog();
                }
            });
        }

        wireInteractions();
        renderSubmitFileQueue();
        window.setInterval(function () {
            rerenderStudentDashboardPanels();
        }, 60 * 1000);

        try {
            var payload = await window.linkseeApi.getJson("/api/v1/students/dashboard");
            var courseRows = rowsOf(payload, "courses");
            var todoRows = rowsOf(payload, "todoRows").sort(function (a, b) {
                return new Date(a.stage.dueAt || 0).getTime() - new Date(b.stage.dueAt || 0).getTime();
            });
            var gradeRows = rowsOf(payload, "gradeRows").sort(function (a, b) {
                return new Date(a.grade.publishedAt || a.grade.updatedAt || a.grade.createdAt || 0).getTime() - new Date(b.grade.publishedAt || b.grade.updatedAt || b.grade.createdAt || 0).getTime();
            });
            if (allowExplicitMock("studentDashboardMock") && !courseRows.length && !todoRows.length && !gradeRows.length) {
                var mock = createMockStudentDashboard();
                courseRows = mock.courses;
                todoRows = mock.todoRows;
                gradeRows = mock.gradeRows;
                state.stageDetailMap = mock.stageDetailMap;
                state.groupDetailMap = mock.groupDetailMap;
            }
            state.dashboard = {
                courses: courseRows,
                todoRows: todoRows,
                gradeRows: gradeRows,
            };
            window.linkseeStudentDashboardState = state.dashboard;
            syncCurrentSelections(courseRows, todoRows);
            rerenderStudentDashboardPanels();
            window.dispatchEvent(new CustomEvent("linksee:student-dashboard-ready", {
                detail: state.dashboard,
            }));
        } catch (err) {
            if (allowExplicitMock("studentDashboardMock")) {
                var mockFallback = createMockStudentDashboard();
                state.stageDetailMap = mockFallback.stageDetailMap;
                state.groupDetailMap = mockFallback.groupDetailMap;
                state.dashboard = {
                    courses: mockFallback.courses,
                    todoRows: mockFallback.todoRows,
                    gradeRows: mockFallback.gradeRows,
                };
                window.linkseeStudentDashboardState = state.dashboard;
                syncCurrentSelections(mockFallback.courses, mockFallback.todoRows);
                rerenderStudentDashboardPanels();
                window.dispatchEvent(new CustomEvent("linksee:student-dashboard-ready", {
                    detail: state.dashboard,
                }));
                return;
            }
            state.stageDetailMap = {};
            state.groupDetailMap = {};
            state.dashboard = {
                courses: [],
                todoRows: [],
                gradeRows: [],
            };
            window.linkseeStudentDashboardState = state.dashboard;
            syncCurrentSelections([], []);
            rerenderStudentDashboardPanels();
            window.dispatchEvent(new CustomEvent("linksee:student-dashboard-ready", {
                detail: state.dashboard,
            }));
        }
    }

    window.initStudentDashboard = initStudentDashboard;
})();
