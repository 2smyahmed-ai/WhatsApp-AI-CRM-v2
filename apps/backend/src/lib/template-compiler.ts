// ─── Backend Template Compiler ────────────────────────────────────────────────
// A template is a plain text message OR a media message (image/video/document/
// audio) with a caption. No buttons, no footer — Baileys sends exactly this, so
// the recipient always gets what the builder previewed.
//
// Converts a stored MessageTemplate.payload into a Renderable used for sending.

// ── Types ─────────────────────────────────────────────────────────────────────

export type TemplateCategory =
  | 'GENERAL' | 'ONBOARDING' | 'SALES' | 'SUPPORT'
  | 'ECOMMERCE' | 'APPOINTMENTS' | 'FOLLOW_UP'
  | string

/** AUDIO covers both a recorded voice note and an uploaded audio clip. */
export type MediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO'

export interface CanonicalMedia {
  type: MediaType
  /** Storage-relative ref (see lib/media.ts), never an absolute URL. */
  url?: string
  filename?: string
  mimeType?: string
}

export interface CanonicalTemplate {
  name: string
  category: TemplateCategory
  language: string
  media?: CanonicalMedia
  body: { text: string }
  _meta?: {
    variableNames?: string[]
    previewValues?: Record<string, string>
    description?: string
  }
}

export interface RenderableTemplate {
  media?: { type: MediaType; url?: string; filename?: string; mimeType?: string }
  body: string
}

// ── Payload detection ─────────────────────────────────────────────────────────

export function isCanonicalPayload(payload: unknown): payload is CanonicalTemplate {
  return (
    payload != null &&
    typeof payload === 'object' &&
    typeof (payload as any).body?.text === 'string'
  )
}

export function isLegacyPayload(payload: unknown): payload is { blocks: any[]; category?: string } {
  return (
    payload != null &&
    typeof payload === 'object' &&
    Array.isArray((payload as any).blocks)
  )
}

// ── Variable interpolation ────────────────────────────────────────────────────

function interpolateNamed(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `[${k}]`)
}

function resolveText(text: string, varNames: string[], vars: Record<string, string>): string {
  let result = text
  varNames.forEach((name, i) => {
    result = result.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), vars[name] ?? `[${name}]`)
  })
  return interpolateNamed(result, vars)
}

// ── Renderable Compiler ───────────────────────────────────────────────────────

export function toRenderable(
  template: CanonicalTemplate,
  vars: Record<string, string> = {},
): RenderableTemplate {
  const varNames = template._meta?.variableNames ?? []
  const resolve = (text: string) => resolveText(text, varNames, vars)

  const renderable: RenderableTemplate = { body: resolve(template.body.text) }
  if (template.media) {
    renderable.media = {
      type: template.media.type,
      url: template.media.url,
      filename: template.media.filename,
      mimeType: template.media.mimeType,
    }
  }
  return renderable
}

// ── Variable extraction ───────────────────────────────────────────────────────

export function extractVariableNames(template: CanonicalTemplate): string[] {
  const vars = new Set<string>()
  for (const m of (template.body.text ?? '').matchAll(/\{\{(\w+)\}\}/g)) vars.add(m[1])
  return Array.from(vars)
}

// ── Legacy fold ────────────────────────────────────────────────────────────────
// Templates saved before this redesign may carry a text header, footer, and
// buttons. Fold that content into the message body so nothing is lost, and keep
// only a media attachment (if any).

export function foldLegacyCanonical(raw: any): CanonicalTemplate {
  const parts: string[] = []
  const header = raw?.header

  if (header?.type === 'TEXT' && header.text?.trim()) parts.push(`*${header.text.trim()}*`)
  if (raw?.body?.text?.trim()) parts.push(raw.body.text.trim())
  if (raw?.footer?.text?.trim()) parts.push(`_${raw.footer.text.trim()}_`)

  if (Array.isArray(raw?.buttons)) {
    for (const b of raw.buttons) {
      if (b?.type === 'URL' && b.url) parts.push(`${b.text ? b.text + ': ' : ''}${b.url}`)
      else if (b?.type === 'PHONE_NUMBER' && b.phone_number) parts.push(`${b.text ? b.text + ': ' : ''}${b.phone_number}`)
    }
  }

  const media: CanonicalMedia | undefined =
    header && header.type !== 'TEXT' && header.type
      ? { type: header.type as MediaType, url: header.url, filename: header.filename, mimeType: header.mimeType }
      : raw?.media
      ? { type: raw.media.type as MediaType, url: raw.media.url, filename: raw.media.filename, mimeType: raw.media.mimeType }
      : undefined

  const canonical: CanonicalTemplate = {
    name: raw?.name ?? 'Template',
    category: raw?.category ?? 'GENERAL',
    language: raw?.language ?? 'en_US',
    body: { text: parts.join('\n\n') },
    _meta: raw?._meta,
  }
  if (media) canonical.media = media
  return canonical
}

// ── Legacy blocks → Canonical ─────────────────────────────────────────────────

export function legacyBlocksToCanonical(
  blocks: any[],
  name: string,
  category?: string,
  language?: string,
): CanonicalTemplate {
  const textBlocks = blocks.filter(b => b.type === 'text')
  const mediaBlock = blocks.find(b => b.type === 'media')

  const titleBlock  = textBlocks.find((b: any) => b.style === 'title')
  const bodyBlocks  = textBlocks.filter((b: any) => b.style !== 'title' && b.style !== 'footer')
  const footerBlock = textBlocks.find((b: any) => b.style === 'footer')

  const parts: string[] = []
  if (titleBlock?.content) parts.push(`*${titleBlock.content}*`)
  parts.push(...bodyBlocks.map((b: any) => b.content).filter(Boolean))
  if (footerBlock?.content) parts.push(`_${footerBlock.content}_`)

  const canonical: CanonicalTemplate = {
    name,
    category: category ?? 'GENERAL',
    language: language ?? 'en_US',
    body: { text: parts.join('\n\n') || 'Hello {{name}}' },
  }

  if (mediaBlock?.url) {
    const type: MediaType = mediaBlock.mediaType === 'image' ? 'IMAGE'
      : mediaBlock.mediaType === 'video' ? 'VIDEO' : 'DOCUMENT'
    canonical.media = { type, url: mediaBlock.url }
  }

  return canonical
}
