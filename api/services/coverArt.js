import axios from 'axios';
import { redisClient } from '../config/redis.js';
import { YoutubeService } from './youtube.js';

export class CoverArtService {
    /**
     * Fetches high-res album art from iTunes Search API,
     * with an automatic fallback to YouTube HD Video Thumbnails.
     * Caches in Redis for instant performance.
     */
    static async getArtwork(trackName, artistName) {
        if (!trackName) return null;
        
        // Strip out weird characters for a cleaner cache key
        const safeTrack = String(trackName).replace(/[^a-zA-Z0-9]/g, '');
        const safeArtist = String(artistName || '').replace(/[^a-zA-Z0-9]/g, '');
        const cacheKey = `artwork:${safeTrack}:${safeArtist}`.toLowerCase();
        
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached && cached !== 'NOT_FOUND') return cached;
        } catch (err) {
            // Redis fallback
        }

        // 1. Try iTunes Search API with browser User-Agent
        try {
            const query = encodeURIComponent(`${artistName || ''} ${trackName}`.trim());
            const response = await axios.get(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                },
                timeout: 3000
            });
            
            if (response.data.results && response.data.results.length > 0 && response.data.results[0].artworkUrl100) {
                const highResUrl = response.data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                await redisClient.set(cacheKey, highResUrl, { EX: 7 * 24 * 60 * 60 }); 
                return highResUrl;
            }
        } catch (error) {
            // iTunes failed or blocked; proceed to YouTube fallback
        }

        // 2. Try Last.fm track.getInfo if available
        if (process.env.LASTFM_API_KEY) {
            try {
                const lfmRes = await axios.get('http://ws.audioscrobbler.com/2.0/', {
                    params: {
                        method: 'track.getInfo',
                        artist: artistName || '',
                        track: trackName,
                        api_key: process.env.LASTFM_API_KEY,
                        format: 'json'
                    },
                    timeout: 2500
                });
                const img = lfmRes.data?.track?.album?.image?.find(i => i.size === 'extralarge')?.['#text'] || 
                            lfmRes.data?.track?.album?.image?.find(i => i.size === 'large')?.['#text'] || '';
                if (img && !img.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
                    await redisClient.set(cacheKey, img, { EX: 7 * 24 * 60 * 60 });
                    return img;
                }
            } catch (lfmErr) {
                // proceed to YouTube fallback
            }
        }

        // 3. YouTube Official Music Video HD Thumbnail Fallback
        try {
            const videoId = await YoutubeService.getVideoId(trackName, artistName || '');
            if (videoId) {
                const ytThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                await redisClient.set(cacheKey, ytThumbnail, { EX: 7 * 24 * 60 * 60 });
                return ytThumbnail;
            }
        } catch (ytError) {
            // All failed
        }

        return null;
    }
}

