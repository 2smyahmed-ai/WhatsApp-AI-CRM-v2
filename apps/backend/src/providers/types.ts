export type ProviderName = 'baileys' | 'meta';

export interface SendMessageInput {
  /** Caller-generated UUID for idempotency and optimistic reconciliation. */
  clientId?: string;
  /** Known conversation ID — skips resolver lookup so the socket event lands in the right chat. */
  conversationId?: string;
  phone: string;
  text?: string;
  media?: {
    buffer: Buffer;
    mimetype: string;
    filename?: string;
    caption?: string;
    duration?: number;
    isVoiceNote?: boolean;
    url?: string;
  };
  replyTo?: {
    id: string;
    body: string;
  };
}

export interface ProviderStatus {
  status: 'connected' | 'disconnected' | 'connecting';
  qr?: string | null;
  connectedPhone?: string | null;
  error?: { statusCode?: number; reason?: string; message?: string } | null;
}

export interface MessagingProvider {
  readonly name: ProviderName;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ProviderStatus;
  sendMessage(input: SendMessageInput): Promise<{ messageId: string }>;
  sendReaction(phone: string, messageExternalId: string, fromMe: boolean, emoji: string): Promise<void>;
  getProfilePictureUrl(phone: string): Promise<string | null>;
}
