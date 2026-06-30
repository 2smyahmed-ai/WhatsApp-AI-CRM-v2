'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BriefcaseBusiness, Plus, Pencil, Trash2, ChevronRight, X,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { useSocket } from '../../../hooks/useSocket';
import { useToast } from '../../../hooks/useToast';
import { cn } from '../../../lib/utils';

type Stage = 'NEW' | 'INTERESTED' | 'NEGOTIATION' | 'CLOSED';

type Deal = {
  id: string;
  title: string;
  contactId?: string | null;
  ownerId?: string | null;
  stage: Stage;
  value: number;
  notes?: string | null;
  updatedAt: string;
  contact?: { name?: string | null; phone: string };
  owner?: { name?: string | null; email: string };
};

type ContactOption = { id: string; name: string | null; phone: string };
type MemberOption  = { id: string; name: string | null; email: string };

const STAGES: Stage[] = ['NEW', 'INTERESTED', 'NEGOTIATION', 'CLOSED'];

const STAGE_CFG: Record<Stage, {
  bar: string;
  badge: string;
}> = {
  NEW:         { bar: 'bg-blue-500',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20'      },
  INTERESTED:  { bar: 'bg-violet-500', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  NEGOTIATION: { bar: 'bg-amber-500',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20'    },
  CLOSED:      { bar: 'bg-[#25D366]',  badge: 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20'   },
};

function timeAgo(iso: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('timeAgo.justNow');
  if (min < 60) return t('timeAgo.minutesAgo', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('timeAgo.hoursAgo', { count: h });
  return t('timeAgo.daysAgo', { count: Math.floor(h / 24) });
}

function initial(s?: string | null): string {
  return (s ?? '?').charAt(0).toUpperCase();
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#202C33]/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-2/3 rounded-md bg-gray-100 dark:bg-white/8" />
        <div className="h-5 w-16 rounded-full bg-gray-50 dark:bg-white/5" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-white/8" />
        <div className="h-3 w-1/2 rounded-md bg-gray-50 dark:bg-white/5" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-7 w-20 rounded-xl bg-gray-50 dark:bg-white/5" />
        <div className="h-7 w-14 rounded-xl bg-gray-50 dark:bg-white/5" />
      </div>
    </div>
  );
}

function DealCard({
  deal, confirmDeleteId, deletingId,
  onEdit, onAdvance, onRequestDelete, onCancelDelete, onConfirmDelete,
}: {
  deal: Deal;
  confirmDeleteId: string | null;
  deletingId: string | null;
  onEdit: () => void;
  onAdvance: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const { t } = useTranslation('deals');
  const { t: tc } = useTranslation('common');
  const cfg = STAGE_CFG[deal.stage];
  const idx = STAGES.indexOf(deal.stage);
  const isLast = idx === STAGES.length - 1;
  const nextStageKey = !isLast ? STAGES[idx + 1] : null;
  const nextLabel = nextStageKey ? t(`stages.${nextStageKey}`) : null;
  const isConfirming = confirmDeleteId === deal.id;
  const isDeleting = deletingId === deal.id;

  return (
    <article
      className={cn(
        'rounded-2xl border bg-gray-50 dark:bg-[#202C33] p-4 transition-all duration-150',
        isConfirming ? 'border-red-400/30' : 'cursor-pointer border-gray-200 dark:border-white/8 hover:border-[#25D366]/40 hover:bg-[#16A34A]/5 dark:hover:bg-[#243530]',
      )}
      onClick={() => { if (!isConfirming) onEdit(); }}
    >
      {/* Inline delete confirmation */}
      {isConfirming && (
        <div className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold text-red-300">{t('deleteConfirm.title')}</p>
          <p className="mt-0.5 text-[11px] text-red-300/60 leading-relaxed">
            {t('deleteConfirm.message', { title: deal.title })}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onConfirmDelete(); }}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
            >
              {t('deleteConfirm.confirm')}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {t('deleteConfirm.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Title + value */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-white leading-snug text-sm">{deal.title}</p>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold', cfg.badge)}>
          ${Number(deal.value || 0).toLocaleString()}
        </span>
      </div>

      {/* Contact */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[10px] font-bold text-[#25D366]">
          {initial(deal.contact?.name ?? deal.contact?.phone)}
        </div>
        <p className="truncate text-xs text-gray-500 dark:text-[#8696A0]">
          {deal.contact?.name || deal.contact?.phone || t('noContact')}
        </p>
      </div>

      {/* Owner + time */}
      <div className="mt-2 flex items-center justify-between">
        {deal.owner ? (
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-300">
              {initial(deal.owner.name ?? deal.owner.email)}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-[#8696A0] truncate max-w-[80px]">
              {deal.owner.name || deal.owner.email}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-400/60 dark:text-[#8696A0]/40">{t('unassigned')}</span>
        )}
        <span className="text-[10px] text-gray-400/60 dark:text-[#8696A0]/40">{timeAgo(deal.updatedAt, t)}</span>
      </div>

      {/* Action buttons */}
      {!isConfirming && (
        <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {!isLast && (
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-1 rounded-xl border border-[#25D366]/20 bg-[#25D366]/8 px-2.5 py-1.5 text-[11px] font-medium text-[#25D366] hover:bg-[#25D366]/15 transition-colors"
            >
              <ChevronRight className="h-3 w-3" />
              {nextLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-2.5 py-1.5 text-[11px] text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            {tc('actions.edit')}
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1 rounded-xl border border-red-400/15 bg-red-400/5 px-2.5 py-1.5 text-[11px] text-red-400 hover:bg-red-400/12 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            {isDeleting ? '…' : tc('actions.delete')}
          </button>
        </div>
      )}
    </article>
  );
}

const emptyForm = { contactId: '', ownerId: '', title: '', stage: 'NEW' as Stage, value: '', notes: '' };

export default function DealsPage() {
  const searchParams = useSearchParams();
  const { success, error: toastError } = useToast();
  const { t } = useTranslation('deals');
  const { t: tc } = useTranslation('common');

  const [deals, setDeals]               = useState<Deal[]>([]);
  const [loading, setLoading]           = useState(true);
  const [editingDeal, setEditingDeal]   = useState<Deal | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [confirmDeleteId, setConfirmId] = useState<string | null>(null);
  const [contacts, setContacts]         = useState<ContactOption[]>([]);
  const [members, setMembers]           = useState<MemberOption[]>([]);
  const [formData, setFormData]         = useState(emptyForm);

  const presetContactId = searchParams.get('contactId');

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [dealData, contactData, agentData] = await Promise.all([
          api.get('/api/deals'),
          api.get('/api/contacts'),
          api.get('/api/teams/agents'),
        ]);
        setDeals(Array.isArray(dealData) ? dealData : []);
        setContacts(Array.isArray(contactData) ? contactData : []);
        setMembers(Array.isArray(agentData) ? agentData : []);
      } catch (err) {
        toastError(err instanceof Error ? err.message : t('toast.loadFailed'));
        setDeals([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open form with preset contact when navigating from chat window
  useEffect(() => {
    if (presetContactId && !editingDeal) setShowForm(true);
  }, [editingDeal, presetContactId]);

  // Sync form with editing deal (or preset contact for new deals)
  useEffect(() => {
    if (editingDeal) {
      setFormData({
        contactId: editingDeal.contactId || '',
        ownerId:   editingDeal.ownerId   || '',
        title:     editingDeal.title,
        stage:     editingDeal.stage,
        value:     String(editingDeal.value ?? 0),
        notes:     editingDeal.notes     || '',
      });
    } else {
      // Preserve the URL-preset contactId so chat-window → deal flow auto-fills the customer
      setFormData({ ...emptyForm, contactId: presetContactId || '' });
    }
  }, [editingDeal, showForm, presetContactId]);

  // Realtime socket handlers
  const onDealCreated = useCallback(({ deal }: { deal: Deal }) => {
    setDeals((prev) => prev.some((d) => d.id === deal.id) ? prev : [deal, ...prev]);
  }, []);
  const onDealUpdated = useCallback(({ deal }: { deal: Deal }) => {
    // Upsert: an update (e.g. a stage change or re-assignment) may bring a deal
    // into view that wasn't in the current list, so add it if missing.
    setDeals((prev) =>
      prev.some((d) => d.id === deal.id)
        ? prev.map((d) => (d.id === deal.id ? deal : d))
        : [deal, ...prev],
    );
  }, []);
  const onDealDeleted = useCallback(({ dealId }: { dealId: string }) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
  }, []);
  useSocket('deal:created', onDealCreated);
  useSocket('deal:updated', onDealUpdated);
  useSocket('deal:deleted', onDealDeleted);

  // Submit create/update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        contactId: formData.contactId || undefined,
        ownerId:   formData.ownerId   || undefined,
        title:     formData.title,
        stage:     formData.stage,
        value:     Number(formData.value || 0),
        notes:     formData.notes,
      };
      if (editingDeal) {
        await api.put(`/api/deals/${editingDeal.id}`, payload);
        success(t('toast.updated'));
      } else {
        await api.post('/api/deals', payload);
        success(t('toast.created'));
      }
      const data = await api.get('/api/deals');
      setDeals(Array.isArray(data) ? data : []);
      setShowForm(false);
      setEditingDeal(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Delete deal (optimistic)
  const handleDelete = async (id: string) => {
    const snapshot = deals;
    setDeals((prev) => prev.filter((d) => d.id !== id));
    setConfirmId(null);
    setDeletingId(id);
    try {
      await api.delete(`/api/deals/${id}`);
      success(t('toast.deleted'));
    } catch (err) {
      setDeals(snapshot);
      toastError(err instanceof Error ? err.message : t('toast.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  // Advance to next stage (optimistic)
  const handleAdvanceStage = async (deal: Deal) => {
    const idx = STAGES.indexOf(deal.stage);
    if (idx === STAGES.length - 1) return;
    const nextStage = STAGES[idx + 1];
    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, stage: nextStage } : d));
    try {
      await api.put(`/api/deals/${deal.id}`, { stage: nextStage });
    } catch (err) {
      setDeals((prev) => prev.map((d) => d.id === deal.id ? deal : d));
      toastError(err instanceof Error ? err.message : t('toast.advanceFailed'));
    }
  };

  // Computed pipeline stats
  const totalDeals  = deals.length;
  const totalValue  = deals.reduce((s, d) => s + (d.value || 0), 0);
  const closedDeals = deals.filter((d) => d.stage === 'CLOSED');
  const closedValue = closedDeals.reduce((s, d) => s + (d.value || 0), 0);
  const winRate     = totalDeals > 0 ? Math.round((closedDeals.length / totalDeals) * 100) : 0;

  const columns = STAGES.map((stage) => ({
    stage,
    cfg:   STAGE_CFG[stage],
    label: t(`stages.${stage}`),
    emptyText: t(`emptyStage.${stage}`),
    items: deals.filter((d) => d.stage === stage),
    total: deals.filter((d) => d.stage === stage).reduce((s, d) => s + (d.value || 0), 0),
  }));

  return (
    <div className="space-y-6 overflow-y-auto">

      {/* ── Header ── */}
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-4 sm:p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,211,102,0.10),transparent_40%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              {t('badge')}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-[#8696A0]">
              {t('subtitle')}
            </p>
          </div>

          {/* Stats + action */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5 lg:gap-6">
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <Stat value={totalDeals}                          label={t('totalDeals')}  />
              <div className="hidden sm:block h-8 w-px bg-gray-200 dark:bg-white/8" />
              <Stat value={`$${totalValue.toLocaleString()}`}  label={t('pipeline')}    />
              <div className="hidden sm:block h-8 w-px bg-gray-200 dark:bg-white/8" />
              <Stat value={`$${closedValue.toLocaleString()}`} label={t('won')}         highlight />
              <div className="hidden sm:block h-8 w-px bg-gray-200 dark:bg-white/8" />
              <Stat value={`${winRate}%`}                       label={t('winRate')}    />
            </div>
            <button
              type="button"
              onClick={() => { setEditingDeal(null); setShowForm(true); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-[#25D366]/90 transition-colors shadow-[0_0_18px_rgba(37,211,102,0.25)]"
            >
              <Plus className="h-4 w-4" />
              {t('newDeal')}
            </button>
          </div>
        </div>
      </section>

      {/* ── Kanban ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {columns.map(({ stage, cfg, label, emptyText, items, total }) => (
          <div key={stage} className="flex flex-col rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden min-h-[320px]">

            {/* Colored accent bar */}
            <div className={cn('h-1 w-full shrink-0', cfg.bar)} />

            {/* Column header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
                <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold', cfg.badge)}>
                  {items.length}
                </span>
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-[#8696A0]">${total.toLocaleString()}</span>
            </div>

            {/* Card list */}
            <div className="flex-1 space-y-3 p-3">
              {loading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className={cn('mb-3 rounded-full p-3 opacity-30', cfg.bar.replace('bg-', 'bg-') + '/10')}>
                    <BriefcaseBusiness className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#8696A0]">{emptyText}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDeal(null);
                      setFormData((c) => ({ ...emptyForm, stage, contactId: c.contactId }));
                      setShowForm(true);
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-[#25D366]/70 hover:text-[#25D366] transition-colors"
                  >
                    <Plus className="h-3 w-3" /> {t('addDeal')}
                  </button>
                </div>
              ) : (
                items.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    confirmDeleteId={confirmDeleteId}
                    deletingId={deletingId}
                    onEdit={() => { setEditingDeal(deal); setShowForm(true); }}
                    onAdvance={() => handleAdvanceStage(deal)}
                    onRequestDelete={() => setConfirmId(confirmDeleteId === deal.id ? null : deal.id)}
                    onCancelDelete={() => setConfirmId(null)}
                    onConfirmDelete={() => handleDelete(deal.id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingDeal(null); }}
        aria-label={editingDeal ? t('editDeal') : t('newDeal')}
        className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
      >
          <form onSubmit={handleSubmit}>
            {/* Modal header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingDeal ? t('editDeal') : t('newDeal')}
              </h2>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingDeal(null); }}
                className="rounded-lg p-1.5 text-gray-500 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label={t('form.contact')}>
                <select
                  value={formData.contactId}
                  onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#16A34A]/50 transition-colors dark:border-white/10 dark:bg-[#202C33] dark:text-white dark:focus:border-[#25D366]/50"
                >
                  <option value="">{t('form.selectContact')}</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.phone}</option>
                  ))}
                </select>
              </Field>

              <Field label={t('form.title')}>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('form.titlePlaceholder')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('form.stage')}>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value as Stage })}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#16A34A]/50 transition-colors dark:border-white/10 dark:bg-[#202C33] dark:text-white dark:focus:border-[#25D366]/50"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{t(`stages.${s}`)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('form.value')}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label={t('form.assignedTo')}>
                <select
                  value={formData.ownerId}
                  onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#16A34A]/50 transition-colors dark:border-white/10 dark:bg-[#202C33] dark:text-white dark:focus:border-[#25D366]/50"
                >
                  <option value="">{t('form.unassigned')}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              </Field>

              <Field label={t('form.notes')}>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder={t('form.notesPlaceholder')}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#16A34A]/50 transition-colors placeholder:text-gray-400 dark:border-white/10 dark:bg-[#202C33] dark:text-white dark:focus:border-[#25D366]/50 dark:placeholder:text-[#8696A0]/60"
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingDeal(null); }}
                className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                {t('form.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#25D366] px-5 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50 hover:bg-[#25D366]/90 transition-colors"
              >
                {saving ? t('form.saving') : editingDeal ? t('form.update') : t('form.create')}
              </button>
            </div>
          </form>
      </Modal>
    </div>
  );
}

/* ── Small helpers ── */

function Stat({ value, label, highlight }: { value: string | number; label: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn('text-xl font-bold', highlight ? 'text-[#25D366]' : 'text-gray-900 dark:text-white')}>
        {value}
      </p>
      <p className="text-xs text-gray-500 dark:text-[#8696A0]">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-[#8696A0]">{label}</label>
      {children}
    </div>
  );
}
