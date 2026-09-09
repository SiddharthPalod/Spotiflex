import { prisma } from '../config/prisma.js';

async function inspect() {
  try {
    const rawWatch = await prisma.$queryRawUnsafe('SELECT * FROM WatchHistory');
    console.log('Total Raw WatchHistory rows:', rawWatch.length);
    if (rawWatch.length > 0) {
      console.log('Sample WatchHistory row:', rawWatch[0]);
      console.log('All WatchHistory watchedAt values:', rawWatch.map(r => ({ id: r.id, watchedAt: r.watchedAt, type: typeof r.watchedAt })));
    }

    const rawLikes = await prisma.$queryRawUnsafe('SELECT * FROM "Like"');
    console.log('Total Raw Like rows:', rawLikes.length);
    if (rawLikes.length > 0) {
      console.log('Sample Like row:', rawLikes[0]);
    }

    const rawPlaylists = await prisma.$queryRawUnsafe('SELECT * FROM Playlist');
    console.log('Playlists:', rawPlaylists);

    const rawPlaylistTracks = await prisma.$queryRawUnsafe('SELECT * FROM PlaylistTrack');
    console.log('PlaylistTracks count:', rawPlaylistTracks.length);

    const rawUsers = await prisma.$queryRawUnsafe('SELECT id, name, email FROM User');
    console.log('Users:', rawUsers);
  } catch (err) {
    console.error('Raw query error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
