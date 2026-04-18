import type { RealtimeEventEnvelope } from "./event-handlers";

export interface HeartbeatPongPayload {
  seq: number | null;
  serverReceiveTs: string;
  serverSendTs: string;
  clientSentAtMs: number | null;
  clientTs: string | null;
  rttMs: number | null;
}

interface SocketLike {
  connected: boolean;
  emit(event: string, ...args: unknown[]): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
  disconnect(): void;
}

type SocketFactory = (endpoint: string, options: Record<string, unknown>) => SocketLike;

export interface RealtimeClientOptions {
  endpoint: string;
  socketFactory: SocketFactory;
}

export interface RealtimeClient {
  connect(token: string): Promise<void>;
  subscribe(room: string): Promise<void>;
  onEvent(handler: (event: RealtimeEventEnvelope) => void): void;
  onHeartbeat(handler: (event: HeartbeatPongPayload) => void): void;
  disconnect(): Promise<void>;
}

export class BasicRealtimeClient implements RealtimeClient {
  private socket?: SocketLike;
  private eventHandler?: (event: RealtimeEventEnvelope) => void;
  private heartbeatHandler?: (event: HeartbeatPongPayload) => void;
  private connectTimeoutMs = 8000;
  private subscribeAckTimeoutMs = 3000;

  constructor(private readonly options: RealtimeClientOptions) {}

  async connect(token: string): Promise<void> {
    this.socket = this.options.socketFactory(this.options.endpoint, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      transports: ["websocket", "polling"],
    });

    this.socket.on("realtime:event", (...args: unknown[]) => {
      const event = args[0] as RealtimeEventEnvelope | undefined;
      if (!event) {
        return;
      }
      this.eventHandler?.(event);
    });

    this.socket.on("heartbeat:pong", (...args: unknown[]) => {
      const event = args[0] as HeartbeatPongPayload | undefined;
      if (!event) {
        return;
      }
      this.heartbeatHandler?.(event);
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        if (!this.socket?.off) {
          return;
        }
        this.socket.off("connect", onConnect);
        this.socket.off("connect_error", onConnectError);
      };

      const onConnect = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        cleanup();
        this.socket?.emit("presence:check");
        resolve();
      };

      const onConnectError = (...args: unknown[]) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        cleanup();
        const error = args[0] instanceof Error ? args[0] : new Error("socket connect error");
        reject(error);
      };

      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error("socket connect timeout"));
      }, this.connectTimeoutMs);

      this.socket?.on("connect", onConnect);
      this.socket?.on("connect_error", onConnectError);
    });
  }

  async subscribe(room: string): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("socket is not connected");
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error("subscribe ack timeout"));
      }, this.subscribeAckTimeoutMs);

      this.socket?.emit(
        "subscribe",
        room,
        (result?: { ok: boolean; reason?: string }) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);
          if (result?.ok) {
            resolve();
            return;
          }
          reject(new Error(result?.reason ?? "subscribe rejected"));
        },
      );
    });
  }

  onEvent(handler: (event: RealtimeEventEnvelope) => void): void {
    this.eventHandler = handler;
  }

  onHeartbeat(handler: (event: HeartbeatPongPayload) => void): void {
    this.heartbeatHandler = handler;
  }

  async disconnect(): Promise<void> {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}

// 约束：RealtimeClient 不提交业务写操作，只接收服务端推送。
export function shouldFallbackToPolling(socketConnected: boolean): boolean {
  return !socketConnected;
}
