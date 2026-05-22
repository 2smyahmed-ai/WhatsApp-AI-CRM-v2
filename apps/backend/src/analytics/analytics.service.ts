import { prisma } from '../lib/prisma';

export class AnalyticsService {
  static async getOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalContacts,
      openConversations,
      todayMessages,
      automationsFired,
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.conversation.count({ where: { status: 'OPEN' } }),
      prisma.message.count({
        where: {
          timestamp: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      prisma.analytics.findFirst({
        where: { date: today },
        select: { automationsFired: true },
      }),
    ]);

    return {
      totalContacts,
      openConversations,
      todayMessages,
      automationsFired: automationsFired?.automationsFired || 0,
    };
  }

  static async getMessagesChart() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const messages = await prisma.message.findMany({
      where: {
        timestamp: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        timestamp: true,
        fromMe: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    const dailyStats: { [key: string]: { incoming: number; outgoing: number } } = {};

    messages.forEach((msg) => {
      const date = msg.timestamp.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { incoming: 0, outgoing: 0 };
      }
      if (msg.fromMe) {
        dailyStats[date].outgoing++;
      } else {
        dailyStats[date].incoming++;
      }
    });

    return Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      incoming: stats.incoming,
      outgoing: stats.outgoing,
    }));
  }

  static async getAgentStats(teamId?: string) {
    const agents = await prisma.user.findMany({
      where: {
        role: { in: ['AGENT', 'TEAM_LEAD'] as any[] },
        ...(teamId ? { teamId } : {}),
      },
      select: { id: true, name: true, email: true },
    });

    const stats = await Promise.all(
      agents.map(async (agent) => {
        const [open, resolved] = await Promise.all([
          prisma.conversation.count({ where: { assignedTo: agent.id, status: 'OPEN' } }),
          prisma.conversation.count({ where: { assignedTo: agent.id, status: 'RESOLVED' } }),
        ]);

        // Avg first response time: time from conversation creation to first outbound message by this agent
        const convs = await prisma.conversation.findMany({
          where: { assignedTo: agent.id, status: { in: ['RESOLVED', 'OPEN'] as any[] } },
          select: {
            id: true,
            createdAt: true,
            messages: {
              where: { fromMe: true },
              orderBy: { timestamp: 'asc' },
              take: 1,
              select: { timestamp: true },
            },
          },
          take: 100,
        });

        const responseTimes = convs
          .filter((c) => c.messages.length > 0)
          .map((c) => c.messages[0].timestamp.getTime() - c.createdAt.getTime())
          .filter((ms) => ms > 0 && ms < 86400000);

        const avgResponseMs = responseTimes.length
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null;

        return {
          agentId: agent.id,
          name: agent.name,
          email: agent.email,
          openConversations: open,
          resolvedConversations: resolved,
          avgFirstResponseMs: avgResponseMs,
          avgFirstResponseMin: avgResponseMs ? Math.round(avgResponseMs / 60000) : null,
        };
      }),
    );

    return stats;
  }

  static async getPipelineStats(teamId?: string) {
    const stages = ['NEW', 'INTERESTED', 'NEGOTIATION', 'CLOSED'] as const;

    const dealsByStage = await prisma.deal.groupBy({
      by: ['stage'],
      where: teamId ? { contact: { conversations: { some: { teamId } } } } : {},
      _count: { id: true },
      _sum: { value: true },
    });

    const stageMap = new Map(dealsByStage.map((r) => [r.stage, { count: r._count.id, value: r._sum.value ?? 0 }]));
    const totalDeals = dealsByStage.reduce((s, r) => s + r._count.id, 0);
    const totalValue = dealsByStage.reduce((s, r) => s + (r._sum.value ?? 0), 0);
    const closedDeals = stageMap.get('CLOSED')?.count ?? 0;
    const conversionRate = totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0;

    return {
      stages: stages.map((stage) => ({
        stage,
        count: stageMap.get(stage)?.count ?? 0,
        value: stageMap.get(stage)?.value ?? 0,
      })),
      totalDeals,
      totalValue,
      closedDeals,
      conversionRate,
    };
  }

  // Update daily analytics
  static async updateDailyStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalMessages,
      incomingMessages,
      outgoingMessages,
      newContacts,
      resolvedConvs,
    ] = await Promise.all([
      prisma.message.count({
        where: {
          timestamp: {
            gte: today,
          },
        },
      }),
      prisma.message.count({
        where: {
          timestamp: {
            gte: today,
          },
          fromMe: false,
        },
      }),
      prisma.message.count({
        where: {
          timestamp: {
            gte: today,
          },
          fromMe: true,
        },
      }),
      prisma.contact.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      }),
      prisma.conversation.count({
        where: {
          status: 'RESOLVED',
          createdAt: {
            gte: today,
          },
        },
      }),
    ]);

    const existing = await prisma.analytics.findFirst({
      where: { date: today },
    });

    if (existing) {
      await prisma.analytics.update({
        where: { id: existing.id },
        data: {
          totalMessages,
          incomingMessages,
          outgoingMessages,
          newContacts,
          resolvedConvs,
        },
      });
    } else {
      await prisma.analytics.create({
        data: {
          date: today,
          totalMessages,
          incomingMessages,
          outgoingMessages,
          newContacts,
          resolvedConvs,
        },
      });
    }
  }
}