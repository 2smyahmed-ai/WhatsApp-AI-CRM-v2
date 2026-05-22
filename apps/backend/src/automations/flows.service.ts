import { prisma } from '../lib/prisma';

export class FlowsService {
  static async getFlows(teamId?: string) {
    return prisma.automationFlow.findMany({
      where: teamId ? { teamId } : undefined,
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getFlow(id: string) {
    return prisma.automationFlow.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  static async createFlow(data: {
    teamId?: string;
    name: string;
    trigger: string;
    keyword?: string;
    stopOnReply?: boolean;
    steps: { order: number; type: 'SEND_MESSAGE' | 'WAIT'; message?: string; delayMs?: number }[];
  }) {
    const { steps, ...flowData } = data;
    return prisma.automationFlow.create({
      data: {
        ...flowData,
        trigger: flowData.trigger as any,
        steps: { create: steps },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  static async updateFlow(
    id: string,
    data: {
      name?: string;
      trigger?: string;
      keyword?: string;
      stopOnReply?: boolean;
      isActive?: boolean;
      steps?: { order: number; type: 'SEND_MESSAGE' | 'WAIT'; message?: string; delayMs?: number }[];
    },
  ) {
    const { steps, ...flowData } = data;
    if (steps) {
      await prisma.automationFlowStep.deleteMany({ where: { flowId: id } });
    }
    return prisma.automationFlow.update({
      where: { id },
      data: {
        ...flowData,
        trigger: flowData.trigger as any,
        ...(steps ? { steps: { create: steps } } : {}),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  static async deleteFlow(id: string) {
    return prisma.automationFlow.delete({ where: { id } });
  }

  static async toggleFlow(id: string) {
    const flow = await prisma.automationFlow.findUnique({ where: { id } });
    if (!flow) throw new Error('Flow not found');
    return prisma.automationFlow.update({
      where: { id },
      data: { isActive: !flow.isActive },
    });
  }
}
