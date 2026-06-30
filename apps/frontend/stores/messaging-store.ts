import { create } from 'zustand';
import type { MessageDTO, MessageStatus } from '@crm/messaging-schema';

// ── Conversation summary shape (mirrors what the API returns) ─────────────────

export interface ConversationSummary {
  id: string;
  contactPhone?: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessage?: string | null;
  unreadCount?: number;
  status?: string;
  isPinned?: boolean;
  pipeline?: string | null;
  snoozedUntil?: string | null;
  assignedTo?: string | null;
  assignedTeamId?: string | null;
  [key: string]: unknown;
}

// ── Per-conversation message buffer ──────────────────────────────────────────

interface ConvBuffer {
  /** Ordered ascending by timestamp. */
  messages: MessageDTO[];
  /** clientId → index for O(1) optimistic reconciliation. */
  pendingIndex: Map<string, number>;
}

// ── Typing state ──────────────────────────────────────────────────────────────

interface TypingState {
  /** userId → timeout handle */
  timers: Map<string, ReturnType<typeof setTimeout>>;
  activeUserIds: Set<string>;
}

// ── Store shape ───────────────────────────────────────────────────────────────

interface MessagingState {
  // ── Conversations ──
  conversations: Map<string, ConversationSummary>;
  conversationOrder: string[];   // ids, sorted by lastMessageAt desc

  // ── Messages per conversation ──
  buffers: Map<string, ConvBuffer>;

  // ── Realtime sync ──
  /** Persisted to localStorage so a page reload doesn't re-trigger a full resync. */
  lastSeenSeq: number;

  // ── Typing ──
  typing: Map<string, TypingState>;  // conversationId → state

  // ── Actions ──

  /** Seed from API response (initial page load). */
  seedConversations(list: ConversationSummary[]): void;

  /** Seed messages for a specific conversation (from paginated fetch). */
  seedMessages(conversationId: string, messages: MessageDTO[]): void;

  /** Optimistically add an outbound message before server confirms. */
  addOptimistic(msg: MessageDTO): void;

  /** Reconcile an optimistic message once the server event arrives. */
  reconcile(clientId: string, confirmed: MessageDTO): void;

  /** Upsert a message from a server event (idempotent by id). */
  upsertMessage(msg: MessageDTO): void;

  /** Update a message's status (delivery/read receipts). */
  updateStatus(messageId: string, conversationId: string, status: MessageStatus, at: string): void;

  /** Apply a conversation patch. */
  patchConversation(conversationId: string, patch: Partial<ConversationSummary>): void;

  /** Record last seen seq to enable gap detection. */
  setLastSeenSeq(seq: number): void;

  /** Typing start. */
  typingStart(conversationId: string, userId: string): void;

  /** Typing stop (or timeout). */
  typingStop(conversationId: string, userId: string): void;

  /** Whether a given userId is typing in a conversation. */
  isTyping(conversationId: string, userId: string): boolean;
}

// ── Helper: insert maintaining ascending timestamp order ──────────────────────

function insertOrdered(msgs: MessageDTO[], msg: MessageDTO): MessageDTO[] {
  const ts = new Date(msg.timestamp).getTime();
  const idx = msgs.findIndex(m => new Date(m.timestamp).getTime() > ts);
  if (idx === -1) return [...msgs, msg];
  const copy = [...msgs];
  copy.splice(idx, 0, msg);
  return copy;
}

