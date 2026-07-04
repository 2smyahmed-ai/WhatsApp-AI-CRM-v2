'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Save, RotateCcw, CheckCircle2, AlertCircle, Bot, Info, Send, Sparkles, X,
  Eye, EyeOff, KeyRound, Plus, Trash2, ListChecks, Ban, ShieldAlert,
  Thermometer, Hash, Timer, LayoutGrid, HelpCircle, Heart, TrendingUp, MessageSquare,
  ChevronRight, Gauge,
} from 'lucide-react';
import {
  Toggle, SettingRow, Field, TextInput, TextArea, Slider, SegmentedControl,
  TagListEditor, ChipMultiSelect, KeyValueEditor, SectionCard, MoreOptions, Card, SectionLabel,
} from '@/components/ai-config/primitives';
import { ProductsEditor } from '@/components/ai-config/ProductsEditor';
import { TemplatesModal } from '@/components/ai-config/TemplatesModal';
import {
  AiConfig, AiConfigTemplate, BUILTIN_VARIABLES,
  Tone, EmojiUsage, ConfigLanguage, ArabicDialect, ResponseLength, SalesMode,
  TargetingMode, TargetingAudience,
} from '../ai-config/types';

type SectionId =
  | 'connection' | 'identity' | 'welcome' | 'knowledge' | 'flow'
  | 'rules' | 'audience' | 'schedule' | 'handoff' | 'advanced';

// ── Live status from /api/chatbot/status ──────────────────────────────────────
type RouteCandidate = { provider: 'gemini' | 'groq'; model: string };
type RoutingMap = { bot: RouteCandidate[]; qualification: RouteCandidate[]; assistant: RouteCandidate[] };
interface GroqModelStatus {
  model: string; available: boolean; secondsLeft: number; primary: boolean;
  quota: {
    remainingRequests: number | null; limitRequests: number | null;
    remainingTokens: number | null; limitTokens: number | null;
    resetRequests: string | null; resetTokens: string | null;
  } | null;
}
interface GeminiModelStatus { model: string; available: boolean; secondsLeft: number; requestsToday: number }
interface ChatStatus { models: GroqModelStatus[]; geminiModels: GeminiModelStatus[]; routing: RoutingMap }

// Friendly, consistent label for any routed model.
const MODEL_LABELS: Record<string, string> = {
  'gemini-2.5-flash': 'Gemini · 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini · 2.5 Flash-Lite',
  'gemini-2.0-flash': 'Gemini · 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini · 2.0 Flash-Lite',
  'llama-3.3-70b-versatile': 'Groq · Llama 70B',
  'llama-3.1-8b-instant': 'Groq · Llama 8B',
  'gemma2-9b-it': 'Groq · Gemma 9B',
  'llama3-8b-8192': 'Groq · Llama3 8B',
};
function modelLabel(model: string): string { return MODEL_LABELS[model] ?? model; }
function fmtNum(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return String(n);
}

