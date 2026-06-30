import type {
  AiConfig,
  ArabicDialect,
  EmojiUsage,
  ResponseLength,
  SalesMode,
  Tone,
} from './ai-config.service';

// ─────────────────────────────────────────────────────────────────────────────
// Pure prompt-generation layer. Turns a structured AiConfig into a single
// system prompt, in the order defined by the spec (section 11):
//   Role/Identity → Personality → Company Knowledge → Business Rules →
//   Sales → Conversation Rules → Safety → Handoff
// Every subsection is only emitted when it has content, so the prompt stays
// tight. No side effects, no I/O — safe to call on every send and from preview.
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptContext {
  customerName?: string;
  companyName?: string;
  agentName?: string;
  language?: string;
  serviceName?: string;
  now?: Date;
  /**
   * Whether this is the customer's FIRST inbound message in the conversation.
   * - true  → include the welcome instruction (greet, then help).
   * - false → omit the welcome entirely so the persona drives the reply.
   * - undefined → caller doesn't know (preview/playground); describe the
   *   intended first-reply behavior so the admin can see it.
   */
  isFirstMessage?: boolean;
}

// ── Variable substitution ────────────────────────────────────────────────────

/** Replace {{variables}} (built-in + custom) throughout a string. */
export function substituteVariables(
  text: string,
  cfg: AiConfig,
  ctx: PromptContext = {},
): string {
  if (!text) return '';
  const now = ctx.now ?? new Date();
  const builtins: Record<string, string> = {
    customer_name: ctx.customerName || '',
    company_name: ctx.companyName || cfg.company.name || '',
    agent_name: ctx.agentName || cfg.personality.assistantName || '',
    service_name: ctx.serviceName || '',
    language: ctx.language || cfg.personality.language || '',
    today: now.toISOString().slice(0, 10),
    current_time: now.toTimeString().slice(0, 5),
  };
  const custom: Record<string, string> = {};
  for (const v of cfg.customVariables) {
    if (v.key?.trim()) custom[v.key.trim()] = v.value ?? '';
  }
  const all = { ...builtins, ...custom };
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name: string) => {
    const key = name.trim();
    return key in all ? all[key] : match;
  });
}

// ── Phrasing helpers ─────────────────────────────────────────────────────────

const TONE_PHRASES: Record<Tone, string> = {
  professional: 'professional, clear, and competent',
  friendly: 'warm, friendly, and approachable',
  luxury: 'refined, elegant, and premium — like a high-end concierge',
  formal: 'formal, precise, and respectful',
  casual: 'relaxed, casual, and conversational',
};

const EMOJI_PHRASES: Record<EmojiUsage, string> = {
  none: 'Do not use emojis.',
  low: 'Use emojis very sparingly — at most one where it genuinely helps.',
  medium: 'Use a few tasteful emojis to add warmth, without overdoing it.',
  high: 'Use expressive emojis freely to add personality.',
};

const LENGTH_PHRASES: Record<ResponseLength, string> = {
  short:
    'REPLY LENGTH = SHORT. Answer in 1–2 short sentences (aim for under ~300 characters). Get straight to the point — no greeting line, no closing, no filler. Do not use bullet lists or headings unless the customer explicitly asks for a list.',
  medium:
    'REPLY LENGTH = MEDIUM. Keep replies to a short paragraph (about 2–4 sentences). Be concise and easy to scan.',
  long:
    'REPLY LENGTH = LONG. Give a thorough, detailed reply: you may use several short paragraphs or sections, bullet lists, and examples when the question genuinely benefits from it. Still avoid rambling or repetition.',
};

// Short label for each Arabic dialect, used in the personality instructions.
const DIALECT_LABEL: Record<ArabicDialect, string> = {
  saudi: 'Saudi (Najdi) Arabic dialect',
  gulf: 'Gulf (Khaleeji) Arabic dialect',
  egyptian: 'Egyptian Arabic dialect',
  levantine: 'Levantine (Shami) Arabic dialect',
  msa: 'Modern Standard Arabic (الفصحى)',
};

const SALES_PHRASES: Record<SalesMode, string> = {
  off: '',
  soft: 'Adopt a soft-selling approach: be helpful first, guide gently toward the offer, and never pressure the customer.',
  hard: 'Adopt an assertive selling approach: confidently highlight value, create urgency where appropriate, and actively drive toward closing.',
  consultation: 'Act as a consultant: understand the customer’s needs through questions before recommending anything.',
};

