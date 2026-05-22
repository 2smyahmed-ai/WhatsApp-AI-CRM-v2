import { prisma } from '../lib/prisma';
import { ConversationsService } from './conversations.service';

/**
 * Round-robin auto-assignment.
 * Picks the team member (AGENT or TEAM_LEAD) with the fewest open assigned conversations.
 * Falls back gracefully if no agents are available.
 */
export async function autoAssignConversation(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, teamId: true, assignedTo: true },
  });

  if (!conversation || conversation.assignedTo) return; // already assigned

  const teamId = conversation.teamId;
  if (!teamId) return;

  // Only auto-assign if the team has it enabled
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { autoAssign: true } });
  if (!team?.autoAssign) return;

  // Fetch eligible agents in the team
  const agents = await prisma.user.findMany({
    where: {
      teamId,
      role: { in: ['AGENT', 'TEAM_LEAD'] },
    },
    select: { id: true },
  });

  if (agents.length === 0) return;

  // Count open conversations per agent
  const counts = await prisma.conversation.groupBy({
    by: ['assignedTo'],
    where: {
      teamId,
      status: 'OPEN',
      assignedTo: { in: agents.map((a) => a.id) },
    },
    _count: { id: true },
  });

  const countMap = new Map<string, number>();
  for (const row of counts) {
    if (row.assignedTo) countMap.set(row.assignedTo, row._count.id);
  }

  // Pick agent with lowest load (0 if they have none)
  let bestAgent = agents[0].id;
  let bestCount = countMap.get(agents[0].id) ?? 0;

  for (const agent of agents.slice(1)) {
    const load = countMap.get(agent.id) ?? 0;
    if (load < bestCount) {
      bestAgent = agent.id;
      bestCount = load;
    }
  }

  await ConversationsService.assignConversation(conversationId, bestAgent);
}
