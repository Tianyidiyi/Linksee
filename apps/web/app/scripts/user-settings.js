(function () {
    if (window.linkseeUserSettings) {
        return;
    }

    var backgroundPresets = [
        { id: "dongda", label: "东大背景", theme: "#c3e6f8" },
        { id: "mint", label: "薄荷绿", theme: "#d8edd2" },
        { id: "sky", label: "天空蓝", theme: "#c3e6f8" },
        { id: "apricot", label: "杏米色", theme: "#f2d7b6" },
        { id: "lavender", label: "浅雾紫", theme: "#dbe3ff" },
        { id: "rose", label: "浅粉杏", theme: "#f4d7d5" },
        { id: "sand", label: "柔沙色", theme: "#e9dfc9" },
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
        return localStorage.getItem("linksee_theme_color") || "#c3e6f8";
    }

    function getBackgroundPreset() {
        return localStorage.getItem("linksee_background_preset") || "sky";
    }

    function ensureDongdaStylesheet(enabled) {
        var id = "linksee-dongda-background-style";
        var existing = document.getElementById(id);
        if (enabled) {
            if (existing) {
                return;
            }
            var link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = "./styles/backgrounds-legacy.css";
            document.head.appendChild(link);
            return;
        }
        if (existing) {
            existing.remove();
        }
    }

    function ensureLeafPile(enabled) {
        var existingLayer = document.querySelector(".leaf-pile-layer");
        var existingScript = document.querySelector('script[data-linksee-leaf-pile-src]');
        var existingBand = document.querySelector(".dongda-leaf-band");
        if (enabled) {
            if (!existingBand) {
                var band = document.createElement("div");
                band.className = "dongda-leaf-band";
                band.setAttribute("aria-hidden", "true");
                document.body.appendChild(band);
            }
            if (existingLayer) {
                if (window.initLeafPile) {
                    window.initLeafPile();
                }
                return;
            }
            if (existingScript || window.__linkseeLeafPileLoading) {
                return;
            }
            window.__linkseeLeafPileLoading = true;
            var script = document.createElement("script");
            script.src = "./scripts/leaf-pile.js";
            script.async = true;
            script.setAttribute("data-linksee-leaf-pile-src", "true");
            script.onload = function () {
                window.__linkseeLeafPileLoading = false;
                if (window.initLeafPile) {
                    window.initLeafPile();
                }
            };
            script.onerror = function () {
                window.__linkseeLeafPileLoading = false;
            };
            document.head.appendChild(script);
            return;
        }
        if (!enabled) {
            if (existingLayer) {
                existingLayer.remove();
            }
            if (existingScript) {
                existingScript.remove();
            }
            if (existingBand) {
                existingBand.remove();
            }
        }
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

    function setTheme(color, presetId) {
        var target = document.body || document.documentElement;
        var nextPreset = presetId || "sky";
        var useDongda = nextPreset === "dongda";
        localStorage.setItem("linksee_theme_color", color);
        localStorage.setItem("linksee_background_preset", nextPreset);
        target.setAttribute("data-background-preset", nextPreset);
        ensureDongdaStylesheet(useDongda);
        ensureLeafPile(useDongda);
        if (useDongda) {
            target.style.removeProperty("--app-theme-start");
            target.style.removeProperty("--app-theme-mid-1");
            target.style.removeProperty("--app-theme-mid-2");
            target.style.removeProperty("--app-theme-mid-3");
            target.style.removeProperty("--app-theme-mid-4");
            return;
        }
        target.style.setProperty("--app-theme-start", color);
        target.style.setProperty("--app-theme-mid-1", mixColor(color, "#f4f8ee", 0.38));
        target.style.setProperty("--app-theme-mid-2", mixColor(color, "#fffdf8", 0.72));
        target.style.setProperty("--app-theme-mid-3", mixColor(color, "#f7f2e8", 0.78));
        target.style.setProperty("--app-theme-mid-4", mixColor(color, "#ebe2d6", 0.86));
    }

    function ensureTheme() {
        setTheme(getTheme(), getBackgroundPreset());
        ensureLeafPile(getBackgroundPreset() === "dongda");
    }

    function getProfile() {
        return {
            realName: localStorage.getItem("auth_real_name") || localStorage.getItem("auth_user_id") || "",
            bio: localStorage.getItem("auth_bio") || "",
            email: localStorage.getItem("auth_email") || "",
            location: localStorage.getItem("auth_location") || "",
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
                if (data.profile && typeof data.profile.email === "string") {
                    localStorage.setItem("auth_email", data.profile.email);
                }
                if (data.profile && typeof data.profile.location === "string") {
                    localStorage.setItem("auth_location", data.profile.location);
                }
            })
            .catch(function () {});
    }

    function render() {
        if (!state.dialog) return;
        var profile = getProfile();
        state.dialog.innerHTML = [
            '<div class="user-settings-header">',
            '<div><strong>用户设置</strong><div class="dashboard-soft-note">昵称、说明与背景预设</div></div>',
            '<button class="linksee-settings-close" type="button" data-action="close">×</button>',
            '</div>',
            '<div class="user-settings-body">',
            '<label class="user-settings-field"><span>昵称</span><input data-field="realName" value="' + escapeHtml(profile.realName) + '" placeholder="输入昵称" /></label>',
            '<label class="user-settings-field"><span>邮箱</span><input data-field="email" value="' + escapeHtml(profile.email) + '" placeholder="输入邮箱" /></label>',
            '<label class="user-settings-field"><span>位置</span><input data-field="location" value="' + escapeHtml(profile.location) + '" placeholder="输入位置" /></label>',
            '<label class="user-settings-field"><span>说明</span><textarea data-field="bio" placeholder="写一点说明">' + escapeHtml(profile.bio) + '</textarea></label>',
            '<div class="user-settings-field"><span>背景</span><div class="theme-picks theme-picks-presets">',
            backgroundPresets.map(function (item) {
                return '<button class="theme-pick theme-pick-preset' + (getBackgroundPreset() === item.id ? ' is-active' : '') + '" type="button" data-theme="' + item.theme + '" data-preset="' + item.id + '" title="' + item.label + '" aria-label="' + item.label + '" style="--swatch:' + item.theme + '"><span>' + item.label + '</span></button>';
            }).join(""),
            '</div></div>',
            '<div class="user-settings-field"><span>修改密码</span><div class="single-window-form">',
            '<input data-field="currentPassword" type="password" autocomplete="current-password" placeholder="当前密码" />',
            '<input data-field="newPassword" type="password" autocomplete="new-password" placeholder="新密码" />',
            '<input data-field="confirmPassword" type="password" autocomplete="new-password" placeholder="确认新密码" />',
            '<button class="btn btn-secondary" type="button" data-action="change-password">更新密码</button>',
            '</div></div>',
            '</div>',
            '<div class="dashboard-soft-note' + (state.messageType === "error" ? ' user-settings-message is-error' : state.message ? ' user-settings-message is-success' : ' user-settings-message') + '">' + escapeHtml(state.message) + '</div>',
            '<div class="user-settings-actions">',
            '<button class="btn btn-ghost" type="button" data-action="cancel">取消</button>',
            '<button class="btn btn-primary" type="button" data-action="save"' + (state.saving ? " disabled" : "") + '>' + (state.saving ? "保存中..." : "保存") + '</button>',
            '</div>',
        ].join("");

        var realNameInput = state.dialog.querySelector('[data-field="realName"]');
        var bioInput = state.dialog.querySelector('[data-field="bio"]');
        var emailInput = state.dialog.querySelector('[data-field="email"]');
        var locationInput = state.dialog.querySelector('[data-field="location"]');
        var currentPasswordInput = state.dialog.querySelector('[data-field="currentPassword"]');
        var newPasswordInput = state.dialog.querySelector('[data-field="newPassword"]');
        var confirmPasswordInput = state.dialog.querySelector('[data-field="confirmPassword"]');
        state.dialog.querySelectorAll("[data-theme]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setTheme(btn.getAttribute("data-theme"), btn.getAttribute("data-preset"));
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
                    save(
                        realNameInput ? realNameInput.value.trim() : "",
                        bioInput ? bioInput.value.trim() : "",
                        emailInput ? emailInput.value.trim() : "",
                        locationInput ? locationInput.value.trim() : ""
                    );
                }
                if (action === "change-password") {
                    changePassword(
                        currentPasswordInput ? currentPasswordInput.value : "",
                        newPasswordInput ? newPasswordInput.value : "",
                        confirmPasswordInput ? confirmPasswordInput.value : ""
                    );
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

    function save(realName, bio, email, location) {
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
        payload.email = email || null;
        payload.location = location || null;
        if (window.linkseeApi) {
            window.linkseeApi.patchJson("/api/v1/users/me", payload)
                .then(function () {
                    localStorage.setItem("auth_real_name", safeRealName);
                    localStorage.setItem("auth_bio", bio || "");
                    localStorage.setItem("auth_email", email || "");
                    localStorage.setItem("auth_location", location || "");
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
            localStorage.setItem("auth_email", email || "");
            localStorage.setItem("auth_location", location || "");
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

    function changePassword(currentPassword, newPassword, confirmPassword) {
        state.message = "";
        state.messageType = "";
        state.saving = true;
        render();
        if (!currentPassword || !newPassword) {
            state.saving = false;
            state.message = "请填写当前密码和新密码";
            state.messageType = "error";
            render();
            return;
        }
        if (newPassword !== confirmPassword) {
            state.saving = false;
            state.message = "两次输入的新密码不一致";
            state.messageType = "error";
            render();
            return;
        }
        if (!window.linkseeApi) {
            state.saving = false;
            state.message = "API 客户端尚未加载";
            state.messageType = "error";
            render();
            return;
        }
        window.linkseeApi.postJson("/api/v1/auth/change-password", {
            currentPassword: currentPassword,
            newPassword: newPassword,
        }).then(function (payload) {
            var data = payload && payload.data ? payload.data : {};
            if (data.accessToken) {
                localStorage.setItem("auth_access_token", data.accessToken);
            }
            if (data.refreshToken) {
                localStorage.setItem("auth_refresh_token", data.refreshToken);
            }
            localStorage.setItem("auth_force_change_password", "false");
            state.saving = false;
            state.message = "密码已更新";
            state.messageType = "success";
            render();
        }).catch(function (err) {
            state.saving = false;
            state.message = (err && err.message) || "密码修改失败";
            state.messageType = "error";
            render();
        });
    }

    window.linkseeUserSettings = {
        open: open,
        close: close,
        syncFromServer: syncFromServer,
    };

    ensureTheme();
})();
