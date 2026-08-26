import { YoutubeService } from "../services/youtube.js";
import { LastFmService } from "../services/lastfm.js";

// ── Dynamic Row Endpoints (Powered by Last.fm) ────────────────────────────
// The UI components hit these endpoints, which fetch metadata from Last.fm.
// Note: We intentionally do NOT fetch YouTube IDs here. Fetching 125 YouTube
// IDs per page load would exhaust the 10k daily API quota in ~10 minutes.
// Instead, YouTube IDs are resolved on-the-fly when the user clicks Play.

export const getTrending = async (req, res) => {
    try {
        const tracks = await LastFmService.getTrending();
        res.status(200).json(tracks);
    } catch (error) {
        console.error('[getTrending]', error.message);
        res.status(500).json({ error: error.message });
    }
};

export const getNetflixOriginals = async (req, res) => { // Spotiflex Picks
    try {
        const tracks = await LastFmService.getByTag('pop');
        res.status(200).json(tracks);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getTopRated = async (req, res) => {
    try {
        const tracks = await LastFmService.getByTag('hits');
        res.status(200).json(tracks);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getActionMovies = async (req, res) => { // High Energy
    try {
        const tracks = await LastFmService.getByTag('workout');
        res.status(200).json(tracks);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getComedyMovies = async (req, res) => { // Feel Good Vibes
    try {
        const tracks = await LastFmService.getByTag('happy');
        res.status(200).json(tracks);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getAlbumTracks = async (req, res) => {
    try {
        const { artist, album } = req.query;
        if (!artist || !album) {
            return res.status(400).json({ error: 'Missing artist or album query parameter' });
        }
        const tracks = await LastFmService.getAlbumTracklist(artist, album);
        res.status(200).json(tracks);
    } catch (error) {
        console.error('[getAlbumTracks]', error.message);
        res.status(500).json({ error: error.message });
    }
};

export const searchMedia = async (req, res) => {
    try {
        const { q, type } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Missing search query parameter (q)' });
        }
        const results = await LastFmService.search(q, type);
        res.status(200).json(results);
    } catch (error) {
        console.error('[searchMedia]', error.message);
        res.status(500).json({ error: error.message });
    }
};


// ── fetchVideo ─────────────────────────────────────────────────────────────
// Returns a YouTube video ID for any given track name + artist.
// This is called by the frontend VideoPlayer.tsx when the user clicks Play.
export const fetchVideo = async (req, res) => {
    const { trackName, artistName } = req.query;

    if (!trackName || !artistName) {
        return res.status(400).json({ error: 'Missing trackName or artistName parameters' });
    }

    try {
        // Searches YouTube Data API. Results are cached in Redis FOREVER,
        // so popular tracks will load instantly without burning quota.
        const videoId = await YoutubeService.getVideoId(trackName, artistName);
        res.status(200).json({ videoId });
    } catch (error) {
        console.error('Fetch Video Error:', error.message);
        res.status(500).json({ error: 'Failed to retrieve video ID' });
    }
};

// ── resolveVideo ──────────────────────────────────────────────────────────────
// Called by the frontend after the YouTube ID is resolved for a track.
// Writes it back to the Track table so future telemetry rows are never null.
export const resolveVideo = async (req, res) => {
    const { trackId, videoId } = req.body;
    if (!trackId || !videoId) {
        return res.status(400).json({ error: 'trackId and videoId are required' });
    }
    try {
        const { prisma } = await import('../config/prisma.js');
        // Track may not exist yet if telemetry hasn't fired first — ignore gracefully
        await prisma.track.updateMany({
            where: { id: trackId },
            data:  { youtubeVideoId: videoId },
        });
        console.log(`[resolveVideo] ▶ Saved videoId=${videoId} for trackId=${trackId}`);
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('[resolveVideo] Error:', error.message);
        res.status(500).json({ error: 'Failed to persist video ID' });
    }
};
