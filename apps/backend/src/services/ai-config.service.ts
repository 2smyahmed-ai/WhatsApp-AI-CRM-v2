import path from 'path';
import fs from 'fs';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Structured, fully-editable AI configuration for the customer-facing WhatsApp
// bot. This is the SINGLE SOURCE OF TRUTH for the customer bot: behavior
// (personality, company knowledge, rules → generated prompt), gating (WHEN the
// bot answers), and targeting (WHICH customers it answers). The final system
// prompt is GENERATED from this config (see ai-prompt-builder.ts) rather than
// authored as a single blob of text.
//
// Storage mirrors chatbot-settings.service.ts: a cached, file-based JSON store.
// Provider + API key live in chatbot-settings.service.ts (single source of
// credentials, shared with the CRM assistant + lead qualification); everything
// else about the customer bot lives here, with no overlapping fields.
// ─────────────────────────────────────────────────────────────────────────────

export type ResponseLength = 'short' | 'medium' | 'long';
export type ResponseSpeed = 'fast' | 'balanced' | 'thorough';
export type Tone = 'professional' | 'friendly' | 'luxury' | 'formal' | 'casual';
export type EmojiUsage = 'none' | 'low' | 'medium' | 'high';
export type ConfigLanguage = 'ar' | 'en' | 'auto';
/** Arabic dialect the bot uses when it replies in Arabic. */
export type ArabicDialect = 'saudi' | 'gulf' | 'egyptian' | 'levantine' | 'msa';
export type SalesMode = 'off' | 'soft' | 'hard' | 'consultation';

export interface AiGeneralSettings {
  model: string;
  temperature: number;       // 0–1
  maxTokens: number;
  responseLength: ResponseLength;
  creativityLevel: number;   // 0–1
  responseSpeed: ResponseSpeed;
}

export interface AiPersonality {
  assistantName: string;
  tone: Tone;
  formality: number;         // 0–1
  emojiUsage: EmojiUsage;
  humorLevel: number;        // 0–1
  language: ConfigLanguage;
  /** Arabic dialect used for Arabic replies (Saudi by default). */
  dialect: ArabicDialect;
  /** Free-text character/persona the bot must embody (e.g. "a calm, expert Saudi sales advisor named Sara"). */
  persona: string;
  writingStyle: string;      // free text
}

export interface AiCompanyKnowledge {
  name: string;
  about: string;
  services: string;
  pricing: string;
  faqs: string;
  policies: string;
  workingHours: string;
  locations: string;
  contact: string;
  notes: string;
}

// ── Products: WHAT the business sells (bilingual catalog) ────────────────────
export interface AiProductOption {
  nameEn: string;
  nameAr: string;
  price: string;   // free text, e.g. "+20 SAR" or "199"
}

export interface AiProduct {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: string;          // free text, e.g. "199 SAR" or "from 99"
  available: boolean;
  options: AiProductOption[];
}

export interface AiProductsConfig {
  /** Include the catalog in the generated prompt. */
  enabled: boolean;
  /** Default currency label (e.g. "SAR"), shown to the bot. Optional. */
  currency: string;
  items: AiProduct[];
}

export interface AiSalesConfig {
  mode: SalesMode;
  leadQualificationQuestions: string[];
  bookingFlow: string;
  cta: string;
  upsell: string;
  crossSell: string;
  closing: string;
}

export interface AiConversationRules {
  /** The greeting the bot opens a NEW conversation with. Blank = no scripted welcome. */
  welcomeMessage: string;
  /** true = send the welcome verbatim; false = let the bot adapt it to the customer/language. */
  welcomeMessageExact: boolean;
  maxResponseChars: number;  // 0 = no limit
  maxSentences: number;      // 0 = no limit
  useBulletPoints: boolean;
  alwaysGreet: boolean;
  alwaysEndWithCta: boolean;
  useCustomerName: boolean;
  askFollowUp: boolean;
  typingStyle: string;       // free text
}

export interface AiSafetyConfig {
  businessOnlyMode: boolean;
  refusePolitical: boolean;
  refuseReligious: boolean;
  refuseMedical: boolean;
  refuseLegal: boolean;
  humanEscalation: boolean;
  safeMode: boolean;
  forbiddenTopics: string[];
}

