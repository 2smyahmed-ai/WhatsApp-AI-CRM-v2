// ─── Canonical Template Schema ────────────────────────────────────────────────
// Single source of truth for all template operations.
// Used by: builder state, validator, preview renderer, Meta compiler, Baileys compiler, DB storage.

export type MetaCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type Provider = 'meta' | 'baileys'
export type TemplateLanguage = string // 'en_US' | 'ar' | 'fr' | 'es' | etc.

// ── Header ────────────────────────────────────────────────────────────────────

export type TextHeader = {
  type: 'TEXT'
  text: string // max 60 chars, at most 1 {{variable}}
}

export type ImageHeader = {
  type: 'IMAGE'
  url?: string
  handle?: string // Meta media handle (from upload API)
}

export type VideoHeader = {
  type: 'VIDEO'
  url?: string
  handle?: string
}

export type DocumentHeader = {
  type: 'DOCUMENT'
  url?: string
  filename?: string
  handle?: string
}

export type CanonicalHeader = TextHeader | ImageHeader | VideoHeader | DocumentHeader

// ── Buttons ───────────────────────────────────────────────────────────────────

export type QuickReplyButton = {
  type: 'QUICK_REPLY'
  text: string // max 25 chars
}

export type UrlButton = {
  type: 'URL'
  text: string  // max 25 chars
  url: string   // can include {{1}} for dynamic suffix
}

export type PhoneButton = {
  type: 'PHONE_NUMBER'
  text: string
  phone_number: string
}

export type CanonicalButton = QuickReplyButton | UrlButton | PhoneButton

export type ButtonGroupType = 'QUICK_REPLY' | 'CALL_TO_ACTION'

// ── Canonical Template ────────────────────────────────────────────────────────

export interface CanonicalTemplate {
  name: string
  category: MetaCategory
  language: TemplateLanguage

  header?: CanonicalHeader  // optional
  body: { text: string }    // required, max 1024 chars, supports {{name}} or {{1}}
  footer?: { text: string } // optional, max 60 chars, NO variables
  buttons?: CanonicalButton[] // optional, max 3 QR or max 2 CTA (1 URL + 1 PHONE)

  // Internal metadata — stored in DB, not sent to Meta
  _meta?: {
    variableNames?: string[]              // ordered: ["name","order_id"] → {{1}},{{2}}
    description?: string                  // shown in presets library
    previewValues?: Record<string, string> // sample values for live preview
  }
}

// ── Renderable ────────────────────────────────────────────────────────────────
// Output of toRenderable() — what the MessageRenderer and preview panel consume.

export interface RenderableTemplate {
  header?: {
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
    text?: string
    url?: string
    filename?: string
  }
  body: string
  footer?: string
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
    text: string
    url?: string
    phone?: string
  }>
}

// ── Meta API types ────────────────────────────────────────────────────────────

export type MetaComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'

export interface MetaComponent {
  type: MetaComponentType
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  buttons?: MetaApiButton[]
  example?: {
    header_handle?: string[]
    header_url?: string[]
    header_text?: string[]
    body_text?: string[][]
  }
}

export interface MetaApiButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  text: string
  url?: string
  phone_number?: string
}

// ── Validation types ──────────────────────────────────────────────────────────

export type ValidationLevel = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  level: ValidationLevel
  field?: 'name' | 'category' | 'language' | 'header' | 'body' | 'footer' | 'buttons'
  message: string
  downgrade?: string // what Baileys will do when this feature is unsupported
}

export interface ValidationResult {
  valid: boolean           // no errors
  metaReady: boolean       // valid + all required Meta fields present
  baileysSupported: boolean // always true — Baileys always has a plaintext fallback
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

export const META_CATEGORIES: { value: MetaCategory; label: string; desc: string }[] = [
  { value: 'MARKETING',       label: 'Marketing',       desc: 'Promotions, offers, announcements' },
  { value: 'UTILITY',         label: 'Utility',         desc: 'Order updates, alerts, reminders' },
  { value: 'AUTHENTICATION',  label: 'Authentication',  desc: 'OTPs and verification codes' },
]
