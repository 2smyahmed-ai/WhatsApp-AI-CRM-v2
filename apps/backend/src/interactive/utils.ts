/**
 * interactive/utils.ts
 *
 * Foundation utilities shared across all interactive messaging modules:
 *   - JID normalization & socket validation
 *   - Unique message ID generation
 *   - Exponential-backoff retry
 *   - Anti-ban helpers (typing presence simulation, human-like delays)
 *   - Token-bucket rate limiter
 *   - Payload validation (string length, button count)
 *   - Structured send-context builder for tracing / analytics
 */

import { generateMessageID } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { randomUUID } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// JID Validation
// ─────────────────────────────────────────────────────────────────────────────

const JID_REGEX   = /^[\d+]+@(s\.whatsapp\.net|g\.us|broadcast)$/;
const PHONE_REGEX = /^\d{7,15}$/;

/**
 * Normalise a raw phone number or WhatsApp JID into a canonical JID string.
 *
 * Accepts:
 *   - Digits-only phone numbers:  "14155552671"
 *   - Prefixed numbers:           "+14155552671", "001415…"
 *   - Full JIDs:                  "14155552671@s.whatsapp.net"
 *   - Group JIDs:                 "120363XXXXXX@g.us"
 *
 * Throws on invalid input so callers fail fast rather than sending to a bad address.
 */
export function normalizeJid(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('JID is required and must be a string');
  }

  const cleaned = input.trim();

  // Already a well-formed JID — return as-is
  if (JID_REGEX.test(cleaned)) return cleaned;

  // Raw phone → append default WhatsApp domain
  const digits = cleaned.replace(/\D/g, '');
  if (PHONE_REGEX.test(digits)) return `${digits}@s.whatsapp.net`;

  throw new Error(`Invalid JID or phone number: "${input}"`);
}

/**
 * Assert the socket is a live Baileys WASocket.
 * TypeScript narrowing guard — after this call, `sock` is non-null.
 */
export function assertConnected(sock: WASocket | null | undefined): asserts sock is WASocket {
  if (!sock) {
    throw new Error('WhatsApp socket is not initialised');
  }
  if (typeof (sock as any).relayMessage !== 'function') {
    throw new Error(
      'Provided socket does not expose relayMessage. ' +
      'Pass the WASocket instance returned by makeWASocket().',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message ID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a collision-resistant WhatsApp message ID using Baileys' own helper.
 * Format: "3EB0<random-hex>" — matches what official WhatsApp clients produce.
 */
export function newMessageId(): string {
  return generateMessageID();
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry with exponential back-off
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts?: number;
  /** Base delay in ms. Doubles on each retry. */
  baseDelayMs?: number;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Retry an async function up to `maxAttempts` times with exponential back-off.
 * The last error is re-thrown if all attempts fail.
 *
 * @example
 * const result = await retryAsync(() => sock.relayMessage(jid, msg, opts), {
 *   maxAttempts: 3,
 *   baseDelayMs: 400,
 *   onRetry: (err, attempt) => console.warn('retry', attempt, err),
 * });
 */
export async function retryAsync<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 400;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1); // 400 → 800 → 1600
        opts.onRetry?.(err, attempt, delay);
        await sleep(delay);
      }
    }
  }

  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-ban helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Promise-based sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulate human typing before sending a message.
 *
 * Sends a "composing" presence, waits proportional to message length, then clears it.
 * This makes sends look organic and reduces the chance of an automated-send flag.
 *
 * Calculation: ~40 WPM ≈ 200 chars/min → ~300 ms/char; capped at 4 s, floored at 800 ms.
 *
 * @param charCount  Approximate character count of the message being sent.
 */
export async function simulateTyping(
  sock: WASocket,
  jid: string,
  charCount = 80,
): Promise<void> {
  try {
    await sock.sendPresenceUpdate('composing', jid);
    const ms = Math.min(Math.max(charCount * 30, 800), 4_000);
    await sleep(ms);
    await sock.sendPresenceUpdate('paused', jid);
  } catch {
    // Presence errors are non-critical — never block the actual send
  }
}

/**
 * Insert a random human-like pause between sends.
 * Use this in bulk sending loops to avoid triggering WhatsApp's rate detectors.
 *
 * @param minMs  Minimum delay in ms (default 800)
 * @param maxMs  Maximum delay in ms (default 3 000)
 */