function level(n: number): 'low' | 'moderate' | 'high' {
  if (n <= 0.33) return 'low';
  if (n <= 0.66) return 'moderate';
  return 'high';
}

function bullets(items: string[]): string {
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join('\n');
}

// ── Section builders ─────────────────────────────────────────────────────────

function identitySection(cfg: AiConfig): string {
  const name    = cfg.personality.assistantName?.trim();
  const company = cfg.company.name?.trim();
  const persona = cfg.personality.persona?.trim();
  // "Arabic-capable" = the bot may reply in Arabic (explicit ar, or auto).
  const arabicCapable = cfg.personality.language === 'ar' || cfg.personality.language === 'auto';
  const isSaudi = arabicCapable && cfg.personality.dialect === 'saudi';
  const who      = name ? `You are ${name}` : 'You are an AI assistant';
  const forCo    = company ? ` for ${company}` : ' for a business';

  const lines: string[] = [];
  if (isSaudi) {
    lines.push(`${who}, a customer support and sales assistant${forCo} communicating with customers over WhatsApp. You represent a professional Saudi business. Communicate exactly like a highly experienced, friendly Saudi customer service and sales specialist — warm, polished, and conversion-focused. Your job is to help customers accurately and consistently, strictly within what this business actually offers.`);
  } else {
    lines.push(`${who}, a customer support and sales assistant${forCo} communicating with customers over WhatsApp. Your job is to help customers accurately and consistently, strictly within what this business actually offers.`);
  }
  // The persona is a hard instruction — it defines the character the bot plays.
  if (persona) {
    lines.push(`You must fully embody this character/persona in every reply, while staying within all rules and company facts below:\n${persona}`);
  }
  return lines.join('\n\n');
}

function personalitySection(cfg: AiConfig): string {
  const p = cfg.personality;
  const lines: string[] = [];
  lines.push(`Tone: be ${TONE_PHRASES[p.tone]}.`);
  lines.push(`Formality level: ${level(p.formality)}.`);
  lines.push(`Humor: ${level(p.humorLevel)}.`);
  lines.push(EMOJI_PHRASES[p.emojiUsage]);
  if (p.language === 'ar') lines.push('Always reply in Arabic.');
  else if (p.language === 'en') lines.push('Always reply in English.');
  else lines.push('Reply in the same language the customer used.');
  // Dialect only matters for Arabic replies. Applies for explicit Arabic and for
  // auto-detect (when the customer writes in Arabic), but never forces Arabic.
  if (p.language !== 'en') {
    if (p.dialect === 'msa') {
      lines.push('When you reply in Arabic, use formal Modern Standard Arabic (الفصحى). Avoid slang and local dialect.');
    } else {
      lines.push(`When you reply in Arabic, write in ${DIALECT_LABEL[p.dialect]} — natural and conversational, the way locals genuinely speak, not stiff textbook Arabic.`);
    }
  }
  if (p.writingStyle?.trim()) lines.push(`Writing style: ${p.writingStyle.trim()}.`);
  // Creativity: how much the bot improvises vs. sticks to provided facts/scripts.
  const creativity = level(cfg.general.creativityLevel);
  if (creativity === 'low') {
    lines.push('Stick closely to the provided company information and scripts; keep wording consistent and do not improvise or embellish.');
  } else if (creativity === 'high') {
    lines.push('Feel free to vary your phrasing and be expressive and persuasive, while staying accurate to the provided information.');
  }
  return `# Personality\n${lines.join('\n')}`;
}

function companySection(cfg: AiConfig): string {
  const c = cfg.company;
  const fields: Array<[string, string]> = [
    ['Company name', c.name],
    ['About', c.about],
    ['Services', c.services],
    ['Pricing', c.pricing],
    ['FAQs', c.faqs],
    ['Policies', c.policies],
    ['Working hours', c.workingHours],
    ['Locations', c.locations],
    ['Contact', c.contact],
    ['Important notes', c.notes],
  ];
  const present = fields.filter(([, v]) => v?.trim());
  if (present.length === 0) return '';
  const body = present.map(([label, v]) => `## ${label}\n${v.trim()}`).join('\n\n');
  return `# Company Information (your single source of truth)\n${body}`;
}

