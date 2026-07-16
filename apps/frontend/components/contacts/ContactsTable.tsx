'use client';

import Link from 'next/link';
import { Edit, MessageSquare, PlusCircle, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatPhone } from '../../lib/phone';
import { cn } from '../../lib/utils';
import Avatar from '../ui/Avatar';
import { formatFieldValue, type CustomFieldDefinition, type CustomFieldValues } from '../../lib/custom-fields';

interface ContactTag {
  tag: { id: string; name: string; color: string };
}

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  notes: string | null;
  createdAt: string;
  contactTags?: ContactTag[];
  customFields?: (CustomFieldValues & { avatarUrl?: string | null }) | null;
}

export type ContactSortKey = 'name' | 'phone' | 'createdAt';

interface ContactsTableProps {
  contacts: Contact[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  sortKey: ContactSortKey | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: ContactSortKey) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onOpenDetails: (contact: Contact) => void;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string | null) => void;
  /** Every active custom field, rendered as its own column/row wherever a contact has a value. */
  customFieldDefs?: CustomFieldDefinition[];
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 text-[#25D366]" />
    : <ArrowDown className="h-3 w-3 text-[#25D366]" />;
}

export default function ContactsTable({
  contacts,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onDelete,
  onOpenDetails,
  confirmDeleteId,
  onConfirmDelete,
  customFieldDefs = [],
}: ContactsTableProps) {
  const { t } = useTranslation('contacts');
  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));
  const someSelected = !allSelected && contacts.some((c) => selectedIds.has(c.id));

  const SortTh = ({ k, label }: { k: ContactSortKey; label: string }) => (
    <th
      scope="col"
      aria-label={label}
      onClick={() => onSort(k)}
      className={cn(
        'cursor-pointer select-none px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors',
        sortKey === k
          ? 'text-[#25D366]'
          : 'text-gray-700 dark:text-[#8696A0] hover:text-gray-900 dark:hover:text-white',
      )}
    >
      <span className="flex items-center gap-1.5">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
      {/* ── Mobile card list (no horizontal scroll) ── */}
      <ul className="divide-y divide-gray-200 dark:divide-white/5 md:hidden">
        {contacts.map((contact) => {
          const selected = selectedIds.has(contact.id);
          return (
            <li key={contact.id} className={cn('p-3.5', selected && 'bg-[#25D366]/5 dark:bg-[#25D366]/8')}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelect(contact.id)}
                  aria-label={t('table.name')}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 dark:border-white/20 accent-[#25D366]"
                />
                <Link href={`/contacts/${contact.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Avatar src={contact.customFields?.avatarUrl} name={contact.name || contact.phone} size={40} />
                  <div className="min-w-0">
                    <p dir={contact.name ? undefined : 'ltr'} className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {contact.name || <>{'‎'}{formatPhone(contact.phone)}</>}
                    </p>
                    <p dir="ltr" className="truncate text-xs text-gray-500 dark:text-[#8696A0]">{'‎'}{formatPhone(contact.phone)}</p>
                  </div>
                </Link>
              </div>

              {(contact.contactTags ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 ps-7">
                  {(contact.contactTags ?? []).map(({ tag }) => (
                    <span key={tag.id} className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {customFieldDefs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 ps-7">
                  {customFieldDefs
                    .filter((definition) => contact.customFields?.[definition.key] != null && contact.customFields?.[definition.key] !== '')
                    .map((definition) => (
                      <p key={definition.id} className="break-words text-[11px] text-gray-500 dark:text-[#8696A0]">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{definition.label}:</span>{' '}
                        {formatFieldValue(definition, contact.customFields?.[definition.key])}
                      </p>
                    ))}
                </div>
              )}

              <div className="mt-2.5 flex items-center gap-1 ps-7">
                {confirmDeleteId === contact.id ? (
                  <>
                    <span className="text-xs text-red-400">{t('deleteConfirm.title')}?</span>
                    <button type="button" onClick={() => onDelete(contact.id)} className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white">
                      {t('yesDelete')}
                    </button>
                    <button type="button" onClick={() => onConfirmDelete(null)} className="rounded-lg border border-gray-200 dark:border-white/10 px-2.5 py-1 text-xs text-gray-700 dark:text-white">
                      {t('deleteConfirm.cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => onOpenDetails(contact)} className="rounded-lg border border-gray-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-medium text-[#25D366]">
                      {t('tabs.overview')}
                    </button>
                    <button type="button" onClick={() => onEdit(contact)} className="p-2 text-[#25D366]" title={t('table.actions')} aria-label={t('table.actions')}>
                      <Edit className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => { window.location.href = `/conversations?phone=${encodeURIComponent(contact.phone)}`; }} className="p-2 text-[#8696A0]" title="Chat" aria-label="Chat">
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onConfirmDelete(contact.id)} className="ms-auto p-2 text-rose-400" title="Delete" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── Desktop table ── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#202C33]">
              <th scope="col" className="w-10 px-4 py-3.5">
                <span className="sr-only">Select</span>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={onToggleAll}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 dark:border-white/20 accent-[#25D366]"
                />
              </th>
              <SortTh k="name" label={t('table.name')} />
              <SortTh k="phone" label={t('table.phone')} />
              <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">
                {t('table.tags')}
              </th>
              <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">
                {t('form.notes')}
              </th>
              {customFieldDefs.map((definition) => (
                <th
                  key={definition.id}
                  className="whitespace-nowrap px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]"
                >
                  {definition.label}
                </th>
              ))}
              <SortTh k="createdAt" label={t('table.createdAt')} />
              <th className="px-4 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">
                {t('table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/5">
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className={cn(
                  'group transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]',
                  selectedIds.has(contact.id) && 'bg-[#25D366]/5 dark:bg-[#25D366]/8',
                )}
              >
                <td className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => onToggleSelect(contact.id)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 dark:border-white/20 accent-[#25D366]"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="group/name inline-flex items-center gap-2.5 text-gray-900 dark:text-white transition-colors"
                  >
                    <Avatar
                      src={contact.customFields?.avatarUrl}
                      name={contact.name || contact.phone}
                      size={32}
                    />
                    <span
                      dir={contact.name ? undefined : 'ltr'}
                      className="text-gray-900 dark:text-white group-hover/name:text-[#128C7E] dark:group-hover/name:text-[#25D366] group-hover/name:underline"
                    >
                      {contact.name || <>{'‎'}{formatPhone(contact.phone)}</>}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#8696A0]">
                  <span dir="ltr" className="inline-block">{'‎'}{formatPhone(contact.phone)}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {(contact.contactTags ?? []).length > 0
                      ? (contact.contactTags ?? []).map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))
                      : <span className="text-gray-400 dark:text-[#8696A0]">-</span>}
                  </div>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600 dark:text-[#8696A0]">
                  {contact.notes || '-'}
                </td>
                {customFieldDefs.map((definition) => (
                  <td key={definition.id} className="max-w-xs truncate px-4 py-3 text-sm text-gray-600 dark:text-[#8696A0]">
                    {formatFieldValue(definition, contact.customFields?.[definition.key])}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-[#8696A0]">
                  {new Date(contact.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {confirmDeleteId === contact.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400">{t('deleteConfirm.title')}?</span>
                      <button
                        type="button"
                        onClick={() => onDelete(contact.id)}
                        className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                      >
                        {t('yesDelete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onConfirmDelete(null)}
                        className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-xs text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                      >
                        {t('deleteConfirm.cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onEdit(contact)}
                        className="p-1.5 text-[#25D366] hover:text-[#25D366]/80 transition-colors"
                        title={t('table.actions')}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDetails(contact)}
                        className="px-2 py-1 text-xs font-medium text-[#25D366] hover:text-[#25D366]/80 transition-colors"
                      >
                        {t('tabs.overview')}
                      </button>
                      <Link
                        href={`/tasks?contactId=${encodeURIComponent(contact.id)}`}
                        className="p-1.5 text-[#8696A0] hover:text-gray-700 dark:hover:text-white transition-colors"
                        title="New Task"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/deals?contactId=${encodeURIComponent(contact.id)}`}
                        className="p-1.5 text-[#8696A0] hover:text-gray-700 dark:hover:text-white transition-colors"
                        title="New Deal"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => { window.location.href = `/conversations?phone=${encodeURIComponent(contact.phone)}`; }}
                        className="p-1.5 text-[#8696A0] hover:text-gray-700 dark:hover:text-white transition-colors"
                        title="Chat"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onConfirmDelete(contact.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
