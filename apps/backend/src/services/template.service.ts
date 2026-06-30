import {
  isCanonicalPayload,
  isLegacyPayload,
  toRenderable,
  toBaileysPayload,
  legacyBlocksToCanonical,
  extractVariableNames,
  type CanonicalTemplate,
  type RenderableTemplate,
} from '../lib/template-compiler';
import { sendMessage } from '../whatsapp/sender';
import { logger } from '../lib/logger';

function resolveCanonical(template: any): CanonicalTemplate {
  if (isCanonicalPayload(template.payload)) {
    return template.payload as CanonicalTemplate;
  }
  if (isLegacyPayload(template.payload)) {
    return legacyBlocksToCanonical(
      template.payload.blocks,
      template.name,
      template.payload.category ?? template.category ?? undefined,
      template.language ?? undefined,
    );
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
  const variables  = extractVariableNames(canonical);

  return {
    text: renderable.body,
    renderable,
    variables,
  };
}

/**
 * Send a template via Baileys. Resolves variables, compiles to text/media,
 * then delegates to sendMessage(). No approval required.
 *
 * Media headers (IMAGE/VIDEO/DOCUMENT) are fetched from their URL and sent
 * as actual WhatsApp media with the body text as caption, so the image/video
 * actually appears on the recipient's device instead of as a bare URL link.
 */
export async function sendTemplate(
  phone: string,
  template: any,
  variables: Record<string, string> = {},
): Promise<{ messageId: string }> {
  const canonical = resolveCanonical(template);
  const varNames = canonical._meta?.variableNames ?? [];

  function resolve(text: string): string {
    let result = text;
    varNames.forEach((name, i) => {
      result = result.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), variables[name] ?? `[${name}]`);
    });
    return result.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? `[${k}]`);
  }

  const bodyText = resolve(canonical.body.text) +
    (canonical.footer?.text ? `\n\n_${canonical.footer.text}_` : '');

  let lastMessageId = '';
  let bodyAlreadySent = false;

  // ── Media header: fetch and deliver as real WhatsApp media ─────────────────
  const h = canonical.header;
  if (h && (h.type === 'IMAGE' || h.type === 'VIDEO' || h.type === 'DOCUMENT') && h.url) {
    try {
      const resp = await fetch(h.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const mediaBuffer = Buffer.from(await resp.arrayBuffer());
      const contentType = resp.headers.get('content-type') || '';
      const mime = contentType ||
        (h.type === 'IMAGE' ? 'image/jpeg' : h.type === 'VIDEO' ? 'video/mp4' : 'application/octet-stream');

      const result = await sendMessage(phone, '', {
        mediaBuffer,
        mediaMimeType: mime,
        mediaFileName: h.filename || undefined,
        mediaCaption: bodyText || undefined,
      });
      lastMessageId = result.id;
      bodyAlreadySent = true;
      logger.info('template.media_header_sent', { templateName: canonical.name, phone, type: h.type });
    } catch (err) {
      logger.warn('template.media_header_fetch_failed', {
        url: h.url,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to text-only path
    }
  }

  // ── Text body (when no media header or media failed) ───────────────────────
  if (!bodyAlreadySent) {
    const { messages } = toBaileysPayload(canonical, variables);
    const combined = messages.filter(m => m.trim()).join('\n\n');
    if (!combined) throw new Error('Template produced no sendable content.');
    const result = await sendMessage(phone, combined);
    lastMessageId = result.id;
  } else if (canonical.buttons?.length) {
    // Body was sent as media caption — append button options as follow-up text
    let buttonText = '';
    canonical.buttons.forEach((btn, i) => {
      if (btn.type === 'QUICK_REPLY') buttonText += `\n${i + 1}. ${btn.text}`;
      else if (btn.type === 'URL' && btn.url) buttonText += `\n🔗 ${btn.text}: ${resolve(btn.url)}`;
      else if (btn.type === 'PHONE_NUMBER' && btn.phone_number) buttonText += `\n📞 ${btn.text}: ${btn.phone_number}`;
    });
    if (buttonText) {
      const result = await sendMessage(phone, `Options:${buttonText}\n\n_Reply with a number._`);
      lastMessageId = result.id;
    }
  }

  logger.info('template.sent_via_baileys', { templateName: canonical.name, phone });
  return { messageId: lastMessageId };
}

export default { renderTemplate, sendTemplate };