export interface AiHandoffTriggers {
  complaint: boolean;
  refund: boolean;
  manager: boolean;
  humanAgent: boolean;
  technicalSupport: boolean;
}

export interface AiHandoffConfig {
  enabled: boolean;
  triggers: AiHandoffTriggers;
  customTriggers: string[];
  transferMessage: string;
}

export interface AiMemoryConfig {
  contextLength: number;
  rememberName: boolean;
  rememberOrders: boolean;
  rememberPreferences: boolean;
  persistent: boolean;
}

export interface AiCustomVariable {
  key: string;
  value: string;
}

// ── Gating: WHEN the bot is allowed to answer ────────────────────────────────
export interface AiGatingConfig {
  businessHoursEnabled: boolean;
  businessHoursStart: string;     // "HH:MM" local server time
  businessHoursEnd: string;       // "HH:MM" local server time
  offHoursMessage: string;        // sent when a message arrives outside hours (blank = stay silent)
  maxResponsesPerHour: number;    // 0 = unlimited; rate-limit bot replies per conversation
  ignoreFirstMessage: boolean;    // skip the very first inbound message in a conversation
  typingDelayMs: number;          // ms to wait before sending (0-5000)
  fallbackMessage: string;        // sent when the AI returns null or errors (blank = stay silent)
  pauseOnHumanReply: boolean;     // pause the bot when a human agent replies
  pauseDurationHours: number;     // how long that pause lasts
}

export type TargetingMode = 'all' | 'rules';
export type TargetingAudience = 'all' | 'new_only' | 'returning_only';

// ── Targeting: WHICH customers the bot answers ───────────────────────────────
export interface AiTargetingConfig {
  /** 'all' = every conversation; 'rules' = only contacts matching the filters below. */
  mode: TargetingMode;
  /** Tag names the contact MUST have (empty = any). */
  includeTags: string[];
  /** Tag names that exclude a contact (takes precedence over includeTags). */
  excludeTags: string[];
  /** Contact.lifecycleStage values to include (empty = any). */
  lifecycleStages: string[];
  /** New vs returning customers. */
  audience: TargetingAudience;
  /** When true, a per-conversation override (botOverride) wins over these rules. */
  respectPerChatOverride: boolean;
}

