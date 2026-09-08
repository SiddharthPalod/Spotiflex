import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { hashEmail, encryptEmail } from '../utils/crypto.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Fast migrating users with transactions...');
  const users = await prisma.$queryRaw`SELECT id, email, name FROM User;`;
  console.log(`Found ${users.length} users.`);

  const BATCH_SIZE = 250;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const chunk = users.slice(i, i + BATCH_SIZE);
    const updates = chunk.map((u) => {
      const rawEmail = (u.email && u.email.includes(':') && u.email.split(':').length === 3)
        ? u.email
        : (u.email || `${u.id}@spotiflix.local`).toLowerCase().trim();
      
      const emailH = hashEmail(rawEmail);
      const encEmail = (u.email && u.email.includes(':') && u.email.split(':').length === 3)
        ? u.email
        : encryptEmail(rawEmail);

      return prisma.$executeRaw`
        UPDATE User 
        SET email = ${encEmail}, emailHash = ${emailH}
        WHERE id = ${u.id};
      `;
    });

    await prisma.$transaction(updates);
    console.log(`Updated ${Math.min(i + BATCH_SIZE, users.length)}/${users.length}`);
  }

  // Ensure Alok Nath exists
  const salt = await bcrypt.genSalt(10);
  const alokPasswordHash = await bcrypt.hash('Alok@123', salt);
  const alokRawEmail = 'alok@spotiflix.com';
  const alokEmailHash = hashEmail(alokRawEmail);
  const alokEncryptedEmail = encryptEmail(alokRawEmail);

  const existingAlok = await prisma.$queryRaw`SELECT id FROM User WHERE id = 'alok-nath-1';`;
  if (existingAlok.length > 0) {
    await prisma.$executeRaw`
      UPDATE User
      SET email = ${alokEncryptedEmail},
          emailHash = ${alokEmailHash},
          passwordHash = ${alokPasswordHash},
          name = 'Alok Nath',
          avatar = 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'
      WHERE id = 'alok-nath-1';
    `;
  } else {
    const now = new Date().toISOString();
    await prisma.$executeRaw`
      INSERT INTO User (id, email, emailHash, passwordHash, name, avatar, createdAt, updatedAt)
      VALUES ('alok-nath-1', ${alokEncryptedEmail}, ${alokEmailHash}, ${alokPasswordHash}, 'Alok Nath', 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png', ${now}, ${now});
    `;
  }

  console.log('✅ User migration complete! User "alok-nath-1" is ready with password "Alok@123".');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
