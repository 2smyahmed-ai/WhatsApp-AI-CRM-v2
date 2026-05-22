/**
 * Interactive Message Validator
 *
 * Validates interactive message content against provider constraints
 * before the send pipeline is invoked. Returns a structured result
 * with errors and warnings so the UI can show live feedback.
 */

import type {
  InteractiveButtonsContent,
  InteractiveListContent,
  InteractiveCtaContent,
} from '@crm/messaging-schema';
import { META_CAPABILITIES, BAILEYS_CAPABILITIES } from '@crm/messaging-schema';
import type { ValidationResult, ValidationIssue } from '../template-engine/schema';
import type { InteractiveContent } from './compiler';

type Provider = 'meta' | 'baileys';

function result(issues: ValidationIssue[]): ValidationResult {
  const errors   = issues.filter(i => i.level === 'error').length;
  const warnings = issues.filter(i => i.level === 'warning').length;
  return {
    valid: errors === 0,
    metaReady: errors === 0,
    baileysSupported: true,
    issues,
    errors,
    warnings,
  };
}

// ── Shared field validators ───────────────────────────────────────────────────

function checkBody(body: string, issues: ValidationIssue[]) {
  if (!body?.trim()) {
    issues.push({ level: 'error', field: 'body', message: 'Body text is required.' });
  } else if (body.length > 1024) {
    issues.push({ level: 'error', field: 'body', message: `Body is ${body.length} chars — max 1,024.` });
  }
}

function checkFooter(footer: string | undefined, issues: ValidationIssue[]) {
  if (footer !== undefined && footer.length > 60) {
    issues.push({ level: 'error', field: 'footer', message: `Footer is ${footer.length} chars — max 60.` });
  }
}

function checkHeader(header: { type: string; text?: string; media?: { url: string | null } } | undefined, issues: ValidationIssue[]) {
  if (!header) return;
  if (header.type === 'text' && header.text !== undefined && header.text.length > 60) {
    issues.push({ level: 'error', field: 'body', message: `Header text is ${header.text.length} chars — max 60.` });
  }
  if (header.type === 'media') {
    if (!header.media?.url?.trim()) {
      issues.push({ level: 'error', field: 'body', message: 'Media header requires a URL.' });
    } else {
      try { new URL(header.media.url); } catch {
        issues.push({ level: 'error', field: 'body', message: 'Media header URL must be a valid URL (include https://).' });
      }
    }
  }
}

// ── Interactive Buttons ───────────────────────────────────────────────────────

function validateButtons(
  content: InteractiveButtonsContent,
  provider: Provider,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const caps = provider === 'meta' ? META_CAPABILITIES : BAILEYS_CAPABILITIES;

  checkHeader(content.header as any, issues);
  checkBody(content.body, issues);
  checkFooter(content.footer, issues);

  if (!content.buttons || content.buttons.length === 0) {
    issues.push({ level: 'error', field: 'buttons', message: 'At least 1 button is required.' });
  } else {
    if (provider === 'meta' && content.buttons.length > caps.buttonLimits.quickReplyMax) {
      issues.push({
        level: 'error',
        field: 'buttons',
        message: `Maximum ${caps.buttonLimits.quickReplyMax} quick-reply buttons allowed by Meta.`,
      });
    }

    for (const btn of content.buttons) {
      if (!btn.id?.trim()) {
        issues.push({ level: 'error', field: 'buttons', message: 'Each button must have a unique ID.' });
      }
      if (!btn.title?.trim()) {
        issues.push({ level: 'error', field: 'buttons', message: 'Button title cannot be empty.' });
      } else if (provider === 'meta' && btn.title.length > caps.buttonLimits.quickReplyTitleMax) {
        issues.push({
          level: 'error',
          field: 'buttons',
          message: `Button "${btn.title.slice(0, 15)}…" is ${btn.title.length} chars — max ${caps.buttonLimits.quickReplyTitleMax}.`,
        });
      }
    }

    if (provider === 'baileys') {
      issues.push({
        level: 'warning',
        field: 'buttons',
        message: 'Baileys cannot reliably send interactive buttons — will be delivered as numbered plain-text options.',
        downgrade: 'Rendered as: 1. Option A  2. Option B',
      });
    }
  }

  if (provider === 'meta') {
    issues.push({
      level: 'info',
      field: 'body',
      message: 'Interactive messages require an active 24-hour session window (customer must have messaged first).',
    });
  }

  return result(issues);
}

// ── Interactive List ──────────────────────────────────────────────────────────

