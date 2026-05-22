import type { MessagingProvider, SendMessageInput } from './types';
import { BaileysProvider } from './baileys.provider';
import { MetaWhatsAppProvider } from './meta.provider';
import { logger } from '../lib/logger';

class ProviderManager {
  private primary: MessagingProvider;
  private fallback: MessagingProvider | null;

  constructor() {
    const name = (process.env.WHATSAPP_PROVIDER ?? 'baileys').toLowerCase();
    if (name === 'meta') {
      this.primary = new MetaWhatsAppProvider();
      this.fallback = null; // Meta-only: no Baileys socket needed
    } else {
      this.primary = new BaileysProvider();
      this.fallback = null;
    }
    logger.info(`provider.active: ${this.primary.name}`);
  }

  getProvider(): MessagingProvider {
    return this.primary;
  }

  async connect(): Promise<void> {
    // Connect fallback silently so it's ready for failover
    if (this.fallback) {
      this.fallback.connect().catch((err) => {
        logger.warn('provider.fallback_connect_failed', {
          provider: this.fallback!.name,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    return this.primary.connect();
  }

  async disconnect(): Promise<void> {
    if (this.fallback) {
      await this.fallback.disconnect().catch(() => {});
    }
    return this.primary.disconnect();
  }

  getStatus() {
    return this.primary.getStatus();
  }

  async sendMessage(input: SendMessageInput): Promise<{ messageId: string }> {
    try {
      return await this.primary.sendMessage(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('provider.primary_send_failed', { primary: this.primary.name, error: message });
      // Why: while debugging Meta setup we want the real Meta error to surface, not a silent
      // Baileys fallback that sends from the user's personal number. Re-enable with
      // WHATSAPP_ALLOW_FALLBACK=true once Meta is verified working.
      if (this.fallback && process.env.WHATSAPP_ALLOW_FALLBACK === 'true') {
        logger.warn('provider.primary_failed_falling_back', {
          primary: this.primary.name,
          fallback: this.fallback.name,
          error: message,
        });
        return this.fallback.sendMessage(input);
      }
      throw err;
    }
  }

  async sendReaction(
    phone: string,
    messageExternalId: string,
    fromMe: boolean,
    emoji: string,
  ): Promise<void> {
    try {
      return await this.primary.sendReaction(phone, messageExternalId, fromMe, emoji);
    } catch (err) {
      if (this.fallback && process.env.WHATSAPP_ALLOW_FALLBACK === 'true') {
        return this.fallback.sendReaction(phone, messageExternalId, fromMe, emoji);
      }
      throw err;
    }
  }

  async getProfilePictureUrl(phone: string): Promise<string | null> {
    return this.primary.getProfilePictureUrl(phone);
  }
}

export const providerManager = new ProviderManager();
