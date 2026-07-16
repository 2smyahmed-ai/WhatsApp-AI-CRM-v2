import {
  isCanonicalPayload,
  isLegacyPayload,
  toRenderable,
  legacyBlocksToCanonical,
  foldLegacyCanonical,
  extractVariableNames,
  type CanonicalMedia,
  type CanonicalTemplate,
  type MediaType,
  type RenderableTemplate,
} from '../lib/template-compiler';
import { sendMessage } from '../whatsapp/sender';
import { loadMedia, isAudioMediaType, resolveMediaUrl, toStorageRef } from '../lib/media';
import { logger } from '../lib/logger';

/**
 * A template's attachment is recorded in two places: inside the canonical
 * `payload.media` blob, and in the dedicated `mediaUrl`/`mediaType`/
 * `mediaFilename`/`mediaMimeType` columns.
 *
 * That is deliberate, not redundant. Templates saved before the canonical
 * payload existed only have the columns; templates written by the builder only
 * used to have the payload; and a broadcast saved as a template needs its
 * attachment queryable without parsing JSON. Reading merges both, preferring the
 * payload but never dropping an attachment that lives only in a column — which
 * is exactly how media used to disappear when a template was loaded back.
 */
function mediaFromColumns(template: any): CanonicalMedia | undefined {
  const url = toStorageRef(template.mediaUrl);
  if (!url) return undefined;
  return {
    type: (template.mediaType as MediaType) || 'DOCUMENT',
    url,
    filename: template.mediaFilename ?? undefined,
    mimeType: template.mediaMimeType ?? undefined,
  };
}

function withColumnMedia(canonical: CanonicalTemplate, template: any): CanonicalTemplate {
  const fromColumns = mediaFromColumns(template);
  if (!canonical.media && fromColumns) return { ...canonical, media: fromColumns };

  // The payload knows the type; the columns may know the filename/mime it lacks.
  if (canonical.media && fromColumns) {
    return {
      ...canonical,
      media: {
        ...canonical.media,
        url: canonical.media.url ?? fromColumns.url,
        filename: canonical.media.filename ?? fromColumns.filename,
        mimeType: canonical.media.mimeType ?? fromColumns.mimeType,
      },
    };
  }
  return canonical;
}

function resolveCanonical(template: any): CanonicalTemplate {
  if (isLegacyPayload(template.payload)) {
    return withColumnMedia(
      legacyBlocksToCanonical(
        template.payload.blocks,
        template.name,
        template.payload.category ?? template.category ?? undefined,
        template.language ?? undefined,
      ),
      template,
    );
  }
  if (isCanonicalPayload(template.payload)) {
    // fold any legacy header/footer/button fields into the body
    return withColumnMedia(foldLegacyCanonical(template.payload), template);
  }
  return withColumnMedia(
    {
      name: template.name,
      category: template.category ?? 'GENERAL',
      language: template.language ?? 'en_US',
      body: { text: template.content ?? '' },
      _meta: { variableNames: Array.isArray(template.variables) ? template.variables : [] },
    },
    template,
  );
}

export function renderTemplate(
  template: any,
  vars: Record<string, string> = {},
): { text: string; renderable: RenderableTemplate; variables: string[] } {
  const canonical = resolveCanonical(template);
  const renderable = toRenderable(canonical, vars);
  // The wire wants something a browser can load; storage wants a portable ref.
  if (renderable.media?.url) {
    renderable.media = { ...renderable.media, url: resolveMediaUrl(renderable.media.url) ?? undefined };
  }
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
 *   - Audio template                        → a WhatsApp voice message (no caption).
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
    const loaded = await loadMedia(media.url, media.type, media.filename);
    if (loaded) {
      const isVoice = isAudioMediaType(media.type);
      const result = await sendMessage(
        phone,
        '',
        {
          mediaBuffer: loaded.buffer,
          mediaMimeType: media.mimeType || loaded.mimetype,
          mediaFileName: media.filename || undefined,
          // WhatsApp audio carries no caption; anything else does.
          mediaCaption: isVoice ? undefined : caption || undefined,
          mediaIsVoiceNote: isVoice,
          // Points the persisted CRM message at the stored file so it renders in chat.
          mediaUrl: resolveMediaUrl(media.url) ?? undefined,
        },
        undefined,
        opts.clientId,
        opts.conversationId,
      );

      logger.info('template.media_sent', { templateName: canonical.name, phone, type: media.type });
      return { messageId: result.id };
    }

    // The attachment is gone from storage. Falling back to text would quietly
    // turn an image template into a bare caption, so say so loudly instead of
    // pretending the send succeeded as intended.
    logger.warn('template.media_missing_falling_back_to_text', {
      templateName: canonical.name,
      url: media.url,
    });
    if (!caption.trim()) {
      throw new Error('This template\'s attachment is missing from storage and it has no text to fall back on.');
    }
  }

  // ── Text template ────────────────────────────────────────────────────────────
  if (!caption.trim()) throw new Error('Template produced no sendable content.');
  const result = await sendMessage(phone, caption, undefined, undefined, opts.clientId, opts.conversationId);
  logger.info('template.text_sent', { templateName: canonical.name, phone });
  return { messageId: result.id };
}

export default { renderTemplate, sendTemplate };