export default function CustomerAiPage() {
  const { t } = useTranslation('aiconfig');
  const { isRTL } = useDirection();

  const [cfg, setCfg]                 = useState<AiConfig | null>(null);
  const [status, setStatus]           = useState<ChatStatus | null>(null);
  const [apiKey, setApiKey]           = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [targetingOptions, setTargetingOptions] = useState<{ tags: string[]; lifecycleStages: string[] }>({ tags: [], lifecycleStages: [] });
  const [hasApiKey, setHasApiKey]     = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [isDirty, setIsDirty]         = useState(false);
  const [error, setError]             = useState('');
  const [showApiKey, setShowApiKey]   = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // ── Load everything the page needs in one shot ───────────────────────────
  const load = useCallback(async () => {
    try {
      const [config, settings, options, st] = await Promise.all([
        api.get('/api/chatbot/ai-config'),
        api.get('/api/chatbot/settings').catch(() => null),
        api.get('/api/chatbot/targeting-options').catch(() => null),
        api.get('/api/chatbot/status').catch(() => null),
      ]);
      setCfg(config);
      setIsDirty(false);
      if (st) setStatus(st);
      if (settings) {
        setApiKey(settings.apiKey ?? '');
        setHasApiKey(Boolean(settings.apiKey));
        setGeminiApiKey(settings.geminiApiKey ?? '');
        setHasGeminiKey(Boolean(settings.geminiApiKey));
      }
      if (options) setTargetingOptions({ tags: options.tags ?? [], lifecycleStages: options.lifecycleStages ?? [] });
    } catch {
      setError(t('bot.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // Keep the live quota meter fresh while the page is open.
  useEffect(() => {
    const id = setInterval(() => {
      api.get('/api/chatbot/status').then(setStatus).catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, []);

  // ── Ctrl/Cmd+S ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isDirty && !saving) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, saving, cfg, apiKey, geminiApiKey]);

  // ── Save: config + shared connection together ─────────────────────────────
  const handleSave = async () => {
    if (!cfg) return;
    setSaving(true); setError('');
    try {
      const [data] = await Promise.all([
        api.put('/api/chatbot/ai-config', cfg),
        api.put('/api/chatbot/settings', { apiKey, geminiApiKey }),
      ]);
      api.get('/api/chatbot/status').then(setStatus).catch(() => {});
      setCfg(data);
      setHasApiKey(Boolean(apiKey));
      setHasGeminiKey(Boolean(geminiApiKey));
      setIsDirty(false); setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bot.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (tpl: AiConfigTemplate) => {
    setCfg((c) => {
      if (!c) return c;
      const tc = tpl.config;
      return {
        ...c, ...tc,
        general:     { ...c.general,     ...(tc.general     ?? {}) },
        personality: { ...c.personality, ...(tc.personality ?? {}) },
        company:     { ...c.company,     ...(tc.company     ?? {}) },
        products:    { ...c.products,    ...(tc.products    ?? {}), items: tc.products?.items ?? c.products.items },
        sales:       { ...c.sales,       ...(tc.sales       ?? {}) },
        conversation:{ ...c.conversation,...(tc.conversation ?? {}) },
        safety:      { ...c.safety,      ...(tc.safety      ?? {}) },
        handoff:     { ...c.handoff,     ...(tc.handoff     ?? {}), triggers: { ...c.handoff.triggers, ...(tc.handoff?.triggers ?? {}) } },
        memory:      { ...c.memory,      ...(tc.memory      ?? {}) },
        gating:      { ...c.gating,      ...(tc.gating      ?? {}) },
        targeting:   { ...c.targeting,   ...(tc.targeting   ?? {}) },
        businessRules:   tc.businessRules   ?? c.businessRules,
        customVariables: tc.customVariables ?? c.customVariables,
      };
    });
    setIsDirty(true);
    setShowTemplates(false);
  };

  // ── Patch helpers ──────────────────────────────────────────────────────────
  const d               = ()                                      => setIsDirty(true);
  const update          = (p: Partial<AiConfig>)                  => { setCfg((c) => c ? { ...c, ...p } : c); d(); };
  const setGeneral      = (p: Partial<AiConfig['general']>)       => { setCfg((c) => c ? { ...c, general:      { ...c.general,      ...p } } : c); d(); };
  const setPersonality  = (p: Partial<AiConfig['personality']>)   => { setCfg((c) => c ? { ...c, personality:  { ...c.personality,  ...p } } : c); d(); };
  const setCompany      = (p: Partial<AiConfig['company']>)       => { setCfg((c) => c ? { ...c, company:      { ...c.company,      ...p } } : c); d(); };
  const setProducts     = (p: Partial<AiConfig['products']>)      => { setCfg((c) => c ? { ...c, products:     { ...c.products,     ...p } } : c); d(); };
  const setSales        = (p: Partial<AiConfig['sales']>)         => { setCfg((c) => c ? { ...c, sales:        { ...c.sales,        ...p } } : c); d(); };
  const setConversation = (p: Partial<AiConfig['conversation']>)  => { setCfg((c) => c ? { ...c, conversation: { ...c.conversation, ...p } } : c); d(); };
  const setSafety       = (p: Partial<AiConfig['safety']>)        => { setCfg((c) => c ? { ...c, safety:       { ...c.safety,       ...p } } : c); d(); };
  const setHandoff      = (p: Partial<AiConfig['handoff']>)       => { setCfg((c) => c ? { ...c, handoff:      { ...c.handoff,      ...p } } : c); d(); };
  const setHandoffTrig  = (k: keyof AiConfig['handoff']['triggers']) => { setCfg((c) => c ? { ...c, handoff: { ...c.handoff, triggers: { ...c.handoff.triggers, [k]: !c.handoff.triggers[k] } } } : c); d(); };
  const setMemory       = (p: Partial<AiConfig['memory']>)        => { setCfg((c) => c ? { ...c, memory:       { ...c.memory,       ...p } } : c); d(); };
  const setGating       = (p: Partial<AiConfig['gating']>)        => { setCfg((c) => c ? { ...c, gating:       { ...c.gating,       ...p } } : c); d(); };
  const setTargeting    = (p: Partial<AiConfig['targeting']>)     => { setCfg((c) => c ? { ...c, targeting:    { ...c.targeting,    ...p } } : c); d(); };

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-4 animate-fade-in" role="status" aria-label="Loading AI settings">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-3.5 w-64 max-w-full" />
        </div>
        <div className="skeleton h-10 w-28 rounded-xl" />
      </div>
      <div className="skeleton h-40 rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="skeleton h-56 rounded-2xl" />
        <div className="skeleton h-56 rounded-2xl" />
      </div>
    </div>
  );
  if (!cfg) return (
    <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
      <p className="text-sm text-red-400">{error || t('bot.loadError')}</p>
    </div>
  );

  const c = cfg;
  const sec = t('bot.sections', { returnObjects: true }) as Record<SectionId, { title: string; subtitle: string; emoji: string }>;

  const SALES_MODES: Array<{ value: SalesMode; icon: React.ElementType; label: string; desc: string; accent: string; activeBg: string }> = [
    { value: 'off',          icon: HelpCircle,    label: t('bot.salesModes.offLabel'),          desc: t('bot.salesModes.offDesc'),          accent: 'text-blue-400',   activeBg: 'bg-blue-400/10 border-blue-400/40' },
    { value: 'soft',         icon: Heart,         label: t('bot.salesModes.softLabel'),         desc: t('bot.salesModes.softDesc'),         accent: 'text-purple-400', activeBg: 'bg-purple-400/10 border-purple-400/40' },
    { value: 'hard',         icon: TrendingUp,    label: t('bot.salesModes.hardLabel'),         desc: t('bot.salesModes.hardDesc'),         accent: 'text-[#25D366]',  activeBg: 'bg-[#25D366]/10 border-[#25D366]/40' },
    { value: 'consultation', icon: MessageSquare, label: t('bot.salesModes.consultationLabel'), desc: t('bot.salesModes.consultationDesc'), accent: 'text-amber-400',  activeBg: 'bg-amber-400/10 border-amber-400/40' },
  ];

  // Per-card save row. All sections edit the same config object, so saving from
  // any card commits every pending change at once.
  const SectionSave = () => (
    <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-white/[0.06] pt-4">
      {error
        ? <span className="me-auto flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</span>
        : saved
        ? <span className="me-auto flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-[#25D366]"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{t('bot.saved')}</span>
        : isDirty
        ? <span className="me-auto flex items-center gap-1.5 text-xs text-gray-600 dark:text-[#8696A0]"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{t('bot.unsaved')}</span>
        : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200',
          saving   ? 'cursor-wait bg-[#25D366]/40 text-black/60 dark:text-black/60'
          : isDirty ? 'bg-[#25D366] text-black hover:bg-[#1FAA5C] shadow-[0_0_12px_rgba(37,211,102,0.3)]'
          : 'cursor-default bg-gray-200 dark:bg-white/[0.06] text-gray-600 dark:text-[#8696A0]',
        )}
      >
        {saving ? <RotateCcw className="h-4 w-4 animate-spin" /> : isDirty ? <Save className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-[#25D366]" />}
        <span>{saving ? t('bot.saving') : isDirty ? t('bot.save') : t('bot.saved')}</span>
      </button>
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">

      {/* ── Header: identity + master switch + actions ──────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10">
          <Bot className="h-5 w-5 text-[#25D366]" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-black dark:text-white sm:text-lg">{t('bot.title')}</h1>
          <p className="truncate text-xs text-gray-600 dark:text-[#8696A0]">{t('bot.subtitle')}</p>
        </div>

        {/* Master ON/OFF */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 transition-colors',
            c.enabled ? 'bg-[#25D366]/12' : 'bg-gray-100 dark:bg-white/[0.04]',
          )}
        >
          <Toggle checked={c.enabled} onChange={() => update({ enabled: !c.enabled })} />
          <span className={cn('whitespace-nowrap text-xs font-semibold', c.enabled ? 'text-[#25D366]' : 'text-gray-600 dark:text-[#8696A0]')}>
            {c.enabled ? t('bot.masterOn') : t('bot.masterOff')}
          </span>
        </div>

        {/* Templates */}
        <button
          type="button"
          onClick={() => setShowTemplates(true)}
          title={t('bot.startTemplate')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-200 dark:bg-white/[0.06] text-gray-600 dark:text-[#8696A0] transition-colors hover:bg-gray-300 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200',
            saving   ? 'cursor-wait bg-[#25D366]/40 text-black/60'
            : isDirty ? 'bg-[#25D366] text-black shadow-[0_0_14px_rgba(37,211,102,0.35)] hover:bg-[#1FAA5C]'
            : 'cursor-default bg-white/[0.06] text-[#8696A0]',
          )}
        >
          {saving ? <RotateCcw className="h-4 w-4 animate-spin" /> : isDirty ? <Save className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-[#25D366]" />}
          <span className="hidden sm:inline">{saving ? t('bot.saving') : isDirty ? t('bot.save') : t('bot.saved')}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── Layout: sections + sticky test panel ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">

          {/* ── Connection ──────────────────────────────────────────────────── */}
          <div id="sec-connection" className="scroll-mt-36">
            <SectionCard emoji={sec.connection.emoji} title={sec.connection.title} subtitle={sec.connection.subtitle}>
              <Field label={t('bot.connection.apiKey')}>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); d(); }}
                    placeholder="Groq API key (gsk_…)"
                    dir="ltr"
                    className={cn(
                      'w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30',
                      isRTL ? 'pl-10' : 'pr-10',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className={cn('absolute top-1/2 -translate-y-1/2 text-gray-600 dark:text-[#8696A0] hover:text-black dark:hover:text-white', isRTL ? 'left-3' : 'right-3')}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-[#8696A0]">
                  <Info className="h-3 w-3 shrink-0" />
                  {t('bot.connection.apiKeyHint', { url: 'console.groq.com' })}
                </p>
                <p className={cn('flex items-center gap-1.5 text-[11px] font-medium', hasApiKey ? 'text-green-600 dark:text-[#25D366]' : 'text-amber-600 dark:text-amber-400')}>
                  <KeyRound className="h-3 w-3 shrink-0" />
                  {hasApiKey ? t('bot.connection.keySet') : t('bot.connection.keyMissing')}
                </p>
              </Field>

              <Field label={t('bot.connection.geminiKey')}>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => { setGeminiApiKey(e.target.value); d(); }}
                    placeholder="Gemini API key (AIza… or AQ.…)"
                    dir="ltr"
                    className={cn(
                      'w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30',
                      isRTL ? 'pl-10' : 'pr-10',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey((v) => !v)}
                    className={cn('absolute top-1/2 -translate-y-1/2 text-gray-600 dark:text-[#8696A0] hover:text-black dark:hover:text-white', isRTL ? 'left-3' : 'right-3')}
                  >
                    {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-[#8696A0]">
                  <Info className="h-3 w-3 shrink-0" />
                  {t('bot.connection.geminiKeyHint', { url: 'aistudio.google.com/apikey' })}
                </p>
                <p className={cn('flex items-center gap-1.5 text-[11px] font-medium', hasGeminiKey ? 'text-green-600 dark:text-[#25D366]' : 'text-gray-500 dark:text-[#8696A0]')}>
                  <KeyRound className="h-3 w-3 shrink-0" />
                  {hasGeminiKey ? t('bot.connection.geminiKeySet') : t('bot.connection.geminiKeyMissing')}
                </p>
              </Field>

              <div className="flex items-start gap-2 rounded-lg border border-[#25D366]/25 bg-[#25D366]/[0.06] p-3">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#25D366]" />
                <p className="text-[11px] leading-relaxed text-gray-700 dark:text-[#8696A0]">{t('bot.connection.routingNote')}</p>
              </div>

              <ModelAssignment routing={status?.routing ?? null} t={t} />
              <FreeTierMeter models={status?.models ?? []} geminiModels={status?.geminiModels ?? []} t={t} />

              <SectionSave />
            </SectionCard>
          </div>

          {/* ── Identity & Voice ────────────────────────────────────────────── */}
          <div id="sec-identity" className="scroll-mt-36">
            <SectionCard emoji={sec.identity.emoji} title={sec.identity.title} subtitle={sec.identity.subtitle}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('personality.assistantName')}>
                  <TextInput value={c.personality.assistantName} placeholder={t('personality.assistantNamePlaceholder')} onChange={(v) => setPersonality({ assistantName: v })} />
                </Field>
                <Field label={t('personality.language')}>
                  <SegmentedControl<ConfigLanguage>
                    value={c.personality.language}
                    onChange={(v) => setPersonality({ language: v })}
                    options={[
                      { value: 'auto', label: t('personality.langAuto') },
                      { value: 'en',   label: t('personality.langEn') },
                      { value: 'ar',   label: t('personality.langAr') },
                    ]}
                  />
                </Field>
              </div>
              {c.personality.language !== 'en' && (
                <Field label={t('personality.dialect')} hint={t('personality.dialectHint')}>
                  <SegmentedControl<ArabicDialect>
                    value={c.personality.dialect}
                    onChange={(v) => setPersonality({ dialect: v })}
                    options={[
                      { value: 'saudi',     label: t('personality.dialectSaudi') },
                      { value: 'gulf',      label: t('personality.dialectGulf') },
                      { value: 'egyptian',  label: t('personality.dialectEgyptian') },
                      { value: 'levantine', label: t('personality.dialectLevantine') },
                      { value: 'msa',       label: t('personality.dialectMsa') },
                    ]}
                  />
                </Field>
              )}
              <Field label={t('personality.persona')} hint={t('personality.personaHint')}>
                <TextArea
                  value={c.personality.persona}
                  rows={3}
                  placeholder={t('personality.personaPlaceholder')}
                  onChange={(v) => setPersonality({ persona: v })}
                />
              </Field>
              <Field label={t('personality.tone')}>
                <SegmentedControl<Tone>
                  value={c.personality.tone}
                  onChange={(v) => setPersonality({ tone: v })}
                  options={[
                    { value: 'friendly',     label: t('personality.toneFriendly') },
                    { value: 'professional', label: t('personality.toneProfessional') },
                    { value: 'luxury',       label: t('personality.toneLuxury') },
                    { value: 'formal',       label: t('personality.toneFormal') },
                    { value: 'casual',       label: t('personality.toneCasual') },
                  ]}
                />
              </Field>
              <Field label={t('personality.emoji')}>
                <SegmentedControl<EmojiUsage>
                  value={c.personality.emojiUsage}
                  onChange={(v) => setPersonality({ emojiUsage: v })}
                  options={[
                    { value: 'none',   label: t('personality.emojiNone') },
                    { value: 'low',    label: t('personality.emojiLow') },
                    { value: 'medium', label: t('personality.emojiMedium') },
                    { value: 'high',   label: t('personality.emojiHigh') },
                  ]}
                />
              </Field>
              <MoreOptions>
                <Card>
                  <Slider label={t('personality.formality')} value={c.personality.formality} display={c.personality.formality.toFixed(1)} onChange={(v) => setPersonality({ formality: v })} />
                  <Slider label={t('personality.humor')} value={c.personality.humorLevel} display={c.personality.humorLevel.toFixed(1)} onChange={(v) => setPersonality({ humorLevel: v })} />
                </Card>
                <Field label={t('personality.writingStyle')} hint={t('personality.optional')}>
                  <TextArea value={c.personality.writingStyle} rows={2} placeholder={t('personality.writingStylePlaceholder')} onChange={(v) => setPersonality({ writingStyle: v })} />
                </Field>
              </MoreOptions>
              <SectionSave />
            </SectionCard>
          </div>

          {/* ── Welcome ─────────────────────────────────────────────────────── */}
          <div id="sec-welcome" className="scroll-mt-36">
            <SectionCard emoji={sec.welcome.emoji} title={sec.welcome.title} subtitle={sec.welcome.subtitle}>
              <Field label={t('easy.welcome.message')} hint={t('easy.welcome.messageHint')}>
                <TextArea
                  value={c.conversation.welcomeMessage ?? ''}
                  rows={5}
                  placeholder={t('easy.welcome.messagePlaceholder')}
                  onChange={(v) => setConversation({ welcomeMessage: v })}
                />
                <p className="text-[10px] text-gray-600 dark:text-[#8696A0]">{t('easy.welcome.varsHint')}</p>
              </Field>
              <SettingRow label={t('easy.welcome.exact')} description={t('easy.welcome.exactDesc')}>
                <Toggle checked={c.conversation.welcomeMessageExact ?? false} onChange={() => setConversation({ welcomeMessageExact: !(c.conversation.welcomeMessageExact ?? false) })} />
              </SettingRow>
              <SettingRow label={t('conversation.greet')}>
                <Toggle checked={c.conversation.alwaysGreet} onChange={() => setConversation({ alwaysGreet: !c.conversation.alwaysGreet })} />
              </SettingRow>
              <SectionSave />
            </SectionCard>
          </div>

          {/* ── Knowledge ───────────────────────────────────────────────────── */}
          <div id="sec-knowledge" className="scroll-mt-36">
            <SectionCard emoji={sec.knowledge.emoji} title={sec.knowledge.title} subtitle={sec.knowledge.subtitle}>
              <Field label={t('company.services')}>
                <TextArea value={c.company.services} rows={4} onChange={(v) => setCompany({ services: v })} />
              </Field>
              <Field label={t('company.pricing')}>
                <TextArea value={c.company.pricing} onChange={(v) => setCompany({ pricing: v })} />
              </Field>
              <SettingRow label={t('products.includeLabel')} description={c.products.enabled ? t('products.includeOn') : t('products.includeOff')}>
                <Toggle checked={c.products.enabled} onChange={() => setProducts({ enabled: !c.products.enabled })} />
              </SettingRow>
              {c.products.enabled && (
                <>
                  <Field label={t('products.currency')} hint={t('products.currencyHint')}>
                    <TextInput value={c.products.currency} placeholder={t('products.currencyPlaceholder')} className="max-w-[160px]" onChange={(v) => setProducts({ currency: v })} />
                  </Field>
                  <ProductsEditor items={c.products.items} onChange={(items) => setProducts({ items })} />
                </>
              )}
              <MoreOptions label={t('easy.cards.services.more')}>
                <Field label={t('company.name')}><TextInput value={c.company.name} onChange={(v) => setCompany({ name: v })} /></Field>
                <Field label={t('company.about')}><TextArea value={c.company.about} onChange={(v) => setCompany({ about: v })} /></Field>
                <Field label={t('company.faqs')}><TextArea value={c.company.faqs} rows={4} onChange={(v) => setCompany({ faqs: v })} /></Field>
                <Field label={t('company.policies')}><TextArea value={c.company.policies} onChange={(v) => setCompany({ policies: v })} /></Field>
                <Field label={t('company.workingHours')}><TextInput value={c.company.workingHours} onChange={(v) => setCompany({ workingHours: v })} /></Field>
                <Field label={t('company.locations')}><TextArea value={c.company.locations} rows={2} onChange={(v) => setCompany({ locations: v })} /></Field>
                <Field label={t('company.contact')}><TextArea value={c.company.contact} rows={2} onChange={(v) => setCompany({ contact: v })} /></Field>
                <Field label={t('company.notes')}><TextArea value={c.company.notes} onChange={(v) => setCompany({ notes: v })} /></Field>
              </MoreOptions>
              <SectionSave />
            </SectionCard>
          </div>

          {/* ── Conversation & Sales ────────────────────────────────────────── */}
          <div id="sec-flow" className="scroll-mt-36">
            <SectionCard emoji={sec.flow.emoji} title={sec.flow.title} subtitle={sec.flow.subtitle}>
              <div>
                <p className="mb-3 text-xs font-semibold text-black dark:text-white">{t('bot.sellingStyle')}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SALES_MODES.map(({ value, icon: Icon, label, desc, accent, activeBg }) => {
                    const active = c.sales.mode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSales({ mode: value })}
                        className={cn(
                          'flex flex-col gap-2.5 rounded-xl border p-3.5 text-start transition-all',
                          active ? `${activeBg} ring-1 ring-inset ring-white/10 dark:ring-white/10` : 'border-gray-300 dark:border-white/[0.06] bg-gray-100 dark:bg-white/[0.02] hover:border-gray-400 dark:hover:border-white/20 hover:bg-gray-200 dark:hover:bg-white/[0.04]',
                        )}
                      >
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', active ? 'bg-white/[0.06] dark:bg-white/[0.06]' : 'bg-gray-200 dark:bg-white/[0.06]')}>
                          <Icon className={cn('h-4 w-4', active ? accent : 'text-gray-600 dark:text-[#8696A0]')} />
                        </div>
                        <div>
                          <p className={cn('text-xs font-semibold leading-tight', active ? 'text-black dark:text-white' : 'text-gray-700 dark:text-[#8696A0]')}>{label}</p>
                          <p className="mt-0.5 text-[10px] leading-snug text-gray-600 dark:text-[#8696A0]/80">{desc}</p>
                        </div>
                        {active && <CheckCircle2 className={cn('mt-auto h-3.5 w-3.5', accent)} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label={t('sales.questions')} hint={t('easy.cards.flow.questions')}>
                <TagListEditor items={c.sales.leadQualificationQuestions} onChange={(v) => setSales({ leadQualificationQuestions: v })} placeholder={t('sales.questionsPlaceholder')} />
              </Field>
              <Field label={t('sales.cta')}>
                <TextInput value={c.sales.cta} onChange={(v) => setSales({ cta: v })} />
              </Field>

              <div className="space-y-1 divide-y divide-gray-200 dark:divide-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-4">
                <div className="py-1"><SettingRow label={t('conversation.useName')}><Toggle checked={c.conversation.useCustomerName} onChange={() => setConversation({ useCustomerName: !c.conversation.useCustomerName })} /></SettingRow></div>
                <div className="py-1"><SettingRow label={t('conversation.askFollowUp')}><Toggle checked={c.conversation.askFollowUp} onChange={() => setConversation({ askFollowUp: !c.conversation.askFollowUp })} /></SettingRow></div>
                <div className="py-1"><SettingRow label={t('conversation.endCta')}><Toggle checked={c.conversation.alwaysEndWithCta} onChange={() => setConversation({ alwaysEndWithCta: !c.conversation.alwaysEndWithCta })} /></SettingRow></div>
                <div className="py-1"><SettingRow label={t('conversation.bulletPoints')}><Toggle checked={c.conversation.useBulletPoints} onChange={() => setConversation({ useBulletPoints: !c.conversation.useBulletPoints })} /></SettingRow></div>
              </div>

              <MoreOptions label={t('easy.cards.flow.more')}>
                <Field label={t('sales.bookingFlow')}><TextArea value={c.sales.bookingFlow} rows={2} onChange={(v) => setSales({ bookingFlow: v })} /></Field>
                <Field label={t('sales.upsell')}><TextArea value={c.sales.upsell} rows={2} onChange={(v) => setSales({ upsell: v })} /></Field>
                <Field label={t('sales.crossSell')}><TextArea value={c.sales.crossSell} rows={2} onChange={(v) => setSales({ crossSell: v })} /></Field>
                <Field label={t('sales.closing')}><TextArea value={c.sales.closing} rows={2} onChange={(v) => setSales({ closing: v })} /></Field>
                <Field label={t('conversation.typingStyle')} hint={t('personality.optional')}>
                  <TextInput value={c.conversation.typingStyle} placeholder={t('conversation.typingStylePlaceholder')} onChange={(v) => setConversation({ typingStyle: v })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('conversation.maxSentences')}><TextInput type="number" value={c.conversation.maxSentences} onChange={(v) => setConversation({ maxSentences: parseInt(v) || 0 })} /></Field>
                  <Field label={t('conversation.maxChars')}><TextInput type="number" value={c.conversation.maxResponseChars} onChange={(v) => setConversation({ maxResponseChars: parseInt(v) || 0 })} /></Field>
                </div>
              </MoreOptions>
              <SectionSave />
            </SectionCard>
          </div>

          {/* ── Rules & Safety ──────────────────────────────────────────────── */}
          <div id="sec-rules" className="scroll-mt-36">
            <SectionCard emoji={sec.rules.emoji} title={sec.rules.title} subtitle={sec.rules.subtitle}>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-[#25D366]" />
                  <p className="text-xs font-semibold text-black dark:text-white">{t('bot.alwaysDo')}</p>
                  <span className="text-[10px] text-gray-600 dark:text-[#8696A0]">— {t('bot.alwaysDoHint')}</span>
                </div>
                <TagListEditor items={c.businessRules} onChange={(v) => update({ businessRules: v })} multiline placeholder={t('bot.rulePlaceholder')} />
              </div>

              <div className="h-px bg-white/[0.06]" />

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Ban className="h-4 w-4 text-red-400" />
                  <p className="text-xs font-semibold text-black dark:text-white">{t('bot.neverTopics')}</p>
                  <span className="text-[10px] text-gray-600 dark:text-[#8696A0]">— {t('bot.neverTopicsHint')}</span>
                </div>
                <TagListEditor items={c.safety.forbiddenTopics} onChange={(v) => setSafety({ forbiddenTopics: v })} placeholder={t('safety.forbiddenPlaceholder')} />
              </div>

              <div className="h-px bg-white/[0.06]" />

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <p className="text-xs font-semibold text-black dark:text-white">{t('bot.strictLimits')}</p>
                </div>
                <div className="space-y-1 divide-y divide-gray-200 dark:divide-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-4">
                  <div className="py-1"><SettingRow label={t('safety.businessOnly')} description={t('safety.businessOnlyDesc')}><Toggle checked={c.safety.businessOnlyMode} onChange={() => setSafety({ businessOnlyMode: !c.safety.businessOnlyMode })} /></SettingRow></div>
                  <div className="py-1"><SettingRow label={t('safety.political')}><Toggle checked={c.safety.refusePolitical} onChange={() => setSafety({ refusePolitical: !c.safety.refusePolitical })} /></SettingRow></div>
                  <div className="py-1"><SettingRow label={t('safety.religious')}><Toggle checked={c.safety.refuseReligious} onChange={() => setSafety({ refuseReligious: !c.safety.refuseReligious })} /></SettingRow></div>
                  <div className="py-1"><SettingRow label={t('safety.medical')}><Toggle checked={c.safety.refuseMedical} onChange={() => setSafety({ refuseMedical: !c.safety.refuseMedical })} /></SettingRow></div>
                  <div className="py-1"><SettingRow label={t('safety.legal')}><Toggle checked={c.safety.refuseLegal} onChange={() => setSafety({ refuseLegal: !c.safety.refuseLegal })} /></SettingRow></div>
                  <div className="py-1"><SettingRow label={t('safety.safeMode')} description={t('safety.safeModeDesc')}><Toggle checked={c.safety.safeMode} onChange={() => setSafety({ safeMode: !c.safety.safeMode })} /></SettingRow></div>
                </div>
              </div>
              <SectionSave />
            </SectionCard>
          </div>

          {/* ── Audience ────────────────────────────────────────────────────── */}
          <div id="sec-audience" className="scroll-mt-36">
            <SectionCard emoji={sec.audience.emoji} title={sec.audience.title} subtitle={sec.audience.subtitle}>
              <Field label={t('audience.who')}>
                <SegmentedControl<TargetingMode>
                  value={c.targeting.mode}
                  onChange={(v) => setTargeting({ mode: v })}
                  options={[{ value: 'all', label: t('audience.everyone') }, { value: 'rules', label: t('audience.matching') }]}
                />
                <p className="text-[10px] text-gray-600 dark:text-[#8696A0]">{c.targeting.mode === 'all' ? t('audience.noteAll') : t('audience.noteRules')}</p>
              </Field>
              {c.targeting.mode === 'rules' && (
                <>
                  <Field label={t('audience.includeTags')} hint={t('audience.includeTagsHint')}>
                    <ChipMultiSelect options={targetingOptions.tags} selected={c.targeting.includeTags} onChange={(v) => setTargeting({ includeTags: v })} emptyLabel={t('audience.includeTagsEmpty')} />
                  </Field>
                  <Field label={t('audience.excludeTags')} hint={t('audience.excludeTagsHint')}>
                    <ChipMultiSelect options={targetingOptions.tags} selected={c.targeting.excludeTags} onChange={(v) => setTargeting({ excludeTags: v })} emptyLabel={t('audience.excludeTagsEmpty')} />
                  </Field>
                  <Field label={t('audience.lifecycle')} hint={t('audience.lifecycleHint')}>
                    <ChipMultiSelect options={targetingOptions.lifecycleStages} selected={c.targeting.lifecycleStages} onChange={(v) => setTargeting({ lifecycleStages: v })} />
                  </Field>
                  <Field label={t('audience.newVsReturning')}>
                    <SegmentedControl<TargetingAudience>
                      value={c.targeting.audience}
                      onChange={(v) => setTargeting({ audience: v })}
                      options={[
                        { value: 'all',            label: t('audience.all') },
                        { value: 'new_only',       label: t('audience.newOnly') },
                        { value: 'returning_only', label: t('audience.returningOnly') },
                      ]}
                    />
                  </Field>
                </>
              )}
              <SettingRow label={t('audience.overrideLabel')} description={t('audience.overrideDesc')}>
                <Toggle checked={c.targeting.respectPerChatOverride} onChange={() => setTargeting({ respectPerChatOverride: !c.targeting.respectPerChatOverride })} />
              </SettingRow>
              <SectionSave />
            </SectionCard>
          </div>

          {/* ── When to Answer ──────────────────────────────────────────────── */}
          <div id="sec-schedule" className="scroll-mt-36">
            <SectionCard emoji={sec.schedule.emoji} title={sec.schedule.title} subtitle={sec.schedule.subtitle}>
              <SettingRow label={t('whenToAnswer.onlyDuringHours')} description={t('whenToAnswer.onlyDuringHoursDesc')}>
                <Toggle checked={c.gating.businessHoursEnabled} onChange={() => setGating({ businessHoursEnabled: !c.gating.businessHoursEnabled })} />
              </SettingRow>
              {c.gating.businessHoursEnabled && (
                <Card>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('whenToAnswer.start')}>
                      <input type="time" value={c.gating.businessHoursStart} onChange={(e) => setGating({ businessHoursStart: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30" />
                    </Field>
                    <Field label={t('whenToAnswer.end')}>
                      <input type="time" value={c.gating.businessHoursEnd} onChange={(e) => setGating({ businessHoursEnd: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111B21] px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30" />
                    </Field>
                  </div>
                  <Field label={t('whenToAnswer.offHoursMessage')} hint={t('whenToAnswer.offHoursHint')}>
                    <TextArea value={c.gating.offHoursMessage} rows={2} placeholder={t('whenToAnswer.offHoursPlaceholder')} onChange={(v) => setGating({ offHoursMessage: v })} />
                  </Field>
                </Card>
              )}
              <Field label={t('whenToAnswer.batchWindow')} hint={t('whenToAnswer.batchWindowHint')}>
                <TextInput type="number" value={c.gating.batchWindowSeconds} className="max-w-[120px]" onChange={(v) => setGating({ batchWindowSeconds: Math.max(0, parseInt(v) || 0) })} />
              </Field>
              <Field label={t('whenToAnswer.fallback')} hint={t('whenToAnswer.fallbackHint')}>
                <TextArea value={c.gating.fallbackMessage} rows={2} onChange={(v) => setGating({ fallbackMessage: v })} />
              </Field>
              <SettingRow label={t('whenToAnswer.ignoreFirst')} description={t('whenToAnswer.ignoreFirstDesc')}>
                <Toggle checked={c.gating.ignoreFirstMessage} onChange={() => setGating({ ignoreFirstMessage: !c.gating.ignoreFirstMessage })} />
              </SettingRow>
              <MoreOptions label={t('whenToAnswer.limits')}>
                <Field label={t('whenToAnswer.maxReplies')} hint={t('whenToAnswer.maxRepliesHint')}>
                  <TextInput type="number" value={c.gating.maxResponsesPerHour} className="max-w-[120px]" onChange={(v) => setGating({ maxResponsesPerHour: parseInt(v) || 0 })} />
                </Field>
                <Card>
                  <Slider label={t('whenToAnswer.typingDelay')} value={c.gating.typingDelayMs} min={0} max={5000} step={100}
                    display={`${c.gating.typingDelayMs}ms`} icon={<Timer className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />}
                    minLabel={t('whenToAnswer.typingDelayMin')} maxLabel={t('whenToAnswer.typingDelayMax')}
                    onChange={(v) => setGating({ typingDelayMs: Math.round(v) })} />
                </Card>
              </MoreOptions>
              <SectionSave />
            </SectionCard>
          </div>

          {/* ── Human Handoff ───────────────────────────────────────────────── */}
          <div id="sec-handoff" className="scroll-mt-36">
            <SectionCard emoji={sec.handoff.emoji} title={sec.handoff.title} subtitle={sec.handoff.subtitle}>
              <SettingRow label={t('handoff.enable')}>
                <Toggle checked={c.handoff.enabled} onChange={() => setHandoff({ enabled: !c.handoff.enabled })} />
              </SettingRow>
              <div className="space-y-3 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-3">
                <p className="text-xs text-gray-600 dark:text-[#8696A0]">{t('handoff.transferWhen')}</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  <SettingRow label={t('handoff.complaint')}><Toggle checked={c.handoff.triggers.complaint} onChange={() => setHandoffTrig('complaint')} /></SettingRow>
                  <SettingRow label={t('handoff.refund')}><Toggle checked={c.handoff.triggers.refund} onChange={() => setHandoffTrig('refund')} /></SettingRow>
                  <SettingRow label={t('handoff.manager')}><Toggle checked={c.handoff.triggers.manager} onChange={() => setHandoffTrig('manager')} /></SettingRow>
                  <SettingRow label={t('handoff.humanAgent')}><Toggle checked={c.handoff.triggers.humanAgent} onChange={() => setHandoffTrig('humanAgent')} /></SettingRow>
                  <SettingRow label={t('handoff.technicalSupport')}><Toggle checked={c.handoff.triggers.technicalSupport} onChange={() => setHandoffTrig('technicalSupport')} /></SettingRow>
                </div>
                <Field label={t('handoff.customTriggers')}>
                  <TagListEditor items={c.handoff.customTriggers} onChange={(v) => setHandoff({ customTriggers: v })} placeholder={t('handoff.customTriggersPlaceholder')} />
                </Field>
                <Field label={t('handoff.transferMessage')} hint={t('handoff.transferMessageHint')}>
                  <TextArea value={c.handoff.transferMessage} rows={2} placeholder={t('handoff.transferMessagePlaceholder')} onChange={(v) => setHandoff({ transferMessage: v })} />
                </Field>
              </div>
              <Field label={t('whenToAnswer.pauseDuration')} hint={t('whenToAnswer.pauseDurationHint')}>
                <TextInput type="number" value={c.gating.pauseDurationHours} className="max-w-[120px]" onChange={(v) => setGating({ pauseDurationHours: parseInt(v) || 8 })} />
              </Field>
              <SectionSave />
            </SectionCard>
          </div>

          {/* ── Advanced ────────────────────────────────────────────────────── */}
          <div id="sec-advanced" className="scroll-mt-36">
            <SectionCard emoji={sec.advanced.emoji} title={sec.advanced.title} subtitle={sec.advanced.subtitle}>
              <MoreOptions label={t('general.title')}>
                <Card>
                  <Slider label={t('general.temperature')} value={c.general.temperature} min={0} max={1} step={0.1}
                    display={c.general.temperature.toFixed(1)} icon={<Thermometer className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />}
                    hint={t('general.temperatureHint')} minLabel={t('general.temperatureMin')} maxLabel={t('general.temperatureMax')}
                    onChange={(v) => setGeneral({ temperature: v })} />
                  <Slider label={t('general.creativity')} value={c.general.creativityLevel} min={0} max={1} step={0.1}
                    display={c.general.creativityLevel.toFixed(1)} icon={<Sparkles className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />}
                    hint={t('general.creativityHint')} minLabel={t('general.creativityMin')} maxLabel={t('general.creativityMax')}
                    onChange={(v) => setGeneral({ creativityLevel: v })} />
                  <Field label={t('general.maxTokens')} hint={t('general.maxTokensHint')}>
                    <TextInput type="number" value={c.general.maxTokens} className="max-w-[120px]" onChange={(v) => setGeneral({ maxTokens: parseInt(v) || 400 })} />
                  </Field>
                </Card>
                <Field label={t('general.responseLength')}>
                  <SegmentedControl<ResponseLength>
                    value={c.general.responseLength}
                    onChange={(v) => setGeneral({ responseLength: v })}
                    options={[
                      { value: 'short',  label: t('general.lengthShort') },
                      { value: 'medium', label: t('general.lengthMedium') },
                      { value: 'long',   label: t('general.lengthLong') },
                    ]}
                  />
                </Field>
              </MoreOptions>

              <MoreOptions label={t('memory.title')}>
                <Card>
                  <Slider label={t('memory.contextLength')} value={c.memory.contextLength} min={3} max={30} step={1}
                    display={`${c.memory.contextLength}`} icon={<Hash className="h-4 w-4 text-gray-600 dark:text-[#8696A0]" />}
                    onChange={(v) => setMemory({ contextLength: Math.round(v) })} />
                </Card>
                <div className="space-y-1 divide-y divide-gray-200 dark:divide-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-4">
                  <div className="py-1"><SettingRow label={t('memory.rememberName')}><Toggle checked={c.memory.rememberName} onChange={() => setMemory({ rememberName: !c.memory.rememberName })} /></SettingRow></div>
                  <div className="py-1"><SettingRow label={t('memory.rememberOrders')}><Toggle checked={c.memory.rememberOrders} onChange={() => setMemory({ rememberOrders: !c.memory.rememberOrders })} /></SettingRow></div>
                  <div className="py-1"><SettingRow label={t('memory.rememberPreferences')}><Toggle checked={c.memory.rememberPreferences} onChange={() => setMemory({ rememberPreferences: !c.memory.rememberPreferences })} /></SettingRow></div>
                  <div className="py-1"><SettingRow label={t('memory.persistent')} description={t('memory.persistentDesc')}><Toggle checked={c.memory.persistent} onChange={() => setMemory({ persistent: !c.memory.persistent })} /></SettingRow></div>
                </div>
              </MoreOptions>

              <MoreOptions label={t('variables.title')}>
                <Card>
                  <SectionLabel>{t('variables.builtin')}</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {BUILTIN_VARIABLES.map((v) => (
                      <code key={v} className="rounded-md bg-gray-100 dark:bg-[#111B21] px-2 py-1 text-xs text-[#25D366]">{v}</code>
                    ))}
                  </div>
                </Card>
                <Field label={t('variables.custom')}>
                  <KeyValueEditor items={c.customVariables} onChange={(v) => update({ customVariables: v })} />
                  <p className="text-[10px] text-gray-600 dark:text-[#8696A0]">{t('variables.reference')} <code className="text-[#25D366]">{'{{your_key}}'}</code>.</p>
                </Field>
              </MoreOptions>

              <MoreOptions label={t('advanced.rawOverride')}>
                <p className="text-[11px] leading-5 text-gray-600 dark:text-[#8696A0]">{t('advanced.rawOverrideHint')}</p>
                {c.rawPromptOverride.trim() && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                    <Info className="h-3.5 w-3.5 shrink-0" /> {t('advanced.activeWarning')}
                  </div>
                )}
                <TextArea value={c.rawPromptOverride} rows={10} placeholder={t('advanced.rawOverridePlaceholder')} onChange={(v) => update({ rawPromptOverride: v })} />
              </MoreOptions>
              <SectionSave />
            </SectionCard>
          </div>
        </div>

        {/* ── Right column: sticky test panel ──────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="space-y-3 lg:sticky lg:top-4">
            <Playground config={c} isRTL={isRTL} t={t} />
            <div className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-3">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600 dark:text-[#8696A0]" />
              <p className="text-[11px] leading-relaxed text-gray-600 dark:text-[#8696A0]">{t('bot.testNote')}</p>
            </div>
          </div>
        </div>
      </div>

      {showTemplates && <TemplatesModal onApply={applyTemplate} onClose={() => setShowTemplates(false)} isRTL={isRTL} />}
    </div>
  );
}

// ── Which model each feature uses (read from the router) ─────────────────────
function ModelAssignment({ routing, t }: { routing: RoutingMap | null; t: (k: string) => string }) {
  const rows: Array<{ key: keyof RoutingMap; label: string }> = [
    { key: 'bot', label: t('bot.routing.bot') },
    { key: 'qualification', label: t('bot.routing.qualification') },
    { key: 'assistant', label: t('bot.routing.assistant') },
  ];
  return (
    <div className="space-y-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-3">
      <p className="text-xs font-semibold text-black dark:text-white">{t('bot.routing.title')}</p>
      {rows.map((r) => {
        const chain = routing?.[r.key] ?? [];
        return (
          <div key={r.key} className="flex flex-col gap-1 border-t border-gray-200/70 dark:border-white/[0.04] pt-2 first-of-type:border-0 first-of-type:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-[#8696A0]">{r.label}</span>
            <div className="flex flex-wrap items-center gap-1">
              {chain.length === 0
                ? <span className="text-[11px] text-gray-400">—</span>
                : chain.map((cand, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-gray-400 rtl:rotate-180" />}
                      <span className={cn(
                        'whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                        i === 0 ? 'bg-[#25D366]/15 text-[#25D366]' : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-[#8696A0]',
                      )}>{modelLabel(cand.model)}</span>
                    </span>
                  ))}
            </div>
          </div>
        );
      })}
      <p className="text-[10px] leading-relaxed text-gray-500 dark:text-[#8696A0]/70">{t('bot.routing.hint')}</p>
    </div>
  );
}

// ── Live free-tier usage meter (Gemini + Groq buckets) ───────────────────────
function FreeTierMeter({ models, geminiModels, t }: {
  models: GroqModelStatus[]; geminiModels: GeminiModelStatus[]; t: (k: string) => string;
}) {
  if (models.length === 0 && geminiModels.length === 0) return null;
  return (
    <div className="space-y-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-3">
      <div className="flex items-center gap-2">
        <Gauge className="h-3.5 w-3.5 text-gray-600 dark:text-[#8696A0]" />
        <p className="text-xs font-semibold text-black dark:text-white">{t('bot.usage.title')}</p>
      </div>

      {geminiModels.map((m) => (
        <div key={m.model} className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium text-gray-700 dark:text-white">{modelLabel(m.model)}</span>
          {!m.available
            ? <span dir="ltr" className="text-[11px] font-medium text-amber-500">{Math.floor(m.secondsLeft / 60)}:{String(m.secondsLeft % 60).padStart(2, '0')}</span>
            : <span className="text-[11px] text-gray-500 dark:text-[#8696A0]"><span className="font-semibold text-black dark:text-white">{m.requestsToday}</span> {t('bot.usage.today')}</span>}
        </div>
      ))}

      {models.map((m) => {
        const q = m.quota;
        const tokPct = q && q.remainingTokens != null && q.limitTokens ? Math.max(0, Math.min(1, q.remainingTokens / q.limitTokens)) : null;
        const low = tokPct != null && tokPct <= 0.15;
        const mid = tokPct != null && tokPct > 0.15 && tokPct <= 0.4;
        return (
          <div key={m.model} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-gray-700 dark:text-white">{modelLabel(m.model)}</span>
              {!m.available
                ? <span dir="ltr" className="text-[11px] font-medium text-amber-500">{Math.floor(m.secondsLeft / 60)}:{String(m.secondsLeft % 60).padStart(2, '0')}</span>
                : q
                ? <span dir="ltr" className="text-[11px] text-gray-500 dark:text-[#8696A0]">{fmtNum(q.remainingTokens)}/{fmtNum(q.limitTokens)} {t('bot.usage.tok')}</span>
                : <span className="text-[11px] text-gray-400 dark:text-[#8696A0]/70">{t('bot.usage.idle')}</span>}
            </div>
            {tokPct != null && (
              <div className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div className={cn('h-1 rounded-full', low ? 'bg-red-500' : mid ? 'bg-amber-400' : 'bg-[#25D366]')} style={{ width: `${Math.round(tokPct * 100)}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Live test playground ─────────────────────────────────────────────────────
function Playground({ config, isRTL, t }: { config: AiConfig; isRTL: boolean; t: (k: string) => string }) {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true); setErr('');
    const next = [...history, { role: 'user' as const, content: text }];
    setHistory(next); setMessage('');
    try {
      const data = await api.post('/api/chatbot/ai-config/playground', { config, message: text, history });
      setHistory([...next, { role: 'assistant', content: data.reply }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('playground.error'));
    } finally {
      setBusy(false);
    }
  };

  const SAMPLES = [
    'Hello! What do you offer?',
    'How much does it cost?',
    'I want to place an order',
    'Can I speak to someone?',
  ];

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0B141A]">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/15">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <span className="text-sm font-semibold text-black dark:text-white">{t('bot.test')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-gray-600 dark:text-[#8696A0] sm:inline">{t('bot.testLive')}</span>
          {history.length > 0 && (
            <button type="button" title="Clear" onClick={() => setHistory([])}
              className="rounded-lg bg-gray-200 dark:bg-white/[0.06] p-1.5 text-gray-600 dark:text-[#8696A0] transition-colors hover:bg-gray-300 dark:hover:bg-white/10 hover:text-black dark:hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-[280px] max-h-[480px] flex-1 space-y-3 overflow-y-auto p-4 bg-gray-50 dark:bg-transparent" dir={isRTL ? 'rtl' : 'ltr'}>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-200 dark:bg-[#202C33]">
              <Bot className="h-7 w-7 text-[#25D366]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-black dark:text-white">{t('bot.testEmptyTitle')}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-[#8696A0]">{t('bot.testEmptySub')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SAMPLES.map((q) => (
                <button key={q} type="button" onClick={() => setMessage(q)}
                  className="rounded-full border border-gray-300 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs text-gray-700 dark:text-[#8696A0] transition-colors hover:border-gray-400 dark:hover:border-white/20 hover:text-black dark:hover:text-white">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'bg-[#25D366] text-black' : 'bg-gray-200 dark:bg-[#202C33] text-black dark:text-white')} dir="auto">
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-gray-200 dark:bg-[#202C33] px-3.5 py-2.5">
              <RotateCcw className="h-3.5 w-3.5 animate-spin text-[#25D366]" />
              <span className="text-xs text-gray-600 dark:text-[#8696A0]">{t('playground.thinking')}</span>
            </div>
          </div>
        )}
        {err && <p className="text-center text-xs text-red-600 dark:text-red-400">{err}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 dark:border-white/10 p-3">
        <input
          value={message}
          dir="auto"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(); }}
          placeholder={t('bot.testPlaceholder')}
          className="flex-1 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2.5 text-sm text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
        />
        <button type="button" onClick={send} disabled={busy || !message.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-black transition-colors hover:bg-[#1FAA5C] disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
    {/* Mobile bottom-nav spacer */}
    <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />
    </>
  );
}
