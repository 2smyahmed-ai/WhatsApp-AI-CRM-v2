'use client';

import { useEffect, useState, useCallback } from 'react';
import { BriefcaseBusiness, Pencil, Plus, Trash2, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { Input } from '../../../components/ui/input';
import { useSocket } from '../../../hooks/useSocket';

type Deal = {
  id: string;
  title: string;
  contactId?: string | null;
  ownerId?: string | null;
  stage: 'NEW' | 'INTERESTED' | 'NEGOTIATION' | 'CLOSED';
  value: number;
  notes?: string | null;
  updatedAt: string;
  contact?: { name?: string | null; phone: string };
};

type ContactOption = {
  id: string;
  name: string | null;
  phone: string;
};

type MemberOption = {
  id: string;
  name: string | null;
  email: string;
};

const stages: Deal['stage'][] = ['NEW', 'INTERESTED', 'NEGOTIATION', 'CLOSED'];

export default function DealsPage() {
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [formData, setFormData] = useState({
    contactId: '',
    ownerId: '',
    title: '',
    stage: 'NEW' as Deal['stage'],
    value: '',
    notes: '',
  });
  const presetContactId = searchParams.get('contactId');

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const [dealData, contactData, teamData] = await Promise.all([
          api.get('/api/deals'),
          api.get('/api/contacts'),
          api.get('/api/teams'),
        ]);
        setDeals(Array.isArray(dealData) ? dealData : []);
        setContacts(Array.isArray(contactData) ? contactData : []);
        setMembers(Array.isArray(teamData?.team?.members) ? teamData.team.members : []);
      } catch (err) {
        console.error('Failed to load deals:', err);
        setDeals([]);
        setError(err instanceof Error ? err.message : 'Failed to load deals');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!presetContactId || editingDeal) return;
    setFormData((current) => ({ ...current, contactId: presetContactId }));
  }, [editingDeal, presetContactId]);

  useEffect(() => {
    if (presetContactId && !editingDeal) {
      setShowForm(true);
    }
  }, [editingDeal, presetContactId]);

  useEffect(() => {
    if (editingDeal) {
        setFormData({
          contactId: editingDeal.contactId || '',
          ownerId: editingDeal.ownerId || '',
          title: editingDeal.title,
          stage: editingDeal.stage,
          value: String(editingDeal.value ?? 0),
          notes: editingDeal.notes || '',
        });
      } else {
        setFormData({
          contactId: '',
          ownerId: '',
          title: '',
          stage: 'NEW',
          value: '',
          notes: '',
      });
    }
  }, [editingDeal, showForm]);

  useEffect(() => {
    if (!showForm) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowForm(false);
        setEditingDeal(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showForm]);

  const refreshDeals = async () => {
    const data = await api.get('/api/deals');
    setDeals(Array.isArray(data) ? data : []);
  };

  const onDealCreated = useCallback(({ deal }: { deal: Deal }) => {
    setDeals((prev) => prev.some((d) => d.id === deal.id) ? prev : [deal, ...prev]);
  }, []);
  const onDealUpdated = useCallback(({ deal }: { deal: Deal }) => {
    setDeals((prev) => prev.map((d) => d.id === deal.id ? deal : d));
  }, []);
  const onDealDeleted = useCallback(({ dealId }: { dealId: string }) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
  }, []);
  useSocket('deal:created', onDealCreated);
  useSocket('deal:updated', onDealUpdated);
  useSocket('deal:deleted', onDealDeleted);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setSuccess(null);
      const payload = {
        contactId: formData.contactId,
        ownerId: formData.ownerId || undefined,
        title: formData.title,
        stage: formData.stage,
        value: Number(formData.value || 0),
        notes: formData.notes,
      };
      if (editingDeal) {
        await api.put(`/api/deals/${editingDeal.id}`, payload);
      } else {
        await api.post('/api/deals', payload);
      }
      await refreshDeals();
      setShowForm(false);
      setEditingDeal(null);
      setSuccess(editingDeal ? 'Deal updated.' : 'Deal created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this deal?')) return;
    const snapshot = deals;
    setDeals((prev) => prev.filter((d) => d.id !== id));
    try {
      await api.delete(`/api/deals/${id}`);
      setSuccess('Deal deleted.');
    } catch (err) {
      setDeals(snapshot);
      setError(err instanceof Error ? err.message : 'Failed to delete deal');
    }
  };

  const handleAdvanceStage = async (deal: Deal) => {
    const idx = stages.indexOf(deal.stage);
    if (idx === stages.length - 1) return;
    const nextStage = stages[idx + 1];
    try {
      await api.put(`/api/deals/${deal.id}`, { stage: nextStage });
      setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, stage: nextStage } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance stage');
    }
  };

  const dealsByStage = stages.map((stage) => ({
    stage,
    items: deals.filter((deal) => deal.stage === stage),
  }));

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-6 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 dark:border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366]">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Pipeline
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">Deals</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[#8696A0]">
              Track opportunities through the simple four-stage pipeline from phase 2.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingDeal(null);
              setShowForm(true);
            }}
            className="inline-flex items-center rounded-2xl bg-[#25D366] dark:bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-950"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Deal
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-300 dark:border-rose-400/20 bg-red-50 dark:bg-rose-400/10 px-4 py-3 text-sm text-red-700 dark:text-rose-100">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-green-300 dark:border-emerald-400/20 bg-green-50 dark:bg-emerald-400/10 px-4 py-3 text-sm text-green-700 dark:text-emerald-100">
          {success}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] p-6 text-gray-600 dark:text-[#8696A0]">Loading deals...</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {dealsByStage.map(({ stage, items }) => (
            <div key={stage} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-600 dark:text-[#8696A0]">{stage}</h2>
                <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-1 text-xs text-gray-700 dark:text-[#8696A0]">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((deal) => (
                  <article key={deal.id} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4">
                    <p className="font-medium text-gray-900 dark:text-white">{deal.title}</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-[#8696A0]">{deal.contact?.name || deal.contact?.phone || 'No contact'}</p>
                    <p className="mt-3 text-sm text-gray-600 dark:text-white">${Number(deal.value || 0).toLocaleString()}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {deal.stage !== 'CLOSED' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStage(deal)}
                          className="inline-flex items-center rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-2 text-xs font-medium text-[#25D366]"
                          title={`Advance to ${stages[stages.indexOf(deal.stage) + 1]}`}
                        >
                          <ChevronRight className="mr-1 h-3.5 w-3.5" />
                          {stages[stages.indexOf(deal.stage) + 1]}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDeal(deal);
                          setShowForm(true);
                        }}
                        className="inline-flex items-center rounded-xl border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-[#202C33] px-3 py-2 text-xs text-gray-700 dark:text-white"
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(deal.id)}
                        className="inline-flex items-center rounded-xl border border-red-300 dark:border-rose-400/20 bg-red-100 dark:bg-rose-400/10 px-3 py-2 text-xs text-red-700 dark:text-rose-100"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {!items.length && <p className="text-sm text-gray-500 dark:text-[#8696A0]">No deals yet.</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setShowForm(false);
            setEditingDeal(null);
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6 shadow-card dark:shadow-[0_30px_90px_rgba(0,0,0,0.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{editingDeal ? 'Edit Deal' : 'New Deal'}</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-gray-600 dark:text-[#8696A0]">Contact</label>
                <select
                  value={formData.contactId}
                  onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Select a contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name || contact.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-600 dark:text-[#8696A0]">Title</label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Opportunity title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm text-gray-600 dark:text-[#8696A0]">Stage</label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value as Deal['stage'] })}
                    className="h-10 w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-sm text-gray-900 dark:text-white"
                  >
                    {stages.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-600 dark:text-[#8696A0]">Value</label>
                  <Input value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-600 dark:text-[#8696A0]">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-600 dark:text-[#8696A0]">Assigned owner</label>
                <select
                  value={formData.ownerId}
                  onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 text-sm text-gray-900 dark:text-[#8696A0]"
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowForm(false); setEditingDeal(null); }} className="rounded-xl border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-[#202C33] px-4 py-2 text-sm text-gray-700 dark:text-white">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-[#25D366] dark:bg-[#25D366] px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Deal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
