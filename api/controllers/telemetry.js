import { prisma } from '../config/prisma.js';

// ── Simulated Session ────────────────────────────────────────────────────────
// Alok Nath is our simulated logged-in user. All telemetry is attributed to him.
const ALOK_NATH = {
  id:    'alok-nath-1',
  email: 'alok@spotiflix.local',
  name:  'Alok Nath',
};

const LIKED_SONGS_PLAYLIST_NAME = 'Liked Songs';

// ── Shared Helpers ───────────────────────────────────────────────────────────

async function getOrCreateUser() {
  return prisma.user.upsert({
    where:  { email: ALOK_NATH.email },
    update: {},
    create: ALOK_NATH,
  });
}

/**
 * Ensure a Track row exists. Stores isAlbum and albumId flags for grouping.
 * Always coerces IDs to strings to guard against numeric IDs from Last.fm.
 */
async function upsertTrack(track, extraFields = {}, forceUpdateSchema = false) {
  const id = String(track.id); // Last.fm IDs can arrive as numbers
  
  const updateData = {
    youtubeVideoId: track.youtubeVideoId || undefined,
    coverArtUrl:    track.coverArtUrl    || undefined,
    ...extraFields,
  };

  // Prevent background telemetry (hover/click) from blindly overwriting isAlbum 
  // back to true if it was explicitly converted to a song by the Like handler.
  if (!forceUpdateSchema) {
    delete updateData.isAlbum;
    delete updateData.albumId;
  }

  return prisma.track.upsert({
    where:  { id },
    update: updateData,
    create: {
      id,
      title:          track.title   || 'Unknown',
      artist:         track.artist  || 'Unknown',
      album:          track.album   || '',
      youtubeVideoId: track.youtubeVideoId || null,
      coverArtUrl:    track.coverArtUrl    || null,
      isAlbum:        false,
      albumId:        null,
      ...extraFields,
    },
  });
}

async function getLikedSongsPlaylist(userId) {
  let playlist = await prisma.playlist.findFirst({
    where: { userId, name: LIKED_SONGS_PLAYLIST_NAME },
  });
  if (!playlist) {
    playlist = await prisma.playlist.create({
      data: { userId, name: LIKED_SONGS_PLAYLIST_NAME },
    });
    console.log('[Telemetry] Created "Liked Songs" playlist for', userId);
  }
  return playlist;
}

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/telemetry/watch
 */
export const recordWatch = async (req, res) => {
  const { track, durationWatched, completed, skipSource = null } = req.body;

  if (!track || !track.id) {
    return res.status(400).json({ error: 'track object with id is required' });
  }

  try {
    const user = await getOrCreateUser();
    await upsertTrack(track);

    const history = await prisma.watchHistory.create({
      data: {
        userId:          user.id,
        trackId:         track.id,
        durationWatched: durationWatched || 0,
        completed:       completed       || false,
        skipSource,
      },
    });

    const sourceLabel = skipSource ? ` [${skipSource}]` : ' [natural end]';
    console.log(`[Telemetry] ▶ Watch: "${track.title}" by ${track.artist} — ${durationWatched}s, completed=${completed}${sourceLabel}`);
    
    // Dynamically update the ML Contextual Bandit
    // Reward logic: completed natural end = 1.0, watched > 30s = 0.5, skip early = -0.5
    let reward = 0.0;
    if (completed) reward = 1.0;
    else if (durationWatched > 30) reward = 0.5;
    else reward = -0.5;
    
    import('../services/ml.js').then(({ MLService }) => {
      const ml = MLService.getInstance();
      ml.sendFeedback(user.id, track.id, reward).catch(err => console.error('[RecEngine] Feedback Error:', err));
      
      // Asynchronously teach the ML engine about this track if it doesn't know it
      import('../services/lastfm.js').then(({ LastFmService }) => {
        LastFmService.getSimilar(track.artist, track.title).then(similar => {
          if (similar && similar.length > 0) {
            const similarTrackIds = similar.map(t => t.id);
            ml.addTrackToIndex(track.id, similarTrackIds).catch(() => {});
          }
        }).catch(() => {});
      });
    }).catch(() => {});

    res.status(201).json(history);
  } catch (error) {
    console.error('[Telemetry] recordWatch Error:', error);
    res.status(500).json({ error: 'Failed to record watch history' });
  }
};

/**
 * POST /api/telemetry/like
 * 
 * Body: { track, albumTracks?, isLike }
 *   - track      : the album object or single track that was hearted
 *   - albumTracks: resolved song list (only sent for albums)
 *   - isLike     : boolean — true = heart, false = un-heart
 *
 * Logic:
 *   - If it's an ALBUM with > 1 track  → store the album row + all songs; add album card to playlist
 *   - If it's an ALBUM with 1 track    → treat as a single song
 *   - If it's a TRACK                  → store just the song; add it to playlist
 */
