(function () {
    if (window.linkseeChatWidget) return;

    var state = {
        open: false,
        mode: "list",
        conversations: [],
        selected: null,
        listSearch: { open: false, keyword: "" },
        search: {
            open: false,
            keyword: "",
            results: [],
            baseLatestMessageId: "",
            contextAnchorId: "",
            contextMessages: [],
            contextHasOlder: false,
            contextHasNewer: false,
        },
        listTab: "all",
        participants: [],
        participantsMap: new Map(),
        messages: [],
        messagesPaging: { hasMore: false, nextCursor: null, loadingOlder: false },
        me: null,
        unreadTotal: 0,
        replyTo: null,
        editingMessageId: null,
        pendingUploads: [],
        fileActivity: new Map(),
        expiryTimer: null,
        readSyncTimer: null,
        readSyncInFlight: false,
        readBoundaryAt: null,
        openUnreadCount: 0,
        lastReadMessageId: null,
        realtimeTimer: null,
        realtimeInFlight: false,
        realtimeCursorByRoom: new Map(),
        conversationListInFlight: false,
        lastConversationRefreshAt: 0,
        contextMenu: null,
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
        var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239CA3AF'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
        return "data:image/svg+xml;base64," + window.btoa(unescape(encodeURIComponent(svg)));
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
    function isMockConversation() {
        return Boolean(state.selected && state.selected.scopeType === "mock");
    }
    function shouldForceMockConversations() {
        try {
            return localStorage.getItem("linksee_chat_force_mock") === "1";
        } catch (_err) {
            return false;
        }
    }
    function isStaff() {
        var role = auth().role;
        return role === "teacher" || role === "assistant" || role === "academic";
    }
    function getRoomKey(scopeType, scopeId) {
        if (!scopeType || !scopeId || scopeType === "mock") return "";
        return String(scopeType) + ":" + String(scopeId);
    }
    function getSelectedRoomKey() {
        if (!state.selected) return "";
        return getRoomKey(state.selected.scopeType, state.selected.scopeId);
    }
    function getConversationById(id) {
        return state.conversations.find(function (c) { return String(c.id) === String(id); }) || null;
    }
    function getLatestMessageId(messages) {
        var list = Array.isArray(messages) ? messages : state.messages;
        for (var i = list.length - 1; i >= 0; i -= 1) {
            var item = list[i];
            if (item && !item.pending && item.id !== undefined && item.id !== null) {
                return String(item.id);
            }
        }
        return "";
    }
    function getMessageCreatedAtMs(message) {
        if (!message || message.pending) return 0;
        var createdAt = message.createdAt ? new Date(message.createdAt).getTime() : 0;
        return Number.isNaN(createdAt) ? 0 : createdAt;
    }
    function getUnreadBoundaryInfo(messages) {
        var list = Array.isArray(messages) ? messages : [];
        if (!state.selected || isSearchOpen()) return { index: -1, count: 0 };
        var unreadCount = Math.max(0, Number(state.openUnreadCount) || 0);
        if (!unreadCount) return { index: -1, count: 0 };
        var boundaryAt = state.readBoundaryAt || state.selected.lastReadAt || "";
        var boundaryMs = boundaryAt ? new Date(boundaryAt).getTime() : 0;
        if (!boundaryMs || Number.isNaN(boundaryMs)) {
            return { index: 0, count: unreadCount };
        }
        for (var i = 0; i < list.length; i += 1) {
            if (getMessageCreatedAtMs(list[i]) > boundaryMs) {
                return { index: i, count: unreadCount };
            }
        }
        return { index: -1, count: unreadCount };
    }
    function isSearchOpen() {
        return Boolean(state.search && state.search.open);
    }
    function isSearchContextMode() {
        return Boolean(isSearchOpen() && state.search && state.search.contextAnchorId);
    }
    function resetSearchState() {
        state.search.open = false;
        state.search.keyword = "";
        state.search.results = [];
        state.search.baseLatestMessageId = "";
        state.search.contextAnchorId = "";
        state.search.contextMessages = [];
        state.search.contextHasOlder = false;
        state.search.contextHasNewer = false;
    }
    function compareMessagesChronologically(a, b) {
        var aMs = getMessageCreatedAtMs(a);
        var bMs = getMessageCreatedAtMs(b);
        if (aMs !== bMs) return aMs - bMs;
        var aId = Number(a && a.id ? a.id : 0);
        var bId = Number(b && b.id ? b.id : 0);
        return aId - bId;
    }
    function mergeChronologicalMessages(base, incoming, mode) {
        var list = Array.isArray(base) ? base.slice() : [];
        var seen = new Set(list.map(function (m) { return String(m.id); }));
        (Array.isArray(incoming) ? incoming : []).forEach(function (m) {
            if (!seen.has(String(m.id))) {
                list.push(m);
                seen.add(String(m.id));
            }
        });
        list.sort(compareMessagesChronologically);
        return list;
    }
    function getActiveMessageList() {
        if (isSearchOpen()) {
            if (isSearchContextMode()) {
                return Array.isArray(state.search.contextMessages) ? state.search.contextMessages : [];
            }
            return Array.isArray(state.search.results) ? state.search.results : [];
        }
        return getRenderableMessages();
    }
    function getConversationMessageStore() {
        if (state.selected && state.selected.scopeType === "mock") {
            return Array.isArray(state.selected.__mockMessages) ? state.selected.__mockMessages.slice() : [];
        }
        return state.messages.slice();
    }
    function createIdempotencyKey(prefix) {
        var randomPart = "";
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            randomPart = window.crypto.randomUUID();
        } else {
            randomPart = Math.random().toString(36).slice(2, 12);
        }
        return String(prefix || "chat") + "-" + Date.now() + "-" + randomPart;
    }
    function formatConversationTime(value) {
        if (!value) return "";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        var now = new Date();
        var sameDay = date.toDateString() === now.toDateString();
        if (sameDay) {
            return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
        }
        var yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return "昨天";
        }
        var sameYear = date.getFullYear() === now.getFullYear();
        return date.toLocaleDateString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            ...(sameYear ? {} : { year: "numeric" }),
        }).replace(/\//g, "/");
    }
    function getConversationPreview(c) {
        var preview = "暂无消息";
        var source = c && state.listTab === "task" && c.lastTaskMessage ? c.lastTaskMessage : (c && c.lastMessage ? c.lastMessage : null);
        if (source) {
            if (source.messageType === "file") {
                preview = buildFileSummary(source.files) || "文件消息";
            } else if (source.messageType === "announcement") {
                preview = "【通知】" + String(source.content || "");
            } else {
                preview = source.content || "暂无消息";
            }
        }
        return preview;
    }
    function getConversationKind(c) {
        if (!c) return "other";
        if ((Number(c.unreadTaskCount) || 0) > 0 || c.hasTaskNotification || c.lastTaskMessage) return "task";
        if (c.scopeType === "group") return "group";
        return "other";
    }
    function matchesConversationTab(c, tab) {
        if (!c) return false;
        if (tab === "all") return true;
        if (tab === "unread") return (Number(c.unreadCount) || 0) > 0;
        if (tab === "group") return c.scopeType === "group";
        if (tab === "task") return getConversationKind(c) === "task";
        return true;
    }
    function getFilteredConversations() {
        var keyword = String(state.listSearch.keyword || "").trim().toLowerCase();
        return state.conversations.filter(function (c) {
            if (!matchesConversationTab(c, state.listTab)) return false;
            if (!keyword) return true;
            var title = String(c.title || c.roomKey || "").toLowerCase();
            var preview = String(getConversationPreview(c)).toLowerCase();
            return title.indexOf(keyword) >= 0 || preview.indexOf(keyword) >= 0;
        });
    }
    function getTabCount(tab) {
        if (tab === "unread") {
            return state.conversations.reduce(function (sum, c) {
                return sum + (Number(c.unreadCount) || 0);
            }, 0);
        }
        return state.conversations.filter(function (c) {
            return matchesConversationTab(c, tab);
        }).length;
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

    function isAllowedChatMimeType(mimeType) {
        if (!mimeType || typeof mimeType !== "string") return false;
        if (mimeType.indexOf("text/") === 0) return true;
        return [
            "application/pdf",
            "application/zip",
            "application/x-zip-compressed",
            "application/x-rar-compressed",
            "application/vnd.rar",
            "application/x-7z-compressed",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/json",
            "application/xml",
            "text/xml",
            "text/markdown",
            "text/x-yaml",
            "application/x-yaml",
            "text/yaml",
            "text/x-tex",
            "application/x-tex",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "video/mp4",
            "video/webm",
            "video/quicktime",
        ].indexOf(mimeType) >= 0;
    }

    function formatBytes(size) {
        var value = Number(size) || 0;
        var units = ["B", "KB", "MB", "GB", "TB"];
        var unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }
        return (unitIndex === 0 ? String(value) : value.toFixed(value >= 10 ? 0 : 1)) + " " + units[unitIndex];
    }

    function formatExpiryLabel(file) {
        if (!file || !file.expiresAt) return "";
        var expires = new Date(file.expiresAt);
        if (Number.isNaN(expires.getTime())) return "";
        var diff = expires.getTime() - Date.now();
        if (diff <= 0) return "已过期";
        var hour = 60 * 60 * 1000;
        var day = 24 * hour;
        if (diff < day) {
            var hours = Math.max(1, Math.ceil(diff / hour));
            return hours + " 小时后过期";
        }
        var days = Math.max(1, Math.ceil(diff / day));
        return days + " 天后过期";
    }

    function buildFileSummary(files) {
        if (!Array.isArray(files) || !files.length) return "";
        var names = files.map(function (file) { return String(file && file.name ? file.name : "附件"); });
        if (names.length === 1) return names[0];
        if (names.length === 2) return names[0] + "、" + names[1];
        return names[0] + " 等 " + names.length + " 个文件";
    }

    function buildFileMetaText(file) {
        if (!file) return "";
        var bits = [];
        if (file.size !== undefined && file.size !== null) bits.push(formatBytes(file.size));
        if (file.uploadedAt) {
            var uploaded = window.linkseePage && typeof window.linkseePage.formatDateTime === "function"
                ? window.linkseePage.formatDateTime(file.uploadedAt)
                : new Date(file.uploadedAt).toLocaleString("zh-CN", { hour12: false });
            bits.push("上传于 " + uploaded);
        }
        return bits.join(" · ");
    }

    function fileKey(messageId, index) {
        return String(messageId) + ":" + String(index);
    }

    function getFileActivity(key) {
        return state.fileActivity.get(String(key)) || null;
    }

    function setFileActivity(key, activity) {
        if (!key) return;
        if (!activity) {
            state.fileActivity.delete(String(key));
            return;
        }
        state.fileActivity.set(String(key), activity);
    }

    function getRenderableMessages() {
        return state.messages.concat(state.pendingUploads);
    }

    function syncConversationSummaryLocal(conversationId, unreadCount, lastReadAt) {
        var target = getConversationById(conversationId);
        if (target) {
            target.unreadCount = Number(unreadCount) || 0;
            if (lastReadAt) target.lastReadAt = lastReadAt;
        }
        if (state.selected && String(state.selected.id) === String(conversationId)) {
            state.selected.unreadCount = Number(unreadCount) || 0;
            if (lastReadAt) state.selected.lastReadAt = lastReadAt;
        }
        state.unreadTotal = state.conversations.reduce(function (sum, c) {
            return sum + (Number(c.unreadCount) || 0);
        }, 0);
        setUnread(state.unreadTotal > 0);
    }

    function scheduleReadSync() {
        if (!state.selected || isMockConversation() || isSearchOpen()) return;
        if (state.readSyncTimer) {
            clearTimeout(state.readSyncTimer);
        }
        state.readSyncTimer = setTimeout(function () {
            state.readSyncTimer = null;
            syncSelectedConversationRead().catch(function () {});
        }, 220);
    }

    async function syncSelectedConversationRead() {
        if (!state.selected || isMockConversation()) return;
        if (state.readSyncInFlight) return;
        var latestMessageId = getLatestMessageId(state.messages);
        if (!latestMessageId || latestMessageId === state.lastReadMessageId) return;
        state.readSyncInFlight = true;
        try {
            await window.linkseeApi.postJson("/api/v1/conversations/" + encodeURIComponent(state.selected.id) + "/read", {
                messageId: latestMessageId,
            });
            state.lastReadMessageId = latestMessageId;
            state.readBoundaryAt = new Date().toISOString();
            state.openUnreadCount = 0;
            syncConversationSummaryLocal(state.selected.id, 0, state.readBoundaryAt);
        } catch (_err) {
            // Read sync is best-effort. We keep the UI responsive even if the write fails.
        } finally {
            state.readSyncInFlight = false;
        }
    }

    function shouldRefreshForRealtimeEvent(eventName) {
        return /message\.(created|updated|deleted)$/.test(String(eventName || ""));
    }
    function isCreateOnlyRealtimeRefresh(events) {
        return Array.isArray(events) && events.length > 0 && events.every(function (event) {
            return String(event && event.name || "") === "message.created";
        });
    }

    function eventPayloadMessageId(event) {
        var payload = event && event.payload ? event.payload : null;
        return payload && payload.messageId ? String(payload.messageId) : "";
    }

    async function ackRealtimeEvent(event, roomKey) {
        if (!event || !event.id || !roomKey) return false;
        var body = {
            eventId: String(event.id),
            roomKey: String(roomKey),
        };
        var messageId = eventPayloadMessageId(event);
        if (messageId) body.messageId = messageId;
        try {
            await window.linkseeApi.postJson("/api/v1/realtime/acks", body);
            return true;
        } catch (_err) {
            // Ack failures should not block chat rendering.
            return false;
        }
    }

    async function syncRealtimeForSelectedConversation() {
        if (!state.open || !state.selected || isMockConversation() || isSearchOpen()) return;
        if (state.realtimeInFlight) return;
        var selectedConversationId = String(state.selected.id);
        var roomKey = getSelectedRoomKey();
        if (!roomKey) return;
        var afterEventId = state.realtimeCursorByRoom.get(roomKey) || "";
        state.realtimeInFlight = true;
        try {
            var url = "/api/v1/realtime/replay?room=" + encodeURIComponent(roomKey);
            if (afterEventId) {
                url += "&afterEventId=" + encodeURIComponent(afterEventId);
            }
            var payload = await window.linkseeApi.getJson(url);
            var events = Array.isArray(payload.data) ? payload.data : [];
            if (!events.length) return;

            if (!state.selected || String(state.selected.id) !== selectedConversationId) {
                return;
            }

            var needsConversationReload = false;
            var needsParticipantReload = false;
            var lastAckedEventId = afterEventId;

            events.forEach(function (event) {
                if (shouldRefreshForRealtimeEvent(event.name)) {
                    needsConversationReload = true;
                }
                if (String(event.name || "").indexOf(".member.updated") >= 0) {
                    needsParticipantReload = true;
                }
            });

            for (var i = 0; i < events.length; i += 1) {
                var acked = await ackRealtimeEvent(events[i], roomKey);
                if (!acked) {
                    break;
                }
                lastAckedEventId = events[i].id;
            }

            if (lastAckedEventId) {
                state.realtimeCursorByRoom.set(roomKey, lastAckedEventId);
            }

            if (!state.selected || String(state.selected.id) !== selectedConversationId) {
                return;
            }

            if (needsParticipantReload) {
                await loadParticipants();
                if (!needsConversationReload) {
                    renderMessages();
                }
            }

            if (needsConversationReload) {
                await loadConversations();
                if (isCreateOnlyRealtimeRefresh(events)) {
                    await loadMessages({ afterId: getLatestMessageId(state.messages) });
                } else {
                    await loadMessages();
                }
                renderMessages();
                return;
            }
        } catch (_err) {
            // Realtime replay is opportunistic. Falling back to normal refresh keeps the UI usable.
        } finally {
            state.realtimeInFlight = false;
        }
    }

    function startRealtimeTicker() {
        if (state.realtimeTimer) return;
        state.realtimeTimer = setInterval(function () {
            if (!state.open) return;
            if (Date.now() - state.lastConversationRefreshAt > 8000) {
                syncConversationList(false).catch(function () {});
            }
            syncRealtimeForSelectedConversation().catch(function () {});
        }, 4500);
    }

    function stopRealtimeTicker() {
        if (!state.realtimeTimer) return;
        clearInterval(state.realtimeTimer);
        state.realtimeTimer = null;
    }

    function createProgressRing(progress, label) {
        var pct = Math.max(0, Math.min(100, Number(progress) || 0));
        return [
            "<div class='chat-file-progress' style='--progress:" + pct + "'>",
            "<span>" + escapeHtml(label || (pct >= 100 ? "100%" : Math.round(pct) + "%")) + "</span>",
            "</div>",
        ].join("");
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
        body.linksee-chat-docked-open .workspace{padding-right:calc(360px + 24px);transition:padding-right .2s ease}
        body.linksee-chat-docked-open.chat-expanded .workspace{padding-right:calc(700px + 24px)}
        body.app-shell.linksee-chat-docked-open .workspace{padding-right:calc(360px + 40px)}
        body.app-shell.linksee-chat-docked-open.chat-expanded .workspace{padding-right:calc(700px + 40px)}
        .linksee-chat-panel{position:fixed;right:16px;top:calc(var(--linksee-topbar-height, 56px) + 16px);bottom:16px;width:min(376px,calc(100vw - 24px));z-index:280;border:1px solid rgba(226,232,240,.95);background:linear-gradient(180deg,rgba(255,255,255,.99) 0%,rgba(246,248,250,.99) 100%);border-radius:24px;display:none;overflow:hidden;box-shadow:0 22px 54px rgba(15,23,42,.10);backdrop-filter:blur(14px);transition:width .2s ease}
        body.app-shell .linksee-chat-panel{right:24px;top:calc(var(--linksee-topbar-height, 56px) + 16px);bottom:20px;max-height:calc(100vh - var(--linksee-topbar-height, 56px) - 36px)}
        .linksee-chat-panel.expanded{width:min(760px,calc(100vw - 32px))}
        .linksee-chat-panel.open{display:grid}
        .chat-shell{height:100%;min-height:0;display:flex;flex-direction:column}
        .chat-shell > *{min-height:0}
        .chat-head{position:sticky;top:0;z-index:3;display:flex;align-items:flex-start;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid rgba(226,232,240,.84);background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.92));backdrop-filter:blur(10px)}
        .chat-head-copy{display:grid;gap:3px}
        .chat-head-title-row{display:flex;align-items:flex-start;gap:8px;min-width:0}
        .chat-head-back{width:32px;height:32px;border:none;background:transparent;border-radius:10px;display:none;place-items:center;color:#64748b;cursor:pointer;flex:none;transition:background .15s ease,color .15s ease}
        .chat-head-back:hover{background:#eef6f4;color:#0f766e}
        .chat-head strong{font-size:17px;font-weight:800;color:#0f172a;letter-spacing:.01em}
        .chat-head .action-row{align-self:flex-start}
        .chat-head-icon{width:34px;height:34px;border:none;background:transparent;border-radius:10px;display:grid;place-items:center;color:#64748b;cursor:pointer;transition:background .15s ease,color .15s ease,transform .15s ease}
        .chat-head-icon:hover{background:#eef6f4;color:#0f766e}
        .chat-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:end;gap:0;padding:8px 12px 5px;border-bottom:1px solid rgba(226,232,240,.72);background:rgba(255,255,255,.94)}
        .chat-tab{position:relative;border:none;background:transparent;padding:0 0 9px;cursor:pointer;color:#64748b;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px}
        .chat-tab:hover{color:#0f766e}
        .chat-tab.active{color:#0f766e}
        .chat-tab-label{font-size:14px;line-height:1}
        .chat-tab-underline{position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:999px;background:transparent;transition:background .15s ease}
        .chat-tab.active .chat-tab-underline{background:#0f766e}
        .tab-badge{font-size:11px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;display:inline-grid;place-items:center;background:#e2e8f0;color:#475569}
        .tab-badge.red{background:#ef4444;color:#fff}
        .chat-body{flex:1;overflow:auto;min-height:0;padding:8px 12px 12px;display:grid;gap:0;align-content:start;background:linear-gradient(180deg,#fafcfd 0%,#f4f7fa 100%);scrollbar-width:thin;scrollbar-color:rgba(148,163,184,.38) transparent}
        .chat-divider{display:flex;flex-direction:column;align-items:center;gap:6px;margin:10px 0 12px}
        .chat-divider-jump{border:none;background:transparent;padding:0;display:inline-flex;align-items:center;gap:10px;max-width:100%;color:#94a3b8;font-size:11px;font-weight:500;line-height:1;cursor:pointer}
        .chat-divider-line{height:1px;width:64px;background:rgba(148,163,184,.26);flex:none}
        .chat-divider-label{white-space:nowrap}
        .chat-divider-subtitle{font-size:11px;line-height:1;color:#cbd5e1;letter-spacing:.08em}
        .chat-search-context-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:8px 0 10px}
        .chat-search-context-hint{font-size:11px;color:#94a3b8}
        .chat-search-context-btn{border:none;background:transparent;color:#64748b;font-size:11px;padding:0 2px;display:inline-flex;align-items:center;gap:6px;cursor:default}
        .chat-search-context-btn:hover{color:#0f766e}
        .chat-search-context-sep{width:1px;height:10px;background:rgba(148,163,184,.22)}
        .chat-row{display:flex;gap:10px;align-items:flex-end;width:100%}
        .chat-row.file-row{align-items:flex-end}
        .chat-row.me{justify-content:flex-end}
        .chat-row,
        .chat-message-stack,
        .chat-msg,
        .chat-file-thread,
        .chat-file,
        .chat-file-body,
        .chat-message-stack *,
        .chat-msg *,
        .chat-file-thread *,
        .chat-file-body *,
        .chat-file-meta,
        .chat-file-name,
        .chat-file-expiry{
            cursor:default;
            -webkit-user-select:none;
            user-select:none
        }
        .chat-file-icon,
        .chat-load-more,
        .chat-mention-item,
        .chat-menu button,
        .chat-more-menu button,
        .chat-head-icon,
        .chat-head-back,
        .chat-tool,
        .chat-send,
        .chat-tab,
        .chat-conversation-item,
        .chat-conversation-item *,
        .chat-search-box button,
        .chat-box .chat-toolbar button{
            cursor:default;
            -webkit-user-select:none;
            user-select:none
        }
        .chat-avatar{width:36px;height:36px;border-radius:50%;overflow:hidden;background:#dbe3ee;flex:none;box-shadow:0 6px 16px rgba(15,23,42,.08)}
        .chat-avatar img{width:100%;height:100%;object-fit:cover}
        .chat-msg{display:inline-block;width:auto;max-width:min(78%,34rem);min-width:0;background:#fff;border:1px solid #dce5ee;border-radius:16px;padding:10px 12px;position:relative;box-shadow:0 1px 0 rgba(15,23,42,.02)}
        .chat-msg.me{background:linear-gradient(180deg,#eefaf4,#e8f7ef);border-color:#cbe5d6}
        .chat-msg.is-pending{opacity:.94}
        .chat-msg > div{display:block;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;max-width:100%}
        .chat-text{display:block;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;max-width:100%}
        .chat-meta{font-size:12px;color:#64748b;display:flex;gap:8px;margin-bottom:4px}
        .chat-message-stack{display:flex;flex-direction:column;gap:6px;max-width:min(86%,34rem);width:fit-content;align-items:flex-start;min-width:0}
        .chat-row.me .chat-message-stack{margin-left:auto;align-items:flex-end}
        .chat-row:not(.me) .chat-message-stack{justify-items:start}
        .chat-message-head{display:flex;align-items:baseline;gap:10px;font-size:12px;line-height:1.2;color:#64748b;white-space:nowrap;max-width:100%;padding:0 2px}
        .chat-row.me .chat-message-head{justify-content:flex-end;text-align:right}
        .chat-row:not(.me) .chat-message-head{justify-content:flex-start;text-align:left}
        .chat-message-head strong{font-size:13px;color:#0f766e;font-weight:700}
        .chat-message-head span{font-size:11px;color:#94a3b8}
        .chat-del{color:#94a3b8;font-style:italic}
        .chat-file-thread{display:flex;flex-direction:column;gap:6px;width:fit-content;max-width:min(86%,34rem);align-self:flex-end;min-width:0}
        .chat-row.file-row.me .chat-file-thread{margin-left:auto;align-self:flex-end;align-items:flex-end}
        .chat-files{display:grid;gap:10px;margin-top:8px}
        .chat-file{display:grid;grid-template-columns:42px minmax(0,1fr);gap:12px;align-items:start;width:100%;max-width:none;padding:14px 16px;border:1px solid #d9e2ec;border-radius:18px;background:#fff;box-shadow:0 1px 0 rgba(15,23,42,.02)}
        .chat-file-icon{width:42px;height:42px;border-radius:12px;background:#eef2f7;color:#94a3b8;display:grid;place-items:center;flex:none;position:relative;overflow:hidden;align-self:start;border:none;cursor:pointer;padding:0}
        .chat-file.is-downloaded .chat-file-icon{background:#e6f0ef;color:#0f766e}
        .chat-file.is-pending .chat-file-icon,.chat-file.is-uploading .chat-file-icon{background:#eef2f7;color:#0f766e}
        .chat-file-icon svg{position:relative;z-index:1}
        .chat-file-progress{position:absolute;inset:1px;border-radius:50%;background:conic-gradient(#0f766e calc(var(--progress) * 1%), rgba(15,118,110,.12) 0);display:grid;place-items:center;-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));z-index:2;pointer-events:none}
        .chat-file-progress span{font-size:11px;font-weight:700;color:#0f766e;background:#fff;border-radius:999px;padding:2px 4px;transform:scale(.9);white-space:nowrap}
        .chat-file.is-pending{opacity:.92}
        .chat-file-body{display:grid;gap:6px;min-width:0;align-content:start;padding-top:2px}
        .chat-file-name{font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:16px;line-height:1.2;max-width:100%}
        .chat-file-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;line-height:1.3;color:#64748b;max-width:min(100%, 320px)}
        .chat-file-meta .meta-text{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .chat-file-expiry{font-size:11px;padding:3px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;white-space:nowrap}
        .chat-file-expiry.expired{background:#fef2f2;color:#b91c1c}
        .chat-file-icon:hover{filter:brightness(.98)}
        .chat-file-icon:disabled{cursor:not-allowed;opacity:.8}
        .chat-quote{margin:4px 0 6px;padding:6px 8px;border-left:3px solid #cbd5e1;background:#f8fafc;color:#475569;font-size:12px}
        .chat-load-more{justify-self:center;border:1px solid #dbe3ee;background:#fff;border-radius:999px;padding:8px 14px;color:#475569;cursor:pointer;font-size:12px;box-shadow:0 4px 10px rgba(15,23,42,.04)}
        .chat-load-more:hover{background:#f8fafc}
        .chat-toolbar{display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid #e2e8f0;background:transparent;flex-wrap:wrap}
        .chat-tool{border:1px solid transparent;background:#f8fafc;display:inline-flex;gap:6px;align-items:center;color:#334155;cursor:pointer;padding:6px 10px;border-radius:10px;transition:all .15s ease}
        .chat-tool:hover{background:#eef6f4;border-color:#d6ece8;color:#0f766e}
        .chat-tool.attach{margin-right:auto}
        .chat-upload-hint{padding:6px 10px 0;font-size:12px;color:#64748b}
        .chat-composer{margin-top:0;padding:0;background:#fff;border-top:1px solid #e2e8f0;position:relative;bottom:auto;z-index:2;box-shadow:0 -12px 24px rgba(15,23,42,.04)}
        .chat-reply{display:none;margin-bottom:8px;padding:7px 10px;background:#f1f5f9;border-radius:8px;font-size:12px;color:#475569}
        .chat-reply.show{display:block}
        .chat-box{border:none;border-radius:0;background:#fff;position:relative;min-height:0;display:block;padding:8px 12px 10px}
        .chat-box textarea{width:100%;height:96px;min-height:96px;max-height:96px;border:none;outline:none;resize:none;padding:12px 12px 18px;font:inherit;background:transparent;cursor:text;caret-color:auto;user-select:text;-webkit-user-select:text;line-height:1.5;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(148,163,184,.34) transparent}
        .chat-box textarea:hover,
        .chat-box textarea:focus{cursor:text;caret-color:auto;outline:none}
        .chat-send{position:absolute;right:12px;bottom:12px;width:72px;height:40px;border:none;border-radius:12px;background:linear-gradient(135deg,#0f766e,#0b5d56);color:#fff;cursor:default;font-weight:700;box-shadow:0 10px 18px rgba(15,118,110,.22)}
        .chat-drop{position:absolute;inset:0;background:rgba(15,118,110,.08);border:2px dashed #0f766e;border-radius:0;display:none;place-items:center;color:#0f766e;font-weight:600}
        .chat-drop.show{display:grid}
        .chat-mention{position:absolute;left:10px;bottom:44px;width:240px;max-height:190px;overflow:auto;border:1px solid #dbe3eb;background:#fff;border-radius:10px;box-shadow:0 12px 28px rgba(15,23,42,.14);display:none;z-index:3;scrollbar-width:thin;scrollbar-color:rgba(148,163,184,.34) transparent}
        .chat-body::-webkit-scrollbar,
        .chat-box textarea::-webkit-scrollbar,
        .chat-mention::-webkit-scrollbar{width:8px;height:8px}
        .chat-body::-webkit-scrollbar-track,
        .chat-box textarea::-webkit-scrollbar-track,
        .chat-mention::-webkit-scrollbar-track{background:transparent}
        .chat-body::-webkit-scrollbar-thumb,
        .chat-box textarea::-webkit-scrollbar-thumb,
        .chat-mention::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(148,163,184,.30);border:2px solid transparent;background-clip:padding-box}
        .chat-body::-webkit-scrollbar-thumb:hover,
        .chat-box textarea::-webkit-scrollbar-thumb:hover,
        .chat-mention::-webkit-scrollbar-thumb:hover{background:rgba(148,163,184,.42);background-clip:padding-box}
        .chat-mention.show{display:block}
        .chat-mention-item{padding:8px 10px;display:flex;gap:8px;align-items:center;cursor:pointer}
        .chat-mention-item.active,.chat-mention-item:hover{background:#f1f5f9}
        .chat-menu{position:fixed;z-index:9999;min-width:120px;border:1px solid #d8e0ea;background:#fff;border-radius:10px;box-shadow:0 12px 24px rgba(15,23,42,.18);display:none}
        .chat-menu button{width:100%;border:none;background:transparent;text-align:left;padding:8px 10px;cursor:pointer}
        .chat-menu button:hover{background:#f1f5f9}
        .chat-more-menu{position:fixed;z-index:145;min-width:160px;border:1px solid #d8e0ea;background:#fff;border-radius:12px;box-shadow:0 12px 24px rgba(15,23,42,.18);display:none;padding:6px}
        .chat-more-menu button{width:100%;border:none;background:transparent;text-align:left;padding:8px 10px;cursor:pointer;border-radius:8px;color:#334155}
        .chat-more-menu button:hover{background:#f1f5f9}
        .chat-toast-host{position:absolute;right:12px;bottom:150px;display:grid;gap:8px;z-index:130}
        .chat-toast{background:#0f172a;color:#fff;padding:8px 10px;border-radius:8px;font-size:12px;opacity:.95;transition:opacity .2s}
        .chat-toast.danger{background:#b91c1c}
        .chat-search-box{display:none;padding:8px 12px;border-bottom:1px solid rgba(226,232,240,.9);background:rgba(255,255,255,.92);align-items:center;gap:8px}
        .chat-search-box.show{display:flex}
        .chat-search-back{width:32px;height:32px;border:none;background:transparent;border-radius:10px;display:grid;place-items:center;color:#64748b;cursor:default;flex:none}
        .chat-search-back:hover{background:#eef6f4;color:#0f766e}
        .chat-search-field{position:relative;flex:1;min-width:0}
        .chat-search-field input{width:100%;border:1px solid #d5deea;border-radius:12px;padding:9px 42px 9px 12px;background:#fff;box-shadow:inset 0 1px 2px rgba(15,23,42,.04)}
        .chat-search-submit{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:none;border-radius:8px;background:transparent;display:grid;place-items:center;color:#64748b;cursor:default}
        .chat-search-submit:hover{background:#eef6f4;color:#0f766e}
        .chat-conversation-item{position:relative;display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;padding:12px 12px 16px;border-bottom:1px solid rgba(226,232,240,.68);background:transparent;cursor:pointer;transition:background .15s ease,box-shadow .15s ease,transform .15s ease}
        .chat-conversation-item:last-child{border-bottom-color:transparent}
        .chat-conversation-item:hover{background:#f8fbfa}
        .chat-conversation-item.is-active{background:#eef8f1;border-bottom-color:transparent;border-radius:16px;box-shadow:inset 0 0 0 1px rgba(208,232,216,.9),0 10px 20px rgba(15,118,110,.06)}
        .chat-conversation-item .chat-avatar{width:42px;height:42px}
        .chat-conversation-item-main{display:grid;gap:6px;min-width:0;padding-right:46px}
        .chat-conversation-item .line1{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
        .chat-conversation-item .line1 strong{font-size:15px;color:#134e4a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .chat-conversation-item .line2{font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .chat-conversation-item .line3{font-size:11px;color:#94a3b8}
        .chat-conversation-item .time{font-size:11px;color:#9ca3af;white-space:nowrap;flex:none}
        .chat-conversation-item .unread-pill{position:absolute;right:12px;bottom:12px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;display:inline-grid;place-items:center;box-shadow:0 8px 14px rgba(239,68,68,.18)}
        .chat-conversation-item .badge{font-size:11px;padding:4px 9px;border-radius:999px;background:#e0f2fe;color:#0369a1;white-space:nowrap}
        .chat-conversation-item .badge.unread{background:#0f766e;color:#fff}
        .chat-empty-state{display:grid;gap:8px;justify-items:center;padding:28px 16px;color:#64748b;text-align:center}
        .chat-empty-state strong{color:#0f172a;font-size:14px}
        .chat-empty-state span{font-size:12px;max-width:22rem;line-height:1.6}
        .chat-box .chat-toolbar{position:static;left:auto;right:auto;top:auto;padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#fff}
        .linksee-chat-panel.mode-chat .chat-tabs{display:none}
        .linksee-chat-panel.mode-chat .chat-head-back{display:grid}
    `);

    function createLauncher() {
        var existing = document.querySelector("[data-chat-launcher]");
        if (existing) {
            if (!existing.querySelector(".linksee-chat-dot")) {
                var dot = document.createElement("span");
                dot.className = "linksee-chat-dot";
                existing.appendChild(dot);
            }
            return existing;
        }
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
            <div class="chat-shell">
                <div class="chat-head">
                    <div class="chat-head-copy chat-head-title-row">
                        <button class="chat-head-back" type="button" data-chat-action="back" aria-label="返回">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
                        </button>
                        <div class="chat-head-copy">
                            <strong data-chat-title>消息中心</strong>
                            <div class="muted tiny" data-chat-subtitle>选择会话</div>
                        </div>
                    </div>
                    <div class="action-row">
                        <button class="chat-head-icon" type="button" data-chat-action="search" title="搜索">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
                        </button>
                        <button class="chat-head-icon" type="button" data-chat-action="more" title="更多 / 筛选" aria-label="更多 / 筛选">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14"></path><path d="M5 12h14"></path><path d="M5 17h14"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="chat-tabs" data-chat-tabs>
                    <button type="button" class="chat-tab active" data-chat-tab="all"><span class="chat-tab-label">全部</span><span class="chat-tab-underline"></span></button>
                    <button type="button" class="chat-tab" data-chat-tab="unread"><span class="chat-tab-label">未读</span><span class="tab-badge red" data-chat-tab-badge="unread">0</span><span class="chat-tab-underline"></span></button>
                    <button type="button" class="chat-tab" data-chat-tab="group"><span class="chat-tab-label">群聊</span><span class="chat-tab-underline"></span></button>
                    <button type="button" class="chat-tab" data-chat-tab="task"><span class="chat-tab-label">任务通知</span><span class="chat-tab-underline"></span></button>
                </div>
                <div class="chat-search-box" data-chat-search-box>
                    <button class="chat-search-back" type="button" data-chat-action="search-back" aria-label="返回">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
                    </button>
                    <div class="chat-search-field">
                        <input type="text" placeholder="搜索会话或消息" data-chat-search-input>
                        <button class="chat-search-submit" type="button" data-chat-action="search-run" aria-label="搜索">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="chat-body" data-chat-stream></div>
                <div class="chat-composer">
                    <div class="chat-reply" data-chat-reply></div>
                    <div class="chat-box" data-chat-drop-zone>
                        <div class="chat-toolbar">
                            <button class="chat-tool attach" data-chat-action="attach">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.5V7a4 4 0 0 0-8 0v8.5a2.5 2.5 0 0 0 5 0V8"></path><path d="M10 7v8.5a5 5 0 1 0 10 0V9"></path></svg>
                                <span>附件</span>
                            </button>
                            <button class="chat-tool" data-chat-action="announcement">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 11 14-5v12L3 13z"></path><path d="M11 14v5"></path></svg>
                                <span>公告</span>
                            </button>
                        </div>
                        <input type="file" data-chat-file-input multiple hidden />
                        <textarea data-chat-composer placeholder="输入消息，回车发送，Shift+Enter换行"></textarea>
                        <div class="chat-drop" data-chat-drop-hint>松开即可上传文件</div>
                        <div class="chat-mention" data-chat-mention></div>
                        <button type="button" class="chat-send" data-chat-action="send">发送</button>
                    </div>
                </div>
            </div>
            <div class="chat-more-menu" data-chat-more-menu></div>
            <div class="chat-toast-host" data-chat-toast-host></div>`;
        document.body.appendChild(panel);
        return panel;
    }

    function setUnread(visible) {
        var dot = q(".linksee-chat-dot", state.launcher);
        if (dot) dot.classList.toggle("show", Boolean(visible));
    }

    function syncTopActionsHidden(hidden) {
        // Keep dashboard top-actions stable. Only hide fallback floating launcher
        // when chat uses standalone mode (no integrated topbar launcher).
        if (!state.launcher || !state.launcher.classList.contains("linksee-chat-launcher")) {
            return;
        }
        state.launcher.style.display = hidden ? "none" : "";
        state.launcher.style.visibility = hidden ? "hidden" : "";
        state.launcher.style.pointerEvents = hidden ? "none" : "";
    }

    function setPanelMode(mode) {
        state.mode = mode === "chat" ? "chat" : "list";
        if (!state.panel) return;
        state.panel.classList.toggle("expanded", state.mode === "chat");
        state.panel.classList.toggle("mode-chat", state.mode === "chat");
        state.panel.classList.toggle("search-open", Boolean(state.search.open || state.listSearch.open));
        document.body.classList.toggle("chat-expanded", state.mode === "chat");
        var composer = q(".chat-composer", state.panel);
        var searchBox = q("[data-chat-search-box]", state.panel);
        if (composer) composer.style.display = state.mode === "chat" && !state.search.open ? "block" : "none";
        if (searchBox) searchBox.classList.toggle("show", state.mode === "chat" ? state.search.open : state.listSearch.open);
    }

    function syncConversationTabs() {
        if (!state.panel) return;
        var tabs = q("[data-chat-tabs]", state.panel);
        if (!tabs) return;
        qs("[data-chat-tab]", tabs).forEach(function (tab) {
            var key = tab.getAttribute("data-chat-tab");
            tab.classList.toggle("active", key === state.listTab);
            var badge = tab.querySelector("[data-chat-tab-badge]");
            if (badge) {
                badge.textContent = String(getTabCount(key) || 0);
                badge.style.display = Number(badge.textContent) > 0 ? "" : "none";
            }
        });
    }

    function closeMoreMenu() {
        if (!state.panel) return;
        var menu = q("[data-chat-more-menu]", state.panel);
        if (!menu) return;
        menu.style.display = "none";
        menu.innerHTML = "";
    }

    function ensureContextMenu() {
        if (state.contextMenu && state.contextMenu.isConnected) return state.contextMenu;
        var menu = document.createElement("div");
        menu.className = "chat-menu";
        menu.setAttribute("data-chat-menu", "");
        menu.addEventListener("click", function (event) {
            var menuAction = event.target.closest("[data-chat-menu-action]");
            if (!menuAction) return;
            var kind = menuAction.getAttribute("data-chat-menu-action");
            var messageId = menu.dataset.messageId;
            var msg = state.messages.find(function (m) { return String(m.id) === String(messageId); });
            closeContextMenu();
            if (!msg) return;
            if (kind === "reply") {
                state.replyTo = msg;
                state.editingMessageId = null;
                renderReply();
                q("[data-chat-composer]", state.panel).focus();
            }
            if (kind === "edit") {
                beginEditMessage(msg);
            }
            if (kind === "delete") {
                deleteMessage(messageId).catch(function (e) { showToast(e.message || "删除失败", true); });
            }
        });
        document.body.appendChild(menu);
        state.contextMenu = menu;
        return menu;
    }

    function openMoreMenu(anchor) {
        if (!state.panel) return;
        var menu = q("[data-chat-more-menu]", state.panel);
        if (!menu || !anchor) return;
        var rect = anchor.getBoundingClientRect();
        menu.innerHTML = [
            "<button type='button' data-chat-more-action='refresh'>刷新会话</button>",
            "<button type='button' data-chat-more-action='reset'>重置筛选</button>",
            "<button type='button' data-chat-more-action='close-panel'>关闭消息中心</button>",
        ].join("");
        menu.style.left = Math.max(12, rect.right - 160) + "px";
        menu.style.top = (rect.bottom + 8) + "px";
        menu.style.display = "block";
    }

    function syncUtilityCards() {
        var grid = q("[data-chat-utility-grid]", state.panel);
        if (!grid) return;
        qs(".chat-utility-card", grid).forEach(function (card) {
            var action = card.getAttribute("data-chat-action");
            var disabled = false;
            if (action === "history") disabled = !state.selected;
            if (action === "announcement") disabled = !state.selected || !isStaff();
            if (action === "load-more") disabled = !state.selected || !state.messagesPaging.hasMore || state.messagesPaging.loadingOlder;
            if (action === "back") disabled = !state.selected;
            card.disabled = disabled;
        });
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
    function buildMockConversationRows() {
        var now = Date.now();
        return [
            {
                id: "mock-student-conv",
                scopeType: "mock",
                scopeId: "mock-student",
                title: "虚拟测试会话",
                roomKey: "mock:student",
                unreadCount: 3,
                lastMessage: {
                    id: "mock-msg-0",
                    senderId: "system",
                    content: "这是用于前端测试的虚拟会话，可直接发送消息、回复、右键删除。",
                    createdAt: new Date(now).toISOString(),
                },
            },
        ];
    }
    async function loadConversations() {
        var payload = await window.linkseeApi.getJson("/api/v1/conversations");
        state.conversations = Array.isArray(payload.data) ? payload.data : [];
        state.conversations = state.conversations.slice().sort(function (a, b) {
            var aTime = a && a.lastMessage && a.lastMessage.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            var bTime = b && b.lastMessage && b.lastMessage.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            if (aTime !== bTime) return bTime - aTime;
            return String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
        });
        if ((shouldForceMockConversations() || !state.conversations.length) && auth().role === "student") {
            state.conversations = buildMockConversationRows();
        }
        if (state.selected) {
            var refreshedSelected = getConversationById(state.selected.id);
            if (refreshedSelected) {
                state.selected = refreshedSelected;
            }
        }
        state.unreadTotal = state.conversations.reduce(function (s, c) { return s + (Number(c.unreadCount) || 0); }, 0);
        setUnread(state.unreadTotal > 0);
        syncConversationTabs();
    }
    async function syncConversationList(shouldRender) {
        if (state.conversationListInFlight) return;
        state.conversationListInFlight = true;
        try {
            await loadConversations();
            state.lastConversationRefreshAt = Date.now();
            if (shouldRender) {
                renderMessages();
            }
        } finally {
            state.conversationListInFlight = false;
        }
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
    function resetMessagePaging() {
        state.messagesPaging = { hasMore: false, nextCursor: null, loadingOlder: false };
    }

    function mergeMessagePage(items, mode) {
        var normalized = Array.isArray(items) ? items.slice() : [];
        if (mode !== "append") {
            normalized.reverse();
        }
        if (mode === "prepend") {
            var existing = state.messages.slice();
            var seen = new Set(existing.map(function (m) { return String(m.id); }));
            normalized.forEach(function (m) {
                if (!seen.has(String(m.id))) {
                    existing.unshift(m);
                    seen.add(String(m.id));
                }
            });
            state.messages = existing;
        } else if (mode === "append") {
            var appended = state.messages.slice();
            var appendedSeen = new Set(appended.map(function (m) { return String(m.id); }));
            normalized.forEach(function (m) {
                if (!appendedSeen.has(String(m.id))) {
                    appended.push(m);
                    appendedSeen.add(String(m.id));
                }
            });
            state.messages = appended;
        } else {
            state.messages = normalized;
        }
    }

    async function loadMessages(options) {
        options = options || {};
        var reset = Boolean(options.reset);
        var beforeId = options.beforeId || "";
        var afterId = options.afterId || "";
        if (!state.selected) {
            state.messages = [];
            resetMessagePaging();
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
            resetMessagePaging();
            return;
        }
        var url = messagePath(state.selected.scopeType, state.selected.scopeId) + "?limit=30";
        if (beforeId) {
            url += "&beforeId=" + encodeURIComponent(String(beforeId));
        }
        if (afterId) {
            url += "&afterId=" + encodeURIComponent(String(afterId));
        }
        var payload = await window.linkseeApi.getJson(url);
        var items = Array.isArray(payload.data) ? payload.data : [];
        var paging = payload && payload.paging ? payload.paging : { hasMore: false, nextCursor: null };
        if (reset || (!beforeId && !afterId)) {
            mergeMessagePage(items, "replace");
        } else if (beforeId) {
            mergeMessagePage(items, "prepend");
        } else {
            mergeMessagePage(items, "append");
        }
        if (afterId) {
            state.messagesPaging = {
                hasMore: state.messagesPaging.hasMore,
                nextCursor: state.messagesPaging.nextCursor,
                loadingOlder: state.messagesPaging.loadingOlder,
            };
            return;
        }
        state.messagesPaging = {
            hasMore: Boolean(paging.hasMore),
            nextCursor: paging.nextCursor || null,
            loadingOlder: Boolean(beforeId) && state.messagesPaging.loadingOlder,
        };
    }

    async function fetchMessageSlice(options) {
        options = options || {};
        var beforeId = options.beforeId || "";
        var afterId = options.afterId || "";
        var limit = Number(options.limit) || 15;
        if (!state.selected) {
            return { items: [], paging: { hasMore: false, nextCursor: null } };
        }
        if (state.selected.scopeType === "mock") {
            var store = getConversationMessageStore().sort(compareMessagesChronologically);
            var cursorIndex = -1;
            if (beforeId || afterId) {
                cursorIndex = store.findIndex(function (m) { return String(m.id) === String(beforeId || afterId); });
            }
            var items = [];
            if (beforeId && cursorIndex >= 0) {
                var start = Math.max(0, cursorIndex - limit);
                items = store.slice(start, cursorIndex);
                return {
                    items: items,
                    paging: { hasMore: start > 0, nextCursor: items.length ? String(items[0].id) : null },
                };
            }
            if (afterId && cursorIndex >= 0) {
                var end = Math.min(store.length, cursorIndex + 1 + limit);
                items = store.slice(cursorIndex + 1, end);
                return {
                    items: items,
                    paging: { hasMore: end < store.length, nextCursor: items.length ? String(items[items.length - 1].id) : null },
                };
            }
            items = store.slice(Math.max(0, store.length - limit));
            return {
                items: items,
                paging: { hasMore: store.length > limit, nextCursor: items.length ? String(items[0].id) : null },
            };
        }
        var url = messagePath(state.selected.scopeType, state.selected.scopeId) + "?limit=" + encodeURIComponent(String(limit));
        if (beforeId) {
            url += "&beforeId=" + encodeURIComponent(String(beforeId));
        }
        if (afterId) {
            url += "&afterId=" + encodeURIComponent(String(afterId));
        }
        var payload = await window.linkseeApi.getJson(url);
        var rawItems = Array.isArray(payload.data) ? payload.data.slice() : [];
        var itemsChrono = afterId ? rawItems : rawItems.reverse();
        return {
            items: itemsChrono,
            paging: payload && payload.paging ? payload.paging : { hasMore: false, nextCursor: null },
        };
    }

    function renderConversationSelector() {
        var stream = q("[data-chat-stream]", state.panel);
        var list = getFilteredConversations();
        syncConversationTabs();
        if (!state.conversations.length) {
            stream.innerHTML = "<div class='chat-empty-state'><strong>暂无会话</strong><span>你当前没有可用聊天会话。等课程、小组或公告消息出现后，这里会自动列出来。</span></div>";
            return;
        }
        if (!list.length) {
            stream.innerHTML = "<div class='chat-empty-state'><strong>没有符合条件的会话</strong><span>试试切换 tab 或清空搜索关键词，消息列表会在这里展示。</span></div>";
            return;
        }
        stream.innerHTML = list.map(function (c) {
            var previewSource = state.listTab === "task" && c.lastTaskMessage ? c.lastTaskMessage : c.lastMessage;
            var preview = getConversationPreview(c);
            var unread = Number(c.unreadCount) || 0;
            var active = state.selected && String(state.selected.id) === String(c.id);
            var lastTime = formatConversationTime(previewSource && previewSource.createdAt);
            var avatarSource = state.participantsMap.get(String(previewSource && previewSource.senderId || "")) || state.me;
            return "<div class='chat-conversation-item" + (active ? " is-active" : "") + "' data-chat-open='" + c.id + "'>" +
                "<div class='chat-avatar'><img src='" + userAvatar(avatarSource) + "' alt=''></div>" +
                "<div class='chat-conversation-item-main'>" +
                "<div class='line1'>" +
                "<strong>" + escapeHtml(c.title || c.roomKey || ("会话 " + c.id)) + "</strong>" +
                "<span class='time'>" + escapeHtml(lastTime) + "</span>" +
                "</div>" +
                "<div class='line2'>" + escapeHtml(preview) + "</div>" +
                "</div>" +
                (unread ? "<div class='unread-pill'>" + escapeHtml(unread > 99 ? "99+" : String(unread)) + "</div>" : "") +
                "</div>";
        }).join("");
    }

    function buildReplyQuote(message) {
        if (!message) return "";
        var sender = state.participantsMap.get(String(message.senderId));
        var name = sender ? userName(sender) : message.senderId;
        var snippet = message.content || (Array.isArray(message.files) && message.files.length ? "[文件消息]" : "[消息]");
        if (!message.content && Array.isArray(message.files) && message.files.length) {
            snippet = message.files.map(function (file) { return file && file.name ? file.name : "附件"; }).join("、");
        }
        return "回复 " + name + "： " + snippet.slice(0, 80);
    }

    function renderFileCard(message, file, index) {
        var key = fileKey(message.id, index);
        var activity = getFileActivity(key);
        var expiryText = formatExpiryLabel(file);
        var expired = expiryText === "已过期";
        var title = file && file.name ? file.name : "附件";
        var metaText = buildFileMetaText(file);
        var fileIcon = "<svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor' stroke-width='1.8'><path d='M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z'></path><path d='M14 2v5h5'></path></svg>";
        var progress = activity && typeof activity.progress === "number" ? activity.progress : (file && typeof file.progress === "number" ? file.progress : null);
        var mode = activity && activity.mode ? activity.mode : (file && file.pending ? "upload" : "");
        var isDownloaded = mode === "downloaded";
        var busy = progress !== null && progress < 100;
        var actionLabel = expired ? "已过期" : (busy ? (mode === "upload" ? "上传中" : "下载中") : "下载");
        return [
            "<div class='chat-file" + (file && file.pending ? " is-pending is-uploading" : "") + (isDownloaded ? " is-downloaded" : "") + "'>",
            "<button type='button' class='chat-file-icon' aria-label='" + escapeHtml(actionLabel) + "' data-chat-file='" + escapeHtml(String(message.id)) + ":" + index + "'" + (expired || mode === "upload" ? " disabled" : "") + ">" + fileIcon + (progress !== null ? createProgressRing(progress, busy ? Math.round(progress) + "%" : (mode === "upload" ? "上传" : "下载")) : "") + "</button>",
            "<div class='chat-file-body'>",
            "<div class='chat-file-name' title='" + escapeHtml(title) + "'>" + escapeHtml(title) + "</div>",
            "<div class='chat-file-meta'>",
            metaText ? "<span class='meta-text' title='" + escapeHtml(metaText) + "'>" + escapeHtml(metaText) + "</span>" : "",
            expiryText ? "<span class='chat-file-expiry" + (expired ? " expired" : "") + "' title='" + escapeHtml(file.expiresAt || "") + "'>" + escapeHtml(expiryText) + "</span>" : "",
            "</div>",
            "</div>",
            "</div>",
        ].join("");
    }

    function renderMessageHeader(message, me, sender) {
        var timeText = message.pending ? "上传中" : (window.linkseePage && typeof window.linkseePage.formatDateTime === "function" ? window.linkseePage.formatDateTime(message.createdAt) : new Date(message.createdAt).toLocaleString("zh-CN", { hour12: false }));
        return "<div class='chat-message-head" + (me ? " me" : "") + "'>" +
            "<strong>" + escapeHtml(sender ? userName(sender) : message.senderId) + "</strong>" +
            "<span>" + escapeHtml(timeText) + "</span>" +
            "</div>";
    }

    function renderMessageContentText(text) {
        return "<div class='chat-text'>" + escapeHtml(text || "").replace(/\r?\n/g, "<br>") + "</div>";
    }

    function renderFileMessage(message, me, sender, quoted) {
        return [
            "<div class='chat-row file-row" + (me ? " me" : "") + (message.pending ? " is-pending" : "") + "' data-chat-message-id='" + escapeHtml(String(message.id || ("pending-" + message.pendingId))) + "'>",
            me ? "" : "<div class='chat-avatar'><img src='" + userAvatar(sender) + "' alt=''></div>",
            "<div class='chat-file-thread'>",
            renderMessageHeader(message, me, sender),
            quoted ? "<div class='chat-quote'>" + escapeHtml(buildReplyQuote(quoted)) + "</div>" : "",
            message.pending ? "<div class='chat-del'>正在上传附件，请稍候</div>" : "",
            "<div class='chat-files'>" + (Array.isArray(message.files) ? message.files.map(function (f, i) {
                return renderFileCard(message, f, i);
            }).join("") : "") + "</div>",
            "</div>",
            me ? "<div class='chat-avatar'><img src='" + userAvatar(state.me) + "' alt=''></div>" : "",
            "</div>",
        ].join("");
    }

    function renderReply() {
        var box = q("[data-chat-reply]", state.panel);
        if (!state.replyTo && !state.editingMessageId) {
            box.classList.remove("show");
            box.textContent = "";
            return;
        }
        box.classList.add("show");
        if (state.editingMessageId) {
            box.textContent = "正在编辑消息，Esc 取消";
            return;
        }
        box.textContent = buildReplyQuote(state.replyTo) + "（Esc 取消）";
    }

    function clearEditingState() {
        state.editingMessageId = null;
        renderReply();
    }

    function beginEditMessage(message) {
        if (!message || message.deletedAt || Array.isArray(message.files) && message.files.length > 0) return;
        state.replyTo = null;
        state.editingMessageId = String(message.id);
        var ta = q("[data-chat-composer]", state.panel);
        if (ta) {
            ta.value = message.content || "";
            ta.focus();
            ta.setSelectionRange(ta.value.length, ta.value.length);
        }
        renderReply();
    }

    function renderMessages() {
        var stream = q("[data-chat-stream]", state.panel);
        var title = q("[data-chat-title]", state.panel);
        var subtitle = q("[data-chat-subtitle]", state.panel);
        syncUtilityCards();
        if (!state.selected) {
            title.textContent = "消息中心";
            subtitle.textContent = state.unreadTotal > 0 ? ("当前共有 " + state.unreadTotal + " 条未读") : "";
            setPanelMode("list");
            renderConversationSelector();
            return;
        }
        setPanelMode("chat");
        title.textContent = state.selected.title || state.selected.roomKey || "会话";
        var renderList = getActiveMessageList();
        var subtitleText = state.selected.scopeType === "group" ? "小组聊天" : "课程聊天";
        if (isSearchOpen() && state.search.keyword) {
            if (isSearchContextMode()) {
                subtitleText += " · 搜索上下文 · “" + state.search.keyword + "”";
            } else {
                subtitleText += " · 搜索 “" + state.search.keyword + "” · " + renderList.length + " 条结果";
            }
        }
        subtitle.textContent = subtitleText;
        if (!renderList.length) {
            stream.innerHTML = isSearchOpen()
                ? "<div class='chat-empty-state'><strong>没有找到匹配结果</strong><span>可以换个关键词再试试，或者退出搜索后继续浏览完整消息流。</span></div>"
                : "<div class='chat-empty-state'><strong>还没有消息</strong><span>可以先发一条文字，或者拖拽上传文件。右键消息还能回复和删除。</span></div>";
            return;
        }

        var olderHint = !isSearchOpen() && state.messagesPaging.hasMore ? "<button type='button' class='chat-load-more' data-chat-action='load-more'>加载更早消息</button>" : "";
        var unreadBoundary = getUnreadBoundaryInfo(renderList);
        var searchContextBar = "";
        if (isSearchOpen()) {
            if (isSearchContextMode()) {
                searchContextBar =
                    "<div class='chat-search-context-bar'>" +
                    "<button type='button' class='chat-search-context-btn' data-chat-action='search-context-back'>返回搜索结果</button>" +
                    (state.search.contextHasOlder ? "<span class='chat-search-context-sep'></span><button type='button' class='chat-search-context-btn' data-chat-action='search-context-older'>加载更早上下文</button>" : "") +
                    (state.search.contextHasNewer ? "<span class='chat-search-context-sep'></span><button type='button' class='chat-search-context-btn' data-chat-action='search-context-newer'>加载更新上下文</button>" : "") +
                    "</div>";
            } else if (renderList.length) {
                searchContextBar =
                    "<div class='chat-search-context-bar'>" +
                    "<span class='chat-search-context-hint'>点击搜索结果可查看前后文</span>" +
                    "</div>";
            }
        }
        var renderedItems = [];
        for (var idx = 0; idx < renderList.length; idx += 1) {
            if (unreadBoundary.count > 0 && idx === unreadBoundary.index) {
                renderedItems.push(
                    "<div class='chat-divider'>" +
                    "<button type='button' class='chat-divider-jump' data-chat-action='jump-latest'><span class='chat-divider-line'></span><span class='chat-divider-label'>以上有 " + escapeHtml(unreadBoundary.count > 99 ? "99+" : String(unreadBoundary.count)) + " 条新消息</span><span class='chat-divider-line'></span></button>" +
                    "<div class='chat-divider-subtitle'>以下为最新消息</div>" +
                    "</div>",
                );
            }
            var m = renderList[idx];
            var me = String(m.senderId) === String(auth().userId);
            var sender = state.participantsMap.get(String(m.senderId));
            var deleted = Boolean(m.deletedAt);
            var quoted = state.messages.find(function (x) { return String(x.id) === String(m.replyToId || ""); });
            var mentions = Array.isArray(m.mentions) ? m.mentions.map(function (id) { return "@" + escapeHtml(mentionName(id)); }).join(" ") : "";
            var isFileMessage = Array.isArray(m.files) && m.files.length > 0;
            if (isFileMessage) {
                renderedItems.push(renderFileMessage(m, me, sender, quoted));
                continue;
            }
            renderedItems.push([
                "<div class='chat-row" + (me ? " me" : "") + (m.pending ? " is-pending" : "") + "' data-chat-message-id='" + escapeHtml(String(m.id || ("pending-" + m.pendingId))) + "'" + (isSearchOpen() && !isSearchContextMode() ? " data-chat-open-context='" + escapeHtml(String(m.id || "")) + "'" : "") + ">",
                me ? "" : "<div class='chat-avatar'><img src='" + userAvatar(sender) + "' alt=''></div>",
                "<div class='chat-message-stack" + (me ? " me" : "") + "'>",
                renderMessageHeader(m, me, sender),
                "<div class='chat-msg" + (me ? " me" : "") + (m.pending ? " is-pending" : "") + "'>",
                quoted ? "<div class='chat-quote'>" + escapeHtml(buildReplyQuote(quoted)) + "</div>" : "",
            m.pending ? "<div class='chat-del'>正在上传附件，请稍候</div>" : (deleted ? "<div class='chat-del'>该消息已删除</div>" : renderMessageContentText(m.content || "")),
                mentions ? ("<div class='muted tiny'>" + mentions + "</div>") : "",
                deleted ? "" : "",
                "</div>",
                "</div>",
                me ? "<div class='chat-avatar'><img src='" + userAvatar(state.me) + "' alt=''></div>" : "",
                "</div>",
            ].join(""));
        }
        stream.innerHTML = searchContextBar + olderHint + renderedItems.join("");
        if (!state.messagesPaging.loadingOlder) {
            stream.scrollTop = stream.scrollHeight;
        }
        scheduleReadSync();
    }

    async function loadOlderMessages() {
        if (!state.selected || !state.messagesPaging.hasMore || state.messagesPaging.loadingOlder) return;
        var stream = q("[data-chat-stream]", state.panel);
        var beforeId = state.messagesPaging.nextCursor;
        if (!beforeId) return;
        var previousScrollHeight = stream ? stream.scrollHeight : 0;
        var previousScrollTop = stream ? stream.scrollTop : 0;
        state.messagesPaging.loadingOlder = true;
        renderMessages();
        await loadMessages({ beforeId: beforeId });
        renderMessages();
        if (stream) {
            stream.scrollTop = stream.scrollHeight - previousScrollHeight + previousScrollTop;
        }
        state.messagesPaging.loadingOlder = false;
    }

    async function catchUpLatestMessages() {
        if (!state.selected || isMockConversation() || isSearchOpen()) return;
        var latestId = getLatestMessageId(state.messages);
        if (!latestId) return;
        await loadMessages({ afterId: latestId });
        renderMessages();
    }

    async function openConversationById(id) {
        var target = getConversationById(id);
        if (!target) return;
        state.selected = target;
        state.readBoundaryAt = target.lastReadAt || null;
        state.openUnreadCount = Math.max(0, Number(target.unreadCount) || 0);
        state.replyTo = null;
        state.editingMessageId = null;
        resetSearchState();
        state.lastReadMessageId = null;
        syncConversationSummaryLocal(target.id, 0, target.lastReadAt || null);
        renderReply();
        await loadParticipants();
        await loadMessages();
        renderMessages();
        syncSelectedConversationRead().catch(function () {});
        scheduleReadSync();
    }

    async function openConversationByScope(scopeType, scopeId) {
        if (!scopeType || !scopeId) return;
        if (!state.conversations.length) {
            await syncConversationList(false);
        }
        var target = state.conversations.find(function (conversation) {
            return String(conversation.scopeType || "") === String(scopeType) && String(conversation.scopeId || "") === String(scopeId);
        }) || null;
        if (!target) {
            await syncConversationList(true);
            target = state.conversations.find(function (conversation) {
                return String(conversation.scopeType || "") === String(scopeType) && String(conversation.scopeId || "") === String(scopeId);
            }) || null;
        }
        if (!target) return;
        setChatOpen(true);
        state.mode = "list";
        await openConversationById(target.id);
        renderMessages();
    }

    function backToList() {
        state.selected = null;
        state.readBoundaryAt = null;
        state.openUnreadCount = 0;
        state.replyTo = null;
        state.editingMessageId = null;
        resetSearchState();
        renderReply();
        renderMessages();
    }

    async function refreshPanel() {
        if (!state.selected) {
            await syncConversationList(false);
            renderMessages();
            return;
        }
        await syncConversationList(false);
        await loadParticipants();
        if (isSearchOpen() && state.search.keyword) {
            await runSearch(true);
        } else {
            await loadMessages();
        }
        renderMessages();
        scheduleReadSync();
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
        await window.linkseeApi.postJson(
            announcementPath(state.selected.scopeType, state.selected.scopeId),
            { content: text.trim() },
            { "Idempotency-Key": createIdempotencyKey("chat-announcement") },
        );
        showToast("公告已发布");
        await loadConversations();
        await loadMessages();
        renderMessages();
        scheduleReadSync();
    }

    async function searchHistory() {
        var box = q("[data-chat-search-box]", state.panel);
        if (!state.selected) {
            state.search.open = false;
            state.search.keyword = "";
            state.listSearch.open = true;
            state.listSearch.keyword = state.listSearch.keyword || "";
            renderMessages();
            var listInput = q("[data-chat-search-input]", state.panel);
            if (!listInput) return;
            listInput.value = state.listSearch.keyword || "";
            listInput.focus();
            if (listInput.value) {
                listInput.setSelectionRange(listInput.value.length, listInput.value.length);
            }
            return;
        }
        state.listSearch.open = false;
        var input = q("[data-chat-search-input]", box);
        if (!input) return;
        state.search.open = true;
        state.search.contextAnchorId = "";
        state.search.contextMessages = [];
        state.search.contextHasOlder = false;
        state.search.contextHasNewer = false;
        box.classList.add("show");
        input.value = state.search.keyword || "";
        input.focus();
        if (input.value) {
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    async function runSearch(skipToast) {
        var input = q("[data-chat-search-input]", state.panel);
        var keyword = (input.value || "").trim();
        if (!keyword) return showToast("请输入关键词", true);
        if (!state.selected) {
            state.listSearch.open = true;
            state.listSearch.keyword = keyword;
            renderMessages();
            if (!skipToast) showToast("已筛选会话");
            return;
        }
        state.search.open = true;
        state.search.keyword = keyword;
        state.search.contextAnchorId = "";
        state.search.contextMessages = [];
        state.search.contextHasOlder = false;
        state.search.contextHasNewer = false;
        state.search.baseLatestMessageId = state.search.baseLatestMessageId || getLatestMessageId(state.messages);
        if (state.selected && state.selected.scopeType === "mock") {
            state.search.results = (state.selected.__mockMessages || []).filter(function (m) {
                return String(m.content || "").indexOf(keyword) >= 0;
            });
            renderMessages();
            if (!skipToast) showToast("已切换到搜索结果（mock）");
            return;
        }
        var payload = await window.linkseeApi.getJson(searchPath(state.selected.scopeType, state.selected.scopeId, keyword));
        state.search.results = Array.isArray(payload.data) ? payload.data.slice().reverse() : [];
        renderMessages();
        if (!skipToast) showToast("已切换到搜索结果");
    }

    async function openSearchContext(messageId) {
        if (!state.selected || !isSearchOpen()) return;
        var anchor = (state.search.results || []).find(function (m) { return String(m.id) === String(messageId); })
            || state.messages.find(function (m) { return String(m.id) === String(messageId); });
        if (!anchor) return;
        var beforeSlice = await fetchMessageSlice({ beforeId: messageId, limit: 12 });
        var afterSlice = await fetchMessageSlice({ afterId: messageId, limit: 12 });
        state.search.contextAnchorId = String(messageId);
        state.search.contextMessages = mergeChronologicalMessages(
            mergeChronologicalMessages(beforeSlice.items, [anchor]),
            afterSlice.items,
        );
        state.search.contextHasOlder = Boolean(beforeSlice.paging && beforeSlice.paging.hasMore);
        state.search.contextHasNewer = Boolean(afterSlice.paging && afterSlice.paging.hasMore);
        renderMessages();
    }

    async function extendSearchContext(direction) {
        if (!state.selected || !isSearchContextMode()) return;
        var list = state.search.contextMessages || [];
        if (!list.length) return;
        if (direction === "older") {
            var oldestId = String(list[0].id || "");
            if (!oldestId) return;
            var olderSlice = await fetchMessageSlice({ beforeId: oldestId, limit: 12 });
            state.search.contextMessages = mergeChronologicalMessages(olderSlice.items, state.search.contextMessages);
            state.search.contextHasOlder = Boolean(olderSlice.paging && olderSlice.paging.hasMore);
            renderMessages();
            return;
        }
        var newestId = String(list[list.length - 1].id || "");
        if (!newestId) return;
        var newerSlice = await fetchMessageSlice({ afterId: newestId, limit: 12 });
        state.search.contextMessages = mergeChronologicalMessages(state.search.contextMessages, newerSlice.items);
        state.search.contextHasNewer = Boolean(newerSlice.paging && newerSlice.paging.hasMore);
        renderMessages();
    }

    function exitSearchContext() {
        state.search.contextAnchorId = "";
        state.search.contextMessages = [];
        state.search.contextHasOlder = false;
        state.search.contextHasNewer = false;
        renderMessages();
    }

    async function closeSearch() {
        q("[data-chat-search-box]", state.panel).classList.remove("show");
        q("[data-chat-search-input]", state.panel).value = "";
        if (!state.selected) {
            state.listSearch.open = false;
            state.listSearch.keyword = "";
            renderMessages();
            return;
        }
        var latestBeforeSearch = state.search.baseLatestMessageId || "";
        resetSearchState();
        if (latestBeforeSearch && !isMockConversation()) {
            await loadMessages({ afterId: latestBeforeSearch });
        }
        renderMessages();
        scheduleReadSync();
    }

    async function sendText() {
        if (!state.selected) return showToast("请先选择会话", true);
        var ta = q("[data-chat-composer]", state.panel);
        var content = (ta.value || "").trim();
        if (!content) return;
        if (state.editingMessageId) {
            var editBody = { type: "text", content: content };
            var editMentions = parseMentions(content);
            if (editMentions.length) editBody.mentions = editMentions;
            if (state.selected.scopeType === "mock") {
                state.selected.__mockMessages = (state.selected.__mockMessages || []).map(function (m) {
                    if (String(m.id) !== String(state.editingMessageId)) return m;
                    return Object.assign({}, m, {
                        content: content,
                        mentions: editMentions,
                        editedAt: new Date().toISOString(),
                    });
                });
                ta.value = "";
                clearEditingState();
                renderMessages();
                return showToast("消息已更新（mock）");
            }
            await window.linkseeApi.patchJson(
                messagePath(state.selected.scopeType, state.selected.scopeId) + "/" + encodeURIComponent(state.editingMessageId),
                editBody,
            );
            ta.value = "";
            clearEditingState();
            await loadConversations();
            await loadMessages();
            renderMessages();
            scheduleReadSync();
            return showToast("消息已更新");
        }
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
            scheduleReadSync();
            return;
        }
        var body = { type: "text", content: content };
        var mentions = parseMentions(content);
        if (mentions.length) body.mentions = mentions;
        if (state.replyTo) body.replyToId = String(state.replyTo.id);
        await window.linkseeApi.postJson(
            messagePath(state.selected.scopeType, state.selected.scopeId),
            body,
            { "Idempotency-Key": createIdempotencyKey("chat-message") },
        );
        ta.value = "";
        state.replyTo = null;
        renderReply();
        closeMention();
        await loadConversations();
        await loadMessages();
        renderMessages();
        scheduleReadSync();
    }

    function getFileInput() {
        return q("[data-chat-file-input]", state.panel);
    }

    async function openFilePicker() {
        var input = getFileInput();
        if (!input) return;
        input.value = "";
        input.click();
    }

    function buildFileMessageContent(files) {
        if (!Array.isArray(files) || !files.length) return "附件";
        if (files.length === 1) return files[0].name || "附件";
        return buildFileSummary(files);
    }

    function uploadFileWithProgress(uploadUrl, headers, file, onProgress) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadUrl, true);
            Object.keys(headers || {}).forEach(function (key) {
                xhr.setRequestHeader(key, headers[key]);
            });
            xhr.upload.onprogress = function (event) {
                if (!event || !event.lengthComputable) return;
                if (typeof onProgress === "function") {
                    onProgress(Math.max(0, Math.min(100, (event.loaded / event.total) * 100)));
                }
            };
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    if (typeof onProgress === "function") onProgress(100);
                    resolve();
                    return;
                }
                reject(new Error("上传文件失败"));
            };
            xhr.onerror = function () {
                reject(new Error("上传文件失败"));
            };
            xhr.send(file);
        });
    }

    async function uploadFiles(fileList) {
        if (!state.selected) return showToast("请先选择会话", true);
        var files = Array.from(fileList || []);
        if (!files.length) return;
        var accepted = [];
        for (var j = 0; j < files.length; j += 1) {
            var checkFile = files[j];
            if (!isAllowedChatMimeType(checkFile.type || "")) {
                showToast("文件“" + checkFile.name + "”类型不支持", true);
                continue;
            }
            if (checkFile.size > 500 * 1024 * 1024) {
                showToast("文件“" + checkFile.name + "”超过 500MB", true);
                continue;
            }
            accepted.push(checkFile);
        }
        if (!accepted.length) return;

        if (state.selected.scopeType === "mock") {
            var mockPendingId = "mock-pending-upload-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
            var mockPendingFiles = accepted.map(function (file) {
                return {
                    name: file.name,
                    size: file.size,
                    mimeType: file.type || "application/octet-stream",
                    uploadedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    progress: 0,
                    pending: true,
                };
            });
            var mockPendingMessage = {
                id: mockPendingId,
                pending: true,
                pendingId: mockPendingId,
                senderId: auth().userId || "student",
                content: buildFileMessageContent(mockPendingFiles),
                files: mockPendingFiles,
                mentions: [],
                replyToId: state.replyTo ? String(state.replyTo.id) : null,
                createdAt: new Date().toISOString(),
                deletedAt: null,
            };
            state.pendingUploads.push(mockPendingMessage);
            renderMessages();
            for (var mi = 0; mi < mockPendingFiles.length; mi += 1) {
                for (var step = 0; step < 4; step += 1) {
                    mockPendingFiles[mi].progress = Math.min(100, (step + 1) * 25);
                    mockPendingMessage.files = mockPendingFiles.slice();
                    renderMessages();
                    await new Promise(function (resolve) { setTimeout(resolve, 120); });
                }
                mockPendingFiles[mi].pending = false;
            }
            state.selected.__mockMessages.push({
                id: "mock-file-" + Date.now(),
                senderId: auth().userId || "student",
                content: buildFileMessageContent(mockPendingFiles),
                files: mockPendingFiles.map(function (file) {
                    return {
                        name: file.name,
                        size: file.size,
                        mimeType: file.mimeType,
                        objectKey: "mock://" + file.name,
                        uploadedAt: file.uploadedAt,
                        expiresAt: file.expiresAt,
                    };
                }),
                mentions: [],
                replyToId: state.replyTo ? String(state.replyTo.id) : null,
                createdAt: new Date().toISOString(),
                deletedAt: null,
            });
            state.pendingUploads = state.pendingUploads.filter(function (item) { return String(item.id) !== String(mockPendingId); });
            state.replyTo = null;
            renderReply();
            await loadMessages();
            renderMessages();
            return showToast("已上传 " + accepted.length + " 个文件（mock）");
        }

        var pendingId = "pending-upload-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        var pendingFiles = accepted.map(function (file) {
            return {
                name: file.name,
                size: file.size,
                mimeType: file.type || "application/octet-stream",
                uploadedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                progress: 0,
                pending: true,
            };
        });
        var pendingMessage = {
            id: pendingId,
            pending: true,
            pendingId: pendingId,
            senderId: auth().userId || "student",
            content: buildFileMessageContent(pendingFiles),
            files: pendingFiles,
            mentions: [],
            replyToId: state.replyTo ? String(state.replyTo.id) : null,
            createdAt: new Date().toISOString(),
            deletedAt: null,
        };
        state.pendingUploads.push(pendingMessage);
        renderMessages();

        var supported = [];
        for (var i = 0; i < accepted.length; i += 1) {
            var file = accepted[i];
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
                await uploadFileWithProgress(data.uploadUrl, headerMap, file, function (progress) {
                    pendingFiles[i].progress = progress;
                    pendingMessage.files = pendingFiles.slice();
                    renderMessages();
                });
                supported.push({
                    objectKey: data.objectKey,
                    name: file.name,
                    size: file.size,
                    mimeType: file.type || "application/octet-stream",
                    uploadedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                });
            } catch (err) {
                showToast("文件“" + file.name + "”上传失败：" + (err && err.message ? err.message : "未知错误"), true);
            }
        }
        if (supported.length > 0) {
            var body = { type: "file", content: buildFileMessageContent(supported), files: supported };
            if (state.replyTo) body.replyToId = String(state.replyTo.id);
            await window.linkseeApi.postJson(
                messagePath(state.selected.scopeType, state.selected.scopeId),
                body,
                { "Idempotency-Key": createIdempotencyKey("chat-file") },
            );
            state.pendingUploads = state.pendingUploads.filter(function (item) { return String(item.id) !== String(pendingId); });
            renderMessages();
            showToast("已上传 " + supported.length + " 个文件");
            await loadConversations();
            await loadMessages();
            renderMessages();
            scheduleReadSync();
        } else {
            state.pendingUploads = state.pendingUploads.filter(function (item) { return String(item.id) !== String(pendingId); });
            renderMessages();
        }
    }

    async function downloadMessageFile(messageId, index) {
        var msg = state.messages.find(function (m) { return String(m.id) === String(messageId); });
        if (!msg || !Array.isArray(msg.files) || !msg.files[index]) return;
        var f = msg.files[index];
        var key = fileKey(messageId, index);
        if (f.expiresAt && new Date(f.expiresAt).getTime() <= Date.now()) {
            showToast("附件已过期，无法下载", true);
            return;
        }
        if (state.selected && state.selected.scopeType === "mock") {
            return showToast("mock 会话不提供真实下载链接");
        }
        try {
            setFileActivity(key, { mode: "download", progress: 12 });
            renderMessages();
            var payload = await window.linkseeApi.getJson("/api/v1/chat/files/presign-download?objectKey=" + encodeURIComponent(f.objectKey));
            var url = payload && payload.data && payload.data.downloadUrl;
            if (!url) {
                throw new Error("下载链接生成失败");
            }
            setFileActivity(key, { mode: "download", progress: 72 });
            renderMessages();
            var a = document.createElement("a");
            a.href = url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setFileActivity(key, { mode: "downloaded", progress: 100 });
            renderMessages();
        } finally {
            setTimeout(function () {
                var current = getFileActivity(key);
                if (current && current.mode !== "downloaded") {
                    setFileActivity(key, null);
                    renderMessages();
                }
            }, 350);
        }
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
        var menu = ensureContextMenu();
        var canDelete = String(message.senderId) === String(auth().userId) || isStaff();
        var canEdit = !message.deletedAt && !message.pending && !Array.isArray(message.files) && String(message.senderId) === String(auth().userId);
        var items = [
            "<button type='button' data-chat-menu-action='reply'>回复</button>",
            canEdit ? "<button type='button' data-chat-menu-action='edit'>编辑</button>" : "",
            canDelete ? "<button type='button' data-chat-menu-action='delete'>删除</button>" : "",
        ].join("");
        menu.innerHTML = items;
        var width = 150;
        var height = 96;
        var left = Math.min(Math.max(12, x), Math.max(12, window.innerWidth - width - 12));
        var top = Math.min(Math.max(12, y), Math.max(12, window.innerHeight - height - 12));
        menu.style.left = left + "px";
        menu.style.top = top + "px";
        menu.style.display = "block";
        menu.dataset.messageId = String(message.id);
    }

    function closeContextMenu() {
        var menu = state.contextMenu || ensureContextMenu();
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
        await loadConversations();
        await loadMessages();
        renderMessages();
        scheduleReadSync();
    }

    function startExpiryTicker() {
        if (state.expiryTimer) return;
        state.expiryTimer = setInterval(function () {
            if (!state.open) return;
            renderMessages();
        }, 60000);
    }

    function stopExpiryTicker() {
        if (!state.expiryTimer) return;
        clearInterval(state.expiryTimer);
        state.expiryTimer = null;
    }

    function setChatOpen(nextOpen) {
        state.open = Boolean(nextOpen);
        state.panel.classList.toggle("open", state.open);
        document.body.classList.toggle("linksee-chat-docked-open", state.open);
        syncTopActionsHidden(state.open);
        if (state.open) {
            startExpiryTicker();
            startRealtimeTicker();
            syncConversationList(false).catch(function () {});
            syncRealtimeForSelectedConversation().catch(function () {});
        } else {
            resetSearchState();
            state.replyTo = null;
            state.editingMessageId = null;
            stopExpiryTicker();
            stopRealtimeTicker();
        }
    }

    function bindEvents() {
        state.launcher.addEventListener("click", function () {
            setChatOpen(!state.open);
            if (state.open) {
                loadConversations().then(function () {
                    renderMessages();
                    return state.selected ? openConversationById(state.selected.id) : null;
                }).catch(function (e) { showToast(e.message || "加载失败", true); });
            }
        });

        state.panel.addEventListener("click", function (event) {
            var moreAction = event.target.closest("[data-chat-more-action]");
            if (moreAction) {
                var moreKind = moreAction.getAttribute("data-chat-more-action");
                closeMoreMenu();
                if (moreKind === "refresh") {
                    refreshPanel().catch(function (e) { showToast(e.message || "刷新失败", true); });
                }
                if (moreKind === "reset") {
                    state.listTab = "all";
                    state.listSearch.open = false;
                    state.listSearch.keyword = "";
                    resetSearchState();
                    renderMessages();
                    loadConversations().catch(function () {});
                }
                if (moreKind === "close-panel") {
                    setChatOpen(false);
                }
                return;
            }

            var actionNode = event.target.closest("[data-chat-action]");
            if (actionNode) {
            var action = actionNode.getAttribute("data-chat-action");
            if (action === "close") {
                setChatOpen(false);
                document.body.classList.remove("chat-expanded");
            }
                if (action === "back") backToList();
                if (action === "search") searchHistory().catch(function (e) { showToast(e.message || "操作失败", true); });
                if (action === "send") sendText().catch(function (e) { showToast(e.message || "发送失败", true); });
                if (action === "attach") openFilePicker().catch(function (e) { showToast(e.message || "打开文件选择器失败", true); });
                if (action === "announcement") sendAnnouncement().catch(function (e) { showToast(e.message || "公告发布失败", true); });
                if (action === "search-run") runSearch().catch(function (e) { showToast(e.message || "搜索失败", true); });
                if (action === "search-back") closeSearch().catch(function () {});
                if (action === "search-context-back") exitSearchContext();
                if (action === "search-context-older") extendSearchContext("older").catch(function (e) { showToast(e.message || "加载上下文失败", true); });
                if (action === "search-context-newer") extendSearchContext("newer").catch(function (e) { showToast(e.message || "加载上下文失败", true); });
                if (action === "load-more") loadOlderMessages().catch(function (e) { showToast(e.message || "加载失败", true); });
                if (action === "jump-latest") {
                    catchUpLatestMessages().catch(function () {}).finally(function () {
                        var jumpStream = q("[data-chat-stream]", state.panel);
                        if (jumpStream) jumpStream.scrollTop = jumpStream.scrollHeight;
                        scheduleReadSync();
                    });
                }
                if (action === "refresh") refreshPanel().catch(function (e) { showToast(e.message || "刷新失败", true); });
                if (action === "more") openMoreMenu(actionNode);
                return;
            }

            var tabNode = event.target.closest("[data-chat-tab]");
            if (tabNode) {
                closeMoreMenu();
                state.listTab = tabNode.getAttribute("data-chat-tab") || "all";
                state.listSearch.open = false;
                if (state.selected) {
                    resetSearchState();
                }
                renderMessages();
                return;
            }

            var conv = event.target.closest("[data-chat-open]");
            if (conv) {
                closeMoreMenu();
                openConversationById(conv.getAttribute("data-chat-open")).catch(function (e) { showToast(e.message || "打开会话失败", true); });
                return;
            }

            var openContextNode = event.target.closest("[data-chat-open-context]");
            if (openContextNode && isSearchOpen() && !isSearchContextMode()) {
                closeMoreMenu();
                openSearchContext(openContextNode.getAttribute("data-chat-open-context")).catch(function (e) { showToast(e.message || "打开上下文失败", true); });
                return;
            }

            var fileLink = event.target.closest("[data-chat-file]");
            if (fileLink) {
                closeMoreMenu();
                event.preventDefault();
                var parts = fileLink.getAttribute("data-chat-file").split(":");
                downloadMessageFile(parts[0], Number(parts[1])).catch(function (e) { showToast(e.message || "下载失败", true); });
                return;
            }

            var mentionItem = event.target.closest("[data-chat-mention-id]");
            if (mentionItem) {
                closeMoreMenu();
                applyMention(mentionItem.getAttribute("data-chat-mention-id"));
                return;
            }

            closeContextMenu();
            closeMoreMenu();
        });

        var ta = q("[data-chat-composer]", state.panel);
        var searchInput = q("[data-chat-search-input]", state.panel);
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
                if (state.editingMessageId) {
                    clearEditingState();
                    var taCancel = q("[data-chat-composer]", state.panel);
                    if (taCancel) taCancel.value = "";
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
        if (searchInput) {
            searchInput.addEventListener("keydown", function (event) {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    runSearch().catch(function (e) { showToast(e.message || "搜索失败", true); });
                    return;
                }
                if (event.key === "Escape") {
                    event.preventDefault();
                    closeSearch().catch(function () {});
                }
            });
        }
        ta.addEventListener("input", refreshMentionByInput);

        var fileInput = q("[data-chat-file-input]", state.panel);
        fileInput.addEventListener("change", function (event) {
            uploadFiles((event.target && event.target.files) || []).catch(function (err) { showToast(err.message || "上传失败", true); });
        });

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
        ensureContextMenu();
        bindEvents();
        Promise.all([loadMe(), loadConversations()]).then(function () {
            setUnread(state.unreadTotal > 0);
            renderMessages();
        }).catch(function () {});
    }

    window.linkseeChatWidget = {
        open: function () {
            setChatOpen(true);
        },
        openConversationByScope: function (scopeType, scopeId) {
            return openConversationByScope(scopeType, scopeId);
        },
        close: function () {
            setChatOpen(false);
            document.body.classList.remove("chat-expanded");
        },
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
