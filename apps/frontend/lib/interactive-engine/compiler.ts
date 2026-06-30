/**
 * Interactive Message Compiler
 *
 * Converts canonical interactive content types into:
 *   - RenderablePayload (for MessageRenderer — identical output in preview and chat)
 *   - Numbered-text fallback (when Baileys native interactive is not supported)
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

// ── Interactive Buttons ───────────────────────────────────────────────────────

/** RenderablePayload for interactive buttons (used by MessageRenderer + preview) */
export function toButtonsRenderable(
  content: InteractiveButtonsContent,
  mode: CompatibilityMode = 'baileys_native',
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
    blocks.push({
      type: 'numbered_options',
      options: content.buttons.map((b, i) => ({ number: i + 1, label: b.title, optionId: b.id })),
    });
    return {
      kind: 'interactive_buttons',
      blocks,
      compatibility: makeCompatReport(mode, 'interactive_buttons', 'text', true, 'Interactive buttons not supported — rendered as numbered options.'),
    };
  }

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

export function toListRenderable(
  content: InteractiveListContent,
  mode: CompatibilityMode = 'baileys_native',
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
    const allRows = content.sections.flatMap(s => s.rows);
    blocks.push({
      type: 'numbered_options',
      intro: content.buttonText,
      options: allRows.map((r, i) => ({ number: i + 1, label: r.title, optionId: r.id })),
    });
    return {
      kind: 'interactive_list',
      blocks,
      compatibility: makeCompatReport(mode, 'interactive_list', 'text', true, 'List messages not supported — rendered as numbered options.'),
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

export function toCtaRenderable(
  content: InteractiveCtaContent,
  mode: CompatibilityMode = 'baileys_native',
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
    blocks.push({
      type: 'body_text',
      text: `\n${content.cta.displayText}: ${content.cta.url}`,
    });
    return {
      kind: 'interactive_cta',
      blocks,
      compatibility: makeCompatReport(mode, 'interactive_cta', 'text', true, 'CTA cards not supported — URL sent as inline text.'),
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

export function toInteractiveRenderable(
  content: InteractiveContent,
  mode: CompatibilityMode = 'baileys_native',
): RenderablePayload {
  if (content.kind === 'interactive_buttons') return toButtonsRenderable(content, mode);
  if (content.kind === 'interactive_list')    return toListRenderable(content, mode);
  if (content.kind === 'interactive_cta')     return toCtaRenderable(content, mode);
  throw new Error(`Unsupported interactive kind: ${(content as any).kind}`);
}
