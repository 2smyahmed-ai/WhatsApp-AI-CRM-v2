// ─────────────────────────────────────────────────────────────────────────────
// Multi-provider model router. Each CRM feature gets its OWN ordered chain of
// free buckets across Gemini + Groq, so features never compete for the same
// daily quota until that whole chain is exhausted. The router tries each
// candidate in order and falls back automatically when one is rate-limited.
//
// Free-tier allocation (per-model/per-provider daily limits are independent):
//   • Customer bot      → Gemini 2.5 Flash → Groq 70B → Groq 8B   (quality + Arabic)
//   • Lead qualification→ Gemini 2.5 Flash-Lite → Groq 8B          (cheap JSON, isolated)
//   • CRM assistant     → Groq 8B → Gemini 2.0 Flash-Lite          (low volume, own lane)
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '../lib/logger';
import { chatbotSettingsService } from './chatbot-settings.service';
import { groqChatWithFallback } from '../lib/groq-fallback';
import { callGeminiSingle, isGeminiAvailable } from '../lib/gemini-provider';

export type RouterFeature = 'bot' | 'qualification' | 'assistant';

interface Candidate { provider: 'gemini' | 'groq'; model: string }

const CHAINS: Record<RouterFeature, Candidate[]> = {
  bot: [
    { provider: 'gemini', model: 'gemini-2.5-flash' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'llama-3.1-8b-instant' },
  ],
  qualification: [
    { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
    { provider: 'groq', model: 'llama-3.1-8b-instant' },
  ],
  assistant: [
    { provider: 'groq', model: 'llama-3.1-8b-instant' },
    { provider: 'gemini', model: 'gemini-2.0-flash-lite' },
  ],
};

export interface RouteOpts {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
}

export interface RouteResult { content: string | null; provider: string; model: string }

export function routerChains(): Record<RouterFeature, Candidate[]> { return CHAINS; }

/**
 * Route one chat completion for a feature across its free-bucket chain.
 * Tries each candidate in order, skipping ones without a key or in cooldown,
 * and falls back on error/rate-limit. Throws only if every candidate fails.
 */
export async function routeChat(feature: RouterFeature, opts: RouteOpts): Promise<RouteResult> {
  const s = chatbotSettingsService.get();
  const groqKey = s.apiKey || process.env.GROQ_API_KEY || '';
  const geminiKey = (s as { geminiApiKey?: string }).geminiApiKey || process.env.GEMINI_API_KEY || '';

  let lastErr = '';
  for (const cand of CHAINS[feature]) {
    if (cand.provider === 'gemini' && (!geminiKey || !isGeminiAvailable(cand.model))) continue;
    if (cand.provider === 'groq' && !groqKey) continue;
    try {
      if (cand.provider === 'gemini') {
        const content = await callGeminiSingle({
          apiKey: geminiKey, model: cand.model,
          systemPrompt: opts.systemPrompt, messages: opts.messages,
          maxTokens: opts.maxTokens, temperature: opts.temperature, jsonMode: opts.jsonMode,
        });
        if (content) {
          logger.info('router.used', { feature, provider: 'gemini', model: cand.model });
          return { content, provider: 'gemini', model: cand.model };
        }
      } else {
        const r = await groqChatWithFallback({
          apiKey: groqKey, model: cand.model,
          systemPrompt: opts.systemPrompt, messages: opts.messages,
          maxTokens: opts.maxTokens, temperature: opts.temperature, jsonMode: opts.jsonMode,
        });
        if (r.content) {
          logger.info('router.used', { feature, provider: 'groq', model: r.model });
          return { content: r.content, provider: 'groq', model: r.model };
        }
      }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      logger.warn('router.candidate_failed', { feature, provider: cand.provider, model: cand.model, error: lastErr });
    }
  }
  throw new Error(lastErr || `router: no provider available for ${feature}`);
}
