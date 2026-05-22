import { prisma } from '../lib/prisma';

export class AutomationsService {
  static async getRules(teamId?: string) {
    return await prisma.automationRule.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createRule(data: {
    teamId?: string;
    name: string;
    trigger: 'KEYWORD' | 'FIRST_MESSAGE';
    keyword?: string;
    response: string;
  }) {
    return await prisma.automationRule.create({
      data,
    });
  }

  static async updateRule(id: string, data: Partial<{
    teamId: string;
    name: string;
    trigger: 'KEYWORD' | 'FIRST_MESSAGE';
    keyword?: string;
    response: string;
    isActive: boolean;
  }>) {
    return await prisma.automationRule.update({
      where: { id },
      data,
    });
  }

  static async deleteRule(id: string) {
    return await prisma.automationRule.delete({
      where: { id },
    });
  }

  static async toggleRule(id: string) {
    const rule = await prisma.automationRule.findUnique({ where: { id } });
    if (!rule) throw new Error('Rule not found');
    return await prisma.automationRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
  }
}
