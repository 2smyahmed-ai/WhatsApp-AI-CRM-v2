import type { MessageDTO } from './dto';
import type { MessageStatus } from './status';
import type { ReactionEvent } from './reactions';

/**
 * Envelope for every realtime event.
 *
 * The realtime store applies events idempotently (by `eventId`) and
 * detects gaps in `seq` to trigger resync.
 */
export interface RealtimeEvent<T = unknown> {
  /** Per-team monotonic sequence number. */
  seq: number;

  /** Idempotency key. Same event delivered twice has the same id. */
  eventId: string;

  /** Event name from the closed enum. */
  type: RealtimeEventType;

  /** Tenancy scope. */
  teamId: string;

  /** Typed payload — see EventPayloads below for the per-type shape. */
  payload: T;

  /** Server time, ISO-8601. */
  timestamp: string;

  /** Schema version of the payload. */
  v: 1;
}

/**
 * The closed list of event types. Past-tense — each one describes a fact
 * that has already happened on the server.
 */
export type RealtimeEventType =
  | 'message.created'
  | 'message.status_changed'
  | 'message.reaction_changed'
  | 'conversation.created'
  | 'conversation.updated'
  | 'conversation.assigned'
  | 'conversation.snoozed'
  | 'broadcast.progress'
  | 'broadcast.completed'
  | 'provider.status_changed'
  | 'presence.typing';

// ── Per-event payload shapes ─────────────────────────────────────────────────

export interface MessageCreatedPayload {
  message: MessageDTO;
  isNewContact?: boolean;
}

export interface MessageStatusChangedPayload {
  messageId: string;
  conversationId: string;
  status: MessageStatus;
  /** ISO-8601 — when the new state was observed. */
  at: string;
  /** Provider error code, if the transition is to `failed`. */
  errorCode?: string | null;
  errorReason?: string | null;
}

export interface MessageReactionChangedPayload {
  conversationId: string;
  messageId: string;
  /** Full current set of reactions on the message (replace semantics). */
  reactions: ReactionState[];
}

export interface ReactionState {
  /** Empty string is filtered out of this list — removals reduce the array. */
  emoji: string;
  reactor: ReactionEvent['reactor'];
}

export interface ConversationCreatedPayload {
  conversationId: string;
  contactPhone: string;
}

export interface ConversationUpdatedPayload {
  conversationId: string;
  /** Patch — only the fields that changed. */
  patch: {
    status?: string;
    priority?: string;
    snoozedUntil?: string | null;
    lastMessageAt?: string;
    lastMessagePreview?: string;
    isPinned?: boolean;
    pipeline?: string | null;
    /** Derived from messages on the client; included server-side for
     *  late-joining clients. */
    unreadCount?: number;
  };
}

export interface ConversationAssignedPayload {
  conversationId: string;
  assignedTo: string | null;
  assignedTeamId: string | null;
}

export interface ConversationSnoozedPayload {
  conversationId: string;
  snoozedUntil: string | null;
}

export interface BroadcastProgressPayload {
  broadcastId: string;
  sent: number;
  failed: number;
  total: number;
}

export interface BroadcastCompletedPayload {
  broadcastId: string;
  sent: number;
  failed: number;
  total: number;
  status: 'SENT' | 'FAILED' | 'PAUSED';
}

export interface ProviderStatusChangedPayload {
  provider: string;
  status: 'connected' | 'disconnected' | 'connecting';
  connectedPhone?: string | null;
  qr?: string | null;
}

export interface PresenceTypingPayload {
  conversationId: string;
  userId: string;
  state: 'start' | 'stop';
}

/**
 * Convenience type-map for event payload narrowing.
 *
 *   function handle<E extends RealtimeEventType>(
 *     type: E,
 *     payload: EventPayloads[E]
 *   ) { ... }
 */
export interface EventPayloads {
  'message.created': MessageCreatedPayload;
  'message.status_changed': MessageStatusChangedPayload;
  'message.reaction_changed': MessageReactionChangedPayload;
  'conversation.created': ConversationCreatedPayload;
  'conversation.updated': ConversationUpdatedPayload;
  'conversation.assigned': ConversationAssignedPayload;
  'conversation.snoozed': ConversationSnoozedPayload;
  'broadcast.progress': BroadcastProgressPayload;
  'broadcast.completed': BroadcastCompletedPayload;
  'provider.status_changed': ProviderStatusChangedPayload;
  'presence.typing': PresenceTypingPayload;
}

/**
 * Resync protocol: the client emits this when a gap is detected, the server
 * replies with a batch of historical RealtimeEvents.
 */
export interface ResyncRequest {
  teamId: string;
  fromSeq: number;
  /** Optional cap — server may further truncate. */
  limit?: number;
}

export interface ResyncBatch {
  events: RealtimeEvent[];
  /** True if more events remain past the returned batch. */
  hasMore: boolean;
  /** Server's highest known seq at request time. */
  latestSeq: number;
}
