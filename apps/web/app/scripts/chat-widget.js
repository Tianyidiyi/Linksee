(function () {
    if (window.linkseeChatWidget) {
        return;
    }

    var state = {
        open: false,
        mode: "list",
        conversations: [],
        selected: null,
        participants: new Map(),
        messages: [],
        me: null,
        unreadTotal: 0,
        position: { left: 24, top: 120 },
        drag: null,
    };

    function css(text) {
        var style = document.createElement("style");
        style.setAttribute("data-linksee-chat-widget", "true");
        style.textContent = text;
        document.head.appendChild(style);
    }

    css(`
        .linksee-chat-launcher {
            position: relative;
            width: 40px;
            height: 40px;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: rgba(255,255,255,.72);
            box-shadow: var(--shadow-sm);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--ink-soft);
            cursor: pointer;
        }
        .linksee-chat-launcher.is-floating {
            position: fixed;
            top: max(18px, env(safe-area-inset-top));
            right: max(18px, env(safe-area-inset-right));
            z-index: 120;
            width: 68px;
            height: 68px;
            background: rgba(255,255,255,.88);
            backdrop-filter: blur(16px);
        }
        .linksee-chat-launcher.is-active { border-color: var(--accent-outline); }
        .linksee-chat-launcher svg { width: 18px; height: 18px; }
        .linksee-chat-launcher.is-floating svg { width: 34px; height: 34px; }
        .linksee-chat-dot {
            position: absolute;
            top: 5px;
            right: 5px;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #1d4ed8;
            box-shadow: 0 0 0 2px rgba(255,255,255,.96);
            display: none;
        }
        .linksee-chat-dot.is-visible { display: block; }
        .linksee-chat-panel {
            position: fixed;
            z-index: 80;
            width: min(1150px, calc(100vw - 32px));
            height: min(850px, calc(100vh - 40px));
            background: rgba(248, 250, 249, 0.94);
            border: 1px solid var(--border);
            box-shadow: 0 32px 90px rgba(15,23,42,.18);
            border-radius: 24px;
            backdrop-filter: blur(22px);
            overflow: hidden;
            display: none;
            left: 24px;
            top: 120px;
        }
        body.linksee-chat-docked-open .workspace {
            justify-content: flex-start;
            padding-right: calc(50vw + 8px);
            transition: padding-right var(--motion-base) var(--ease-standard);
        }
        body.linksee-chat-docked-open .content-container {
            max-width: none;
            margin-left: 0;
            margin-right: 0;
            padding-left: clamp(16px, 2vw, 32px);
            padding-right: clamp(16px, 2vw, 32px);
            transition: padding var(--motion-base) var(--ease-standard);
        }
        body.linksee-chat-docked-open .page-panel {
            width: 100%;
        }
        body.linksee-chat-docked-open .linksee-chat-launcher.is-floating {
            opacity: 0;
            pointer-events: none;
        }
        .linksee-chat-panel.is-docked {
            left: auto !important;
            top: 16px !important;
            right: 16px;
            bottom: 16px;
            width: calc(50vw - 24px);
            height: calc(100vh - 32px);
            border-radius: 28px;
        }
        .linksee-chat-panel.is-open { display: grid; }
        .linksee-chat-panel.is-list { grid-template-columns: 360px minmax(0,1fr); }
        .linksee-chat-panel.is-chat { grid-template-columns: 1fr; }
        .linksee-chat-left {
            border-right: 1px solid var(--border);
            display: grid;
            grid-template-rows: auto 1fr;
            min-width: 0;
            background: rgba(255,255,255,.62);
        }
        .linksee-chat-right {
            display: grid;
            grid-template-rows: auto 1fr auto;
            min-width: 0;
            background: rgba(255,255,255,.54);
        }
        .linksee-chat-header {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            padding:14px 16px;
            border-bottom: 1px solid var(--border);
            cursor: move;
            user-select:none;
        }
        .linksee-chat-header strong { font-size: 15px; }
        .linksee-chat-actions { display:flex; gap:8px; align-items:center; }
        .linksee-chat-icon-btn {
            width:32px;height:32px;border-radius:999px;border:1px solid var(--border);
            background: rgba(255,255,255,.72); cursor:pointer; display:inline-flex;
            align-items:center; justify-content:center; color: var(--ink-soft);
        }
        .linksee-chat-search {
            padding: 12px 14px; border-bottom: 1px solid var(--border);
        }
        .linksee-chat-search input {
            width:100%; padding:10px 12px; border-radius: 12px; border:1px solid var(--border);
            background: rgba(255,255,255,.8); font: inherit;
        }
        .linksee-chat-list { overflow:auto; padding: 10px; display:grid; gap:10px; }
        .linksee-chat-item {
            display:flex; align-items:center; gap:12px; padding:12px; border-radius: 16px;
            border:1px solid transparent; cursor:pointer; background: rgba(255,255,255,.7);
        }
        .linksee-chat-item.is-active { border-color: var(--accent-outline); background: rgba(15,118,110,.08); }
        .linksee-chat-avatar { width:46px; height:46px; border-radius: 50%; overflow:hidden; flex:none; background: linear-gradient(135deg,var(--accent),var(--accent-bright)); }
        .linksee-chat-avatar img { width:100%; height:100%; object-fit:cover; }
        .linksee-chat-item-meta { min-width:0; flex:1; display:grid; gap:4px; }
        .linksee-chat-item-meta strong, .linksee-chat-item-meta span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .linksee-chat-badge {
            display:inline-flex; align-items:center; justify-content:center; min-width: 24px; height: 24px; padding:0 8px;
            border-radius:999px; background: rgba(37,99,235,.14); color: #1d4ed8; font-size:12px; font-weight:700;
        }
        .linksee-chat-empty { display:grid; place-items:center; color: var(--muted); padding: 32px 20px; text-align:center; }
        .linksee-chat-stream { overflow:auto; padding: 18px; display:grid; gap: 14px; align-content:start; }
        .linksee-chat-bubble-row { display:flex; gap: 10px; align-items:flex-end; }
        .linksee-chat-bubble-row.me { justify-content:flex-end; }
        .linksee-chat-bubble {
            max-width: min(72%, 640px); border-radius: 18px; padding: 12px 14px; background:#fff; border:1px solid var(--border);
            box-shadow: var(--shadow-sm);
        }
        .linksee-chat-bubble.me { background: linear-gradient(135deg, rgba(15,118,110,.12), rgba(45,212,191,.18)); }
        .linksee-chat-bubble-head { display:flex; align-items:center; gap:8px; margin-bottom: 6px; font-size: 12px; color: var(--muted-strong); }
        .linksee-chat-bubble-head img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
        .linksee-chat-composer { padding: 14px 16px; border-top: 1px solid var(--border); display:grid; gap:10px; }
        .linksee-chat-composer textarea {
            width:100%; min-height: 86px; resize: vertical; border-radius: 16px; border:1px solid var(--border);
            padding: 12px; background: rgba(255,255,255,.82); font: inherit;
        }
        .linksee-chat-mini { font-size: 12px; color: var(--muted-strong); }
        @media (max-width: 1024px) {
            body.linksee-chat-docked-open .workspace { padding-right: 0; }
            body.linksee-chat-docked-open .content-container {
                padding-left: var(--space-5);
                padding-right: var(--space-5);
            }
            .linksee-chat-panel.is-docked {
                left: 8px !important;
                right: auto;
                top: 8px !important;
                bottom: auto;
                width: calc(100vw - 16px);
                height: calc(100vh - 16px);
                border-radius: 24px;
            }
        }
        @media (max-width: 860px) {
            .linksee-chat-panel { width: calc(100vw - 16px); height: calc(100vh - 16px); left: 8px; top: 8px; }
            .linksee-chat-panel.is-list { grid-template-columns: 1fr; }
            .linksee-chat-left { display: none; }
        }
    `);

    function q(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qs(selector, root) {
        return Array.from((root || document).querySelectorAll(selector));
    }

    function defaultAvatar() {
        return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239CA3AF'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    }

    function avatarOf(user) {
        return (user && user.profile && user.profile.avatarUrl) || defaultAvatar();
    }

    function nameOf(user) {
        return (user && user.profile && user.profile.realName) || (user && user.id) || "未知用户";
    }

    function getAuth() {
        return {
            userId: localStorage.getItem("auth_user_id") || "",
            realName: localStorage.getItem("auth_real_name") || "",
            role: localStorage.getItem("auth_role") || "",
            token: localStorage.getItem("auth_access_token") || "",
        };
    }

    function getDashboardRolePage(role) {
        return {
            academic: "academic-dashboard.html",
            teacher: "teacher-dashboard.html",
            assistant: "assistant-dashboard.html",
            student: "student-dashboard.html",
        }[role] || "dashboard.html";
    }

    function getOrigin() {
        return window.location.origin && window.location.origin !== "null" ? window.location.origin : "http://localhost:3001";
    }

    function getBasePath() {
        return window.location.pathname.includes("/app/") ? "/app" : "";
    }

    function getUrl(path) {
        return getOrigin() + getBasePath() + path;
    }

    function createLauncher(target, floating) {
        var button = document.createElement("button");
        button.className = "linksee-chat-launcher" + (floating ? " is-floating" : "");
        button.type = "button";
        button.setAttribute("aria-label", "消息");
        button.setAttribute("title", "打开聊天消息");
        button.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='5' width='18' height='14' rx='2'/><path d='m3 7 9 6 9-6'/></svg><span class='linksee-chat-dot'></span>";
        target.appendChild(button);
        return button;
    }

    function createPanel() {
        var panel = document.createElement("section");
        panel.className = "linksee-chat-panel";
        panel.innerHTML = `
            <div class="linksee-chat-left">
                <div class="linksee-chat-header" data-drag-handle="true">
                    <div><strong>消息</strong><div class="linksee-chat-mini">群聊列表</div></div>
                </div>
                <div class="linksee-chat-search"><input type="text" placeholder="搜索群聊" data-role="search" /></div>
                <div class="linksee-chat-list" data-role="conversation-list"></div>
            </div>
            <div class="linksee-chat-right">
                <div class="linksee-chat-header" data-drag-handle="true">
                    <div>
                        <strong data-role="chat-title">请选择群聊</strong>
                        <div class="linksee-chat-mini" data-role="chat-meta">--</div>
                    </div>
                    <div class="linksee-chat-actions">
                        <button class="linksee-chat-icon-btn" data-action="back" title="返回群聊列表">←</button>
                        <button class="linksee-chat-icon-btn" data-action="close" title="关闭">×</button>
                    </div>
                </div>
                <div class="linksee-chat-stream" data-role="message-stream">
                    <div class="linksee-chat-empty">请选择一个群聊开始聊天</div>
                </div>
                <div class="linksee-chat-composer">
                    <textarea data-role="composer" placeholder="输入消息，Enter 发送，Shift+Enter 换行"></textarea>
                    <div class="action-row">
                        <button class="btn btn-primary" data-action="send">发送</button>
                        <button class="btn btn-ghost" data-action="read">标记已读</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(panel);
        return panel;
    }

    function setDotVisible(visible) {
        var dot = q(".linksee-chat-launcher .linksee-chat-dot");
        if (dot) {
            dot.classList.toggle("is-visible", Boolean(visible));
        }
    }

    async function loadMe() {
        if (!window.linkseeApi) return null;
        var payload = await window.linkseeApi.getJson("/api/v1/users/me");
        state.me = payload.data || null;
        if (state.me && state.me.profile && state.me.profile.realName) {
            localStorage.setItem("auth_real_name", state.me.profile.realName);
        }
        return state.me;
    }

    async function loadConversations() {
        if (!window.linkseeApi) return [];
        var payload = await window.linkseeApi.getJson("/api/v1/conversations");
        state.conversations = Array.isArray(payload.data) ? payload.data : [];
        state.unreadTotal = state.conversations.reduce((sum, row) => sum + (Number(row.unreadCount) || 0), 0);
        setDotVisible(state.unreadTotal > 0);
        return state.conversations;
    }

    function renderConversations(filterText) {
        var list = q("[data-role='conversation-list']", state.panel);
        var rows = state.conversations.filter(function (row) {
            if (!filterText) return true;
            var text = (row.title || row.roomKey || "").toLowerCase();
            return text.indexOf(filterText.toLowerCase()) !== -1;
        });
        if (!rows.length) {
            list.innerHTML = '<div class="linksee-chat-empty">暂无会话</div>';
            return;
        }
        list.innerHTML = rows.map(function (row) {
            return [
                '<div class="linksee-chat-item' + (state.selected && String(state.selected.id) === String(row.id) ? ' is-active' : '') + '" data-id="' + row.id + '">',
                '<div class="linksee-chat-avatar"><img alt="" src="' + avatarOf(row.lastMessage && row.lastMessage.sender) + '"></div>',
                '<div class="linksee-chat-item-meta">',
                '<strong>' + escapeHtml(row.title || row.roomKey) + '</strong>',
                '<span class="muted">' + escapeHtml(row.lastMessage && row.lastMessage.content ? row.lastMessage.content : "暂无消息") + '</span>',
                '</div>',
                row.unreadCount ? '<span class="linksee-chat-badge">' + row.unreadCount + '</span>' : '',
                '</div>',
            ].join("");
        }).join("");

        qs(".linksee-chat-item", list).forEach(function (item) {
            item.addEventListener("click", function () {
                var target = state.conversations.find(function (row) { return String(row.id) === String(item.getAttribute("data-id")); });
                if (target) {
                    openConversation(target);
                }
            });
        });
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    async function loadParticipants() {
        state.participants = new Map();
        if (!state.selected) return;
        var path = state.selected.scopeType === "group"
            ? "/api/v1/groups/" + encodeURIComponent(state.selected.scopeId) + "/members"
            : "/api/v1/courses/" + encodeURIComponent(state.selected.scopeId) + "/members";
        var payload = await window.linkseeApi.getJson(path);
        var rows = Array.isArray(payload.data) ? payload.data : [];
        rows.forEach(function (row) {
            var user = row.user || row.assistant || {};
            var id = user.id || row.userId || row.assistantUserId;
            if (id) {
                state.participants.set(String(id), user);
            }
        });
    }

    async function loadMessages() {
        if (!state.selected) {
            state.messages = [];
            renderMessages();
            return;
        }
        var path = state.selected.scopeType === "group"
            ? "/api/v1/groups/" + encodeURIComponent(state.selected.scopeId) + "/messages"
            : "/api/v1/courses/" + encodeURIComponent(state.selected.scopeId) + "/messages";
        var payload = await window.linkseeApi.getJson(path);
        state.messages = Array.isArray(payload.data) ? payload.data : [];
        renderMessages();
    }

    function renderMessages() {
        var stream = q("[data-role='message-stream']", state.panel);
        var title = q("[data-role='chat-title']", state.panel);
        var meta = q("[data-role='chat-meta']", state.panel);
        if (!state.selected) {
            stream.innerHTML = '<div class="linksee-chat-empty">请选择一个群聊开始聊天</div>';
            title.textContent = "请选择群聊";
            meta.textContent = "--";
            return;
        }
        title.textContent = state.selected.title || state.selected.roomKey;
        meta.textContent = state.selected.scopeType === "group" ? "群聊" : "课程群聊";

        if (!state.messages.length) {
            stream.innerHTML = '<div class="linksee-chat-empty">当前没有消息</div>';
            return;
        }

        stream.innerHTML = state.messages.map(function (row) {
            var me = row.senderId === getAuth().userId;
            var user = state.participants.get(String(row.senderId)) || { id: row.senderId, profile: { realName: row.senderId, avatarUrl: defaultAvatar() } };
            return [
                '<div class="linksee-chat-bubble-row' + (me ? ' me' : '') + '">',
                me ? '' : '<div class="linksee-chat-avatar" style="width:40px;height:40px"><img alt="" src="' + avatarOf(user) + '"></div>',
                '<div class="linksee-chat-bubble' + (me ? ' me' : '') + '">',
                '<div class="linksee-chat-bubble-head">',
                me ? '' : '<img alt="" src="' + avatarOf(user) + '">',
                '<strong>' + escapeHtml(nameOf(user)) + '</strong>',
                '<span>' + new Date(row.createdAt).toLocaleString("zh-CN", { hour12: false }) + '</span>',
                '</div>',
                '<div>' + escapeHtml(row.content || "") + '</div>',
                '</div>',
                me ? '<div class="linksee-chat-avatar" style="width:40px;height:40px"><img alt="" src="' + avatarOf(state.me) + '"></div>' : '',
                '</div>',
            ].join("");
        }).join("");
        stream.scrollTop = stream.scrollHeight;
    }

    async function openConversation(row) {
        state.selected = row;
        renderConversations(q("[data-role='search']", state.panel).value.trim());
        state.mode = "chat";
        state.panel.classList.remove("is-list");
        state.panel.classList.add("is-chat");
        await loadParticipants();
        await loadMessages();
    }

    function backToList() {
        state.mode = "list";
        state.panel.classList.remove("is-chat");
        state.panel.classList.add("is-list");
        renderConversations(q("[data-role='search']", state.panel).value.trim());
        renderMessages();
    }

    async function sendMessage() {
        if (!state.selected) return;
        var composer = q("[data-role='composer']", state.panel);
        var text = composer.value.trim();
        if (!text) return;
        var path = state.selected.scopeType === "group"
            ? "/api/v1/groups/" + encodeURIComponent(state.selected.scopeId) + "/messages"
            : "/api/v1/courses/" + encodeURIComponent(state.selected.scopeId) + "/messages";
        await window.linkseeApi.postJson(path, { type: "text", content: text });
        composer.value = "";
        await loadConversations();
        await loadMessages();
    }

    async function markRead() {
        if (!state.selected || !state.selected.lastMessage) return;
        await window.linkseeApi.postJson("/api/v1/conversations/" + encodeURIComponent(state.selected.id) + "/read", {
            messageId: state.selected.lastMessage.id,
        });
        await loadConversations();
    }

    function startDrag(event) {
        if (state.panel && state.panel.classList.contains("is-docked")) return;
        var header = event.target.closest("[data-drag-handle='true']");
        if (!header) return;
        state.drag = {
            startX: event.clientX,
            startY: event.clientY,
            left: state.position.left,
            top: state.position.top,
        };
        event.preventDefault();
    }

    function moveDrag(event) {
        if (!state.drag) return;
        var dx = event.clientX - state.drag.startX;
        var dy = event.clientY - state.drag.startY;
        state.position.left = Math.max(8, state.drag.left + dx);
        state.position.top = Math.max(8, state.drag.top + dy);
        state.panel.style.left = state.position.left + "px";
        state.panel.style.top = state.position.top + "px";
    }

    function endDrag() {
        state.drag = null;
    }

    function ensureWidget() {
        var topActions = q(".top-actions");
        if (!state.launcher) {
            state.launcher = createLauncher(topActions || document.body, !topActions);
            state.launcher.addEventListener("click", function () {
                togglePanel();
            });
        }
        if (!state.panel) {
            state.panel = createPanel();
            state.panel.style.left = state.position.left + "px";
            state.panel.style.top = state.position.top + "px";
            state.panel.addEventListener("pointerdown", startDrag);
            window.addEventListener("pointermove", moveDrag);
            window.addEventListener("pointerup", endDrag);

            state.panel.addEventListener("click", function (event) {
                var action = event.target && event.target.getAttribute && event.target.getAttribute("data-action");
                if (!action) return;
                if (action === "close") closePanel();
                if (action === "back") backToList();
                if (action === "send") sendMessage().catch(function () {});
                if (action === "read") markRead().catch(function () {});
            });

            var search = q("[data-role='search']", state.panel);
            search.addEventListener("input", function () {
                renderConversations(search.value.trim());
            });
            var composer = q("[data-role='composer']", state.panel);
            composer.addEventListener("keydown", function (event) {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage().catch(function () {});
                }
            });
        }
    }

    function openPanel() {
        state.open = true;
        ensureWidget();
        document.body.classList.add("linksee-chat-docked-open");
        state.panel.classList.add("is-open");
        state.panel.classList.add("is-docked");
        state.launcher.classList.add("is-active");
        state.launcher.classList.add("has-open");
        state.panel.classList.toggle("is-list", state.mode === "list");
        state.panel.classList.toggle("is-chat", state.mode === "chat");
        state.panel.style.left = state.position.left + "px";
        state.panel.style.top = state.position.top + "px";
        loadConversations()
            .then(function () {
                renderConversations(q("[data-role='search']", state.panel).value.trim());
                if (state.selected) {
                    return loadParticipants().then(loadMessages);
                }
            })
            .catch(function () {});
    }

    function closePanel() {
        state.open = false;
        document.body.classList.remove("linksee-chat-docked-open");
        if (state.panel) {
            state.panel.classList.remove("is-open");
            state.panel.classList.remove("is-docked");
        }
        if (state.launcher) {
            state.launcher.classList.remove("is-active");
        }
    }

    function togglePanel() {
        ensureWidget();
        if (state.open) {
            closePanel();
        } else {
            openPanel();
        }
    }

    function init() {
        if (!getAuth().token) return;
        ensureWidget();
        loadMe().catch(function () {});
        loadConversations().catch(function () {});
        setDotVisible(false);
    }

    window.linkseeChatWidget = {
        open: openPanel,
        close: closePanel,
        toggle: togglePanel,
        refresh: function () {
            return loadConversations();
        },
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
