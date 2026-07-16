/**
 * Client-side mirror of the backend custom-field contract
 * (apps/backend/src/contacts/custom-fields.constants.ts).
 *
 * The server is the authority: it re-validates and coerces every value it is
 * sent. What lives here is only what the UI needs to *render* a field and give
 * immediate feedback before a round trip.
 */

export const CUSTOM_FIELD_TYPES = [
  'TEXT',
  'NUMBER',
  'EMAIL',
  'PHONE',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
  'CHECKBOX',
  'URL',
  'CURRENCY',
  'NOTES',
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomFieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: CustomFieldOption[] | null;
  required: boolean;
  defaultValue: unknown;
  placeholder: string | null;
  helpText: string | null;
  currency: string | null;
  order: number;
  isActive: boolean;
}

export type CustomFieldValues = Record<string, unknown>;

/** Types whose value comes from `options`. */
export const CHOICE_TYPES: ReadonlySet<CustomFieldType> = new Set(['SELECT', 'MULTI_SELECT']);

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  EMAIL: 'Email',
  PHONE: 'Phone',
  DATE: 'Date',
  SELECT: 'Dropdown',
  MULTI_SELECT: 'Multi select',
  CHECKBOX: 'Checkbox',
  URL: 'URL',
  CURRENCY: 'Currency',
  NOTES: 'Notes',
};

export const FIELD_TYPE_HINTS: Record<CustomFieldType, string> = {
  TEXT: 'A single line of text',
  NUMBER: 'Any number',
  EMAIL: 'A validated email address',
  PHONE: 'A phone number, normalized to international format',
  DATE: 'A calendar date, with no time zone',
  SELECT: 'One choice from a list',
  MULTI_SELECT: 'Any number of choices from a list',
  CHECKBOX: 'Yes or no',
  URL: 'A validated web address',
  CURRENCY: 'A money amount',
  NOTES: 'A long, multi-line note',
};

/** Mirrors `slugifyFieldKey` on the server so the preview matches what is saved. */
export function slugifyFieldKey(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 48);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NUMBER_RE = /^-?(\d+\.?\d*|\.\d+)$/;

/**
 * Immediate, optimistic validation for one field. Deliberately a subset of the
 * server's rules — phone parsing and duplicate detection need the backend — but
 * it never says "valid" where the server would say "invalid".
 */
export function validateFieldValue(definition: CustomFieldDefinition, value: unknown): string | null {
  const blank =
    value == null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);

  if (blank) return definition.required ? `${definition.label} is required.` : null;

  switch (definition.type) {
    case 'EMAIL':
      return EMAIL_RE.test(String(value).trim()) ? null : `${definition.label} must be a valid email address.`;
    case 'NUMBER':
    case 'CURRENCY': {
      const cleaned = String(value).replace(/[^\d.\-]/g, '');
      return NUMBER_RE.test(cleaned) ? null : `${definition.label} must be a number.`;
    }
    case 'URL': {
      try {
        const raw = String(value).trim();
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        return url.hostname.includes('.') ? null : `${definition.label} must be a valid URL.`;
      } catch {
        return `${definition.label} must be a valid URL.`;
      }
    }
    case 'DATE':
      return Number.isNaN(new Date(String(value)).getTime()) ? `${definition.label} must be a valid date.` : null;
    case 'SELECT':
      return (definition.options ?? []).some((option) => option.value === value)
        ? null
        : `${definition.label} must be one of the listed options.`;
    case 'NOTES':
      return String(value).length > 5000 ? `${definition.label} must be 5000 characters or fewer.` : null;
    case 'TEXT':
      return String(value).length > 500 ? `${definition.label} must be 500 characters or fewer.` : null;
    default:
      return null;
  }
}

/** Human-readable rendering of a stored value, for read-only surfaces. */
export function formatFieldValue(definition: CustomFieldDefinition, value: unknown, locale = 'en'): string {
  if (value == null || value === '') return '—';

  switch (definition.type) {
    case 'CHECKBOX':
      return value ? 'Yes' : 'No';
    case 'CURRENCY': {
      const amount = Number(value);
      if (!Number.isFinite(amount)) return String(value);
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: definition.currency || 'USD',
        }).format(amount);
      } catch {
        return `${definition.currency ?? ''} ${amount.toLocaleString(locale)}`.trim();
      }
    }
    case 'NUMBER':
      return Number(value).toLocaleString(locale);
    case 'DATE': {
      // Stored as a zone-free calendar date; render it as one, not as an instant.
      const parsed = new Date(`${String(value)}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return String(value);
      return parsed.toLocaleDateString(locale, { dateStyle: 'medium', timeZone: 'UTC' });
    }
    case 'SELECT': {
      const match = (definition.options ?? []).find((option) => option.value === value);
      return match?.label ?? String(value);
    }
    case 'MULTI_SELECT': {
      const values = Array.isArray(value) ? value : [value];
      return values
        .map((entry) => (definition.options ?? []).find((option) => option.value === entry)?.label ?? String(entry))
        .join(', ');
    }
    default:
      return String(value);
  }
}

/** Seed a form's state from the definitions and a contact's stored values. */
export function initialFieldValues(
  definitions: CustomFieldDefinition[],
  stored: CustomFieldValues | null | undefined,
): CustomFieldValues {
  const values: CustomFieldValues = {};
  for (const definition of definitions) {
    const current = stored?.[definition.key];
    if (current !== undefined) values[definition.key] = current;
    else if (definition.defaultValue != null) values[definition.key] = definition.defaultValue;
    else values[definition.key] = definition.type === 'MULTI_SELECT' ? [] : definition.type === 'CHECKBOX' ? false : '';
  }
  return values;
}
