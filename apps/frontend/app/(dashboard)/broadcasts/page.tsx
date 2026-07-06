'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Send, Megaphone, Pause, Play, Trash2,
  SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown, X, Info,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useSocket } from '../../../hooks/useSocket';
import { useToast } from '../../../hooks/useToast';
import { useSessionStatus } from '../../../hooks/useSessionStatus';
import { TablePagination } from '../../../components/ui/TablePagination';
import FriendlyError from '../../../components/ui/FriendlyError';
import { classifyError } from '../../../lib/friendly-error';
import { cn } from '../../../lib/utils';

interface Broadcast {
  id: string;
  name: string;
  status: string;
  totalSent: number;
  totalFailed: number;
  createdAt: string;
}

type BroadcastSortKey = 'name' | 'status' | 'totalSent' | 'totalFailed' | 'createdAt';

const STATUS_STYLES: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-[#8696A0]',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  SENDING:   'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  PAUSED:    'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
  SENT:      'bg-green-100 text-green-700 dark:bg-[#25D366]/15 dark:text-[#25D366]',
  FAILED:    'bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300',
};

const STATUS_DOTS: Record<string, string> = {
  DRAFT:     'bg-gray-400',
  SCHEDULED: 'bg-blue-400',
  SENDING:   'bg-amber-400 animate-pulse',
  PAUSED:    'bg-orange-400',
  SENT:      'bg-[#25D366]',
  FAILED:    'bg-red-400',
};

const ALL_STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'SENT', 'FAILED'];

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 text-[#25D366]" />
    : <ArrowDown className="h-3 w-3 text-[#25D366]" />;
}

