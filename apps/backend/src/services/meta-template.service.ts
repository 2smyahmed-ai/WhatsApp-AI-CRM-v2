import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  isCanonicalPayload,
  isLegacyPayload,
  toMetaComponents,
  toMetaSendPayload,
  legacyBlocksToCanonical,
  extractVariableNames,
  type CanonicalTemplate,
} from '../lib/template-compiler';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function cfg() {
  return {
    accessToken:     process.env.META_ACCESS_TOKEN ?? '',
    phoneNumberId:   process.env.META_PHONE_NUMBER_ID ?? '',
    wabaId:          process.env.META_BUSINESS_ACCOUNT_ID ?? '',
  };
}

async function metaFetch(path: string, init: RequestInit = {}): Promise<any> {
  const { accessToken } = cfg();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error?.message ?? `Meta API error ${res.status}`);
  return data;
}

function mapMetaStatus(metaStatus: string): 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' {
  switch (metaStatus?.toUpperCase()) {
    case 'APPROVED': return 'PUBLISHED';
    case 'REJECTED':
    case 'DELETED':
    case 'DISABLED':
    case 'PAUSED':   return 'ARCHIVED';
    default:         return 'DRAFT'; // PENDING or unknown
  }
}

// ── Resolve canonical from stored template ────────────────────────────────────

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
  // Bare content-only template — wrap as minimal canonical
  return {
    name: template.name,
    category: (template.category as any) ?? 'MARKETING',
    language: template.language ?? 'en_US',
    body: { text: template.content ?? '' },
    _meta: { variableNames: Array.isArray(template.variables) ? template.variables : [] },
  };
}

export const metaTemplateService = {
  /**
   * Submit a local template to Meta for approval.
   * Accepts canonical payload OR legacy block format — converts automatically.
   */
  async submit(templateId: string): Promise<any> {
    const { wabaId } = cfg();
    const template = await (prisma as any).messageTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Template not found');

    const canonical = resolveCanonical(template);
    const components = toMetaComponents(canonical);

    if (components.length === 0) {
      throw new Error('Template produced no components. Add body text before submitting.');
    }

    const body = {
      name: canonical.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      language: canonical.language ?? 'en_US',
      category: canonical.category ?? 'MARKETING',
      components,
    };

    logger.info('meta_template.submit_payload', { templateId, name: body.name, components: components.length });

    const result = await metaFetch(`/${wabaId}/message_templates`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    await (prisma as any).messageTemplate.update({
      where: { id: templateId },
      data: {
        metaTemplateId: String(result.id),
        metaStatus: result.status ?? 'PENDING',
        status: mapMetaStatus(result.status ?? 'PENDING'),
      },
    });

    logger.info('meta_template.submitted', { templateId, metaId: result.id, status: result.status });
    return result;
  },

  /**
   * Pull all templates from Meta WABA and upsert into the local DB.
   */
  async syncFromMeta(): Promise<{ synced: number }> {
    const { wabaId } = cfg();
    const fields = 'id,name,status,language,category,components,quality_score';
    let url = `/${wabaId}/message_templates?fields=${fields}&limit=100`;
    let synced = 0;

    while (url) {
      const data = await metaFetch(url);
      const templates: any[] = data.data ?? [];

      for (const t of templates) {
        const internalStatus = mapMetaStatus(t.status);

        // Build a canonical template from Meta's components so the payload is always canonical
        const canonical: CanonicalTemplate = {
          name: t.name,
          category: t.category ?? 'MARKETING',
          language: t.language ?? 'en_US',
          body: { text: '' },
        };

        // Extract body text and other sections from Meta components
        if (Array.isArray(t.components)) {
          for (const comp of t.components) {
            if (comp.type === 'BODY')   canonical.body = { text: comp.text ?? '' };
            if (comp.type === 'FOOTER') canonical.footer = { text: comp.text ?? '' };
            if (comp.type === 'HEADER') {
              if (comp.format === 'TEXT') {
                canonical.header = { type: 'TEXT', text: comp.text ?? '' };
              } else if (comp.format) {
                canonical.header = { type: comp.format, url: comp.example?.header_url?.[0] };
              }
            }
            if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
              canonical.buttons = comp.buttons.map((b: any) => {
                if (b.type === 'QUICK_REPLY')   return { type: 'QUICK_REPLY' as const,   text: b.text };
                if (b.type === 'URL')           return { type: 'URL' as const,           text: b.text, url: b.url ?? '' };
                return { type: 'PHONE_NUMBER' as const, text: b.text, phone_number: b.phone_number ?? '' };
              });
            }
          }
        }

        canonical._meta = { variableNames: extractVariableNames(canonical) };

        const existingRow = await (prisma as any).messageTemplate.findFirst({
          where: { metaTemplateId: String(t.id) },
          select: { id: true },
        });

        await (prisma as any).messageTemplate.upsert({
          where: { id: existingRow?.id ?? 'new' },
          create: {
            name: t.name,
            content: canonical.body.text,
            language: t.language ?? 'en_US',
            category: t.category ?? null,
            metaTemplateId: String(t.id),
            metaStatus: t.status,
            status: internalStatus,
            payload: canonical,
            variables: canonical._meta.variableNames,
          },
          update: {
            metaStatus: t.status,
            status: internalStatus,
            category: t.category ?? null,
            payload: canonical,
            variables: canonical._meta.variableNames,
            content: canonical.body.text,
          },
        });
        synced++;
      }

      const nextUrl: string | undefined = data.paging?.next;
      url = nextUrl ? nextUrl.replace(GRAPH_BASE, '') : '';
    }

    logger.info('meta_template.synced', { count: synced });
    return { synced };
  },

  /**
   * Send an approved template message to a phone number.
   * `variables` maps variable names to values: { name: "Ahmed", order_id: "1234" }
   */
  async send(
    phone: string,
    templateId: string,
    variables: Record<string, string> = {},
  ): Promise<{ messageId: string }> {
    const { phoneNumberId } = cfg();
    const template = await (prisma as any).messageTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Template not found');

    if (template.metaStatus !== 'APPROVED' && template.status !== 'PUBLISHED') {
      throw new Error(
        `Template "${template.name}" is not approved (Meta status: ${template.metaStatus ?? template.status}). Submit for approval first.`,
      );
    }

    const canonical = resolveCanonical(template);

    // Use the stored Meta template name (lowercased+underscored) for sending
    const metaName = template.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const payload = toMetaSendPayload(canonical, phone, variables, metaName);

    logger.info('meta_template.send_payload', { templateId, phone, metaName });

    const result = await metaFetch(`/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const messageId: string = result?.messages?.[0]?.id;
    if (!messageId) throw new Error('Meta API did not return a message ID');

    logger.info('meta_template.sent', { templateId, phone, messageId });
    return { messageId };
  },

  /**
   * Delete a template from Meta and mark local record as ARCHIVED.
   */
  async deleteFromMeta(templateId: string): Promise<void> {
    const { wabaId } = cfg();
    const template = await (prisma as any).messageTemplate.findUnique({ where: { id: templateId } });
    if (!template?.metaTemplateId) return;

    const metaName = template.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await metaFetch(`/${wabaId}/message_templates?hsm_id=${template.metaTemplateId}&name=${metaName}`, {
      method: 'DELETE',
    });

    await (prisma as any).messageTemplate.update({
      where: { id: templateId },
      data: { metaStatus: 'DELETED', status: 'ARCHIVED' },
    });

    logger.info('meta_template.deleted', { templateId, metaTemplateId: template.metaTemplateId });
  },
};

export default metaTemplateService;
