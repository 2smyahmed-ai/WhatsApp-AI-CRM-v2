'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Upload, Search, Users2, Filter, X, BriefcaseBusiness, CheckSquare, MessageSquare, PlusCircle } from 'lucide-react';
import ContactsTable from '../../../components/contacts/ContactsTable';
import ContactForm from '../../../components/contacts/ContactForm';
import ContactTimeline from '../../../components/contacts/ContactTimeline';
import ContactTagSelector from '../../../components/contacts/ContactTagSelector';
import { api, apiForm } from '../../../lib/api';
import { useSession } from 'next-auth/react';
import { useSocket } from '../../../hooks/useSocket';

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  tag: string | null;
  notes: string | null;
  createdAt: string;
}

interface ContactDetails {
  contact: Contact;
  deals: Array<{ id: string; title: string; stage: string; value: number }>;
  tasks: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  conversations: Array<{ id: string; status: string; lastMessage: string | null; lastMessageAt: string | null }>;
}

export default function ContactsPage() {
  const { status } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [details, setDetails] = useState<ContactDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'timeline' | 'tags'>('overview');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (tagFilter) params.append('tag', tagFilter);
      const data = await api.get(`/api/contacts?${params}`);
      setContacts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      setContacts([]);
    }
  }, [search, tagFilter]);

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.get('/api/tags');
      setAvailableTags(Array.isArray(data?.tags) ? data.tags : []);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      setAvailableTags([]);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchContacts();
    fetchTags();
  }, [fetchContacts, fetchTags, status]);

  const onMessageNew = useCallback(
    (data: any) => {
      if (status === 'authenticated' && data?.isNewContact) fetchContacts();
    },
    [status, fetchContacts],
  );
  useSocket('message:new', onMessageNew);

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

  const handleSave = async (contact: Partial<Contact>) => {
    if (editingContact) {
      await api.put(`/api/contacts/${editingContact.id}`, contact);
    } else {
      await api.post('/api/contacts', contact);
    }
    setShowForm(false);
    setEditingContact(null);
    fetchContacts();
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await api.delete(`/api/contacts/${id}`);
      fetchContacts();
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
      const message = err instanceof Error ? err.message : 'Failed to delete contact';
      if (status === 409 || message === 'Contact has conversations and cannot be deleted') {
        setError('This contact has conversations, so it cannot be deleted yet.');
        return;
      }
      setError(message);
      console.error('Failed to delete contact:', err);
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
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedContact(null);
        setDetails(null);
        setShowForm(false);
        setEditingContact(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedContact, showForm]);

  return (
    <div className="space-y-6">
      {status === 'loading' && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">
          Checking your session...
        </div>
      )}
      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          {error}
        </div>
      )}
      {importResult && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          {importResult}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 dark:border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <Users2 className="h-3.5 w-3.5" />
              Contact studio
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">Contacts</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[#8696A0]">Manage the contacts already in your backend, with search, CSV import, editing, and delete controls.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={`inline-flex cursor-pointer items-center rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm text-gray-700 dark:text-white transition hover:bg-gray-100 dark:hover:bg-white/10 ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="mr-2 h-4 w-4" />
              {importing ? 'Importing…' : 'Import CSV'}
              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center rounded-xl bg-[#25D366] dark:bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25D366]/90 dark:hover:bg-[#25D366]/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </button>
        </div>
        </div>
      </section>

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-5 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-[#8696A0]" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] py-3 pl-10 pr-4 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0]"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#8696A0]">
              <Filter className="h-3.5 w-3.5" />
              Filter by tag
            </div>
            <button
              type="button"
              onClick={() => setTagFilter('')}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs transition ${
                tagFilter
                  ? 'bg-[#25D366] text-white'
                  : 'border border-white/10 bg-white/5 text-[#8696A0] hover:bg-white/10'
              }`}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              All tags
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  tagFilter === tag
                    ? 'bg-[#25D366] text-white'
                    : 'border border-white/10 bg-white/5 text-[#8696A0] hover:bg-white/10'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <ContactsTable
          contacts={contacts}
          onEdit={(contact) => {
            setEditingContact(contact);
            setShowForm(true);
          }}
          onOpenDetails={openDetails}
          onDelete={handleDelete}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70">
          <ContactForm
            contact={editingContact}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingContact(null);
            }}
          />
        </div>
      )}

      {selectedContact && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={() => {
            setSelectedContact(null);
            setDetails(null);
          }}
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0B141A] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#25D366]/70">Contact details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedContact.name || selectedContact.phone}</h2>
                <p className="mt-1 text-sm text-[#8696A0]">{selectedContact.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedContact(null);
                  setDetails(null);
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex gap-1 border-b border-white/10">
              {(['overview', 'timeline', 'tags'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDetailTab(t)}
                  className={`px-3 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                    detailTab === t
                      ? 'border-[#25D366] text-[#25D366]'
                      : 'border-transparent text-[#8696A0] hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {detailTab === 'tags' && (
              <div className="mt-6">
                <p className="mb-3 text-sm font-semibold text-white">Tags</p>
                <ContactTagSelector contactId={selectedContact.id} />
              </div>
            )}

            {detailTab === 'timeline' && (
              <div className="mt-6">
                <ContactTimeline contactId={selectedContact.id} />
              </div>
            )}

            {detailTab === 'overview' && (loadingDetails ? (
              <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-[#8696A0]">Loading details...</div>
            ) : (
              <div className="mt-6 space-y-6">
                <section className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <BriefcaseBusiness className="h-4 w-4 text-orange-400" />
                    Deals
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Link
                      href={`/deals?contactId=${encodeURIComponent(selectedContact.id)}`}
                      className="inline-flex items-center rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#25D366]/90"
                    >
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                      New Deal
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {(details?.deals || []).map((deal) => (
                      <div key={deal.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="font-medium text-white">{deal.title}</p>
                        <p className="text-sm text-[#8696A0]">{deal.stage} · ${Number(deal.value || 0).toLocaleString()}</p>
                      </div>
                    ))}
                    {!details?.deals?.length && <p className="text-sm text-[#8696A0]">No deals linked yet.</p>}
                  </div>
                </section>

                <section className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <CheckSquare className="h-4 w-4 text-[#25D366]" />
                    Tasks
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Link
                      href={`/tasks?contactId=${encodeURIComponent(selectedContact.id)}`}
                      className="inline-flex items-center rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
                    >
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                      New Task
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {(details?.tasks || []).map((task) => (
                      <div key={task.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="font-medium text-white">{task.title}</p>
                        <p className="text-sm text-slate-400">{task.status}{task.dueDate ? ` · ${new Date(task.dueDate).toLocaleDateString()}` : ''}</p>
                      </div>
                    ))}
                    {!details?.tasks?.length && <p className="text-sm text-slate-400">No tasks linked yet.</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <MessageSquare className="h-4 w-4 text-emerald-300" />
                    Conversations
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/conversations?phone=${encodeURIComponent(selectedContact.phone)}`;
                      }}
                      className="inline-flex items-center rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
                    >
                      Open Conversation
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(details?.conversations || []).map((conversation) => (
                      <div key={conversation.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="font-medium text-white">{conversation.status}</p>
                        <p className="text-sm text-slate-400">{conversation.lastMessage || 'No last message'}</p>
                      </div>
                    ))}
                    {!details?.conversations?.length && <p className="text-sm text-slate-400">No conversations linked yet.</p>}
                  </div>
                </section>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
