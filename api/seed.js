import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const FAKE_USERS = [
  { prefix: 'RockFan', count: 10, preferredTags: ['rock', 'metal', 'grunge'] },
  { prefix: 'PopFan', count: 15, preferredTags: ['pop', 'dance', 'electronic'] },
  { prefix: 'HipHopFan', count: 10, preferredTags: ['hiphop', 'rap', 'rnb'] },
  { prefix: 'AcousticFan', count: 5, preferredTags: ['acoustic', 'chill', 'indie'] },
];

const FAKE_TRACKS = [
  // Rock
  { id: 'rock-1', title: 'Highway to Hell', artist: 'AC/DC', tags: 'rock,metal' },
  { id: 'rock-2', title: 'Smells Like Teen Spirit', artist: 'Nirvana', tags: 'rock,grunge' },
  { id: 'rock-3', title: 'Enter Sandman', artist: 'Metallica', tags: 'metal,rock' },
  // Pop
  { id: 'pop-1', title: 'Bad Romance', artist: 'Lady Gaga', tags: 'pop,dance' },
  { id: 'pop-2', title: 'Blinding Lights', artist: 'The Weeknd', tags: 'pop,electronic' },
  { id: 'pop-3', title: 'Toxic', artist: 'Britney Spears', tags: 'pop,dance' },
  // HipHop
  { id: 'hip-1', title: 'Lose Yourself', artist: 'Eminem', tags: 'hiphop,rap' },
  { id: 'hip-2', title: 'Sicko Mode', artist: 'Travis Scott', tags: 'hiphop,rap' },
  { id: 'hip-3', title: 'Gold Digger', artist: 'Kanye West', tags: 'hiphop' },
  // Acoustic
  { id: 'aco-1', title: 'Blackbird', artist: 'The Beatles', tags: 'acoustic,classic' },
  { id: 'aco-2', title: 'Holocene', artist: 'Bon Iver', tags: 'indie,acoustic' },
  { id: 'aco-3', title: 'Thinking Out Loud', artist: 'Ed Sheeran', tags: 'pop,acoustic' },
];

async function seed() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Tracks
  console.log('Inserting tracks...');
  for (const t of FAKE_TRACKS) {
    await prisma.track.upsert({
      where: { id: t.id },
      update: { tags: t.tags },
      create: {
        id: t.id,
        title: t.title,
        artist: t.artist,
        tags: t.tags,
      },
    });
  }

  // 2. Create Users & Preferences
  console.log('Generating fake users and interactions...');
  let totalLikes = 0;

  for (const group of FAKE_USERS) {
    for (let i = 1; i <= group.count; i++) {
      const email = `${group.prefix.toLowerCase()}${i}@fake.local`;
      const name = `${group.prefix} ${i}`;

      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name },
      });

      // Fake Search History
      const searchQueries = group.preferredTags;
      for (const query of searchQueries) {
        if (Math.random() < 0.5) {
          await prisma.searchHistory.create({
            data: {
              userId: user.id,
              query: query,
              resultCount: Math.floor(Math.random() * 20) + 1,
            }
          });
        }
      }

      // Track Interactions
      for (const track of FAKE_TRACKS) {
        const trackTags = track.tags.split(',');
        const lovesIt = trackTags.some(t => group.preferredTags.includes(t));
        
        // 80% chance to interact with tracks in their favorite genre
        // 10% chance to accidentally interact out of genre
        const interacts = lovesIt ? Math.random() < 0.8 : Math.random() < 0.1;

        if (interacts) {
          // 1. Click Telemetry
          await prisma.clickHistory.create({
            data: { userId: user.id, trackId: track.id, isAlbum: false, source: 'browse' }
          });

          // 2. Hover Telemetry (lovesIt = longer hover)
          await prisma.hoverHistory.create({
            data: { 
              userId: user.id, 
              trackId: track.id, 
              isAlbum: false, 
              durationMs: lovesIt ? Math.floor(Math.random() * 5000) + 3000 : Math.floor(Math.random() * 2000) + 500 
            }
          });

          // 3. Watch Telemetry (lovesIt = watched longer, completed)
          const completed = lovesIt ? Math.random() < 0.9 : Math.random() < 0.2;
          const skipSource = completed ? null : (Math.random() < 0.5 ? 'manual' : 'closed');
          await prisma.watchHistory.create({
            data: {
              userId: user.id,
              trackId: track.id,
              durationWatched: completed ? 180 : Math.floor(Math.random() * 60) + 10,
              completed,
              skipSource,
            }
          });

          // 4. Like (Explicit Feedback)
          const isLike = lovesIt ? Math.random() < 0.9 : Math.random() < 0.3;
          await prisma.like.upsert({
            where: { userId_trackId: { userId: user.id, trackId: track.id } },
            update: { isLike },
            create: { userId: user.id, trackId: track.id, isLike },
          });
          totalLikes++;
        }
      }
    }
  }

  console.log(`✅ Seeding complete! Populated rich telemetry (Clicks, Hovers, Watches, Likes, Searches) for all synthetic users.`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
