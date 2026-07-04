import {
  isCanonicalPayload,
  isLegacyPayload,
  toRenderable,
  legacyBlocksToCanonical,
  foldLegacyCanonical,
  extractVariableNames,
  type CanonicalTemplate,
  type RenderableTemplate,
} from '../lib/template-compiler';
import { sendMessage } from '../whatsapp/sender';
import { logger } from '../lib/logger';

function resolveCanonical(template: any): CanonicalTemplate {
  if (isLegacyPayload(template.payload)) {
    return legacyBlocksToCanonical(
      template.payload.blocks,
      template.name,
      template.payload.category ?? template.category ?? undefined,
      template.language ?? undefined,
    );
  }
  if (isCanonicalPayload(template.payload)) {
    // fold any legacy header/footer/button fields into the body
    return foldLegacyCanonical(template.payload);
  }
  return {
    name: template.name,
    category: template.category ?? 'GENERAL',
    language: template.language ?? 'en_US',
    body: { text: template.content ?? '' },
    _meta: { variableNames: Array.isArray(template.variables) ? template.variables : [] },
  };
}

export function renderTemplate(
  template: any,
  vars: Record<string, string> = {},
): { text: string; renderable: RenderableTemplate; variables: string[] } {
  const canonical = resolveCanonical(template);
  const renderable = toRenderable(canonical, vars);
  return {
    text: renderable.body,
    renderable,
    variables: extractVariableNames(canonical),
  };
}

function makeResolver(canonical: CanonicalTemplate, variables: Record<string, string>) {
  const varNames = canonical._meta?.variableNames ?? [];
  return (text: string): string => {
    let result = text;
    varNames.forEach((name, i) => {
      result = result.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), variables[name] ?? `[${name}]`);
    });
    return result.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? `[${k}]`);
  };
}

/**
 * Send a template via Baileys with full fidelity — the recipient gets exactly
 * what the builder previewed:
 *
 *   - Media template (image/video/document) → media message with the resolved
 *     text as caption.
 *   - Text template                         → a single formatted text message.
 *
 * No buttons, no footer — those are not part of the template model.
 */
export async function sendTemplate(
  phone: string,
  template: any,
  variables: Record<string, string> = {},
  opts: { conversationId?: string; clientId?: string } = {},
): Promise<{ messageId: string }> {
  const canonical = resolveCanonical(template);
  const resolve = makeResolver(canonical, variables);
  const caption = resolve(canonical.body.text);

  // ── Media template ─────────────────────────────────────────────────────────
  const media = canonical.media;
  if (media?.url) {
    try {
      const resp = await fetch(media.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const mediaBuffer = Buffer.from(await resp.arrayBuffer());
      const contentType = resp.headers.get('content-type') || '';
      const mime = contentType ||
        (media.type === 'IMAGE' ? 'image/jpeg' : media.type === 'VIDEO' ? 'video/mp4' : 'application/octet-stream');

      const result = await sendMessage(phone, '', {
        mediaBuffer,
        mediaMimeType: mime,
        mediaFileName: media.filename || undefined,
        mediaCaption: caption || undefined,
      }, undefined, opts.clientId, opts.conversationId);

      logger.info('template.media_sent', { templateName: canonical.name, phone, type: media.type });
      return { messageId: result.id };
    } catch (err) {
      logger.warn('template.media_fetch_failed_falling_back_to_text', {
        url: media.url,
        error: err instanceof Error ? err.message : String(err),
      });
      // fall through to text so the message still goes out
    }
  }

  // ── Text template ────────────────────────────────────────────────────────────
  if (!caption.trim()) throw new Error('Template produced no sendable content.');
  const result = await sendMessage(phone, caption, undefined, undefined, opts.clientId, opts.conversationId);
  logger.info('template.text_sent', { templateName: canonical.name, phone });
  return { messageId: result.id };
}

export default { renderTemplate, sendTemplate };
