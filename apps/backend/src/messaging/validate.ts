import type {
  RenderablePayload,
  RenderableBlock,
  ValidationContext,
  ValidationResult,
  ValidationIssue,
  CapabilityResult,
  ProviderCapabilities,
  ProviderName,
  MessageKind,
  BodyTextBlock,
  MediaBlock,
  HeaderMediaBlock,
  ReplyButtonBlock,
  UrlButtonBlock,
  PhoneButtonBlock,
  ListButtonBlock,
  TemplateMarkerBlock,
} from '@crm/messaging-schema';
import { getCapabilities } from './capabilities';

// ── Block lookup helpers ──────────────────────────────────────────────────────

function findBlock<T extends RenderableBlock>(blocks: RenderableBlock[], type: T['type']): T | undefined {
  return blocks.find((b) => b.type === type) as T | undefined;
}

function findBlocks<T extends RenderableBlock>(blocks: RenderableBlock[], type: T['type']): T[] {
  return blocks.filter((b) => b.type === type) as T[];
}

// ── Issue factory ─────────────────────────────────────────────────────────────

function err(
  code: ValidationIssue['code'],
  message: string,
  path: string,
  fixable = false,
): ValidationIssue {
  return { code, message, path, fixable };
}

function warn(
  code: ValidationIssue['code'],
  message: string,
  path: string,
  fixable = false,
): ValidationIssue {
  return { code, message, path, fixable };
}

// ── Format checkers ───────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/[\s\-().+]/g, '');
  return /^[1-9]\d{6,14}$/.test(digits);
}

// ── Public: coarse capability check ──────────────────────────────────────────

/**
 * Tier-1 check — called by the builder UI and as the first gate in the
 * send pipeline. Returns fast without inspecting the full payload.
 *
 * Direction is `'OUTBOUND' | 'INBOUND'` from the schema's MessageDirection.
 */
export function supports(
  kind: MessageKind,
  direction: 'OUTBOUND' | 'INBOUND',
  provider: ProviderName,
): CapabilityResult {
  const caps = getCapabilities(provider);
  const kindCap = caps.kinds[kind];
  if (!kindCap) {
    return { ok: false, reason: `Provider '${provider}' has no capability entry for kind '${kind}'` };
  }
  const supported = direction === 'OUTBOUND' ? kindCap.outbound : kindCap.inbound;
  if (!supported) {
    const reason = kindCap.notes
      ?? `Provider '${provider}' does not support ${direction.toLowerCase()} '${kind}' messages`;
    return {
      ok: false,
      reason,
      suggestion: direction === 'OUTBOUND'
        ? 'Switch to a fallback_text compatibility mode or use a different provider'
        : undefined,
    };
  }
  return { ok: true };
}

// ── Public: fine-grained payload validation ───────────────────────────────────

/**
 * Tier-2 check — validates the compiled RenderablePayload against the
 * provider's exact limits and the conversation's current state.
 *
 * Pure function. Returns `ok: false` only when there are blocking errors;
 * warnings are non-blocking and surface in the builder UI.
 */
