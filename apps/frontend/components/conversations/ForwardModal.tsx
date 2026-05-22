'use client';

import { useEffect, useState } from 'react';
import { X, Search, Send } from 'lucide-react';
import { api } from '@/lib/api';

interface Conversation {
  id: string;
  contact: { name: string | null; phone: string };
  lastMessage: string | null;
}

interface ForwardModalProps {
  messageBody: string;
  onClose: () => void;
  onForwarded?: () => void;
}

export default function ForwardModal({ messageBody, onClose, onForwarded }: ForwardModalProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get('/api/conversations?status=OPEN')
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const filtered = conversations.filter((c) => {
    const name = c.contact?.name?.toLowerCase() ?? '';
    const phone = c.contact?.phone ?? '';
    const q = search.toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  async function handleForward() {
    if (!selected || !messageBody.trim()) return;
    setSending(true);
    try {
      await api.post(`/api/conversations/${selected}/reply`, { message: messageBody });
      setDone(true);
      onForwarded?.();
      setTimeout(onClose, 800);
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Forward Message</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="mx-5 mt-4 rounded-xl bg-gray-50 dark:bg-[#202C33] border border-gray-100 dark:border-white/10 px-3 py-2">
          <p className="text-xs text-gray-500 dark:text-[#8696A0] mb-1">Forwarding:</p>
          <p className="text-sm text-gray-800 dark:text-white truncate">{messageBody}</p>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#25D366]"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="max-h-52 overflow-y-auto px-5 pb-4 space-y-1">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-[#8696A0]">No conversations found</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                selected === c.id
                  ? 'bg-[#25D366]/10 border border-[#25D366]/30'
                  : 'hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-xs font-bold text-white">
                {(c.contact?.name || c.contact?.phone || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {c.contact?.name || c.contact?.phone}
                </p>
                {c.lastMessage && (
                  <p className="truncate text-xs text-gray-500 dark:text-[#8696A0]">{c.lastMessage}</p>
                )}
              </div>
              {selected === c.id && (
                <span className="ml-auto shrink-0 text-[#25D366] text-lg">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2 text-sm text-gray-600 dark:text-[#8696A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || sending || done}
            onClick={handleForward}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#25D366]/90 transition-colors"
          >
            <Send className="h-4 w-4" />
            {done ? 'Forwarded!' : sending ? 'Sending…' : 'Forward'}
          </button>
        </div>
      </div>
    </div>
  );
}
