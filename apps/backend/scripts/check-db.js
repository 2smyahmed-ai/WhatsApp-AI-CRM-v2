const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.count();
    const contacts = await prisma.contact.count();
    const convs = await prisma.conversation.count();
    const messages = await prisma.message.count();
    console.log('users_count=' + users);
    console.log('contacts_count=' + contacts);
    console.log('conversations_count=' + convs);
    console.log('messages_count=' + messages);
  } catch (e) {
    console.error('ERROR', e);
    process.exitCode = 1;
  } finally {
    await require('@prisma/client').PrismaClient.prototype.$disconnect.call();
  }
}

main();
