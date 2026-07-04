'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Target, Search, MessageSquare, RefreshCw, Sparkles, ChevronDown,
  AlertTriangle, ShoppingCart, Flame, History, UserX,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useSocket } from '../../../hooks/useSocket';
import { useToast } from '../../../hooks/useToast';
import { cn } from '../../../lib/utils';
import {
  type Lead, type LeadStatus, type LeadStatusEvent,
  StatusBadge, PriorityBadge, FlagChips, SignalChips,
  scoreColor, localizedText, LeadAvatar, STATUS_CFG,
} from '../../../components/leads/lead-ui';

// Sidebar/tab views → underlying canonical statuses (reconciled 9-status set).
const TABS: Array<{ key: string; statuses: LeadStatus[] | null }> = [
  { key: 'all',       statuses: null },
  { key: 'newLeads',  statuses: ['NEW_LEAD'] },
  { key: 'hot',       statuses: ['HOT', 'QUALIFIED'] },
  { key: 'followUp',  statuses: ['WARM', 'COLD'] },
  { key: 'customers', statuses: ['CUSTOMER'] },
  { key: 'lost',      statuses: ['LOST', 'NOT_INTERESTED'] },
  { key: 'spam',      statuses: ['SPAM'] },
];

type Stats = { total: number; statusCounts: Record<string, number>; needsAttention: number; buyingIntent: number; noHandoff: number };

function timeAgo(iso: string | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!iso) return t('neverAnalyzed');
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('timeAgo.justNow');
  if (min < 60) return t('timeAgo.minutesAgo', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('timeAgo.hoursAgo', { count: h });
  return t('timeAgo.daysAgo', { count: Math.floor(h / 24) });
}

