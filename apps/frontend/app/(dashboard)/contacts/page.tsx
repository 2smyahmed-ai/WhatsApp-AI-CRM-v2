'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Upload, Search, Users2, Filter, X, BriefcaseBusiness,
  CheckSquare, MessageSquare, PlusCircle, SlidersHorizontal,
  Trash2, CalendarRange, UserCheck, Tag as TagIcon, StickyNote, Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ContactsTable, { type ContactSortKey } from '../../../components/contacts/ContactsTable';
import ContactForm from '../../../components/contacts/ContactForm';
import ContactTimeline from '../../../components/contacts/ContactTimeline';
import ContactTagSelector from '../../../components/contacts/ContactTagSelector';
import { TablePagination } from '../../../components/ui/TablePagination';
import { api, apiForm } from '../../../lib/api';
import { useSession } from 'next-auth/react';
import { useSocket } from '../../../hooks/useSocket';
import { useTags } from '../../../hooks/useTags';
import { Modal } from '../../../components/ui/modal';
import { cn } from '../../../lib/utils';

interface ContactTagRef {
  tag: { id: string; name: string; color: string };
}

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  notes: string | null;
  createdAt: string;
  contactTags?: ContactTagRef[];
  customFields?: { avatarUrl?: string | null } | null;
}

/** A contact is "saved" when it carries a real name — vs. an unknown WhatsApp number. */
const isSavedContact = (c: Contact) => !!(c.name && c.name.trim());

type ContactSegment = 'all' | 'saved' | 'unsaved';

/** A pill-style on/off filter toggle used in the advanced filter panel. */
function FilterToggle({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366]'
          : 'border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10',
      )}
    >
      {active ? <Check className="h-3.5 w-3.5" /> : icon}
      {label}
    </button>
  );
}

interface ContactDetails {
  contact: Contact;
  deals: Array<{ id: string; title: string; stage: string; value: number }>;
  tasks: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  conversations: Array<{ id: string; status: string; lastMessage: string | null; lastMessageAt: string | null }>;
}

