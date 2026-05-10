import crypto from "node:crypto";
import type { EventEnvelope, EventName } from "../shared/contracts.js";

export function createEventEnvelope<T>(name: EventName, payload: T, producer = "api"): EventEnvelope<T> {
  const id = crypto.randomUUID();
  const traceId = crypto.randomUUID();
  return {
    id,
    name,
    occurredAt: new Date().toISOString(),
    producer,
    traceId,
    payload,
  };
}
