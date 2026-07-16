/**
 * Client-side mirror of the backend audience contract
 * (apps/backend/src/broadcasts/audience.ts).
 *
 * The server is the authority: it evaluates every condition and decides which
 * contacts match. Nothing here re-implements that predicate — duplicating the
 * eleven-type / eleven-operator semantics in two languages is how the two halves
 * drift apart. What lives here is only what the UI needs in order to *offer* a
 * condition the server will understand: which operators a field type admits, and
 * what kind of input collects its value.
 *
 * Both surfaces that build a filter (the contacts list and the broadcast
 * audience step) post it to the same place: `GET /api/contacts?filter=<json>`.
 */

import type { CustomFieldDefinition, CustomFieldOption, CustomFieldType } from './custom-fields';

export const AUDIENCE_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
  'greater_than',
  'less_than',
  'in',
  'before',
  'after',
] as const;

export type AudienceOperator = (typeof AUDIENCE_OPERATORS)[number];

export interface AudienceCondition {
  /** A built-in column name or a custom-field key. */
  field: string;
  operator: AudienceOperator;
  value?: unknown;
}

export interface AudienceFilter {
  tags?: string[];
  match?: 'all' | 'any';
  conditions?: AudienceCondition[];
}

/**
 * A field the user can filter on. Built-in columns and custom fields are the
 * same shape here, so the builder never branches on where a field came from —
 * only on its type.
 */
export interface FilterableField {
  key: string;
  label: string;
  type: CustomFieldType;
  options: CustomFieldOption[] | null;
  /** Custom fields are grouped separately so a long list stays navigable. */
  custom: boolean;
}

/** Built-in `Contact` columns the backend's BUILT_IN_ACCESSORS can read. */
const BUILT_IN_FIELDS: Array<Omit<FilterableField, 'custom'>> = [
  { key: 'name', label: 'Name', type: 'TEXT', options: null },
  { key: 'phone', label: 'Phone', type: 'PHONE', options: null },
  { key: 'email', label: 'Email', type: 'EMAIL', options: null },
  { key: 'company', label: 'Company', type: 'TEXT', options: null },
  { key: 'notes', label: 'Notes', type: 'NOTES', options: null },
  {
    key: 'status',
    label: 'Status',
    type: 'SELECT',
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'INACTIVE', label: 'Inactive' },
    ],
  },
  {
    key: 'lifecycleStage',
    label: 'Lifecycle stage',
    type: 'SELECT',
    options: [
      { value: 'LEAD', label: 'Lead' },
      { value: 'CUSTOMER', label: 'Customer' },
    ],
  },
  { key: 'source', label: 'Source', type: 'TEXT', options: null },
  { key: 'createdAt', label: 'Created date', type: 'DATE', options: null },
];

/**
 * Every field a contact can be filtered by: the built-in columns first, then
 * whatever the business has defined in Settings → Custom Fields. A "Tower"
 * field shows up here the moment it is created — no code change per field.
 */
export function filterableFields(definitions: CustomFieldDefinition[]): FilterableField[] {
  const custom = definitions
    .filter((definition) => definition.isActive)
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      type: definition.type,
      options: definition.options,
      custom: true,
    }));

  return [...BUILT_IN_FIELDS.map((field) => ({ ...field, custom: false })), ...custom];
}

/**
 * Operators that make sense for a type. A number has no "contains", a checkbox
 * has nothing but "is", and offering them anyway produces conditions that match
 * nothing and read like a bug.
 */
const OPERATORS_BY_TYPE: Record<CustomFieldType, AudienceOperator[]> = {
  // "is any of" matters most on plain text: a business stores its towers, cities
  // and unit types as TEXT, and "tower is any of A, B" is the audience it asks
  // for. The backend's `in` accepts an array or a comma-separated string.
  TEXT: ['contains', 'not_contains', 'equals', 'not_equals', 'in', 'is_empty', 'is_not_empty'],
  NOTES: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  EMAIL: ['contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty'],
  PHONE: ['contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty'],
  URL: ['contains', 'equals', 'is_empty', 'is_not_empty'],
  NUMBER: ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'],
  CURRENCY: ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'],
  // No "is" for dates: `createdAt` is a real Date whose text form is a full ISO
  // timestamp, so it could never equal the "2026-01-01" a date input produces.
  // `before`/`after` compare by epoch and work for both column and custom dates.
  DATE: ['after', 'before', 'is_empty', 'is_not_empty'],
  SELECT: ['equals', 'not_equals', 'in', 'is_empty', 'is_not_empty'],
  MULTI_SELECT: ['equals', 'not_equals', 'in', 'is_empty', 'is_not_empty'],
  CHECKBOX: ['equals'],
};

export function operatorsFor(field: FilterableField | undefined): AudienceOperator[] {
  if (!field) return ['contains'];
  return OPERATORS_BY_TYPE[field.type] ?? OPERATORS_BY_TYPE.TEXT;
}

/** Which input widget collects the value for a (field, operator) pair. */
export type ValueInputKind = 'none' | 'text' | 'number' | 'date' | 'boolean' | 'option' | 'options';

export function valueInputFor(
  field: FilterableField | undefined,
  operator: AudienceOperator,
): ValueInputKind {
  if (operator === 'is_empty' || operator === 'is_not_empty') return 'none';
  if (!field) return 'text';

  // `in` always collects a set, whatever the field type.
  if (operator === 'in') return field.options?.length ? 'options' : 'text';

  switch (field.type) {
    case 'CHECKBOX':
      return 'boolean';
    case 'DATE':
      return 'date';
    case 'NUMBER':
    case 'CURRENCY':
      return 'number';
    case 'SELECT':
    case 'MULTI_SELECT':
      return field.options?.length ? 'option' : 'text';
    default:
      return 'text';
  }
}

export const EMPTY_FILTER: AudienceFilter = { match: 'all', conditions: [] };

/** A condition the user has not finished filling in must not narrow anything. */
export function isConditionComplete(
  condition: AudienceCondition,
  field: FilterableField | undefined,
): boolean {
  if (!condition.field) return false;

  const kind = valueInputFor(field, condition.operator);
  if (kind === 'none' || kind === 'boolean') return true;
  if (kind === 'options') return Array.isArray(condition.value) && condition.value.length > 0;

  return condition.value !== undefined && condition.value !== null && String(condition.value).trim() !== '';
}

/**
 * Strip half-built conditions before the filter travels to the server. The
 * builder holds an empty row the moment the user clicks "add condition"; sending
 * it would ask the backend to match on a field named "".
 */
export function sanitizeFilter(
  filter: AudienceFilter,
  fields: FilterableField[],
): AudienceFilter | null {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const conditions = (filter.conditions ?? []).filter((condition) =>
    isConditionComplete(condition, byKey.get(condition.field)),
  );
  const tags = (filter.tags ?? []).filter(Boolean);

  if (!conditions.length && !tags.length) return null;
  return { match: filter.match ?? 'all', ...(tags.length ? { tags } : {}), conditions };
}

/** How many conditions are actually narrowing the list — drives the "3" badge. */
export function activeConditionCount(filter: AudienceFilter, fields: FilterableField[]): number {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return (filter.conditions ?? []).filter((condition) =>
    isConditionComplete(condition, byKey.get(condition.field)),
  ).length;
}

/** `?filter=` carries the filter as JSON; an empty filter omits the param entirely. */
export function filterQueryParam(
  filter: AudienceFilter,
  fields: FilterableField[],
): string | null {
  const sanitized = sanitizeFilter(filter, fields);
  return sanitized ? JSON.stringify(sanitized) : null;
}
