import { prisma } from '../config/prisma.js';

async function testAll() {
  console.log('Testing User...');
  const users = await prisma.user.findMany();
  console.log('User OK:', users.length);

  console.log('Testing Profile...');
  const profiles = await prisma.profile.findMany();
  console.log('Profile OK:', profiles.length);

  console.log('Testing Track...');
  const tracks = await prisma.track.findMany();
  console.log('Track OK:', tracks.length);

  console.log('Testing Like...');
  const likes = await prisma.like.findMany();
  console.log('Like OK:', likes.length);

  console.log('Testing Playlist...');
  const playlists = await prisma.playlist.findMany({ include: { tracks: true } });
  console.log('Playlist OK:', playlists.length);

  console.log('Testing WatchHistory individually...');
  const totalWatch = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM WatchHistory');
  console.log('Raw count:', totalWatch);

  const rawRows = await prisma.$queryRawUnsafe('SELECT id, watchedAt FROM WatchHistory');
  console.log('Found raw rows:', rawRows.length);
  for (const r of rawRows) {
    try {
      await prisma.watchHistory.findUnique({ where: { id: r.id } });
    } catch (err) {
      console.error('FAILED ON WATCH ROW ID:', r.id, 'watchedAt:', r.watchedAt, 'Error:', err.message);
    }
  }

  console.log('Testing prisma.watchHistory.findMany()...');
  const allWatch = await prisma.watchHistory.findMany();
  console.log('ALL WatchHistory OK:', allWatch.length);
}

testAll().catch(console.error).finally(() => prisma.$disconnect());
