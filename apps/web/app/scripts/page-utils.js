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
        if (!auth.userId || !auth.token) {
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

    function logout() {
        localStorage.removeItem("auth_access_token");
        localStorage.removeItem("auth_refresh_token");
        localStorage.removeItem("auth_user_id");
        localStorage.removeItem("auth_role");
        localStorage.removeItem("auth_real_name");
        localStorage.removeItem("auth_bio");
        localStorage.removeItem("auth_force_change_password");
        localStorage.removeItem("auth_origin");
        go("/login.html");
    }

    function roleDashboard(role) {
        return {
            academic: "/academic-dashboard.html",
            teacher: "/teacher-dashboard.html",
            assistant: "/assistant-dashboard.html",
            student: "/student-dashboard.html",
        }[role] || "/dashboard.html";
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
        roleDashboard: roleDashboard,
    };
})();
