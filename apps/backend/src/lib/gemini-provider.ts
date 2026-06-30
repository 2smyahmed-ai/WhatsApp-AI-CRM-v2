// ─────────────────────────────────────────────────────────────────────────────
// Gemini provider (Google AI Studio free tier) via the OpenAI-compatible API.
//
// IMPORTANT: Gemini 2.5 models have "thinking" ON by default, which silently
// burns output tokens on reasoning and can truncate short replies. We force
// reasoning_effort:'none' so the whole token budget goes to the actual answer —
// cheaper, faster, and no truncated WhatsApp messages.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from './logger';

const GEMINI_OPENAI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// model → epoch ms until which it's considered rate-limited (after a 429).
const cooldownUntil = new Map<string, number>();

// Lightweight per-model usage tracking for the quota meter (Gemini's free tier
// is request-per-day limited; it doesn't return quota headers, so we count).
interface GeminiUsage { day: string; requestsToday: number; lastTotalTokens: number; updatedAt: number; }
const usage = new Map<string, GeminiUsage>();

function today(): string { return new Date().toISOString().slice(0, 10); }

function track(model: string, totalTokens: number): void {
  const d = today();
  const u = usage.get(model);
  if (!u || u.day !== d) {
    usage.set(model, { day: d, requestsToday: 1, lastTotalTokens: totalTokens, updatedAt: Date.now() });
  } else {
    u.requestsToday += 1;
    u.lastTotalTokens = totalTokens;
    u.updatedAt = Date.now();
  }
}

export function isGeminiAvailable(model: string): boolean {
  const until = cooldownUntil.get(model);
  return !until || Date.now() >= until;
}

export interface GeminiCallOpts {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
}

/** One Gemini call. Returns the reply text, or throws on rate-limit/error so the router can fall back. */
export async function callGeminiSingle(opts: GeminiCallOpts): Promise<string | null> {
  const resp = await fetch(GEMINI_OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      reasoning_effort: 'none', // disable Gemini "thinking" — saves tokens, prevents truncation
      messages: [{ role: 'system', content: opts.systemPrompt }, ...opts.messages],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (resp.status === 429) {
    cooldownUntil.set(opts.model, Date.now() + 60_000);
    logger.warn('gemini.rate_limited', { model: opts.model });
    throw new Error(`gemini 429 on ${opts.model}`);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => resp.statusText);
    throw new Error(`gemini ${resp.status} on ${opts.model}: ${body.slice(0, 200)}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message: { content: string } }>;
    usage?: { total_tokens?: number };
    error?: { message: string };
  };
  if (data.error) throw new Error(data.error.message);
  track(opts.model, data.usage?.total_tokens ?? 0);
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

/** Live status for the quota meter: cooldown + today's request count per model. */
export function getGeminiStatus(models: string[]): Array<{
  provider: 'gemini';
  model: string;
  available: boolean;
  secondsLeft: number;
  requestsToday: number;
}> {
  const now = Date.now();
  const d = today();
  return models.map((model) => {
    const until = cooldownUntil.get(model) ?? 0;
    const secondsLeft = until > now ? Math.ceil((until - now) / 1000) : 0;
    const u = usage.get(model);
    return {
      provider: 'gemini',
      model,
      available: secondsLeft === 0,
      secondsLeft,
      requestsToday: u && u.day === d ? u.requestsToday : 0,
    };
  });
}
