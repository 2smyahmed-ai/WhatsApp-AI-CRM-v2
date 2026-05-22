import {
  isCanonicalPayload,
  isLegacyPayload,
  toRenderable,
  legacyBlocksToCanonical,
  extractVariableNames,
  type CanonicalTemplate,
  type RenderableTemplate,
} from '../lib/template-compiler';

function resolveCanonical(template: any): CanonicalTemplate {
  if (isCanonicalPayload(template.payload)) {
    return template.payload as CanonicalTemplate;
  }
  if (isLegacyPayload(template.payload)) {
    return legacyBlocksToCanonical(
      template.payload.blocks,
      template.name,
      template.payload.category ?? template.category ?? undefined,
      template.language ?? undefined,
    );
  }
  return {
    name: template.name,
    category: (template.category as any) ?? 'MARKETING',
    language: template.language ?? 'en_US',
    body: { text: template.content ?? '' },
    _meta: { variableNames: Array.isArray(template.variables) ? template.variables : [] },
  };
}

export function renderTemplate(
  template: any,
  vars: Record<string, string> = {},
): { text: string; renderable: RenderableTemplate; variables: string[] } {
  const canonical = resolveCanonical(template);
  const renderable = toRenderable(canonical, vars);
  const variables  = extractVariableNames(canonical);

  return {
    text: renderable.body,
    renderable,
    variables,
  };
}

export default { renderTemplate };
