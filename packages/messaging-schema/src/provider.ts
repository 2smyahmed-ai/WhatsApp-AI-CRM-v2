/**
 * Identifies a messaging transport. Open for forward compatibility — the wire
 * representation is `string`, but code should narrow to this union.
 */
export type ProviderName = 'meta' | 'baileys' | 'twilio' | '360dialog';

/**
 * Runtime list of known providers. Use for iteration / UI dropdowns.
 */
export const PROVIDER_NAMES = ['meta', 'baileys', 'twilio', '360dialog'] as const;
