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

    function initSessionMeta() {
        var metaInfo = document.getElementById("metaInfo");
        var userBadge = document.getElementById("userBadge");
        var userId = localStorage.getItem("auth_user_id");
        var token = localStorage.getItem("auth_access_token");

        if (metaInfo) {
            metaInfo.textContent = userId && token
                ? "当前登录账号：" + userId
                : "未检测到登录信息，请返回登录页。";
        }

        if (userBadge) {
            userBadge.textContent = userId && token
                ? "ID: " + userId
                : "ID: --";
        }
    }

    function initLogout(avatarStorageKey) {
        var logoutBtn = document.getElementById("logoutBtn");
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
    }

    window.initDashboardShell = function initDashboardShell(options) {
        var avatarStorageKey = options && options.avatarStorageKey;
        if (!avatarStorageKey) {
            throw new Error("initDashboardShell requires avatarStorageKey.");
        }

        initSessionMeta();
        initDashboardNav();
        initAvatarControls(avatarStorageKey);
        initLogout(avatarStorageKey);
    };
})();