function productsSection(cfg: AiConfig): string {
  const pc = cfg.products;
  if (!pc?.enabled) return '';
  const items = (pc.items || []).filter((p) => p.nameEn?.trim() || p.nameAr?.trim());
  if (items.length === 0) return '';

  const blocks = items.map((p) => {
    const title = [p.nameEn?.trim(), p.nameAr?.trim()].filter(Boolean).join(' — ');
    const lines: string[] = [`## ${title}`];
    if (p.available === false) lines.push('(Currently UNAVAILABLE — do not offer, promise, or sell this.)');
    const desc = [p.descriptionEn?.trim(), p.descriptionAr?.trim()].filter(Boolean);
    if (desc.length) lines.push(desc.join(' / '));
    if (p.price?.trim()) lines.push(`Price: ${p.price.trim()}`);
    const opts = (p.options || []).filter((o) => o.nameEn?.trim() || o.nameAr?.trim());
    if (opts.length) {
      lines.push('Options:');
      for (const o of opts) {
        const oname = [o.nameEn?.trim(), o.nameAr?.trim()].filter(Boolean).join(' / ');
        const oprice = o.price?.trim() ? ` (${o.price.trim()})` : '';
        lines.push(`- ${oname}${oprice}`);
      }
    }
    return lines.join('\n');
  });

  const header = '# Products & Pricing (you may ONLY offer or sell what is listed here; never invent products, options, or prices)';
  const currencyNote = pc.currency?.trim() ? `\nDefault currency: ${pc.currency.trim()}.` : '';
  return `${header}${currencyNote}\n\n${blocks.join('\n\n')}`;
}

function businessRulesSection(cfg: AiConfig): string {
  const rules = bullets(cfg.businessRules);
  if (!rules) return '';
  return `# Business Rules (must always follow)\n${rules}`;
}

function salesSection(cfg: AiConfig): string {
  const s = cfg.sales;
  if (s.mode === 'off') return '';
  const lines: string[] = [SALES_PHRASES[s.mode]];
  if (s.leadQualificationQuestions.filter((q) => q.trim()).length) {
    lines.push(`When qualifying a lead, naturally work in these questions:\n${bullets(s.leadQualificationQuestions)}`);
  }
  if (s.bookingFlow?.trim()) lines.push(`Booking flow: ${s.bookingFlow.trim()}`);
  if (s.cta?.trim()) lines.push(`Primary call to action: ${s.cta.trim()}`);
  if (s.upsell?.trim()) lines.push(`Upselling guidance: ${s.upsell.trim()}`);
  if (s.crossSell?.trim()) lines.push(`Cross-selling guidance: ${s.crossSell.trim()}`);
  if (s.closing?.trim()) lines.push(`Closing approach: ${s.closing.trim()}`);
  return `# Sales Approach\n${lines.filter(Boolean).join('\n')}`;
}

function conversationSection(cfg: AiConfig, ctx: PromptContext = {}): string {
  const c = cfg.conversation;
  const lines: string[] = [LENGTH_PHRASES[cfg.general.responseLength]];
  const welcome = c.welcomeMessage?.trim();
  // The welcome only belongs on the customer's FIRST message. When we KNOW this
  // isn't the first message, omit it entirely so the persona/character drives
  // the reply (no repeated greetings). When unknown (preview), describe intent.
  if (welcome && ctx.isFirstMessage !== false) {
    if (ctx.isFirstMessage === true) {
      lines.push(c.welcomeMessageExact
        ? `This is the customer's FIRST message. Reply with EXACTLY this welcome and nothing else (do not change the wording): "${welcome}"`
        : `This is the customer's FIRST message in this conversation. Open your reply with this welcome (adapt it to the customer and their language), then help them: "${welcome}"`);
    } else {
      lines.push(c.welcomeMessageExact
        ? `For your FIRST reply in a new conversation, open with EXACTLY this message (do not change the wording): "${welcome}"`
        : `For your first reply in a new conversation, open with a greeting along these lines (adapt it to the customer and their language): "${welcome}"`);
    }
  }
  // maxSentences is an optional hard cap that fine-tunes short/medium replies.
  // It is intentionally NOT applied when the length is "long", so choosing
  // "long" is never silently capped by the default sentence limit.
  if (c.maxSentences > 0 && cfg.general.responseLength !== 'long') {
    lines.push(`Use at most ${c.maxSentences} sentence(s) per reply.`);
  }
  if (c.maxResponseChars > 0) lines.push(`Keep each reply under ${c.maxResponseChars} characters.`);
  lines.push(c.useBulletPoints
    ? 'Use short bullet points when listing multiple items.'
    : 'Prefer plain conversational text; avoid markdown formatting.');
  if (c.alwaysGreet && !welcome) lines.push('Greet the customer warmly at the start of a new conversation.');
  if (c.useCustomerName) lines.push('Address the customer by name ({{customer_name}}) when it is known.');
  if (c.askFollowUp) lines.push('End with a relevant follow-up question to keep the conversation moving.');
  if (c.alwaysEndWithCta) lines.push('End each reply with a clear call to action.');
  if (c.typingStyle?.trim()) lines.push(`Typing style: ${c.typingStyle.trim()}.`);
  return `# Conversation Rules\n${lines.join('\n')}`;
}

