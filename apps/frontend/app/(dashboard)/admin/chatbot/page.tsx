'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useDirection } from '@/hooks/useDirection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye, EyeOff, Save, RotateCcw, CheckCircle2,
  ShieldCheck, Info, AlertCircle, MessageSquare, Brain,
  Thermometer, FileText, ChevronRight,
  Zap, Target,
  LayoutDashboard, Cpu, KeyRound, CheckCircle, XCircle, Timer, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

type Section = 'overview' | 'crmAssistant' | 'leadQualification';
type Provider = 'groq' | 'openai' | 'anthropic';

interface AiStatus {
  provider: Provider;
  hasApiKey: boolean;
  customerBot: { enabled: boolean; replyToAll: boolean; targetingMode: 'all' | 'rules'; model: string };
  crmAssistant: { enabled: boolean; model: string };
  leadQualification: { enabled: boolean; model: string; debounceSeconds: number };
  models: Array<{
    model: string;
    available: boolean;
    secondsLeft: number;
    primary: boolean;
    quota: {
      remainingRequests: number | null;
      limitRequests: number | null;
      remainingTokens: number | null;
      limitTokens: number | null;
      resetRequests: string | null;
      resetTokens: string | null;
      updatedAt: number;
    } | null;
  }>;
}

interface ChatbotSettings {
  enabled: boolean;
  replyToAllConversations: boolean;
  provider: Provider;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  pauseOnHumanReply: boolean;
  pauseDurationHours: number;
  contextWindow: number;
  fallbackMessage: string;
  typingDelayMs: number;
  ignoreFirstMessage: boolean;
  maxResponsesPerHour: number;
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  offHoursMessage: string;
  escalationKeywords: string;
  escalationMessage: string;
  // crm assistant
  crmAssistantEnabled: boolean;
  crmAssistantUseSameProvider: boolean;
  crmAssistantApiKey: string;
  crmAssistantModel: string;
  crmAssistantSystemPrompt: string;
  // lead qualification
  qualificationEnabled: boolean;
  qualificationModel: string;
  qualificationSystemPrompt: string;
  qualificationTemperature: number;
  qualificationDebounceMs: number;
  qualificationContextWindow: number;
}

