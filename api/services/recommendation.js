import { prisma } from '../config/prisma.js';
import { MLService } from './ml.js';
import { LastFmService } from './lastfm.js';
import { normalizeSongTitle } from '../utils/trackHelper.js';

export class RecommendationService {
    
    /**
     * Hybrid Engine Core
     * Requests Candidates from the Python Stdio Daemon, then decorates them with Database metadata.
     */
    static async getMadeForYou(userId) {
        console.log(`[RecEngine] Requesting AI Hybrid Recs for ${userId}`);
        
        const mlService = MLService.getInstance();
        
        try {
            // Fetch recent watch history to handle cold-start users dynamically
            const history = await prisma.watchHistory.findMany({
                where: { userId },
                orderBy: { watchedAt: 'desc' },
                take: 20
            });
            const historyTrackIds = history.map(h => h.trackId);
            
            // 1. Get raw string Track IDs from the Python daemon
            const trackIds = await mlService.getRecommendations(userId, historyTrackIds);
            
            if (!trackIds || trackIds.length === 0) {
                return []; // Trigger controller cold-start fallback
            }

            // 2. Fetch track metadata from Prisma DB
            const dbTracks = await prisma.track.findMany({
                where: { id: { in: trackIds } }
            });

            // 3. Prisma findMany doesn't guarantee ordering matching the IN clause.
            // We MUST remap and sort them to match the strict mathematical ranking order decided by LinUCB.
            const trackMap = new Map();
            for (const t of dbTracks) {
                trackMap.set(t.id, t);
            }

            const sortedTracks = [];
            const seen = new Set();
            const historySet = new Set(historyTrackIds);
            
            for (const tId of trackIds) {
                // Avoid recommending tracks the user has already watched recently
                if (historySet.has(tId)) continue;

                const t = trackMap.get(tId);
                if (t && t.coverArtUrl) {
                    const uniqueKey = normalizeSongTitle(t.title) || `${t.title}-${t.artist}`.toLowerCase();
                    if (seen.has(uniqueKey)) continue;
                    seen.add(uniqueKey);
                    
                    sortedTracks.push({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        album: t.album,
                        coverArtUrl: t.coverArtUrl,
                        vote_average: 9.8 // AI Confidence Score proxy for frontend UI stars
                    });
                }
            }

            return sortedTracks;
            
        } catch (error) {
            console.error('[RecEngine] AI Backend Failed, failing over...', error.message);
            return [];
        }
    }

    /**
     * Context-Aware Hybrid Engine
     * Retrieves FAISS candidates mathematically similar to the track, then ranks them for the User.
     */
    static async getSimilarTracks(userId, trackId, excludeIds = []) {
        console.log(`[RecEngine] Requesting AI Track Context Recs for user=${userId}, track=${trackId}`);
        
        const mlService = MLService.getInstance();
        
        try {
            let trackIds = await mlService.getSimilarTracks(userId, trackId);
            
            if (!trackIds || trackIds.length === 0) {
                return [];
            }
            
            // Filter out tracks that the user has already played in this session
            const excludeSet = new Set(excludeIds.map(id => String(id)));
            excludeSet.add(String(trackId));

            trackIds = trackIds.filter(id => !excludeSet.has(String(id)));

            if (trackIds.length === 0) {
                return [];
            }

            const dbTracks = await prisma.track.findMany({
                where: { id: { in: trackIds } }
            });

            const trackMap = new Map();
            for (const t of dbTracks) {
                trackMap.set(t.id, t);
            }

            const sortedTracks = [];
            const seenTitles = new Set();

            for (const tId of trackIds) {
                const t = trackMap.get(tId);
                if (t && t.coverArtUrl) {
                    const normTitle = normalizeSongTitle(t.title);
                    if (normTitle && seenTitles.has(normTitle)) continue;
                    if (normTitle) seenTitles.add(normTitle);

                    sortedTracks.push({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        album: t.album,
                        coverArtUrl: t.coverArtUrl,
                        vote_average: 9.8 
                    });
                }
            }

            return sortedTracks;
            
        } catch (error) {
            console.error('[RecEngine] AI Backend Failed for similar tracks...', error.message);
            return [];
        }
    }
}
