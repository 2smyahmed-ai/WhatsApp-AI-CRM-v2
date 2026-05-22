import type { MessageKind } from './content';
import type { MediaType } from './media';
import type { CompatibilityMode } from './compatibility';

/**
 * What a provider supports overall. Built once per provider; read by the
 * builder UI to gate options, and by the send pipeline as the first gate
 * before per-payload validation.
 */
export interface ProviderCapabilities {
  /** Per-kind support flags. */
  kinds: Record<MessageKind, KindCapability>;

  /** Button-related numeric limits. */
  buttonLimits: ButtonLimits;

  /** List-related numeric limits. */
  listLimits: ListLimits;

  /** Per-media-type size + MIME constraints. */
  mediaLimits: Record<MediaType, MediaLimit>;

  /** Time-since-last-inbound limit for free-form text. Null = no window. */
  sessionWindow: { hours: number } | null;

  /** Template support and approval flow. */
  templates: { supported: boolean; requiresApproval: boolean };

  /** Whether sending reactions is supported. */
  reactions: { supported: boolean };

  /** Mode the provider uses if the caller does not specify one. */
  defaultMode: CompatibilityMode;
}

export interface KindCapability {
  inbound: boolean;
  outbound: boolean;
  /** Optional human-readable note for tooltips. */
  notes?: string;
}

export interface ButtonLimits {
  /** Max quick-reply buttons in an interactive_buttons message. */
  quickReplyMax: number;
  /** Max chars per quick-reply button title. */
  quickReplyTitleMax: number;
  /** Max CTA URL buttons in an interactive_cta. */
  ctaMax: number;
}

export interface ListLimits {
  /** Max sections in an interactive_list. */
  sectionsMax: number;
  /** Max rows per section. */
  rowsPerSectionMax: number;
  /** Max chars per row title. */
  rowTitleMax: number;
}

export interface MediaLimit {
  /** Maximum file size in megabytes. */
  sizeMaxMb: number;
  /** Allowed MIME types. Empty array = any MIME of the broader class. */
  mimeWhitelist: string[];
}

/**
 * Result of `provider.supports(kind, direction)` — the coarse check used at
 * builder-edit time and as the first gate in the send pipeline.
 */
export type CapabilityResult =
  | { ok: true }
  | { ok: false; reason: string; suggestion?: string };
