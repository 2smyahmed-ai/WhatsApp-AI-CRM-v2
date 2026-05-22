// ─── Backend Template Compiler ────────────────────────────────────────────────
// Mirrors apps/frontend/lib/template-engine/compiler.ts (no JSX, Node-safe).
// Converts a CanonicalTemplate stored in MessageTemplate.payload into:
//   - Meta API components array  (toMetaComponents)
//   - Meta send payload          (toMetaSendPayload)
//   - Baileys plaintext payload  (toBaileysPayload)
//   - Renderable (preview parity)(toRenderable)

// ── Types ─────────────────────────────────────────────────────────────────────

export type MetaCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'

export interface CanonicalHeader {
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  url?: string
  filename?: string
  handle?: string
}

export interface CanonicalButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  text: string
  url?: string
  phone_number?: string
}

export interface CanonicalTemplate {
  name: string
  category: MetaCategory
  language: string
  header?: CanonicalHeader
  body: { text: string }
  footer?: { text: string }
  buttons?: CanonicalButton[]
  _meta?: {
    variableNames?: string[]
    previewValues?: Record<string, string>
    description?: string
  }
}

export interface MetaComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
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

// ── Meta Components Compiler ──────────────────────────────────────────────────

export function toMetaComponents(template: CanonicalTemplate): MetaComponent[] {
  const components: MetaComponent[] = []
  const varNames = template._meta?.variableNames ?? []
  const previewValues = template._meta?.previewValues ?? {}

  // HEADER
  if (template.header) {
    const h = template.header
    if (h.type === 'TEXT') {
      const comp: MetaComponent = { type: 'HEADER', format: 'TEXT', text: h.text }
      if (h.text && /\{\{[\w]+\}\}/.test(h.text)) {
        comp.example = { header_text: [previewValues[varNames[0]] ?? 'Sample Value'] }
      }
      components.push(comp)
    } else {
      const comp: MetaComponent = { type: 'HEADER', format: h.type as any }
      if (h.handle) {
        comp.example = { header_handle: [h.handle] }
      } else if (h.url) {
        comp.example = { header_url: [h.url] }
      }
      components.push(comp)
    }
  }

  // BODY
  const bodyComp: MetaComponent = { type: 'BODY', text: template.body.text }
  if (/\{\{[\w]+\}\}/.test(template.body.text)) {
    const exampleRow = varNames.map(n => previewValues[n] ?? `Sample ${n}`)
    if (exampleRow.length > 0) {
      bodyComp.example = { body_text: [exampleRow] }
    }
  }
  components.push(bodyComp)

  // FOOTER
  if (template.footer?.text) {
    components.push({ type: 'FOOTER', text: template.footer.text })
  }

  // BUTTONS
  if (template.buttons && template.buttons.length > 0) {
    const metaBtns: MetaApiButton[] = template.buttons.map(btn => {
      if (btn.type === 'QUICK_REPLY')  return { type: 'QUICK_REPLY',   text: btn.text }
      if (btn.type === 'URL')          return { type: 'URL',           text: btn.text, url: btn.url }
      return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone_number }
    })
    components.push({ type: 'BUTTONS', buttons: metaBtns })
  }

  return components
}

// ── Meta Send Payload Compiler ────────────────────────────────────────────────

export function toMetaSendPayload(
  template: CanonicalTemplate,
  phone: string,
  vars: Record<string, string> = {},
  overrideTemplateName?: string,
): object {
  const varNames = template._meta?.variableNames ?? []
  const templateName = (overrideTemplateName ?? template.name).toLowerCase().replace(/\s+/g, '_')
  const components: any[] = []

  // Header parameters
  if (template.header) {
    const h = template.header
    if (h.type === 'TEXT' && h.text && /\{\{[\w]+\}\}/.test(h.text)) {
      const val = varNames.length > 0 ? (vars[varNames[0]] ?? '') : ''
      components.push({ type: 'header', parameters: [{ type: 'text', text: val }] })
    } else if (h.type === 'IMAGE') {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: h.url ?? vars['media_url'] ?? '' } }],
      })
    } else if (h.type === 'VIDEO') {
      components.push({
        type: 'header',
        parameters: [{ type: 'video', video: { link: h.url ?? vars['media_url'] ?? '' } }],
      })
    } else if (h.type === 'DOCUMENT') {
      components.push({
        type: 'header',
        parameters: [{
          type: 'document',
          document: { link: h.url ?? vars['media_url'] ?? '', filename: h.filename ?? 'document' },
        }],
      })
    }
  }

  // Body parameters — positional {{1}}, {{2}} mapped from varNames
  const bodyParams = varNames
    .map(name => ({ type: 'text', text: String(vars[name] ?? '') }))
    .filter(p => p.text !== '')

  if (bodyParams.length > 0) {
    components.push({ type: 'body', parameters: bodyParams })
  }

  // Button URL dynamic suffix
  template.buttons?.forEach((btn, i) => {
    if (btn.type === 'URL' && btn.url && /\{\{[\w]+\}\}/.test(btn.url)) {
      const match = btn.url.match(/\{\{(\w+)\}\}/)
      const urlVar = match?.[1]
      if (urlVar && vars[urlVar]) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(i),
          parameters: [{ type: 'text', text: vars[urlVar] }],
        })
      }
    }
  })

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: template.language ?? 'en_US' },
      ...(components.length > 0 ? { components } : {}),
    },
  }
}

