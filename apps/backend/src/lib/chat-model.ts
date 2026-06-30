// ─────────────────────────────────────────────────────────────────────────────
// Single place that knows how to call a chat-completion provider. Previously the
// Groq/OpenAI/Anthropic branch was copy-pasted across the customer bot provider
// and the CRM-assistant route; both now go through callChatModel.
//
// NOTE: lead-qualification (qualification.provider.ts) intentionally keeps its
// own call because it relies on provider-specific JSON-mode handling.
// ─────────────────────────────────────────────────────────────────────────────

import { groqChatWithFallback } from './groq-fallback';

export type ChatProvider = 'groq' | 'openai' | 'anthropic';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CallChatModelOptions {
  provider: ChatProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Call the configured chat model and return the assistant's text reply.
 * Throws on HTTP / provider errors so callers can decide how to handle them.
 */
export async function callChatModel(opts: CallChatModelOptions): Promise<string | null> {
  const { provider, apiKey, model, systemPrompt, messages } = opts;
  const maxTokens = opts.maxTokens ?? 400;
  const temperature = opts.temperature ?? 0.7;

  if (provider === 'anthropic') {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => resp.statusText);
      throw new Error(`anthropic ${resp.status}: ${err}`);
    }
    const data = (await resp.json()) as { content?: Array<{ text: string }> };
    return data.content?.[0]?.text?.trim() ?? null;
  }

  // Groq: route through the failover helper so an exhausted model transparently
  // falls back to another free model (and recovers when its limit resets).
  if (provider === 'groq') {
    const { content } = await groqChatWithFallback({
      apiKey,
      model,
      systemPrompt,
      messages,
      maxTokens,
      temperature,
    });
    return content;
  }

  const apiUrl = OPENAI_URL;
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => resp.statusText);
    throw new Error(`${provider} ${resp.status}: ${err}`);
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message: { content: string } }>;
    error?: { message: string };
  };
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}
