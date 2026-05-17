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
            });
        });
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
                    savedAvatar = nextAvatar;
                    localStorage.setItem(avatarStorageKey, nextAvatar);
                }
            };
            reader.readAsDataURL(file);
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

        initSessionMeta();
        syncSessionWithServer();
        initDashboardNav();
        initAvatarControls(avatarStorageKey);
        initLogout(avatarStorageKey);
        initChatLauncher();
        if (window.linkseeUserSettings) {
            window.linkseeUserSettings.syncFromServer();
        }
    };
})();