export interface AiConfig {
  /** Master switch for the customer-facing WhatsApp bot. */
  enabled: boolean;
  general: AiGeneralSettings;
  personality: AiPersonality;
  businessRules: string[];
  company: AiCompanyKnowledge;
  /** WHAT the business sells — bilingual catalog with options/prices. */
  products: AiProductsConfig;
  sales: AiSalesConfig;
  conversation: AiConversationRules;
  safety: AiSafetyConfig;
  handoff: AiHandoffConfig;
  memory: AiMemoryConfig;
  /** WHEN the bot answers (business hours, rate limits, pause, etc.). */
  gating: AiGatingConfig;
  /** WHICH customers the bot answers (tags, lifecycle, new vs returning). */
  targeting: AiTargetingConfig;
  customVariables: AiCustomVariable[];
  /** Advanced escape hatch — if non-empty, used verbatim instead of the generated prompt. */
  rawPromptOverride: string;
  /** Internal: set once the one-time migration from legacy ChatbotSettings has run. */
  _migratedV2?: boolean;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'ai-config.json');

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  general: {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.6,
    maxTokens: 400,
    responseLength: 'short',
    creativityLevel: 0.5,
    responseSpeed: 'balanced',
  },
  personality: {
    assistantName: '',
    tone: 'professional',
    formality: 0.5,
    emojiUsage: 'low',
    humorLevel: 0.2,
    language: 'auto',
    dialect: 'saudi',
    persona: '',
    writingStyle: '',
  },
  businessRules: [
    'Never invent prices, discounts, or fees you were not given.',
    'Never promise services, products, or delivery dates that are not confirmed available.',
    'Only answer questions within the business scope; politely decline anything else.',
    'Always answer based strictly on the company information provided.',
    'If information is missing, ask a clarifying question instead of guessing.',
    'Refuse unsupported or out-of-scope requests politely.',
  ],
  company: {
    name: '',
    about: '',
    services: '',
    pricing: '',
    faqs: '',
    policies: '',
    workingHours: '',
    locations: '',
    contact: '',
    notes: '',
  },
  products: {
    enabled: true,
    currency: '',
    items: [],
  },
  sales: {
    mode: 'soft',
    leadQualificationQuestions: [],
    bookingFlow: '',
    cta: '',
    upsell: '',
    crossSell: '',
    closing: '',
  },
  conversation: {
    welcomeMessage: '',
    welcomeMessageExact: false,
    maxResponseChars: 0,
    maxSentences: 4,
    useBulletPoints: false,
    alwaysGreet: false,
    alwaysEndWithCta: false,
    useCustomerName: true,
    askFollowUp: true,
    typingStyle: '',
  },
  safety: {
    businessOnlyMode: true,
    refusePolitical: true,
    refuseReligious: true,
    refuseMedical: false,
    refuseLegal: false,
    humanEscalation: true,
    safeMode: true,
    forbiddenTopics: [],
  },
  handoff: {
    enabled: true,
    triggers: {
      complaint: true,
      refund: true,
      manager: true,
      humanAgent: true,
      technicalSupport: false,
    },
    customTriggers: [],
    transferMessage: '',
  },
  memory: {
    contextLength: 6,
    rememberName: true,
    rememberOrders: false,
    rememberPreferences: false,
    persistent: false,
  },
  gating: {
    businessHoursEnabled: false,
    businessHoursStart: '09:00',
    businessHoursEnd: '18:00',
    offHoursMessage: '',
    maxResponsesPerHour: 0,
    ignoreFirstMessage: false,
    typingDelayMs: 0,
    fallbackMessage: '',
    pauseOnHumanReply: true,
    pauseDurationHours: 8,
  },
  targeting: {
    mode: 'all',
    includeTags: [],
    excludeTags: [],
    lifecycleStages: [],
    audience: 'all',
    respectPerChatOverride: true,
  },
  customVariables: [],
  rawPromptOverride: '',
  _migratedV2: false,
};

/** Deep-merge a partial config onto a base, preserving nested defaults. */
export function mergeAiConfig(base: AiConfig, partial: Partial<AiConfig> | null | undefined): AiConfig {
  if (!partial || typeof partial !== 'object') return base;
  return {
    ...base,
    ...partial,
    general: { ...base.general, ...(partial.general ?? {}) },
    personality: { ...base.personality, ...(partial.personality ?? {}) },
    company: { ...base.company, ...(partial.company ?? {}) },
    products: {
      ...base.products,
      ...(partial.products ?? {}),
      // Array of products is replaced wholesale when provided.
      items: partial.products?.items ?? base.products.items,
    },
    sales: { ...base.sales, ...(partial.sales ?? {}) },
    conversation: { ...base.conversation, ...(partial.conversation ?? {}) },
    safety: { ...base.safety, ...(partial.safety ?? {}) },
    handoff: {
      ...base.handoff,
      ...(partial.handoff ?? {}),
      triggers: { ...base.handoff.triggers, ...(partial.handoff?.triggers ?? {}) },
    },
    memory: { ...base.memory, ...(partial.memory ?? {}) },
    gating: { ...base.gating, ...(partial.gating ?? {}) },
    targeting: {
      ...base.targeting,
      ...(partial.targeting ?? {}),
      // Arrays are replaced wholesale when provided.
      includeTags: partial.targeting?.includeTags ?? base.targeting.includeTags,
      excludeTags: partial.targeting?.excludeTags ?? base.targeting.excludeTags,
      lifecycleStages: partial.targeting?.lifecycleStages ?? base.targeting.lifecycleStages,
    },
    // Arrays are replaced wholesale when provided.
    businessRules: partial.businessRules ?? base.businessRules,
    customVariables: partial.customVariables ?? base.customVariables,
  };
}

const LEGACY_SETTINGS_PATH = path.resolve(process.cwd(), 'config', 'chatbot-settings.json');

