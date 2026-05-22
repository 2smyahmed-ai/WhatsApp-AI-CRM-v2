/**
 * Interactive Message Service
 *
 * Sends interactive messages (buttons, list, CTA) via the Meta Cloud API.
 * Unlike template messages, interactive messages do not require pre-approval
 * but DO require an active 24-hour customer service window.
 *
 * For Baileys conversations, interactive messages are converted to numbered
 * plain-text fallback since WhatsApp blocks programmatic interactive sends.
 */

import { logger } from '../lib/logger';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function cfg() {
  return {
    accessToken:   process.env.META_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? '',
  };
}

async function metaFetch(path: string, init: RequestInit = {}): Promise<any> {
  const { accessToken } = cfg();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error?.message ?? `Meta API error ${res.status}`);
  return data;
}

// ── Meta payload builders ─────────────────────────────────────────────────────

function buildButtonsPayload(phone: string, content: any): object {
  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: content.body },
    action: {
      buttons: (content.buttons ?? []).map((b: any) => ({
        type: 'reply',
        reply: { id: b.id, title: b.title },
      })),
    },
  };
  if (content.header?.type === 'text') interactive.header = { type: 'text', text: content.header.text };
  if (content.footer) interactive.footer = { text: content.footer };

  return { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone.replace(/\D/g, ''), type: 'interactive', interactive };
}

function buildListPayload(phone: string, content: any): object {
  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: content.body },
    action: {
      button: content.buttonText ?? 'Select',
      sections: (content.sections ?? []).map((s: any) => ({
        title: s.title,
        rows: (s.rows ?? []).map((r: any) => ({
          id: r.id,
          title: r.title,
          ...(r.description ? { description: r.description } : {}),
        })),
      })),
    },
  };
  if (content.header?.type === 'text') interactive.header = { type: 'text', text: content.header.text };
  if (content.footer) interactive.footer = { text: content.footer };

  return { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone.replace(/\D/g, ''), type: 'interactive', interactive };
}

function buildCtaPayload(phone: string, content: any): object {
  const interactive: Record<string, unknown> = {
    type: 'cta_url',
    body: { text: content.body },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: content.cta?.displayText ?? 'Open',
        url: content.cta?.url ?? '',
      },
    },
  };
  if (content.header?.type === 'text') interactive.header = { type: 'text', text: content.header.text };
  if (content.footer) interactive.footer = { text: content.footer };

  return { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone.replace(/\D/g, ''), type: 'interactive', interactive };
}

// ── Baileys text fallback ─────────────────────────────────────────────────────

function buildBaileysText(content: any): string {
  const lines: string[] = [];
  if (content.header?.text) lines.push(`*${content.header.text}*`);
  lines.push(content.body ?? '');
  if (content.footer) lines.push(`_${content.footer}_`);

  if (content.kind === 'interactive_buttons' && content.buttons?.length > 0) {
    lines.push('\nOptions:');
    (content.buttons as any[]).forEach((b, i) => lines.push(`${i + 1}. ${b.title}`));
    lines.push('\n_Reply with a number to choose._');
  }

  if (content.kind === 'interactive_list') {
    const allRows = (content.sections ?? []).flatMap((s: any) => s.rows ?? []);
    lines.push(`\n${content.buttonText ?? 'Options'}:`);
    allRows.forEach((r: any, i: number) => {
      const desc = r.description ? ` — ${r.description}` : '';
      lines.push(`${i + 1}. ${r.title}${desc}`);
    });
    lines.push('\n_Reply with a number to choose._');
  }

  if (content.kind === 'interactive_cta' && content.cta) {
    lines.push(`\n${content.cta.displayText}: ${content.cta.url}`);
  }

  return lines.join('\n');
}

// ── Public service ────────────────────────────────────────────────────────────

export type InteractiveKind = 'interactive_buttons' | 'interactive_list' | 'interactive_cta';

export const interactiveMessageService = {
  /**
   * Send an interactive message to a phone number via Meta Cloud API.
   */
  async sendViaMeta(
    phone: string,
    content: { kind: InteractiveKind; [key: string]: unknown },
  ): Promise<{ messageId: string }> {
    const { phoneNumberId } = cfg();

    let payload: object;
    switch (content.kind) {
      case 'interactive_buttons': payload = buildButtonsPayload(phone, content); break;
      case 'interactive_list':    payload = buildListPayload(phone, content);    break;
      case 'interactive_cta':     payload = buildCtaPayload(phone, content);     break;
      default: throw new Error(`Unsupported interactive kind: ${(content as any).kind}`);
    }

    logger.info('interactive.send_payload', { phone, kind: content.kind });

    const result = await metaFetch(`/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const messageId: string = result?.messages?.[0]?.id;
    if (!messageId) throw new Error('Meta API did not return a message ID');

    logger.info('interactive.sent', { phone, kind: content.kind, messageId });
    return { messageId };
  },

  /**
   * Build the Baileys-compatible fallback text for an interactive message.
   * Used when the conversation is served by Baileys provider.
   */
  buildBaileysText(content: { kind: InteractiveKind; [key: string]: unknown }): string {
    return buildBaileysText(content);
  },
};

export default interactiveMessageService;
