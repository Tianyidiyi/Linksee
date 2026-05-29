(function () {
    if (window.linkseeChatWidget) return;

    var state = {
        open: false,
        mode: "list",
        conversations: [],
        selected: null,
        participants: [],
        participantsMap: new Map(),
        messages: [],
        me: null,
        unreadTotal: 0,
        replyTo: null,
        mention: { open: false, start: -1, keyword: "", options: [], index: 0 },
    };

    function q(selector, root) { return (root || document).querySelector(selector); }
    function qs(selector, root) { return Array.from((root || document).querySelectorAll(selector)); }
    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }
    function showToast(msg, danger) {
        var host = q("[data-chat-toast-host]", state.panel);
        if (!host) return;
        var el = document.createElement("div");
        el.className = "chat-toast" + (danger ? " danger" : "");
        el.textContent = msg;
        host.appendChild(el);
        setTimeout(function () {
            el.style.opacity = "0";
            setTimeout(function () { el.remove(); }, 220);
        }, 2200);
    }
    function defaultAvatar() {
        return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239CA3AF'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    }
    function userName(user) {
        return (user && user.profile && user.profile.realName) || (user && user.id) || "未知成员";
    }
    function userAvatar(user) {
        return (user && user.profile && user.profile.avatarUrl) || defaultAvatar();
    }
    function auth() {
        return {
            token: localStorage.getItem("auth_access_token") || "",
            userId: localStorage.getItem("auth_user_id") || "",
            role: localStorage.getItem("auth_role") || "",
        };
    }
    function isStaff() {
        var role = auth().role;
        return role === "teacher" || role === "assistant" || role === "academic";
    }
    function mentionName(id) {
        var u = state.participantsMap.get(String(id));
        return u ? userName(u) : id;
    }
    function messagePath(scopeType, scopeId) {
        return scopeType === "group"
            ? "/api/v1/groups/" + encodeURIComponent(scopeId) + "/messages"
            : "/api/v1/courses/" + encodeURIComponent(scopeId) + "/messages";
    }
    function announcementPath(scopeType, scopeId) {
        return scopeType === "group"
            ? "/api/v1/groups/" + encodeURIComponent(scopeId) + "/announcements"
            : "/api/v1/courses/" + encodeURIComponent(scopeId) + "/announcements";
    }
    function searchPath(scopeType, scopeId, keyword) {
        return messagePath(scopeType, scopeId) + "/search?q=" + encodeURIComponent(keyword);
    }
    function parseMentions(content) {
        var set = new Set();
        (content.match(/@([A-Za-z0-9_\-\u4e00-\u9fa5]+)/g) || []).forEach(function (m) {
            var raw = m.slice(1);
            state.participants.forEach(function (p) {
                if (p.profile && p.profile.realName === raw) set.add(p.id);
            });
        });
        return Array.from(set);
    }

    function css(text) {
        var style = document.createElement("style");
        style.textContent = text;
        document.head.appendChild(style);
    }

    css(`
        .linksee-chat-launcher{position:fixed;top:20px;right:20px;z-index:120;width:62px;height:62px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,.9);display:grid;place-items:center;cursor:pointer}
        .linksee-chat-launcher svg{width:30px;height:30px}
        .linksee-chat-dot{position:absolute;right:7px;top:7px;width:9px;height:9px;border-radius:50%;background:#2563eb;display:none}
        .linksee-chat-dot.show{display:block}
        body.linksee-chat-docked-open .workspace{padding-right:calc(360px + 20px);transition:padding-right .2s ease}
        body.linksee-chat-docked-open.chat-expanded .workspace{padding-right:calc(700px + 20px)}
        .linksee-chat-panel{position:fixed;right:16px;top:16px;bottom:16px;width:min(340px,calc(100vw - 24px));z-index:119;border:1px solid var(--border);background:#f8fafc;border-radius:18px;display:none;grid-template-rows:auto auto 1fr auto;overflow:hidden;transition:width .2s ease}
        .linksee-chat-panel.expanded{width:min(680px,calc(100vw - 24px))}
        .linksee-chat-panel.open{display:grid}
        .chat-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);background:#fff}
        .chat-head strong{font-size:15px}
        .chat-body{overflow:auto;padding:14px 12px;display:grid;gap:10px;align-content:start;background:#f3f6fb}
        .chat-row{display:flex;gap:8px;align-items:flex-end}
        .chat-row.me{justify-content:flex-end}
        .chat-avatar{width:36px;height:36px;border-radius:50%;overflow:hidden;background:#dbe3ee;flex:none}
        .chat-avatar img{width:100%;height:100%;object-fit:cover}
        .chat-msg{max-width:78%;background:#fff;border:1px solid #dde3eb;border-radius:12px;padding:8px 10px;position:relative}
        .chat-msg.me{background:#e9f7ef;border-color:#c8ebd5}
        .chat-meta{font-size:12px;color:#64748b;display:flex;gap:8px;margin-bottom:4px}
        .chat-del{color:#94a3b8;font-style:italic}
        .chat-files a{display:block;color:#0f766e;text-decoration:none}
        .chat-quote{margin:4px 0 6px;padding:6px 8px;border-left:3px solid #cbd5e1;background:#f8fafc;color:#475569;font-size:12px}
        .chat-toolbar{display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid #e2e8f0;background:transparent}
        .chat-tool{border:none;background:transparent;display:inline-flex;gap:6px;align-items:center;color:#334155;cursor:pointer;padding:4px 6px;border-radius:8px}
        .chat-tool:hover{background:#f1f5f9}
        .chat-composer{margin-top:auto;padding:0;background:#fff;border-top:1px solid #e2e8f0;position:sticky;bottom:0;z-index:2}
        .chat-reply{display:none;margin-bottom:8px;padding:7px 10px;background:#f1f5f9;border-radius:8px;font-size:12px;color:#475569}
        .chat-reply.show{display:block}
        .chat-box{border:none;border-radius:0;background:#fff;position:relative;min-height:150px;display:grid;grid-template-rows:auto 1fr}
        .chat-box textarea{width:100%;min-height:148px;border:none;outline:none;resize:none;padding:10px 12px 54px;font:inherit;background:transparent}
        .chat-send{position:absolute;right:12px;bottom:12px;width:56px;height:36px;border:none;border-radius:12px;background:#0f766e;color:#fff;cursor:pointer;font-weight:700}
        .chat-drop{position:absolute;inset:0;background:rgba(15,118,110,.08);border:2px dashed #0f766e;border-radius:0;display:none;place-items:center;color:#0f766e;font-weight:600}
        .chat-drop.show{display:grid}
        .chat-mention{position:absolute;left:10px;bottom:44px;width:240px;max-height:190px;overflow:auto;border:1px solid #dbe3eb;background:#fff;border-radius:10px;box-shadow:0 12px 28px rgba(15,23,42,.14);display:none;z-index:3}
        .chat-mention.show{display:block}
        .chat-mention-item{padding:8px 10px;display:flex;gap:8px;align-items:center;cursor:pointer}
        .chat-mention-item.active,.chat-mention-item:hover{background:#f1f5f9}
        .chat-menu{position:fixed;z-index:140;min-width:120px;border:1px solid #d8e0ea;background:#fff;border-radius:10px;box-shadow:0 12px 24px rgba(15,23,42,.18);display:none}
        .chat-menu button{width:100%;border:none;background:transparent;text-align:left;padding:8px 10px;cursor:pointer}
        .chat-menu button:hover{background:#f1f5f9}
        .chat-toast-host{position:absolute;right:12px;bottom:150px;display:grid;gap:8px;z-index:130}
        .chat-toast{background:#0f172a;color:#fff;padding:8px 10px;border-radius:8px;font-size:12px;opacity:.95;transition:opacity .2s}
        .chat-toast.danger{background:#b91c1c}
        .chat-search-box{display:none;padding:8px 12px;border-bottom:1px solid var(--border);background:#fff}
        .chat-search-box.show{display:flex;gap:8px}
        .chat-search-box input{flex:1;border:1px solid #d5deea;border-radius:9px;padding:8px 10px}
        .chat-conversation-item{display:grid;gap:4px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer}
        .chat-conversation-item:hover{border-color:#b6c4d5}
        .chat-conversation-item .line2{font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .chat-box .chat-toolbar{position:static;left:auto;right:auto;top:auto;padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#fff}
    `);

    function createLauncher() {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "linksee-chat-launcher";
        btn.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><rect x='3' y='5' width='18' height='14' rx='2'></rect><path d='m3 7 9 6 9-6'></path></svg><span class='linksee-chat-dot'></span>";
        document.body.appendChild(btn);
        return btn;
    }

    function createPanel() {
        var panel = document.createElement("section");
        panel.className = "linksee-chat-panel";
        panel.innerHTML = `
            <div class="chat-head">
                <div><strong data-chat-title>消息</strong><div class="muted tiny" data-chat-subtitle>选择会话</div></div>
                <div class="action-row">
                    <button class="btn btn-ghost" data-chat-action="back">列表</button>
                    <button class="btn btn-ghost" data-chat-action="close">关闭</button>
                </div>
            </div>
            <div class="chat-search-box" data-chat-search-box>
                <input type="text" placeholder="搜索历史消息" data-chat-search-input>
                <button class="btn btn-ghost" data-chat-action="search-run">搜索</button>
                <button class="btn btn-ghost" data-chat-action="search-exit">退出</button>
            </div>
            <div class="chat-body" data-chat-stream></div>
            <div class="chat-composer">
                <div class="chat-reply" data-chat-reply></div>
                <div class="chat-box" data-chat-drop-zone>
                    <div class="chat-toolbar">
                        <button class="chat-tool" data-chat-action="announcement">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 11 14-5v12L3 13z"></path><path d="M11 14v5"></path></svg>
                            <span>群公告</span>
                        </button>
                        <button class="chat-tool" data-chat-action="history">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
                            <span>历史记录</span>
                        </button>
                    </div>
                    <textarea data-chat-composer placeholder="输入消息，回车发送，Shift+Enter换行"></textarea>
                    <div class="chat-drop" data-chat-drop-hint>松开即可上传文件</div>
                    <div class="chat-mention" data-chat-mention></div>
                    <button type="button" class="chat-send" data-chat-action="send">发送</button>
                </div>
            </div>
            <div class="chat-menu" data-chat-menu></div>
            <div class="chat-toast-host" data-chat-toast-host></div>`;
        document.body.appendChild(panel);
        return panel;
    }

    function setUnread(visible) {
        var dot = q(".linksee-chat-dot", state.launcher);
        if (dot) dot.classList.toggle("show", Boolean(visible));
    }

    function syncTopActionsHidden(hidden) {
        var nodes = [
            q(".top-actions"),
            q("#studentTodoWidget"),
            q("#studentTodoToggle"),
            q("#studentTodoPopover"),
        ].filter(Boolean);

        nodes.forEach(function (node) {
            if (!node) return;
            if (hidden) {
                if (!node.dataset.chatPrevDisplay) {
                    node.dataset.chatPrevDisplay = node.style.display || "";
                }
                if (!node.dataset.chatPrevVisibility) {
                    node.dataset.chatPrevVisibility = node.style.visibility || "";
                }
                if (!node.dataset.chatPrevPointer) {
                    node.dataset.chatPrevPointer = node.style.pointerEvents || "";
                }
                node.style.display = "none";
                node.style.visibility = "hidden";
                node.style.pointerEvents = "none";
            } else {
                node.style.display = node.dataset.chatPrevDisplay || "";
                node.style.visibility = node.dataset.chatPrevVisibility || "";
                node.style.pointerEvents = node.dataset.chatPrevPointer || "";
            }
        });

        if (state.launcher) {
            state.launcher.style.display = hidden ? "none" : "";
            state.launcher.style.visibility = hidden ? "hidden" : "";
            state.launcher.style.pointerEvents = hidden ? "none" : "";
        }
    }

    function setPanelMode(mode) {
        state.mode = mode === "chat" ? "chat" : "list";
        if (!state.panel) return;
        state.panel.classList.toggle("expanded", state.mode === "chat");
        document.body.classList.toggle("chat-expanded", state.mode === "chat");
        var composer = q(".chat-composer", state.panel);
        var searchBox = q("[data-chat-search-box]", state.panel);
        var backBtn = q("[data-chat-action='back']", state.panel);
        if (composer) composer.style.display = state.mode === "chat" ? "block" : "none";
        if (searchBox) searchBox.classList.remove("show");
        if (backBtn) backBtn.style.display = state.mode === "chat" ? "inline-flex" : "none";
    }

    function normalizeParticipant(row) {
        var user = row.user || row.assistant || row.teacher || row;
        return {
            id: String(user.id || row.userId || row.assistantUserId || row.teacherUserId || ""),
            profile: {
                realName: (user.profile && user.profile.realName) || user.realName || user.name || String(user.id || ""),
                avatarUrl: (user.profile && user.profile.avatarUrl) || user.avatarUrl || "",
            },
        };
    }

    async function loadMe() {
        var payload = await window.linkseeApi.getJson("/api/v1/users/me");
        state.me = payload.data || null;
    }
    async function loadConversations() {
        var payload = await window.linkseeApi.getJson("/api/v1/conversations");
        state.conversations = Array.isArray(payload.data) ? payload.data : [];
        if (!state.conversations.length && auth().role === "student") {
            state.conversations = [{
                id: "mock-student-conv",
                scopeType: "mock",
                scopeId: "mock-student",
                title: "虚拟测试会话",
                roomKey: "mock:student",
                unreadCount: 0,
                lastMessage: {
                    id: "mock-msg-0",
                    senderId: "system",
                    content: "这是用于前端测试的虚拟会话，可直接发送消息、回复、右键删除。",
                    createdAt: new Date().toISOString(),
                },
            }];
        }
        state.unreadTotal = state.conversations.reduce(function (s, c) { return s + (Number(c.unreadCount) || 0); }, 0);
        setUnread(state.unreadTotal > 0);
    }
    async function loadParticipants() {
        state.participants = [];
        state.participantsMap.clear();
        if (!state.selected) return;
        if (state.selected.scopeType === "mock") {
            var meId = auth().userId || "student";
            state.participants = [
                { id: "system", profile: { realName: "系统助手", avatarUrl: "" } },
                { id: meId, profile: { realName: localStorage.getItem("auth_real_name") || meId, avatarUrl: localStorage.getItem("auth_avatar_url") || "" } },
            ];
            state.participants.forEach(function (u) { state.participantsMap.set(String(u.id), u); });
            return;
        }
        var path = state.selected.scopeType === "group"
            ? "/api/v1/groups/" + encodeURIComponent(state.selected.scopeId) + "/members"
            : "/api/v1/courses/" + encodeURIComponent(state.selected.scopeId) + "/members";
        var payload = await window.linkseeApi.getJson(path);
        var rows = Array.isArray(payload.data) ? payload.data : [];
        rows.map(normalizeParticipant).forEach(function (u) {
            if (!u.id) return;
            state.participants.push(u);
            state.participantsMap.set(u.id, u);
        });
    }
    async function loadMessages() {
        if (!state.selected) {
            state.messages = [];
            return;
        }
        if (state.selected.scopeType === "mock") {
            if (!Array.isArray(state.selected.__mockMessages)) {
                state.selected.__mockMessages = [{
                    id: "mock-msg-0",
                    senderId: "system",
                    content: "这是用于前端测试的虚拟会话，可直接发送消息、回复、右键删除。",
                    files: null,
                    mentions: [],
                    replyToId: null,
                    createdAt: new Date().toISOString(),
                    deletedAt: null,
                }];
            }
            state.messages = state.selected.__mockMessages.slice();
            return;
        }
        var payload = await window.linkseeApi.getJson(messagePath(state.selected.scopeType, state.selected.scopeId));
        state.messages = Array.isArray(payload.data) ? payload.data.slice().reverse() : [];
    }

    function renderConversationSelector() {
        var stream = q("[data-chat-stream]", state.panel);
        if (!state.conversations.length) {
            stream.innerHTML = "<div class='muted'>暂无会话</div>";
            return;
        }
        stream.innerHTML = state.conversations.map(function (c) {
            return "<div class='chat-conversation-item' data-chat-open='" + c.id + "'>" +
                "<strong>" + escapeHtml(c.title || c.roomKey || ("会话 " + c.id)) + "</strong>" +
                "<div class='line2'>" + escapeHtml((c.lastMessage && c.lastMessage.content) || "暂无消息") + "</div>" +
                (c.unreadCount ? "<div class='line2'>未读 " + c.unreadCount + "</div>" : "") +
                "</div>";
        }).join("");
    }

    function buildReplyQuote(message) {
        if (!message) return "";
        var sender = state.participantsMap.get(String(message.senderId));
        var name = sender ? userName(sender) : message.senderId;
        var snippet = message.content || (message.files ? "[文件消息]" : "[消息]");
        return "回复 " + name + "： " + snippet.slice(0, 80);
    }

    function renderReply() {
        var box = q("[data-chat-reply]", state.panel);
        if (!state.replyTo) {
            box.classList.remove("show");
            box.textContent = "";
            return;
        }
        box.classList.add("show");
        box.textContent = buildReplyQuote(state.replyTo) + "（Esc 取消）";
    }

    function renderMessages() {
        var stream = q("[data-chat-stream]", state.panel);
        var title = q("[data-chat-title]", state.panel);
        var subtitle = q("[data-chat-subtitle]", state.panel);
        if (!state.selected) {
            title.textContent = "消息";
            subtitle.textContent = "请选择会话（点击后展开）";
            setPanelMode("list");
            renderConversationSelector();
            return;
        }
        setPanelMode("chat");
        title.textContent = state.selected.title || state.selected.roomKey || "会话";
        subtitle.textContent = state.selected.scopeType === "group" ? "小组聊天" : "课程聊天";
        if (!state.messages.length) {
            stream.innerHTML = "<div class='muted'>还没有消息，开始聊聊吧。</div>";
            return;
        }

        stream.innerHTML = state.messages.map(function (m) {
            var me = String(m.senderId) === String(auth().userId);
            var sender = state.participantsMap.get(String(m.senderId));
            var deleted = Boolean(m.deletedAt);
            var quoted = state.messages.find(function (x) { return String(x.id) === String(m.replyToId || ""); });
            var mentions = Array.isArray(m.mentions) ? m.mentions.map(function (id) { return "@" + escapeHtml(mentionName(id)); }).join(" ") : "";
            var filesHtml = "";
            if (Array.isArray(m.files) && m.files.length) {
                filesHtml = "<div class='chat-files'>" + m.files.map(function (f, i) {
                    return "<a href='#' data-chat-file='" + escapeHtml(String(m.id)) + ":" + i + "'>" + escapeHtml(f.name || "附件") + "</a>";
                }).join("") + "</div>";
            }
            return [
                "<div class='chat-row" + (me ? " me" : "") + "'>",
                me ? "" : "<div class='chat-avatar'><img src='" + userAvatar(sender) + "' alt=''></div>",
                "<div class='chat-msg" + (me ? " me" : "") + "' data-chat-message-id='" + m.id + "'>",
                "<div class='chat-meta'><strong>" + escapeHtml(sender ? userName(sender) : m.senderId) + "</strong><span>" + new Date(m.createdAt).toLocaleString("zh-CN", { hour12: false }) + "</span></div>",
                quoted ? "<div class='chat-quote'>" + escapeHtml(buildReplyQuote(quoted)) + "</div>" : "",
                deleted ? "<div class='chat-del'>该消息已删除</div>" : ("<div>" + escapeHtml(m.content || "") + "</div>"),
                mentions ? ("<div class='muted tiny'>" + mentions + "</div>") : "",
                deleted ? "" : filesHtml,
                "</div>",
                me ? "<div class='chat-avatar'><img src='" + userAvatar(state.me) + "' alt=''></div>" : "",
                "</div>",
            ].join("");
        }).join("");
        stream.scrollTop = stream.scrollHeight;
    }

    async function openConversationById(id) {
        var target = state.conversations.find(function (c) { return String(c.id) === String(id); });
        if (!target) return;
        state.selected = target;
        state.replyTo = null;
        renderReply();
        await loadParticipants();
        await loadMessages();
        renderMessages();
    }

    function backToList() {
        state.selected = null;
        state.replyTo = null;
        renderReply();
        renderMessages();
    }

    async function sendAnnouncement() {
        if (!state.selected) return showToast("请先选择会话", true);
        if (!isStaff()) return showToast("仅教师/助教可发布公告", true);
        var text = window.prompt("请输入公告内容");
        if (!text || !text.trim()) return;
        if (state.selected.scopeType === "mock") {
            state.selected.__mockMessages.push({
                id: "mock-ann-" + Date.now(),
                senderId: auth().userId || "student",
                content: "【公告】" + text.trim(),
                files: { type: "announcement" },
                mentions: [],
                replyToId: null,
                createdAt: new Date().toISOString(),
                deletedAt: null,
            });
            await loadMessages();
            renderMessages();
            return showToast("公告已发布（mock）");
        }
        await window.linkseeApi.postJson(announcementPath(state.selected.scopeType, state.selected.scopeId), { content: text.trim() });
        showToast("公告已发布");
        await loadMessages();
        renderMessages();
    }

    async function searchHistory() {
        if (!state.selected) return showToast("请先选择会话", true);
        var box = q("[data-chat-search-box]", state.panel);
        box.classList.add("show");
        q("[data-chat-search-input]", box).focus();
    }

    async function runSearch() {
        var input = q("[data-chat-search-input]", state.panel);
        var keyword = (input.value || "").trim();
        if (!keyword) return showToast("请输入关键词", true);
        if (state.selected && state.selected.scopeType === "mock") {
            state.messages = (state.selected.__mockMessages || []).filter(function (m) {
                return String(m.content || "").indexOf(keyword) >= 0;
            });
            renderMessages();
            return showToast("已切换到搜索结果（mock）");
        }
        var payload = await window.linkseeApi.getJson(searchPath(state.selected.scopeType, state.selected.scopeId, keyword));
        state.messages = Array.isArray(payload.data) ? payload.data.slice().reverse() : [];
        renderMessages();
        showToast("已切换到搜索结果");
    }

    async function closeSearch() {
        q("[data-chat-search-box]", state.panel).classList.remove("show");
        q("[data-chat-search-input]", state.panel).value = "";
        await loadMessages();
        renderMessages();
    }

    async function sendText() {
        if (!state.selected) return showToast("请先选择会话", true);
        var ta = q("[data-chat-composer]", state.panel);
        var content = (ta.value || "").trim();
        if (!content) return;
        if (state.selected.scopeType === "mock") {
            var mentionsMock = parseMentions(content);
            state.selected.__mockMessages.push({
                id: "mock-msg-" + Date.now(),
                senderId: auth().userId || "student",
                content: content,
                files: null,
                mentions: mentionsMock,
                replyToId: state.replyTo ? String(state.replyTo.id) : null,
                createdAt: new Date().toISOString(),
                deletedAt: null,
            });
            ta.value = "";
            state.replyTo = null;
            renderReply();
            closeMention();
            await loadMessages();
            renderMessages();
            return;
        }
        var body = { type: "text", content: content };
        var mentions = parseMentions(content);
        if (mentions.length) body.mentions = mentions;
        if (state.replyTo) body.replyToId = String(state.replyTo.id);
        await window.linkseeApi.postJson(messagePath(state.selected.scopeType, state.selected.scopeId), body);
        ta.value = "";
        state.replyTo = null;
        renderReply();
        closeMention();
        await loadConversations();
        await loadMessages();
        renderMessages();
    }

    async function uploadFiles(fileList) {
        if (!state.selected) return showToast("请先选择会话", true);
        var files = Array.from(fileList || []);
        if (!files.length) return;
        if (state.selected.scopeType === "mock") {
            files.forEach(function (file) {
                state.selected.__mockMessages.push({
                    id: "mock-file-" + Date.now() + "-" + file.name,
                    senderId: auth().userId || "student",
                    content: file.name,
                    files: [{ name: file.name, size: file.size, mimeType: file.type || "application/octet-stream", objectKey: "mock://" + file.name }],
                    mentions: [],
                    replyToId: null,
                    createdAt: new Date().toISOString(),
                    deletedAt: null,
                });
            });
            await loadMessages();
            renderMessages();
            return showToast("已上传 " + files.length + " 个文件（mock）");
        }
        var sent = 0;
        for (var i = 0; i < files.length; i += 1) {
            var file = files[i];
            try {
                var presign = await window.linkseeApi.postJson("/api/v1/chat/files/presign-upload", {
                    scopeType: state.selected.scopeType,
                    scopeId: String(state.selected.scopeId),
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream",
                    size: file.size,
                });
                var data = presign.data || {};
                var headerMap = data.headers || {};
                var putResp = await fetch(data.uploadUrl, {
                    method: "PUT",
                    headers: headerMap,
                    body: file,
                });
                if (!putResp.ok) throw new Error("上传文件失败");
                var meta = {
                    objectKey: data.objectKey,
                    name: file.name,
                    size: file.size,
                    mimeType: file.type || "application/octet-stream",
                    uploadedAt: new Date().toISOString(),
                };
                var body = { type: "file", content: file.name, files: [meta] };
                if (state.replyTo) body.replyToId = String(state.replyTo.id);
                await window.linkseeApi.postJson(messagePath(state.selected.scopeType, state.selected.scopeId), body);
                sent += 1;
            } catch (err) {
                showToast("文件“" + file.name + "”上传失败：" + (err && err.message ? err.message : "未知错误"), true);
            }
        }
        if (sent > 0) {
            showToast("已上传 " + sent + " 个文件");
            await loadConversations();
            await loadMessages();
            renderMessages();
        }
    }

    async function downloadMessageFile(messageId, index) {
        var msg = state.messages.find(function (m) { return String(m.id) === String(messageId); });
        if (!msg || !Array.isArray(msg.files) || !msg.files[index]) return;
        var f = msg.files[index];
        if (state.selected && state.selected.scopeType === "mock") {
            return showToast("mock 会话不提供真实下载链接");
        }
        var payload = await window.linkseeApi.getJson("/api/v1/chat/files/presign-download?objectKey=" + encodeURIComponent(f.objectKey));
        window.open(payload.data.downloadUrl, "_blank");
    }

    function openMention(start, keyword) {
        var list = q("[data-chat-mention]", state.panel);
        state.mention.start = start;
        state.mention.keyword = keyword || "";
        state.mention.options = state.participants.filter(function (p) {
            var name = (p.profile.realName || "").toLowerCase();
            var id = String(p.id || "").toLowerCase();
            var key = state.mention.keyword.toLowerCase();
            return !key || name.indexOf(key) >= 0 || id.indexOf(key) >= 0;
        }).slice(0, 8);
        state.mention.index = 0;
        if (!state.mention.options.length) {
            closeMention();
            return;
        }
        list.innerHTML = state.mention.options.map(function (u, i) {
            return "<div class='chat-mention-item" + (i === 0 ? " active" : "") + "' data-chat-mention-id='" + u.id + "'>" +
                "<div class='chat-avatar' style='width:24px;height:24px'><img src='" + userAvatar(u) + "' alt=''></div>" +
                "<span>" + escapeHtml(userName(u)) + " (" + escapeHtml(u.id) + ")</span></div>";
        }).join("");
        list.classList.add("show");
        state.mention.open = true;
    }

    function closeMention() {
        state.mention.open = false;
        var list = q("[data-chat-mention]", state.panel);
        list.classList.remove("show");
        list.innerHTML = "";
    }

    function applyMention(userId) {
        var target = state.participantsMap.get(String(userId));
        if (!target) return;
        var ta = q("[data-chat-composer]", state.panel);
        var cursor = ta.selectionStart;
        var text = ta.value;
        var head = text.slice(0, state.mention.start);
        var tail = text.slice(cursor);
        ta.value = head + "@" + userName(target) + " " + tail;
        var pos = (head + "@" + userName(target) + " ").length;
        ta.setSelectionRange(pos, pos);
        ta.focus();
        closeMention();
    }

    function refreshMentionByInput() {
        var ta = q("[data-chat-composer]", state.panel);
        var cursor = ta.selectionStart;
        var text = ta.value.slice(0, cursor);
        var at = text.lastIndexOf("@");
        if (at < 0) return closeMention();
        var part = text.slice(at + 1);
        if (/\s/.test(part)) return closeMention();
        openMention(at, part);
    }

    function openContextMenu(message, x, y) {
        var menu = q("[data-chat-menu]", state.panel);
        var canDelete = String(message.senderId) === String(auth().userId) || isStaff();
        var items = [
            "<button type='button' data-chat-menu-action='reply'>回复</button>",
            canDelete ? "<button type='button' data-chat-menu-action='delete'>删除</button>" : "",
        ].join("");
        menu.innerHTML = items;
        menu.style.left = x + "px";
        menu.style.top = y + "px";
        menu.style.display = "block";
        menu.dataset.messageId = String(message.id);
    }

    function closeContextMenu() {
        var menu = q("[data-chat-menu]", state.panel);
        menu.style.display = "none";
        menu.innerHTML = "";
        menu.dataset.messageId = "";
    }

    async function deleteMessage(messageId) {
        if (!state.selected) return;
        if (state.selected.scopeType === "mock") {
            state.selected.__mockMessages = (state.selected.__mockMessages || []).map(function (m) {
                if (String(m.id) !== String(messageId)) return m;
                return Object.assign({}, m, { content: null, files: null, mentions: null, deletedAt: new Date().toISOString() });
            });
            await loadMessages();
            renderMessages();
            return showToast("消息已删除（mock）");
        }
        await window.linkseeApi.request(messagePath(state.selected.scopeType, state.selected.scopeId) + "/" + encodeURIComponent(messageId), {
            method: "DELETE",
            headers: window.linkseeApi.authHeaders(),
        });
        showToast("消息已删除");
        await loadMessages();
        renderMessages();
    }

    function bindEvents() {
        state.launcher.addEventListener("click", function () {
            state.open = !state.open;
            state.panel.classList.toggle("open", state.open);
            document.body.classList.toggle("linksee-chat-docked-open", state.open);
            syncTopActionsHidden(state.open);
            if (state.open) {
                loadConversations().then(function () {
                    renderMessages();
                    return state.selected ? openConversationById(state.selected.id) : null;
                }).catch(function (e) { showToast(e.message || "加载失败", true); });
            }
        });

        state.panel.addEventListener("click", function (event) {
            var actionNode = event.target.closest("[data-chat-action]");
            if (actionNode) {
                var action = actionNode.getAttribute("data-chat-action");
                if (action === "close") {
                    state.open = false;
                    state.panel.classList.remove("open");
                    document.body.classList.remove("linksee-chat-docked-open");
                    document.body.classList.remove("chat-expanded");
                    syncTopActionsHidden(false);
                }
                if (action === "back") backToList();
                if (action === "send") sendText().catch(function (e) { showToast(e.message || "发送失败", true); });
                if (action === "announcement") sendAnnouncement().catch(function (e) { showToast(e.message || "公告发布失败", true); });
                if (action === "history") searchHistory().catch(function (e) { showToast(e.message || "操作失败", true); });
                if (action === "search-run") runSearch().catch(function (e) { showToast(e.message || "搜索失败", true); });
                if (action === "search-exit") closeSearch().catch(function () {});
                return;
            }

            var conv = event.target.closest("[data-chat-open]");
            if (conv) {
                openConversationById(conv.getAttribute("data-chat-open")).catch(function (e) { showToast(e.message || "打开会话失败", true); });
                return;
            }

            var fileLink = event.target.closest("[data-chat-file]");
            if (fileLink) {
                event.preventDefault();
                var parts = fileLink.getAttribute("data-chat-file").split(":");
                downloadMessageFile(parts[0], Number(parts[1])).catch(function (e) { showToast(e.message || "下载失败", true); });
                return;
            }

            var mentionItem = event.target.closest("[data-chat-mention-id]");
            if (mentionItem) {
                applyMention(mentionItem.getAttribute("data-chat-mention-id"));
                return;
            }

            var menuAction = event.target.closest("[data-chat-menu-action]");
            if (menuAction) {
                var kind = menuAction.getAttribute("data-chat-menu-action");
                var messageId = q("[data-chat-menu]", state.panel).dataset.messageId;
                var msg = state.messages.find(function (m) { return String(m.id) === String(messageId); });
                closeContextMenu();
                if (!msg) return;
                if (kind === "reply") {
                    state.replyTo = msg;
                    renderReply();
                    q("[data-chat-composer]", state.panel).focus();
                }
                if (kind === "delete") {
                    deleteMessage(messageId).catch(function (e) { showToast(e.message || "删除失败", true); });
                }
                return;
            }
            closeContextMenu();
        });

        var ta = q("[data-chat-composer]", state.panel);
        ta.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendText().catch(function (e) { showToast(e.message || "发送失败", true); });
                return;
            }
            if (event.key === "Escape") {
                if (state.replyTo) {
                    state.replyTo = null;
                    renderReply();
                }
                closeMention();
                closeContextMenu();
                return;
            }
            if (state.mention.open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                var max = state.mention.options.length;
                if (!max) return;
                state.mention.index = (state.mention.index + (event.key === "ArrowDown" ? 1 : -1) + max) % max;
                qs(".chat-mention-item", state.panel).forEach(function (n, i) {
                    n.classList.toggle("active", i === state.mention.index);
                });
                return;
            }
            if (state.mention.open && event.key === "Enter") {
                event.preventDefault();
                var pick = state.mention.options[state.mention.index];
                if (pick) applyMention(pick.id);
            }
        });
        ta.addEventListener("input", refreshMentionByInput);

        var dropZone = q("[data-chat-drop-zone]", state.panel);
        ["dragenter", "dragover"].forEach(function (evt) {
            dropZone.addEventListener(evt, function (e) {
                e.preventDefault();
                e.stopPropagation();
                q("[data-chat-drop-hint]", dropZone).classList.add("show");
            });
        });
        ["dragleave", "drop"].forEach(function (evt) {
            dropZone.addEventListener(evt, function (e) {
                e.preventDefault();
                e.stopPropagation();
                q("[data-chat-drop-hint]", dropZone).classList.remove("show");
            });
        });
        dropZone.addEventListener("drop", function (e) {
            var dt = e.dataTransfer;
            if (!dt || !dt.files || !dt.files.length) return;
            uploadFiles(dt.files).catch(function (err) { showToast(err.message || "上传失败", true); });
        });

        state.panel.addEventListener("contextmenu", function (event) {
            var bubble = event.target.closest("[data-chat-message-id]");
            if (!bubble) return;
            event.preventDefault();
            var id = bubble.getAttribute("data-chat-message-id");
            var msg = state.messages.find(function (m) { return String(m.id) === String(id); });
            if (!msg || msg.deletedAt) return;
            openContextMenu(msg, event.clientX + 2, event.clientY + 2);
        });
    }

    function init() {
        if (!auth().token || !window.linkseeApi) return;
        state.launcher = createLauncher();
        state.panel = createPanel();
        bindEvents();
        Promise.all([loadMe(), loadConversations()]).then(function () {
            setUnread(state.unreadTotal > 0);
            renderMessages();
        }).catch(function () {});
    }

    window.linkseeChatWidget = {
        open: function () {
            state.open = true;
            state.panel.classList.add("open");
            document.body.classList.add("linksee-chat-docked-open");
            syncTopActionsHidden(true);
        },
        close: function () {
            state.open = false;
            state.panel.classList.remove("open");
            document.body.classList.remove("linksee-chat-docked-open");
            document.body.classList.remove("chat-expanded");
            syncTopActionsHidden(false);
        },
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
