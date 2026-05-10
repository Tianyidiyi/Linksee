import type { Server, Socket } from "socket.io";
import type { EventEnvelope } from "../shared/contracts.js";
import {
  CLIENT_SOCKET_EVENTS,
  SERVER_SOCKET_EVENTS,
  SOCKET_RULES,
  type HeartbeatConfigEvent,
  type HeartbeatPingEvent,
  type HeartbeatPongEvent,
  type PresenceEvent,
} from "./socket-events.js";

export interface SocketGateway {
  push(room: string, event: EventEnvelope): Promise<void>;
  removeUserFromRoom(userId: string, room: string): Promise<void>;
  heartbeatConfig: HeartbeatConfigEvent;
}

export interface RealtimeGatewayOptions {
  authenticate(token: string): Promise<{ userId: string; courseIds: string[]; groupIds?: string[] }>;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

export function setupRealtimeGateway(
  io: Server,
  options: RealtimeGatewayOptions,
): SocketGateway {
  const logger = options.logger ?? console;
  const userSockets = new Map<string, Set<string>>();
  const heartbeatConfig: HeartbeatConfigEvent = {
    intervalMs: options.heartbeatIntervalMs ?? SOCKET_RULES.heartbeatIntervalMs,
    timeoutMs: options.heartbeatTimeoutMs ?? SOCKET_RULES.heartbeatTimeoutMs,
    ts: new Date().toISOString(),
  };

  io.on("connection", async (socket: Socket) => {
    const token =
      (typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token) ||
      (typeof socket.handshake.query?.token === "string" ? socket.handshake.query.token : "");

    let authContext: { userId: string; courseIds: string[]; groupIds?: string[] } | null = null;
    try {
      authContext = await options.authenticate(token);
    } catch (error) {
      const presence: PresenceEvent = {
        status: "offline",
        reason: "unauthenticated",
        ts: new Date().toISOString(),
      };
      socket.emit(SERVER_SOCKET_EVENTS.presence, presence);
      socket.emit(SERVER_SOCKET_EVENTS.error, { code: "UNAUTHENTICATED" });
      logger.warn(`[socket] unauthenticated connection socket=${socket.id}`);
      socket.disconnect(true);
      return;
    }

    for (const courseId of authContext.courseIds) {
      socket.join(`course:${courseId}`);
    }
    for (const groupId of authContext.groupIds ?? []) {
      socket.join(`group:${groupId}`);
    }

    const sockets = userSockets.get(authContext.userId) ?? new Set<string>();
    sockets.add(socket.id);
    userSockets.set(authContext.userId, sockets);

    socket.emit(SERVER_SOCKET_EVENTS.heartbeatConfig, heartbeatConfig);
    socket.emit(SERVER_SOCKET_EVENTS.presence, {
      status: "online",
      reason: "authenticated",
      ts: new Date().toISOString(),
    } satisfies PresenceEvent);

    let lastHeartbeatAt = Date.now();

    socket.on(
      CLIENT_SOCKET_EVENTS.subscribe,
      (room: string, ack?: (result: { ok: boolean; reason?: string }) => void) => {
      if (!validateRealtimeRoom(room)) {
          ack?.({ ok: false, reason: "invalid_room" });
        return;
      }
      socket.join(room);
      ack?.({ ok: true });
      },
    );

    socket.on(CLIENT_SOCKET_EVENTS.presenceCheck, () => {
      socket.emit(SERVER_SOCKET_EVENTS.presence, {
        status: "online",
        reason: "authenticated",
        ts: new Date().toISOString(),
      } satisfies PresenceEvent);
    });

    socket.on(CLIENT_SOCKET_EVENTS.heartbeatPing, (payload: HeartbeatPingEvent) => {
      lastHeartbeatAt = Date.now();
      const now = Date.now();
      const receivedAt = new Date(now).toISOString();
      const sentAt = Number(payload?.sentAt);
      const heartbeat: HeartbeatPongEvent = {
        seq: Number.isFinite(payload?.seq) ? payload.seq : null,
        serverReceiveTs: receivedAt,
        serverSendTs: new Date().toISOString(),
        clientSentAtMs: Number.isFinite(sentAt) ? sentAt : null,
        clientTs: payload?.clientTs ?? null,
        rttMs: Number.isFinite(sentAt) ? Math.max(0, now - sentAt) : null,
      };
      socket.emit(SERVER_SOCKET_EVENTS.heartbeatPong, heartbeat);
    });

    const heartbeatGuard = setInterval(() => {
      if (Date.now() - lastHeartbeatAt <= heartbeatConfig.timeoutMs) {
        return;
      }
      socket.emit(SERVER_SOCKET_EVENTS.presence, {
        status: "offline",
        reason: "heartbeat_timeout",
        ts: new Date().toISOString(),
      } satisfies PresenceEvent);
      socket.disconnect(true);
    }, Math.max(1000, Math.floor(heartbeatConfig.timeoutMs / 3)));

    socket.on("disconnect", () => {
      const sockets = userSockets.get(authContext!.userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(authContext!.userId);
        }
      }
      clearInterval(heartbeatGuard);
    });
  });

  return {
    heartbeatConfig,
    async push(room: string, event: EventEnvelope): Promise<void> {
      io.to(room).emit(SERVER_SOCKET_EVENTS.realtimeEvent, event);
    },
    async removeUserFromRoom(userId: string, room: string): Promise<void> {
      const sockets = userSockets.get(userId);
      if (!sockets || sockets.size === 0) return;
      for (const socketId of sockets) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(room);
        }
      }
    },
  };
}

// 约束：网关只负责连接管理与事件分发，不执行业务写库。
export function validateRealtimeRoom(room: string): boolean {
  return /^(course|assignment|group|stage|submission):[\w-]+$/.test(room);
}
