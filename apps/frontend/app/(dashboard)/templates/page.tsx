'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Plus, Trash2, FileText, Pencil, Search, Copy,
  CheckCircle2, AlertTriangle, Sparkles, LayoutTemplate, Star,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { api } from '../../../lib/api';
import PRESETS from '../../../lib/template-engine/presets';
import type { CanonicalTemplate } from '../../../lib/template-engine/schema';
import { isCanonicalPayload, TEMPLATE_CATEGORIES } from '../../../lib/template-engine/schema';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  type?: 'TEXT' | 'MEDIA' | 'INTERACTIVE';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  category?: string | null;
  language?: string;
  payload?: any;
  variables?: string[];
  createdAt: string;
}

type Tab = 'library' | 'presets';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const CATEGORY_FILTERS = ['All', ...TEMPLATE_CATEGORIES.map(c => c.value), 'Draft'];

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  t: template, onEdit, onDuplicate, onDelete, deleting,
}: {
  t: MessageTemplate;
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation('templates');
  const canonical = isCanonicalPayload(template.payload) ? template.payload as CanonicalTemplate : null;
  const vars: string[] = canonical?._meta?.variableNames ?? (Array.isArray(template.variables) ? template.variables : []);

  const preview = (template.content ?? '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\{\{(\w+)\}\}/g, '[$1]')
    .slice(0, 120);

  const categoryLabel = TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label ?? template.category;

  return (
    <div className="group rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-4 flex flex-col gap-3 hover:border-[#25D366]/40 hover:shadow-md transition-all">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{template.name}</p>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColor(template.type)}`}>
              {template.type ?? 'TEXT'}
            </span>
            {categoryLabel && (
              <span className="inline-flex rounded-full border border-gray-200 dark:border-white/10 px-2 py-0.5 text-[10px] text-gray-500 dark:text-[#8696A0]">
                {categoryLabel}
              </span>
            )}
            {template.status === 'DRAFT' && (
              <span className="inline-flex rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                {t('status.DRAFT')}
              </span>
            )}
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

      {/* Actions */}
      <div className="flex gap-1.5 pt-1 border-t border-gray-100 dark:border-white/5">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] py-1.5 text-xs font-medium text-gray-700 dark:text-white hover:border-[#25D366]/50 hover:bg-[#25D366]/5 transition-colors"
        >
          <Pencil className="h-3 w-3" /> {t('common:actions.edit')}
        </button>

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
  const { t } = useTranslation('templates');

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [tab, setTab] = useState<Tab>('library');
  const [addingPreset, setAddingPreset] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const handleDuplicate = async (tpl: MessageTemplate) => {
    try {
      await api.post('/api/templates', {
        name: `${tpl.name} (copy)`,
        content: tpl.content,
        type: tpl.type,
        payload: tpl.payload,
        variables: tpl.variables,
        category: tpl.category,
        language: tpl.language,
        status: 'DRAFT',
      });
      await fetchTemplates();
      showToast('Template duplicated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate');
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

  const filtered = templates.filter(tpl => {
    const matchSearch = !search
      || tpl.name.toLowerCase().includes(search.toLowerCase())
      || tpl.content?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'All'
      ? true
      : categoryFilter === 'Draft'
      ? tpl.status === 'DRAFT'
      : tpl.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6 overflow-y-auto">
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
              <LayoutTemplate className="h-3.5 w-3.5" /> WhatsApp Templates
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#8696A0]">
              Reusable WhatsApp message compositions — no approval required.
            </p>
            {templates.length > 0 && (
              <p className="mt-2 text-xs text-gray-400 dark:text-[#8696A0]">
                {templates.length} template{templates.length !== 1 ? 's' : ''} in your library
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => router.push('/templates/builder')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25D366]/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> {t('newTemplate')}
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
        {([['library', 'My Templates'], ['presets', 'Preset Library']] as [Tab, string][]).map(([tabKey, label]) => (
          <button
            type="button"
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === tabKey ? 'bg-[#25D366] text-white' : 'text-gray-600 dark:text-[#8696A0] hover:text-gray-900 dark:hover:text-white'}`}
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
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#25D366]"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORY_FILTERS.map(cat => {
                const label = cat === 'All' ? 'All'
                  : cat === 'Draft' ? 'Draft'
                  : TEMPLATE_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${categoryFilter === cat ? 'bg-[#25D366] text-white border-[#25D366]' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8696A0] hover:border-[#25D366]/50'}`}
                  >
                    {label}
                  </button>
                );
              })}
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
                {search || categoryFilter !== 'All' ? t('noTemplates') : t('noTemplates')}
              </p>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                {search || categoryFilter !== 'All'
                  ? 'Try a different search or filter'
                  : t('noTemplatesSubtitle')}
              </p>
              {!search && categoryFilter === 'All' && (
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => router.push('/templates/builder')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#25D366]/90 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('newTemplate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('presets')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2 text-sm text-gray-600 dark:text-[#8696A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> {t('presets.title')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(tpl => (
                <TemplateCard
                  key={tpl.id}
                  t={tpl}
                  onEdit={() => router.push(`/templates/builder?id=${tpl.id}`)}
                  onDuplicate={() => handleDuplicate(tpl)}
                  onDelete={() => handleDelete(tpl.id)}
                  deleting={deletingId === tpl.id}
                />
              ))}
              {/* Add new card */}
              <button
                type="button"
                onClick={() => router.push('/templates/builder')}
                className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-transparent p-4 flex flex-col items-center justify-center gap-2 hover:border-[#25D366]/50 hover:bg-[#25D366]/5 transition-colors text-gray-400 dark:text-[#8696A0] hover:text-[#25D366] min-h-[180px]"
              >
                <Plus className="h-8 w-8 opacity-50" />
                <p className="text-sm font-medium">{t('newTemplate')}</p>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Preset Library ── */}
      {tab === 'presets' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-[#8696A0]">
            Production-ready WhatsApp message templates — sendable via Baileys with no approval required. Click{' '}
            <strong>{t('presets.use')}</strong> to add to your library.
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
                  const alreadyInLibrary = templates.some(tpl => tpl.name === preset.name);

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
                            {TEMPLATE_CATEGORIES.find(c => c.value === preset.category)?.label ?? preset.category}
                          </span>
                          {vars.length > 0 && (
                            <span className="inline-flex rounded-full bg-[#25D366]/10 border border-[#25D366]/20 px-2 py-0.5 text-[10px] font-mono text-[#25D366]">
                              {vars.length} var{vars.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="inline-flex rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                            ✓ WhatsApp-ready
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-500 dark:text-[#8696A0] line-clamp-3 leading-relaxed flex-1">
                        {preset.body.text
                          .replace(/\*([^*]+)\*/g, '$1')
                          .replace(/\{\{(\w+)\}\}/g, '[$1]')}
                      </p>

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
                          <><Star className="h-3 w-3" /> {t('presets.use')}</>
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
