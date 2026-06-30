'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Upload, MessageSquare, Send, Users, LayoutTemplate, TrendingUp, Tag, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { useSocket } from '../../../hooks/useSocket';
import KpiCards from '../../../components/dashboard/donezo/KpiCards';
import MessagesChart from '../../../components/dashboard/MessagesChart';
import SessionStatusWidget from '../../../components/dashboard/SessionStatusWidget';
import Reminders from '../../../components/dashboard/donezo/Reminders';
import AgentCollaboration from '../../../components/dashboard/donezo/AgentCollaboration';
import ProgressGauge from '../../../components/dashboard/donezo/ProgressGauge';
import UptimeTracker from '../../../components/dashboard/donezo/UptimeTracker';
import RecentConversations from '../../../components/dashboard/RecentConversations';

interface OverviewData {
  totalContacts: number;
  openConversations: number;
  todayMessages: number;
  hotLeads: number;
}

interface AgentStat {
  agentId: string;
  name: string;
  email: string;
  openConversations: number;
  resolvedConversations: number;
  avgFirstResponseMin: number | null;
}

interface PipelineStats {
  stages: { stage: string; count: number; value: number }[];
  totalDeals: number;
  totalValue: number;
  closedDeals: number;
  conversionRate: number;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];

const GLASS = 'rounded-[20px] bg-white/80 backdrop-blur-xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.05)] dark:bg-[#182229] dark:border-transparent dark:shadow-[0_4px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]';

