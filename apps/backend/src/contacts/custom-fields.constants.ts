/**
 * Keys the CRM itself writes into `Contact.customFields`. They predate the
 * custom-field system (the WhatsApp avatar cache lives there) and must never be
 * claimable by a user-defined field, or a profile-picture refresh would silently
 * overwrite business data.
 */
export const RESERVED_CUSTOM_FIELD_KEYS = new Set(['avatarUrl', 'avatarUrlAt']);

/**
 * Built-in Contact columns. A custom field may not take one of these names —
 * otherwise `{{phone}}` in a broadcast, or a `phone` column in an import
 * mapping, would be ambiguous.
 */
export const BUILT_IN_CONTACT_FIELDS = [
  'phone',
  'name',
  'email',
  'company',
  'notes',
  'status',
  'lifecycleStage',
  'source',
  'tags',
] as const;

export type BuiltInContactField = (typeof BUILT_IN_CONTACT_FIELDS)[number];

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

/** Types whose value is chosen from `options`. */
export const CHOICE_FIELD_TYPES: ReadonlySet<CustomFieldType> = new Set(['SELECT', 'MULTI_SELECT']);

export interface CustomFieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface CustomFieldDefinitionDto {
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

/**
 * Turn a human label into a stable machine key: "Annual Revenue" → "annual_revenue".
 * The key is what lands in `Contact.customFields` and in `{{tokens}}`, so it is
 * restricted to what a `\w+` template token can express.
 */
export function slugifyFieldKey(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents so Cafe -> cafe
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 48);
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,47}$/;

export function validateFieldKey(key: string): string | null {
  if (!KEY_PATTERN.test(key)) {
    return 'Key must start with a letter and contain only lowercase letters, numbers and underscores.';
  }
  if (RESERVED_CUSTOM_FIELD_KEYS.has(key)) {
    return `"${key}" is reserved by the system.`;
  }
  if ((BUILT_IN_CONTACT_FIELDS as readonly string[]).includes(key)) {
    return `"${key}" is a built-in contact field.`;
  }
  if (key.startsWith('cf_')) {
    return 'Keys cannot start with "cf_" — that prefix is reserved for template tokens.';
  }
  return null;
}