export default function BroadcastsPage() {
  const router = useRouter();
  const { t } = useTranslation('broadcasts');
  const { t: tErr } = useTranslation('errors');
  const { success, error: toastError } = useToast();
  const { status: waStatus } = useSessionStatus() as { status?: string };

  // Turn a raw send/pause/delete error into a short, friendly toast headline.
  const explainToast = (err: unknown) => toastError(tErr(`friendly.${classifyError(err).code}.title`));

  // ─── data ─────────────────────────────────────────────────────────────────
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading]       = useState(true);

  // ─── row actions ──────────────────────────────────────────────────────────
  const [sendingId, setSendingId]             = useState<string | null>(null);
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [pausingId, setPausingId]             = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── advanced filters ─────────────────────────────────────────────────────
  const [showFilters, setShowFilters]   = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  // ─── sort ─────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<BroadcastSortKey | null>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ─── pagination ───────────────────────────────────────────────────────────
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ─── selection ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting]       = useState(false);

  // ─── Load ─────────────────────────────────────────────────────────────────

  const fetchBroadcasts = useCallback(async () => {
    try {
      const data = await api.get('/api/broadcasts');
      setBroadcasts(Array.isArray(data) ? data : []);
    } catch {
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts]);

  const onBroadcastProgress = useCallback(
    ({ broadcastId, sent, failed }: { broadcastId: string; sent: number; failed: number; total: number }) => {
      setBroadcasts((prev) =>
        prev.map((b) =>
          b.id === broadcastId ? { ...b, totalSent: sent, totalFailed: failed, status: 'SENDING' } : b,
        ),
      );
    },
    [],
  );

  const onBroadcastComplete = useCallback(
    ({ broadcastId, sent, failed, status }: { broadcastId: string; sent: number; failed: number; total: number; status: string }) => {
      setBroadcasts((prev) =>
        prev.map((b) =>
          b.id === broadcastId ? { ...b, totalSent: sent, totalFailed: failed, status } : b,
        ),
      );
    },
    [],
  );

  useSocket('broadcast:progress', onBroadcastProgress);
  useSocket('broadcast:complete', onBroadcastComplete);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const processedBroadcasts = useMemo(() => {
    let data = [...broadcasts];
    if (filterStatus) data = data.filter((b) => b.status === filterStatus);
    if (dateFrom) data = data.filter((b) => new Date(b.createdAt) >= new Date(dateFrom));
    if (dateTo)   data = data.filter((b) => new Date(b.createdAt) <= new Date(dateTo + 'T23:59:59'));
    if (sortKey) {
      data.sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'totalSent' || sortKey === 'totalFailed') {
          cmp = (a[sortKey] as number) - (b[sortKey] as number);
        } else if (sortKey === 'createdAt') {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else {
          cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''));
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [broadcasts, filterStatus, dateFrom, dateTo, sortKey, sortDir]);

  const totalCount = processedBroadcasts.length;

  const paginatedBroadcasts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedBroadcasts.slice(start, start + pageSize);
  }, [processedBroadcasts, page, pageSize]);

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totals = broadcasts.reduce(
    (acc, b) => {
      acc.total += 1;
      acc.sent  += b.totalSent;
      acc.failed += b.totalFailed;
      if (b.status === 'SCHEDULED') acc.scheduled += 1;
      if (b.status === 'SENDING')   acc.sending   += 1;
      if (b.status === 'DRAFT')     acc.drafts    += 1;
      return acc;
    },
    { total: 0, sent: 0, failed: 0, scheduled: 0, sending: 0, drafts: 0 },
  );

  // ─── Sort ─────────────────────────────────────────────────────────────────

  const handleSort = (key: BroadcastSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const SortTh = ({ k, label }: { k: BroadcastSortKey; label: string }) => (
    <th
      scope="col"
      aria-label={label}
      onClick={() => handleSort(k)}
      className={cn(
        'cursor-pointer select-none px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider transition-colors',
        sortKey === k ? 'text-[#25D366]' : 'text-gray-500 dark:text-[#8696A0] hover:text-gray-900 dark:hover:text-white',
      )}
    >
      <span className="flex items-center gap-1.5">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </span>
    </th>
  );

  // ─── Selection ────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pageIds = paginatedBroadcasts.map((b) => b.id);
    const allSel = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSel) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const allPageSelected =
    paginatedBroadcasts.length > 0 && paginatedBroadcasts.every((b) => selectedIds.has(b.id));
  const somePageSelected =
    !allPageSelected && paginatedBroadcasts.some((b) => selectedIds.has(b.id));

  // ─── Row actions ──────────────────────────────────────────────────────────

  const handleSendBroadcast = async (id: string) => {
    try {
      setSendingId(id);
      await api.post(`/api/broadcasts/${id}/send`, {});
      success('Broadcast started sending.');
      await fetchBroadcasts();
    } catch (err) {
      explainToast(err);
    } finally {
      setSendingId(null);
    }
  };

  const handlePauseBroadcast = async (id: string) => {
    try {
      setPausingId(id);
      await api.post(`/api/broadcasts/${id}/pause`, {});
      success('Broadcast paused.');
      await fetchBroadcasts();
    } catch (err) {
      explainToast(err);
    } finally {
      setPausingId(null);
    }
  };

  const handleResumeBroadcast = async (id: string) => {
    try {
      setPausingId(id);
      await api.post(`/api/broadcasts/${id}/resume`, {});
      success('Broadcast resumed.');
      await fetchBroadcasts();
    } catch (err) {
      explainToast(err);
    } finally {
      setPausingId(null);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    const snapshot = broadcasts;
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    setConfirmDeleteId(null);
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setDeletingId(id);
    try {
      await api.delete(`/api/broadcasts/${id}`);
      success('Broadcast deleted.');
      router.refresh();
    } catch (err) {
      setBroadcasts(snapshot);
      explainToast(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const snapshot = broadcasts;
    setBroadcasts((prev) => prev.filter((b) => !selectedIds.has(b.id)));
    try {
      await Promise.allSettled(ids.map((id) => api.delete(`/api/broadcasts/${id}`)));
      success(`${ids.length} broadcast${ids.length !== 1 ? 's' : ''} deleted.`);
    } catch {
      setBroadcasts(snapshot);
      toastError('Some broadcasts could not be deleted.');
    } finally {
      setSelectedIds(new Set());
      setShowBulkConfirm(false);
      setBulkDeleting(false);
    }
  };

  // ─── Derived helpers ──────────────────────────────────────────────────────

  const advancedFilterCount = (filterStatus ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearAdvancedFilters = () => {
    setFilterStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-4 sm:p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,211,102,0.08),transparent_40%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <Megaphone className="h-3.5 w-3.5" />
              {t('badge')}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-[#8696A0]">
              {t('subtitle')}
            </p>
          </div>
          <Link
            href="/broadcasts/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-[#25D366]/90 transition-colors self-start lg:self-auto"
          >
            <Plus className="h-4 w-4" />
            {t('newBroadcast')}
          </Link>
        </div>
      </section>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={t('stats.totalBroadcasts')} value={totals.total}    sub={t('stats.allCampaigns')} />
        <StatCard label={t('stats.messagesSent')}    value={totals.sent}     sub={t('stats.cumulativeDeliveries')} highlight />
        <StatCard label={t('stats.failed')}          value={totals.failed}   sub={t('stats.sendFailures')} error={totals.failed > 0} />
        <StatCard
          label={t('stats.inFlight')}
          value={totals.scheduled + totals.sending + totals.drafts}
          sub={t('stats.inFlightSub')}
          pulse={totals.sending > 0}
        />
      </div>

      {/* ── Why did messages fail? — friendly, actionable explanation ── */}
      {totals.failed > 0 && (
        waStatus === 'disconnected' ? (
          <FriendlyError classified={{ code: 'whatsappDisconnected', severity: 'error', values: {}, raw: '' }} />
        ) : (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/[0.07]">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <Info className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {t('failureInsight.title', { count: totals.failed })}
                </p>
                <p className="mt-0.5 text-[13px] text-amber-800/90 dark:text-amber-300/80">
                  {t('failureInsight.intro')}
                </p>
                <ul className="mt-2 space-y-1 text-[13px] text-amber-800/90 dark:text-amber-300/80">
                  {['reasonNotOnWhatsapp', 'reasonWarmup', 'reasonDisconnected', 'reasonInvalid'].map((k) => (
                    <li key={k} className="flex gap-2">
                      <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                      <span>{t(`failureInsight.${k}`)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[13px] font-medium text-amber-900 dark:text-amber-200">
                  {t('failureInsight.tip')}
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Table ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            {/* Mobile select-all checkbox */}
            <label className="flex items-center gap-2 sm:hidden cursor-pointer">
              <input
                type="checkbox"
                checked={allPageSelected}
                ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer rounded border-white/20 accent-[#25D366]"
              />
            </label>
            <p className="text-xs text-gray-500 dark:text-[#8696A0]">
              {totalCount} {totalCount === 1 ? t('table.name').toLowerCase() : t('title').toLowerCase()}
              {selectedIds.size > 0 && (
                <span className="ms-2 font-medium text-[#25D366]">· {selectedIds.size}</span>
              )}
            </p>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-500 dark:text-[#8696A0] hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {t('common:actions.deselectAll')}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((f) => !f)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors',
              showFilters || advancedFilterCount > 0
                ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366]'
                : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/10',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common:actions.filter')}</span>
            {advancedFilterCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-slate-950">
                {advancedFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div className="border-b border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-[#0B141A] px-4 sm:px-6 py-4">
            <div className="flex flex-wrap items-end gap-3 sm:gap-4">
              <div className="w-full sm:w-auto">
                <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-[#8696A0]">{t('common:labels.status')}</p>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="h-9 w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#16A34A]/50 dark:border-white/10 dark:bg-[#202C33] dark:text-white dark:focus:border-[#25D366]/50"
                >
                  <option value="">{t('allStatuses')}</option>
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-[#8696A0]">{t('createdFrom')}</p>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-9 w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#16A34A]/50 dark:border-white/10 dark:bg-[#202C33] dark:text-white dark:focus:border-[#25D366]/50"
                />
              </div>
              <div className="w-full sm:w-auto">
                <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-[#8696A0]">{t('createdTo')}</p>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-9 w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#16A34A]/50 dark:border-white/10 dark:bg-[#202C33] dark:text-white dark:focus:border-[#25D366]/50"
                />
              </div>
              {advancedFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 px-3 text-sm text-gray-500 dark:text-[#8696A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> {t('clearFilters')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Mobile card list (hidden on sm+) ── */}
        <div className="sm:hidden divide-y divide-gray-100 dark:divide-white/5">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse px-4 py-4 space-y-2">
                <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-white/8" />
                <div className="h-5 w-20 rounded-full bg-gray-100 dark:bg-white/8" />
                <div className="flex gap-4">
                  <div className="h-3 w-14 rounded bg-gray-50 dark:bg-white/5" />
                  <div className="h-3 w-14 rounded bg-gray-50 dark:bg-white/5" />
                </div>
              </div>
            ))
          ) : paginatedBroadcasts.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <Megaphone className="mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-[#8696A0]/30" />
              <p className="text-sm text-gray-500 dark:text-[#8696A0]">
                {advancedFilterCount > 0 ? t('noResults') : t('noBroadcasts')}
              </p>
              {advancedFilterCount > 0 ? (
                <button type="button" onClick={clearAdvancedFilters} className="mt-2 text-xs text-[#25D366] hover:underline">{t('clearFilters')}</button>
              ) : (
                <Link href="/broadcasts/new" className="mt-2 inline-flex items-center gap-1 text-xs text-[#25D366] hover:underline">
                  <Plus className="h-3 w-3" /> {t('noBroadcastsSubtitle')}
                </Link>
              )}
            </div>
          ) : (
            paginatedBroadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                className={cn(
                  'px-4 py-3 transition-colors',
                  selectedIds.has(broadcast.id) && 'bg-[#25D366]/8',
                )}
              >
                {/* top row: checkbox + name + status */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(broadcast.id)}
                    onChange={() => toggleSelect(broadcast.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 accent-[#25D366]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{broadcast.name}</p>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_STYLES[broadcast.status] ?? STATUS_STYLES.DRAFT)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[broadcast.status] ?? 'bg-gray-400')} />
                        {t(`status.${broadcast.status}`, { defaultValue: broadcast.status })}
                      </span>
                    </div>
                    {/* meta row */}
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 dark:text-[#8696A0]">
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" /> {broadcast.totalSent}
                      </span>
                      {broadcast.totalFailed > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <X className="h-3 w-3" /> {broadcast.totalFailed}
                        </span>
                      )}
                      <span>{new Date(broadcast.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {/* action row */}
                    <div className="mt-2.5">
                      {confirmDeleteId === broadcast.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-300">{t('deleteConfirm.title')}</span>
                          <button type="button" onClick={() => handleDeleteBroadcast(broadcast.id)} className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white">{t('common:yes')}</button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-gray-200 dark:border-white/10 px-2.5 py-1 text-xs text-gray-700 dark:text-white">{t('common:no')}</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/broadcasts/${broadcast.id}/edit`} className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs text-gray-700 dark:text-white">
                            {t('common:actions.edit')}
                          </Link>
                          {broadcast.status === 'SENDING' && (
                            <button type="button" onClick={() => handlePauseBroadcast(broadcast.id)} disabled={pausingId === broadcast.id} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                              <Pause className="h-3.5 w-3.5" /> {t('status.PAUSED')}
                            </button>
                          )}
                          {broadcast.status === 'PAUSED' && (
                            <button type="button" onClick={() => handleResumeBroadcast(broadcast.id)} disabled={pausingId === broadcast.id} className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                              <Play className="h-3.5 w-3.5" /> {t('status.RUNNING')}
                            </button>
                          )}
                          {(broadcast.status === 'DRAFT' || broadcast.status === 'SCHEDULED') && (
                            <button type="button" onClick={() => handleSendBroadcast(broadcast.id)} disabled={sendingId === broadcast.id} className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50">
                              <Send className="h-3.5 w-3.5" />
                              {sendingId === broadcast.id ? t('status.SENDING') : t('common:actions.send')}
                            </button>
                          )}
                          <button type="button" onClick={() => setConfirmDeleteId(broadcast.id)} disabled={deletingId === broadcast.id} className="rounded-lg border border-red-400/20 bg-red-400/8 p-1.5 text-red-400 disabled:opacity-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop table (hidden on mobile) ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33]">
                <th scope="col" className="w-10 px-6 py-4">
                  <span className="sr-only">Select</span>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-white/20 accent-[#25D366]"
                  />
                </th>
                <SortTh k="name"        label={t('table.name')} />
                <SortTh k="status"      label={t('table.status')} />
                <SortTh k="totalSent"   label={t('table.sent')} />
                <SortTh k="totalFailed" label={t('table.failed')} />
                <SortTh k="createdAt"   label={t('table.created')} />
                <th scope="col" className="px-6 py-4"><span className="sr-only">{t('table.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-4 rounded bg-gray-100 dark:bg-white/8" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-40 rounded bg-gray-100 dark:bg-white/8" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-20 rounded-full bg-gray-100 dark:bg-white/8" /></td>
                    <td className="px-6 py-4"><div className="h-3 w-8 rounded bg-gray-50 dark:bg-white/5" /></td>
                    <td className="px-6 py-4"><div className="h-3 w-8 rounded bg-gray-50 dark:bg-white/5" /></td>
                    <td className="px-6 py-4"><div className="h-3 w-20 rounded bg-gray-50 dark:bg-white/5" /></td>
                    <td className="px-6 py-4"><div className="h-7 w-24 rounded bg-gray-50 dark:bg-white/5" /></td>
                  </tr>
                ))
              ) : paginatedBroadcasts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Megaphone className="mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-[#8696A0]/30" />
                    <p className="text-sm text-gray-500 dark:text-[#8696A0]">
                      {advancedFilterCount > 0 ? t('noResults') : t('noBroadcasts')}
                    </p>
                    {advancedFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={clearAdvancedFilters}
                        className="mt-2 text-xs text-[#25D366] hover:underline"
                      >
                        {t('clearFilters')}
                      </button>
                    ) : (
                      <Link
                        href="/broadcasts/new"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#25D366] hover:underline"
                      >
                        <Plus className="h-3 w-3" /> {t('noBroadcastsSubtitle')}
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedBroadcasts.map((broadcast) => (
                  <tr
                    key={broadcast.id}
                    className={cn(
                      'group transition-colors hover:bg-gray-50 dark:hover:bg-white/3',
                      selectedIds.has(broadcast.id) && 'bg-[#25D366]/8',
                    )}
                  >
                    <td className="px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(broadcast.id)}
                        onChange={() => toggleSelect(broadcast.id)}
                        className="h-4 w-4 cursor-pointer rounded border-white/20 accent-[#25D366]"
                      />
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{broadcast.name}</td>
                    <td className="px-6 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[broadcast.status] ?? STATUS_STYLES.DRAFT)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[broadcast.status] ?? 'bg-gray-400')} />
                        {t(`status.${broadcast.status}`, { defaultValue: broadcast.status })}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500 dark:text-[#8696A0]">{broadcast.totalSent}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 dark:text-[#8696A0]">{broadcast.totalFailed}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 dark:text-[#8696A0]">
                      {new Date(broadcast.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-3">
                      {confirmDeleteId === broadcast.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-300">{t('deleteConfirm.title')}</span>
                          <button type="button" onClick={() => handleDeleteBroadcast(broadcast.id)} className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-colors">{t('common:yes')}</button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-2.5 py-1 text-xs text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">{t('common:no')}</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/broadcasts/${broadcast.id}/edit`}
                            className="inline-flex items-center rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                          >
                            {t('common:actions.edit')}
                          </Link>
                          {broadcast.status === 'SENDING' && (
                            <button type="button" onClick={() => handlePauseBroadcast(broadcast.id)} disabled={pausingId === broadcast.id} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
                              <Pause className="h-3.5 w-3.5" /> {t('status.PAUSED')}
                            </button>
                          )}
                          {broadcast.status === 'PAUSED' && (
                            <button type="button" onClick={() => handleResumeBroadcast(broadcast.id)} disabled={pausingId === broadcast.id} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
                              <Play className="h-3.5 w-3.5" /> {t('status.RUNNING')}
                            </button>
                          )}
                          {(broadcast.status === 'DRAFT' || broadcast.status === 'SCHEDULED') && (
                            <button type="button" onClick={() => handleSendBroadcast(broadcast.id)} disabled={sendingId === broadcast.id} className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-[#25D366]/90 disabled:opacity-50 transition-colors">
                              <Send className="h-3.5 w-3.5" />
                              {sendingId === broadcast.id ? t('status.SENDING') : t('common:actions.send')}
                            </button>
                          )}
                          <button type="button" onClick={() => setConfirmDeleteId(broadcast.id)} disabled={deletingId === broadcast.id} className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 bg-red-400/8 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-400/15 disabled:opacity-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-[var(--bottom-nav-space)] sm:bottom-6 left-1/2 z-40 -translate-x-1/2 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {t('selectedCount', { count: selectedIds.size })}
          </span>
          <div className="h-5 w-px bg-gray-200 dark:bg-white/15" />
          {showBulkConfirm ? (
            <>
              <span className="text-xs text-red-300">{t('deleteConfirm.title')} {selectedIds.size}?</span>
              <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                {bulkDeleting ? t('status.SENDING') : t('deleteConfirm.confirm')}
              </button>
              <button type="button" onClick={() => setShowBulkConfirm(false)} className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs text-gray-500 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                {t('deleteConfirm.cancel')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setShowBulkConfirm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> {t('common:actions.bulkDelete')}
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs text-gray-500 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                {t('common:actions.deselectAll')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Mobile bottom-nav spacer */}
      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />
    </div>
  );
}

function StatCard({
  label, value, sub, highlight, error, pulse,
}: {
  label: string; value: number; sub: string;
  highlight?: boolean; error?: boolean; pulse?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-3 sm:p-5">
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.22em] text-gray-500 dark:text-[#8696A0] truncate">{label}</p>
      <div className="mt-1.5 sm:mt-2 flex items-center gap-2">
        <p className={cn('text-2xl sm:text-3xl font-semibold', highlight ? 'text-[#25D366]' : error ? 'text-red-400' : 'text-gray-900 dark:text-white')}>
          {value}
        </p>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-[#8696A0] truncate">{sub}</p>
    </div>
  );
}
