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
            ".dashboard-subcard-note",
            ".dashboard-soft-note",
        ].join(",")).forEach(function (node) {
            node.remove();
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
