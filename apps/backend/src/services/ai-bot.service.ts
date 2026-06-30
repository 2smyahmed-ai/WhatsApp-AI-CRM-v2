import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { aiConfigService, type AiConfig } from './ai-config.service';
import { substituteVariables } from './ai-prompt-builder';
import { notificationsService } from '../notifications/notifications.service';

// ── Public interfaces ────────────────────────────────────────────────────────

export interface ConversationContext {
  conversationId: string;
  phone: string;
  teamId: string | null;
  inboundText: string;
  recentMessages: Array<{ fromMe: boolean; body: string }>;
  /** Customer display name, used to resolve {{customer_name}} in prompts. */
  contactName?: string;
  /** Customer locale hint, if known. */
  locale?: string;
  /** True when this is the customer's first inbound message (drives the welcome). */
  isFirstMessage?: boolean;
}

// ── Human-handoff keyword map (English + common Arabic terms) ────────────────
const HANDOFF_KEYWORDS: Record<string, string[]> = {
  complaint: ['complaint', 'complain', 'شكوى', 'اشتكي', 'أشتكي'],
  refund: ['refund', 'money back', 'استرداد', 'استرجاع', 'ارجاع المبلغ'],
  manager: ['manager', 'supervisor', 'مدير', 'المسؤول', 'مسؤول'],
  humanAgent: ['human', 'agent', 'real person', 'representative', 'موظف', 'شخص حقيقي', 'خدمة العملاء'],
  technicalSupport: ['technical support', 'tech support', 'not working', 'broken', 'دعم فني', 'مشكلة تقنية', 'لا يعمل'],
};

export interface AiBotProvider {
  /** Unique provider name, e.g. "openai", "anthropic", "webhook". */
  readonly name: string;
  /**
   * Generate a reply for an inbound message.
   * Return `null` to skip sending (e.g. confidence too low, off-topic).
   */
  generateReply(ctx: ConversationContext): Promise<string | null>;
}

// ── Default pause duration: 8 hours ────────────────────────────────────────
const DEFAULT_PAUSE_MS = 8 * 60 * 60 * 1000;

// ── Burst window: wait this long for the customer to stop typing before the
//    bot answers, so a rapid burst of messages costs ONE reply, not N. ────────
const BOT_BURST_MS = 3_000;

// ── Service ──────────────────────────────────────────────────────────────────

class AiBotService {
  private readonly providers = new Map<string, AiBotProvider>();
  // Per-conversation debounce timers for burst coalescing.
  private readonly inboundTimers = new Map<string, NodeJS.Timeout>();

  /** Register an AI provider. The first registered provider is used by default. */
  register(provider: AiBotProvider): void {
    this.providers.set(provider.name, provider);
    logger.info('ai_bot.provider_registered', { name: provider.name });
  }

