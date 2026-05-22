/**
 * Run once to create the first SUPER_ADMIN account.
 * Usage: npx ts-node src/scripts/seed-admin.ts
 *
 * Override defaults with env vars:
 *   ADMIN_NAME="Ahmed" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="secret" npx ts-node src/scripts/seed-admin.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const name     = process.env.ADMIN_NAME     || 'Admin';
  const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User "${email}" already exists (role: ${existing.role}). Skipping.`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: 'SUPER_ADMIN' },
  });

  const team = await prisma.team.create({
    data: { name: `${name}'s Team`, ownerId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { teamId: team.id },
  });

  console.log('');
  console.log('✓ Super admin created successfully');
  console.log(`  Email   : ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Team    : ${team.name}`);
  console.log('');
  console.log('Change the password immediately after first login.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
