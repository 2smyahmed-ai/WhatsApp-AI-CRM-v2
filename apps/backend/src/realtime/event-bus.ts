import { randomUUID } from 'crypto';
import type { RealtimeEvent, RealtimeEventType, EventPayloads } from '@crm/messaging-schema';
import { emitRealtime } from './socket';

// ── Per-team in-memory state ───────────────────────────────────────────────────
// Seq counters reset on restart — clients detect gaps and request resync.
const seqCounters = new Map<string, number>();

// Ring buffer: last MAX_LOG events per team for resync requests.
const eventLog = new Map<string, RealtimeEvent[]>();
const MAX_LOG = 500;

function nextSeq(teamId: string): number {
  const n = (seqCounters.get(teamId) ?? 0) + 1;
  seqCounters.set(teamId, n);
  return n;
}

function storeInLog(teamId: string, event: RealtimeEvent): void {
  const log = eventLog.get(teamId) ?? [];
  log.push(event);
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
  eventLog.set(teamId, log);
}

/**
 * Emit a typed, seq-numbered RealtimeEvent to the team's socket room.
 *
 * Emits on 'crm:event' — the new canonical channel the frontend store subscribes to.
 * Legacy event names (message:new, conversation:updated, etc.) continue to be
 * emitted by the callers for backward compat with components not yet on the store.
 */
export function emitEvent<E extends RealtimeEventType>(
  type: E,
  payload: EventPayloads[E],
  teamId: string,
): void {
  const seq = nextSeq(teamId);
  const event: RealtimeEvent<EventPayloads[E]> = {
    seq,
    eventId: randomUUID(),
    type,
    teamId,
    payload,
    timestamp: new Date().toISOString(),
    v: 1,
  };
  storeInLog(teamId, event as RealtimeEvent);
  emitRealtime('crm:event', event, teamId);
}

/**
 * Return stored events with seq > fromSeq, up to `limit`.
 * Used by the resync handler to replay missed events.
 */
export function getEventsSince(teamId: string, fromSeq: number, limit = 200): RealtimeEvent[] {
  const log = eventLog.get(teamId) ?? [];
  const result: RealtimeEvent[] = [];
  for (const e of log) {
    if (e.seq > fromSeq) result.push(e);
    if (result.length >= limit) break;
  }
  return result;
}

export function getLatestSeq(teamId: string): number {
  return seqCounters.get(teamId) ?? 0;
}