// ── Baileys Compiler ──────────────────────────────────────────────────────────

export function toBaileysPayload(
  template: CanonicalTemplate,
  vars: Record<string, string> = {},
): { messages: string[]; hasInteractiveFallback: boolean } {
  const varNames = template._meta?.variableNames ?? []
  const resolve = (text: string) => resolveText(text, varNames, vars)

  const messages: string[] = []

  if (template.header) {
    const h = template.header
    if (h.type === 'TEXT' && h.text) {
      messages.push(`*${resolve(h.text)}*`)
    } else if (h.url) {
      messages.push(h.url)
    }
  }

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
      } else if (btn.type === 'URL' && btn.url) {
        body += `\n🔗 ${btn.text}: ${resolve(btn.url)}`
      } else if (btn.type === 'PHONE_NUMBER' && btn.phone_number) {
        body += `\n📞 ${btn.text}: ${btn.phone_number}`
      }
    })
    body += '\n\n_Reply with a number or option._'
  }

  messages.push(body)
  return { messages, hasInteractiveFallback }
}

// ── Renderable Compiler ───────────────────────────────────────────────────────

export function toRenderable(
  template: CanonicalTemplate,
  vars: Record<string, string> = {},
): RenderableTemplate {
  const varNames = template._meta?.variableNames ?? []
  const resolve = (text: string) => resolveText(text, varNames, vars)

  const renderable: RenderableTemplate = { body: resolve(template.body.text) }

  if (template.header) {
    const h = template.header
    renderable.header = {
      type: h.type,
      text: h.type === 'TEXT' ? resolve(h.text ?? '') : undefined,
      url: h.url,
      filename: h.filename,
    }
  }

  if (template.footer?.text) {
    renderable.footer = template.footer.text
  }

  if (template.buttons?.length) {
    renderable.buttons = template.buttons.map(btn => ({
      type: btn.type,
      text: btn.text,
      url: btn.type === 'URL' ? resolve(btn.url ?? '') : undefined,
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

export function legacyBlocksToCanonical(
  blocks: any[],
  name: string,
  category?: string,
  language?: string,
): CanonicalTemplate {
  const textBlocks    = blocks.filter(b => b.type === 'text')
  const buttonBlock   = blocks.find(b => b.type === 'buttons')
  const mediaBlock    = blocks.find(b => b.type === 'media')
  const reminderBlock = blocks.find(b => b.type === 'reminder')
  const supportBlock  = blocks.find(b => b.type === 'support')

  const titleBlock  = textBlocks.find((b: any) => b.style === 'title')
  const bodyBlocks  = textBlocks.filter((b: any) => b.style !== 'title' && b.style !== 'footer')
  const footerBlock = textBlocks.find((b: any) => b.style === 'footer')

  const bodyParts: string[] = bodyBlocks.map((b: any) => b.content).filter(Boolean)
  if (reminderBlock) bodyParts.push(`📅 *${reminderBlock.title}*\n${reminderBlock.datetime}`)
  if (supportBlock)  bodyParts.push(supportBlock.greeting)

  const metaCat = (['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const).includes(category as any)
    ? (category as MetaCategory)
    : 'MARKETING'

  const canonical: CanonicalTemplate = {
    name,
    category: metaCat,
    language: language ?? 'en_US',
    body: { text: bodyParts.join('\n\n') || 'Hello {{name}}' },
  }

  if (titleBlock) {
    canonical.header = { type: 'TEXT', text: titleBlock.content }
  } else if (mediaBlock?.url) {
    const type = mediaBlock.mediaType === 'image' ? 'IMAGE'
      : mediaBlock.mediaType === 'video' ? 'VIDEO' : 'DOCUMENT'
    canonical.header = { type, url: mediaBlock.url }
  }

  if (footerBlock) canonical.footer = { text: footerBlock.content }

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
      if (b.action === 'url')  return { type: 'URL' as const,          text: b.label, url: b.value ?? '' }
      if (b.action === 'call') return { type: 'PHONE_NUMBER' as const, text: b.label, phone_number: b.value ?? '' }
      return { type: 'QUICK_REPLY' as const, text: b.label }
    })
  }

  return canonical
}
