import type { MessageKind } from './content';
import type { ValidationIssue } from './validation';

/**
 * How aggressively to downgrade an outbound message to guarantee delivery.
 *
 * - `cloud_api`:      maximum fidelity. All interactive, all template features (Meta).
 * - `baileys_native`: Baileys provider. Media renders fully (images, audio, video, docs).
 *                     Interactive messages render visually in CRM but are delivered as
 *                     numbered-text menus via Baileys (WhatsApp Web protocol).
 * - `web_compatible`: avoid features WhatsApp Web renders poorly.
 * - `mobile_safe`:    assume mobile-only audience.
 * - `fallback_text`:  pure text + URLs only. No interactive structures, no media blocks.
 */
export type CompatibilityMode =
  | 'cloud_api'
  | 'baileys_native'
  | 'web_compatible'
  | 'mobile_safe'
  | 'fallback_text';

export const COMPATIBILITY_MODES = [
  'cloud_api',
  'baileys_native',
  'web_compatible',
  'mobile_safe',
  'fallback_text',
] as const;

/**
 * Record of how a NormalizedMessage was compiled to a RenderablePayload.
 * Stored on the payload so the renderer can display a "downgraded" badge and
 * analytics can track delivery-quality vs intent.
 */
export interface CompatibilityReport {
  /** The mode the compiler ran in. */
  mode: CompatibilityMode;

  /** The kind the caller asked for. */
  originalKind: MessageKind;

  /** The kind we actually produced (may differ if downgraded). */
  effectiveKind: MessageKind;

  /** True if the compiler reshaped the content to fit the mode. */
  downgraded: boolean;

  /** Human-readable reason — e.g. "Baileys does not support quick-reply buttons". */
  downgradeReason: string | null;

  /** Non-blocking issues surfaced during compilation. */
  warnings: ValidationIssue[];
}