export default function LeadsPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { t, i18n } = useTranslation('leads');
  const lang = i18n.language;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable across renders: useToast/i18n return fresh fns each render, so we
  // deliberately exclude them from deps to avoid an infinite fetch loop.
  const fetchAll = useCallback(async () => {
    try {
      const [leadData, statData] = await Promise.all([
        api.get('/api/leads'),
        api.get('/api/leads/stats'),
      ]);
      setLeads(Array.isArray(leadData) ? leadData : []);
      setStats(statData ?? null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('toast.loadFailed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run once on mount.
  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: re-qualification anywhere → debounced refresh.
  const onLeadUpdated = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(fetchAll, 1200);
  }, [fetchAll]);
  useSocket('lead:updated', onLeadUpdated);
  useEffect(() => () => { if (refetchTimer.current) clearTimeout(refetchTimer.current); }, []);

  const analyze = async (lead: Lead) => {
    setAnalyzingId(lead.contactId);
    try {
      await api.post(`/api/leads/${lead.contactId}/analyze`, {});
      success(t('toast.analyzed'));
      await fetchAll();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('toast.analyzeFailed'));
    } finally {
      setAnalyzingId(null);
    }
  };

  const openChat = (lead: Lead) => {
    if (lead.contact?.phone) router.push(`/conversations?phone=${encodeURIComponent(lead.contact.phone)}`);
  };

  const activeTab = TABS.find((x) => x.key === tab) ?? TABS[0];
  const term = search.trim().toLowerCase();
  const visible = leads.filter((l) => {
    if (activeTab.statuses && !activeTab.statuses.includes(l.status)) return false;
    if (term) {
      const hay = `${l.contact?.name ?? ''} ${l.contact?.phone ?? ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const tabCount = (key: string): number => {
    if (!stats) return 0;
    const cfg = TABS.find((x) => x.key === key);
    if (!cfg) return 0;
    if (!cfg.statuses) return stats.total;
    return cfg.statuses.reduce((sum, s) => sum + (stats.statusCounts[s] ?? 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#111B21]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,211,102,0.10),transparent_40%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <Sparkles className="h-3.5 w-3.5" />
              {t('badge')}
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-3xl font-semibold text-gray-900 dark:text-white">
              <Target className="h-7 w-7 text-[#25D366]" />
              {t('title')}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-gray-500 dark:text-[#8696A0]">{t('subtitle')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-5 lg:gap-6">
            <Stat value={stats?.total ?? 0} label={t('stats.total')} />
            <div className="h-8 w-px bg-gray-200 dark:bg-white/8" />
            <Stat value={stats?.needsAttention ?? 0} label={t('stats.needsAttention')} icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />} tone="text-red-400" />
            <div className="h-8 w-px bg-gray-200 dark:bg-white/8" />
            <Stat value={stats?.buyingIntent ?? 0} label={t('stats.buyingIntent')} icon={<ShoppingCart className="h-3.5 w-3.5 text-[#25D366]" />} tone="text-[#25D366]" />
            <div className="h-8 w-px bg-gray-200 dark:bg-white/8" />
            <Stat value={tabCount('hot')} label={t('stats.hot')} icon={<Flame className="h-3.5 w-3.5 text-orange-400" />} tone="text-orange-400" />
            <div className="h-8 w-px bg-gray-200 dark:bg-white/8" />
            <Stat
              value={stats?.noHandoff ?? 0}
              label={t('stats.noHandoff')}
              icon={<UserX className="h-3.5 w-3.5 text-amber-400" />}
              tone={(stats?.noHandoff ?? 0) > 0 ? 'text-amber-400' : undefined}
            />
          </div>
        </div>
      </section>

      {/* ── Controls: tabs + search ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((x) => {
            const active = tab === x.key;
            const count = tabCount(x.key);
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => setTab(x.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366]'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-[#111B21] dark:text-[#8696A0] dark:hover:bg-white/5 dark:hover:text-white',
                )}
              >
                {t(`tabs.${x.key}`)}
                <span className={cn('rounded-full px-1.5 text-[10px] font-bold', active ? 'bg-[#25D366]/20' : 'bg-gray-200 dark:bg-white/10')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-[#8696A0]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white ps-9 pe-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#25D366]/50 dark:border-white/10 dark:bg-[#202C33] dark:text-white dark:placeholder:text-[#8696A0]/60"
          />
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState filtered={leads.length > 0} />
      ) : (
        <div className="space-y-3">
          {visible.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              lang={lang}
              analyzing={analyzingId === lead.contactId}
              onAnalyze={() => analyze(lead)}
              onOpenChat={() => openChat(lead)}
            />
          ))}
        </div>
      )}
      {/* Mobile bottom-nav spacer */}
      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />
    </div>
  );
}

// ── Lead row (expandable) ─────────────────────────────────────────────────────
function LeadRow({
  lead, lang, analyzing, onAnalyze, onOpenChat,
}: {
  lead: Lead;
  lang: string;
  analyzing: boolean;
  onAnalyze: () => void;
  onOpenChat: () => void;
}) {
  const { t } = useTranslation('leads');
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<LeadStatusEvent[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const summary = localizedText(lead, 'summary', lang);
  const recommendation = localizedText(lead, 'recommendation', lang);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && history === null) {
      setLoadingHistory(true);
      try {
        const data = await api.get(`/api/leads/${lead.contactId}`);
        setHistory(Array.isArray(data?.history) ? data.history : []);
      } catch {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  return (
    <article className={cn(
      'rounded-2xl border bg-white transition-colors dark:bg-[#111B21]',
      lead.needsAttention ? 'border-red-500/25' : 'border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20',
    )}>
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {/* Avatar */}
        <LeadAvatar lead={lead} className="h-10 w-10 text-sm" />

        {/* Main */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {lead.contact?.name
                ? lead.contact.name
                : lead.contact?.phone
                  ? <span dir="ltr">{'‎'}{lead.contact.phone}</span>
                  : '—'}
            </p>
            <StatusBadge status={lead.status} />
            <PriorityBadge priority={lead.priority} />
          </div>
          {lead.contact?.name && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-[#8696A0] text-left" dir="ltr">
              {'‎'}{lead.contact.phone}
            </p>
          )}
          {summary && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-700 dark:text-[#cfd9de]">{summary}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FlagChips lead={lead} />
            <span className="text-[10px] text-gray-400 dark:text-[#8696A0]/50">{t('lastAnalyzed', { time: timeAgo(lead.lastAnalyzedAt, t) })}</span>
          </div>
        </div>

        {/* Score */}
        <div className="shrink-0 text-center">
          <p className={cn('text-2xl font-bold leading-none', scoreColor(lead.score))}>{lead.score}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400/60 dark:text-[#8696A0]/60">{t('score')}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 px-4 py-2.5 dark:border-white/5">
        <button
          type="button"
          onClick={onOpenChat}
          disabled={!lead.contact?.phone}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#25D366]/20 bg-[#25D366]/8 px-3 py-1.5 text-[11px] font-medium text-[#25D366] transition-colors hover:bg-[#25D366]/15 disabled:opacity-40"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {t('openConversation')}
        </button>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', analyzing && 'animate-spin')} />
          {analyzing ? t('analyzing') : t('reanalyze')}
        </button>
        <button
          type="button"
          onClick={toggle}
          className="ms-auto inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] text-gray-500 transition-colors hover:text-gray-900 dark:text-[#8696A0] dark:hover:text-white"
        >
          {t('history')}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-white/5">
          {recommendation && (
            <Detail label={t('recommendation')}>
              <p className="rounded-xl border border-[#25D366]/15 bg-[#25D366]/5 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-[#cfd9de]">
                {recommendation}
              </p>
            </Detail>
          )}
          <Detail label={t('signals')}>
            <SignalChips signals={lead.signals} />
          </Detail>
          <Detail label={t('history')}>
            {loadingHistory ? (
              <p className="text-xs text-gray-400/60 dark:text-[#8696A0]/60">…</p>
            ) : !history || history.length === 0 ? (
              <p className="text-xs text-gray-400/60 dark:text-[#8696A0]/60">{t('noHistory')}</p>
            ) : (
              <ol className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-xs">
                    <History className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-[#8696A0]/50" />
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', STATUS_CFG[h.toStatus].badge, 'border')}>
                      {t(`status.${h.toStatus}`)}
                    </span>
                    {h.fromStatus && (
                      <span className="text-[10px] text-gray-400 dark:text-[#8696A0]/50">← {t(`status.${h.fromStatus}`)}</span>
                    )}
                    <span className="ms-auto text-[10px] text-gray-400/60 dark:text-[#8696A0]/40">{timeAgo(h.createdAt, t)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Detail>
        </div>
      )}
    </article>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Stat({ value, label, icon, tone }: { value: string | number; label: string; icon?: React.ReactNode; tone?: string }) {
  return (
    <div className="text-center">
      <p className={cn('flex items-center justify-center gap-1 text-xl font-bold', tone ?? 'text-gray-900 dark:text-white')}>
        {icon}{value}
      </p>
      <p className="text-xs text-gray-500 dark:text-[#8696A0]">{label}</p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]/70">{label}</p>
      {children}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/5 dark:bg-[#111B21]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-white/8" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-white/8" />
          <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-white/5" />
        </div>
        <div className="h-8 w-8 rounded bg-gray-200 dark:bg-white/8" />
      </div>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation('leads');
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center dark:border-white/10 dark:bg-[#111B21]">
      <div className="mb-4 rounded-full bg-[#25D366]/10 p-4">
        <Target className="h-7 w-7 text-[#25D366]/70" />
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{filtered ? t('empty.filtered') : t('empty.title')}</p>
      {!filtered && <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-[#8696A0]">{t('empty.subtitle')}</p>}
    </div>
  );
}