/** Normalize text for cross-section duplicate detection (whitespace + case). */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function safetySection(cfg: AiConfig): string {
  const s = cfg.safety;
  const lines: string[] = [];
  if (s.businessOnlyMode) lines.push('Only discuss topics related to this business. Politely decline unrelated requests.');
  if (s.refusePolitical) lines.push('Never discuss politics. Politely decline.');
  if (s.refuseReligious) lines.push('Never discuss religion. Politely decline.');
  if (s.refuseMedical) lines.push('Never give medical advice. Recommend a qualified professional.');
  if (s.refuseLegal) lines.push('Never give legal advice. Recommend a qualified professional.');
  // Drop any forbidden topic that is already stated verbatim as a business rule,
  // so the same (often long) text isn't paid for twice on every single message.
  const ruleSet = new Set(cfg.businessRules.map(norm));
  const topics = s.forbiddenTopics.filter((t) => t.trim() && !ruleSet.has(norm(t)));
  if (topics.length) {
    lines.push(`Never discuss the following topics:\n${bullets(topics)}`);
  }
  if (s.safeMode) lines.push('Never produce harmful, offensive, discriminatory, or unsafe content.');
  if (lines.length === 0) return '';
  return `# Safety & Boundaries\n${lines.join('\n')}`;
}

function handoffSection(cfg: AiConfig): string {
  const h = cfg.handoff;
  if (!h.enabled && !cfg.safety.humanEscalation) return '';
  const triggers: string[] = [];
  if (h.triggers.complaint) triggers.push('a complaint');
  if (h.triggers.refund) triggers.push('a refund request');
  if (h.triggers.manager) triggers.push('asking for a manager');
  if (h.triggers.humanAgent) triggers.push('asking for a human agent');
  if (h.triggers.technicalSupport) triggers.push('a technical support issue');
  for (const t of h.customTriggers) if (t.trim()) triggers.push(t.trim());
  const lines: string[] = [];
  if (triggers.length) {
    lines.push(`If the customer raises any of these, stop trying to resolve it yourself and hand off to a human agent: ${triggers.join(', ')}.`);
  } else if (cfg.safety.humanEscalation) {
    lines.push('If you cannot safely or accurately help, hand off to a human agent instead of guessing.');
  }
  if (h.transferMessage?.trim()) lines.push(`When handing off, say: "${h.transferMessage.trim()}"`);
  if (lines.length === 0) return '';
  return `# Human Handoff\n${lines.join('\n')}`;
}

