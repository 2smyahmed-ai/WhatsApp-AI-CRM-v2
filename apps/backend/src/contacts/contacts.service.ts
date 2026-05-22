import { prisma } from '../lib/prisma';
import { normalizePhone, phoneFingerprint } from '../lib/phone';

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

export class ContactsService {
  static async getContacts(filters?: { search?: string; tag?: string }) {
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
      ];
    }

    if (filters?.tag) {
      where.OR = [
        ...(where.OR || []),
        { tag: filters.tag },
        { tag: { contains: filters.tag } },
      ];
    }

    return await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { contactTags: { include: { tag: true } } },
    });
  }

  static async createContact(data: { phone: string; name?: string; tag?: string; notes?: string; teamId?: string }) {
    const phone = normalizePhone(data.phone);
    if (!phone) {
      throw new Error('Invalid phone number');
    }

    const existing = await prisma.contact.findFirst({
      where: {
        phone,
      },
    });

    if (existing) {
      return await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: data.name ?? existing.name,
          tag: data.tag ?? existing.tag,
          notes: data.notes ?? existing.notes,
          teamId: data.teamId ?? existing.teamId,
          phone,
        },
      });
    }

    return await prisma.contact.upsert({
      where: { phone },
      create: {
        phone,
        name: data.name,
        tag: data.tag,
        notes: data.notes,
        teamId: data.teamId,
      },
      update: {
        name: data.name,
        tag: data.tag,
        notes: data.notes,
        teamId: data.teamId,
      },
    });
  }

  static async updateContact(id: string, data: { name?: string; tag?: string; notes?: string }) {
    const contact = await prisma.contact.findFirst({ where: { id } });
    if (!contact) throw new Error('Contact not found');
    return await prisma.contact.update({
      where: { id: contact.id },
      data,
    });
  }

  static async deleteContact(id: string) {
    const contact = await prisma.contact.findFirst({ where: { id } });
    if (!contact) throw new Error('Contact not found');

    return await prisma.$transaction(async (tx) => {
      const conversations = await tx.conversation.findMany({
        where: { contactId: contact.id },
        select: { id: true },
      });

      if (conversations.length > 0) {
        await tx.message.deleteMany({
          where: { conversationId: { in: conversations.map((conversation) => conversation.id) } },
        });

        await tx.conversation.deleteMany({
          where: { id: { in: conversations.map((conversation) => conversation.id) } },
        });
      }

      return await tx.contact.delete({
        where: { id: contact.id },
      });
    });
  }

  static async importContacts(contacts: Array<{ phone: string; name?: string; tag?: string }>, teamId?: string) {
    const results = [];
    for (const contact of contacts) {
      try {
        const result = await this.createContact({ ...contact, teamId });
        results.push(result);
      } catch {
        // skip invalid/duplicate rows
      }
    }
    return results;
  }
}
