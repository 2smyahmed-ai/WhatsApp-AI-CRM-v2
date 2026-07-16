'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Pencil, Plus, SlidersHorizontal, Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';
import { useDirection } from '../../../../hooks/useDirection';
import { refreshCustomFields, useCustomFields } from '../../../../hooks/useCustomFields';
import CustomFieldEditor, {
  DeleteFieldDialog,
  DragHandle,
  type CustomFieldDraft,
} from '../../../../components/settings/CustomFieldEditor';
import { FIELD_TYPE_LABELS, type CustomFieldDefinition } from '../../../../lib/custom-fields';

export default function CustomFieldsSettingsPage() {
  const { t } = useTranslation('settings');
  const { isRTL } = useDirection();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const { definitions, loading, reload } = useCustomFields({ includeInactive: true });

  // Local copy so a drag reorders instantly; the server call follows.
  const [ordered, setOrdered] = useState<CustomFieldDefinition[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<CustomFieldDefinition | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CustomFieldDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => { setOrdered(definitions); }, [definitions]);

  const persist = async (next: CustomFieldDefinition[]) => {
    const previous = ordered;
    setOrdered(next);
    setSavingOrder(true);
    setError(null);
    try {
      await api.put('/api/custom-fields/reorder', { ids: next.map((definition) => definition.id) });
      await refreshCustomFields(true);
    } catch (err) {
      // Roll the list back rather than leaving the screen disagreeing with the DB.
      setOrdered(previous);
      setError(err instanceof Error ? err.message : 'Could not save the new order.');
    } finally {
      setSavingOrder(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ordered.length || from === to) return;
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persist(next);
  };

  const save = async (draft: CustomFieldDraft) => {
    const body = {
      label: draft.label.trim(),
      type: draft.type,
      options: draft.options.length ? draft.options : undefined,
      required: draft.required,
      placeholder: draft.placeholder.trim() || null,
      helpText: draft.helpText.trim() || null,
      currency: draft.type === 'CURRENCY' ? draft.currency.trim() || null : null,
    };

    if (editing) await api.put(`/api/custom-fields/${editing.id}`, body);
    else await api.post('/api/custom-fields', { ...body, key: draft.key });

    await refreshCustomFields(true);
    await reload();
    setEditing(undefined);
  };

  const toggleActive = async (definition: CustomFieldDefinition) => {
    setError(null);
    try {
      await api.put(`/api/custom-fields/${definition.id}`, { isActive: !definition.isActive });
      await refreshCustomFields(true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the field.');
    }
  };

  const remove = async (purgeValues: boolean) => {
    if (!deleting) return;
    setError(null);
    try {
      await api.delete(`/api/custom-fields/${deleting.id}${purgeValues ? '?purgeValues=true' : ''}`);
      await refreshCustomFields(true);
      await reload();
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the field.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-white transition hover:bg-gray-50 dark:hover:bg-white/10"
        >
          <BackIcon className="h-4 w-4" />
          {t('back', { defaultValue: 'Back' })}
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t('customFields.badge', { defaultValue: 'Custom fields' })}
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
              {t('customFields.title', { defaultValue: 'Contact fields' })}
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[#8696A0]">
              {t('customFields.subtitle', {
                defaultValue:
                  'Define the information your business tracks. Custom fields appear on contact profiles, in the import mapper, in filters, and as personalization tokens in broadcasts.',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex shrink-0 items-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25D366]/90"
          >
            <Plus className="me-2 h-4 w-4" />
            {t('customFields.add', { defaultValue: 'New field' })}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21]">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-5 py-3">
          <p className="text-xs text-gray-500 dark:text-[#8696A0]">
            {t('customFields.count', { count: ordered.length, defaultValue: '{{count}} fields' })}
          </p>
          {savingOrder && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#8696A0]">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('customFields.savingOrder', { defaultValue: 'Saving order…' })}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-500 dark:text-[#8696A0]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('customFields.loading', { defaultValue: 'Loading fields…' })}
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
              <SlidersHorizontal className="h-6 w-6 text-gray-400 dark:text-[#8696A0]" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t('customFields.emptyTitle', { defaultValue: 'No custom fields yet' })}
            </p>
            <p className="max-w-sm text-xs text-gray-500 dark:text-[#8696A0]">
              {t('customFields.emptyBody', {
                defaultValue: 'Add the fields your business actually uses — city, plan, renewal date, credit limit.',
              })}
            </p>
          </div>
        ) : (
          <ul>
            {ordered.map((definition, index) => (
              <li
                key={definition.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  'flex items-center gap-3 border-b border-gray-100 dark:border-white/5 px-5 py-3 transition last:border-b-0',
                  dragIndex === index && 'opacity-50',
                  !definition.isActive && 'bg-gray-50 dark:bg-white/[0.02]',
                )}
              >
                <DragHandle />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        'truncate text-sm font-medium',
                        definition.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#8696A0]',
                      )}
                    >
                      {definition.label}
                    </p>
                    <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-[#8696A0]">
                      {FIELD_TYPE_LABELS[definition.type]}
                    </span>
                    {definition.required && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                        {t('customFields.required', { defaultValue: 'Required' })}
                      </span>
                    )}
                    {!definition.isActive && (
                      <span className="rounded-full bg-gray-200 dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-[#8696A0]">
                        {t('customFields.hidden', { defaultValue: 'Hidden' })}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400 dark:text-[#8696A0]/70" dir="ltr">
                    {`{{${definition.key}}}`}
                    {definition.options?.length ? ` · ${definition.options.length} options` : ''}
                  </p>
                </div>

                {/* Keyboard-accessible reordering — drag alone would strand keyboard users. */}
                <div className="hidden items-center gap-0.5 sm:flex">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={t('customFields.moveUp', { defaultValue: 'Move up' })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === ordered.length - 1}
                    aria-label={t('customFields.moveDown', { defaultValue: 'Move down' })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => toggleActive(definition)}
                  aria-label={definition.isActive ? 'Hide field' : 'Show field'}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white"
                >
                  {definition.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(definition)}
                  aria-label="Edit field"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(definition)}
                  aria-label="Delete field"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />

      {editing !== undefined && (
        <CustomFieldEditor definition={editing} onSave={save} onCancel={() => setEditing(undefined)} />
      )}
      {deleting && (
        <DeleteFieldDialog definition={deleting} onConfirm={remove} onCancel={() => setDeleting(null)} />
      )}
    </div>
  );
}