function sortedConvOrder(convs: Map<string, ConversationSummary>): string[] {
  return [...convs.keys()].sort((a, b) => {
    const ca = convs.get(a)!;
    const cb = convs.get(b)!;
    const ta = ca.lastMessageAt ? new Date(ca.lastMessageAt).getTime() : 0;
    const tb = cb.lastMessageAt ? new Date(cb.lastMessageAt).getTime() : 0;
    if (cb.isPinned && !ca.isPinned) return 1;
    if (ca.isPinned && !cb.isPinned) return -1;
    return tb - ta;
  });
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMessagingStore = create<MessagingState>((set, get) => ({
  conversations: new Map(),
  conversationOrder: [],
  buffers: new Map(),
  lastSeenSeq: typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('crm-lastSeenSeq') || '0', 10)
    : 0,
  typing: new Map(),

  seedConversations(list) {
    const convs = new Map<string, ConversationSummary>();
    for (const c of list) convs.set(c.id, c);
    set({ conversations: convs, conversationOrder: sortedConvOrder(convs) });
  },

  seedMessages(conversationId, messages) {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const pendingIndex = new Map<string, number>();
    sorted.forEach((m, i) => { if (m.clientId) pendingIndex.set(m.clientId, i); });
    set(s => {
      const buffers = new Map(s.buffers);
      buffers.set(conversationId, { messages: sorted, pendingIndex });
      return { buffers };
    });
  },

  addOptimistic(msg) {
    set(s => {
      const buffers = new Map(s.buffers);
      const buf = buffers.get(msg.conversationId) ?? { messages: [], pendingIndex: new Map() };
      const msgs = insertOrdered(buf.messages, msg);
      const idx = msgs.indexOf(msg);
      const pending = new Map(buf.pendingIndex);
      if (msg.clientId) pending.set(msg.clientId, idx);
      buffers.set(msg.conversationId, { messages: msgs, pendingIndex: pending });
      return { buffers };
    });
  },

  reconcile(clientId, confirmed) {
    set(s => {
      const buffers = new Map(s.buffers);
      const buf = buffers.get(confirmed.conversationId);
      if (!buf) {
        // Buffer doesn't exist yet — just upsert
        get().upsertMessage(confirmed);
        return {};
      }
      const idx = buf.pendingIndex.get(clientId);
      const msgs = [...buf.messages];
      if (idx !== undefined && msgs[idx]?.clientId === clientId) {
        // Replace the optimistic entry with the confirmed one
        msgs[idx] = confirmed;
      } else {
        // Fallback: scan by clientId
        const found = msgs.findIndex(m => m.clientId === clientId);
        if (found !== -1) {
          msgs[found] = confirmed;
        } else {
          // Not found — insert as new
          const reinserted = insertOrdered(msgs, confirmed);
          const pending = new Map(buf.pendingIndex);
          pending.delete(clientId);
          if (confirmed.clientId) pending.delete(confirmed.clientId);
          buffers.set(confirmed.conversationId, { messages: reinserted, pendingIndex: pending });
          return { buffers };
        }
      }
      const pending = new Map(buf.pendingIndex);
      pending.delete(clientId);
      buffers.set(confirmed.conversationId, { messages: msgs, pendingIndex: pending });
      return { buffers };
    });
  },

  upsertMessage(msg) {
    set(s => {
      const buffers = new Map(s.buffers);
      const buf = buffers.get(msg.conversationId) ?? { messages: [], pendingIndex: new Map() };
      const existing = buf.messages.findIndex(m => m.id === msg.id || (msg.clientId && m.clientId === msg.clientId));
      let msgs: MessageDTO[];
      if (existing !== -1) {
        msgs = [...buf.messages];
        msgs[existing] = msg;
      } else {
        msgs = insertOrdered(buf.messages, msg);
      }
      buffers.set(msg.conversationId, { messages: msgs, pendingIndex: buf.pendingIndex });
      return { buffers };
    });
  },

  updateStatus(messageId, conversationId, status, at) {
    set(s => {
      const buffers = new Map(s.buffers);
      const buf = buffers.get(conversationId);
      if (!buf) return {};
      const idx = buf.messages.findIndex(m => m.id === messageId);
      if (idx === -1) return {};
      const msgs = [...buf.messages];
      msgs[idx] = { ...msgs[idx], status, meta: { ...msgs[idx].meta, timestamps: { ...msgs[idx].meta?.timestamps, [status]: at } } };
      buffers.set(conversationId, { ...buf, messages: msgs });
      return { buffers };
    });
  },

  patchConversation(conversationId, patch) {
    set(s => {
      const convs = new Map(s.conversations);
      const existing = convs.get(conversationId) ?? ({ id: conversationId } as ConversationSummary);
      convs.set(conversationId, { ...existing, ...patch });
      return { conversations: convs, conversationOrder: sortedConvOrder(convs) };
    });
  },

  setLastSeenSeq(seq) {
    set(s => {
      const next = Math.max(s.lastSeenSeq, seq);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('crm-lastSeenSeq', String(next)); } catch {}
      }
      return { lastSeenSeq: next };
    });
  },

  typingStart(conversationId, userId) {
    set(s => {
      const typing = new Map(s.typing);
      const state = typing.get(conversationId) ?? { timers: new Map(), activeUserIds: new Set() };

      // Clear existing timeout for this user
      const existing = state.timers.get(userId);
      if (existing) clearTimeout(existing);

      // Auto-stop after 8 seconds
      const timer = setTimeout(() => {
        get().typingStop(conversationId, userId);
      }, 8000);

      const timers = new Map(state.timers);
      timers.set(userId, timer);
      const activeUserIds = new Set(state.activeUserIds);
      activeUserIds.add(userId);

      typing.set(conversationId, { timers, activeUserIds });
      return { typing };
    });
  },

  typingStop(conversationId, userId) {
    set(s => {
      const typing = new Map(s.typing);
      const state = typing.get(conversationId);
      if (!state) return {};

      const existing = state.timers.get(userId);
      if (existing) clearTimeout(existing);

      const timers = new Map(state.timers);
      timers.delete(userId);
      const activeUserIds = new Set(state.activeUserIds);
      activeUserIds.delete(userId);

      typing.set(conversationId, { timers, activeUserIds });
      return { typing };
    });
  },

  isTyping(conversationId, userId) {
    return get().typing.get(conversationId)?.activeUserIds.has(userId) ?? false;
  },
}));
