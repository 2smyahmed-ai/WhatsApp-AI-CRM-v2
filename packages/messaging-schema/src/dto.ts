import type { NormalizedMessage } from './message';
import type { RenderablePayload } from './renderable';
import type { MessageMetadata, MessageOrigin } from './metadata';
import type { CompatibilityMode } from './compatibility';

/**
 * Wire shape for messages traveling from server to client over REST and
 * Socket.IO. Two differences from NormalizedMessage:
 *
 *   1. `raw` is removed (server-only debug data).
 *   2. `metadata` is reduced to a safe `meta` subset (no traceId, no
 *      operational internals).
 *
 * Crucially, `renderable` is included so the client's MessageRenderer can
 * draw the message without any further compilation. This guarantees
 * preview = sent parity (the same RenderablePayload is used for both).
 */
export type MessageDTO = Omit<NormalizedMessage, 'raw' | 'metadata'> & {
  /** Pre-compiled visual structure. The renderer's only input. */
  renderable: RenderablePayload;

  /** Client-safe subset of metadata. */
  meta: MessageMetaDTO;
};

export interface MessageMetaDTO {
  sequenceNumber: number;
  origin: MessageOrigin | null;
  errorReason: string | null;
  errorCode: string | null;
  compatibilityMode: CompatibilityMode;
  timestamps: MessageMetadata['timestamps'];
}
