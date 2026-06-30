import type {
  CanonicalTemplate,
  TemplateCategory,
  RenderableTemplate,
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

// ── Baileys Compiler ──────────────────────────────────────────────────────────
// Converts a canonical template to WhatsApp-sendable messages via Baileys.
// Buttons auto-downgrade to numbered text. Footer appended in italics.

export function toBaileysPayload(
  template: CanonicalTemplate,
  vars: Record<string, string> = {},
): { messages: string[]; hasInteractiveFallback: boolean } {
  const varNames = template._meta?.variableNames ?? []
  const resolve = (text: string) => resolveText(text, varNames, vars)

  const messages: string[] = []

  // Media header — send as a separate URL/caption first
  if (template.header) {
    const h = template.header
    if (h.type === 'TEXT') {
      messages.push(`*${resolve(h.text)}*`)
    } else if (h.url) {
      messages.push(h.url)
    }
  }

  // Body + footer + button auto-downgrade
  let body = resolve(template.body.text)

  if (template.footer?.text) {
    body += `\n\n_${template.footer.text}_`
  }

  const hasInteractiveFallback = (template.buttons?.length ?? 0) > 0
  if (hasInteractiveFallback && template.buttons) {
    body += '\n'
    template.buttons.forEach((btn, i) => {
      if (btn.type === 'QUICK_REPLY') {
        body += `\n${i + 1}. ${btn.text}`
      } else if (btn.type === 'URL') {
        body += `\n🔗 ${btn.text}: ${resolve(btn.url)}`
      } else if (btn.type === 'PHONE_NUMBER') {
        body += `\n📞 ${btn.text}: ${btn.phone_number}`
      }
    })
    body += '\n\n_Reply with a number or option._'
  }

  messages.push(body)
  return { messages, hasInteractiveFallback }
}

// ── Renderable Compiler ───────────────────────────────────────────────────────
// Output used by the preview panel and the chat MessageRenderer.
// Both consume the SAME output — guaranteed parity between preview and real send.

export function toRenderable(
  template: CanonicalTemplate,
  vars: Record<string, string> = {},
): RenderableTemplate {
  const varNames = template._meta?.variableNames ?? []
  const resolve = (text: string) => resolveText(text, varNames, vars)

  const renderable: RenderableTemplate = {
    body: resolve(template.body.text),
  }

  if (template.header) {
    const h = template.header
    renderable.header = {
      type: h.type,
      text: h.type === 'TEXT' ? resolve(h.text) : undefined,
      url: (h as any).url,
      filename: (h as any).filename,
    }
  }

  if (template.footer?.text) {
    renderable.footer = template.footer.text
  }

  if (template.buttons?.length) {
    renderable.buttons = template.buttons.map(btn => ({
      type: btn.type,
      text: btn.text,
      url: btn.type === 'URL' ? resolve(btn.url) : undefined,
      phone: btn.type === 'PHONE_NUMBER' ? btn.phone_number : undefined,
    }))
  }

  return renderable
}

// ── Variable extraction ───────────────────────────────────────────────────────

export function extractVariableNames(template: CanonicalTemplate): string[] {
  const vars = new Set<string>()
  const scan = (s?: string) => {
    if (!s) return
    for (const m of s.matchAll(/\{\{(\w+)\}\}/g)) vars.add(m[1])
  }
  if (template.header?.type === 'TEXT') scan(template.header.text)
  scan(template.body.text)
  if (template.footer) scan(template.footer.text)
  template.buttons?.forEach(b => { if (b.type === 'URL') scan(b.url) })
  return Array.from(vars)
}

// ── Legacy blocks → Canonical ─────────────────────────────────────────────────
// Converts the old builder block format to canonical for backward compat.

export function legacyBlocksToCanonical(
  blocks: any[],
  name: string,
  category?: string,
  language?: string,
): CanonicalTemplate {
  const textBlocks  = blocks.filter(b => b.type === 'text')
  const buttonBlock = blocks.find(b => b.type === 'buttons')
  const mediaBlock  = blocks.find(b => b.type === 'media')
  const reminderBlock = blocks.find(b => b.type === 'reminder')
  const supportBlock  = blocks.find(b => b.type === 'support')

  const titleBlock  = textBlocks.find((b: any) => b.style === 'title')
  const bodyBlocks  = textBlocks.filter((b: any) => b.style !== 'title' && b.style !== 'footer')
  const footerBlock = textBlocks.find((b: any) => b.style === 'footer')

  const bodyParts: string[] = bodyBlocks.map((b: any) => b.content).filter(Boolean)
  if (reminderBlock) {
    bodyParts.push(`📅 *${reminderBlock.title}*\n${reminderBlock.datetime}`)
  }
  if (supportBlock) {
    bodyParts.push(supportBlock.greeting)
  }

  const canonical: CanonicalTemplate = {
    name,
    category: (category ?? 'GENERAL') as TemplateCategory,
    language: language ?? 'en_US',
    body: { text: bodyParts.join('\n\n') || 'Hello {{name}}' },
  }

  // Header
  if (titleBlock) {
    canonical.header = { type: 'TEXT', text: titleBlock.content }
  } else if (mediaBlock?.url) {
    const type = mediaBlock.mediaType === 'image' ? 'IMAGE'
      : mediaBlock.mediaType === 'video' ? 'VIDEO' : 'DOCUMENT'
    canonical.header = { type, url: mediaBlock.url }
  }

  // Footer
  if (footerBlock) {
    canonical.footer = { text: footerBlock.content }
  }

  // Buttons
  const allButtons: any[] = []
  if (buttonBlock?.buttons) allButtons.push(...buttonBlock.buttons)
  if (reminderBlock) {
    allButtons.push({ action: 'reply', label: reminderBlock.confirmLabel || 'Confirm' })
    allButtons.push({ action: 'reply', label: reminderBlock.rescheduleLabel || 'Reschedule' })
  }
  if (supportBlock?.faqs) {
    supportBlock.faqs.slice(0, 3).forEach((faq: string) =>
      allButtons.push({ action: 'reply', label: faq }),
    )
  }

  if (allButtons.length > 0) {
    canonical.buttons = allButtons.slice(0, 3).map((b: any) => {
      if (b.action === 'url')   return { type: 'URL' as const, text: b.label, url: b.value || '' }
      if (b.action === 'call')  return { type: 'PHONE_NUMBER' as const, text: b.label, phone_number: b.value || '' }
      return { type: 'QUICK_REPLY' as const, text: b.label }
    })
  }

  return canonical
}

// ── Derive template type for DB ────────────────────────────────────────────────

export function deriveTemplateType(template: CanonicalTemplate): 'TEXT' | 'MEDIA' | 'INTERACTIVE' {
  if (template.buttons?.length) return 'INTERACTIVE'
  if (template.header && template.header.type !== 'TEXT') return 'MEDIA'
  return 'TEXT'
}
