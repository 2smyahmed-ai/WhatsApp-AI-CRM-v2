import { prisma } from '../lib/prisma';
import crypto from 'crypto';

type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

function mapTaskRow(row: any) {
  if (!row) return row;
  const { contact__id, contact__name, contact__phone, assignee__id, assignee__name, assignee__email, ...task } = row;
  return {
    ...task,
    contact: contact__id ? { id: contact__id, name: contact__name, phone: contact__phone } : null,
    assignee: assignee__id ? { id: assignee__id, name: assignee__name, email: assignee__email } : null,
  };
}

async function ensureTasksTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Task" (
      id TEXT PRIMARY KEY,
      "teamId" TEXT NULL,
      "contactId" TEXT NULL,
      "conversationId" TEXT NULL,
      title TEXT NOT NULL,
      description TEXT NULL,
      "dueDate" TIMESTAMP(3) NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      "assigneeId" TEXT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Add new columns to existing deployments
  await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'MEDIUM'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "conversationId" TEXT NULL`);
}

const SELECT_TASK = `
  SELECT
    t.*,
    c.id   AS "contact__id",
    c.name AS "contact__name",
    c.phone AS "contact__phone",
    u.id   AS "assignee__id",
    u.name AS "assignee__name",
    u.email AS "assignee__email"
  FROM "Task" t
  LEFT JOIN "Contact" c ON c.id = t."contactId"
  LEFT JOIN "User" u ON u.id = t."assigneeId"
`;

export class TasksService {
  static async getTasks(opts: { teamId?: string; assigneeId?: string; isAdmin?: boolean }) {
    await ensureTasksTable();
    const { teamId, assigneeId, isAdmin } = opts;

    let query: string;
    let params: any[];

    if (isAdmin && teamId) {
      query = `${SELECT_TASK} WHERE t."teamId" = $1 ORDER BY t.status ASC, t."dueDate" ASC NULLS LAST, t."createdAt" DESC`;
      params = [teamId];
    } else if (isAdmin) {
      query = `${SELECT_TASK} ORDER BY t.status ASC, t."dueDate" ASC NULLS LAST, t."createdAt" DESC`;
      params = [];
    } else if (assigneeId) {
      query = `${SELECT_TASK} WHERE t."assigneeId" = $1 ORDER BY t.status ASC, t."dueDate" ASC NULLS LAST, t."createdAt" DESC`;
      params = [assigneeId];
    } else {
      return [];
    }

    const rows = await (params.length
      ? prisma.$queryRawUnsafe<any[]>(query, ...params)
      : prisma.$queryRawUnsafe<any[]>(query));

    return rows.map(mapTaskRow);
  }

  static async createTask(data: {
    title: string;
    description?: string;
    dueDate?: Date;
    contactId?: string;
    conversationId?: string;
    assigneeId?: string;
    teamId?: string;
    priority?: TaskPriority;
  }) {
    await ensureTasksTable();
    const id = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Task" (id, "teamId", "contactId", "conversationId", title, description, "dueDate", status, priority, "assigneeId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      id,
      data.teamId ?? null,
      data.contactId ?? null,
      data.conversationId ?? null,
      data.title,
      data.description ?? null,
      data.dueDate ?? null,
      data.priority ?? 'MEDIUM',
      data.assigneeId ?? null,
    );
    const [task] = await prisma.$queryRawUnsafe<any[]>(`${SELECT_TASK} WHERE t.id = $1`, id);
    return mapTaskRow(task);
  }

  static async updateTask(
    id: string,
    data: {
      title?: string;
      description?: string;
      dueDate?: Date | null;
      contactId?: string | null;
      conversationId?: string | null;
      assigneeId?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      teamId?: string;
    },
  ) {
    await ensureTasksTable();
    const existing = data.teamId
      ? await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Task" WHERE id = $1 AND "teamId" = $2`, id, data.teamId)
      : await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Task" WHERE id = $1`, id);
    if (!existing.length) throw new Error('Task not found');

    await prisma.$executeRawUnsafe(
      `UPDATE "Task"
       SET title          = COALESCE($2, title),
           description    = COALESCE($3, description),
           "dueDate"      = COALESCE($4, "dueDate"),
           "contactId"    = COALESCE($5, "contactId"),
           "assigneeId"   = COALESCE($6, "assigneeId"),
           status         = COALESCE($7, status),
           priority       = COALESCE($8, priority),
           "conversationId" = COALESCE($9, "conversationId"),
           "updatedAt"    = CURRENT_TIMESTAMP
       WHERE id = $1`,
      id,
      data.title ?? null,
      data.description ?? null,
      data.dueDate ?? null,
      data.contactId ?? null,
      data.assigneeId ?? null,
      data.status ?? null,
      data.priority ?? null,
      data.conversationId ?? null,
    );
    const [task] = await prisma.$queryRawUnsafe<any[]>(`${SELECT_TASK} WHERE t.id = $1`, id);
    return mapTaskRow(task);
  }

  static async deleteTask(id: string, teamId?: string) {
    await ensureTasksTable();
    const count = teamId
      ? await prisma.$executeRawUnsafe(`DELETE FROM "Task" WHERE id = $1 AND "teamId" = $2`, id, teamId)
      : await prisma.$executeRawUnsafe(`DELETE FROM "Task" WHERE id = $1`, id);
    if (!count) throw new Error('Task not found');
    return { success: true };
  }

  static async getTasksByConversation(conversationId: string) {
    await ensureTasksTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `${SELECT_TASK} WHERE t."conversationId" = $1 ORDER BY t."createdAt" DESC`,
      conversationId,
    );
    return rows.map(mapTaskRow);
  }
}