const MODEL_OPTIONS: Record<Provider, Array<{ value: string; label: string; badge?: string }>> = {
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', badge: 'Versatile' },
    { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  badge: 'Fast' },
    { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',  badge: '32k' },
    { value: 'mistral-saba-24b',         label: 'Mistral Saba',  badge: 'Arabic' },
  ],
  openai: [
    { value: 'gpt-4o',       label: 'GPT-4o',       badge: 'Latest' },
    { value: 'gpt-4o-mini',  label: 'GPT-4o Mini',  badge: 'Fast' },
    { value: 'gpt-4-turbo',  label: 'GPT-4 Turbo',  badge: '' },
    { value: 'gpt-3.5-turbo',label: 'GPT-3.5 Turbo',badge: 'Legacy' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', badge: 'Balanced' },
    { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',  badge: 'Fast' },
    { value: 'claude-opus-4-7',            label: 'Claude Opus 4.7',   badge: 'Powerful' },
  ],
};

const PROVIDER_KEY_URLS: Record<Provider, string> = {
  groq:      'console.groq.com',
  openai:    'platform.openai.com/api-keys',
  anthropic: 'console.anthropic.com',
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50',
        checked ? 'bg-[#25D366]' : 'bg-gray-300 dark:bg-white/20',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1',
      )} />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-black dark:text-white">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-600 dark:text-[#8696A0]">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Compact number: 14400 → "14.4k", 1200000 → "1.2M".
function fmtQuota(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return String(n);
}

/** One live quota meter (requests or tokens) for a model, from Groq's headers. */
function QuotaStat({ label, remaining, limit, reset, resetLabel }: {
  label: string;
  remaining: number | null;
  limit: number | null;
  reset: string | null;
  resetLabel: string;
}) {
  const pct = remaining != null && limit ? Math.max(0, Math.min(1, remaining / limit)) : null;
  const low = pct != null && pct <= 0.15;
  const mid = pct != null && pct > 0.15 && pct <= 0.4;
  const barColor = low ? 'bg-red-500' : mid ? 'bg-amber-400' : 'bg-[#25D366]';
  const numColor = low ? 'text-red-600 dark:text-red-400' : mid ? 'text-amber-600 dark:text-amber-400' : 'text-black dark:text-white';
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-[#202C33] px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-[#8696A0]">{label}</span>
        {reset && <span dir="ltr" className="text-[9px] text-gray-400 dark:text-[#8696A0]/70" title={`${resetLabel} ${reset}`}>{reset}</span>}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span dir="ltr" className={cn('text-sm font-bold tabular-nums', numColor)}>{fmtQuota(remaining)}</span>
        <span dir="ltr" className="text-[10px] text-gray-400 dark:text-[#8696A0]/70">/ {fmtQuota(limit)}</span>
      </div>
      {pct != null && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
          <div className={cn('h-1 rounded-full transition-all', barColor)} style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export default function ChatbotAdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { t } = useTranslation('admin');
  const { isRTL } = useDirection();

  const role    = (session?.user as any)?.role ?? 'AGENT';
  const isAdmin = ADMIN_ROLES.includes(role);

  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [settings, setSettings]           = useState<ChatbotSettings | null>(null);
  const [status, setStatus]               = useState<AiStatus | null>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState('');
  const [showApiKey, setShowApiKey]       = useState(false);
  const [showCrmApiKey, setShowCrmApiKey] = useState(false);

  const fetchStatus = useCallback(async () => {
    try { setStatus(await api.get('/api/chatbot/status')); } catch { /* non-fatal */ }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.get('/api/chatbot/settings');
      setSettings(data);
      void fetchStatus();
    } catch {
      setError(t('chatbot.accessDenied'));
    } finally {
      setLoading(false);
    }
  }, [t, fetchStatus]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!isAdmin) { router.replace('/dashboard'); return; }
    fetchSettings();
  }, [sessionStatus, isAdmin, fetchSettings, router]);

  // Keep the live model quota fresh while the page is open so it can be tracked.
  useEffect(() => {
    if (!isAdmin) return;
    const id = setInterval(() => { void fetchStatus(); }, 20000);
    return () => clearInterval(id);
  }, [isAdmin, fetchStatus]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const data = await api.put('/api/chatbot/settings', settings);
      setSettings(data);
      void fetchStatus();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chatbot.accessDenied'));
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<ChatbotSettings>) =>
    setSettings((s) => (s ? { ...s, ...patch } : s));

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="space-y-4 animate-fade-in" role="status" aria-label="Loading chatbot settings">
        <div className="space-y-2">
          <div className="skeleton h-7 w-52" />
          <div className="skeleton h-3.5 w-72 max-w-full" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-9 w-28 shrink-0 rounded-full" />)}
        </div>
        <div className="skeleton h-44 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const navItems: { id: Section; icon: React.ElementType; label: string; dotClass: string }[] = [
    {
      id: 'overview',
      icon: LayoutDashboard,
      label: t('chatbot.tabs.overview'),
      dotClass: 'bg-[#25D366]',
    },
    {
      id: 'crmAssistant',
      icon: Brain,
      label: t('chatbot.tabs.crmAssistant'),
      dotClass: settings?.crmAssistantEnabled ? 'bg-purple-400' : 'bg-gray-400 dark:bg-[#8696A0]',
    },
    {
      id: 'leadQualification',
      icon: Target,
      label: t('chatbot.tabs.leadQualification'),
      dotClass: settings?.qualificationEnabled ? 'bg-[#25D366]' : 'bg-gray-400 dark:bg-[#8696A0]',
    },
  ];

  // ── Shared AI connection (provider + API key) ─────────────────────────────
  // The customer bot's behavior, audience, and gating live on the dedicated
  // /admin/customer-ai page (the single source of truth). This card only holds
  // the shared credentials used by the bot, the CRM assistant, and lead qualification.
  function CustomerBotConnection() {
    if (!settings) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-[#25D366]/20 bg-[#25D366]/5 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]" />
          <p className="text-xs leading-5 text-gray-600 dark:text-[#8696A0]">
            {t('chatbot.connection.note')}
          </p>
        </div>

        {/* Provider */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{t('chatbot.provider.title')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['groq', 'openai', 'anthropic'] as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ provider: p, model: MODEL_OPTIONS[p][0].value })}
                className={cn(
                  'flex flex-col items-start gap-1.5 rounded-xl border p-4 text-start transition-all',
                  settings.provider === p
                    ? 'border-[#25D366] bg-[#25D366]/8 ring-1 ring-[#25D366]/30'
                    : 'border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-[#202C33] hover:border-gray-400 dark:hover:border-white/20',
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-semibold text-black dark:text-white">{t(`chatbot.provider.${p}`)}</span>
                  {settings.provider === p && <CheckCircle2 className="h-4 w-4 text-[#25D366]" />}
                </div>
                <span className="text-[11px] text-gray-600 dark:text-[#8696A0]">{t(`chatbot.provider.${p}Desc`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4 space-y-2">
          <label className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{t('chatbot.apiKey')}</label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={`${settings.provider} API key`}
              className={isRTL ? 'pl-10' : 'pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className={cn('absolute top-1/2 -translate-y-1/2 text-gray-600 dark:text-[#8696A0] hover:text-black dark:hover:text-white', isRTL ? 'left-3' : 'right-3')}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-[#8696A0]">
            <Info className="h-3 w-3 shrink-0" />
            {t('chatbot.apiKeyLink', { url: PROVIDER_KEY_URLS[settings.provider] })}
          </p>
          <div className="flex items-center justify-end gap-3 pt-1">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-[#25D366]">
                <CheckCircle2 className="h-4 w-4" /> {t('chatbot.saved')}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#25D366] text-black hover:bg-[#128C7E] hover:text-white">
              {saving ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t('chatbot.saving') : t('chatbot.connection.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── CRM Assistant Section ──────────────────────────────────────────────────
  function CrmAssistantSection() {
    if (!settings) return null;
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{t('chatbot.status.enabled')}</p>
          <div className="space-y-2">
            <SettingRow label={t('chatbot.crmAssistant.enable')} description={t('chatbot.crmAssistant.enableDesc')}>
              <Toggle checked={settings.crmAssistantEnabled} onChange={() => update({ crmAssistantEnabled: !settings.crmAssistantEnabled })} />
            </SettingRow>
            <SettingRow label={t('chatbot.crmAssistant.sameProvider')} description={t('chatbot.crmAssistant.sameProviderDesc')}>
              <Toggle checked={settings.crmAssistantUseSameProvider} onChange={() => update({ crmAssistantUseSameProvider: !settings.crmAssistantUseSameProvider })} />
            </SettingRow>
          </div>
        </div>

        {!settings.crmAssistantUseSameProvider && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{t('chatbot.separateConfig')}</p>
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4 space-y-4">
              <p className="text-xs text-gray-600 dark:text-[#8696A0]">{t('chatbot.separateConfigDesc')}</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{t('chatbot.model')}</label>
                <select
                  value={settings.crmAssistantModel}
                  onChange={(e) => update({ crmAssistantModel: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
                >
                  {MODEL_OPTIONS[settings.provider].map((m) => (
                    <option key={m.value} value={m.value}>{m.label}{m.badge ? ` — ${m.badge}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{t('chatbot.apiKey')}</label>
                <div className="relative">
                  <Input
                    type={showCrmApiKey ? 'text' : 'password'}
                    value={settings.crmAssistantApiKey}
                    onChange={(e) => update({ crmAssistantApiKey: e.target.value })}
                    placeholder={t('chatbot.crmApiKeyPlaceholder')}
                    className={isRTL ? 'pl-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCrmApiKey((v) => !v)}
                    className={cn('absolute top-1/2 -translate-y-1/2 text-gray-600 dark:text-[#8696A0] hover:text-black dark:hover:text-white', isRTL ? 'left-3' : 'right-3')}
                  >
                    {showCrmApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{t('chatbot.systemPrompt')}</p>
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-[#8696A0]">
              <FileText className="h-3.5 w-3.5" />
              {t('chatbot.crmSystemPromptDesc')}
            </div>
            <textarea
              value={settings.crmAssistantSystemPrompt}
              onChange={(e) => update({ crmAssistantSystemPrompt: e.target.value })}
              rows={12}
              dir="auto"
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2.5 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] resize-y focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
              placeholder={t('chatbot.crmSystemPromptPlaceholder')}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Lead Qualification Section ─────────────────────────────────────────────
  function LeadQualificationSection() {
    if (!settings) return null;
    const debounceSeconds = Math.round((settings.qualificationDebounceMs || 45000) / 1000);
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{t('chatbot.status.enabled')}</p>
          <SettingRow label={t('chatbot.leadQualification.enable')} description={t('chatbot.leadQualification.enableDesc')}>
            <Toggle checked={settings.qualificationEnabled} onChange={() => update({ qualificationEnabled: !settings.qualificationEnabled })} />
          </SettingRow>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#111B21] p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600 dark:text-[#8696A0]" />
          <p className="text-xs text-gray-600 dark:text-[#8696A0]">{t('chatbot.leadQualification.providerNote')}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{t('chatbot.tuning')}</p>
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{t('chatbot.leadQualification.model')}</label>
              <select
                value={settings.qualificationModel}
                onChange={(e) => update({ qualificationModel: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
              >
                {MODEL_OPTIONS[settings.provider].map((m) => (
                  <option key={m.value} value={m.value}>{m.label}{m.badge ? ` — ${m.badge}` : ''}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-600 dark:text-[#8696A0]">{t('chatbot.leadQualification.modelDesc')}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />
                  <label className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{t('chatbot.leadQualification.temperature')}</label>
                </div>
                <span className="rounded-lg bg-gray-100 dark:bg-[#111B21] px-2 py-0.5 text-xs font-mono text-[#25D366]">
                  {settings.qualificationTemperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range" min="0" max="1" step="0.1"
                value={settings.qualificationTemperature}
                onChange={(e) => update({ qualificationTemperature: parseFloat(e.target.value) })}
                className="w-full accent-[#25D366]"
              />
              <p className="text-[10px] text-gray-600 dark:text-[#8696A0]">{t('chatbot.leadQualification.temperatureDesc')}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />
                <label className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{t('chatbot.leadQualification.debounce')}</label>
              </div>
              <Input
                type="number" min={3} max={600}
                value={debounceSeconds}
                onChange={(e) => update({ qualificationDebounceMs: (parseInt(e.target.value) || 45) * 1000 })}
                className="max-w-[120px]"
              />
              <p className="text-[10px] text-gray-600 dark:text-[#8696A0]">{t('chatbot.leadQualification.debounceDesc')}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />
                  <label className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{t('chatbot.leadQualification.contextWindow')}</label>
                </div>
                <span className="rounded-lg bg-gray-100 dark:bg-[#111B21] px-2 py-0.5 text-xs font-mono text-[#25D366]">
                  {settings.qualificationContextWindow}
                </span>
              </div>
              <input
                type="range" min={4} max={30} step={1}
                value={settings.qualificationContextWindow}
                onChange={(e) => update({ qualificationContextWindow: parseInt(e.target.value) })}
                className="w-full accent-[#25D366]"
              />
              <p className="text-[10px] text-gray-600 dark:text-[#8696A0]">{t('chatbot.leadQualification.contextWindowDesc')}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{t('chatbot.leadQualification.systemPrompt')}</p>
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-[#8696A0]">
              <FileText className="h-3.5 w-3.5" />
              {t('chatbot.leadQualification.systemPromptDesc')}
            </div>
            <textarea
              value={settings.qualificationSystemPrompt}
              onChange={(e) => update({ qualificationSystemPrompt: e.target.value })}
              rows={12}
              dir="auto"
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2.5 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] resize-y focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
              placeholder={t('chatbot.leadQualification.systemPromptPlaceholder')}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Overview Section (at-a-glance status) ──────────────────────────────────
  function OverviewSection() {
    if (!settings) return null;
    const botEnabled = status?.customerBot.enabled ?? false;
    const features = [
      {
        key: 'leadQualification' as const, icon: Target, label: t('chatbot.tabs.leadQualification'),
        on: settings.qualificationEnabled, dot: settings.qualificationEnabled ? 'bg-[#25D366]' : 'bg-[#8696A0]', tone: 'text-[#25D366]',
        lines: [
          `${t('chatbot.overview.model')}: ${settings.qualificationModel}`,
          `${t('chatbot.leadQualification.debounce')}: ${Math.round((settings.qualificationDebounceMs || 45000) / 1000)}s`,
        ],
      },
      {
        key: 'crmAssistant' as const, icon: Brain, label: t('chatbot.tabs.crmAssistant'),
        on: settings.crmAssistantEnabled, dot: settings.crmAssistantEnabled ? 'bg-purple-400' : 'bg-[#8696A0]', tone: 'text-purple-400',
        lines: [`${t('chatbot.overview.model')}: ${settings.crmAssistantUseSameProvider ? settings.model : settings.crmAssistantModel}`],
      },
    ];
    return (
      <div className="space-y-6">
        {/* Customer Bot lives on its own dedicated page — link out, don't duplicate. */}
        <Link
          href="/admin/customer-ai"
          className="group flex items-center gap-4 rounded-2xl border border-[#25D366]/25 bg-[#25D366]/[0.06] p-4 transition-all hover:border-[#25D366]/50 hover:bg-[#25D366]/[0.1]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
            <MessageSquare className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-black dark:text-white">{t('chatbot.tabs.customerBot')}</p>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                botEnabled ? 'bg-[#25D366]/15 text-[#25D366]' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-[#8696A0]')}>
                <span className={cn('h-1.5 w-1.5 rounded-full', botEnabled ? 'bg-[#25D366]' : 'bg-[#8696A0]')} />
                {botEnabled ? t('chatbot.status.enabled') : t('chatbot.status.disabled')}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-[#8696A0]">{t('chatbot.customerBot.description')}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#25D366]">
            {t('chatbot.overview.manage')} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </span>
        </Link>

        {/* Shared AI connection (provider + key) used by the bot and the tools below. */}
        <CustomerBotConnection />

        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <button key={f.key} type="button" onClick={() => setActiveSection(f.key)}
                className="group rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4 text-start transition-all hover:border-white/20">
                <div className="flex items-center justify-between">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-white/5', f.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    f.on ? 'bg-[#25D366]/15 text-[#25D366]' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-[#8696A0]')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', f.dot)} />
                    {f.on ? t('chatbot.status.enabled') : t('chatbot.status.disabled')}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-black dark:text-white">{f.label}</p>
                <div className="mt-1 space-y-0.5">
                  {f.lines.map((l, i) => <p key={i} className="truncate text-[11px] text-gray-600 dark:text-[#8696A0]">{l}</p>)}
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#25D366] opacity-0 transition-opacity group-hover:opacity-100">
                  {t('chatbot.overview.manage')} <ChevronRight className="h-3 w-3" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />
              <span className="text-xs text-gray-600 dark:text-[#8696A0]">{t('chatbot.provider.title')}:</span>
              <span className="rounded-md bg-[#25D366]/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#25D366]">{settings.provider}</span>
            </div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />
              <span className="text-xs text-gray-600 dark:text-[#8696A0]">{t('chatbot.apiKey')}:</span>
              {status?.hasApiKey
                ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#25D366]"><CheckCircle className="h-3.5 w-3.5" /> {t('chatbot.overview.keySet')}</span>
                : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400"><XCircle className="h-3.5 w-3.5" /> {t('chatbot.overview.keyMissing')}</span>}
            </div>
          </div>
        </div>

        {status && status.provider === 'groq' && status.models.length > 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">{t('chatbot.overview.failover')}</p>
            </div>
            <div className="space-y-2">
              {status.models.map((m) => {
                const q = m.quota;
                return (
                  <div key={m.model} className="rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#111B21] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span dir="ltr" className="truncate font-mono text-xs text-black dark:text-white">{m.model}</span>
                        {m.primary && <span className="shrink-0 rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-600 dark:text-[#8696A0]">{t('chatbot.overview.primary')}</span>}
                      </div>
                      {!m.available
                        ? <span dir="ltr" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-amber-500 dark:text-amber-400"><Timer className="h-3.5 w-3.5" /> {Math.floor(m.secondsLeft / 60)}:{String(m.secondsLeft % 60).padStart(2, '0')}</span>
                        : <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#25D366]"><CheckCircle className="h-3.5 w-3.5" /> {t('chatbot.overview.ready')}</span>}
                    </div>
                    {q ? (
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <QuotaStat label={t('chatbot.overview.requests')} resetLabel={t('chatbot.overview.resetsIn')} remaining={q.remainingRequests} limit={q.limitRequests} reset={q.resetRequests} />
                        <QuotaStat label={t('chatbot.overview.tokens')} resetLabel={t('chatbot.overview.resetsIn')} remaining={q.remainingTokens} limit={q.limitTokens} reset={q.resetTokens} />
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[10px] text-gray-500 dark:text-[#8696A0]/70">{t('chatbot.overview.noQuotaData')}</p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-gray-600 dark:text-[#8696A0]">{t('chatbot.overview.failoverHint')}</p>
          </div>
        )}
      </div>
    );
  }

  const sectionTitles: Record<Section, string> = {
    overview:      t('chatbot.overview.title'),
    crmAssistant:  t('chatbot.crmAssistant.title'),
    leadQualification: t('chatbot.leadQualification.title'),
  };
  const sectionDesc: Record<Section, string> = {
    overview:      t('chatbot.overview.description'),
    crmAssistant:  t('chatbot.crmAssistant.description'),
    leadQualification: t('chatbot.leadQualification.description'),
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('badge')} — {t('chatbot.badge')}
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-black dark:text-white">{t('chatbot.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-[#8696A0]">{t('chatbot.subtitle')}</p>
          </div>

          {settings && (
            <div className="flex flex-wrap gap-2 self-end">
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                status?.customerBot.enabled ? 'bg-[#25D366]/15 text-[#25D366]' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-[#8696A0]',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', status?.customerBot.enabled ? 'bg-[#25D366]' : 'bg-[#8696A0]')} />
                {t('chatbot.tabs.customerBot')}: {status?.customerBot.enabled ? t('chatbot.status.enabled') : t('chatbot.status.disabled')}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                settings.crmAssistantEnabled ? 'bg-purple-500/15 text-purple-400' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-[#8696A0]',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', settings.crmAssistantEnabled ? 'bg-purple-400' : 'bg-[#8696A0]')} />
                {t('chatbot.tabs.crmAssistant')}: {settings.crmAssistantEnabled ? t('chatbot.status.enabled') : t('chatbot.status.disabled')}
              </span>
            </div>
          )}
        </div>
      </section>

      {!settings && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{t('chatbot.accessDenied')}</p>
        </div>
      )}

      {settings && (
        <>
          {/* ── Top tabs ── */}
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] p-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-[#25D366]/10 text-[#25D366]'
                      : 'text-gray-600 dark:text-[#8696A0] hover:bg-gray-200 dark:hover:bg-white/5 hover:text-black dark:hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <span className={cn('h-2 w-2 rounded-full shrink-0', item.dotClass)} />
                </button>
              );
            })}
          </div>

          {/* ── Content panel ── */}
          <div className="min-w-0 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 dark:border-white/10 pb-5">
              <div>
                <h2 className="text-lg font-semibold text-black dark:text-white">{sectionTitles[activeSection]}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-[#8696A0]">{sectionDesc[activeSection]}</p>
              </div>
            </div>

            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'crmAssistant' && <CrmAssistantSection />}
            {activeSection === 'leadQualification' && <LeadQualificationSection />}
          </div>

          {/* ── Save bar — only for the settings-backed sections (CRM, Lead). The
               Customer Bot connection card and the embedded builder each save
               themselves, and Overview is read-only. ── */}
          {(activeSection === 'crmAssistant' || activeSection === 'leadQualification') && (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] px-4 py-3 shadow-sm">
              {error && (
                <p className="flex flex-1 items-center gap-1.5 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <div className="flex flex-1 items-center justify-end gap-3">
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-[#25D366]">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('chatbot.saved')}
                  </span>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2 bg-[#25D366] text-black hover:bg-[#128C7E] hover:text-white"
                >
                  {saving ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? t('chatbot.saving') : t('chatbot.save')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Mobile bottom-nav spacer */}
      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />
    </div>
  );
}
