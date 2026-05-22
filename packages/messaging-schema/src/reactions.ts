/**
 * Reactions modify other messages; they are NOT bubbles themselves.
 * Normalizers intercept reaction payloads and emit ReactionEvents to the
 * reaction bus instead of producing a NormalizedMessage.
 *
 * `emoji === ''` represents a reaction removal.
 */
export interface ReactionEvent {
  conversationId: string;

  /** Provider-issued id of the message being reacted to. */
  targetExternalId: string;

  /** Our DB id of the message being reacted to, if resolvable. */
  targetMessageId: string | null;

  /** Empty string = removal. */
  emoji: string;

  /** Who reacted — a contact (inbound) or an agent (outbound). */
  reactor: ReactionActor;

  /** ISO-8601 wall-clock time. */
  timestamp: string;
}

export type ReactionActor =
  | { kind: 'contact'; phone: string }
  | { kind: 'user'; userId: string };
