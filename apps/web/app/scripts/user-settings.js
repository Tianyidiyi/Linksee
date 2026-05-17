(function () {
    if (window.linkseeUserSettings) {
        return;
    }

    var themePresets = [
        { id: "spring", label: "春", color: "#d8edd2" },
        { id: "summer", label: "夏", color: "#c3e6f8" },
        { id: "autumn", label: "秋", color: "#f2d7b6" },
        { id: "winter", label: "冬", color: "#dbe3ff" },
    ];

    var state = {
        open: false,
        overlay: null,
        dialog: null,
        message: "",
        messageType: "",
        saving: false,
    };

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    function getTheme() {
        return localStorage.getItem("linksee_theme_color") || "#7cc7f2";
    }

    function hexToRgb(hex) {
        var normalized = String(hex || "").replace("#", "");
        if (normalized.length === 3) {
            normalized = normalized.split("").map(function (ch) { return ch + ch; }).join("");
        }
        var value = parseInt(normalized, 16);
        return {
            r: (value >> 16) & 255,
            g: (value >> 8) & 255,
            b: value & 255,
        };
    }

    function mixColor(hex, targetHex, weight) {
        var from = hexToRgb(hex);
        var to = hexToRgb(targetHex);
        var ratio = Math.max(0, Math.min(1, weight));
        var r = Math.round(from.r + (to.r - from.r) * ratio);
        var g = Math.round(from.g + (to.g - from.g) * ratio);
        var b = Math.round(from.b + (to.b - from.b) * ratio);
        return "rgb(" + r + ", " + g + ", " + b + ")";
    }

    function setTheme(color) {
        var target = document.body || document.documentElement;
        localStorage.setItem("linksee_theme_color", color);
        target.style.setProperty("--app-theme-start", color);
        target.style.setProperty("--app-theme-mid-1", mixColor(color, "#ffffff", 0.24));
        target.style.setProperty("--app-theme-mid-2", mixColor(color, "#ffffff", 0.72));
        target.style.setProperty("--app-theme-mid-3", "rgb(248, 250, 252)");
        target.style.setProperty("--app-theme-mid-4", mixColor("#ffffff", "#a3c7e1", 0.62));
    }

    function ensureTheme() {
        setTheme(getTheme());
    }

    function getProfile() {
        return {
            realName: localStorage.getItem("auth_real_name") || localStorage.getItem("auth_user_id") || "",
            bio: localStorage.getItem("auth_bio") || "",
        };
    }

    function syncFromServer() {
        if (!window.linkseeApi) return;
        window.linkseeApi.getJson("/api/v1/users/me")
            .then(function (payload) {
                var data = payload && payload.data ? payload.data : {};
                if (data.profile && data.profile.realName) {
                    localStorage.setItem("auth_real_name", data.profile.realName);
                }
                if (data.profile && typeof data.profile.bio === "string") {
                    localStorage.setItem("auth_bio", data.profile.bio);
                }
            })
            .catch(function () {});
    }

    function render() {
        if (!state.dialog) return;
        var profile = getProfile();
        state.dialog.innerHTML = [
            '<div class="user-settings-header">',
            '<div><strong>用户设置</strong><div class="dashboard-soft-note">昵称、个性说明与界面色调</div></div>',
            '<button class="linksee-settings-close" type="button" data-action="close">×</button>',
            '</div>',
            '<div class="user-settings-body">',
            '<label class="user-settings-field"><span>昵称</span><input data-field="realName" value="' + escapeHtml(profile.realName) + '" placeholder="输入昵称" /></label>',
            '<label class="user-settings-field"><span>说明</span><textarea data-field="bio" placeholder="写一点说明">' + escapeHtml(profile.bio) + '</textarea></label>',
            '<div class="user-settings-field"><span>界面背景色</span><div class="theme-picks">',
            themePresets.map(function (item) {
                return '<button class="theme-pick' + (getTheme() === item.color ? ' is-active' : '') + '" type="button" data-theme="' + item.color + '" title="' + item.label + '" aria-label="' + item.label + '" style="--swatch:' + item.color + '"></button>';
            }).join(""),
            '</div><div class="dashboard-soft-note">上方会渐变到湖水蓝，水面层保持不变。</div></div>',
            '</div>',
            '<div class="dashboard-soft-note' + (state.messageType === "error" ? ' user-settings-message is-error' : state.message ? ' user-settings-message is-success' : ' user-settings-message') + '">' + escapeHtml(state.message) + '</div>',
            '<div class="user-settings-actions">',
            '<button class="btn btn-ghost" type="button" data-action="cancel">取消</button>',
            '<button class="btn btn-primary" type="button" data-action="save"' + (state.saving ? " disabled" : "") + '>' + (state.saving ? "保存中..." : "保存") + '</button>',
            '</div>',
        ].join("");

        var realNameInput = state.dialog.querySelector('[data-field="realName"]');
        var bioInput = state.dialog.querySelector('[data-field="bio"]');
        state.dialog.querySelectorAll("[data-theme]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setTheme(btn.getAttribute("data-theme"));
                render();
            });
        });
        state.dialog.querySelectorAll("[data-action]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var action = btn.getAttribute("data-action");
                if (action === "close" || action === "cancel") {
                    close();
                }
                if (action === "save") {
                    save(realNameInput ? realNameInput.value.trim() : "", bioInput ? bioInput.value.trim() : "");
                }
            });
        });
    }

    function build() {
        if (state.overlay) return;
        var overlay = document.createElement("div");
        overlay.className = "user-settings-overlay";
        overlay.innerHTML = '<div class="user-settings-dialog" role="dialog" aria-modal="true" aria-label="用户设置"></div>';
        document.body.appendChild(overlay);
        state.overlay = overlay;
        state.dialog = overlay.querySelector(".user-settings-dialog");
        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) close();
        });
    }

    function open() {
        build();
        ensureTheme();
        state.message = "";
        state.messageType = "";
        state.saving = false;
        render();
        document.body.classList.add("user-settings-open");
        state.overlay.classList.add("is-open");
        state.open = true;
    }

    function close() {
        if (!state.overlay) return;
        state.overlay.classList.remove("is-open");
        document.body.classList.remove("user-settings-open");
        state.open = false;
    }

    function save(realName, bio) {
        state.message = "";
        state.messageType = "";
        state.saving = true;
        render();
        var userId = localStorage.getItem("auth_user_id") || "";
        var safeRealName = realName || userId;
        var payload = {
            realName: safeRealName,
        };
        payload.bio = bio;
        if (window.linkseeApi) {
            window.linkseeApi.patchJson("/api/v1/users/me", payload)
                .then(function () {
                    localStorage.setItem("auth_real_name", safeRealName);
                    localStorage.setItem("auth_bio", bio || "");
                    var userBadge = document.getElementById("userBadge");
                    if (userBadge) {
                        userBadge.textContent = safeRealName || userId || "--";
                    }
                    var profileDescription = document.getElementById("userProfileDescription");
                    if (profileDescription) {
                        profileDescription.textContent = bio || "";
                        profileDescription.hidden = !bio;
                    }
                    var metaInfo = document.getElementById("metaInfo");
                    if (metaInfo && userId) {
                        metaInfo.textContent = "当前登录账号：" + userId + (safeRealName ? " · " + safeRealName : "");
                    }
                    state.saving = false;
                    state.message = "保存成功";
                    state.messageType = "success";
                    close();
                })
                .catch(function (err) {
                    state.saving = false;
                    state.message = (err && err.message) || "保存失败，请重新登录后再试";
                    state.messageType = "error";
                    render();
                });
        } else {
            localStorage.setItem("auth_real_name", safeRealName);
            localStorage.setItem("auth_bio", bio || "");
            var userBadge = document.getElementById("userBadge");
            if (userBadge) {
                userBadge.textContent = safeRealName || userId || "--";
            }
            var profileDescription = document.getElementById("userProfileDescription");
            if (profileDescription) {
                profileDescription.textContent = bio || "";
                profileDescription.hidden = !bio;
            }
            var metaInfo = document.getElementById("metaInfo");
            if (metaInfo && userId) {
                metaInfo.textContent = "当前登录账号：" + userId + (safeRealName ? " · " + safeRealName : "");
            }
            state.saving = false;
            state.message = "保存成功";
            state.messageType = "success";
            close();
        }
    }

    window.linkseeUserSettings = {
        open: open,
        close: close,
        syncFromServer: syncFromServer,
    };

    ensureTheme();
})();
