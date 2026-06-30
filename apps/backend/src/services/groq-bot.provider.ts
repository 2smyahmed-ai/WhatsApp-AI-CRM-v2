import { logger } from '../lib/logger';
import { chatbotSettingsService } from './chatbot-settings.service';
import { aiConfigService } from './ai-config.service';
import { buildSystemPrompt } from './ai-prompt-builder';
import { routeChat } from './model-router';
import type { ChatMessage } from '../lib/chat-model';
import type { AiBotProvider, ConversationContext } from './ai-bot.service';

export class GroqBotProvider implements AiBotProvider {
  readonly name = 'groq';

  async generateReply(ctx: ConversationContext): Promise<string | null> {
    const cfg = aiConfigService.get();

    // Master switch lives on the unified AiConfig. isBotActive already gates
    // this, but keep the guard so direct calls behave correctly too.
    if (!cfg.enabled) return null;

    // Keys are held in chatbotSettings; the router picks the healthiest free
    // bucket (Gemini → Groq) so the bot doesn't burn a single quota.
    const s = chatbotSettingsService.get();
    if (!s.apiKey && !s.geminiApiKey && !process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
      logger.warn('groq_bot.missing_api_key', { hint: 'Set a Groq or Gemini key in AI settings' });
      return null;
    }

    const historyMessages: ChatMessage[] = ctx.recentMessages.map((m) => ({
      role: m.fromMe ? 'assistant' : 'user',
      content: m.body || '',
    }));

    // ── Single, deterministic prompt source. buildSystemPrompt honors the
    //    rawPromptOverride escape hatch internally. ─────────────────────────────
    const systemPrompt = buildSystemPrompt(cfg, {
      customerName: ctx.contactName,
      language: ctx.locale,
      isFirstMessage: ctx.isFirstMessage,
    });

    try {
      const { content } = await routeChat('bot', {
        systemPrompt,
        messages: [...historyMessages, { role: 'user', content: ctx.inboundText }],
        maxTokens: cfg.general.maxTokens,
        temperature: cfg.general.temperature,
      });
      return content;
    } catch (err) {
      logger.warn('groq_bot.provider_error', { error: String(err) });
      return null;
    }
  }
}
