'use client';

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Search, Users, User, Inbox, CheckCheck, LayoutList,
  Pin, PinOff, Clock, BellOff, Bookmark, BookmarkCheck, X as XIcon,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { api } from '../../lib/api';
import { formatPhone } from '../../lib/phone';
import { useSocket } from '../../hooks/useSocket';
import { useMessagingStore, type ConversationSummary } from '../../stores/messaging-store';


type InboxView = 'all' | 'mine' | 'my-team' | 'unassigned' | 'closed';

const VIEWS: { key: InboxView; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: LayoutList },
  { key: 'mine', label: 'Mine', icon: User },
  { key: 'my-team', label: 'My Team', icon: Users },
  { key: 'unassigned', label: 'Unassigned', icon: Inbox },
  { key: 'closed', label: 'Closed', icon: CheckCheck },
];

const STATUS_PILLS = ['OPEN', 'PENDING', 'ON_HOLD', 'RESOLVED'];

const PIPELINE_COLORS: Record<string, string> = {
  LEAD: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  QUALIFIED: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  NEGOTIATION: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  WON: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const SNOOZE_OPTIONS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: 'Tomorrow 9 AM', minutes: null, tomorrowMorning: true },
];

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export interface ConversationListHandle {
  refetch: () => void;
}

const ConversationList = forwardRef<ConversationListHandle, ConversationListProps>(
  ({ selectedId, onSelect }, ref) => {
    const { data: session } = useSession();
    const [search, setSearch] = useState('');
    const [activeView, setActiveView] = useState<InboxView>('all');
    const [statusFilter, setStatusFilter] = useState('');
    const [snoozeMenu, setSnoozeMenu] = useState<string | null>(null); // conversationId

    // ── Zustand store ─────────────────────────────────────────────────────────
    const storeConversations = useMessagingStore(s => s.conversations);
    const storeOrder = useMessagingStore(s => s.conversationOrder);
    const seedConversations = useMessagingStore(s => s.seedConversations);
    const patchConversation = useMessagingStore(s => s.patchConversation);
    const typingStore = useMessagingStore(s => s.typing);
    const typingStart = useMessagingStore(s => s.typingStart);
    const typingStop = useMessagingStore(s => s.typingStop);

    // ── Saved views (localStorage) ────────────────────────────────────────────
    interface SavedView { id: string; name: string; view: InboxView; status: string }
    const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
      try { return JSON.parse(localStorage.getItem('inbox_saved_views') || '[]'); } catch { return []; }
    });
    const [savingView, setSavingView] = useState(false);
    const [newViewName, setNewViewName] = useState('');

    function persistViews(views: SavedView[]) {
      setSavedViews(views);
      localStorage.setItem('inbox_saved_views', JSON.stringify(views));
    }
    function addSavedView() {
      const name = newViewName.trim();
      if (!name) return;
      persistViews([...savedViews, { id: Date.now().toString(), name, view: activeView, status: statusFilter }]);
      setNewViewName('');
      setSavingView(false);
    }
    function removeSavedView(id: string) {
      persistViews(savedViews.filter((v) => v.id !== id));
    }
    function applySavedView(v: SavedView) {
      setActiveView(v.view);
      setStatusFilter(v.status);
    }

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchConversations = useCallback(async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (statusFilter) params.append('status', statusFilter);
        params.append('view', activeView);
        const data = await api.get(`/api/conversations?${params}`);
        const list = Array.isArray(data) ? data : [];
        seedConversations(list);
      } catch {
        seedConversations([]);
      }
    }, [search, activeView, statusFilter, seedConversations]);

    useEffect(() => { fetchConversations(); }, [fetchConversations]);
    useImperativeHandle(ref, () => ({ refetch: fetchConversations }), [fetchConversations]);

    // Global event: allow other components to request a refetch (e.g. after sending a message)
    useEffect(() => {
      const handler = () => { fetchConversations(); };
      window.addEventListener('conversations:refetch', handler);
      return () => window.removeEventListener('conversations:refetch', handler);
    }, [fetchConversations]);

    // Lightweight in-place updates from other components (optimistic sends)
    useEffect(() => {
      const handler = (e: Event) => {
        try {
          const detail = (e as CustomEvent)?.detail;
          const cid = detail?.conversationId;
          const msg = detail?.message;
          if (!cid || !msg) return;
          const existing = useMessagingStore.getState().conversations.get(cid);
          if (!existing) return;
          const isInbound = !msg.fromMe;
          patchConversation(cid, {
            lastMessage: msg.body ?? existing.lastMessage,
            lastMessageAt: msg.timestamp ?? existing.lastMessageAt,
            unreadCount: isInbound ? ((existing.unreadCount ?? 0) + 1) : (existing.unreadCount ?? 0),
          });
        } catch {}
      };
      window.addEventListener('conversation:message', handler as EventListener);
      return () => window.removeEventListener('conversation:message', handler as EventListener);
    }, [patchConversation]);

    // ── Socket: new message (legacy) → patch store ───────────────────────────
    useSocket('message:new', useCallback((data: any) => {
      const cid = data.conversationId;
      if (!cid) return;
      const existing = useMessagingStore.getState().conversations.get(cid);
      if (!existing) { fetchConversations(); return; }
      const isInbound = data.message?.direction === 'INBOUND';
      patchConversation(cid, {
        lastMessage: data.message?.body ?? existing.lastMessage,
        lastMessageAt: data.message?.timestamp ?? existing.lastMessageAt,
        unreadCount: isInbound ? ((existing.unreadCount ?? 0) + 1) : (existing.unreadCount ?? 0),
      });
    }, [fetchConversations, patchConversation]));

    // ── Socket: conversation updated (legacy) → patch store ──────────────────
    useSocket('conversation:updated', useCallback((data: any) => {
      const cid = data.conversationId;
      if (!cid) return;
      const patch: Partial<ConversationSummary> = {};
      if (data.status !== undefined) patch.status = data.status;
      if (data.assignedTo !== undefined) patch.assignedTo = data.assignedTo;
      if (data.assignedTeamId !== undefined) patch.assignedTeamId = data.assignedTeamId;
      if (data.pipeline !== undefined) patch.pipeline = data.pipeline;
      if (data.unreadCount !== undefined) patch.unreadCount = data.unreadCount;
      if (data.lastMessagePreview !== undefined) patch.lastMessage = data.lastMessagePreview;
      if (data.lastMessage !== undefined) patch.lastMessage = data.lastMessage;
      if (data.lastMessageAt !== undefined) patch.lastMessageAt = data.lastMessageAt;
      if (data.isPinned !== undefined) patch.isPinned = data.isPinned;
      if (data.snoozedUntil !== undefined) patch.snoozedUntil = data.snoozedUntil;
      patchConversation(cid, patch);
    }, [patchConversation]));

    // ── Socket: typing indicators → store ───────────────────────────────────
    useSocket('typing:start', useCallback((data: { conversationId: string; userId: string }) => {
      typingStart(data.conversationId, data.userId);
    }, [typingStart]));

    useSocket('typing:stop', useCallback((data: { conversationId: string; userId: string }) => {
      typingStop(data.conversationId, data.userId);
    }, [typingStop]));

    // ── Actions ───────────────────────────────────────────────────────────────
    async function togglePin(e: React.MouseEvent, conv: ConversationSummary) {
      e.stopPropagation();
      try {
        await api.put(`/api/conversations/${conv.id}/pin`, { isPinned: !conv.isPinned });
        patchConversation(conv.id, { isPinned: !conv.isPinned });
      } catch { /* ignore */ }
    }

    async function snooze(e: React.MouseEvent, conv: ConversationSummary, option: typeof SNOOZE_OPTIONS[0]) {
      e.stopPropagation();
      setSnoozeMenu(null);
      let snoozedUntil: string;
      if (option.tomorrowMorning) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        snoozedUntil = d.toISOString();
      } else {
        snoozedUntil = new Date(new Date().getTime() + option.minutes! * 60_000).toISOString();
      }
      try {
        await api.put(`/api/conversations/${conv.id}/snooze`, { snoozedUntil });
        patchConversation(conv.id, { snoozedUntil, status: 'ON_HOLD' });
      } catch { /* ignore */ }
    }

    async function unsnooze(e: React.MouseEvent, conv: ConversationSummary) {
      e.stopPropagation();
      try {
        await api.put(`/api/conversations/${conv.id}/snooze`, { snoozedUntil: null });
        patchConversation(conv.id, { snoozedUntil: null, status: 'OPEN' });
      } catch { /* ignore */ }
    }

    const currentUserId = (session?.user as { id?: string } | undefined)?.id;

    // Read from store and apply client-side search filter
    const sorted = storeOrder
      .map(id => storeConversations.get(id))
      .filter((c): c is ConversationSummary => {
        if (!c) return false;
        if (!search) return true;
        const name = String((c as any).contact?.name ?? '').toLowerCase();
        const phone = String((c as any).contact?.phone ?? '').toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || phone.includes(q);
      });

    return (
      <div className="flex h-full flex-col bg-white dark:bg-[#111B21]">
        {/* Search */}
        <div className="border-b border-gray-200 dark:border-white/5 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-[#8696A0]" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] py-2 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-[#8696A0] focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20"
              />
            </div>
            <button
              type="button"
              title="Save current view"
              onClick={() => setSavingView((v) => !v)}
              className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-[#25D366] transition-colors"
            >
              <Bookmark className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Inbox view tabs */}
        <div className="flex border-b border-gray-200 dark:border-white/5 overflow-x-auto">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveView(key); setStatusFilter(''); }}
              className={`flex flex-1 min-w-0 flex-col items-center gap-0.5 px-2 py-2.5 text-xs font-medium transition-colors ${
                activeView === key
                  ? 'border-b-2 border-[#25D366] text-[#25D366]'
                  : 'text-gray-500 dark:text-[#8696A0] hover:text-gray-800 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Status filter pills */}
        {activeView !== 'closed' && (
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-gray-100 dark:border-white/5">
            {['', ...STATUS_PILLS].map((s) => (
              <button
                key={s || 'ALL'}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-[#25D366] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#202C33] dark:text-[#8696A0] dark:hover:bg-[#2a3942]'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        )}

        {/* Saved views */}
        {(savedViews.length > 0 || savingView) && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-b border-gray-100 dark:border-white/5">
            {savedViews.map((v) => (
              <span
                key={v.id}
                className="group flex shrink-0 items-center gap-1 rounded-full bg-gray-100 dark:bg-[#202C33] px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-[#E9EDEF] cursor-pointer hover:bg-[#25D366]/10 transition-colors"
                onClick={() => applySavedView(v)}
              >
                <BookmarkCheck className="h-3 w-3 text-[#25D366]" />
                {v.name}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeSavedView(v.id); }}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XIcon className="h-3 w-3 text-gray-400 hover:text-red-500" />
                </button>
              </span>
            ))}
            {savingView && (
              <div className="flex shrink-0 items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  placeholder="View name…"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSavedView(); if (e.key === 'Escape') setSavingView(false); }}
                  className="w-28 rounded-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-2.5 py-0.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#25D366]"
                />
                <button type="button" onClick={addSavedView} className="text-xs text-[#25D366] font-semibold hover:underline">Save</button>
                <button type="button" onClick={() => setSavingView(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            )}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto" dir="rtl">
          <div dir="ltr">
            {sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-gray-500 dark:text-[#8696A0]">
                <Inbox className="mb-3 h-8 w-8 opacity-40" />
                <p className="font-medium">No conversations</p>
                <p className="mt-1 text-xs opacity-70">Try a different view or filter</p>
              </div>
            )}

            {sorted.map((conv) => {
              const contact = (conv as any).contact ?? {};
              const isAssignedToMe = conv.assignedTo === currentUserId;
              const unread = conv.unreadCount ?? 0;
              const isSnoozed = Boolean(conv.snoozedUntil);
              const isTyping = (typingStore.get(conv.id)?.activeUserIds.size ?? 0) > 0;

              return (
                <div
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`group relative cursor-pointer border-b border-gray-100 dark:border-white/5 p-3 transition ${
                    selectedId === conv.id
                      ? 'bg-gray-100 dark:bg-[#202C33]'
                      : 'hover:bg-gray-50 dark:hover:bg-[#202C33]/50'
                  }`}
                >
                  {/* Pin indicator stripe */}
                  {conv.isPinned && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#25D366] rounded-r" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-sm font-semibold text-white shadow-[0_2px_8px_rgba(37,211,102,0.2)]">
                      {contact.customFields?.avatarUrl ? (
                        <img
                          src={contact.customFields.avatarUrl}
                          alt={contact.name || formatPhone(contact.phone)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {(contact.name || formatPhone(contact.phone || '')).charAt(0).toUpperCase()}
                        </span>
                      )}
                      {isSnoozed && (
                        <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-400 ring-1 ring-white dark:ring-[#111B21]">
                          <BellOff className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {conv.isPinned && <Pin className="h-3 w-3 shrink-0 text-[#25D366]" />}
                          {contact.name || formatPhone(contact.phone || '')}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {unread > 0 && selectedId !== conv.id && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25D366] px-1 text-xs font-bold text-white">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-[#8696A0]">
                            {conv.lastMessageAt &&
                              new Date(conv.lastMessageAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                          </span>
                        </div>
                      </div>

                      {/* Last message / typing indicator */}
                      {isTyping ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-[#25D366]">
                          <span className="inline-flex gap-0.5">
                            <span className="h-1 w-1 animate-bounce rounded-full bg-[#25D366] [animation-delay:0ms]" />
                            <span className="h-1 w-1 animate-bounce rounded-full bg-[#25D366] [animation-delay:150ms]" />
                            <span className="h-1 w-1 animate-bounce rounded-full bg-[#25D366] [animation-delay:300ms]" />
                          </span>
                          typing...
                        </p>
                      ) : (
                        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-[#8696A0]">
                          {(conv.lastMessagePreview ?? conv.lastMessage) || 'No messages yet'}
                        </p>
                      )}

                      {/* Snooze label */}
                      {isSnoozed && (
                        <p className="mt-0.5 text-xs text-orange-500">
                          Snoozed until {new Date(conv.snoozedUntil!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}

                      {/* Badges */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                            conv.status === 'OPEN'
                              ? 'bg-[#25D366]/15 text-[#25D366]'
                              : conv.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200'
                              : conv.status === 'ON_HOLD'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200'
                              : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-[#8696A0]'
                          }`}
                        >
                          {conv.status}
                        </span>

                        {conv.pipeline && (
                          <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${PIPELINE_COLORS[conv.pipeline] || 'bg-gray-100 text-gray-600'}`}>
                            {conv.pipeline}
                          </span>
                        )}

                        {isAssignedToMe && (
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            Mine
                          </span>
                        )}

                        {(conv as any).assignedUser && !isAssignedToMe && (
                          <span className="truncate rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-[#8696A0]">
                            {(conv as any).assignedUser.name || (conv as any).assignedUser.email}
                          </span>
                        )}

                        {(conv as any).assignedTeam && (
                          <span className="truncate rounded-full bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                            {(conv as any).assignedTeam.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons — visible on hover */}
                  <div
                    className="absolute right-2 bottom-2 hidden items-center gap-1 group-hover:flex"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Pin / Unpin */}
                    <button
                      type="button"
                      title={conv.isPinned ? 'Unpin' : 'Pin'}
                      onClick={(e) => togglePin(e, conv)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      {conv.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>

                    {/* Snooze */}
                    {isSnoozed ? (
                      <button
                        type="button"
                        title="Unsnooze"
                        onClick={(e) => unsnooze(e, conv)}
                        className="rounded p-1 text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/15"
                      >
                        <BellOff className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <div className="relative">
                        <button
                          type="button"
                          title="Snooze"
                          onClick={(e) => { e.stopPropagation(); setSnoozeMenu(snoozeMenu === conv.id ? null : conv.id); }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </button>

                        {snoozeMenu === conv.id && (
                          <div className="absolute right-0 top-6 z-50 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#233038]">
                            {SNOOZE_OPTIONS.map((opt) => (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={(e) => snooze(e, conv, opt)}
                                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

ConversationList.displayName = 'ConversationList';
export default ConversationList;
