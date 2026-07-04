'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Hash, Users2, Filter, X, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';
import { formatPhone } from '../../../lib/phone';

interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: { contacts: number };
}

interface ContactTag {
  id: string;
  name: string;
  color: string;
}

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  notes: string | null;
  createdAt: string;
  contactTags?: { tag: ContactTag }[];
}

const COLOR_PRESETS = ['#6366f1', '#25D366', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export default function TagsPage() {
  const { t } = useTranslation(['common', 'chat']);
  const { status } = useSession();
  const [tags, setTags] = useState<Tag[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tagData, contactData] = await Promise.all([
        api.get('/api/tags'),
        api.get('/api/contacts'),
      ]);
      setTags(Array.isArray(tagData) ? tagData : []);
      setContacts(Array.isArray(contactData) ? contactData : []);
    } catch (error) {
      setTags([]);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') void fetchData();
  }, [fetchData, status]);

  const createTag = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/api/tags', { name: newName.trim(), color: newColor });
      setNewName('');
      await fetchData();
    } catch {}
    setCreating(false);
  };

  const deleteTag = async (id: string) => {
    if (!confirm(t('common:confirmDelete.message'))) return;
    try {
      await api.delete(`/api/tags/${id}`);
      if (selectedTagId === id) setSelectedTagId(null);
      await fetchData();
    } catch {}
  };

  const filteredContacts = useMemo(() => {
    if (!selectedTagId) return contacts.filter((c) => (c.contactTags?.length ?? 0) > 0);
    return contacts.filter((c) => c.contactTags?.some((ct) => ct.tag.id === selectedTagId));
  }, [contacts, selectedTagId]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366]">
            <Hash className="h-3.5 w-3.5" />
            {t('chat:details.tags')}
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">{t('common:labels.tags')}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[#8696A0]">
            {t('chat:details.tags')}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        {/* Left: tag management */}
        <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('common:labels.tags')}</h2>
            <p className="text-xs text-gray-500 dark:text-[#8696A0]">{t('common:actions.filter')}</p>
          </div>

          {/* Create tag */}
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTag()}
              placeholder={t('chat:details.addTag')}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/50"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`h-5 w-5 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#111B21]' : ''}`}
                  style={{ backgroundColor: c, '--tw-ring-color': c } as any}
                />
              ))}
              <button
                type="button"
                onClick={createTag}
                disabled={creating || !newName.trim()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#25D366]/90 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('common:actions.create')}
              </button>
            </div>
          </div>

          {/* Tag list */}
          <div className="space-y-1">
            {!loading && tags.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-[#8696A0]">{t('common:empty.title')}</p>
            )}
            {selectedTagId && (
              <button
                type="button"
                onClick={() => setSelectedTagId(null)}
                className="mb-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> {t('common:actions.filter')}
              </button>
            )}
            {tags.map((tag) => (
              <div
                key={tag.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                  selectedTagId === tag.id
                    ? 'bg-[#25D366]/10 dark:bg-[#25D366]/15'
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
                onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{tag.name}</span>
                  <span className="text-xs text-gray-500 dark:text-[#8696A0]">
                    {tag._count?.contacts ?? 0}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Right: contacts */}
        <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {selectedTagId
                  ? tags.find((tag) => tag.id === selectedTagId)?.name ?? ''
                  : t('common:labels.tags')}
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs text-gray-600 dark:text-[#8696A0]">
              <Users2 className="h-3.5 w-3.5" />
              {filteredContacts.length}
            </div>
          </div>

          <div className="space-y-3">
            {filteredContacts.map((contact) => {
              const ctags = contact.contactTags?.map((ct) => ct.tag) ?? [];
              return (
                <div key={contact.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{contact.name || t('common:labels.name')}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-[#8696A0]"><bdi>{formatPhone(contact.phone)}</bdi></p>
                    </div>
                    <a
                      href={`/conversations?phone=${encodeURIComponent(contact.phone)}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1.5 text-xs text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t('common:labels.message')}
                    </a>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ctags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {!loading && filteredContacts.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 p-6 text-center text-sm text-gray-400 dark:text-[#8696A0]">
                {t('common:empty.title')}
              </div>
            )}
          </div>
        </section>
      </div>
      {/* Mobile bottom-nav spacer */}
      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />
    </div>
  );
}
