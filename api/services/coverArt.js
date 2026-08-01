import axios from 'axios';
import { redisClient } from '../config/redis.js';

export class CoverArtService {
    /**
     * Fetches high-res album art from the free iTunes Search API.
     * This avoids burning our YouTube Data API quota just for thumbnails,
     * while completely bypassing Last.fm's broken/missing image links.
     */
    static async getArtwork(trackName, artistName) {
        // Strip out weird characters for a cleaner cache key
        const safeTrack = trackName.replace(/[^a-zA-Z0-9]/g, '');
        const safeArtist = artistName.replace(/[^a-zA-Z0-9]/g, '');
        const cacheKey = `artwork:${safeTrack}:${safeArtist}`.toLowerCase();
        
        const cached = await redisClient.get(cacheKey);
        if (cached) return cached;

        try {
            const query = encodeURIComponent(`${artistName} ${trackName}`);
            const response = await axios.get(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`, {
                timeout: 3000 // Fast fail if iTunes hangs
            });
            
            if (response.data.results && response.data.results.length > 0) {
                // iTunes returns 100x100 by default. String replacement gets us a crisp 600x600 image.
                const highResUrl = response.data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                
                // Cache this forever (album art doesn't change)
                await redisClient.set(cacheKey, highResUrl); 
                return highResUrl;
            }
        } catch (error) {
            console.error(`[CoverArt] Failed for ${trackName}:`, error.message);
        }

        // Cache a "failed" state so we don't spam iTunes API for obscure tracks
        await redisClient.set(cacheKey, 'NOT_FOUND', { EX: 86400 }); 
        return null;
    }
}