function validateList(
  content: InteractiveListContent,
  provider: Provider,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const caps = provider === 'meta' ? META_CAPABILITIES : BAILEYS_CAPABILITIES;

  checkHeader(content.header as any, issues);
  checkBody(content.body, issues);
  checkFooter(content.footer, issues);

  if (!content.buttonText?.trim()) {
    issues.push({ level: 'error', field: 'buttons', message: 'List button text is required.' });
  } else if (content.buttonText.length > 20) {
    issues.push({ level: 'error', field: 'buttons', message: `List button text is ${content.buttonText.length} chars — max 20.` });
  }

  if (!content.sections || content.sections.length === 0) {
    issues.push({ level: 'error', field: 'body', message: 'At least 1 section with 1 row is required.' });
  } else {
    if (provider === 'meta' && content.sections.length > caps.listLimits.sectionsMax) {
      issues.push({ level: 'error', field: 'body', message: `Maximum ${caps.listLimits.sectionsMax} sections allowed.` });
    }

    for (const section of content.sections) {
      if (!section.rows || section.rows.length === 0) {
        issues.push({ level: 'error', field: 'body', message: `Section "${section.title}" has no rows.` });
      } else {
        if (provider === 'meta' && section.rows.length > caps.listLimits.rowsPerSectionMax) {
          issues.push({ level: 'error', field: 'body', message: `Section "${section.title}" has ${section.rows.length} rows — max ${caps.listLimits.rowsPerSectionMax}.` });
        }
        for (const row of section.rows) {
          if (!row.id?.trim()) {
            issues.push({ level: 'error', field: 'body', message: 'Each list row must have a unique ID.' });
          }
          if (!row.title?.trim()) {
            issues.push({ level: 'error', field: 'body', message: 'List row title cannot be empty.' });
          } else if (provider === 'meta' && row.title.length > caps.listLimits.rowTitleMax) {
            issues.push({ level: 'error', field: 'body', message: `Row "${row.title.slice(0, 15)}…" is ${row.title.length} chars — max ${caps.listLimits.rowTitleMax}.` });
          }
          if (row.description && row.description.length > 72) {
            issues.push({ level: 'warning', field: 'body', message: `Row description "${row.title.slice(0, 15)}…" is ${row.description.length} chars — max 72.` });
          }
        }
      }
    }

    if (provider === 'baileys') {
      issues.push({
        level: 'warning',
        field: 'buttons',
        message: 'Baileys cannot reliably send list messages — will be delivered as numbered plain-text options.',
        downgrade: 'Sections flattened into numbered list reply prompt.',
      });
    }
  }

  if (provider === 'meta') {
    issues.push({
      level: 'info',
      field: 'body',
      message: 'Interactive messages require an active 24-hour session window (customer must have messaged first).',
    });
  }

  return result(issues);
}

// ── Interactive CTA ───────────────────────────────────────────────────────────

function validateCta(
  content: InteractiveCtaContent,
  provider: Provider,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  checkHeader(content.header as any, issues);
  checkBody(content.body, issues);
  checkFooter(content.footer, issues);

  if (!content.cta?.displayText?.trim()) {
    issues.push({ level: 'error', field: 'buttons', message: 'CTA button display text is required.' });
  } else if (content.cta.displayText.length > 20) {
    issues.push({ level: 'error', field: 'buttons', message: `CTA display text is ${content.cta.displayText.length} chars — max 20.` });
  }

  if (!content.cta?.url?.trim()) {
    issues.push({ level: 'error', field: 'buttons', message: 'CTA URL is required.' });
  } else {
    try {
      new URL(content.cta.url);
    } catch {
      issues.push({ level: 'error', field: 'buttons', message: 'CTA URL must be a valid URL (include https://).' });
    }
  }

  if (provider === 'baileys') {
    issues.push({
      level: 'warning',
      field: 'buttons',
      message: 'Baileys does not support CTA cards — URL will be sent as inline text.',
      downgrade: 'URL appended to message body.',
    });
  }

  if (provider === 'meta') {
    issues.push({
      level: 'info',
      field: 'body',
      message: 'Interactive messages require an active 24-hour session window (customer must have messaged first).',
    });
  }

  return result(issues);
}

// ── Unified dispatcher ────────────────────────────────────────────────────────

export function validateInteractive(
  content: InteractiveContent,
  provider: Provider,
): ValidationResult {
  if (content.kind === 'interactive_buttons') return validateButtons(content, provider);
  if (content.kind === 'interactive_list')    return validateList(content, provider);
  if (content.kind === 'interactive_cta')     return validateCta(content, provider);

  return result([{
    level: 'error',
    message: `Unsupported interactive kind: ${(content as any).kind}`,
  }]);
}
