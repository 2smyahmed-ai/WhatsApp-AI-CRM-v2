/**
 * First-boot business-owner seeding.
 *
 * When a fresh tenant instance starts and OWNER_EMAIL / OWNER_PASSWORD are set,
 * this creates the business owner as a SUPER_ADMIN of *this* instance (which,
 * being its own database, only ever sees this business's data). Unlike the
 * developer super-account, it is **create-only**: it never resets an existing
 * account, so the owner can safely change their own password later.
 *
 * Pair with provisionDevSuperuser (which keeps YOUR developer login working on
 * every instance). See ONBOARDING.md.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function provisionOwner(): Promise<void> {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || 'Owner';

  if (!email || !password) return; // not a freshly-provisioned tenant

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return; // create-only: never clobber

    const hashed = await bcrypt.hash(password, 12);
    const owner = await prisma.user.create({
      data: { name, email, password: hashed, role: 'SUPER_ADMIN' },
    });
    const team = await prisma.team.create({ data: { name, ownerId: owner.id } });
    await prisma.user.update({ where: { id: owner.id }, data: { teamId: team.id } });

    logger.info('Business owner account created', { email });
  } catch (err) {
    logger.error('Failed to provision business owner', {
      email,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
