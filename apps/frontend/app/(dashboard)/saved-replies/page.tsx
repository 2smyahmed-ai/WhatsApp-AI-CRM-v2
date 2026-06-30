'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, MessageSquareReply, AtSign } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';

interface SavedReply {
  id: string;
  shortcut: string;
  message: string;
  createdAt: string;
}

export default function SavedRepliesPage() {
  const { t } = useTranslation(['settings', 'common']);
  const { status } = useSession();
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReplies = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/saved-replies');
      setSavedReplies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch saved replies:', err);
      setSavedReplies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      void fetchReplies();
    }
  }, [fetchReplies, status]);

  const handleSave = async () => {
    try {
      setError(null);
      if (!shortcut.trim() || !message.trim()) {
        setError('Shortcut and message are required.');
        return;
      }

      await api.post('/api/saved-replies', {
        shortcut: shortcut.trim().startsWith('/') ? shortcut.trim() : `/${shortcut.trim()}`,
        message: message.trim(),
      });

      setShortcut('');
      setMessage('');
      await fetchReplies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reply');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await api.delete(`/api/saved-replies/${id}`);
      await fetchReplies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete reply');
    }
  };

  return (
    <div className="space-y-6 overflow-y-auto">
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-6 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 dark:border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366]">
            <MessageSquareReply className="h-3.5 w-3.5" />
            {t('settings:tabs.savedReplies')}
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">{t('settings:savedReplies.title')}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[#8696A0]">
            {t('settings:savedReplies.description')}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-white/10 bg-white dark:bg-[#111B21] p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings:savedReplies.saveReply')}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#8696A0]">{t('settings:savedReplies.description')}</p>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-300 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-gray-600 dark:text-[#8696A0]">{t('common:labels.shortcut')}</span>
              <div className="relative">
                <AtSign className="absolute left-3 top-3.5 h-4 w-4 text-gray-400 dark:text-[#8696A0]" />
                <input
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  placeholder={t('settings:savedReplies.shortcutPlaceholder')}
                  className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-[#8696A0]"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-gray-600 dark:text-[#8696A0]">{t('common:labels.message')}</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('settings:savedReplies.messagePlaceholder')}
                rows={6}
                className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-[#8696A0]"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {['{{name}}', '{{phone}}'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMessage((m) => m + v)}
                    className="rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-2.5 py-1 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                  >
                    {v}
                  </button>
                ))}
                <span className="self-center text-xs text-gray-400 dark:text-[#8696A0]">{t('templates:builder.variables')}</span>
              </div>
            </label>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center rounded-2xl bg-[#25D366] dark:bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-[#25D366]/90 dark:hover:bg-[#25D366]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('settings:savedReplies.saveReply')}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white dark:bg-[#111B21] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings:savedReplies.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-[#8696A0]">{t('chat:composer.savedReplies')}</p>
            </div>
            <div className="rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-1.5 text-xs text-gray-600 dark:text-[#8696A0]">
              {savedReplies.length}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {savedReplies.map((reply) => (
              <div key={reply.id} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{reply.shortcut}</p>
                    <p className="mt-1 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-[#8696A0]">
                      {reply.message.replace(/\{\{(\w+)\}\}/g, (_, k) => `[${k}]`)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(reply.id)}
                    className="inline-flex shrink-0 items-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/10"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {t('common:actions.delete')}
                  </button>
                </div>
              </div>
            ))}

            {!loading && savedReplies.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] p-6 text-sm text-gray-600 dark:text-[#8696A0]">
                {t('settings:savedReplies.noReplies')}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
