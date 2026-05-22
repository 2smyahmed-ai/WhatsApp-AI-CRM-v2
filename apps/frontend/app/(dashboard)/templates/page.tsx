'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, FileText, Pencil, Search, Copy,
  CheckCircle2, AlertTriangle, Clock, XCircle, PauseCircle,
  Send, RefreshCw, Sparkles, LayoutTemplate, Star,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { api } from '../../../lib/api';
import PRESETS from '../../../lib/template-engine/presets';
import type { CanonicalTemplate } from '../../../lib/template-engine/schema';
import { isCanonicalPayload } from '../../../lib/template-engine/schema';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  type?: 'TEXT' | 'MEDIA' | 'INTERACTIVE';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  metaStatus?: string | null;
  metaTemplateId?: string | null;
  category?: string | null;
  language?: string;
  payload?: any;
  variables?: string[];
  createdAt: string;
}

type Tab = 'library' | 'presets';

// ── Meta status helpers ───────────────────────────────────────────────────────

function MetaStatusBadge({ metaStatus }: { metaStatus?: string | null }) {
  if (!metaStatus) return null;

  const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    APPROVED: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: 'Approved',
      cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
    PENDING: {
      icon: <Clock className="h-3 w-3" />,
      label: 'Pending',
      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    REJECTED: {
      icon: <XCircle className="h-3 w-3" />,
      label: 'Rejected',
      cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
    PAUSED: {
      icon: <PauseCircle className="h-3 w-3" />,
      label: 'Paused',
      cls: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
    },
    DELETED: {
      icon: <XCircle className="h-3 w-3" />,
      label: 'Deleted',
      cls: 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20',
    },
  };

  const config = map[metaStatus.toUpperCase()];
  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.cls}`}>
      {config.icon} {config.label}
    </span>
  );
}

function typeColor(type?: string) {
  if (type === 'INTERACTIVE') return 'bg-violet-500/10 text-violet-600 dark:text-violet-400';
  if (type === 'MEDIA')       return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
}

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  sky:     'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  violet:  'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  rose:    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  orange:  'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
};

const CATEGORY_FILTERS = ['All', 'MARKETING', 'UTILITY', 'AUTHENTICATION', 'Draft'];

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  t, onEdit, onDuplicate, onDelete, onSubmit, onSync, deleting, submitting,
}: {
  t: MessageTemplate;
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
  onSubmit: () => void; onSync: () => void;
  deleting: boolean; submitting: boolean;
}) {
  const canonical = isCanonicalPayload(t.payload) ? t.payload as CanonicalTemplate : null;
  const vars: string[] = canonical?._meta?.variableNames ?? (Array.isArray(t.variables) ? t.variables : []);
  const canSubmit = !t.metaStatus || t.metaStatus === 'REJECTED';

  // Content preview: strip bold markers and replace vars
  const preview = (t.content ?? '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\{\{(\w+)\}\}/g, '[$1]')
    .slice(0, 120);

  return (
    <div className="group rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-4 flex flex-col gap-3 hover:border-[#25D366]/40 hover:shadow-md transition-all">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{t.name}</p>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColor(t.type)}`}>
              {t.type ?? 'TEXT'}
            </span>
            {t.category && (
              <span className="inline-flex rounded-full border border-gray-200 dark:border-white/10 px-2 py-0.5 text-[10px] text-gray-500 dark:text-[#8696A0]">
                {t.category}
              </span>
            )}
            {t.status === 'DRAFT' && !t.metaStatus && (
              <span className="inline-flex rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                Draft
              </span>
            )}
            <MetaStatusBadge metaStatus={t.metaStatus} />
          </div>
        </div>
      </div>

      {/* Content preview */}
      <p className="flex-1 text-sm text-gray-500 dark:text-[#8696A0] line-clamp-3 leading-relaxed">
        {preview || 'No content'}
      </p>

      {/* Variables */}
      {vars.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {vars.slice(0, 3).map(v => (
            <span key={v} className="rounded-full bg-[#25D366]/10 border border-[#25D366]/20 px-1.5 py-0.5 text-[10px] font-mono text-[#25D366]">
              {`{{${v}}}`}
            </span>
          ))}
          {vars.length > 3 && (
            <span className="text-[10px] text-gray-400 self-center">+{vars.length - 3} more</span>
          )}
        </div>
      )}

      {/* Meta status detail for rejected */}
      {t.metaStatus === 'REJECTED' && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>Rejected by Meta. Review content and resubmit.</span>
        </div>
      )}
      {t.metaStatus === 'PAUSED' && (
        <div className="rounded-xl bg-gray-500/10 border border-gray-200 dark:border-white/10 px-3 py-2 text-[11px] text-gray-600 dark:text-[#8696A0] flex items-start gap-1.5">
          <PauseCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>Template paused by Meta — quality score may be low.</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-1 border-t border-gray-100 dark:border-white/5">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] py-1.5 text-xs font-medium text-gray-700 dark:text-white hover:border-[#25D366]/50 hover:bg-[#25D366]/5 transition-colors"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>

        {/* Submit to Meta */}
        {canSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            title="Submit to Meta for approval"
            className="inline-flex items-center justify-center rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Sync from Meta */}
        {t.metaTemplateId && (
          <button
            type="button"
            onClick={onSync}
            title="Sync status from Meta"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-2.5 py-1.5 text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-2.5 py-1.5 text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-2.5 py-1.5 text-rose-400 hover:text-rose-500 hover:bg-rose-500/5 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const { status } = useSession();

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [tab, setTab] = useState<Tab>('library');
  const [addingPreset, setAddingPreset] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchTemplates();
  }, [fetchTemplates, status]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/api/templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (t: MessageTemplate) => {
    try {
      await api.post('/api/templates', {
        name: `${t.name} (copy)`,
        content: t.content,
        type: t.type,
        payload: t.payload,
        variables: t.variables,
        category: t.category,
        language: t.language,
        status: 'DRAFT',
      });
      await fetchTemplates();
      showToast('Template duplicated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate');
    }
  };

  const handleSubmitToMeta = async (id: string) => {
    setSubmittingId(id);
    try {
      await api.post(`/api/templates/${id}/submit`, {});
      showToast('Template submitted to Meta for approval');
      await fetchTemplates();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission failed', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleSyncFromMeta = async () => {
    setSyncing(true);
    try {
      const result = await api.post('/api/templates/sync', {});
      showToast(`Synced ${result.synced ?? 0} templates from Meta`);
      await fetchTemplates();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSingleSync = async (_id: string) => {
    try {
      await api.post('/api/templates/sync', {});
      await fetchTemplates();
      showToast('Status synced from Meta');
    } catch {
      showToast('Sync failed', 'error');
    }
  };

  const handleUsePreset = async (preset: CanonicalTemplate) => {
    setAddingPreset(preset.name);
    try {
      await api.post('/api/templates', {
        name: preset.name,
        content: preset.body.text,
        type: preset.buttons ? 'INTERACTIVE' : preset.header && preset.header.type !== 'TEXT' ? 'MEDIA' : 'TEXT',
        payload: preset,
        variables: preset._meta?.variableNames ?? [],
        category: preset.category,
        language: preset.language,
        status: 'DRAFT',
      });
      await fetchTemplates();
      setTab('library');
      showToast(`"${preset.name}" added to your library`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add preset');
    } finally {
      setAddingPreset(null);
    }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = templates.filter(t => {
    const matchSearch = !search
      || t.name.toLowerCase().includes(search.toLowerCase())
      || t.content?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'All'
      ? true
      : categoryFilter === 'Draft'
      ? t.status === 'DRAFT'
      : t.category === categoryFilter;
    return matchSearch && matchCat;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const approved  = templates.filter(t => t.metaStatus === 'APPROVED').length;
  const pending   = templates.filter(t => t.metaStatus === 'PENDING').length;
  const rejected  = templates.filter(t => t.metaStatus === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/20 text-rose-700 dark:text-rose-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1 text-xs font-medium text-[#25D366]">
              <LayoutTemplate className="h-3.5 w-3.5" /> Template Engine
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">Message Templates</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#8696A0]">
              Build canonical WhatsApp templates. Preview matches the real sent payload.
            </p>
            {/* Quick stats */}
            {templates.length > 0 && (
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-500 dark:text-[#8696A0]">{templates.length} templates</span>
                {approved > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {approved} approved
                  </span>
                )}
                {pending > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <Clock className="h-3 w-3" /> {pending} pending
                  </span>
                )}
                {rejected > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                    <XCircle className="h-3 w-3" /> {rejected} rejected
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleSyncFromMeta}
              disabled={syncing}
              title="Sync all templates from Meta"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2 text-sm text-gray-600 dark:text-[#8696A0] hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Meta'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/templates/builder')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25D366]/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> New Template
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-300 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200 flex items-center justify-between">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-1 w-fit">
        {([['library', 'My Templates'], ['presets', 'Preset Library']] as [Tab, string][]).map(([t, label]) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-[#25D366] text-white' : 'text-gray-600 dark:text-[#8696A0] hover:text-gray-900 dark:hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── My Templates ── */}
      {tab === 'library' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search templates…"
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#25D366]"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORY_FILTERS.map(cat => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${categoryFilter === cat ? 'bg-[#25D366] text-white border-[#25D366]' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/50'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="ml-auto text-xs text-gray-400 dark:text-[#8696A0]">
              {filtered.length} template{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-gray-300 dark:text-white/10 mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-[#8696A0]">
                {search || categoryFilter !== 'All' ? 'No templates match your filters' : 'No templates yet'}
              </p>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                {search || categoryFilter !== 'All'
                  ? 'Try a different search or filter'
                  : 'Create your first template or pick from the preset library'}
              </p>
              {!search && categoryFilter === 'All' && (
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => router.push('/templates/builder')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#25D366]/90 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> New Template
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('presets')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2 text-sm text-gray-600 dark:text-[#8696A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Browse Presets
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(t => (
                <TemplateCard
                  key={t.id}
                  t={t}
                  onEdit={() => router.push(`/templates/builder?id=${t.id}`)}
                  onDuplicate={() => handleDuplicate(t)}
                  onDelete={() => handleDelete(t.id)}
                  onSubmit={() => handleSubmitToMeta(t.id)}
                  onSync={() => handleSingleSync(t.id)}
                  deleting={deletingId === t.id}
                  submitting={submittingId === t.id}
                />
              ))}
              {/* Add new card */}
              <button
                type="button"
                onClick={() => router.push('/templates/builder')}
                className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-transparent p-4 flex flex-col items-center justify-center gap-2 hover:border-[#25D366]/50 hover:bg-[#25D366]/5 transition-colors text-gray-400 dark:text-[#8696A0] hover:text-[#25D366] min-h-[180px]"
              >
                <Plus className="h-8 w-8 opacity-50" />
                <p className="text-sm font-medium">New Template</p>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Preset Library ── */}
      {tab === 'presets' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-[#8696A0]">
            Production-ready canonical templates that compile to valid Meta payloads. Click{' '}
            <strong>Use Template</strong> to add to your library.
          </p>
          {PRESETS.map(group => (
            <div key={group.category}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${COLOR_MAP[group.color] ?? ''}`}>
                  {group.category}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.templates.map(preset => {
                  const vars = preset._meta?.variableNames ?? [];
                  const hasButtons = (preset.buttons?.length ?? 0) > 0;
                  const type = hasButtons ? 'INTERACTIVE' : preset.header && preset.header.type !== 'TEXT' ? 'MEDIA' : 'TEXT';
                  const alreadyInLibrary = templates.some(t => t.name === preset.name);

                  return (
                    <div
                      key={preset.name}
                      className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-4 flex flex-col gap-3 hover:border-[#25D366]/40 hover:shadow-md transition-all"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{preset.name}</p>
                        {preset._meta?.description && (
                          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-[#8696A0] leading-snug">
                            {preset._meta.description}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColor(type)}`}>
                            {type}
                          </span>
                          <span className="inline-flex rounded-full border border-gray-200 dark:border-white/10 px-2 py-0.5 text-[10px] text-gray-500 dark:text-[#8696A0]">
                            {preset.category}
                          </span>
                          {vars.length > 0 && (
                            <span className="inline-flex rounded-full bg-[#25D366]/10 border border-[#25D366]/20 px-2 py-0.5 text-[10px] font-mono text-[#25D366]">
                              {vars.length} var{vars.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {/* Canonical badge */}
                          <span className="inline-flex rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                            ✓ Meta-ready
                          </span>
                        </div>
                      </div>

                      {/* Body preview */}
                      <p className="text-sm text-gray-500 dark:text-[#8696A0] line-clamp-3 leading-relaxed flex-1">
                        {preset.body.text
                          .replace(/\*([^*]+)\*/g, '$1')
                          .replace(/\{\{(\w+)\}\}/g, '[$1]')}
                      </p>

                      {/* Variables */}
                      {vars.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {vars.slice(0, 4).map(v => (
                            <span key={v} className="rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-1.5 py-0.5 text-[10px] font-mono text-gray-500 dark:text-[#8696A0]">
                              {`{{${v}}}`}
                            </span>
                          ))}
                          {vars.length > 4 && (
                            <span className="text-[10px] text-gray-400 self-center">+{vars.length - 4}</span>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleUsePreset(preset)}
                        disabled={addingPreset === preset.name || alreadyInLibrary}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          alreadyInLibrary
                            ? 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 cursor-not-allowed'
                            : 'bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20'
                        }`}
                      >
                        {alreadyInLibrary ? (
                          <><CheckCircle2 className="h-3 w-3" /> In Library</>
                        ) : addingPreset === preset.name ? (
                          'Adding…'
                        ) : (
                          <><Star className="h-3 w-3" /> Use Template</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
