(function () {
    var refreshPromise = null;

    function getApiBaseUrl() {
        var storedOrigin = localStorage.getItem("auth_origin") || "";
        if (storedOrigin) {
            return storedOrigin.replace(/\/$/, "");
        }
        if (window.location.origin && window.location.origin !== "null") {
            return window.location.origin.replace(/\/$/, "");
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
                throw new Error("登录状态已失效，请重新登录");
            }

            var result = await rawRequest("/api/v1/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: refreshToken }),
            });

            if (!result.response.ok || (result.payload && result.payload.ok === false)) {
                localStorage.removeItem("auth_access_token");
                localStorage.removeItem("auth_refresh_token");
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
            await refreshAccessToken();
            result = await rawRequest(path, Object.assign({}, options || {}, {
                headers: authHeaders(options && options.headers ? options.headers : {}),
            }));
            response = result.response;
            payload = result.payload;
        }

        if (!response.ok || (payload && payload.ok === false)) {
            var error = new Error(payload && payload.message ? payload.message : "请求失败");
            error.payload = payload;
            error.response = response;
            throw error;
        }

        return payload;
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
    };
})();
