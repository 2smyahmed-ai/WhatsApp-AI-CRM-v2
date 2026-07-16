import { RESERVED_CUSTOM_FIELD_KEYS } from '../contacts/custom-fields.constants';

/**
 * Message personalization tokens.
 *
 * Built-in tokens ({{name}}, {{phone}}, {{email}}, {{company}}, {{first_name}})
 * plus every custom field, exposed twice: under its bare key ({{city}}) and
 * under a `cf_` prefix ({{cf_city}}). The prefix is the escape hatch for a
 * custom field whose key collides with a built-in — built-ins always win the
 * bare name so an imported "phone" column can never shadow the real number.
 *
 * An unknown token renders as an empty string rather than leaking "{{foo}}"
 * into a customer's WhatsApp.
 */

type ContactLike = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  customFields?: unknown;
};

/**
 * Render a stored custom-field value as message text. Values arrive already
 * coerced by `coerceCustomFieldValue`, so the shape is predictable: primitives,
 * ISO date strings, or a string[] for MULTI_SELECT.
 */
function formatValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  return String(value);
}

export function buildPersonalizationVars(
  contact: ContactLike | undefined,
  fallbackPhone: string,
): Record<string, string> {
  const vars: Record<string, string> = {};

  const custom = (contact?.customFields ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(custom)) {
    if (RESERVED_CUSTOM_FIELD_KEYS.has(key)) continue;
    const rendered = formatValue(value);
    vars[key] = rendered;
    vars[`cf_${key}`] = rendered;
  }

  // Built-ins are assigned last so they win any collision with a custom key.
  const name = contact?.name?.trim() ?? '';
  vars.name = name;
  vars.first_name = name ? name.split(/\s+/)[0] : '';
  vars.phone = contact?.phone ?? fallbackPhone;
  vars.email = contact?.email ?? '';
  vars.company = contact?.company ?? '';

  return vars;
}

/** Replace every {{token}} with its value; unknown tokens collapse to nothing. */
export function personalize(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}
