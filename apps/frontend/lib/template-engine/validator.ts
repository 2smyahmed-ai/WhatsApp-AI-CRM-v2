import type {
  CanonicalTemplate, ValidationIssue, ValidationResult,
} from './schema'

// Baileys-first validation. Validates what will actually render correctly
// in real WhatsApp via Baileys. No Meta API rules applied.

export function validateTemplate(template: CanonicalTemplate): ValidationResult {
  const issues: ValidationIssue[] = []

  // ── Name ──────────────────────────────────────────────────────────────────
  if (!template.name?.trim()) {
    issues.push({ level: 'error', field: 'name', message: 'Template name is required.' })
  } else if (template.name.length > 512) {
    issues.push({ level: 'error', field: 'name', message: 'Template name must be 512 characters or fewer.' })
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const bodyText = template.body?.text ?? ''
  if (!bodyText.trim()) {
    issues.push({ level: 'error', field: 'body', message: 'Body text is required.' })
  } else if (bodyText.length > 4096) {
    issues.push({ level: 'error', field: 'body', message: `Body text is ${bodyText.length} chars — WhatsApp limit is 4,096.` })
  }

  // ── Header ────────────────────────────────────────────────────────────────
  if (template.header) {
    const h = template.header
    if (h.type === 'TEXT') {
      if (!h.text?.trim()) {
        issues.push({ level: 'error', field: 'header', message: 'Header text cannot be empty.' })
      } else if (h.text.length > 60) {
        issues.push({ level: 'error', field: 'header', message: `Header text is ${h.text.length} chars — max is 60.` })
      }
      const vars = [...(h.text ?? '').matchAll(/\{\{(\w+)\}\}/g)]
      if (vars.length > 1) {
        issues.push({ level: 'warning', field: 'header', message: 'Header text works best with at most 1 variable.' })
      }
    }

    if (h.type === 'IMAGE' || h.type === 'VIDEO' || h.type === 'DOCUMENT') {
      if (!(h as any).url) {
        issues.push({
          level: 'warning',
          field: 'header',
          message: `No media URL set for ${h.type.toLowerCase()} header — add a URL or upload a file before sending.`,
        })
      }
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  if (template.footer) {
    const ft = template.footer.text ?? ''
    if (!ft.trim()) {
      issues.push({ level: 'error', field: 'footer', message: 'Footer text cannot be empty if the section is added.' })
    } else if (ft.length > 60) {
      issues.push({ level: 'error', field: 'footer', message: `Footer text is ${ft.length} chars — max is 60.` })
    }
    if (/\{\{[\w]+\}\}/.test(ft)) {
      issues.push({ level: 'error', field: 'footer', message: 'Footer cannot contain variables.' })
    }
    issues.push({
      level: 'info',
      field: 'footer',
      message: 'Footer will be appended to the body text in italics on WhatsApp.',
      downgrade: 'Footer merged into body as _italic_ line.',
    })
  }

  // ── Buttons ───────────────────────────────────────────────────────────────
  if (template.buttons && template.buttons.length > 0) {
    const buttons = template.buttons
    const qr    = buttons.filter(b => b.type === 'QUICK_REPLY')
    const url   = buttons.filter(b => b.type === 'URL')
    const phone = buttons.filter(b => b.type === 'PHONE_NUMBER')
    const hasCta = url.length > 0 || phone.length > 0

    // Cannot mix types
    if (qr.length > 0 && hasCta) {
      issues.push({
        level: 'error',
        field: 'buttons',
        message: 'Cannot mix Quick Reply and Call-to-Action buttons in the same template.',
      })
    }

    // QR limits (Baileys: up to 10, auto-downgraded to numbered text)
    if (qr.length > 10) {
      issues.push({ level: 'error', field: 'buttons', message: 'Maximum 10 quick reply options allowed.' })
    }

    // CTA limits
    if (url.length > 1) {
      issues.push({ level: 'error', field: 'buttons', message: 'Maximum 1 URL button allowed.' })
    }
    if (phone.length > 1) {
      issues.push({ level: 'error', field: 'buttons', message: 'Maximum 1 phone number button allowed.' })
    }

    // Label length
    for (const btn of buttons) {
      if (!btn.text?.trim()) {
        issues.push({ level: 'error', field: 'buttons', message: 'All button labels must be non-empty.' })
      } else if (btn.text.length > 60) {
        issues.push({
          level: 'warning',
          field: 'buttons',
          message: `Button "${btn.text.slice(0, 20)}…" label is ${btn.text.length} chars — keep it concise for best rendering.`,
        })
      }
    }

    // URL buttons must have a URL
    for (const btn of url) {
      if (!btn.url?.trim()) {
        issues.push({ level: 'error', field: 'buttons', message: `URL button "${btn.text}" has no URL.` })
      }
    }

    // Phone buttons must have a phone number
    for (const btn of phone) {
      if (!btn.phone_number?.trim()) {
        issues.push({ level: 'error', field: 'buttons', message: `Phone button "${btn.text}" has no phone number.` })
      }
    }

    // Inform about auto-downgrade behaviour
    issues.push({
      level: 'info',
      field: 'buttons',
      message: 'Buttons are auto-formatted as numbered text options in WhatsApp.',
      downgrade: '1️⃣ Option A\n2️⃣ Option B\n\nReply with the number of your choice.',
    })
  }

  const errors   = issues.filter(i => i.level === 'error').length
  const warnings = issues.filter(i => i.level === 'warning').length

  return {
    valid: errors === 0,
    sendable: errors === 0 && !!template.name?.trim() && !!bodyText.trim(),
    issues,
    errors,
    warnings,
  }
}
