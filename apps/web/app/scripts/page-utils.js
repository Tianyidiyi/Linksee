(function () {
    function getAppOrigin() {
        return window.location.origin && window.location.origin !== "null"
            ? window.location.origin
            : "http://localhost:3001";
    }

    function getAppBasePath() {
        return window.location.pathname.includes("/app/") ? "/app" : "";
    }

    function go(path) {
        window.location.href = getAppOrigin() + getAppBasePath() + path;
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    function getAuth() {
        return {
            userId: localStorage.getItem("auth_user_id") || "",
            token: localStorage.getItem("auth_access_token") || "",
            role: localStorage.getItem("auth_role") || "",
        };
    }

    function requireAuth() {
        var auth = getAuth();
        if (!auth.token) {
            go("/login.html");
            return false;
        }
        return true;
    }

    function setSessionMeta(metaInfo, userBadge) {
        var auth = getAuth();
        if (metaInfo) {
            metaInfo.textContent = auth.userId ? "当前登录账号：" + auth.userId : "未检测到登录信息，请返回登录页。";
        }
        if (userBadge) {
            userBadge.textContent = auth.userId ? "ID: " + auth.userId : "ID: --";
        }
    }

    function clearSession() {
        localStorage.removeItem("auth_access_token");
        localStorage.removeItem("auth_refresh_token");
        localStorage.removeItem("auth_user_id");
        localStorage.removeItem("auth_role");
        localStorage.removeItem("auth_real_name");
        localStorage.removeItem("auth_bio");
        localStorage.removeItem("auth_avatar_url");
        localStorage.removeItem("auth_force_change_password");
        localStorage.removeItem("auth_origin");
    }

    function logout() {
        var refreshToken = localStorage.getItem("auth_refresh_token") || "";
        var base = (window.linkseeApi && typeof window.linkseeApi.getApiBaseUrl === "function")
            ? window.linkseeApi.getApiBaseUrl()
            : getAppOrigin();
        if (refreshToken) {
            fetch(base + "/api/v1/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: refreshToken }),
            }).catch(function () {});
        }
        clearSession();
        go("/login.html");
    }

    function bindSessionExpiryGuard() {
        if (window.__linkseeSessionGuardBound) return;
        window.__linkseeSessionGuardBound = true;
        window.addEventListener("linksee:session-expired", function () {
            clearSession();
            go("/login.html");
        });
    }

    function isStrongPassword(password) {
        var value = String(password || "");
        return /^.{8,72}$/.test(value)
            && /[A-Z]/.test(value)
            && /[a-z]/.test(value)
            && /[0-9]/.test(value);
    }

    function passwordPolicyHint() {
        return "密码需为 8-72 位，且至少包含一个大写字母、一个小写字母和一个数字。";
    }

    var dateTimePreferenceKeys = {
        weekStart: "linksee_week_start",
        timeFormat: "linksee_time_format",
        dateFormat: "linksee_date_format",
    };

    function getDateTimePreferences() {
        return {
            weekStart: localStorage.getItem(dateTimePreferenceKeys.weekStart) || "monday",
            timeFormat: localStorage.getItem(dateTimePreferenceKeys.timeFormat) || "24",
            dateFormat: localStorage.getItem(dateTimePreferenceKeys.dateFormat) || "mdy",
        };
    }

    function setDateTimePreference(key, value) {
        var storageKey = dateTimePreferenceKeys[key];
        if (!storageKey) {
            return;
        }
        localStorage.setItem(storageKey, String(value));
        window.dispatchEvent(new CustomEvent("linksee:datetime-preferences-changed", {
            detail: getDateTimePreferences(),
        }));
    }

    function pad2(value) {
        var num = Number(value) || 0;
        return num < 10 ? "0" + num : String(num);
    }

    function formatDateParts(date, prefs) {
        var year = date.getFullYear();
        var month = pad2(date.getMonth() + 1);
        var day = pad2(date.getDate());
        if (prefs.dateFormat === "dmy") {
            return day + "/" + month + "/" + year;
        }
        if (prefs.dateFormat === "ymd") {
            return year + "/" + month + "/" + day;
        }
        return month + "/" + day + "/" + year;
    }

    function formatTimeParts(date, prefs) {
        var hours = date.getHours();
        var minutes = pad2(date.getMinutes());
        if (prefs.timeFormat === "12") {
            var suffix = hours >= 12 ? "PM" : "AM";
            var hour12 = hours % 12 || 12;
            return hour12 + ":" + minutes + " " + suffix;
        }
        return pad2(hours) + ":" + minutes;
    }

    function formatDateTime(value, options) {
        if (!value) {
            return "--";
        }
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        var prefs = getDateTimePreferences();
        var dateText = formatDateParts(date, prefs);
        if (options && options.dateOnly) {
            return dateText;
        }
        return dateText + " " + formatTimeParts(date, prefs);
    }

    function formatDate(value) {
        return formatDateTime(value, { dateOnly: true });
    }

    bindSessionExpiryGuard();

    function roleDashboard(role) {
        return {
            academic: "/academic-dashboard.html",
            teacher: "/teacher-dashboard.html",
            assistant: "/assistant-dashboard.html",
            student: "/student-dashboard.html",
        }[role] || "/login.html";
    }

    window.linkseePage = {
        getAppOrigin: getAppOrigin,
        getAppBasePath: getAppBasePath,
        go: go,
        escapeHtml: escapeHtml,
        getAuth: getAuth,
        requireAuth: requireAuth,
        setSessionMeta: setSessionMeta,
        logout: logout,
        clearSession: clearSession,
        roleDashboard: roleDashboard,
        isStrongPassword: isStrongPassword,
        passwordPolicyHint: passwordPolicyHint,
        getDateTimePreferences: getDateTimePreferences,
        setDateTimePreference: setDateTimePreference,
        formatDateTime: formatDateTime,
        formatDate: formatDate,
    };
})();
