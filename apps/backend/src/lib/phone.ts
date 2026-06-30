import { parsePhoneNumberFromString } from 'libphonenumber-js';

const DEFAULT_REGION = (process.env.WA_DEFAULT_REGION || process.env.DEFAULT_COUNTRY_CODE || 'EG').toUpperCase();

export function normalizePhone(input: string, defaultCountry = DEFAULT_REGION): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (raw.includes('@g.us') || raw.includes('@broadcast')) return null;

  const stripped = raw.replace(/[^\d+]/g, '');
  const candidate = stripped.startsWith('+') ? stripped : stripped.replace(/^00/, '');

  const parsed = parsePhoneNumberFromString(candidate, defaultCountry as any);
  if (parsed?.isValid()) {
    return parsed.number;
  }

  const fallbackRegions = ['US', 'EG'];
  for (const region of fallbackRegions) {
    if (region === defaultCountry) continue;
    const parsedWithFallback = parsePhoneNumberFromString(candidate, region as any);
    if (parsedWithFallback?.isValid()) {
      return parsedWithFallback.number;
    }
  }

  const digits = stripped.replace(/[^\d]/g, '');
  if (!digits) return null;

  const localCandidate = digits.startsWith('0') ? digits : `0${digits}`;
  const parsedLocal = parsePhoneNumberFromString(localCandidate, defaultCountry as any);
  if (parsedLocal?.isValid()) {
    return parsedLocal.number;
  }

  for (const region of fallbackRegions) {
    if (region === defaultCountry) continue;
    const parsedLocalFallback = parsePhoneNumberFromString(localCandidate, region as any);
    if (parsedLocalFallback?.isValid()) {
      return parsedLocalFallback.number;
    }
  }

  return null;
}

export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(String(phone || '').trim());
}

export function phoneFingerprint(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized ? normalized.replace(/[^\d]/g, '') : '';
}

export function parseWhatsAppJid(phoneOrJid: string): string | null {
  const trimmed = String(phoneOrJid || '').trim();
  if (!trimmed) return null;
  if (trimmed.includes('@g.us') || trimmed.includes('@broadcast')) return null;
  if (trimmed.includes('@s.whatsapp.net')) {
    const [userPart] = trimmed.split('@');
    const numberPart = userPart.split(':')[0];
    // WhatsApp JIDs encode the full international number without a + prefix.
    // Prepend + so libphonenumber-js recognises the country code correctly.
    return normalizePhone(`+${numberPart}`) || normalizePhone(numberPart);
  }
  return normalizePhone(trimmed);
}

export function canonicalPhone(phone: string): string {
  return normalizePhone(phone) || '';
}

export function normalizeRecipient(phoneOrJid: string): string {
  const normalized = normalizePhone(phoneOrJid);
  if (!normalized) return '';
  return `${normalized.slice(1)}@s.whatsapp.net`;
}

export function toWhatsAppJid(phone: string): string {
  return normalizeRecipient(phone);
}

/** Returns true if the JID identifies a WhatsApp group. Used to drop group messages at the inbound gate. */
export function isGroupJid(jid: string): boolean {
  return String(jid || '').includes('@g.us');
}
