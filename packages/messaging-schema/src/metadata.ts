import type { CompatibilityMode } from './compatibility';
import type { MessageStatus } from './status';

/**
 * Cross-cutting metadata attached to every message.
 *
 * Keeps the top-level NormalizedMessage shape focused on identity and content,
 * while still capturing the operational signals needed for ordering, tracing,
 * retries, and analytics.
 */
export interface MessageMetadata {
  /** Server-issued monotonic counter. Used by the realtime store for
   *  ordering and gap detection. */
  sequenceNumber: number;

  /** Correlation ID for log grep across services / queue boundaries. */
  traceId: string;

  /** Number of times we've attempted to send (outbound only). */
  attemptCount: number;

  /** Human-readable error from the last failed attempt. */
  errorReason: string | null;

  /** Provider error code, e.g. "131047". Drives richer UI handling. */
  errorCode: string | null;

  /** Mode used by the compatibility compiler. Mirrors
   *  RenderablePayload.compatibility.mode for query convenience. */
  compatibilityMode: CompatibilityMode;

  /** Per-state timestamps, ISO-8601. Each transition stamps an entry. */
  timestamps: Partial<Record<MessageStatus, string>>;

  /** Where the outbound message originated. Null for inbound. */
  origin: MessageOrigin | null;

  /** If origin is automation / flow / broadcast / agent, the source entity. */
  originRef: OriginRef | null;

  /** Was the provider raw payload preserved on the row? */
  rawRetained: boolean;
}

export type MessageOrigin = 'agent' | 'automation' | 'broadcast' | 'flow' | 'api';

export interface OriginRef {
  automationRuleId?: string;
  flowExecutionId?: string;
  broadcastId?: string;
  agentUserId?: string;
}
