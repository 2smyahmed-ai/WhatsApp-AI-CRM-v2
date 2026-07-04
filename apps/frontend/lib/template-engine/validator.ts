import type {
  CanonicalTemplate, ValidationIssue, ValidationResult,
} from './schema'

// Baileys-first validation. A template is a text message or a media message
// with a caption — that's it. The only real requirements are a name, some
// text, and (for media messages) an attached file. Everything is phrased as a
// friendly nudge so a first-time user is never confronted with scary errors.

const MAX_BODY = 4096

export function validateTemplate(template: CanonicalTemplate): ValidationResult {
  const issues: ValidationIssue[] = []

  // ── Name ──────────────────────────────────────────────────────────────────
  if (!template.name?.trim()) {
    issues.push({ level: 'error', field: 'name', message: 'Give your template a name.' })
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const bodyText = template.body?.text ?? ''
  if (!bodyText.trim() && !template.media) {
    issues.push({ level: 'error', field: 'body', message: 'Write the message text.' })
  } else if (bodyText.length > MAX_BODY) {
    issues.push({ level: 'error', field: 'body', message: `Message is too long (${bodyText.length}/${MAX_BODY} characters).` })
  }

  // ── Media ─────────────────────────────────────────────────────────────────
  if (template.media && !template.media.url) {
    issues.push({
      level: 'warning',
      field: 'media',
      message: 'Upload a file before sending.',
    })
  }

  const errors   = issues.filter(i => i.level === 'error').length
  const warnings = issues.filter(i => i.level === 'warning').length

  return {
    valid: errors === 0,
    sendable: errors === 0 && !!template.name?.trim() && (!!bodyText.trim() || !!template.media?.url),
    issues,
    errors,
    warnings,
  }
}
