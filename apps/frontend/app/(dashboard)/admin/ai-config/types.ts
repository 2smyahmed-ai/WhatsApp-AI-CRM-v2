// Client-side mirror of the backend AiConfig (apps/backend/src/services/ai-config.service.ts).

export type ResponseLength = 'short' | 'medium' | 'long';
export type ResponseSpeed = 'fast' | 'balanced' | 'thorough';
export type Tone = 'professional' | 'friendly' | 'luxury' | 'formal' | 'casual';
export type EmojiUsage = 'none' | 'low' | 'medium' | 'high';
export type ConfigLanguage = 'ar' | 'en' | 'auto';
export type ArabicDialect = 'saudi' | 'gulf' | 'egyptian' | 'levantine' | 'msa';
export type SalesMode = 'off' | 'soft' | 'hard' | 'consultation';
export type Provider = 'groq' | 'openai' | 'anthropic';
export type TargetingMode = 'all' | 'rules';
export type TargetingAudience = 'all' | 'new_only' | 'returning_only';

export interface AiProductOption {
  nameEn: string;
  nameAr: string;
  price: string;
}

export interface AiProduct {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: string;
  available: boolean;
  options: AiProductOption[];
}

export interface AiProductsConfig {
  enabled: boolean;
  currency: string;
  items: AiProduct[];
}

export interface AiConfig {
  enabled: boolean;
  general: {
    model: string;
    temperature: number;
    maxTokens: number;
    responseLength: ResponseLength;
    creativityLevel: number;
    responseSpeed: ResponseSpeed;
  };
  personality: {
    assistantName: string;
    tone: Tone;
    formality: number;
    emojiUsage: EmojiUsage;
    humorLevel: number;
    language: ConfigLanguage;
    dialect: ArabicDialect;
    persona: string;
    writingStyle: string;
  };
  businessRules: string[];
  company: {
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
  };
  products: AiProductsConfig;
  sales: {
    mode: SalesMode;
    leadQualificationQuestions: string[];
    bookingFlow: string;
    cta: string;
    upsell: string;
    crossSell: string;
    closing: string;
  };
  conversation: {
    welcomeMessage: string;
    welcomeMessageExact: boolean;
    maxResponseChars: number;
    maxSentences: number;
    useBulletPoints: boolean;
    alwaysGreet: boolean;
    alwaysEndWithCta: boolean;
    useCustomerName: boolean;
    askFollowUp: boolean;
    typingStyle: string;
  };
  safety: {
    businessOnlyMode: boolean;
    refusePolitical: boolean;
    refuseReligious: boolean;
    refuseMedical: boolean;
    refuseLegal: boolean;
    humanEscalation: boolean;
    safeMode: boolean;
    forbiddenTopics: string[];
  };
  handoff: {
    enabled: boolean;
    triggers: {
      complaint: boolean;
      refund: boolean;
      manager: boolean;
      humanAgent: boolean;
      technicalSupport: boolean;
    };
    customTriggers: string[];
    transferMessage: string;
  };
  memory: {
    contextLength: number;
    rememberName: boolean;
    rememberOrders: boolean;
    rememberPreferences: boolean;
    persistent: boolean;
  };
  gating: {
    businessHoursEnabled: boolean;
    businessHoursStart: string;
    businessHoursEnd: string;
    offHoursMessage: string;
    maxResponsesPerHour: number;
    ignoreFirstMessage: boolean;
    typingDelayMs: number;
    fallbackMessage: string;
    pauseOnHumanReply: boolean;
    pauseDurationHours: number;
  };
  targeting: {
    mode: TargetingMode;
    includeTags: string[];
    excludeTags: string[];
    lifecycleStages: string[];
    audience: TargetingAudience;
    respectPerChatOverride: boolean;
  };
  customVariables: Array<{ key: string; value: string }>;
  rawPromptOverride: string;
}

export interface AiConfigTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: Partial<AiConfig>;
}

export const MODEL_OPTIONS: Record<Provider, Array<{ value: string; label: string; badge?: string }>> = {
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', badge: 'Versatile' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', badge: 'Fast' },
    { value: 'mistral-saba-24b', label: 'Mistral Saba 24B', badge: 'Arabic' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', badge: '32k' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o', badge: 'Latest' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', badge: 'Fast' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', badge: '' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', badge: 'Legacy' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', badge: 'Balanced' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', badge: 'Fast' },
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7', badge: 'Powerful' },
  ],
};

export const BUILTIN_VARIABLES = [
  '{{customer_name}}',
  '{{company_name}}',
  '{{agent_name}}',
  '{{service_name}}',
  '{{language}}',
  '{{today}}',
  '{{current_time}}',
];
