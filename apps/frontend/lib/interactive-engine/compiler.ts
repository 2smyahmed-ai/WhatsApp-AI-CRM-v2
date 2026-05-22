/**
 * Interactive Message Compiler
 *
 * Converts canonical content types (InteractiveButtonsContent, InteractiveListContent,
 * InteractiveCtaContent) into:
 *   - Meta Cloud API payloads (for sending via Meta provider)
 *   - RenderablePayload (for MessageRenderer — identical output in preview and chat)
 *   - Numbered-text fallback (for Baileys, where interactive is not reliably delivered)
 */

import type {
  InteractiveButtonsContent,
  InteractiveListContent,
  InteractiveCtaContent,
  InteractiveHeader,
  RenderablePayload,
  RenderableBlock,
  CompatibilityReport,
  CompatibilityMode,
  MessageKind,
} from '@crm/messaging-schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCompatReport(
  mode: CompatibilityMode,
  originalKind: MessageKind,
  effectiveKind: MessageKind,
  downgraded: boolean,
  reason: string | null,
): CompatibilityReport {
  return {
    mode,
    originalKind,
    effectiveKind,
    downgraded,
    downgradeReason: reason,
    warnings: [],
  };
}

function headerToMeta(header: InteractiveHeader): Record<string, unknown> | undefined {
  if (!header) return undefined;
  if (header.type === 'text') return { type: 'text', text: header.text };
  if (header.type === 'media') {
    const m = header.media;
    const t = m.mediaType === 'image' ? 'image'
            : m.mediaType === 'video' ? 'video'
            : 'document';
    return { type: t, [t]: { link: m.url } };
  }
  return undefined;
}

// ── Interactive Buttons ───────────────────────────────────────────────────────

/** Meta Cloud API payload for interactive button messages */
export function toMetaButtonsPayload(
  content: InteractiveButtonsContent,
  phone: string,
): object {
  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: content.body },
    action: {
      buttons: content.buttons.map(b => ({
        type: 'reply',
        reply: { id: b.id, title: b.title },
      })),
    },
  };

  const header = headerToMeta(content.header as InteractiveHeader);
  if (header) interactive.header = header;
  if (content.footer) interactive.footer = { text: content.footer };

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone.replace(/\D/g, ''),
    type: 'interactive',
    interactive,
  };
}

/** RenderablePayload for interactive buttons (used by MessageRenderer + preview) */
export function toButtonsRenderable(
  content: InteractiveButtonsContent,
  mode: CompatibilityMode = 'cloud_api',
): RenderablePayload {
  const blocks: RenderableBlock[] = [];

  // Header
  if (content.header) {
    const h = content.header;
    if (h.type === 'text') {
      blocks.push({ type: 'header_text', text: h.text });
    } else if (h.type === 'media') {
      blocks.push({ type: 'header_media', media: h.media });
    }
  }

  // Body
  blocks.push({ type: 'body_text', text: content.body });

  // Footer
  if (content.footer) {
    blocks.push({ type: 'footer', text: content.footer });
  }

  const downgraded = mode === 'fallback_text';

  if (downgraded) {
    // Numbered fallback for Baileys
    blocks.push({
      type: 'numbered_options',
      options: content.buttons.map((b, i) => ({ number: i + 1, label: b.title, optionId: b.id })),
    });
    return {
      kind: 'interactive_buttons',
      blocks,
      compatibility: makeCompatReport(mode, 'interactive_buttons', 'text', true, 'Provider does not support quick-reply buttons — rendered as numbered options.'),
    };
  }

  // Native buttons
  for (const b of content.buttons) {
    blocks.push({ type: 'reply_button', id: b.id, title: b.title });
  }

  return {
    kind: 'interactive_buttons',
    blocks,
    compatibility: makeCompatReport(mode, 'interactive_buttons', 'interactive_buttons', false, null),
  };
}

// ── Interactive List ──────────────────────────────────────────────────────────

export function toMetaListPayload(
  content: InteractiveListContent,
  phone: string,
): object {
  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: content.body },
    action: {
      button: content.buttonText,
      sections: content.sections.map(s => ({
        title: s.title,
        rows: s.rows.map(r => ({
          id: r.id,
          title: r.title,
          ...(r.description ? { description: r.description } : {}),
        })),
      })),
    },
  };

  const header = headerToMeta(content.header as InteractiveHeader);
  if (header) interactive.header = header;
  if (content.footer) interactive.footer = { text: content.footer };

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone.replace(/\D/g, ''),
    type: 'interactive',
    interactive,
  };
}

