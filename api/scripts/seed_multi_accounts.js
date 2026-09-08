import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { hashEmail, encryptEmail } from '../utils/crypto.js';

const prisma = new PrismaClient();

async function seedMultiAccounts() {
  console.log('🌱 Seeding multi-account test users...');

  const accounts = [
    {
      id: 'alok-nath-1',
      name: 'Alok Nath',
      rawEmail: 'alok@spotiflix.com',
      password: 'Alok@123',
      avatar: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
    },
    {
      id: 'maya-rock-2',
      name: 'Maya Rock',
      rawEmail: 'maya@spotiflix.com',
      password: 'Maya@123',
      avatar: 'https://occ-0-3933-116.1.nflxso.net/dnm/api/v6/vN7bi_My87NPKvsBoib006Llxzg/AAAABTZ28GDvlqO7UU067sJ747-d3Fxb-5kIekZf4p88f98iP3C0F.png',
    },
    {
      id: 'deep-pop-3',
      name: 'Deep Patel',
      rawEmail: 'deep@spotiflix.com',
      password: 'Deep@123',
      avatar: 'https://occ-0-3933-116.1.nflxso.net/dnm/api/v6/vN7bi_My87NPKvsBoib006Llxzg/AAAABe5bZ-Wj8kYm6rMh6H7RzX8w.png',
    },
  ];

  const salt = await bcrypt.genSalt(10);

  for (const acc of accounts) {
    const passwordHash = await bcrypt.hash(acc.password, salt);
    const emailHash = hashEmail(acc.rawEmail);
    const email = encryptEmail(acc.rawEmail);

    await prisma.user.upsert({
      where: { id: acc.id },
      update: {
        name: acc.name,
        email,
        emailHash,
        passwordHash,
        avatar: acc.avatar,
      },
      create: {
        id: acc.id,
        name: acc.name,
        email,
        emailHash,
        passwordHash,
        avatar: acc.avatar,
      },
    });

    console.log(`✅ User "${acc.name}" (${acc.rawEmail} / ${acc.password}) ready.`);
  }
}

seedMultiAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
