'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Bell, AlertTriangle, ShoppingCart, TrendingUp, Check,
  RefreshCw, Flame, UserRound, X, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useNotifications, type AppNotification, type NotificationType } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/useToast';

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  BUYING_INTENT: ShoppingCart,
  NEEDS_ATTENTION: AlertTriangle,
  STATUS_UPGRADE: TrendingUp,
};

const TYPE_COLOR: Record<NotificationType, { dot: string; icon: string; bg: string }> = {
  BUYING_INTENT:  { dot: 'bg-[#25D366]',  icon: 'text-[#25D366]',  bg: 'bg-[#25D366]/10' },
  NEEDS_ATTENTION:{ dot: 'bg-red-400',    icon: 'text-red-400',    bg: 'bg-red-500/10'   },
  STATUS_UPGRADE: { dot: 'bg-amber-400',  icon: 'text-amber-400',  bg: 'bg-amber-500/10' },
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? '#ef4444' : s >= 65 ? '#f59e0b' : '#25D366';

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return '·';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface HotLead {
  id: string;
  status: string;
  score: number;
  contactId: string;
  conversationId: string | null;
  contact: { name: string | null; phone: string } | null;
}

export default function NotificationBell() {
  const router = useRouter();
  const { t, i18n } = useTranslation('leads');
  const { t: tCommon } = useTranslation('common');
  const isAr = i18n.language.startsWith('ar');
  const { items, unread, markRead, markAllRead } = useNotifications();
  const { success, error: toastError } = useToast();

  const [open, setOpen]           = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hotLeads, setHotLeads]   = useState<HotLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchHotLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const data = await api.get('/api/leads?status=HOT,QUALIFIED&limit=6');
      setHotLeads(Array.isArray(data) ? data : []);
    } catch { setHotLeads([]); }
    finally  { setLoadingLeads(false); }
  }, []);

  useEffect(() => { if (open) fetchHotLeads(); }, [open, fetchHotLeads]);

  useSocket('lead:updated', useCallback(() => {
    if (open) fetchHotLeads();
  }, [open, fetchHotLeads]));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown',   onKey);
    };
  }, [open]);

  const refreshAlerts = async () => {
    setRefreshing(true);
    try {
      const result = await api.post('/api/leads/refresh-alerts', {});
      success(result.alertCount > 0
        ? t('toast.alertsSent', { count: result.alertCount })
        : t('toast.noUnhandled'));
    } catch { toastError(t('toast.refreshFailed')); }
    finally  { setRefreshing(false); }
  };

  const pick = (pair: { en: string; ar: string } | null | undefined) =>
    pair ? (isAr ? pair.ar || pair.en : pair.en || pair.ar) : '';

  const handleNotifClick = (n: AppNotification) => {
    if (!n.isRead) void markRead(n.id);
    setOpen(false);
    router.push(n.conversationId
      ? `/conversations?conversationId=${encodeURIComponent(n.conversationId)}`
      : '/leads');
  };

  const openLead = (lead: HotLead) => {
    setOpen(false);
    if (lead.conversationId)    router.push(`/conversations?conversationId=${encodeURIComponent(lead.conversationId)}`);
    else if (lead.contact?.phone) router.push(`/conversations?phone=${encodeURIComponent(lead.contact.phone)}`);
    else                         router.push('/leads');
  };

  const hasContent = loadingLeads || hotLeads.length > 0 || items.length > 0;

  return (
    <div className="relative" ref={ref}>

      {/* ── Bell trigger ──────────────────────────────── */}
      <button
        type="button"
        aria-label={tCommon('header.notifications')}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative rounded-xl p-2 transition-all duration-150',
          open
            ? 'bg-[#25D366]/10 text-[#25D366]'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]',
        )}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 px-1 text-[9px] font-black text-white ring-2 ring-white dark:ring-[#111B21] shadow-sm">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ────────────────────────────── */}
      {open && (
        <div
          className={cn(
            // Base
            'z-[9999] flex flex-col overflow-hidden rounded-2xl shadow-2xl',
            'border border-black/[0.06] dark:border-white/[0.08]',
            'bg-white/[0.98] dark:bg-[#111B21]/[0.98] backdrop-blur-2xl',
            // Mobile: fixed compact card, end-aligned so it doesn't fill the screen
            'fixed top-[64px] w-[min(340px,calc(100vw-24px))]',
            isAr ? 'left-3' : 'right-3',
            // ≥640 px: absolute dropdown below the bell
            'sm:fixed-none sm:absolute sm:top-auto sm:left-auto sm:right-auto sm:mt-2 sm:w-[340px]',
            isAr ? 'sm:start-0' : 'sm:end-0',
          )}
        >
          {/* ── Header ────────────────────────────────── */}
          <div className="relative flex items-center justify-between px-4 py-3">
            {/* left accent bar */}
            <div className="absolute start-0 top-[20%] h-[60%] w-[3px] rounded-e-full bg-gradient-to-b from-[#25D366] to-[#128C7E]" />
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-[#25D366]" />
              <p className="text-[13px] font-bold tracking-tight text-gray-900 dark:text-white">
                {t('notifications.title')}
              </p>
              {unread > 0 && (
                <span className="rounded-full bg-[#25D366]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#25D366]">
                  {unread}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {items.some((n) => !n.isRead) && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  title={t('notifications.markAllRead')}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={refreshAlerts}
                disabled={refreshing}
                title={refreshing ? t('refreshing') : t('refreshAlerts')}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable body ───────────────────────── */}
          <div className="max-h-[min(60vh,480px)] overflow-y-auto overscroll-contain divide-y divide-black/[0.04] dark:divide-white/[0.05]">

            {/* Hot / Qualified leads */}
            {(loadingLeads || hotLeads.length > 0) && (
              <div className="px-3 py-2.5">
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <Flame className="h-3 w-3 text-red-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#8696A0]">
                    {t('tabs.hot')}
                  </p>
                </div>

                {loadingLeads ? (
                  <div className="space-y-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex animate-pulse items-center gap-2.5 rounded-xl p-2">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 dark:bg-white/8" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2.5 w-2/5 rounded bg-gray-200 dark:bg-white/8" />
                          <div className="h-2 w-1/4 rounded bg-gray-100 dark:bg-white/5" />
                        </div>
                        <div className="h-6 w-8 shrink-0 rounded-lg bg-gray-200 dark:bg-white/8" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {hotLeads.map((lead) => {
                      const name = lead.contact?.name || lead.contact?.phone || '—';
                      const isPhone = !lead.contact?.name && (lead.contact?.phone ?? '').startsWith('+');
                      const isHot = lead.status === 'HOT';
                      const statusLabel = isAr
                        ? (isHot ? 'عميل ساخن' : 'مؤهل')
                        : (isHot ? 'Hot Lead'  : 'Qualified');
                      const color = SCORE_COLOR(lead.score);

                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => openLead(lead)}
                          className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-start transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                          {/* Avatar with score ring */}
                          <div className="relative shrink-0">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black"
                              style={{ background: `${color}18`, color }}
                            >
                              {isPhone
                                ? <UserRound className="h-4 w-4" />
                                : name.charAt(0).toUpperCase()}
                            </div>
                            <span
                              className="absolute -bottom-0.5 -end-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-black text-white ring-[1.5px] ring-white dark:ring-[#111B21]"
                              style={{ background: color }}
                            >
                              {isHot ? '🔥' : '✓'}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-semibold text-gray-900 dark:text-white">
                              {isPhone
                                ? <span dir="ltr">{'‎'}{name}</span>
                                : <bdi>{name}</bdi>}
                            </p>
                            <p className="text-[10px] font-medium" style={{ color }}>
                              {statusLabel}
                            </p>
                          </div>

                          {/* Score badge */}
                          <span
                            className="shrink-0 rounded-lg px-1.5 py-0.5 text-[11px] font-black tabular-nums"
                            style={{ background: `${color}18`, color }}
                          >
                            {lead.score}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Notification events */}
            {items.length > 0 && (
              <div className="py-1.5">
                {hotLeads.length > 0 && (
                  <p className="px-4 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#8696A0]">
                    {t('notifications.title')}
                  </p>
                )}
                {items.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Bell;
                  const tone = TYPE_COLOR[n.type] ?? { dot: 'bg-gray-400', icon: 'text-gray-400', bg: 'bg-gray-400/10' };
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotifClick(n)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-2.5 text-start transition-colors hover:bg-gray-50 dark:hover:bg-white/5',
                        !n.isRead && 'bg-[#25D366]/[0.04]',
                      )}
                    >
                      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl', tone.bg)}>
                        <Icon className={cn('h-3.5 w-3.5', tone.icon)} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-gray-900 dark:text-white">
                          {pick(n.title)}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-gray-500 dark:text-[#8696A0]">
                            {pick(n.body)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                        <span className="text-[10px] text-gray-400 dark:text-[#8696A0]/50">{timeAgo(n.createdAt)}</span>
                        {!n.isRead && <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!hasContent && (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5">
                  <Bell className="h-5 w-5 text-gray-300 dark:text-[#8696A0]/50" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-white">{t('notifications.empty')}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-[#8696A0]/60">{t('notifications.emptyHint')}</p>
              </div>
            )}
          </div>

          {/* ── Footer ────────────────────────────────── */}
          <button
            type="button"
            onClick={() => { setOpen(false); router.push('/leads'); }}
            className="flex w-full items-center justify-center gap-1.5 border-t border-black/[0.04] dark:border-white/[0.05] px-4 py-2.5 text-[12px] font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/5"
          >
            {t('notifications.viewAll')}
            <ChevronRight className={cn('h-3.5 w-3.5', isAr && 'rotate-180')} />
          </button>
        </div>
      )}
    </div>
  );
}
