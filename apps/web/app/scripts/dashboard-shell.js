(function () {
    function getAppBase() {
        var appOrigin = window.location.origin && window.location.origin !== "null"
            ? window.location.origin
            : "http://localhost:3001";
        var appBasePath = window.location.pathname.includes("/app/") ? "/app" : "";

        return {
            appOrigin: appOrigin,
            appBasePath: appBasePath,
        };
    }

    var NAV_ORDER = {
        academic: [
            "panel-courses",
            "panel-course-staff",
            "panel-user-maintenance",
            "panel-assignments",
        ],
        teacher: [
            "panel-assignment-manage",
            "panel-stage-manage",
            "panel-group-manage",
            "panel-assistant-manage",
            "panel-review-workbench",
        ],
        assistant: [
            "panel-review",
            "panel-history",
            "panel-courses",
        ],
        student: [
            "panel-courses",
            "panel-minitask-manage",
            "panel-file-submit",
            "panel-grades",
        ],
    };

    function getDashboardRole() {
        if (document.body.classList.contains("teacher-shell")) return "teacher";
        if (document.body.classList.contains("assistant-shell")) return "assistant";
        if (document.body.classList.contains("student-shell")) return "student";
        if (document.body.classList.contains("academic-shell")) return "academic";
        return "";
    }

    function sortDashboardNav() {
        var nav = document.querySelector(".side-nav");
        if (!nav) return;

        var role = getDashboardRole();
        var order = NAV_ORDER[role] || [];
        var orderMap = {};
        order.forEach(function (targetId, index) {
            orderMap[targetId] = index;
        });

        var collator = window.Intl && Intl.Collator
            ? new Intl.Collator("zh-Hans-CN", { numeric: true })
            : null;
        var buttons = Array.from(nav.querySelectorAll(".nav-item[data-target]"));

        buttons.sort(function (a, b) {
            var targetA = a.getAttribute("data-target") || "";
            var targetB = b.getAttribute("data-target") || "";
            var rankA = Object.prototype.hasOwnProperty.call(orderMap, targetA) ? orderMap[targetA] : Number.MAX_SAFE_INTEGER;
            var rankB = Object.prototype.hasOwnProperty.call(orderMap, targetB) ? orderMap[targetB] : Number.MAX_SAFE_INTEGER;
            if (rankA !== rankB) return rankA - rankB;
            var labelA = a.textContent.trim();
            var labelB = b.textContent.trim();
            return collator ? collator.compare(labelA, labelB) : labelA.localeCompare(labelB);
        });

        buttons.forEach(function (button) {
            nav.appendChild(button);
        });
    }

    function initDashboardNav() {
        var navItems = document.querySelectorAll(".side-nav .nav-item");
        if (!navItems.length) {
            return;
        }

        navItems.forEach(function (btn) {
            btn.addEventListener("click", function () {
                var targetId = btn.getAttribute("data-target");

                navItems.forEach(function (el) {
                    el.classList.remove("is-active");
                });
                document.querySelectorAll(".page-panel").forEach(function (panel) {
                    panel.classList.remove("is-active");
                });

                btn.classList.add("is-active");
                var targetPanel = document.getElementById(targetId);
                if (targetPanel) {
                    targetPanel.classList.add("is-active");
                }
                scheduleAdaptivePanelSync();
            });
        });
    }

    function removeDashboardDescriptions() {
        document.querySelectorAll([
            ".dashboard-section-intro > p",
        ].join(",")).forEach(function (node) {
            node.remove();
        });
    }

    var subcardNotes = {
        "创建账号": "为学生或教师开通单个账号，并补充对应角色资料。",
        "更新账号": "按用户 ID 修改姓名、邮箱、位置与个人说明。",
        "单个重置": "针对一个用户重置密码，可留空生成临时密码。",
        "批量重置": "批量处理多个账号，适合导入后统一初始化密码。",
        "选择课程": "切换当前操作对象，下面的状态、人员或记录会随课程刷新。",
        "当前状态": "展示当前课程的基础状态，方便编辑前确认对象。",
        "编辑表单": "修改课程名称、简介和启用状态，保存后同步课程列表。",
        "新增教师绑定": "输入教师用户 ID 并指定角色，将教师加入当前课程。",
        "当前教师": "查看当前课程已绑定的主讲或协同教师。",
        "当前助教": "查看当前课程已绑定的助教账号和配置情况。",
        "默认密码": "设置批量开户使用的默认密码，留空则自动生成临时密码。",
        "批量创建学生": "按行粘贴学生账号数据，一次创建多个学生账号。",
        "批量创建教师": "按行粘贴教师账号数据，一次创建多个教师账号。",
        "项目列表": "先选择课程，查看并切换当前课程下的项目。",
        "创建/编辑项目": "维护项目标题、状态、说明，并上传项目说明附件。",
        "阶段列表": "按课程和项目筛选阶段，选中后可在右侧编辑。",
        "阶段设置": "配置阶段时间、权重、状态和提交材料。",
        "小组列表": "按课程项目查看小组与成员数量，便于定位调整对象。",
        "小组操作": "手动建组、添加成员或移出成员，用于兜底调整。",
        "创建助教": "创建当前教师名下的助教账号，可设置初始密码。",
        "课程绑定": "选择课程并绑定或解绑助教，右侧列表会显示当前绑定情况。",
        "提交概览": "显示当前选中提交的摘要和附件入口，便于批改前核对。",
        "批改输入": "录入分数和反馈意见，可先保存草稿再确认通过。",
        "当前待批改上下文": "展示左侧队列中选中提交的课程、小组和附件信息。",
        "工作概览": "快速查看负责课程数量和当前待检查提交数量。",
        "当前课程": "切换正在处理的课程，队列和记录会随课程同步刷新。",
        "待处理队列": "选择待检查提交，右侧会显示当前提交并进入复核流程。",
        "当前提交": "展示当前选中提交的上下文，也可手动核对 Submission ID。",
        "复核意见": "填写检查结论和反馈意见，提交后会更新评审状态。",
        "成绩草稿": "为通过复核的提交保存分数草稿，最终发布仍由教师完成。",
        "导出": "按课程导出复核记录或成绩数据，便于线下归档。",
        "最近成绩记录": "查看近期保存或发布的成绩记录，确认处理进度。",
        "课程列表": "切换课程范围，查看已加入课程和当前课程信息。",
        "项目阶段": "查看所选课程下需要关注的项目阶段、截止时间和提交状态。",
        "提交记录": "汇总已经提交过的阶段成果，便于回看状态和提交时间。",
        "组队申请": "创建小组、申请入组，并处理组长视角下的入组申请。",
        "组队信息": "选择课程项目后查看可加入的小组和自己的当前小组。",
        "组队操作": "创建小组、申请入组，也可处理申请或发起组长转让。",
        "任务列表": "查看当前小组信息和 MiniTask 列表，刷新后同步最新状态。",
        "任务编辑": "创建任务、分配负责人，并更新优先级、说明和状态。",
        "提交范围": "先确定课程、项目、阶段和所属小组。",
        "成果内容": "填写链接、说明、贡献记录并上传成果文件。"
    };

    var inferredSubcards = [
        { selector: "#selectedReviewAttachment", title: "提交概览" },
        { selector: "#extStageCourse", title: "阶段列表" },
        { selector: "#extStageTitle", title: "阶段设置" },
        { selector: "#extGroupCourse", title: "小组列表" },
        { selector: "#extStudentGroupCourse", title: "组队信息" },
        { selector: "#extTaskCourse", title: "任务列表" },
        { selector: "#extTaskId", title: "任务编辑" },
        { selector: "#extSubmitCourse", title: "提交范围" },
        { selector: "#extSubmitTitle", title: "成果内容" }
    ];

    function insertSubcardNote(titleEl, noteText) {
        if (!titleEl || !noteText) return;
        var subcard = titleEl.closest(".dashboard-subcard, .dashboard-merged-section");
        if (subcard && subcard.querySelector(".dashboard-subcard-note")) return;
        var note = document.createElement("p");
        note.className = "dashboard-subcard-note";
        note.textContent = noteText;
        var row = titleEl.closest(".dashboard-split-row");
        if (row && row.parentElement) {
            row.insertAdjacentElement("afterend", note);
            return;
        }
        titleEl.insertAdjacentElement("afterend", note);
    }

    function ensureDashboardSubcardNotes() {
        inferredSubcards.forEach(function (item) {
            var marker = document.querySelector(item.selector);
            var subcard = marker ? marker.closest(".dashboard-subcard") : null;
            if (!subcard || subcard.querySelector(".dashboard-subcard-title")) return;
            subcard.insertAdjacentHTML("afterbegin", '<h3 class="dashboard-subcard-title">' + item.title + '</h3>');
        });

        document.querySelectorAll(".dashboard-subcard-title").forEach(function (titleEl) {
            var title = (titleEl.textContent || "").trim();
            insertSubcardNote(titleEl, subcardNotes[title]);
        });
    }

    function parsePixels(value) {
        var parsed = parseFloat(value);
        return isFinite(parsed) ? parsed : 0;
    }

    function syncAdaptivePanels() {
        var container = document.querySelector(".content-container");
        if (!container || !document.body.classList.contains("app-shell")) {
            return;
        }

        var style = window.getComputedStyle(container);
        var verticalPadding = parsePixels(style.paddingTop) + parsePixels(style.paddingBottom);
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        var minimumHeight = document.body.classList.contains("academic-shell") ? 1016 : 872;
        var availableHeight = Math.max(0, viewportHeight - verticalPadding);
        var panelHeight = Math.max(minimumHeight, availableHeight);

        document.documentElement.style.setProperty("--dashboard-panel-min-height", minimumHeight + "px");
        document.documentElement.style.setProperty("--dashboard-panel-height", panelHeight + "px");
    }

    function scheduleAdaptivePanelSync() {
        window.requestAnimationFrame(syncAdaptivePanels);
    }

    function initAdaptivePanels() {
        syncAdaptivePanels();
        window.addEventListener("resize", scheduleAdaptivePanelSync);
        window.addEventListener("orientationchange", scheduleAdaptivePanelSync);

        var container = document.querySelector(".content-container");
        if (container && window.ResizeObserver) {
            var observer = new ResizeObserver(scheduleAdaptivePanelSync);
            observer.observe(container);
            window.__linkseeAdaptivePanelObserver = observer;
        }
    }

    function initAvatarControls(avatarStorageKey) {
        var avatarWrapper = document.getElementById("avatarWrapper");
        var avatarInput = document.getElementById("avatarInput");
        var avatarImage = document.getElementById("avatarImage");

        if (!avatarWrapper || !avatarInput || !avatarImage) {
            return;
        }

        var defaultAvatar = avatarImage.src;
        var savedAvatar = localStorage.getItem(avatarStorageKey);

        if (savedAvatar) {
            avatarImage.src = savedAvatar;
        }

        avatarWrapper.addEventListener("click", function () {
            avatarInput.click();
        });

        avatarInput.addEventListener("change", function (event) {
            var file = event.target.files && event.target.files[0];

            if (!file) {
                avatarImage.src = savedAvatar || defaultAvatar;
                return;
            }

            var reader = new FileReader();
            reader.onload = function (loadEvent) {
                var nextAvatar = loadEvent.target && loadEvent.target.result;
                if (typeof nextAvatar === "string") {
                    avatarImage.src = nextAvatar;
                    if (!window.linkseeApi) {
                        savedAvatar = nextAvatar;
                        localStorage.setItem(avatarStorageKey, nextAvatar);
                    }
                }
            };
            reader.readAsDataURL(file);

            if (!window.linkseeApi) {
                return;
            }

            var formData = new FormData();
            formData.append("avatar", file);
            window.linkseeApi.postForm("/api/v1/users/me/avatar", formData)
                .then(function (payload) {
                    var avatarUrl = payload && payload.data ? payload.data.avatarUrl : "";
                    if (avatarUrl) {
                        avatarImage.src = avatarUrl;
                        savedAvatar = avatarUrl;
                        localStorage.setItem(avatarStorageKey, avatarUrl);
                    }
                })
                .catch(function () {
                    avatarImage.src = savedAvatar || defaultAvatar;
                });
        });
    }

    function updateProfileDisplay(realName, bio, userId) {
        var userBadge = document.getElementById("userBadge");
        var userProfile = document.querySelector(".user-profile");
        var resolvedName = realName || userId || "--";
        var descriptionId = "userProfileDescription";
        var descriptionEl = document.getElementById(descriptionId);

        if (userBadge) {
            userBadge.textContent = resolvedName;
        }

        if (userProfile && !descriptionEl) {
            descriptionEl = document.createElement("div");
            descriptionEl.id = descriptionId;
            descriptionEl.className = "dashboard-soft-note user-profile-description";
            userProfile.appendChild(descriptionEl);
        }

        if (descriptionEl) {
            descriptionEl.textContent = bio || "";
            descriptionEl.hidden = !bio;
        }
    }

    function initSessionMeta() {
        var metaInfo = document.getElementById("metaInfo");
        var userId = localStorage.getItem("auth_user_id");
        var token = localStorage.getItem("auth_access_token");
        var realName = localStorage.getItem("auth_real_name");
        var bio = localStorage.getItem("auth_bio");

        if (metaInfo) {
            metaInfo.textContent = userId && token
                ? "当前登录账号：" + userId
                : "未检测到登录信息，请返回登录页。";
        }

        updateProfileDisplay(userId && token ? realName : "", userId && token ? bio : "", userId && token ? userId : "");
    }

    function syncSessionWithServer() {
        if (!window.linkseeApi) {
            return;
        }

        var metaInfo = document.getElementById("metaInfo");
        window.linkseeApi.getJson("/api/v1/users/me")
            .then(function (payload) {
                var data = payload && payload.data ? payload.data : {};
                var userId = data.userId || data.id || localStorage.getItem("auth_user_id");
                var role = data.role || data.userRole || "";
                var realName = data.profile && data.profile.realName ? data.profile.realName : "";
                var bio = data.profile && typeof data.profile.bio === "string" ? data.profile.bio : "";

                if (userId) {
                    localStorage.setItem("auth_user_id", userId);
                }
                if (role) {
                    localStorage.setItem("auth_role", role);
                }
                localStorage.setItem("auth_force_change_password", data.forceChangePassword ? "true" : "false");
                if (realName) {
                    localStorage.setItem("auth_real_name", realName);
                }
                localStorage.setItem("auth_bio", bio || "");
                if (metaInfo && realName) {
                    metaInfo.textContent = "当前登录账号：" + userId + " · " + realName;
                } else if (metaInfo && userId) {
                    metaInfo.textContent = "当前登录账号：" + userId;
                }
                updateProfileDisplay(realName, bio, userId);
                if (data.forceChangePassword && window.linkseeUserSettings) {
                    window.linkseeUserSettings.open();
                }
            })
            .catch(function () {
                // Keep existing local session display if the profile endpoint is unavailable.
            });
    }

    function initLogout(avatarStorageKey) {
        var logoutBtn = document.getElementById("logoutBtn");
        var settingsBtn = document.getElementById("userSettingsBtn");
        if (!logoutBtn) {
            return;
        }

        var appBase = getAppBase();
        logoutBtn.addEventListener("click", function () {
            localStorage.removeItem("auth_access_token");
            localStorage.removeItem("auth_refresh_token");
            localStorage.removeItem("auth_user_id");
            localStorage.removeItem("auth_role");
            localStorage.removeItem("auth_real_name");
            localStorage.removeItem("auth_bio");
            localStorage.removeItem("auth_force_change_password");
            localStorage.removeItem("auth_origin");
            localStorage.removeItem(avatarStorageKey);
        window.location.href = appBase.appOrigin + appBase.appBasePath + "/login.html";
        });

        if (settingsBtn) {
            settingsBtn.addEventListener("click", function () {
                if (window.linkseeUserSettings) {
                    window.linkseeUserSettings.open();
                }
            });
        }
    }

    function initChatLauncher() {
        if (!window.linkseeChatWidget) {
            var existing = document.querySelector('script[data-linksee-chat-widget-src]');
            if (!existing) {
                var script = document.createElement("script");
                script.src = "./scripts/chat-widget.js";
                script.async = true;
                script.setAttribute("data-linksee-chat-widget-src", "true");
                document.head.appendChild(script);
            }
        }
    }

    window.initDashboardShell = function initDashboardShell(options) {
        var avatarStorageKey = options && options.avatarStorageKey;
        if (!avatarStorageKey) {
            throw new Error("initDashboardShell requires avatarStorageKey.");
        }

        if (window.linkseeDashboardExtensions && typeof window.linkseeDashboardExtensions.install === "function") {
            window.linkseeDashboardExtensions.install(options || {});
        }
        removeDashboardDescriptions();
        ensureDashboardSubcardNotes();
        sortDashboardNav();
        initSessionMeta();
        syncSessionWithServer();
        initDashboardNav();
        initAdaptivePanels();
        initAvatarControls(avatarStorageKey);
        initLogout(avatarStorageKey);
        initChatLauncher();
        if (window.linkseeUserSettings) {
            window.linkseeUserSettings.syncFromServer();
        }
    };
})();
