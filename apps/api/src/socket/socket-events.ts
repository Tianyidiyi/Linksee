import type { EventEnvelope } from "../shared/contracts";

export type SocketRoom = `team:${string}` | `project:${string}` | `channel:${string}`;

export interface SocketPushInput {
  room: SocketRoom;
  event: EventEnvelope;
}

export const CLIENT_SOCKET_EVENTS = {
  subscribe: "subscribe",
  presenceCheck: "presence:check",
  heartbeatPing: "heartbeat:ping",
} as const;

export const SERVER_SOCKET_EVENTS = {
  realtimeEvent: "realtime:event",
  presence: "presence",
  heartbeatConfig: "heartbeat:config",
  heartbeatPong: "heartbeat:pong",
  error: "socket:error",
} as const;

export type PresenceStatus = "online" | "offline";

export interface PresenceEvent {
  status: PresenceStatus;
  reason: "authenticated" | "unauthenticated" | "heartbeat_timeout" | "manual_disconnect";
  ts: string;
}

export interface HeartbeatPingEvent {
  seq: number;
  sentAt: number;
  clientTs: string;
}

export interface HeartbeatPongEvent {
  seq: number | null;
  serverReceiveTs: string;
  serverSendTs: string;
  clientSentAtMs: number | null;
  clientTs: string | null;
  rttMs: number | null;
}

export interface HeartbeatConfigEvent {
  intervalMs: number;
  timeoutMs: number;
  ts: string;
}

export const SOCKET_RULES = {
  auth: "JWT handshake",
  heartbeat: "ping/pong every 10s, timeout 30s",
  reconnect: "exponential backoff",
  maxPayloadBytes: 64 * 1024,
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
} as const;
