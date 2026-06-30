import type {
  RenderablePayload,
  RenderableBlock,
  BodyTextBlock,
  MediaBlock,
  FooterBlock,
  ReplyButtonBlock,
  UrlButtonBlock,
  ListButtonBlock,
  CtaCardBlock,
  NumberedOptionsBlock,
  LocationBlock,
  TemplateMarkerBlock,
} from '@crm/messaging-schema';
import type { ProviderName } from '@crm/messaging-schema';

// ── Output type ───────────────────────────────────────────────────────────────

/** Baileys sendMessage content shape (AnyMessageContent subset). */
export type BaileysMessageContent = Record<string, unknown>;

/** Provider payload — always Baileys. */
export type ProviderPayload = { provider: 'baileys'; payload: BaileysMessageContent };

// ── Block lookup helpers ──────────────────────────────────────────────────────

function findBlock<T extends RenderableBlock>(blocks: RenderableBlock[], type: T['type']): T | undefined {
  return blocks.find((b) => b.type === type) as T | undefined;
}

function findBlocks<T extends RenderableBlock>(blocks: RenderableBlock[], type: T['type']): T[] {
  return blocks.filter((b) => b.type === type) as T[];
}

// ── Baileys compiler ──────────────────────────────────────────────────────────
// Interactive message kinds (buttons, list, CTA) are converted to numbered-text
// menus for WhatsApp delivery. The CRM shows visual buttons; WhatsApp gets plain text.

function compileBaileysContent(renderable: RenderablePayload): BaileysMessageContent {
  const { kind, blocks } = renderable;

  // ── Media ──
  if (kind === 'media') {
    const mediaBlock = findBlock<MediaBlock>(blocks, 'media');
    if (mediaBlock) {
      const { media, caption } = mediaBlock;
      const mime = media.mime?.toLowerCase() ?? '';
      const src = media.url ? { url: media.url } : {};
      if (mime.startsWith('image/')) return { image: src, ...(caption ? { caption } : {}) };
      if (mime.startsWith('video/')) return { video: src, ...(caption ? { caption } : {}) };
      if (mime === 'audio/ogg' || mime.startsWith('audio/')) return { audio: src, ptt: mime === 'audio/ogg' };
      return {
        document: src,
        mimetype: mime || 'application/octet-stream',
        ...(caption ? { caption } : {}),
      };
    }
  }

  // ── Location ──
  if (kind === 'location') {
    const loc = findBlock<LocationBlock>(blocks, 'location');
    if (loc) {
      return {
        location: {
          degreesLatitude: loc.latitude,
          degreesLongitude: loc.longitude,
          ...(loc.name ? { name: loc.name } : {}),
        },
      };
    }
  }

  // ── Interactive buttons → numbered text ──
  if (kind === 'interactive_buttons') {
    const body = findBlock<BodyTextBlock>(blocks, 'body_text');
    const buttons = findBlocks<ReplyButtonBlock>(blocks, 'reply_button');
    let text = body?.text ?? '';
    if (buttons.length) {
      const optionLines = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
      text = text
        ? `${text}\n\n${optionLines}\n\nReply with the number of your choice.`
        : `${optionLines}\n\nReply with the number of your choice.`;
    }
    return { text: text || '[Interactive message]' };
  }

  // ── Interactive list → numbered text ──
  if (kind === 'interactive_list') {
    const body = findBlock<BodyTextBlock>(blocks, 'body_text');
    const listBtn = findBlock<ListButtonBlock>(blocks, 'list_button');
    let text = body?.text ?? '';
    if (listBtn?.sections?.length) {
      const allRows = listBtn.sections.flatMap((s) => s.rows);
      const optionLines = allRows.map((r, i) => `${i + 1}. ${r.title}`).join('\n');
      text = text
        ? `${text}\n\n${optionLines}\n\nReply with the number of your choice.`
        : `${optionLines}\n\nReply with the number of your choice.`;
    }
    return { text: text || '[List message]' };
  }

  // ── Interactive CTA → text + URL ──
  if (kind === 'interactive_cta') {
    const body = findBlock<BodyTextBlock>(blocks, 'body_text');
    const cta = findBlock<CtaCardBlock>(blocks, 'cta_card');
    const parts: string[] = [];
    if (body?.text) parts.push(body.text);
    if (cta) parts.push(`${cta.displayText}: ${cta.url}`);
    return { text: parts.join('\n\n') || '[CTA message]' };
  }

  // ── Text, templates, numbered_options, fallbacks ──
  const bodyBlock = findBlock<BodyTextBlock>(blocks, 'body_text');
  const numberedBlock = findBlock<NumberedOptionsBlock>(blocks, 'numbered_options');

  let text = bodyBlock?.text ?? '';

  if (numberedBlock) {
    const intro = numberedBlock.intro ? `${numberedBlock.intro}\n\n` : '';
    const optionLines = numberedBlock.options.map((o) => `${o.number}. ${o.label}`).join('\n');
    const suffix = '\n\nReply with the number of your choice.';
    text = text ? `${text}\n\n${intro}${optionLines}${suffix}` : `${intro}${optionLines}${suffix}`;
  }

  if (!text) {
    const marker = findBlock<TemplateMarkerBlock>(blocks, 'template_marker');
    if (marker) text = `[Template: ${marker.templateName}]`;
  }

  return { text: text || '[Unsupported message]' };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compile a RenderablePayload into a Baileys-compatible send payload.
 *
 * Pure function — no I/O, no side effects.
 */
export function compileProviderPayload(
  renderable: RenderablePayload,
  _provider: ProviderName,
  _to: string,
  _replyExternalId?: string | null,
): ProviderPayload {
  return {
    provider: 'baileys',
    payload: compileBaileysContent(renderable),
  };
}
