import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.$queryRaw`SELECT id, email, createdAt, updatedAt FROM User LIMIT 5;`;
  console.log('Raw users:', users);
}

check().catch(console.error).finally(() => prisma.$disconnect());