export async function humanDelay(minMs = 800, maxMs = 3_000): Promise<void> {
  await sleep(minMs + Math.random() * (maxMs - minMs));
}

// ─────────────────────────────────────────────────────────────────────────────
// Token-bucket rate limiter
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimiterConfig {
  /** Maximum messages per sliding window (default: 20). */
  maxMessages?: number;
  /** Sliding window duration in ms (default: 60 000 — 1 minute). */
  windowMs?: number;
}

/**
 * Simple per-JID token-bucket rate limiter backed by an in-memory Map.
 *
 * Tracks message timestamps per JID within a sliding window.
 * Throws `Error` immediately if the bucket is full, giving callers the
 * chance to queue or drop the message rather than hammering WhatsApp.
 *
 * For multi-process deployments, replace the Map with a Redis ZSET.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, number[]>();
  readonly maxMessages: number;
  readonly windowMs: number;

  constructor(config: RateLimiterConfig = {}) {
    this.maxMessages = config.maxMessages ?? 20;
    this.windowMs    = config.windowMs    ?? 60_000;
  }

  /**
   * Record a send attempt for `jid`.
   * Throws if the rate limit is exceeded for that JID.
   */
  check(jid: string): void {
    const now      = Date.now();
    const windowAt = now - this.windowMs;
    const ts       = (this.buckets.get(jid) ?? []).filter((t) => t > windowAt);

    if (ts.length >= this.maxMessages) {
      const resetAt = new Date(ts[0]! + this.windowMs);
      throw new Error(
        `Rate limit exceeded for ${jid}: ` +
        `max ${this.maxMessages} messages per ${this.windowMs / 1_000}s. ` +
        `Resets at ${resetAt.toISOString()}.`,
      );
    }

    ts.push(now);
    this.buckets.set(jid, ts);
  }

  /** Remove stale buckets to prevent unbounded memory growth. */
  prune(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [jid, ts] of this.buckets) {
      const fresh = ts.filter((t) => t > cutoff);
      if (fresh.length === 0) this.buckets.delete(jid);
      else this.buckets.set(jid, fresh);
    }
  }
}

/** Module-level singleton — 20 messages / minute per JID. */
export const rateLimiter = new RateLimiter({ maxMessages: 20, windowMs: 60_000 });

// Prune stale buckets every 5 minutes to prevent memory leak
const pruneTimer = setInterval(() => rateLimiter.prune(), 5 * 60_000);
pruneTimer.unref?.(); // don't keep the process alive for housekeeping

// ─────────────────────────────────────────────────────────────────────────────
// Payload validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure `value` fits within `maxLen` characters.
 * If `truncate` is true, silently trims and warns; otherwise throws RangeError.
 */
export function validateLength(
  value: string,
  field: string,
  maxLen: number,
  truncate = false,
): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  if (value.length > maxLen) {
    if (truncate) {
      console.warn(`[interactive] ${field} truncated from ${value.length} to ${maxLen} chars`);
      return value.slice(0, maxLen);
    }
    throw new RangeError(
      `${field} exceeds the ${maxLen}-character limit (got ${value.length})`,
    );
  }
  return value;
}

/**
 * Verify that a buttons array is non-empty and does not exceed `max`.
 */
export function validateButtonCount(
  buttons: unknown[],
  max: number,
  field = 'buttons',
): void {
  if (!Array.isArray(buttons)) throw new TypeError(`${field} must be an array`);
  if (buttons.length === 0)    throw new RangeError(`${field} must contain at least 1 button`);
  if (buttons.length > max)    throw new RangeError(`${field} exceeds the ${max}-button limit (got ${buttons.length})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracing / analytics context
// ─────────────────────────────────────────────────────────────────────────────

export interface SendContext {
  jid: string;
  type: string;
  messageId: string;
  traceId: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Build a structured context object for logging and analytics.
 * Pass this alongside the send result to your event bus / logger.
 */
export function buildSendContext(
  jid: string,
  type: string,
  extra: Record<string, unknown> = {},
): SendContext {
  return {
    jid,
    type,
    messageId: newMessageId(),
    traceId:   randomUUID(),
    timestamp: new Date().toISOString(),
    ...extra,
  };
}
