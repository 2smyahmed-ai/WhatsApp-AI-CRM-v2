import type { RenderablePayload } from './renderable';
import type { CompatibilityMode } from './compatibility';

/**
 * Result of `provider.validate(payload, context)`. Surfaces both blocking
 * errors and non-blocking warnings, and optionally a suggested downgrade
 * that would pass validation.
 */
export interface ValidationResult {
  /** False if `errors.length > 0`. */
  ok: boolean;

  /** Blocking issues. If non-empty, the message must not be sent. */
  errors: ValidationIssue[];

  /** Non-blocking issues. Surface in the builder; allow send. */
  warnings: ValidationIssue[];

  /** A payload that would pass validation, if the validator can suggest one. */
  suggestedDowngrade?: RenderablePayload;
}

/**
 * Context the validator needs that isn't on the payload — conversation state,
 * template approval state, etc.
 */
export interface ValidationContext {
  conversation: {
    /** ISO-8601 of the last inbound message — null if customer never wrote. */
    lastInboundAt: string | null;
    compatibilityMode: CompatibilityMode;
  };
  /** Only relevant for kind=template. */
  templateApproval?: {
    metaStatus: string | null; // 'PENDING' | 'APPROVED' | 'REJECTED' | ...
  };
}

/**
 * A single validation issue. `path` uses dotted notation into the
 * RenderablePayload (e.g. "blocks[3].title") so the builder can highlight
 * the exact element.
 */
export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  path: string;
  /** True if the issue could be automatically corrected (length truncation,
   *  reformat, etc.). */
  fixable: boolean;
}

/**
 * Canonical validation issue codes. Stable contract — code values are the
 * machine-readable identifier; do not rename. Add new codes; never repurpose
 * existing ones.
 */
export type ValidationIssueCode =
  | 'BUTTON_COUNT_EXCEEDED'
  | 'BUTTON_TITLE_TOO_LONG'
  | 'LIST_ROW_COUNT_EXCEEDED'
  | 'LIST_SECTION_COUNT_EXCEEDED'
  | 'LIST_ROW_TITLE_TOO_LONG'
  | 'MEDIA_TOO_LARGE'
  | 'MEDIA_MIME_UNSUPPORTED'
  | 'MEDIA_MISSING_URL'
  | 'TEMPLATE_NOT_APPROVED'
  | 'TEMPLATE_VARIABLE_MISSING'
  | 'TEMPLATE_INVALID_COMPONENTS'
  | 'SESSION_WINDOW_CLOSED'
  | 'EMPTY_BODY'
  | 'BODY_TOO_LONG'
  | 'URL_INVALID'
  | 'PHONE_INVALID'
  | 'UNSUPPORTED_KIND'
  | 'UNKNOWN';