const QUICK_NAV_ITEMS = [
  {
    href: '/leads',
    labelKey: 'quickNav.leads',
    subKey:   'quickNav.leadsSub',
    Icon: TrendingUp,
    iconClass:   'bg-gradient-to-br from-violet-500 to-purple-600',
    iconShadow:  'shadow-[0_4px_14px_rgba(124,58,237,0.5)]',
    glowClass:   'bg-violet-400',
    topLine:     'bg-violet-400',
    hoverShadow: 'group-hover:shadow-[0_12px_40px_rgba(124,58,237,0.2)] dark:group-hover:shadow-[0_12px_40px_rgba(139,92,246,0.25)]',
    accentText:  'text-violet-600 dark:text-violet-400',
    arrowColor:  'text-violet-500 dark:text-violet-400',
  },
  {
    href: '/templates',
    labelKey: 'quickNav.templates',
    subKey:   'quickNav.templatesSub',
    Icon: LayoutTemplate,
    iconClass:   'bg-gradient-to-br from-sky-500 to-blue-600',
    iconShadow:  'shadow-[0_4px_14px_rgba(14,165,233,0.5)]',
    glowClass:   'bg-sky-400',
    topLine:     'bg-sky-400',
    hoverShadow: 'group-hover:shadow-[0_12px_40px_rgba(14,165,233,0.2)] dark:group-hover:shadow-[0_12px_40px_rgba(56,189,248,0.25)]',
    accentText:  'text-sky-600 dark:text-sky-400',
    arrowColor:  'text-sky-500 dark:text-sky-400',
  },
  {
    href: '/tags',
    labelKey: 'quickNav.tags',
    subKey:   'quickNav.tagsSub',
    Icon: Tag,
    iconClass:   'bg-gradient-to-br from-amber-500 to-orange-500',
    iconShadow:  'shadow-[0_4px_14px_rgba(245,158,11,0.5)]',
    glowClass:   'bg-amber-400',
    topLine:     'bg-amber-400',
    hoverShadow: 'group-hover:shadow-[0_12px_40px_rgba(245,158,11,0.2)] dark:group-hover:shadow-[0_12px_40px_rgba(251,191,36,0.25)]',
    accentText:  'text-amber-600 dark:text-amber-500',
    arrowColor:  'text-amber-500 dark:text-amber-400',
  },
] as const;

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading dashboard">
      <div className="h-10 w-1/2 rounded-2xl bg-gray-200 dark:bg-white/8" />
      {/* Mobile quick actions placeholder */}
      <div className="grid grid-cols-4 gap-2 lg:hidden">
        {[...Array(4)].map((_, i) => <div key={i} className={`h-20 ${GLASS}`} />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className={`h-36 ${GLASS}`} />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`h-72 ${GLASS} lg:col-span-8`} />
        <div className={`h-72 ${GLASS} lg:col-span-4`} />
        <div className={`h-48 ${GLASS} lg:col-span-3`} />
        <div className={`h-48 ${GLASS} lg:col-span-5`} />
        <div className={`h-48 ${GLASS} lg:col-span-4`} />
        <div className={`h-60 ${GLASS} lg:col-span-8`} />
        <div className={`h-60 ${GLASS} lg:col-span-4`} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { data: session } = useSession();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [messagesData, setMessagesData] = useState<any[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role = (session?.user as any)?.role ?? 'AGENT';
  const isAdmin = ADMIN_ROLES.includes(role);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewData, msgData, , agentData, pipelineData] = await Promise.all([
        api.get('/api/analytics/overview'),
        api.get('/api/analytics/messages'),
        api.get('/api/whatsapp/status').catch(() => null),
        api.get('/api/analytics/agents').catch(() => []),
        api.get('/api/analytics/pipeline').catch(() => null),
      ]);
      setOverview(overviewData);
      setMessagesData(msgData);
      setAgentStats(Array.isArray(agentData) ? agentData : []);
      setPipelineStats(pipelineData?.totalDeals !== undefined ? pipelineData : null);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const onMessageNew = useCallback((data: { isNewContact?: boolean }) => {
    setOverview((prev) => prev ? {
      ...prev,
      todayMessages: prev.todayMessages + 1,
      ...(data.isNewContact ? { totalContacts: prev.totalContacts + 1 } : {}),
    } : prev);
  }, []);

  const onConversationUpdated = useCallback((data: { status?: string }) => {
    if (!data.status) return;
    setOverview((prev) => prev ? (
      data.status === 'OPEN'
        ? { ...prev, openConversations: prev.openConversations + 1 }
        : { ...prev, openConversations: Math.max(0, prev.openConversations - 1) }
    ) : prev);
  }, []);

  useSocket('message:new', onMessageNew);
  useSocket('conversation:updated', onConversationUpdated);

  if (loading && !overview) return <Skeleton />;

  const totalResolved = agentStats.reduce((s, a) => s + a.resolvedConversations, 0);
  const totalOpen = agentStats.reduce((s, a) => s + a.openConversations, 0);
  let gaugePercent = 0;
  if (totalResolved + totalOpen > 0) gaugePercent = (totalResolved / (totalResolved + totalOpen)) * 100;
  else if (pipelineStats && pipelineStats.totalDeals > 0) gaugePercent = pipelineStats.conversionRate;

  const gaugeLegend = [
    { label: t('collab.completed'), swatch: 'bg-[#16A34A] dark:bg-[#25D366]' },
    { label: t('collab.inProgress'), swatch: 'bg-[#8ad3ab] dark:bg-[#1fa85a]' },
    { label: t('collab.pending'), swatch: 'dz-hatch border border-gray-300 dark:border-white/20' },
  ];

  return (
    <div className="relative space-y-4">
      {/* Ambient gradient blobs — visible through glass cards */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
        <div className="absolute -top-20 right-0 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl dark:bg-[#25D366]/6" />
        <div className="absolute top-1/3 -left-16 h-64 w-64 rounded-full bg-sky-200/25 blur-3xl dark:bg-blue-500/4" />
        <div className="absolute bottom-20 right-1/3 h-52 w-52 rounded-full bg-violet-200/20 blur-3xl dark:bg-violet-500/3" />
      </div>

      {/* ── Hero card (hidden on mobile) ──────────────────────────────────── */}
      <div className="hidden sm:block relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.06)] p-5 sm:p-6 dark:bg-[#0d1a14] dark:border-white/[0.07] dark:shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
        {/* Top shimmer line */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#25D366]/40 to-transparent dark:via-[#25D366]/55" />

        {/* Corner glows */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
          <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-[#25D366]/6 blur-3xl dark:bg-[#25D366]/12" />
          <div className="absolute -left-8 bottom-0 h-36 w-44 rounded-full bg-blue-400/5 blur-3xl dark:bg-blue-500/7" />
        </div>

        {/* Subtle dot-grid texture */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.018] dark:opacity-[0.025] hero-dot-grid" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#16A34A]/20 bg-[#16A34A]/8 px-2.5 py-1 text-[11px] font-semibold text-[#16A34A] dark:border-[#25D366]/25 dark:bg-[#25D366]/10 dark:text-[#25D366]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse dark:bg-[#25D366]" />
              {t('badge', { defaultValue: 'Live' })}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-white/40">{t('tagline')}</p>
          </div>

          <div className="flex gap-2 sm:shrink-0">
            <Link
              href="/broadcasts/new"
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.30)] transition-all hover:bg-[#15803D] hover:shadow-[0_6px_20px_rgba(22,163,74,0.40)] active:scale-95 dark:bg-[#25D366] dark:shadow-[0_4px_16px_rgba(37,211,102,0.35)] dark:hover:bg-[#22c55e] dark:hover:shadow-[0_6px_22px_rgba(37,211,102,0.45)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('newBroadcast')}
            </Link>
            <Link
              href="/contacts"
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300 active:scale-95 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70 dark:hover:bg-white/[0.09] dark:hover:text-white dark:hover:border-white/18"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t('importContacts')}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && !overview && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          <p className="font-medium">{error}</p>
          <button type="button" onClick={() => void fetchData()} className="mt-2 text-xs font-semibold underline underline-offset-2">
            {tCommon('retry')}
          </button>
        </div>
      )}

      {/* ── Mobile Quick Actions (tablet only: sm → lg) ──────────────────── */}
      <div className="hidden sm:grid sm:grid-cols-4 gap-2 lg:hidden">
        {[
          { href: '/conversations', Icon: MessageSquare, label: 'Inbox' },
          { href: '/broadcasts/new', Icon: Send, label: 'Broadcast' },
          { href: '/contacts', Icon: Users, label: 'Contacts' },
          { href: '/templates', Icon: LayoutTemplate, label: 'Templates' },
        ].map(({ href, Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(GLASS, 'flex flex-col items-center gap-2 p-3 transition-all active:scale-95 select-none')}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16A34A]/10 dark:bg-[#25D366]/10">
              <Icon className="h-5 w-5 text-[#16A34A] dark:text-[#25D366]" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold text-gray-700 dark:text-white">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      {overview && <KpiCards data={overview} />}

      {/* ── Quick Navigate (hidden on desktop) ───────────────────────────── */}
      <div className="lg:hidden">
        <p className="mb-2.5 ps-0.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
          {t('quickNav.title')}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_NAV_ITEMS.map(({ href, labelKey, subKey, Icon, iconClass, iconShadow, glowClass, topLine, hoverShadow, accentText, arrowColor }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                GLASS,
                'group relative flex flex-col gap-3 overflow-hidden p-3.5 sm:p-4',
                'transition-all duration-300 ease-out',
                '-translate-y-0 hover:-translate-y-[3px]',
                hoverShadow,
                'active:scale-[0.97] active:translate-y-0',
                'select-none',
              )}
            >
              {/* Top accent line — slides in on hover */}
              <div className={cn(
                'pointer-events-none absolute inset-x-0 top-0 h-[2px] origin-center scale-x-0 rounded-full opacity-70 transition-transform duration-300 group-hover:scale-x-100',
                topLine,
              )} />

              {/* Corner glow blob */}
              <div className={cn(
                'pointer-events-none absolute -end-5 -top-5 h-[72px] w-[72px] rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-30 dark:group-hover:opacity-20',
                glowClass,
              )} />

              {/* Icon */}
              <div className={cn(
                'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-[13px] transition-transform duration-300 group-hover:scale-110',
                iconClass,
                iconShadow,
              )}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" aria-hidden="true" />
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] sm:text-[13px] font-bold leading-snug text-gray-900 dark:text-white">
                  {t(labelKey)}
                </p>
                <p className="mt-0.5 hidden sm:block text-[11px] leading-snug text-gray-400 dark:text-white/35 line-clamp-1">
                  {t(subKey)}
                </p>
              </div>

              {/* Open label + arrow */}
              <div className="flex items-center justify-between gap-1">
                <span className={cn('text-[10px] sm:text-[11px] font-semibold', accentText)}>
                  {t('quickNav.open')}
                </span>
                <ArrowUpRight className={cn(
                  'h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform duration-200',
                  'group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
                  arrowColor,
                )} aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Dashboard grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

        {/* Row 1 — Chart (primary) + Session widget */}
        <div className="lg:col-span-8">
          <MessagesChart data={messagesData} />
        </div>
        <div className="lg:col-span-4">
          <SessionStatusWidget />
        </div>

        {/* Row 2 — Reminders + Agent leaderboard + Recent conversations */}
        <div className="lg:col-span-3">
          <Reminders openCount={overview?.openConversations ?? 0} />
        </div>
        <div className="lg:col-span-5">
          <AgentCollaboration agents={agentStats} isAdmin={isAdmin} />
        </div>
        <div className="lg:col-span-4">
          <RecentConversations />
        </div>

        {/* Row 3 — Resolution gauge + Uptime tracker */}
        <div className="lg:col-span-8">
          <ProgressGauge percent={gaugePercent} caption={t('progress.caption')} legend={gaugeLegend} />
        </div>
        <div className="lg:col-span-4">
          <UptimeTracker />
        </div>

      </div>
    </div>
  );
}
