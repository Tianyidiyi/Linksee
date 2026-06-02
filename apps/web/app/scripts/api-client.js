(function () {
    var refreshPromise = null;
    var FORCE_CHANGE_CODE = "FORCE_CHANGE_PASSWORD";
    var UNAUTH_CODE = "UNAUTHENTICATED";
    var DEV_HOSTS = { "localhost": true, "127.0.0.1": true, "::1": true };

    function canUseStoredOrigin(storedUrl, runtimeOrigin) {
        try {
            var stored = new URL(storedUrl);
            if (stored.protocol !== "http:" && stored.protocol !== "https:") {
                return false;
            }
            if (stored.username || stored.password) {
                return false;
            }
            if (!runtimeOrigin || runtimeOrigin === "null") {
                return Boolean(DEV_HOSTS[stored.hostname]);
            }
            var runtime = new URL(runtimeOrigin);
            if (stored.hostname === runtime.hostname) {
                return true;
            }
            return Boolean(DEV_HOSTS[runtime.hostname]) && Boolean(DEV_HOSTS[stored.hostname]);
        } catch (_err) {
            return false;
        }
    }

    function getApiBaseUrl() {
        var storedOrigin = localStorage.getItem("auth_origin") || "";
        var runtimeOrigin = window.location.origin && window.location.origin !== "null"
            ? window.location.origin.replace(/\/$/, "")
            : "";

        if (storedOrigin && canUseStoredOrigin(storedOrigin, runtimeOrigin)) {
            var normalizedStored = storedOrigin.replace(/\/$/, "");
            if (normalizedStored !== storedOrigin) {
                localStorage.setItem("auth_origin", normalizedStored);
            }
            return normalizedStored;
        }
        if (storedOrigin) {
            localStorage.removeItem("auth_origin");
        }
        if (runtimeOrigin) {
            return runtimeOrigin;
        }
        return "http://localhost:3001";
    }

    function buildUrl(path) {
        return getApiBaseUrl() + path;
    }

    async function rawRequest(path, options) {
        var response = await fetch(buildUrl(path), options);
        var payload = await response.json().catch(function () {
            return {};
        });

        return {
            response: response,
            payload: payload,
        };
    }

    async function refreshAccessToken() {
        if (refreshPromise) {
            return refreshPromise;
        }

        refreshPromise = (async function () {
            var refreshToken = localStorage.getItem("auth_refresh_token");
            if (!refreshToken) {
                clearSessionStorage();
                dispatchSessionExpired("登录状态已失效，请重新登录");
                throw new Error("登录状态已失效，请重新登录");
            }

            var result = await rawRequest("/api/v1/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: refreshToken }),
            });

            if (!result.response.ok || (result.payload && result.payload.ok === false)) {
                clearSessionStorage();
                dispatchSessionExpired(result.payload && result.payload.message ? result.payload.message : "登录状态已失效，请重新登录");
                throw new Error(result.payload && result.payload.message ? result.payload.message : "登录状态已失效，请重新登录");
            }

            var data = result.payload && result.payload.data ? result.payload.data : {};
            if (data.accessToken) {
                localStorage.setItem("auth_access_token", data.accessToken);
            }
            if (data.refreshToken) {
                localStorage.setItem("auth_refresh_token", data.refreshToken);
            }
        })();

        try {
            await refreshPromise;
        } finally {
            refreshPromise = null;
        }
    }

    async function request(path, options) {
        var result = await rawRequest(path, options);
        var response = result.response;
        var payload = result.payload;

        if (response.status === 401 && path !== "/api/v1/auth/refresh") {
            try {
                await refreshAccessToken();
            } catch (_err) {
                var authErr = new Error("登录状态已失效，请重新登录");
                authErr.code = UNAUTH_CODE;
                throw authErr;
            }
            result = await rawRequest(path, Object.assign({}, options || {}, {
                headers: authHeaders(options && options.headers ? options.headers : {}),
            }));
            response = result.response;
            payload = result.payload;
        }

        if (!response.ok || (payload && payload.ok === false)) {
            throw buildApiError(path, response, payload);
        }

        return payload;
    }

    function buildApiError(path, response, payload) {
        var error = new Error(payload && payload.message ? payload.message : "请求失败");
        error.payload = payload;
        error.response = response;
        error.code = payload && payload.code ? payload.code : "";
        if (error.code === FORCE_CHANGE_CODE) {
            localStorage.setItem("auth_force_change_password", "true");
            window.dispatchEvent(new CustomEvent("linksee:force-change-password", {
                detail: {
                    code: error.code,
                    message: "首次登录需先修改密码",
                    path: path,
                    status: response.status,
                },
            }));
        }
        if (error.code === UNAUTH_CODE || response.status === 401) {
            clearSessionStorage();
            dispatchSessionExpired(error.message || "登录状态已失效，请重新登录");
        }
        return error;
    }

    function clearSessionStorage() {
        localStorage.removeItem("auth_access_token");
        localStorage.removeItem("auth_refresh_token");
        localStorage.removeItem("auth_user_id");
        localStorage.removeItem("auth_role");
        localStorage.removeItem("auth_real_name");
        localStorage.removeItem("auth_bio");
        localStorage.removeItem("auth_avatar_url");
        localStorage.removeItem("auth_force_change_password");
    }

    function dispatchSessionExpired(message) {
        window.dispatchEvent(new CustomEvent("linksee:session-expired", {
            detail: {
                code: UNAUTH_CODE,
                message: message || "登录状态已失效，请重新登录",
            },
        }));
    }

    async function requestBlob(path, options) {
        var requestOptions = Object.assign({}, options || {}, {
            headers: authHeaders(options && options.headers ? options.headers : {}),
        });
        var response = await fetch(buildUrl(path), requestOptions);

        if (response.status === 401 && path !== "/api/v1/auth/refresh") {
            await refreshAccessToken();
            requestOptions = Object.assign({}, options || {}, {
                headers: authHeaders(options && options.headers ? options.headers : {}),
            });
            response = await fetch(buildUrl(path), requestOptions);
        }

        if (!response.ok) {
            var payload = await response.json().catch(function () { return {}; });
            throw buildApiError(path, response, payload);
        }
        return response.blob();
    }

    function authHeaders(extraHeaders) {
        var headers = Object.assign({}, extraHeaders || {});
        var token = localStorage.getItem("auth_access_token");
        if (token) {
            headers.Authorization = "Bearer " + token;
        }
        return headers;
    }

    window.linkseeApi = {
        getApiBaseUrl: getApiBaseUrl,
        request: request,
        authHeaders: authHeaders,
        getJson: function (path) {
            return request(path, { headers: authHeaders() });
        },
        postJson: function (path, body) {
            return request(path, {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(body || {}),
            });
        },
        patchJson: function (path, body) {
            return request(path, {
                method: "PATCH",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(body || {}),
            });
        },
        putJson: function (path, body) {
            return request(path, {
                method: "PUT",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(body || {}),
            });
        },
        postForm: function (path, formData) {
            return request(path, {
                method: "POST",
                headers: authHeaders(),
                body: formData,
            });
        },
        getBlob: function (path) {
            return requestBlob(path, {
                method: "GET",
            });
        },
    };
})();
