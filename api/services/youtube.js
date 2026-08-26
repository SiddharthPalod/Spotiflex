import axios from "axios";
import { redisClient } from "../config/redis.js";

export class YoutubeService {

    // ── getVideoId ─────────────────────────────────────────────────────────
    // Searches YouTube for the official music video and caches the result.
    // Includes an automated scraper fallback if the YouTube Data API key quota is exhausted.
    static async getVideoId(trackName, artistName) {
        const safeArtist = String(artistName || '').trim();
        const safeTrack = String(trackName || '').trim();
        const cacheKey = `yt:video:${safeArtist}:${safeTrack}`
            .toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const cachedId = await redisClient.get(cacheKey);
        if (cachedId) {
            return cachedId;
        }

        const searchQuery = `${safeTrack} ${safeArtist}`.trim();
        let selectedVideoId = null;

        // 1. Try YouTube Data API v3 if API key exists
        if (process.env.YOUTUBE_API_KEY) {
            try {
                const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                    params: {
                        part: 'snippet',
                        q: searchQuery,
                        type: 'video',
                        videoCategoryId: '10',
                        maxResults: 5,
                        key: process.env.YOUTUBE_API_KEY,
                    },
                    timeout: 3000
                });

                const items = response.data.items || [];
                if (items.length > 0) {
                    const isOfficialVideo = (title) => /official (music )?video/i.test(title);
                    const isOfficialAudio = (title) => /official audio/i.test(title);
                    const isLyricVideo = (title) => /lyric/i.test(title);

                    const officialVideo = items.find(item => isOfficialVideo(item.snippet.title) && !isLyricVideo(item.snippet.title));
                    const officialAudio = items.find(item => isOfficialAudio(item.snippet.title) && !isLyricVideo(item.snippet.title));
                    const vevoVideo     = items.find(item => item.snippet.channelTitle.toLowerCase().includes('vevo') || item.snippet.channelTitle.toLowerCase().includes(safeArtist.toLowerCase()));

                    const bestItem = officialVideo || officialAudio || vevoVideo || items[0];
                    selectedVideoId = bestItem.id?.videoId;
                }
            } catch (apiErr) {
                // Quota exceeded (403/429) or network issue -> gracefully fallback to scraper
                console.log(`[YouTube API Quota/Error] Falling back to zero-quota scraper for: ${searchQuery}`);
            }
        }

        // 2. Zero-Quota Web Scraper Fallback (bypasses all quota limits)
        if (!selectedVideoId) {
            try {
                const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery + ' audio')}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    timeout: 4000
                });
                const html = res.data;
                const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
                if (match && match[1]) {
                    selectedVideoId = match[1];
                }
            } catch (scraperErr) {
                console.error(`[YouTube Scraper Error] ${scraperErr.message}`);
            }
        }

        if (!selectedVideoId) {
            throw new Error(`Video not found on YouTube for: ${searchQuery}`);
        }

        // Cache forever — official music video IDs never change
        await redisClient.set(cacheKey, selectedVideoId);
        return selectedVideoId;
    }

    // ── validateVideoIds ───────────────────────────────────────────────────
    // Batch-checks a list of video IDs against the YouTube Data API.
    // Returns a Set of IDs that are: public + embeddable (safe to show in iframe).
    //
    // Results are cached in Redis for 24 hours — on cache hit, zero API quota used.
    // If Redis or the YouTube API is unavailable, all IDs are assumed valid
    // (fail-open) so a Redis outage doesn't wipe your track list.
    static async validateVideoIds(videoIds) {
        if (!videoIds || videoIds.length === 0) return new Set();

        const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 h
        const validIds = new Set();
        const toFetch  = [];

        // ── 1. Check Redis cache for each ID ──────────────────────────────
        for (const id of videoIds) {
            try {
                const cached = await redisClient.get(`yt:valid:${id}`);
                if (cached === '1') {
                    validIds.add(id);
                } else if (cached === '0') {
                    // Explicitly cached as invalid — skip
                    console.log(`[VALIDATION CACHE] ${id} → unavailable (cached)`);
                } else {
                    // Not yet cached — need to ask YouTube
                    toFetch.push(id);
                }
            } catch {
                // Redis error for this ID → be optimistic, include it
                validIds.add(id);
            }
        }

        if (toFetch.length === 0) return validIds;

        // ── 2. Batch call: videos?part=status&id=id1,id2,... ─────────────
        // YouTube returns only the videos that actually exist in the response.
        // Non-existent / private / deleted videos simply won't appear.
        try {
            console.log(`[VALIDATION] Checking ${toFetch.length} video ID(s) with YouTube API`);

            const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                    part: 'status',
                    id: toFetch.join(','),
                    key: process.env.YOUTUBE_API_KEY,
                },
            });

            const returnedItems = response.data.items ?? [];

            // Build a map: videoId → status
            const statusMap = {};
            for (const item of returnedItems) {
                statusMap[item.id] = item.status;
            }

            // ── 3. Evaluate and cache each result ─────────────────────────
            for (const id of toFetch) {
                const status = statusMap[id];

                // A video is usable if:
                //   • It appears in the response (exists & not deleted)
                //   • It is public
                //   • It is embeddable (can be shown in our iframe)
                const isValid =
                    status !== undefined &&
                    status.privacyStatus === 'public' &&
                    status.embeddable    === true;

                console.log(
                    `[VALIDATION] ${id} → ${isValid ? '✅ valid' : '❌ unavailable'} ` +
                    `(privacy=${status?.privacyStatus}, embeddable=${status?.embeddable})`
                );

                if (isValid) validIds.add(id);

                // Cache result for 24 hours
                try {
                    await redisClient.set(`yt:valid:${id}`, isValid ? '1' : '0', {
                        EX: CACHE_TTL_SECONDS,
                    });
                } catch {
                    // Redis write failure is non-fatal
                }
            }
        } catch (apiError) {
            // YouTube API call failed — fail-open: treat all unchecked IDs as valid
            // so an API outage doesn't silently break the UI.
            console.warn('[VALIDATION] YouTube API call failed, assuming all IDs valid:', apiError.message);
            for (const id of toFetch) validIds.add(id);
        }

        return validIds;
    }
}