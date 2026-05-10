import type { EventEnvelope } from "../shared/contracts.js";
import { redis } from "../infra/redis.js";

const REALTIME_REPLAY_TTL_SECONDS = 30 * 60;
const REALTIME_REPLAY_MAX_EVENTS = 500;
const REALTIME_ACK_TTL_SECONDS = 6 * 60 * 60;

function roomKey(room: string): string {
  return `realtime:room:${room}`;
}

function ackKey(userId: string): string {
  return `realtime:ack:${userId}`;
}

export async function cacheRealtimeEvent(room: string, event: EventEnvelope): Promise<void> {
  const key = roomKey(room);
  const payload = JSON.stringify(event);
  const pipeline = redis.multi();
  pipeline.rpush(key, payload);
  pipeline.ltrim(key, -REALTIME_REPLAY_MAX_EVENTS, -1);
  pipeline.expire(key, REALTIME_REPLAY_TTL_SECONDS);
  await pipeline.exec();
}

export async function loadReplayEvents(room: string, afterEventId?: string): Promise<EventEnvelope[]> {
  const key = roomKey(room);
  const items = await redis.lrange(key, 0, -1);
  if (items.length === 0) {
    return [];
  }

  const events: EventEnvelope[] = [];
  for (const item of items) {
    try {
      events.push(JSON.parse(item) as EventEnvelope);
    } catch {
      continue;
    }
  }

  if (!afterEventId) {
    return events;
  }

  const index = events.findIndex((event) => event.id === afterEventId);
  if (index < 0) {
    return events;
  }

  return events.slice(index + 1);
}

export async function ackRealtimeEvent(userId: string, eventId: string): Promise<void> {
  const key = ackKey(userId);
  await redis.sadd(key, eventId);
  await redis.expire(key, REALTIME_ACK_TTL_SECONDS);
}

export async function filterAckedEvents(userId: string, events: EventEnvelope[]): Promise<EventEnvelope[]> {
  if (events.length === 0) {
    return events;
  }

  const key = ackKey(userId);
  const pipeline = redis.multi();
  events.forEach((event) => pipeline.sismember(key, event.id));
  const results = await pipeline.exec();

  const filtered: EventEnvelope[] = [];
  events.forEach((event, index) => {
    const value = results?.[index]?.[1];
    if (value !== 1 && value !== "1") {
      filtered.push(event);
    }
  });

  return filtered;
}
