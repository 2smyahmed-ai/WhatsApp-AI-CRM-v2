import { logger } from '../lib/logger';
import { chatbotSettingsService } from '../services/chatbot-settings.service';
import { routeChat } from '../services/model-router';
import { LEAD_STATUSES, PRIORITIES } from './types';
import type { QualificationContext, QualificationResult, QualificationSignals } from './types';

/** Build the user message: a compact, role-tagged transcript of the chat. */
function buildTranscript(ctx: QualificationContext): string {
  const lines = ctx.messages
    .filter((m) => m.body && m.body.trim())
    .map((m) => `${m.fromMe ? 'BUSINESS' : 'CUSTOMER'}: ${m.body.trim()}`);
  const header = ctx.contactName ? `Customer name: ${ctx.contactName}\n` : '';
  return `${header}Conversation transcript (oldest to newest):\n${lines.join('\n')}`;
}

/** Strip code fences / surrounding prose and extract the first JSON object. */
function extractJson(raw: string): unknown {
  if (!raw) throw new Error('empty response');
  let text = raw.trim();
  // Remove ```json ... ``` or ``` ... ``` fences.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  // Fall back to the first {...} block.
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
}

function clampScore(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function clamp01(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1;
}

function normalizeSignals(raw: any): QualificationSignals {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    pricingRequest: asBool(s.pricingRequest),
    meetingRequest: asBool(s.meetingRequest),
    callRequest: asBool(s.callRequest),
    urgency: asBool(s.urgency),
    readyToBuy: asBool(s.readyToBuy),
  };
}

/** Coerce/validate raw model output into a safe QualificationResult. */
function normalizeResult(raw: any): QualificationResult {
  const status = LEAD_STATUSES.includes(raw?.status) ? raw.status : 'NEW_LEAD';
  const priority = PRIORITIES.includes(raw?.priority) ? raw.priority : 'NORMAL';
  const signals = normalizeSignals(raw?.signals);
  const buyingIntent = asBool(raw?.buyingIntent) || signals.readyToBuy;
  return {
    status,
    score: clampScore(raw?.score),
    priority,
    confidence: clamp01(raw?.confidence),
    needsAttention: asBool(raw?.needsAttention),
    buyingIntent,
    signals,
    summaryEn: String(raw?.summaryEn ?? '').slice(0, 600),
    summaryAr: String(raw?.summaryAr ?? '').slice(0, 600),
    recommendationEn: String(raw?.recommendationEn ?? '').slice(0, 600),
    recommendationAr: String(raw?.recommendationAr ?? '').slice(0, 600),
  };
}

/**
 * Run one analysis pass. Returns null if disabled, unconfigured, or the
 * provider call/parsing fails (caller treats null as "skip, try again later").
 */
export async function analyzeConversation(
  ctx: QualificationContext,
): Promise<QualificationResult | null> {
  const cfg = chatbotSettingsService.qualificationConfig();
  if (!cfg.enabled) return null;

  const transcript = buildTranscript(ctx);
  if (!transcript.includes('CUSTOMER:')) return null; // nothing from the customer yet

  try {
    // Lead qualification runs on its own free lane (Gemini Flash-Lite → Groq 8B)
    // so it never competes with the customer bot for the same quota.
    const { content } = await routeChat('qualification', {
      systemPrompt: cfg.systemPrompt,
      messages: [{ role: 'user', content: transcript }],
      temperature: cfg.temperature,
      maxTokens: 400,
      jsonMode: true,
    });
    if (!content) return null;
    return normalizeResult(extractJson(content));
  } catch (err) {
    logger.warn('lead_qual.provider_error', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
