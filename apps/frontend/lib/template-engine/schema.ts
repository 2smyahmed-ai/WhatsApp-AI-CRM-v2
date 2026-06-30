// ─── Canonical Template Schema ────────────────────────────────────────────────
// Single source of truth for all template operations.
// Baileys-first: templates are reusable WhatsApp message compositions.
// No Meta approval required. All types reflect what Baileys can actually send.

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

// ── Header ────────────────────────────────────────────────────────────────────

export type TextHeader = {
  type: 'TEXT'
  text: string // max 60 chars, at most 1 {{variable}}
}

export type ImageHeader = {
  type: 'IMAGE'
  url?: string
}

export type VideoHeader = {
  type: 'VIDEO'
  url?: string
}

export type DocumentHeader = {
  type: 'DOCUMENT'
  url?: string
  filename?: string
}

export type CanonicalHeader = TextHeader | ImageHeader | VideoHeader | DocumentHeader

// ── Buttons ───────────────────────────────────────────────────────────────────

export type QuickReplyButton = {
  type: 'QUICK_REPLY'
  text: string // max 60 chars (Baileys; auto-downgraded to numbered text)
}

export type UrlButton = {
  type: 'URL'
  text: string  // max 25 chars
  url: string   // can include {{variable}} for dynamic suffix
}

export type PhoneButton = {
  type: 'PHONE_NUMBER'
  text: string
  phone_number: string
}

export type CanonicalButton = QuickReplyButton | UrlButton | PhoneButton

// ── Canonical Template ────────────────────────────────────────────────────────

export interface CanonicalTemplate {
  name: string
  category: TemplateCategory
  language: TemplateLanguage

  header?: CanonicalHeader  // optional
  body: { text: string }    // required, max 4096 chars (WhatsApp limit)
  footer?: { text: string } // optional, max 60 chars, NO variables
  buttons?: CanonicalButton[] // optional — sent as numbered text via Baileys

  // Internal metadata — stored in DB
  _meta?: {
    variableNames?: string[]               // ordered: ["name","order_id"]
    description?: string                   // shown in presets library
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

// ── Validation types ──────────────────────────────────────────────────────────

export type ValidationLevel = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  level: ValidationLevel
  field?: 'name' | 'category' | 'language' | 'header' | 'body' | 'footer' | 'buttons'
  message: string
  downgrade?: string // what Baileys will do (auto-format)
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