function whatsappFormattingSection(cfg: AiConfig): string {
  // The detailed Saudi expression guide only applies when the bot speaks Saudi
  // Arabic. Other dialects get their instruction from the Personality section.
  const isSaudi =
    (cfg.personality.language === 'ar' || cfg.personality.language === 'auto') &&
    cfg.personality.dialect === 'saudi';
  const length = cfg.general.responseLength;
  const lines: string[] = [
    'These rules govern HOW you format a message (markdown, emojis, structure). They do NOT change HOW LONG it is — always obey the REPLY LENGTH instruction above; length wins over any structural suggestion here.',
    '',
    '## Formatting',
    '- Use WhatsApp formatting: *bold* (single asterisks) for key words like *Price* / *السعر*.',
    '- Break longer replies into short paragraphs separated by blank lines; never send one large wall of text.',
    '- When you list three or more services, products, or options, use bullet points (one relevant emoji per item).',
    '- Use numbered steps for instructions or multi-step processes.',
    '',
    '## Emoji rules',
    '- Use professional, relevant emojis to organize sections and add warmth.',
    '- Approved emojis: 👋 📌 ✅ 💡 📈 📱 💻 🎨 🤖 ✨ 📞 🎯 🏆 🛒 💰 📋',
    '- Limit: 3–6 emojis per message (far fewer in short replies).',
    '- NEVER use casual or joke emojis: 😂 🤣 😅 😜 😈 💀 🔥 💩',
  ];

  if (length === 'short') {
    lines.push(
      '',
      '## Keep it short',
      '- Answer in 1–2 sentences with no greeting line, no closing, and no filler.',
      '- Do not add bullet lists, headings, or a call to action unless the customer explicitly asked for them.',
    );
  } else {
    lines.push(
      '',
      '## Suggested shape for richer replies (use only what the message needs)',
      '- A direct answer or short introduction first.',
      '- Details in bullets or a numbered list when there are multiple items.',
      '- A short next step or call to action when it is genuinely helpful.',
    );
  }

  if (isSaudi) {
    // Quality-critical: the expressions + tone make replies feel genuinely Saudi.
    // Kept compact; the long worked example is only added for non-short replies.
    lines.push(
      '',
      '## Saudi Arabic style (Arabic replies)',
      'Sound like a polished, experienced Saudi customer-service & sales employee on WhatsApp — warm and natural, never robotic or stiff فصحى. Confident but never pushy.',
      'Weave in fitting Saudi expressions (do not overuse): حياك الله، أهلاً وسهلاً، يسعدني خدمتك، تحت أمرك، أبشر، بإذن الله، نورتنا. Address the customer as أستاذ / أخي / أختي when suitable.',
    );
    if (length !== 'short') {
      lines.push(
        '',
        'Match this tone and layout in Arabic:',
        '👋 أهلاً وسهلاً أستاذ {{customer_name}}',
        '',
        'يسعدنا تواصلك معنا، وأنا تحت أمرك لمساعدتك في اختيار الخدمة المناسبة. ✨',
      );
    }
  }

  return `# WhatsApp Formatting & Communication Style (mandatory)\n${lines.join('\n')}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Assemble the full system prompt from config, then substitute variables. */
export function buildSystemPrompt(cfg: AiConfig, ctx: PromptContext = {}): string {
  if (cfg.rawPromptOverride?.trim()) {
    return substituteVariables(cfg.rawPromptOverride, cfg, ctx);
  }
  const sections = [
    identitySection(cfg),
    whatsappFormattingSection(cfg),
    personalitySection(cfg),
    companySection(cfg),
    productsSection(cfg),
    businessRulesSection(cfg),
    salesSection(cfg),
    conversationSection(cfg, ctx),
    safetySection(cfg),
    handoffSection(cfg),
  ].filter((s) => s && s.trim());
  const prompt = sections.join('\n\n');
  return substituteVariables(prompt, cfg, ctx);
}

/** Rough token estimate (~4 chars/token) for the preview panel. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Short human-readable lines describing the active configuration. */
export function buildConfigSummary(cfg: AiConfig): string[] {
  const out: string[] = [];
  out.push(`Tone: ${cfg.personality.tone}`);
  out.push(`Language: ${cfg.personality.language}`);
  if (cfg.personality.language !== 'en') out.push(`Arabic dialect: ${cfg.personality.dialect}`);
  if (cfg.personality.persona?.trim()) out.push('Persona: custom');
  out.push(`Emoji usage: ${cfg.personality.emojiUsage}`);
  out.push(`Response length: ${cfg.general.responseLength}`);
  out.push(`Sales mode: ${cfg.sales.mode}`);
  out.push(`Business rules: ${cfg.businessRules.filter((r) => r.trim()).length}`);
  if (cfg.products?.enabled) {
    out.push(`Products: ${(cfg.products.items || []).filter((p) => p.nameEn?.trim() || p.nameAr?.trim()).length}`);
  }
  const safetyOn = [
    cfg.safety.businessOnlyMode && 'business-only',
    cfg.safety.refusePolitical && 'no-politics',
    cfg.safety.refuseReligious && 'no-religion',
    cfg.safety.refuseMedical && 'no-medical',
    cfg.safety.refuseLegal && 'no-legal',
    cfg.safety.safeMode && 'safe-mode',
  ].filter(Boolean);
  out.push(`Safety: ${safetyOn.length ? safetyOn.join(', ') : 'off'}`);
  out.push(`Handoff: ${cfg.handoff.enabled ? 'on' : 'off'}`);
  const knowledge = Object.values(cfg.company).filter((v) => v?.trim()).length;
  out.push(`Company fields filled: ${knowledge}/10`);
  return out;
}
