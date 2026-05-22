import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { normalizePhone, phoneFingerprint } from '../lib/phone';
import { getWhatsAppProfilePictureUrl } from '../whatsapp/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

async function resolveDefaultTeamId(db: DbClient) {
  const explicitTeamId = process.env.WHATSAPP_TEAM_ID?.trim();
  if (explicitTeamId) return explicitTeamId;

  const firstUser = await db.user.findFirst({
    where: { teamId: { not: null } },
    select: { teamId: true },
    orderBy: { createdAt: 'asc' },
  });

  return firstUser?.teamId ?? null;
}

function buildPhoneVariants(phone: string) {
  const normalized = normalizePhone(phone) || '';
  const digits = phoneFingerprint(phone);
  const variants = new Set<string>([normalized, digits, normalized.replace(/^\+/, '')].filter(Boolean));

  if (digits.length > 7) {
    variants.add(digits.slice(-8));
    variants.add(digits.slice(-9));
  }

  return [...variants];
}

async function findMatchingContact(db: DbClient, phone: string, teamId?: string | null) {
  const variants = buildPhoneVariants(phone);
  const contacts = await db.contact.findMany({
    where: {
      ...(teamId ? { teamId } : {}),
      OR: variants.flatMap((variant) => [
        { phone: variant },
        { phone: { endsWith: variant } },
      ]),
    },
  });

  return contacts[0] || null;
}

export async function getOrCreateConversationByPhone(
  phone: string,
  teamId?: string | null,
  db: DbClient = prisma,
) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error('Invalid phone number');
  }

  const resolvedTeamId = teamId ?? await resolveDefaultTeamId(db);

  const contact =
    (await findMatchingContact(db, phone, resolvedTeamId)) ??
    (await db.contact.upsert({
      where: { phone: normalizedPhone },
      create: {
        phone: normalizedPhone,
        teamId: resolvedTeamId ?? undefined,
      },
      update: {
        teamId: resolvedTeamId ?? undefined,
      },
    }));

  const customFields = (contact.customFields as Record<string, unknown> | null | undefined) || {};
  if (!customFields.avatarUrl) {
    void getWhatsAppProfilePictureUrl(contact.phone).then(async (avatarUrl) => {
      if (!avatarUrl) return;
      await db.contact.update({
        where: { id: contact.id },
        data: {
          customFields: {
            ...customFields,
            avatarUrl,
          },
        },
      });
    });
  }

  const conversations = await db.conversation.findMany({
    where: {
      contactId: contact.id,
      ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (conversations.length > 0) {
    const [primary, ...duplicates] = conversations;
    if (duplicates.length > 0) {
      const duplicateIds = duplicates.map((conversation) => conversation.id);
      await db.message.deleteMany({ where: { conversationId: { in: duplicateIds } } });
      await db.conversation.deleteMany({ where: { id: { in: duplicateIds } } });
    }
    return { contact, conversation: primary, isNew: false };
  }

  const conversation = await db.conversation.create({
    data: {
      contactId: contact.id,
      teamId: resolvedTeamId ?? undefined,
      lastMessagePreview: null,
    },
  });

  return { contact, conversation, isNew: true };
}
