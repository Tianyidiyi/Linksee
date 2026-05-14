import { describe, expect, it } from "@jest/globals";
import { CLIENT_SOCKET_EVENTS, SERVER_SOCKET_EVENTS, SOCKET_RULES } from "../../../apps/api/src/socket/socket-events.js";

describe("socket/socket-events", () => {
  it("should expose client and server event names", () => {
    expect(CLIENT_SOCKET_EVENTS.subscribe).toBe("subscribe");
    expect(CLIENT_SOCKET_EVENTS.heartbeatPing).toBe("heartbeat:ping");
    expect(SERVER_SOCKET_EVENTS.realtimeEvent).toBe("realtime:event");
    expect(SERVER_SOCKET_EVENTS.heartbeatPong).toBe("heartbeat:pong");
  });

  it("should expose heartbeat and payload rules", () => {
    expect(SOCKET_RULES.maxPayloadBytes).toBeGreaterThan(0);
    expect(SOCKET_RULES.heartbeatIntervalMs).toBeGreaterThan(0);
    expect(SOCKET_RULES.heartbeatTimeoutMs).toBeGreaterThan(SOCKET_RULES.heartbeatIntervalMs);
  });
});

