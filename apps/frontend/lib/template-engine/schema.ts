// ─── Canonical Template Schema ────────────────────────────────────────────────
// Single source of truth for all template operations.
// Baileys-first: a template is either a plain text message or a media message
// (image / video / document) with a caption. Nothing else — no buttons, no
// footer, no interactive configuration, because Baileys cannot send those
// reliably. This keeps creation dead-simple and delivery 100% faithful.

export type TemplateCategory =
  | 'GENERAL'
  | 'ONBOARDING'
  | 'SALES'
  | 'SUPPORT'
  | 'ECOMMERCE'
  | 'APPOINTMENTS'
  | 'FOLLOW_UP'
  | string  // allow legacy DB values

export type TemplateLanguage = string // 'en_US' | 'ar' | 'fr' | 'es' | etc.

// ── Message type ────────────────────────────────────────────────────────────────
// The single choice a user makes: what kind of message is this?

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO'

/** AUDIO covers a recorded voice note and an uploaded audio clip alike. */
export type MediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO'

// ── Media ────────────────────────────────────────────────────────────────────
// Present only for image / video / document / audio templates. The message text
// lives in `body` and is sent as the caption (audio carries no caption).

export interface CanonicalMedia {
  type: MediaType
  url?: string       // resolved URL after upload
  filename?: string  // shown for documents
  mimeType?: string
}

// ── Canonical Template ────────────────────────────────────────────────────────

export interface CanonicalTemplate {
  name: string
  category: TemplateCategory
  language: TemplateLanguage

  media?: CanonicalMedia  // present for image/video/document messages
  body: { text: string }  // the message text (caption for media). Max 4096 chars.

  // Internal metadata — stored in DB
  _meta?: {
    variableNames?: string[]               // ordered: ["name","order_id"]
    description?: string                   // shown in presets library
    previewValues?: Record<string, string> // sample values for live preview
  }
}

// ── Renderable ────────────────────────────────────────────────────────────────
// Output of toRenderable() — what the preview panel consumes.

export interface RenderableTemplate {
  media?: {
    type: MediaType
    url?: string
    filename?: string
    mimeType?: string
  }
  body: string
}

// ── Validation types ──────────────────────────────────────────────────────────

export type ValidationLevel = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  level: ValidationLevel
  field?: 'name' | 'category' | 'language' | 'media' | 'body'
  message: string
}

export interface ValidationResult {
  valid: boolean     // no errors
  sendable: boolean  // valid + ready to send via Baileys
  issues: ValidationIssue[]
  errors: number
  warnings: number
}

// ── DB storage shape ──────────────────────────────────────────────────────────
// `MessageTemplate.payload` is stored as one of:
//   - CanonicalTemplate  (new format, detected by presence of `.body.text`)
//   - LegacyPayload      (old builder format, detected by presence of `.blocks`)

export interface LegacyPayload {
  blocks: any[]
  category?: string
}

export function isCanonicalPayload(payload: any): payload is CanonicalTemplate {
  return payload != null && typeof payload === 'object' && typeof payload.body?.text === 'string'
}

export function isLegacyPayload(payload: any): payload is LegacyPayload {
  return payload != null && typeof payload === 'object' && Array.isArray(payload.blocks)
}

// ── Language options ──────────────────────────────────────────────────────────

export const TEMPLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'ar',    label: 'Arabic' },
  { code: 'fr',    label: 'French' },
  { code: 'es',    label: 'Spanish' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'de',    label: 'German' },
  { code: 'it',    label: 'Italian' },
  { code: 'tr',    label: 'Turkish' },
  { code: 'id',    label: 'Indonesian' },
]

// ── Category options ──────────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string; desc: string }[] = [
  { value: 'GENERAL',      label: 'General',      desc: 'General purpose messages' },
  { value: 'ONBOARDING',   label: 'Onboarding',   desc: 'Welcome and onboarding flows' },
  { value: 'SALES',        label: 'Sales',         desc: 'Promotions, offers, win-back' },
  { value: 'SUPPORT',      label: 'Support',       desc: 'Customer support and tickets' },
  { value: 'ECOMMERCE',    label: 'E-commerce',    desc: 'Orders, shipping, payments' },
  { value: 'APPOINTMENTS', label: 'Appointments',  desc: 'Bookings and reminders' },
  { value: 'FOLLOW_UP',    label: 'Follow-up',     desc: 'Follow-ups and feedback' },
]
