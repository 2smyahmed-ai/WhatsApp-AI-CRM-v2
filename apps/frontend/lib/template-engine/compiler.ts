import type {
  CanonicalTemplate,
  TemplateCategory,
  RenderableTemplate,
  MediaType,
} from './schema'

// ── Variable interpolation ────────────────────────────────────────────────────

function interpolateNamed(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `[${k}]`)
}

function interpolatePositional(text: string, varNames: string[], vars: Record<string, string>): string {
  let result = text
  varNames.forEach((name, i) => {
    result = result.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), vars[name] ?? `[${name}]`)
  })
  return interpolateNamed(result, vars)
}

function resolveText(text: string, varNames: string[], vars: Record<string, string>): string {
  return interpolatePositional(text, varNames, vars)
}

// ── Renderable Compiler ───────────────────────────────────────────────────────
// Output used by the preview panel. The recipient receives exactly this — a
// media attachment (if any) plus the message text as caption/body.

export function toRenderable(
  template: CanonicalTemplate,
  vars: Record<string, string> = {},
): RenderableTemplate {
  const varNames = template._meta?.variableNames ?? []
  const resolve = (text: string) => resolveText(text, varNames, vars)

  const renderable: RenderableTemplate = {
    body: resolve(template.body.text),
  }

  if (template.media) {
    renderable.media = {
      type: template.media.type,
      url: template.media.url,
      filename: template.media.filename,
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

// ── Derive template type for DB ────────────────────────────────────────────────

export function deriveTemplateType(template: CanonicalTemplate): 'TEXT' | 'MEDIA' {
  return template.media ? 'MEDIA' : 'TEXT'
}

// ── Legacy fold ────────────────────────────────────────────────────────────────
// Older templates stored a text header, a footer and buttons. Those features no
// longer exist, so when opening such a template we fold their content into the
// message body (so nothing the user wrote is lost) and keep only media headers.

export function foldLegacyCanonical(raw: any, fallback: {
  name: string; category?: string; language?: string;
}): CanonicalTemplate {
  const parts: string[] = []

  const header = raw?.header
  if (header?.type === 'TEXT' && header.text?.trim()) {
    parts.push(`*${header.text.trim()}*`)
  }

  if (raw?.body?.text?.trim()) parts.push(raw.body.text.trim())

  if (raw?.footer?.text?.trim()) parts.push(`_${raw.footer.text.trim()}_`)

  // Fold old buttons into readable text lines so links/labels aren't lost.
  if (Array.isArray(raw?.buttons)) {
    for (const b of raw.buttons) {
      if (b?.type === 'URL' && b.url) parts.push(`${b.text ? b.text + ': ' : ''}${b.url}`)
      else if (b?.type === 'PHONE_NUMBER' && b.phone_number) parts.push(`${b.text ? b.text + ': ' : ''}${b.phone_number}`)
    }
  }

  const media = header && header.type !== 'TEXT' && (header.url || header.type)
    ? { type: header.type as MediaType, url: header.url, filename: header.filename }
    : raw?.media
    ? { type: raw.media.type as MediaType, url: raw.media.url, filename: raw.media.filename }
    : undefined

  const canonical: CanonicalTemplate = {
    name: raw?.name ?? fallback.name,
    category: (raw?.category ?? fallback.category ?? 'GENERAL') as TemplateCategory,
    language: raw?.language ?? fallback.language ?? 'en_US',
    body: { text: parts.join('\n\n') },
    _meta: raw?._meta,
  }
  if (media) canonical.media = media
  return canonical
}

// ── Legacy blocks → Canonical ─────────────────────────────────────────────────
// Converts the oldest block-based builder format to the new canonical shape.

export function legacyBlocksToCanonical(
  blocks: any[],
  name: string,
  category?: string,
  language?: string,
): CanonicalTemplate {
  const textBlocks  = blocks.filter(b => b.type === 'text')
  const mediaBlock  = blocks.find(b => b.type === 'media')

  const titleBlock  = textBlocks.find((b: any) => b.style === 'title')
  const bodyBlocks  = textBlocks.filter((b: any) => b.style !== 'title' && b.style !== 'footer')
  const footerBlock = textBlocks.find((b: any) => b.style === 'footer')

  const parts: string[] = []
  if (titleBlock?.content) parts.push(`*${titleBlock.content}*`)
  parts.push(...bodyBlocks.map((b: any) => b.content).filter(Boolean))
  if (footerBlock?.content) parts.push(`_${footerBlock.content}_`)

  const canonical: CanonicalTemplate = {
    name,
    category: (category ?? 'GENERAL') as TemplateCategory,
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
