import type {
  CanonicalTemplate, Provider, ValidationIssue, ValidationResult,
} from './schema'

export function validateTemplate(
  template: CanonicalTemplate,
  provider: Provider,
): ValidationResult {
  const issues: ValidationIssue[] = []

  // ── Name ──────────────────────────────────────────────────────────────────
  if (!template.name?.trim()) {
    issues.push({ level: 'error', field: 'name', message: 'Template name is required.' })
  } else if (template.name.length > 512) {
    issues.push({ level: 'error', field: 'name', message: 'Template name must be 512 characters or fewer.' })
  } else if (!/^[a-zA-Z0-9_ ]+$/.test(template.name)) {
    issues.push({
      level: 'warning',
      field: 'name',
      message: 'Template name should only contain letters, numbers, spaces, and underscores (Meta requirement for submission).',
    })
  }

  // ── Category ──────────────────────────────────────────────────────────────
  if (!template.category) {
    issues.push({ level: 'error', field: 'category', message: 'Category is required for Meta submission.' })
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const bodyText = template.body?.text ?? ''
  if (!bodyText.trim()) {
    issues.push({ level: 'error', field: 'body', message: 'Body text is required.' })
  } else if (bodyText.length > 1024) {
    issues.push({ level: 'error', field: 'body', message: `Body text is ${bodyText.length} chars — max is 1,024.` })
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
        issues.push({ level: 'error', field: 'header', message: 'Header text supports at most 1 variable.' })
      }
    }

    if (h.type === 'IMAGE' || h.type === 'VIDEO' || h.type === 'DOCUMENT') {
      if (!h.url && !h.handle) {
        issues.push({
          level: 'warning',
          field: 'header',
          message: `No media URL set for ${h.type.toLowerCase()} header — provide a URL or upload a file before submitting to Meta.`,
        })
      }
      if (provider === 'baileys') {
        issues.push({
          level: 'warning',
          field: 'header',
          message: `Baileys: ${h.type.toLowerCase()} header will be sent as a separate media message before the body text.`,
          downgrade: 'Media sent first, then body as a second message.',
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
    if (provider === 'baileys') {
      issues.push({
        level: 'info',
        field: 'footer',
        message: 'Baileys: footer will be appended to the body text in italics.',
        downgrade: 'Footer merged into body text as _italic_ line.',
      })
    }
  }

  // ── Buttons ───────────────────────────────────────────────────────────────
  if (template.buttons && template.buttons.length > 0) {
    const buttons = template.buttons
    const qr  = buttons.filter(b => b.type === 'QUICK_REPLY')
    const url  = buttons.filter(b => b.type === 'URL')
    const phone = buttons.filter(b => b.type === 'PHONE_NUMBER')
    const hasCta = url.length > 0 || phone.length > 0

    // Mixed types
    if (qr.length > 0 && hasCta) {
      issues.push({
        level: 'error',
        field: 'buttons',
        message: 'Cannot mix Quick Reply and Call-to-Action buttons in the same template.',
      })
    }

    // QR limits
    if (qr.length > 3) {
      issues.push({ level: 'error', field: 'buttons', message: 'Maximum 3 Quick Reply buttons allowed by Meta.' })
    }

    // CTA limits
    if (url.length > 1) {
      issues.push({ level: 'error', field: 'buttons', message: 'Maximum 1 URL button allowed by Meta.' })
    }
    if (phone.length > 1) {
      issues.push({ level: 'error', field: 'buttons', message: 'Maximum 1 Phone Number button allowed by Meta.' })
    }
    if (hasCta && url.length + phone.length > 2) {
      issues.push({ level: 'error', field: 'buttons', message: 'Maximum 2 Call-to-Action buttons total (1 URL + 1 Phone).' })
    }

    // Label length
    for (const btn of buttons) {
      if (!btn.text?.trim()) {
        issues.push({ level: 'error', field: 'buttons', message: 'All button labels must be non-empty.' })
      } else if (btn.text.length > 25) {
        issues.push({
          level: 'error',
          field: 'buttons',
          message: `Button "${btn.text.slice(0, 20)}…" is ${btn.text.length} chars — max is 25.`,
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

    // Baileys downgrade
    if (provider === 'baileys') {
      issues.push({
        level: 'warning',
        field: 'buttons',
        message: 'Baileys does not support interactive buttons — will be rendered as numbered plain-text options.',
        downgrade: '1. Button one\n2. Button two\n\nReply with a number.',
      })
    }

    // Media header + buttons requires approved template
    if (template.header && template.header.type !== 'TEXT' && hasCta && provider === 'meta') {
      issues.push({
        level: 'info',
        field: 'buttons',
        message: 'Media header + CTA buttons require an approved Meta template before sending.',
      })
    }
  }

  const errors   = issues.filter(i => i.level === 'error').length
  const warnings = issues.filter(i => i.level === 'warning').length

  return {
    valid: errors === 0,
    metaReady: errors === 0 && !!template.name?.trim() && !!bodyText.trim() && !!template.category,
    baileysSupported: true,
    issues,
    errors,
    warnings,
  }
}