  /**
   * Debounced entry point for inbound messages. A burst of rapid messages from
   * the same conversation resets the timer, so the bot replies ONCE — to the
   * whole burst — after the customer pauses. This both halves token/request
   * usage for multi-message users and produces a single coherent reply instead
   * of several fragmented ones. Mirrors the lead-qualifier's debounce.
   */
  scheduleInboundReply(
    conversationId: string,
    inboundText: string,
    ctx: { phone: string; sessionId: string; teamId: string | null },
  ): void {
    if (!inboundText?.trim()) return;
    const prev = this.inboundTimers.get(conversationId);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      this.inboundTimers.delete(conversationId);
      // Fires with the LATEST message; handleInboundMessage rebuilds context
      // (the whole burst) fresh from the DB, so nothing is lost.
      void this.handleInboundMessage(conversationId, inboundText, ctx).catch((err) =>
        logger.warn('ai_bot.debounced_failed', { conversationId, error: err instanceof Error ? err.message : String(err) }),
      );
    }, BOT_BURST_MS);
    if (typeof timer.unref === 'function') timer.unref();
    this.inboundTimers.set(conversationId, timer);
  }

  /** Returns the first registered provider, or undefined if none are registered. */
  defaultProvider(): AiBotProvider | undefined {
    return this.providers.values().next().value;
  }

  /**
   * Check whether the bot should handle inbound messages for this conversation.
   * Also clears an expired pause so the next call sees the bot as active again.
   *
   * Precedence (highest first):
   *   1. Active human-handoff pause → never reply (an agent took over).
   *   2. Per-chat override (botOverride / legacy botEnabled) when targeting
   *      respects it → forces the bot on or off for this one conversation.
   *   3. Master switch off → never reply.
   *   4. Targeting mode 'all' → reply.
   *   5. Targeting mode 'rules' → reply only if the contact matches the rules.
   */
  async isBotActive(conversationId: string): Promise<boolean> {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        botEnabled: true,
        botOverride: true,
        botPausedUntil: true,
        contact: {
          select: {
            lifecycleStage: true,
            contactTags: { select: { tag: { select: { name: true } } } },
          },
        },
      },
    });
    if (!conv) return false;

    const cfg = aiConfigService.get();

    // (1) An explicit per-conversation override is STICKY: once a user sets a
    // chat's bot to ON or OFF it stays exactly that way until they change it —
    // it wins over the human-handoff pause AND the global master switch.
    // botOverride is the tri-state source of truth (null = Auto, follow rules);
    // legacy botEnabled=true maps to "force on".
    if (cfg.targeting.respectPerChatOverride) {
      const override = conv.botOverride ?? (conv.botEnabled ? true : null);
      if (override === true) return true;
      if (override === false) return false;
    }

    // (2) Auto mode only: a human-handoff pause suppresses the bot so an agent
    // who took over isn't talked over. Skipped above for explicit overrides.
    if (conv.botPausedUntil) {
      if (conv.botPausedUntil > new Date()) return false;
      // Pause expired — clear it silently.
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { botPausedUntil: null },
      }).catch(() => {});
    }

    // (3) Master switch.
    if (!cfg.enabled) return false;

    // (4) / (5) Audience targeting.
    if (cfg.targeting.mode === 'all') return true;

    return this.matchesTargeting(conversationId, cfg, {
      lifecycleStage: conv.contact?.lifecycleStage ?? null,
      tagNames: (conv.contact?.contactTags ?? []).map((ct) => ct.tag.name),
    });
  }

  /**
   * Evaluate the rule-based audience filter for a conversation. Returns true
   * when the contact passes every active rule (tags, lifecycle stage, and
   * new-vs-returning). Empty/`all` rules are treated as "no constraint".
   */
  private async matchesTargeting(
    conversationId: string,
    cfg: AiConfig,
    contact: { lifecycleStage: string | null; tagNames: string[] },
  ): Promise<boolean> {
    const t = cfg.targeting;
    const tagSet = new Set(contact.tagNames.map((n) => n.toLowerCase()));

    // Exclude tags take precedence over everything else.
    if (t.excludeTags.some((tag) => tagSet.has(tag.toLowerCase()))) return false;

    // Include tags: contact must carry at least one when the list is non-empty.
    const include = t.includeTags.filter((tag) => tag.trim());
    if (include.length > 0 && !include.some((tag) => tagSet.has(tag.toLowerCase()))) return false;

    // Lifecycle stage filter.
    const stages = t.lifecycleStages.filter((s) => s.trim());
    if (stages.length > 0) {
      const stage = (contact.lifecycleStage ?? '').toUpperCase();
      if (!stages.some((s) => s.toUpperCase() === stage)) return false;
    }

    // New vs returning: "new" = this is the customer's first inbound message.
    if (t.audience !== 'all') {
      const inboundCount = await prisma.message.count({
        where: { conversationId, fromMe: false },
      });
      const isNew = inboundCount <= 1;
      if (t.audience === 'new_only' && !isNew) return false;
      if (t.audience === 'returning_only' && isNew) return false;
    }

    return true;
  }

  /**
   * Pause the bot for this conversation.
   * @param durationMs How long to pause. Defaults to the configured
   *   gating.pauseDurationHours (falling back to 8 hours).
   */
  async pauseBot(conversationId: string, durationMs?: number): Promise<void> {
    const ms = durationMs ?? (aiConfigService.get().gating.pauseDurationHours || 8) * 60 * 60 * 1000;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { botPausedUntil: new Date(Date.now() + ms) },
    });
    logger.info('ai_bot.paused', { conversationId, resumeAt: new Date(Date.now() + ms).toISOString() });
  }

  /**
   * Pause the bot because a human agent replied — but only when
   * gating.pauseOnHumanReply is enabled. Called from the message sender.
   */
  async pauseForHumanReply(conversationId: string): Promise<void> {
    const cfg = aiConfigService.get();
    if (!cfg.gating.pauseOnHumanReply) return;
    // Don't auto-pause a chat the user has explicitly forced ON — the manual
    // override is sticky and must stay ON until the user changes it. (In Auto or
    // forced-OFF chats there is nothing to keep ON, so pause as usual.)
    if (cfg.targeting.respectPerChatOverride) {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { botOverride: true, botEnabled: true },
      });
      const override = conv?.botOverride ?? (conv?.botEnabled ? true : null);
      if (override === true) return;
    }
    await this.pauseBot(conversationId);
  }

  /**
   * Manually resume the bot by clearing any active pause.
   */
  async resumeBot(conversationId: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { botPausedUntil: null },
    });
    logger.info('ai_bot.resumed', { conversationId });
  }

  /**
   * Make a handoff a REAL handoff: flag the conversation for a human, alert the
   * right people, and give it an owner. Best-effort — never throws into the
   * inbound flow (the customer has already been told a human is coming).
   */
  private async escalateToHuman(conversationId: string, ctx: { phone: string; teamId: string | null }): Promise<void> {
    try {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { contactId: true, assignedTo: true, teamId: true, contact: { select: { name: true } } },
      });
      if (!conv) return;

      // 1) Surface it: raise priority and mark unread so it jumps up the inbox.
      await prisma.conversation
        .update({ where: { id: conversationId }, data: { priority: 'HIGH', unreadCount: { increment: 1 } } })
        .catch((err) => logger.warn('ai_bot.handoff_flag_failed', { error: String(err) }));

      // 2) Alert a human. A handoff is "someone needs to grab this NOW", so we
      //    notify the whole team (assignedTo: null) rather than a single agent —
      //    this fires the popup + bell for everyone watching, not just one inbox.
      if (conv.contactId) {
        const who = conv.contact?.name || ctx.phone;
        await notificationsService.create({
          type: 'NEEDS_ATTENTION',
          priority: 'HIGH',
          titleEn: 'Customer requested a human',
          titleAr: 'طلب العميل التحدث مع موظف',
          bodyEn: `${who} asked to be transferred to a team member.`,
          bodyAr: `طلب ${who} تحويله إلى أحد أعضاء الفريق.`,
          contactId: conv.contactId,
          conversationId,
          teamId: conv.teamId ?? ctx.teamId,
          assignedTo: null,
        });
      }

      // 3) Give it an owner if it has none (no-op when already assigned or the
      //    team has auto-assign off).
      if (!conv.assignedTo) {
        const { autoAssignConversation } = await import('../conversations/auto-assign.service');
        await autoAssignConversation(conversationId).catch((err) => logger.warn('ai_bot.handoff_assign_failed', { error: String(err) }));
      }
    } catch (err) {
      logger.warn('ai_bot.handoff_escalate_failed', { conversationId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Main inbound hook — called from inbound-workflow.ts after a message is persisted.
   * Checks if the bot is active, then delegates to the registered provider.
   * The provider reply is sent via sendMessage (imported lazily to avoid circular deps).
   */
  async handleInboundMessage(
    conversationId: string,
    inboundText: string,
    ctx: { phone: string; sessionId: string; teamId: string | null },
  ): Promise<void> {
    if (!inboundText?.trim()) return;

    const provider = this.defaultProvider();
    if (!provider) return;

    const active = await this.isBotActive(conversationId);
    if (!active) return;

    // The unified AiConfig is the single source for gating + behavior. Provider
    // + API key still come from chatbotSettings (shared credentials).
    const cfg = aiConfigService.get();
    const g = cfg.gating;

    // ── Business hours ───────────────────────────────────────────────────────
    if (g.businessHoursEnabled) {
      const now = new Date();
      const [startH = 9, startM = 0] = (g.businessHoursStart || '09:00').split(':').map(Number);
      const [endH = 18, endM = 0]   = (g.businessHoursEnd   || '18:00').split(':').map(Number);
      const nowMin   = now.getHours() * 60 + now.getMinutes();
      const startMin = startH * 60 + startM;
      const endMin   = endH   * 60 + endM;
      if (nowMin < startMin || nowMin >= endMin) {
        if (g.offHoursMessage?.trim()) {
          const { sendMessage } = await import('../whatsapp/sender');
          await sendMessage(ctx.phone, g.offHoursMessage, undefined, undefined, undefined, conversationId, { byBot: true });
        }
        logger.info('ai_bot.outside_business_hours', { conversationId });
        return;
      }
    }

    // ── Human handoff ────────────────────────────────────────────────────────
    // Certain customer intents (complaint / refund / manager / human agent /
    // technical support, plus any custom trigger words) stop the bot and hand
    // the conversation to a human. Custom triggers also absorb what used to be
    // the separate "escalation keywords" list.
    if (cfg.handoff.enabled) {
      const inboundLow = inboundText.toLowerCase();
      const triggerWords: string[] = [];
      for (const [trigger, words] of Object.entries(HANDOFF_KEYWORDS)) {
        if ((cfg.handoff.triggers as unknown as Record<string, boolean>)[trigger]) {
          triggerWords.push(...words);
        }
      }
      for (const custom of cfg.handoff.customTriggers) {
        if (custom.trim()) triggerWords.push(custom.trim().toLowerCase());
      }
      const matched = triggerWords.some((kw) => inboundLow.includes(kw.toLowerCase()));
      if (matched) {
        await this.pauseBot(conversationId);
        await this.escalateToHuman(conversationId, ctx);

        const transferMsg = cfg.handoff.transferMessage?.trim();
        if (transferMsg) {
          const { sendMessage } = await import('../whatsapp/sender');
          await sendMessage(ctx.phone, transferMsg, undefined, undefined, undefined, conversationId, { byBot: true });
        }
        logger.info('ai_bot.handoff', { conversationId });
        return;
      }
    }

    // "First inbound" gates the ignore-first rule. The welcome instead keys off
    // whether the bot has replied yet (no outbound message) — so a first-contact
    // BURST of several messages still gets exactly one welcome, and debouncing
    // never skips it.
    const inboundCount = await prisma.message.count({
      where: { conversationId, fromMe: false },
    });
    const isFirstInbound = inboundCount <= 1;
    const outboundCount = await prisma.message.count({
      where: { conversationId, fromMe: true },
    });
    const isFirstReply = outboundCount === 0;

    // ── Ignore first message ─────────────────────────────────────────────────
    if (g.ignoreFirstMessage && isFirstInbound) {
      logger.info('ai_bot.skipped_first_message', { conversationId });
      return;
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    if (g.maxResponsesPerHour > 0) {
      const oneHourAgo      = new Date(Date.now() - 60 * 60 * 1000);
      const recentBotReplies = await prisma.message.count({
        where: { conversationId, fromMe: true, timestamp: { gte: oneHourAgo } },
      });
      if (recentBotReplies >= g.maxResponsesPerHour) {
        logger.info('ai_bot.rate_limited', { conversationId, recentBotReplies });
        return;
      }
    }

    // ── Build context window ─────────────────────────────────────────────────
    const contextWindow = cfg.memory.contextLength || 10;
    const recentMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
      take: contextWindow,
      select: { fromMe: true, body: true },
    });

    // Resolve the customer's name for {{customer_name}} substitution. Always
    // fetched (it's cheap and the welcome may use it); only passed into the
    // prompt when "remember name" is on.
    const convForName = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { contact: { select: { name: true } } },
    });
    const contactName = convForName?.contact?.name ?? undefined;

    // ── Typing simulation delay ──────────────────────────────────────────────
    if (g.typingDelayMs > 0) {
      await new Promise<void>((r) => setTimeout(r, Math.min(g.typingDelayMs, 5000)));
    }

    // ── First-message welcome (deterministic) ────────────────────────────────
    // The welcome is a deliberate business asset, so on the customer's FIRST
    // message we send it VERBATIM via code (variables substituted) and skip the
    // model — this guarantees it's sent in full and never reworded/collapsed by
    // the persona or length limits.
    //   • "Send exactly as written" ON  → send only the welcome, then stop.
    //   • "Send exactly as written" OFF → send the welcome, then also let the
    //     bot answer what the customer actually said (handled below, with the
    //     welcome already done so it won't greet twice).
    let welcomeHandled = false;
    const welcome = cfg.conversation.welcomeMessage?.trim();
    if (isFirstReply && welcome) {
      const text = substituteVariables(welcome, cfg, {
        customerName: contactName,
        companyName: cfg.company.name || undefined,
      });
      const { sendMessage } = await import('../whatsapp/sender');
      await sendMessage(ctx.phone, text, undefined, undefined, undefined, conversationId, { byBot: true });
      logger.info('ai_bot.sent_welcome', { conversationId, exact: cfg.conversation.welcomeMessageExact });
      if (cfg.conversation.welcomeMessageExact) return;
      welcomeHandled = true;
    }

    // ── Generate reply ───────────────────────────────────────────────────────
    let reply: string | null = null;
    try {
      reply = await provider.generateReply({
        conversationId,
        phone: ctx.phone,
        teamId: ctx.teamId,
        inboundText,
        recentMessages: recentMessages.reverse(),
        contactName: cfg.memory.rememberName ? contactName : undefined,
        // The welcome was already sent above for non-exact mode, so don't let
        // the model greet again — treat this follow-up as a normal reply.
        isFirstMessage: welcomeHandled ? false : isFirstReply,
      });
    } catch (err) {
      logger.warn('ai_bot.provider_error', {
        provider: provider.name,
        conversationId,
        error: err instanceof Error ? err.message : String(err),
      });
      if (g.fallbackMessage?.trim()) {
        const { sendMessage } = await import('../whatsapp/sender');
        await sendMessage(ctx.phone, g.fallbackMessage, undefined, undefined, undefined, conversationId, { byBot: true });
      }
      return;
    }

    if (!reply) {
      if (g.fallbackMessage?.trim()) {
        const { sendMessage } = await import('../whatsapp/sender');
        await sendMessage(ctx.phone, g.fallbackMessage, undefined, undefined, undefined, conversationId, { byBot: true });
      }
      return;
    }

    // Lazy import breaks the circular dep: ai-bot → sender → getOrCreate → ...
    const { sendMessage } = await import('../whatsapp/sender');
    await sendMessage(ctx.phone, reply, undefined, undefined, undefined, conversationId, { byBot: true });
    logger.info('ai_bot.replied', { conversationId, provider: provider.name });
  }
}

export const aiBotService = new AiBotService();