export default function ContactsPage() {
  const { status } = useSession();
  const { t } = useTranslation('contacts');
  const { t: tc } = useTranslation('common');

  // — data —
  const [contacts, setContacts] = useState<Contact[]>([]);
  const allTags = useTags();   // live tag list — auto-updates via socket

  // — search & server-side filters —
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');   // tag name string

  // — saved/unsaved segment (primary quick filter) —
  const [segment, setSegment] = useState<ContactSegment>('all');

  // — advanced client-side filters —
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasTags, setHasTags] = useState(false);
  const [hasNotes, setHasNotes] = useState(false);

  // — sort —
  const [sortKey, setSortKey] = useState<ContactSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // — pagination —
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // — selection —
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // — row-level confirm delete —
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // — UI state —
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [details, setDetails] = useState<ContactDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'timeline' | 'tags'>('overview');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (tagFilter) params.append('tag', tagFilter);
      const data = await api.get(`/api/contacts?${params}`);
      setContacts(Array.isArray(data) ? data : []);
      setPage(1);
    } catch {
      setContacts([]);
    }
  }, [search, tagFilter]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchContacts();
  }, [fetchContacts, status]);

  const onMessageNew = useCallback(
    (data: any) => {
      if (status === 'authenticated' && data?.isNewContact) fetchContacts();
    },
    [status, fetchContacts],
  );
  useSocket('message:new', onMessageNew);

  // ─── Derived / processed data ─────────────────────────────────────────────

  // Counts per segment — drawn from the full fetched list so the tabs stay stable.
  const segmentCounts = useMemo(() => {
    let saved = 0;
    for (const c of contacts) if (isSavedContact(c)) saved++;
    return { all: contacts.length, saved, unsaved: contacts.length - saved };
  }, [contacts]);

  const processedContacts = useMemo(() => {
    let data = [...contacts];
    if (segment === 'saved') data = data.filter(isSavedContact);
    else if (segment === 'unsaved') data = data.filter((c) => !isSavedContact(c));
    if (hasTags) data = data.filter((c) => (c.contactTags?.length ?? 0) > 0);
    if (hasNotes) data = data.filter((c) => !!(c.notes && c.notes.trim()));
    if (dateFrom) data = data.filter((c) => new Date(c.createdAt) >= new Date(dateFrom));
    if (dateTo) data = data.filter((c) => new Date(c.createdAt) <= new Date(dateTo + 'T23:59:59'));
    if (sortKey) {
      data.sort((a, b) => {
        const av = String(a[sortKey] ?? '');
        const bv = String(b[sortKey] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return data;
  }, [contacts, segment, hasTags, hasNotes, dateFrom, dateTo, sortKey, sortDir]);

  const totalCount = processedContacts.length;

  const paginatedContacts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedContacts.slice(start, start + pageSize);
  }, [processedContacts, page, pageSize]);

  // ─── Sort ─────────────────────────────────────────────────────────────────

  const handleSort = (key: ContactSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  // ─── Selection ────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pageIds = paginatedContacts.map((c) => c.id);
    const allSel = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSel) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiForm('/api/contacts/import', formData);
      setImportResult(`Imported ${result.imported} of ${result.total} contacts`);
      fetchContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async (contact: Partial<Contact> & { tagIds?: string[] }) => {
    const { tagIds, ...contactData } = contact;
    if (editingContact) {
      await api.put(`/api/contacts/${editingContact.id}`, contactData);
      // Tags are handled live by ContactTagSelector in the form — nothing to do here
    } else {
      const created = await api.post('/api/contacts', contactData) as { id: string } | null;
      if (tagIds && tagIds.length > 0 && created?.id) {
        await Promise.allSettled(
          tagIds.map((tagId) => api.post(`/api/tags/contacts/${created.id}/tags/${tagId}`, {})),
        );
      }
    }
    setShowForm(false);
    setEditingContact(null);
    fetchContacts();
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await api.delete(`/api/contacts/${id}`);
      setConfirmDeleteId(null);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      fetchContacts();
    } catch (err) {
      const s = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
      const message = err instanceof Error ? err.message : 'Failed to delete contact';
      setConfirmDeleteId(null);
      if (s === 409 || message === 'Contact has conversations and cannot be deleted') {
        setError('This contact has conversations and cannot be deleted.');
      } else {
        setError(message);
      }
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    let failCount = 0;
    await Promise.allSettled(
      ids.map(async (id) => {
        try { await api.delete(`/api/contacts/${id}`); }
        catch { failCount++; }
      }),
    );
    setSelectedIds(new Set());
    setShowBulkConfirm(false);
    setBulkDeleting(false);
    await fetchContacts();
    if (failCount > 0) {
      setError(`${failCount} contact(s) could not be deleted — they may have active conversations.`);
    }
  };

  const openDetails = async (contact: Contact) => {
    try {
      setSelectedContact(contact);
      setLoadingDetails(true);
      const data = await api.get(`/api/contacts/${contact.id}/details`);
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact details');
      setSelectedContact(contact);
      setDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (!selectedContact && !showForm) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedContact(null);
        setDetails(null);
        setShowForm(false);
        setEditingContact(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedContact, showForm]);

  // ─── Derived helpers ──────────────────────────────────────────────────────

  const activeFilterCount =
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (hasTags ? 1 : 0) + (hasNotes ? 1 : 0);

  const clearAdvancedFilters = () => {
    setDateFrom('');
    setDateTo('');
    setHasTags(false);
    setHasNotes(false);
    setPage(1);
  };

  // Tab label lookup
  const TAB_LABELS: Record<'overview' | 'timeline' | 'tags', string> = {
    overview: t('tabs.overview'),
    timeline: t('tabs.timeline'),
    tags: t('tabs.tags'),
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {status === 'loading' && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">
          {tc('loading')}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {error}
        </div>
      )}
      {importResult && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {importResult}
        </div>
      )}

      {/* ── Header ── */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <Users2 className="h-3.5 w-3.5" />
              {t('badge')}
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[#8696A0]">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label
              className={cn(
                'inline-flex cursor-pointer items-center rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm text-gray-700 dark:text-white transition hover:bg-gray-100 dark:hover:bg-white/10',
                importing && 'pointer-events-none opacity-60',
              )}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? t('importing') : t('importContacts')}
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
            </label>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25D366]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('addContact')}
            </button>
          </div>
        </div>
      </section>

      {/* ── Search + filters ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">

        {/* Search row */}
        <div className="p-5 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-[#8696A0]" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] outline-none focus:border-[#25D366]/50"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((f) => !f)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                showFilters || activeFilterCount > 0
                  ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366]'
                  : 'border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/10',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {tc('actions.filter')}
              {activeFilterCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-slate-950">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Saved / Unsaved segment — primary, easy-to-use quick filter */}
          <div className="mt-3 flex w-full flex-wrap items-center gap-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-1 sm:flex-nowrap">
            {([
              { key: 'all', label: t('segments.all'), count: segmentCounts.all, icon: Users2 },
              { key: 'saved', label: t('segments.saved'), count: segmentCounts.saved, icon: UserCheck },
              { key: 'unsaved', label: t('segments.unsaved'), count: segmentCounts.unsaved, icon: Search },
            ] as const).map(({ key, label, count, icon: Icon }) => {
              const active = segment === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSegment(key); setPage(1); }}
                  title={key === 'saved' ? t('segments.savedHint') : key === 'unsaved' ? t('segments.unsavedHint') : undefined}
                  className={cn(
                    'flex flex-1 basis-full items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:basis-0',
                    active
                      ? 'bg-[#25D366] text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                      active ? 'bg-white/25 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#8696A0]">
                <Filter className="h-3.5 w-3.5" />
                {tc('labels.tags')}:
              </div>

              {/* All */}
              <button
                type="button"
                onClick={() => setTagFilter('')}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition',
                  !tagFilter
                    ? 'bg-[#25D366] text-white'
                    : 'border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/10',
                )}
              >
                {tc('all')}
              </button>

              {allTags.map((tag) => {
                const active = tagFilter === tag.name;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setTagFilter(active ? '' : tag.name)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                      active
                        ? 'border-transparent text-white'
                        : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/10',
                    )}
                    style={active ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: active ? 'rgba(255,255,255,0.7)' : tag.color }}
                    />
                    {tag.name}
                    {tag._count !== undefined && (
                      <span className={cn('text-[10px]', active ? 'text-white/70' : 'text-gray-400 dark:text-[#8696A0]')}>
                        {tag._count.contacts}
                      </span>
                    )}
                    {active && <X className="h-2.5 w-2.5 opacity-70" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0B141A] px-5 py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-[#8696A0] flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5" /> {t('createdFrom')}
                </p>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-9 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-sm text-gray-900 dark:text-white outline-none focus:border-[#25D366]/50 transition-colors"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-[#8696A0]">{t('createdTo')}</p>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-9 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-sm text-gray-900 dark:text-white outline-none focus:border-[#25D366]/50 transition-colors"
                />
              </div>

              {/* Toggle chips */}
              <div className="flex flex-wrap items-center gap-2">
                <FilterToggle
                  active={hasTags}
                  onClick={() => { setHasTags((v) => !v); setPage(1); }}
                  icon={<TagIcon className="h-3.5 w-3.5" />}
                  label={t('filters.hasTags')}
                />
                <FilterToggle
                  active={hasNotes}
                  onClick={() => { setHasNotes((v) => !v); setPage(1); }}
                  icon={<StickyNote className="h-3.5 w-3.5" />}
                  label={t('filters.hasNotes')}
                />
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-300 dark:border-white/10 px-3 text-sm text-gray-600 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('clearFilters')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results info row */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-[#8696A0]">
            {t('totalContacts', { count: totalCount })}
            {selectedIds.size > 0 && (
              <span className="ml-2 font-medium text-[#25D366]">· {t('bulkActions.selected', { count: selectedIds.size })}</span>
            )}
          </p>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              {t('clearSelection')}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="px-0">
          <ContactsTable
            contacts={paginatedContacts}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onEdit={(contact) => { setEditingContact(contact); setShowForm(true); }}
            onOpenDetails={openDetails}
            onDelete={handleDelete}
            confirmDeleteId={confirmDeleteId}
            onConfirmDelete={setConfirmDeleteId}
          />

          {/* Empty state */}
          {totalCount === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
                <Users2 className="h-6 w-6 text-gray-400 dark:text-[#8696A0]" />
              </div>
              {contacts.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('noContacts')}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8696A0]">{t('noContactsSubtitle')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('emptyFiltered')}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8696A0]">{t('emptyFilteredSubtitle')}</p>
                  <button
                    type="button"
                    onClick={() => { setSegment('all'); setTagFilter(''); clearAdvancedFilters(); setSearch(''); }}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-[#8696A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('clearFilters')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-[var(--bottom-nav-space)] sm:bottom-6 left-1/2 z-40 -translate-x-1/2 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#202C33] px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <span className="text-sm font-medium text-white">
            {t('bulkActions.selected', { count: selectedIds.size })}
          </span>
          <div className="h-5 w-px bg-white/15" />
          {showBulkConfirm ? (
            <>
              <span className="text-xs text-red-300">{t('deleteBulk', { count: selectedIds.size })}</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {bulkDeleting ? '…' : t('yesDelete')}
              </button>
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#8696A0] hover:bg-white/10 transition-colors"
              >
                {tc('actions.cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowBulkConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('bulkActions.delete')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#8696A0] hover:bg-white/10 transition-colors"
              >
                {tc('actions.deselectAll')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Mobile bottom-nav spacer */}
      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />

      {/* ── Create / Edit modal (ContactForm renders its own accessible Modal) ── */}
      {showForm && (
        <ContactForm
          contact={editingContact}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingContact(null);
          }}
        />
      )}

      {/* ── Contact detail drawer ── */}
      {selectedContact && (
        <Modal
          open
          onClose={() => { setSelectedContact(null); setDetails(null); }}
          aria-label={t('contactDetails')}
          overlayClassName="items-stretch justify-end p-0 bg-black/60"
          className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0B141A] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
        >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#25D366]/70">{t('contactDetails')}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedContact.name
                    ? <bdi>{selectedContact.name}</bdi>
                    : <span dir="ltr">{'‎'}{selectedContact.phone}</span>}
                </h2>
                <p className="mt-1 text-sm text-[#8696A0]" dir="ltr">{'‎'}{selectedContact.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedContact(null); setDetails(null); }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              >
                {tc('actions.close')}
              </button>
            </div>

            <div className="mt-4 flex gap-1 border-b border-white/10">
              {(['overview', 'timeline', 'tags'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={cn(
                    'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    detailTab === tab
                      ? 'border-[#25D366] text-[#25D366]'
                      : 'border-transparent text-[#8696A0] hover:text-white',
                  )}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {detailTab === 'tags' && (
              <div className="mt-6">
                <p className="mb-3 text-sm font-semibold text-white">{tc('labels.tags')}</p>
                <ContactTagSelector contactId={selectedContact.id} />
              </div>
            )}

            {detailTab === 'timeline' && (
              <div className="mt-6">
                <ContactTimeline contactId={selectedContact.id} />
              </div>
            )}

            {detailTab === 'overview' && (
              loadingDetails ? (
                <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-[#8696A0]">
                  {t('loadingDetails')}
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  <section className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <BriefcaseBusiness className="h-4 w-4 text-orange-400" />
                      {t('dealsSection')}
                    </div>
                    <div className="mb-3">
                      <Link
                        href={`/deals?contactId=${encodeURIComponent(selectedContact.id)}`}
                        className="inline-flex items-center rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#25D366]/90 transition-colors"
                      >
                        <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                        {t('newDeal')}
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {(details?.deals || []).map((deal) => (
                        <div key={deal.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <p className="font-medium text-white">{deal.title}</p>
                          <p className="text-sm text-[#8696A0]">{deal.stage} · ${Number(deal.value || 0).toLocaleString()}</p>
                        </div>
                      ))}
                      {!details?.deals?.length && <p className="text-sm text-[#8696A0]">{t('noDeals')}</p>}
                    </div>
                  </section>

                  <section className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <CheckSquare className="h-4 w-4 text-[#25D366]" />
                      {t('tasksSection')}
                    </div>
                    <div className="mb-3">
                      <Link
                        href={`/tasks?contactId=${encodeURIComponent(selectedContact.id)}`}
                        className="inline-flex items-center rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
                      >
                        <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                        {t('newTask')}
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {(details?.tasks || []).map((task) => (
                        <div key={task.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                          <p className="font-medium text-white">{task.title}</p>
                          <p className="text-sm text-slate-400">
                            {task.status}{task.dueDate ? ` · ${new Date(task.dueDate).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                      ))}
                      {!details?.tasks?.length && <p className="text-sm text-slate-400">{t('noTasks')}</p>}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <MessageSquare className="h-4 w-4 text-emerald-300" />
                      {t('conversationsSection')}
                    </div>
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => { window.location.href = `/conversations?phone=${encodeURIComponent(selectedContact.phone)}`; }}
                        className="inline-flex items-center rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
                      >
                        {t('openConversation')}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(details?.conversations || []).map((conversation) => (
                        <div key={conversation.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                          <p className="font-medium text-white">{conversation.status}</p>
                          <p className="text-sm text-slate-400">{conversation.lastMessage || 'No last message'}</p>
                        </div>
                      ))}
                      {!details?.conversations?.length && <p className="text-sm text-slate-400">{t('noLinkedConversations')}</p>}
                    </div>
                  </section>
                </div>
              )
            )}
        </Modal>
      )}
    </div>
  );
}