export const recordLike = async (req, res) => {
  const { track, albumTracks, isLike = true } = req.body;

  if (!track || !track.id) {
    return res.status(400).json({ error: 'track object with id is required' });
  }

  try {
    const user     = await getOrCreateUser();
    const playlist = await getLikedSongsPlaylist(user.id);
    const albumId  = String(track.id); // always a string for Prisma

    const hasMultipleTracks = albumTracks && albumTracks.length > 1;
    const isAlbumWithSongs  = track.isAlbum && hasMultipleTracks;

    if (isAlbumWithSongs) {
      // ── Album: store the album card itself + each song ──────────────────
      // 1. Upsert the album row (isAlbum=true)
      await upsertTrack(track, { isAlbum: true }, true);

      // 2. Upsert each song row with a backlink to the album
      for (const t of albumTracks) {
        const songId = String(t.id);
        await upsertTrack(t, { isAlbum: false, albumId }, true);

        await prisma.like.upsert({
          where:  { userId_trackId: { userId: user.id, trackId: songId } },
          update: { isLike },
          create: { userId: user.id, trackId: songId, isLike },
        });
      }

      // 3. Add the ALBUM row to the playlist
      if (isLike) {
        await prisma.playlistTrack.upsert({
          where:  { playlistId_trackId: { playlistId: playlist.id, trackId: albumId } },
          update: {},
          create: { playlistId: playlist.id, trackId: albumId, order: 0 },
        });
      } else {
        await prisma.playlistTrack.deleteMany({
          where: { playlistId: playlist.id, trackId: albumId },
        });
      }

      console.log(`[Telemetry] ❤  Album liked: "${track.title}" (${albumTracks.length} tracks)`);
    } else {
      // ── Single track (or album with only 1 song) ─────────────────────────
      // If it was an album with 1 song, we want to save the SONG's metadata but under the ALBUM's ID
      // so the UI card (which uses the album ID) stays perfectly in sync with the heart button.
      const singleTrack = (albumTracks && albumTracks.length === 1) 
        ? { ...albumTracks[0], id: track.id, isAlbum: false } 
        : track;
      
      const singleId    = String(singleTrack.id);
      await upsertTrack(singleTrack, { isAlbum: false }, true);

      await prisma.like.upsert({
        where:  { userId_trackId: { userId: user.id, trackId: singleId } },
        update: { isLike },
        create: { userId: user.id, trackId: singleId, isLike },
      });

      if (isLike) {
        await prisma.playlistTrack.upsert({
          where:  { playlistId_trackId: { playlistId: playlist.id, trackId: singleId } },
          update: {},
          create: { playlistId: playlist.id, trackId: singleId, order: 0 },
        });
      } else {
        await prisma.playlistTrack.deleteMany({
          where: { playlistId: playlist.id, trackId: singleId },
        });
      }

      console.log(`[Telemetry] ❤  Track liked: "${singleTrack.title}" by ${singleTrack.artist}`);
      
      // Send explicit positive/negative feedback to ML Engine (1.5 for like, -1.0 for dislike)
      import('../services/ml.js').then(({ MLService }) => {
        const ml = MLService.getInstance();
        ml.sendFeedback(user.id, singleId, isLike ? 1.5 : -1.0).catch(err => console.error('[RecEngine] Feedback Error:', err));
        
        if (isLike) {
            import('../services/lastfm.js').then(({ LastFmService }) => {
              LastFmService.getSimilar(singleTrack.artist, singleTrack.title).then(similar => {
                if (similar && similar.length > 0) {
                  const similarTrackIds = similar.map(t => t.id);
                  ml.addTrackToIndex(singleId, similarTrackIds).catch(() => {});
                }
              }).catch(() => {});
            });
        }
      }).catch(() => {});
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('[Telemetry] recordLike Error:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to record like', detail: error.message });
  }
};

/**
 * GET /api/telemetry/my-list
 * Returns the "Liked Songs" playlist contents for Siddharth.
 * Separates albums from individual tracks in the response.
 */
