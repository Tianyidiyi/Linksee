import type { EventEnvelope } from "../shared/contracts.js";
import type { SocketGateway } from "../socket/gateway.js";
import { cacheRealtimeEvent } from "./realtime-cache.js";

let realtimeGateway: SocketGateway | null = null;

export function registerRealtimeGateway(gateway: SocketGateway): void {
  realtimeGateway = gateway;
}

export async function pushSocketEvent(room: string, event: EventEnvelope): Promise<void> {
  if (!realtimeGateway) {
    return;
  }
  await cacheRealtimeEvent(room, event);
  await realtimeGateway.push(room, event);
}

export async function removeUserFromRoom(userId: string, room: string): Promise<void> {
  if (!realtimeGateway) {
    return;
  }
  await realtimeGateway.removeUserFromRoom(userId, room);
}
