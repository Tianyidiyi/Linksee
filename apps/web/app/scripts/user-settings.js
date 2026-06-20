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
        forceMode: false,
        requiredMessage: "",
        newPasswordDraft: "",
        confirmPasswordDraft: "",
        dateTimeDraft: null,
        teacherAssistants: [],
        teacherAssistantsLoading: false,
        teacherAssistantsExpanded: false,
        editingAssistantId: "",
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

    function getDateTimePreferences() {
        return {
            weekStart: localStorage.getItem("linksee_week_start") || "monday",
            timeFormat: localStorage.getItem("linksee_time_format") || "24",
            dateFormat: localStorage.getItem("linksee_date_format") || "mdy",
        };
    }

    function setDateTimePreference(key, value) {
        var storageKeyMap = {
            weekStart: "linksee_week_start",
            timeFormat: "linksee_time_format",
            dateFormat: "linksee_date_format",
        };
        var storageKey = storageKeyMap[key];
        if (!storageKey) return;
        var nextDraft = Object.assign({}, state.dateTimeDraft || getDateTimePreferences());
        nextDraft[key] = String(value);
        state.dateTimeDraft = nextDraft;
    }

    function commitDateTimePreferences() {
        var draft = state.dateTimeDraft || getDateTimePreferences();
        Object.keys(draft).forEach(function (key) {
            var storageKey = {
                weekStart: "linksee_week_start",
                timeFormat: "linksee_time_format",
                dateFormat: "linksee_date_format",
            }[key];
            if (storageKey) {
                localStorage.setItem(storageKey, String(draft[key]));
            }
        });
        if (window.linkseePage && typeof window.linkseePage.setDateTimePreference === "function") {
            window.linkseePage.setDateTimePreference("weekStart", draft.weekStart);
            window.linkseePage.setDateTimePreference("timeFormat", draft.timeFormat);
            window.linkseePage.setDateTimePreference("dateFormat", draft.dateFormat);
        } else {
            window.dispatchEvent(new CustomEvent("linksee:datetime-preferences-changed", {
                detail: draft,
            }));
        }
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
        var me = getMePayload() || {};
        var currentUserId = localStorage.getItem("auth_user_id") || "";
        var profile = me && me.id === currentUserId ? (me.profile || {}) : {};
        return {
            realName: profile.realName || localStorage.getItem("auth_real_name") || localStorage.getItem("auth_user_id") || "",
            bio: typeof profile.bio === "string" ? profile.bio : (localStorage.getItem("auth_bio") || ""),
            email: typeof profile.email === "string" ? profile.email : "",
            location: typeof profile.location === "string" ? profile.location : (localStorage.getItem("auth_location") || ""),
        };
    }

    function getMePayload() {
        try {
            var raw = localStorage.getItem("auth_me_payload");
            return raw ? JSON.parse(raw) : null;
        } catch (_err) {
            return null;
        }
    }

    function patchMeProfileLocal(nextProfile) {
        var me = getMePayload() || {};
        me.profile = Object.assign({}, me.profile || {}, nextProfile || {});
        localStorage.setItem("auth_me_payload", JSON.stringify(me));
    }

    function readOnlyField(label, value) {
        var text = value == null ? "" : String(value);
        return [
            '<div class="user-settings-readonly-field">',
            '<span class="user-settings-readonly-label">' + escapeHtml(label) + '</span>',
            '<div class="user-settings-readonly-value">' + escapeHtml(text) + '</div>',
            "</div>",
        ].join("");
    }

    function readOnlyRow(fields) {
        return '<div class="user-settings-readonly-row">' + fields.join("") + '</div>';
    }

    function getAvatarUrl() {
        return localStorage.getItem("auth_avatar_url") || "";
    }

    function syncFromServer() {
        if (!window.linkseeApi) return;
        window.linkseeApi.getJson("/api/v1/users/me")
            .then(function (payload) {
                var data = payload && payload.data ? payload.data : {};
                localStorage.setItem("auth_me_payload", JSON.stringify(data));
                if (data.profile && data.profile.realName) {
                    localStorage.setItem("auth_real_name", data.profile.realName);
                }
                if (data.profile && typeof data.profile.bio === "string") {
                    localStorage.setItem("auth_bio", data.profile.bio);
                }
                if (data.profile && typeof data.profile.email === "string") {
                    localStorage.setItem("auth_email", data.profile.email);
                } else {
                    localStorage.removeItem("auth_email");
                }
                if (data.profile && typeof data.profile.location === "string") {
                    localStorage.setItem("auth_location", data.profile.location);
                }
                if (state.open) {
                    render();
                }
            })
            .catch(function () {});
    }

    function loadTeacherAssistants() {
        var meData = getMePayload() || {};
        var role = meData.role || localStorage.getItem("auth_role") || "";
        if (role !== "teacher" || !window.linkseeApi) {
            state.teacherAssistants = [];
            state.teacherAssistantsLoading = false;
            return Promise.resolve([]);
        }
        state.teacherAssistantsLoading = true;
        if (state.open) render();
        return window.linkseeApi.getJson("/api/v1/users/assistants/mine")
            .then(function (payload) {
                state.teacherAssistants = Array.isArray(payload && payload.data) ? payload.data : [];
                state.teacherAssistantsLoading = false;
                if (state.open) render();
                return state.teacherAssistants;
            })
            .catch(function () {
                state.teacherAssistants = [];
                state.teacherAssistantsLoading = false;
                if (state.open) render();
                return [];
            });
    }

    function renderTeacherAssistantSection(role) {
        if (role !== "teacher" || state.forceMode) {
            return "";
        }
        var expanded = Boolean(state.teacherAssistantsExpanded);
        var loadingHtml = state.teacherAssistantsLoading
            ? '<div class="user-settings-assistant-empty">正在加载子账号...</div>'
            : "";
        var listHtml = !state.teacherAssistantsLoading && state.teacherAssistants.length
            ? state.teacherAssistants.map(function (row) {
                var actionAssistantId = row.assistantUserId || row.id || "";
                var displayAccountNo = row.accountNo || actionAssistantId || "--";
                var activeLabel = row.isActive ? "启用中" : "已停用";
                var isEditing = state.editingAssistantId === actionAssistantId;
                return [
                    '<div class="user-settings-assistant-table-row" data-assistant-id="' + escapeHtml(actionAssistantId) + '">',
                    '<div class="user-settings-assistant-cell user-settings-assistant-cell-name">',
                    isEditing
                        ? '<input class="user-settings-assistant-inline-input" data-assistant-edit-name="' + escapeHtml(actionAssistantId) + '" value="' + escapeHtml(row.realName || "") + '" placeholder="输入助教姓名" />'
                        : '<strong>' + escapeHtml(row.realName || "未命名助教") + '</strong>',
                    '</div>',
                    '<div class="user-settings-assistant-cell user-settings-assistant-cell-id">' + escapeHtml(displayAccountNo) + '</div>',
                    '<div class="user-settings-assistant-cell user-settings-assistant-cell-courses">' + escapeHtml(String(row.boundCourseCount || 0)) + '</div>',
                    '<div class="user-settings-assistant-cell"><span class="user-settings-assistant-state' + (row.isActive ? " is-active" : " is-inactive") + '">' + escapeHtml(activeLabel) + '</span></div>',
                    '<div class="user-settings-assistant-cell user-settings-assistant-cell-actions">',
                    isEditing
                        ? '<button class="user-settings-assistant-link" type="button" data-action="save-assistant" data-assistant-id="' + escapeHtml(actionAssistantId) + '">保存</button><button class="user-settings-assistant-link" type="button" data-action="cancel-assistant-edit" data-assistant-id="' + escapeHtml(actionAssistantId) + '">取消</button>'
                        : '<button class="user-settings-assistant-link" type="button" data-action="edit-assistant" data-assistant-id="' + escapeHtml(actionAssistantId) + '">编辑</button>',
                    row.isActive
                        ? '<button class="user-settings-assistant-link" type="button" data-action="reset-assistant-password" data-assistant-id="' + escapeHtml(actionAssistantId) + '">重置临时密码</button>'
                        : '<button class="user-settings-assistant-link is-disabled" type="button" data-action="reset-assistant-password-disabled" aria-disabled="true">重置临时密码</button>',
                    '<button class="user-settings-assistant-link user-settings-assistant-link-danger" type="button" data-action="toggle-assistant-active" data-assistant-id="' + escapeHtml(actionAssistantId) + '" data-next-active="' + escapeHtml(row.isActive ? "false" : "true") + '">' + escapeHtml(row.isActive ? "停用" : "启用") + '</button>',
                    '</div>',
                    '</div>',
                ].join("");
            }).join("")
            : "";
        var emptyHtml = !state.teacherAssistantsLoading && !state.teacherAssistants.length
            ? '<div class="user-settings-assistant-empty">当前还没有创建子账号。</div>'
            : "";
        return [
            '<section class="settings-section user-settings-assistant-section">',
            '<button class="user-settings-assistant-toggle' + (expanded ? ' is-open' : '') + '" type="button" data-action="toggle-assistant-section" aria-expanded="' + (expanded ? "true" : "false") + '">',
            '<span class="user-settings-assistant-toggle-copy"><strong>子账号管理</strong></span>',
            '<span class="user-settings-assistant-toggle-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>',
            '</button>',
            '<div class="user-settings-assistant-panel' + (expanded ? ' is-open' : '') + '"' + (expanded ? "" : ' hidden') + '>',
            '<div class="user-settings-assistant-grid">',
            '<div class="user-settings-assistant-create">',
            '<div class="user-settings-assistant-create-head"><strong>新建子账号</strong></div>',
            '<div class="user-settings-assistant-create-fields">',
            '<label class="user-settings-field"><span>姓名</span><input data-field="assistantName" placeholder="输入助教姓名" /></label>',
            '<label class="user-settings-field"><span>账号</span><input data-field="assistantId" maxlength="10" placeholder="留空自动生成 10 位账号" /></label>',
            '<label class="user-settings-field"><span>初始密码</span><input data-field="assistantPassword" type="password" autocomplete="new-password" placeholder="留空自动生成" /></label>',
            '</div>',
            '<div class="user-settings-assistant-create-actions"><button class="user-settings-assistant-create-button" type="button" data-action="create-assistant">创建子账号</button></div>',
            '</div>',
            '<div class="user-settings-assistant-list">',
            '<div class="user-settings-assistant-table-head">',
            '<span>姓名</span>',
            '<span>账号</span>',
            '<span>课程</span>',
            '<span>启用</span>',
            '<span></span>',
            '</div>',
            loadingHtml,
            listHtml,
            emptyHtml,
            '</div>',
            '</div>',
            '</div>',
            '</section>',
        ].join("");
    }

    function render() {
        if (!state.dialog) return;
        var profile = getProfile();
        var userId = localStorage.getItem("auth_user_id") || "";
        var avatarUrl = getAvatarUrl();
        var meData = getMePayload() || {};
        var role = meData.role || localStorage.getItem("auth_role") || "";
        var policyText = passwordHint();
        var policyErrorActive = state.messageType === "error" && state.message === policyText;
        var dateTimePrefs = state.dateTimeDraft || getDateTimePreferences();
        var forceBanner = state.forceMode
            ? '<div class="user-settings-force-banner" role="alert"><strong>首次登录需先修改密码</strong></div>'
            : "";
        var roleReadonlyFields = [];
        if (role === "student") {
            var sp = meData.studentProfile || {};
            roleReadonlyFields = [
                readOnlyRow([
                    readOnlyField("学号", sp.stuNo),
                    readOnlyField("行政班", sp.adminClass),
                ]),
                readOnlyRow([
                    readOnlyField("年级", sp.grade),
                    readOnlyField("入学届", sp.cohort),
                ]),
                readOnlyField("专业", sp.major),
            ];
        } else if (role === "teacher") {
            var tp = meData.teacherProfile || {};
            roleReadonlyFields = [
                readOnlyField("教师号", tp.teacherNo),
                readOnlyField("职称", tp.title),
                readOnlyField("学院", tp.college),
                readOnlyField("研究方向", tp.researchDirection),
            ];
        } else if (role === "assistant") {
            var ap = meData.assistantProfile || {};
            roleReadonlyFields = [
                readOnlyField("绑定教师ID", ap.teacherUserId),
            ];
        }
        var profileSection = state.forceMode ? "" : [
            '<section class="settings-section">',
            '<div class="settings-section-head"><h3>个人资料</h3><p>维护头像、昵称和联系信息</p></div>',
            '<div class="settings-profile-grid">',
            '<div class="settings-avatar-col">',
            '<input type="file" data-field="avatarFile" accept="image/jpeg,image/png,image/webp,image/gif" hidden />',
            '<button type="button" class="settings-avatar-btn" data-action="upload-avatar" title="点击更换头像">',
            avatarUrl ? '<img src="' + escapeHtml(avatarUrl) + '" alt="头像" data-field="avatarPreview" />' : '<span class="settings-avatar-fallback">' + escapeHtml((profile.realName || userId || "U").slice(0, 1).toUpperCase()) + "</span>",
            "</button>",
            '<div class="settings-avatar-name">' + escapeHtml(profile.realName || userId || "--") + '</div>',
            '<div class="settings-avatar-id">' + escapeHtml(userId || "--") + '</div>',
            "</div>",
            '<div class="settings-profile-fields">',
            '<label class="user-settings-field"><span>昵称</span><input data-field="realName" value="' + escapeHtml(profile.realName) + '" placeholder="输入昵称" /></label>',
            '<label class="user-settings-field"><span>邮箱</span><input data-field="email" value="' + escapeHtml(profile.email) + '" placeholder="输入邮箱" /></label>',
            '<label class="user-settings-field"><span>位置</span><input data-field="location" value="' + escapeHtml(profile.location) + '" placeholder="输入位置" /></label>',
            '<label class="user-settings-field"><span>简介</span><textarea data-field="bio" placeholder="写一点简介">' + escapeHtml(profile.bio) + '</textarea></label>',
            roleReadonlyFields.join(""),
            "</div>",
            "</div>",
            "</section>",
            '<section class="settings-section user-settings-theme">',
            '<div class="settings-section-head"><h3>主题颜色</h3><p>选择你偏好的界面风格</p></div>',
            '<div class="settings-theme-strip">',
            backgroundPresets.map(function (item) {
                if (item.id === "dongda") {
                    return '<button class="theme-strip-pick theme-strip-pick-dongda' + (getBackgroundPreset() === item.id ? ' is-active' : '') + '" type="button" data-theme="' + item.theme + '" data-preset="' + item.id + '" title="' + item.label + '" aria-label="' + item.label + '"><img src="./assets/seu-auditorium-line.svg" alt="东大主题" /></button>';
                }
                return '<button class="theme-strip-pick' + (getBackgroundPreset() === item.id ? ' is-active' : '') + '" type="button" data-theme="' + item.theme + '" data-preset="' + item.id + '" title="' + item.label + '" aria-label="' + item.label + '" style="--swatch:' + item.theme + '"></button>';
            }).join(""),
            "</div>",
            "</section>",
            '<section class="settings-section user-settings-datetime">',
            '<div class="settings-section-head"><h3>时间与日期</h3><p>选择你希望的显示方式</p></div>',
            '<label class="user-settings-field"><span>一周起始日</span><div class="user-settings-radio-group" role="radiogroup">',
            '<label class="user-settings-radio"><input type="radio" name="weekStart" data-pref="weekStart" value="sunday"' + (dateTimePrefs.weekStart === "sunday" ? " checked" : "") + ' /><span>周日</span></label>',
            '<label class="user-settings-radio"><input type="radio" name="weekStart" data-pref="weekStart" value="monday"' + (dateTimePrefs.weekStart === "monday" ? " checked" : "") + ' /><span>周一</span></label>',
            "</div></label>",
            '<label class="user-settings-field"><span>时间格式</span><div class="user-settings-radio-group" role="radiogroup">',
            '<label class="user-settings-radio"><input type="radio" name="timeFormat" data-pref="timeFormat" value="24"' + (dateTimePrefs.timeFormat === "24" ? " checked" : "") + ' /><span>24 小时</span></label>',
            '<label class="user-settings-radio"><input type="radio" name="timeFormat" data-pref="timeFormat" value="12"' + (dateTimePrefs.timeFormat === "12" ? " checked" : "") + ' /><span>12 小时</span></label>',
            "</div></label>",
            '<label class="user-settings-field"><span>日期格式</span><div class="user-settings-radio-group" role="radiogroup">',
            '<label class="user-settings-radio"><input type="radio" name="dateFormat" data-pref="dateFormat" value="mdy"' + (dateTimePrefs.dateFormat === "mdy" ? " checked" : "") + ' /><span>mm/dd/yyyy</span></label>',
            '<label class="user-settings-radio"><input type="radio" name="dateFormat" data-pref="dateFormat" value="dmy"' + (dateTimePrefs.dateFormat === "dmy" ? " checked" : "") + ' /><span>dd/mm/yyyy</span></label>',
            '<label class="user-settings-radio"><input type="radio" name="dateFormat" data-pref="dateFormat" value="ymd"' + (dateTimePrefs.dateFormat === "ymd" ? " checked" : "") + ' /><span>yyyy/mm/dd</span></label>',
            "</div></label>",
            "</section>",
        ].join("");
        var footerActions = state.forceMode
            ? '<div class="user-settings-actions user-settings-actions-force"><button class="btn btn-primary" type="button" data-action="change-password"' + (state.saving ? " disabled" : "") + '>' + (state.saving ? "提交中..." : "确认修改密码") + '</button></div>'
            : '<div class="user-settings-actions"><button class="btn btn-ghost" type="button" data-action="cancel">取消</button><button class="btn btn-primary" type="button" data-action="save"' + (state.saving ? " disabled" : "") + '>' + (state.saving ? "保存中..." : "保存") + '</button></div>';
        state.dialog.innerHTML = [
            '<div class="user-settings-layout">',
            '<main class="settings-main">',
            '<div class="user-settings-header">',
            '<div><strong>' + (state.forceMode ? "安全验证" : "我的设置") + '</strong><div class="dashboard-soft-note">' + (state.forceMode ? "请先完成首次密码修改" : "账户信息与偏好设置") + '</div></div>',
            '</div>',
            forceBanner,
            '<div class="user-settings-body settings-main-body">',
            profileSection,
            '<section class="settings-section user-settings-password-section"><div class="settings-section-head user-settings-password-head"><h3>密码修改</h3></div><div class="user-settings-password-layout">',
            '<div class="dashboard-soft-note user-settings-password-policy password-policy-note' + (policyErrorActive ? ' is-error' : '') + '">' + escapeHtml(policyText) + '</div>',
            '<div class="user-settings-password-form">',
            '<div class="password-input-row"><input data-field="newPassword" type="password" autocomplete="new-password" placeholder="新密码" value="' + escapeHtml(state.newPasswordDraft) + '" /></div>',
            '<div class="password-input-row"><input data-field="confirmPassword" type="password" autocomplete="new-password" placeholder="确认新密码" value="' + escapeHtml(state.confirmPasswordDraft) + '" /></div>',
            (state.forceMode ? "" : '<div class="user-settings-password-actions"><button class="user-settings-password-submit" type="button" data-action="change-password">更新密码</button></div>'),
            '</div></div></section>',
            renderTeacherAssistantSection(role),
            '</div>',
            '<div class="dashboard-soft-note' + (state.messageType === "error" ? ' user-settings-message is-error' : state.message ? ' user-settings-message is-success' : ' user-settings-message') + '">' + escapeHtml(policyErrorActive ? "" : state.message) + '</div>',
            footerActions,
            "</main>",
            "</div>",
        ].join("");

        var realNameInput = state.dialog.querySelector('[data-field="realName"]');
        var bioInput = state.dialog.querySelector('[data-field="bio"]');
        var emailInput = state.dialog.querySelector('[data-field="email"]');
        var locationInput = state.dialog.querySelector('[data-field="location"]');
        var newPasswordInput = state.dialog.querySelector('[data-field="newPassword"]');
        var confirmPasswordInput = state.dialog.querySelector('[data-field="confirmPassword"]');
        var avatarTrigger = state.dialog.querySelector("[data-action='upload-avatar']");
        var avatarFileInput = state.dialog.querySelector("[data-field='avatarFile']");
        if (newPasswordInput) {
            newPasswordInput.addEventListener("input", function () {
                state.newPasswordDraft = newPasswordInput.value;
            });
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener("input", function () {
                state.confirmPasswordDraft = confirmPasswordInput.value;
            });
        }
        state.dialog.querySelectorAll("[data-theme]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setTheme(btn.getAttribute("data-theme"), btn.getAttribute("data-preset"));
                render();
            });
        });
        state.dialog.querySelectorAll("[data-pref]").forEach(function (input) {
            input.addEventListener("change", function () {
                setDateTimePreference(input.getAttribute("data-pref"), input.value);
            });
        });
        if (avatarTrigger && avatarFileInput) {
            avatarTrigger.addEventListener("click", function () {
                avatarFileInput.click();
            });
            avatarFileInput.addEventListener("change", function (event) {
                var file = event.target.files && event.target.files[0];
                if (!file) return;
                var allowTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
                if (allowTypes.indexOf(file.type) === -1) {
                    state.messageType = "error";
                    state.message = "头像格式不支持，仅允许 jpg/png/webp/gif";
                    render();
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    state.messageType = "error";
                    state.message = "头像文件超过 5MB，请压缩后重试";
                    render();
                    return;
                }
                if (!window.linkseeApi) {
                    state.messageType = "error";
                    state.message = "API 客户端尚未加载";
                    render();
                    return;
                }
                var formData = new FormData();
                formData.append("avatar", file);
                window.linkseeApi.postForm("/api/v1/users/me/avatar", formData)
                    .then(function (payload) {
                        var avatarUrlNext = payload && payload.data ? payload.data.avatarUrl : "";
                    if (avatarUrlNext) {
                        localStorage.setItem("auth_avatar_url", avatarUrlNext);
                        patchMeProfileLocal({ avatarUrl: avatarUrlNext });
                        document.querySelectorAll(".topbar-avatar-image, #avatarImage").forEach(function (image) {
                            image.src = avatarUrlNext;
                        });
                    }
                        state.messageType = "success";
                        state.message = "头像已更新";
                        render();
                    })
                    .catch(function (err) {
                        state.messageType = "error";
                        state.message = (err && err.message) || "头像上传失败";
                        render();
                    });
            });
        }
        state.dialog.querySelectorAll("[data-action]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var action = btn.getAttribute("data-action");
                if (action === "close" || action === "cancel") {
                    if (state.forceMode) {
                        nudgeDialog(state.requiredMessage || "请先修改密码后继续使用系统。");
                        return;
                    }
                    close();
                }
                if (action === "save") {
                    if (state.forceMode) {
                        nudgeDialog(state.requiredMessage || "当前模式仅允许修改密码。");
                        return;
                    }
                    save(
                        realNameInput ? realNameInput.value.trim() : "",
                        bioInput ? bioInput.value.trim() : "",
                        emailInput ? emailInput.value.trim() : "",
                        locationInput ? locationInput.value.trim() : ""
                    );
                }
                if (action === "change-password") {
                    state.newPasswordDraft = newPasswordInput ? newPasswordInput.value : state.newPasswordDraft;
                    state.confirmPasswordDraft = confirmPasswordInput ? confirmPasswordInput.value : state.confirmPasswordDraft;
                    changePassword(
                        state.newPasswordDraft,
                        state.confirmPasswordDraft
                    );
                }
                if (action === "create-assistant") {
                    createAssistant();
                }
                if (action === "save-assistant") {
                    saveAssistant(btn.getAttribute("data-assistant-id"));
                }
                if (action === "edit-assistant") {
                    state.editingAssistantId = btn.getAttribute("data-assistant-id") || "";
                    render();
                }
                if (action === "cancel-assistant-edit") {
                    state.editingAssistantId = "";
                    render();
                }
                if (action === "reset-assistant-password") {
                    resetAssistantPassword(btn.getAttribute("data-assistant-id"));
                }
                if (action === "reset-assistant-password-disabled") {
                    state.message = "已停用账号不能重置临时密码，请先启用。";
                    state.messageType = "error";
                    render();
                }
                if (action === "toggle-assistant-active") {
                    toggleAssistantActive(btn.getAttribute("data-assistant-id"), btn.getAttribute("data-next-active") === "true");
                }
                if (action === "toggle-assistant-section") {
                    state.teacherAssistantsExpanded = !state.teacherAssistantsExpanded;
                    render();
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
            if (event.target === overlay) {
                if (state.forceMode) {
                    nudgeDialog(state.requiredMessage || "请先修改密码后继续使用系统。");
                    return;
                }
                close();
            }
        });
    }

    function isStrongPassword(password) {
        if (window.linkseePage && typeof window.linkseePage.isStrongPassword === "function") {
            return window.linkseePage.isStrongPassword(password);
        }
        var value = String(password || "");
        return /^.{8,72}$/.test(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);
    }

    function passwordHint() {
        if (window.linkseePage && typeof window.linkseePage.passwordPolicyHint === "function") {
            return window.linkseePage.passwordPolicyHint();
        }
        return "密码需为 8-72 位，且至少包含一个大写字母、一个小写字母和一个数字。";
    }

    function open(options) {
        build();
        ensureTheme();
        syncFromServer();
        loadTeacherAssistants();
        state.message = "";
        state.messageType = "";
        state.saving = false;
        state.forceMode = Boolean(options && options.forcePassword);
        state.requiredMessage = options && options.message ? String(options.message) : "";
        state.newPasswordDraft = "";
        state.confirmPasswordDraft = "";
        state.dateTimeDraft = getDateTimePreferences();
        render();
        document.body.classList.add("user-settings-open");
        if (state.forceMode) {
            document.body.classList.add("force-password-required");
        } else {
            document.body.classList.remove("force-password-required");
        }
        state.overlay.classList.add("is-open");
        state.open = true;
    }

    function close() {
        if (state.forceMode) {
            nudgeDialog(state.requiredMessage || "请先修改密码后继续使用系统。");
            return;
        }
        if (!state.overlay) return;
        state.overlay.classList.remove("is-open");
        document.body.classList.remove("user-settings-open");
        document.body.classList.remove("force-password-required");
        state.open = false;
    }

    function nudgeDialog(message) {
        if (!state.dialog) return;
        state.messageType = "error";
        state.message = message || "请先修改密码后继续使用系统。";
        state.dialog.classList.remove("user-settings-shake");
        void state.dialog.offsetWidth;
        state.dialog.classList.add("user-settings-shake");
        render();
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
                    patchMeProfileLocal({
                        realName: safeRealName,
                        bio: bio || null,
                        email: email || null,
                        location: location || null,
                    });
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
                    commitDateTimePreferences();
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
            patchMeProfileLocal({
                realName: safeRealName,
                bio: bio || null,
                email: email || null,
                location: location || null,
            });
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
            commitDateTimePreferences();
            state.saving = false;
            state.message = "保存成功";
            state.messageType = "success";
            close();
        }
    }


    function changePassword(newPassword, confirmPassword) {
        state.message = "";
        state.messageType = "";
        state.saving = true;
        render();
        if (!newPassword) {
            state.saving = false;
            state.message = "请填写新密码";
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
        if (!isStrongPassword(newPassword)) {
            state.saving = false;
            state.message = passwordHint();
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
            state.forceMode = false;
            state.newPasswordDraft = "";
            state.confirmPasswordDraft = "";
            document.body.classList.remove("force-password-required");
            render();
        }).catch(function (err) {
            state.saving = false;
            if (state.forceMode) {
                state.message = "密码修改失败，请检查新密码后重试。";
            } else {
                state.message = (err && err.message) || "密码修改失败";
            }
            state.messageType = "error";
            render();
        });
    }

    function createAssistant() {
        if (!window.linkseeApi || !state.dialog) {
            return;
        }
        var idInput = state.dialog.querySelector('[data-field="assistantId"]');
        var nameInput = state.dialog.querySelector('[data-field="assistantName"]');
        var passwordInput = state.dialog.querySelector('[data-field="assistantPassword"]');
        var id = idInput ? idInput.value.trim() : "";
        var realName = nameInput ? nameInput.value.trim() : "";
        var defaultPassword = passwordInput ? passwordInput.value.trim() : "";
        if (!realName) {
            state.message = "请填写助教姓名";
            state.messageType = "error";
            render();
            return;
        }
        if (id && !/^\d{10}$/.test(id)) {
            state.message = "账号需为 10 位数字，或留空自动生成";
            state.messageType = "error";
            render();
            return;
        }
        if (defaultPassword && !isStrongPassword(defaultPassword)) {
            state.message = passwordHint();
            state.messageType = "error";
            render();
            return;
        }
        state.saving = true;
        var payload = {
            realName: realName,
        };
        if (id) payload.id = id;
        if (defaultPassword) payload.defaultPassword = defaultPassword;
        window.linkseeApi.postJson("/api/v1/users/assistants", payload)
            .then(function (response) {
                var data = response && response.data ? response.data : {};
                state.saving = false;
                state.messageType = "success";
                state.message = "子账号已创建，账号：" + String(data.id || "--") + "，初始密码：" + String(data.temporaryPassword || "--");
                if (idInput) idInput.value = "";
                if (nameInput) nameInput.value = "";
                if (passwordInput) passwordInput.value = "";
                return loadTeacherAssistants();
            })
            .then(function () {
                render();
            })
            .catch(function (err) {
                state.saving = false;
                state.message = (err && err.message) || "子账号创建失败";
                state.messageType = "error";
                render();
            });
    }

    function saveAssistant(assistantId) {
        if (!window.linkseeApi || !assistantId || !state.dialog) {
            return;
        }
        var nameInput = state.dialog.querySelector('[data-assistant-edit-name="' + assistantId + '"]');
        var realName = nameInput ? nameInput.value.trim() : "";
        if (!realName) {
            state.message = "助教姓名不能为空";
            state.messageType = "error";
            render();
            return;
        }
        state.saving = true;
        window.linkseeApi.patchJson("/api/v1/users/assistants/" + encodeURIComponent(assistantId), {
            realName: realName,
        }).then(function () {
            state.saving = false;
            state.message = "子账号信息已保存";
            state.messageType = "success";
            return loadTeacherAssistants();
        }).then(function () {
            render();
        }).catch(function (err) {
            state.saving = false;
            state.message = (err && err.message) || "保存失败";
            state.messageType = "error";
            render();
        });
    }

    function resetAssistantPassword(assistantId) {
        if (!window.linkseeApi || !assistantId) {
            return;
        }
        state.saving = true;
        window.linkseeApi.postJson("/api/v1/auth/admin/reset-password", {
            targetUserId: assistantId,
        }).then(function (response) {
            var data = response && response.data ? response.data : {};
            state.saving = false;
            state.message = "密码已重置，临时密码：" + String(data.temporaryPassword || "--");
            state.messageType = "success";
            return loadTeacherAssistants();
        }).then(function () {
            render();
        }).catch(function (err) {
            state.saving = false;
            state.message = (err && err.message) || "密码重置失败";
            state.messageType = "error";
            render();
        });
    }

    function toggleAssistantActive(assistantId, nextActive) {
        if (!window.linkseeApi || !assistantId) {
            return;
        }
        state.saving = true;
        window.linkseeApi.patchJson("/api/v1/users/assistants/" + encodeURIComponent(assistantId), {
            isActive: nextActive,
        }).then(function () {
            state.saving = false;
            state.message = nextActive ? "子账号已启用" : "子账号已停用，并已解除课程绑定";
            state.messageType = "success";
            return loadTeacherAssistants();
        }).then(function () {
            render();
        }).catch(function (err) {
            state.saving = false;
            state.message = (err && err.message) || "操作失败";
            state.messageType = "error";
            render();
        });
    }

    window.linkseeUserSettings = {
        open: open,
        close: close,
        syncFromServer: syncFromServer,
        openForcePassword: function (message) {
            open({ forcePassword: true, message: message || "请先修改密码后继续使用系统。" });
            nudgeDialog(message || "请先修改密码后继续使用系统。");
        },
        nudgeForcePassword: function (message) {
            if (!state.open || !state.forceMode) {
                return;
            }
            nudgeDialog(message || "请先修改密码后继续使用系统。");
        },
    };

    window.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && state.open) {
            if (state.forceMode) {
                nudgeDialog(state.requiredMessage || "请先修改密码后继续使用系统。");
                return;
            }
            close();
        }
    });

    ensureTheme();
})();