export const getMyList = async (req, res) => {
  try {
    const user = await getOrCreateUser();

    const playlist = await prisma.playlist.findFirst({
      where: { userId: user.id, name: LIKED_SONGS_PLAYLIST_NAME },
      include: {
        tracks: {
          include: { track: true },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!playlist) {
      return res.status(200).json({ albums: [], tracks: [] });
    }

    const albums = [];
    const tracks = [];

    for (const pt of playlist.tracks) {
      const t = pt.track;
      if (t.isAlbum) {
        albums.push({
          id:          t.id,
          title:       t.title,
          artist:      t.artist,
          coverArtUrl: t.coverArtUrl,
          isAlbum:     true,
          addedAt:     pt.addedAt,
        });
      } else {
        tracks.push({
          id:          t.id,
          title:       t.title,
          artist:      t.artist,
          album:       t.album,
          coverArtUrl: t.coverArtUrl,
          youtubeVideoId: t.youtubeVideoId,
          isAlbum:     false,
          addedAt:     pt.addedAt,
        });
      }
    }

    res.status(200).json({ albums, tracks });
  } catch (error) {
    console.error('[Telemetry] getMyList Error:', error);
    res.status(500).json({ error: 'Failed to fetch My List' });
  }
};

/**
 * GET /api/telemetry/watch-history
 * Returns the "Watch History" for the user.
 * Filters for watch duration > 10 seconds. Returns unique tracks ordered by most recently watched.
 */
export const getWatchHistory = async (req, res) => {
  try {
    const user = await getOrCreateUser();

    // Fetch the history, ordered by watchedAt descending
    const history = await prisma.watchHistory.findMany({
      where: {
        userId: user.id,
        durationWatched: { gt: 10 },
      },
      orderBy: { watchedAt: 'desc' },
      include: {
        track: true,
      },
    });

    // Deduplicate tracks, keeping only the most recent play
    const uniqueTracks = [];
    const seen = new Set();
    
    for (const h of history) {
      if (!seen.has(h.trackId)) {
        seen.add(h.trackId);
        // Format identically to My List tracks
        const t = h.track;
        uniqueTracks.push({
          id:          t.id,
          title:       t.title,
          artist:      t.artist,
          album:       t.album,
          coverArtUrl: t.coverArtUrl,
          youtubeVideoId: t.youtubeVideoId,
          isAlbum:     false,
          addedAt:     h.watchedAt, // use watchedAt for sorting/display
        });
      }
    }

    res.status(200).json({ tracks: uniqueTracks });
  } catch (error) {
    console.error('[Telemetry] getWatchHistory Error:', error);
    res.status(500).json({ error: 'Failed to fetch Watch History' });
  }
};

/**
 * POST /api/telemetry/search
 */
export const recordSearch = async (req, res) => {
  const { query, resultCount = 0 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    const user = await getOrCreateUser();

    const record = await prisma.searchHistory.create({
      data: { userId: user.id, query, resultCount },
    });

    console.log(`[Telemetry] 🔍 Search: "${query}" → ${resultCount} results`);
    res.status(201).json(record);
  } catch (error) {
    console.error('[Telemetry] recordSearch Error:', error);
    res.status(500).json({ error: 'Failed to record search' });
  }
};

/**
 * POST /api/telemetry/click
 */
export const recordClick = async (req, res) => {
  const { track, source = 'browse' } = req.body;

  if (!track || !track.id) {
    return res.status(400).json({ error: 'track object with id is required' });
  }

  try {
    const user = await getOrCreateUser();
    await upsertTrack(track);

    const record = await prisma.clickHistory.create({
      data: {
        userId:  user.id,
        trackId: track.id,
        isAlbum: track.isAlbum || false,
        source,
      },
    });

    console.log(`[Telemetry] 👆 Click: "${track.title}" (source=${source}, isAlbum=${track.isAlbum})`);
    res.status(201).json(record);
  } catch (error) {
    console.error('[Telemetry] recordClick Error:', error);
    res.status(500).json({ error: 'Failed to record click' });
  }
};

/**
 * Record a hover event (user hovered over a card for >= X ms).
 */
export const recordHover = async (req, res) => {
  const { track, durationMs } = req.body;

  if (!track || !track.id) {
    return res.status(400).json({ error: 'track object with id is required' });
  }

  if (!durationMs || durationMs < 0) {
    return res.status(400).json({ error: 'valid durationMs is required' });
  }

  try {
    const user = await getOrCreateUser();
    await upsertTrack(track, { isAlbum: track.isAlbum || false });

    await prisma.hoverHistory.create({
      data: {
        userId: user.id,
        trackId: String(track.id),
        isAlbum: track.isAlbum || false,
        durationMs: Number(durationMs),
      },
    });

    console.log(`[Telemetry] 👀 Hovered ${Math.round(durationMs/1000)}s on ${track.isAlbum ? 'Album' : 'Track'}: "${track.title}" by ${track.artist}`);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('[Telemetry] recordHover Error:', error.message);
    res.status(500).json({ error: 'Failed to record hover' });
  }
};