export function validate(
  renderable: RenderablePayload,
  context: ValidationContext,
  provider: ProviderName,
): ValidationResult {
  const caps = getCapabilities(provider);
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { kind, blocks } = renderable;

  // ── 1. Coarse kind gate ─────────────────────────────────────────────────
  const kindCheck = supports(kind, 'OUTBOUND', provider);
  if (!kindCheck.ok) {
    errors.push(err('UNSUPPORTED_KIND', kindCheck.reason, 'kind'));
    // Cannot validate further — payload shape may not match expectations.
    return { ok: false, errors, warnings };
  }

  // ── 2. Session window (free-form only; templates bypass the window) ─────
  if (caps.sessionWindow && kind !== 'template' && kind !== 'system') {
    const { lastInboundAt } = context.conversation;
    if (!lastInboundAt) {
      warnings.push(warn(
        'SESSION_WINDOW_CLOSED',
        'No inbound message recorded for this conversation. Ensure the recipient has opted in.',
        'conversation.lastInboundAt',
      ));
    } else {
      const windowMs = caps.sessionWindow.hours * 60 * 60 * 1000;
      const ageMs = Date.now() - new Date(lastInboundAt).getTime();
      if (ageMs > windowMs) {
        errors.push(err(
          'SESSION_WINDOW_CLOSED',
          `The ${caps.sessionWindow.hours}h customer service window closed `
            + `${Math.floor(ageMs / 3600000)}h ago. Use a template to re-open it.`,
          'conversation.lastInboundAt',
        ));
      } else {
        const remainingH = (windowMs - ageMs) / 3600000;
        if (remainingH < 2) {
          warnings.push(warn(
            'SESSION_WINDOW_CLOSED',
            `Session window closes in ${remainingH.toFixed(1)}h. Consider switching to a template.`,
            'conversation.lastInboundAt',
          ));
        }
      }
    }
  }

  // ── 3. Template variable completeness ──────────────────────────────────
  if (kind === 'template') {
    const marker = findBlock<TemplateMarkerBlock>(blocks, 'template_marker');
    if (marker) {
      for (const comp of marker.components) {
        if (comp.type === 'body') {
          const placeholders = [...comp.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]);
          for (const ph of placeholders) {
            if (!marker.variables[ph]) {
              errors.push(err(
                'TEMPLATE_VARIABLE_MISSING',
                `Template variable {{${ph}}} has no value`,
                `template.variables.${ph}`,
              ));
            }
          }
        }
      }
    }
  }

  // ── 4. Interactive buttons ──────────────────────────────────────────────
  if (kind === 'interactive_buttons') {
    const buttons = findBlocks<ReplyButtonBlock>(blocks, 'reply_button');
    if (buttons.length === 0) {
      errors.push(err('BUTTON_COUNT_EXCEEDED', 'Interactive buttons message must have at least one button', 'blocks'));
    } else if (buttons.length > caps.buttonLimits.quickReplyMax) {
      errors.push(err(
        'BUTTON_COUNT_EXCEEDED',
        `${buttons.length} quick-reply buttons exceed the limit of ${caps.buttonLimits.quickReplyMax}`,
        'blocks',
        true,
      ));
    }
    for (const [i, btn] of buttons.entries()) {
      if (btn.title.length > caps.buttonLimits.quickReplyTitleMax) {
        errors.push(err(
          'BUTTON_TITLE_TOO_LONG',
          `Button "${btn.title}" is ${btn.title.length} chars (max ${caps.buttonLimits.quickReplyTitleMax})`,
          `blocks.reply_button[${i}].title`,
          true,
        ));
      }
    }
  }

  // ── 5. Interactive list ─────────────────────────────────────────────────
  if (kind === 'interactive_list') {
    const listBtn = findBlock<ListButtonBlock>(blocks, 'list_button');
    if (listBtn) {
      if (listBtn.sections.length === 0) {
        errors.push(err('LIST_SECTION_COUNT_EXCEEDED', 'List message must have at least one section', 'blocks.list_button.sections'));
      } else if (listBtn.sections.length > caps.listLimits.sectionsMax) {
        errors.push(err(
          'LIST_SECTION_COUNT_EXCEEDED',
          `${listBtn.sections.length} sections exceed the limit of ${caps.listLimits.sectionsMax}`,
          'blocks.list_button.sections',
          true,
        ));
      }
      for (const [si, sec] of listBtn.sections.entries()) {
        if (sec.rows.length === 0) {
          errors.push(err('LIST_ROW_COUNT_EXCEEDED', `Section "${sec.title}" has no rows`, `blocks.list_button.sections[${si}].rows`));
        } else if (sec.rows.length > caps.listLimits.rowsPerSectionMax) {
          errors.push(err(
            'LIST_ROW_COUNT_EXCEEDED',
            `Section "${sec.title}" has ${sec.rows.length} rows (max ${caps.listLimits.rowsPerSectionMax})`,
            `blocks.list_button.sections[${si}].rows`,
            true,
          ));
        }
        for (const [ri, row] of sec.rows.entries()) {
          if (row.title.length > caps.listLimits.rowTitleMax) {
            errors.push(err(
              'LIST_ROW_TITLE_TOO_LONG',
              `Row "${row.title}" is ${row.title.length} chars (max ${caps.listLimits.rowTitleMax})`,
              `blocks.list_button.sections[${si}].rows[${ri}].title`,
              true,
            ));
          }
        }
      }
    }
  }

  // ── 6. URL buttons ──────────────────────────────────────────────────────
  for (const [i, btn] of findBlocks<UrlButtonBlock>(blocks, 'url_button').entries()) {
    if (!isValidUrl(btn.url)) {
      errors.push(err('URL_INVALID', `URL "${btn.url}" is not valid`, `blocks.url_button[${i}].url`));
    }
  }

  // ── 7. Phone buttons ────────────────────────────────────────────────────
  for (const [i, btn] of findBlocks<PhoneButtonBlock>(blocks, 'phone_button').entries()) {
    if (!isValidPhone(btn.phoneNumber)) {
      errors.push(err(
        'PHONE_INVALID',
        `"${btn.phoneNumber}" is not a valid international phone number`,
        `blocks.phone_button[${i}].phoneNumber`,
      ));
    }
  }

  // ── 8. Media: presence, size, MIME ──────────────────────────────────────
  const mediaBlocks: Array<MediaBlock | HeaderMediaBlock> = [
    ...findBlocks<MediaBlock>(blocks, 'media'),
    ...findBlocks<HeaderMediaBlock>(blocks, 'header_media'),
  ];
  for (const [i, mb] of mediaBlocks.entries()) {
    const media = mb.media;
    const path = `blocks.media[${i}]`;

    if (!media.url && !media.providerMediaId) {
      errors.push(err('MEDIA_MISSING_URL', 'Media attachment has no URL or provider media ID', path));
    }

    const limit = caps.mediaLimits[media.mediaType];
    if (limit) {
      if (media.sizeBytes != null && media.sizeBytes > limit.sizeMaxMb * 1024 * 1024) {
        errors.push(err(
          'MEDIA_TOO_LARGE',
          `${media.mediaType} is ${(media.sizeBytes / 1024 / 1024).toFixed(1)} MB (max ${limit.sizeMaxMb} MB)`,
          `${path}.sizeBytes`,
        ));
      }
      if (limit.mimeWhitelist.length > 0 && media.mime) {
        const mime = media.mime.toLowerCase();
        if (!limit.mimeWhitelist.includes(mime)) {
          errors.push(err(
            'MEDIA_MIME_UNSUPPORTED',
            `MIME type "${mime}" is not allowed for ${media.mediaType} on ${provider}. Allowed: ${limit.mimeWhitelist.join(', ')}`,
            `${path}.mime`,
          ));
        }
      }
    }
  }

  // ── 9. Body text ────────────────────────────────────────────────────────
  const BODY_MAX = 4096;
  const bodyBlock = findBlock<BodyTextBlock>(blocks, 'body_text');
  if (kind === 'text' && !bodyBlock) {
    errors.push(err('EMPTY_BODY', 'Text message has no body block', 'blocks'));
  }
  if (bodyBlock) {
    if (!bodyBlock.text.trim()) {
      errors.push(err('EMPTY_BODY', 'Message body is empty', 'blocks.body_text.text'));
    } else if (bodyBlock.text.length > BODY_MAX) {
      errors.push(err(
        'BODY_TOO_LONG',
        `Body is ${bodyBlock.text.length} chars (max ${BODY_MAX})`,
        'blocks.body_text.text',
        true,
      ));
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── Re-export capability lookup for callers that need both ────────────────────
export { getCapabilities } from './capabilities';
export type { ProviderCapabilities };
