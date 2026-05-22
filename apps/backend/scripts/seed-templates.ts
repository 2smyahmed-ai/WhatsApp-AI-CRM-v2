import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const file = path.join(__dirname, '..', 'prisma', 'seed', 'templates.json');
  if (!fs.existsSync(file)) {
    console.error('Seed file not found:', file);
    process.exit(1);
  }

  const raw = fs.readFileSync(file, 'utf-8');
  const templates = JSON.parse(raw) as Array<{ name: string; content: string; mediaUrl?: string | null }>;

  let created = 0;
  for (const t of templates) {
    const exists = await prisma.messageTemplate.findFirst({
      where: {
        name: t.name,
        content: t.content,
        teamId: null,
      },
    });
    if (!exists) {
      await prisma.messageTemplate.create({
        data: {
          name: t.name,
          content: t.content,
          mediaUrl: t.mediaUrl ?? null,
          teamId: null,
        },
      });
      created++;
      console.log('Created:', t.name);
    } else {
      console.log('Skipped (exists):', t.name);
    }
  }

  console.log(`Seed complete. ${created} templates created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
