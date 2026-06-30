// ─────────────────────────────────────────────────────────────────────────────
// Groq model failover with auto-recovery.
//
// Groq's free-tier rate limits (incl. tokens-per-day) are PER MODEL, so when the
// configured model is exhausted we can transparently fall back to another free
// model that still has budget. On a 429 we record a per-model cooldown parsed
// from Groq's "try again in …" hint; subsequent calls route around that model
// until its window resets, then use it again automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from './logger';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Ordered free Groq models to fall back through. The caller's configured model
 * is always tried first; these fill in when it is rate-limited. Ordered roughly
 * best-quality → cheapest so we degrade gracefully.
 */
export const GROQ_FALLBACK_CHAIN = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'llama3-8b-8192',
];

// Models permanently skipped due to decommission / hard errors (not rate limits).
const permanentlyBanned = new Set<string>();

// model → epoch ms until which it is considered rate-limited. Auto-recovers once
// the clock passes the value (the primary is used again after its window resets).
const cooldownUntil = new Map<string, number>();

// model → last-seen real quota, parsed from Groq's rate-limit response headers.
// Groq reports the remaining requests/tokens for the current window on every
// response, so we capture them on each call to show real, live usage in the UI.
export interface ModelQuota {
  remainingRequests: number | null;
  limitRequests: number | null;
  remainingTokens: number | null;
  limitTokens: number | null;
  /** Raw reset hints from Groq, e.g. "7.66s" / "2m59.56s". */
  resetRequests: string | null;
  resetTokens: string | null;
  /** When these numbers were last observed (epoch ms). */
  updatedAt: number;
}
const quota = new Map<string, ModelQuota>();

function headerNum(h: Headers, key: string): number | null {
  const v = h.get(key);
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Record the rate-limit headers Groq returns so the UI can show real quota. */
function captureQuota(model: string, h: Headers): void {
  const remainingRequests = headerNum(h, 'x-ratelimit-remaining-requests');
  const limitRequests     = headerNum(h, 'x-ratelimit-limit-requests');
  const remainingTokens   = headerNum(h, 'x-ratelimit-remaining-tokens');
  const limitTokens       = headerNum(h, 'x-ratelimit-limit-tokens');
  // Nothing useful in the headers (e.g. a network proxy stripped them) → skip.
  if (remainingRequests == null && limitRequests == null && remainingTokens == null && limitTokens == null) return;
  quota.set(model, {
    remainingRequests,
    limitRequests,
    remainingTokens,
    limitTokens,
    resetRequests: h.get('x-ratelimit-reset-requests') || null,
    resetTokens: h.get('x-ratelimit-reset-tokens') || null,
    updatedAt: Date.now(),
  });
}

function isAvailable(model: string): boolean {
  if (permanentlyBanned.has(model)) return false;
  const until = cooldownUntil.get(model);
  return !until || Date.now() >= until;
}

/**
 * Live failover state for the UI: each model in the chain plus the caller's
 * configured model, with whether it's currently rate-limited and for how long.
 */
export function getModelStatus(configuredModel?: string): Array<{
  model: string;
  available: boolean;
  secondsLeft: number;
  primary: boolean;
  quota: ModelQuota | null;
}> {
  const chain = configuredModel
    ? [configuredModel, ...GROQ_FALLBACK_CHAIN.filter((m) => m !== configuredModel)]
    : [...GROQ_FALLBACK_CHAIN];
  const now = Date.now();
  return chain.map((model, i) => {
    const until = cooldownUntil.get(model) ?? 0;
    const secondsLeft = until > now ? Math.ceil((until - now) / 1000) : 0;
    return { model, available: secondsLeft === 0, secondsLeft, primary: i === 0, quota: quota.get(model) ?? null };
  });
}

function setCooldown(model: string, ms: number): void {
  cooldownUntil.set(model, Date.now() + Math.max(1000, ms));
  logger.warn('groq.model_cooldown', { model, seconds: Math.round(ms / 1000) });
}

/** Parse Groq's "Please try again in 1m14.304s" / "in 53.568s" hint → ms. */
export function parseRetryAfterMs(text: string): number {
  const m = text.match(/try again in\s+(?:(\d+)m)?\s*([\d.]+)s/i);
  if (m) {
    const mins = m[1] ? parseInt(m[1], 10) : 0;
    const secs = m[2] ? parseFloat(m[2]) : 0;
    const ms = Math.ceil((mins * 60 + secs) * 1000);
    if (ms > 0) return ms;
  }
  return 60_000; // sensible default when no hint is present
}

export interface GroqChatOptions {
  apiKey: string;
  /** Primary/configured model — always tried first. */
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens: number;
  temperature: number;
  /** Request strict JSON output (Groq json_object mode). */
  jsonMode?: boolean;
}

export interface GroqChatResult {
  content: string | null;
  /** Which model actually answered (may differ from the requested one). */
  model: string;
}

/**
 * Call Groq with automatic model failover. Tries the configured model first,
 * then the free fallback chain, skipping any model currently in cooldown after a
 * 429. Returns the first successful reply (and which model produced it). Throws
 * only if every candidate fails.
 */
export async function groqChatWithFallback(opts: GroqChatOptions): Promise<GroqChatResult> {
  // Configured model first, then the rest of the chain (de-duplicated).
  const ordered = [opts.model, ...GROQ_FALLBACK_CHAIN.filter((m) => m !== opts.model)];
  const available = ordered.filter(isAvailable);
  // If everything is cooling down, still attempt them in order (least-bad effort).
  const candidates = available.length ? available : ordered;

  let lastErr = '';
  for (const model of candidates) {
    try {
      const resp = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: opts.systemPrompt }, ...opts.messages],
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      // Capture live quota from the rate-limit headers on every response.
      captureQuota(model, resp.headers);

      if (resp.status === 429) {
        const body = await resp.text().catch(() => '');
        setCooldown(model, parseRetryAfterMs(body));
        lastErr = `groq 429 on ${model}`;
        continue; // route to the next model
      }
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => resp.statusText);
        // Decommissioned models return 400 — ban them for the process lifetime so
        // we stop wasting attempts on them and fall through to live models.
        if (resp.status === 400 && errBody.includes('decommissioned')) {
          permanentlyBanned.add(model);
          logger.warn('groq.model_decommissioned', { model, hint: 'removed from fallback chain' });
        } else {
          logger.warn('groq.model_error', { model, status: resp.status, body: errBody.slice(0, 300) });
        }
        lastErr = `groq ${resp.status} on ${model}: ${errBody}`;
        continue;
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message: { content: string } }>;
        error?: { message: string };
      };
      if (data.error) { lastErr = data.error.message; continue; }

      if (model !== opts.model) {
        logger.info('groq.fallback_used', { requested: opts.model, used: model });
      }
      return { content: data.choices?.[0]?.message?.content?.trim() ?? null, model };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      logger.warn('groq.model_exception', { model, error: lastErr });
    }
  }

  throw new Error(lastErr || 'groq: all models exhausted');
}
