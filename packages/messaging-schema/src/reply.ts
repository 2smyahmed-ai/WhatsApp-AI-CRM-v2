import type { MessageKind } from './content';

/**
 * Denormalized pointer to a quoted message. Carries enough information to
 * render the reply preview without a JOIN, and to render correctly even if the
 * original message was deleted.
 */
export interface ReplyReference {
  /** Our DB message id, if known at compose / persist time. */
  messageId: string | null;

  /** Provider-issued id of the quoted message (wamid or Baileys key.id). */
  externalId: string | null;

  /** Short text summary shown in the reply quote block. */
  preview: string;

  /** Kind of the quoted message — used to pick the right preview icon. */
  kind: MessageKind;
}
