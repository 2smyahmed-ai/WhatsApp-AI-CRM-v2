import { prisma } from '../lib/prisma';
import { emitRealtime } from '../realtime/socket';

type DealStage = 'NEW' | 'INTERESTED' | 'NEGOTIATION' | 'CLOSED';

const include = {
  contact: { select: { id: true, name: true, phone: true } },
  owner: { select: { id: true, name: true, email: true } },
};

export class DealsService {
  static async getDeals(teamId?: string) {
    return prisma.deal.findMany({
      where: teamId ? { teamId } : undefined,
      include,
      orderBy: { updatedAt: 'desc' },
    });
  }

  static async createDeal(data: {
    contactId: string;
    title: string;
    stage?: DealStage;
    value?: number;
    notes?: string;
    ownerId?: string;
    teamId?: string;
  }) {
    const deal = await prisma.deal.create({
      data: {
        contactId: data.contactId,
        title: data.title,
        stage: (data.stage ?? 'NEW') as any,
        value: data.value ?? 0,
        notes: data.notes,
        ownerId: data.ownerId ?? null,
        teamId: data.teamId ?? null,
        closedAt: data.stage === 'CLOSED' ? new Date() : null,
      },
      include,
    });
    emitRealtime('deal:created', { deal }, data.teamId);
    return deal;
  }

  static async updateDeal(
    id: string,
    data: {
      contactId?: string;
      title?: string;
      stage?: DealStage;
      value?: number;
      notes?: string;
      ownerId?: string;
      teamId?: string;
    },
  ) {
    const existing = await prisma.deal.findFirst({
      where: data.teamId ? { id, teamId: data.teamId } : { id },
    });
    if (!existing) throw new Error('Deal not found');

    const stageChanged = data.stage && data.stage !== existing.stage;

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.stage !== undefined ? { stage: data.stage as any } : {}),
        ...(data.value !== undefined ? { value: data.value } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId || null } : {}),
        ...(data.stage === 'CLOSED' && existing.stage !== 'CLOSED' ? { closedAt: new Date() } : {}),
      },
      include,
    });

    emitRealtime('deal:updated', { deal }, existing.teamId);

    if (stageChanged) {
      // Fire automation flows triggered by deal stage changes
      void import('../automations/flow-executor').then(({ triggerFlows }) => {
        const phone = (deal.contact as any)?.phone;
        if (phone) {
          void triggerFlows(phone, `DEAL_STAGE:${data.stage}`, 'ANY_MESSAGE', existing.teamId ?? undefined);
        }
      });
    }

    return deal;
  }

  static async deleteDeal(id: string, teamId?: string) {
    const existing = await prisma.deal.findFirst({
      where: teamId ? { id, teamId } : { id },
    });
    if (!existing) throw new Error('Deal not found');
    await prisma.deal.delete({ where: { id } });
    emitRealtime('deal:deleted', { dealId: id }, teamId);
    return { success: true };
  }
}
