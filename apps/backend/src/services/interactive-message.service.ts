/**
 * Interactive Message Service
 *
 * Sends interactive messages (buttons, list, CTA) via Baileys.
 * Interactive message types are auto-downgraded to numbered plain-text
 * menus since WhatsApp blocks programmatic interactive sends on web clients.
 */

import { logger } from '../lib/logger';
import { providerManager } from '../providers/manager';

// ── Baileys text builder ──────────────────────────────────────────────────────

function buildText(content: any): string {
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
   * Send an interactive message as formatted Baileys text.
   * Buttons and list options are rendered as numbered choices.
   */
  async send(
    phone: string,
    content: { kind: InteractiveKind; [key: string]: unknown },
  ): Promise<{ messageId: string }> {
    const text = buildText(content);
    logger.info('interactive.send', { phone, kind: content.kind });
    const result = await providerManager.sendMessage({ phone, text });
    logger.info('interactive.sent', { phone, kind: content.kind, messageId: result.messageId });
    return result;
  },

  /** Build the formatted plain-text representation without sending. */
  buildText(content: { kind: InteractiveKind; [key: string]: unknown }): string {
    return buildText(content);
  },
};

export default interactiveMessageService;
