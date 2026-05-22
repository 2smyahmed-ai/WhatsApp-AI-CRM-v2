import type { ProviderName } from './provider';
import type { MessageContent } from './content';
import type { MessageStatus, MessageDirection } from './status';
import type { MessageMetadata } from './metadata';
import type { ReplyReference } from './reply';

/**
 * The canonical message shape. Single source of truth across:
 *   - persistence
 *   - rendering (via the compiled RenderablePayload — see renderable.ts)
 *   - sending (via provider compilers)
 *   - realtime sync (via MessageDTO — see dto.ts)
 *   - analytics
 *   - automations / campaigns / notifications
 *
 * Backend-only. The client receives MessageDTO instead — `raw` is stripped
 * before going over the wire.
 */
export interface NormalizedMessage {
  /** Schema version. Bump on breaking changes. Renderers reject unknown majors. */
  schemaVersion: 1;

  /** Internal DB ID. Null until persisted. */
  id: string | null;

  /** Caller-issued idempotency key. Pair (clientId, conversationId) is unique.
   *  Required for new outbound flows; server generates one if a legacy caller
   *  omits it. */
  clientId: string;

  /** Provider-issued ID — wamid for Meta, key.id for Baileys. Null until the
   *  provider accepts (status >= provider_accepted). */
  externalId: string | null;

  /** Which transport produced (inbound) or will deliver (outbound) this message. */
  provider: ProviderName;

  /** Provider session: Meta phone_number_id, Baileys JID. */
  sessionId: string;

  /** Foreign keys. */
  conversationId: string;
  contactPhone: string;
  teamId: string | null;

  /** Direction. Never derived from `fromMe` — read this field. */
  direction: MessageDirection;

  /** Discriminated content union. */
  content: MessageContent;

  /** Lifecycle status. */
  status: MessageStatus;

  /** Cross-cutting metadata: sequence number, trace, errors, origin. */
  metadata: MessageMetadata;

  /** Optional reply pointer. Denormalized for self-contained rendering. */
  reply: ReplyReference | null;

  /** Wall-clock time. Provider timestamp for inbound; server time for outbound. */
  timestamp: string;

  /** Provider raw payload. Server-side only — stripped before sending to clients.
   *  Preserved for debugging, replay, and forward compatibility with unknown kinds. */
  raw: unknown;
}