export function toListRenderable(
  content: InteractiveListContent,
  mode: CompatibilityMode = 'cloud_api',
): RenderablePayload {
  const blocks: RenderableBlock[] = [];

  if (content.header) {
    const h = content.header;
    if (h.type === 'text') {
      blocks.push({ type: 'header_text', text: h.text });
    } else if (h.type === 'media') {
      blocks.push({ type: 'header_media', media: h.media });
    }
  }

  blocks.push({ type: 'body_text', text: content.body });

  if (content.footer) {
    blocks.push({ type: 'footer', text: content.footer });
  }

  const downgraded = mode === 'fallback_text';

  if (downgraded) {
    // Flatten all rows into numbered options
    const allRows = content.sections.flatMap(s => s.rows);
    blocks.push({
      type: 'numbered_options',
      intro: content.buttonText,
      options: allRows.map((r, i) => ({ number: i + 1, label: r.title, optionId: r.id })),
    });
    return {
      kind: 'interactive_list',
      blocks,
      compatibility: makeCompatReport(mode, 'interactive_list', 'text', true, 'Provider does not support list messages — rendered as numbered options.'),
    };
  }

  blocks.push({
    type: 'list_button',
    buttonText: content.buttonText,
    sections: content.sections,
  });

  return {
    kind: 'interactive_list',
    blocks,
    compatibility: makeCompatReport(mode, 'interactive_list', 'interactive_list', false, null),
  };
}

// ── Interactive CTA ───────────────────────────────────────────────────────────

export function toMetaCtaPayload(
  content: InteractiveCtaContent,
  phone: string,
): object {
  const interactive: Record<string, unknown> = {
    type: 'cta_url',
    body: { text: content.body },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: content.cta.displayText,
        url: content.cta.url,
      },
    },
  };

  const header = headerToMeta(content.header as InteractiveHeader);
  if (header) interactive.header = header;
  if (content.footer) interactive.footer = { text: content.footer };

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone.replace(/\D/g, ''),
    type: 'interactive',
    interactive,
  };
}

export function toCtaRenderable(
  content: InteractiveCtaContent,
  mode: CompatibilityMode = 'cloud_api',
): RenderablePayload {
  const blocks: RenderableBlock[] = [];

  if (content.header) {
    const h = content.header;
    if (h.type === 'text') {
      blocks.push({ type: 'header_text', text: h.text });
    } else if (h.type === 'media') {
      blocks.push({ type: 'header_media', media: h.media });
    }
  }

  blocks.push({ type: 'body_text', text: content.body });

  if (content.footer) {
    blocks.push({ type: 'footer', text: content.footer });
  }

  const downgraded = mode === 'fallback_text';

  if (downgraded) {
    // Send URL inline as text
    blocks.push({
      type: 'body_text',
      text: `\n${content.cta.displayText}: ${content.cta.url}`,
    });
    return {
      kind: 'interactive_cta',
      blocks,
      compatibility: makeCompatReport(mode, 'interactive_cta', 'text', true, 'Provider does not support CTA cards — URL sent as inline text.'),
    };
  }

  blocks.push({ type: 'cta_card', displayText: content.cta.displayText, url: content.cta.url });

  return {
    kind: 'interactive_cta',
    blocks,
    compatibility: makeCompatReport(mode, 'interactive_cta', 'interactive_cta', false, null),
  };
}

// ── Unified dispatcher ────────────────────────────────────────────────────────

export type InteractiveContent =
  | InteractiveButtonsContent
  | InteractiveListContent
  | InteractiveCtaContent;

export function toMetaInteractivePayload(content: InteractiveContent, phone: string): object {
  if (content.kind === 'interactive_buttons') return toMetaButtonsPayload(content, phone);
  if (content.kind === 'interactive_list')    return toMetaListPayload(content, phone);
  if (content.kind === 'interactive_cta')     return toMetaCtaPayload(content, phone);
  throw new Error(`Unsupported interactive kind: ${(content as any).kind}`);
}

export function toInteractiveRenderable(
  content: InteractiveContent,
  mode: CompatibilityMode = 'cloud_api',
): RenderablePayload {
  if (content.kind === 'interactive_buttons') return toButtonsRenderable(content, mode);
  if (content.kind === 'interactive_list')    return toListRenderable(content, mode);
  if (content.kind === 'interactive_cta')     return toCtaRenderable(content, mode);
  throw new Error(`Unsupported interactive kind: ${(content as any).kind}`);
}