/**
 * One-time reconciliation from the legacy ChatbotSettings store into this
 * unified config. Reads the legacy JSON directly (no service dependency) and
 * imports only fields that are brand-new here (gating) or still empty here
 * (raw prompt, escalation), so it never clobbers values the admin already set.
 *
 * Crucially it sets the master `enabled` to the legacy value, preserving the
 * CURRENT effective behavior: under the old code the bot's on/off gate was the
 * legacy `enabled` flag, so we don't silently switch the bot on during upgrade.
 */
function migrateFromLegacy(cfg: AiConfig): AiConfig {
  if (cfg._migratedV2) return cfg;

  let legacy: Record<string, unknown> | null = null;
  try {
    if (fs.existsSync(LEGACY_SETTINGS_PATH)) {
      legacy = JSON.parse(fs.readFileSync(LEGACY_SETTINGS_PATH, 'utf-8'));
    }
  } catch (err) {
    logger.warn('ai_config.legacy_read_error', { error: String(err) });
  }

  if (legacy) {
    const str = (k: string) => (typeof legacy![k] === 'string' ? (legacy![k] as string) : '');
    const num = (k: string, d: number) => (typeof legacy![k] === 'number' ? (legacy![k] as number) : d);
    const bool = (k: string, d = false) => (typeof legacy![k] === 'boolean' ? (legacy![k] as boolean) : d);

    // Behavior: import the legacy raw prompt as the override only if none set.
    if (!cfg.rawPromptOverride?.trim() && str('systemPrompt').trim()) {
      cfg.rawPromptOverride = str('systemPrompt');
    }

    // Gating block is brand-new here — always import from legacy.
    cfg.gating = {
      businessHoursEnabled: bool('businessHoursEnabled'),
      businessHoursStart: str('businessHoursStart') || '09:00',
      businessHoursEnd: str('businessHoursEnd') || '18:00',
      offHoursMessage: str('offHoursMessage'),
      maxResponsesPerHour: num('maxResponsesPerHour', 0),
      ignoreFirstMessage: bool('ignoreFirstMessage'),
      typingDelayMs: num('typingDelayMs', 0),
      fallbackMessage: str('fallbackMessage'),
      pauseOnHumanReply: bool('pauseOnHumanReply', true),
      pauseDurationHours: num('pauseDurationHours', 8),
    };

    // Escalation → handoff (only when handoff has no custom triggers yet).
    if (str('escalationKeywords').trim() && cfg.handoff.customTriggers.length === 0) {
      cfg.handoff.customTriggers = str('escalationKeywords')
        .split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (str('escalationMessage').trim() && !cfg.handoff.transferMessage?.trim()) {
      cfg.handoff.transferMessage = str('escalationMessage');
    }

    // Targeting: replyToAllConversations → 'all', otherwise rule-based.
    cfg.targeting.mode = bool('replyToAllConversations') ? 'all' : 'rules';

    // Master switch: preserve the current effective on/off state.
    cfg.enabled = bool('enabled');
  }

  cfg._migratedV2 = true;
  return cfg;
}

class AiConfigService {
  private cache: AiConfig | null = null;

  get(): AiConfig {
    if (this.cache) return this.cache;
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        this.cache = mergeAiConfig(DEFAULT_AI_CONFIG, JSON.parse(raw));
      } else {
        this.cache = { ...DEFAULT_AI_CONFIG };
      }
    } catch (err) {
      logger.warn('ai_config.read_error', { error: String(err) });
      this.cache = { ...DEFAULT_AI_CONFIG };
    }
    // Run the one-time legacy reconciliation, then persist the result.
    if (!this.cache!._migratedV2) {
      this.cache = migrateFromLegacy(this.cache!);
      this.persist(this.cache!);
      logger.info('ai_config.migrated_v2');
    }
    return this.cache!;
  }

  private persist(cfg: AiConfig): void {
    try {
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch (err) {
      logger.error('ai_config.write_error', { error: String(err) });
    }
  }

  update(partial: Partial<AiConfig>): AiConfig {
    const next = mergeAiConfig(this.get(), partial);
    this.cache = next;
    this.persist(next);
    logger.info('ai_config.updated');
    return next;
  }
}

export const aiConfigService = new AiConfigService();
