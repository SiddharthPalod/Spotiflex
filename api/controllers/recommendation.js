import { RecommendationService } from '../services/recommendation.js';
import { LastFmService } from '../services/lastfm.js';
import { MLService } from '../services/ml.js';
import { prisma } from '../config/prisma.js';

export const getMadeForYou = async (req, res) => {
    // Hardcoded demo user for local development telemetry
    const userId = 'alok-nath-1';

    try {
        const recommendations = await RecommendationService.getMadeForYou(userId);

        // Fallback to global top charts if the ML engine returns nothing (Cold Start with 0 history)
        if (recommendations.length === 0) {
            console.log('[RecEngine] Cold Start: Falling back to Last.fm global charts');
            const fallback = await LastFmService.getTrending();
            return res.status(200).json(fallback);
        }

        res.status(200).json(recommendations);
    } catch (error) {
        console.error('[RecEngine] Controller Error:', error.message);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
};

export const getSimilar = async (req, res) => {
    const userId = 'alok-nath-1';
    const { trackId, artist, title, exclude } = req.query;
    
    if (!trackId) {
        return res.status(400).json({ error: 'trackId is required' });
    }

    const excludeIds = exclude ? exclude.split(',') : [];

    try {
        const recommendations = await RecommendationService.getSimilarTracks(userId, trackId, excludeIds);

        if (recommendations.length === 0) {
            console.log(`[RecEngine] Track ${trackId} not in ML Index. Falling back to Last.fm contextual search.`);
            
            // Look up the track details from DB in case they weren't provided in the query
            const dbTrack = await prisma.track.findUnique({ where: { id: trackId } });
            
            const queryArtist = artist || (dbTrack && dbTrack.artist);
            const queryTitle = title || (dbTrack && dbTrack.title);
            
            if (queryArtist) {
                if (queryTitle) {
                    let fallback = await LastFmService.getSimilar(queryArtist, queryTitle);
                    if (fallback && fallback.length > 0) {
                        // Asynchronously teach the ML Engine about this new track!
                        const similarTrackIds = fallback.map(t => t.id);
                        MLService.getInstance().addTrackToIndex(trackId, similarTrackIds).then(res => {
                            if (res.status === 'added') {
                                console.log(`[MLService] Successfully synthesized vector for ${queryTitle} using ${res.neighbors_used} Last.fm neighbors!`);
                            } else if (res.status === 'skipped') {
                                console.log(`[MLService] Skipped synthesis for ${queryTitle}: ${res.reason}`);
                            } else {
                                console.log(`[MLService] ML Index status for ${queryTitle}: ${res.status}`);
                            }
                        }).catch(err => {
                            console.error('[RecEngine] Failed to organically expand ML index:', err.message);
                        });
                        
                        // Filter out tracks that the user has already played in this session
                        if (excludeIds.length > 0) {
                            fallback = fallback.filter(t => !excludeIds.includes(t.id));
                        }
                        
                        return res.status(200).json(fallback);
                    }
                    console.log('[RecEngine] Last.fm returned 0 similar tracks. Falling back to Artist tracks.');
                }
                
                // If similar tracks failed, just search for the artist to keep the same vibe!
                let artistFallback = await LastFmService.search(queryArtist);
                if (artistFallback && artistFallback.length > 0) {
                    if (excludeIds.length > 0) {
                        artistFallback = artistFallback.filter(t => !excludeIds.includes(t.id));
                    }
                    return res.status(200).json(artistFallback);
                }
            } else {
                console.log('[RecEngine] Track not found in DB either and no query params provided. Falling back to Trending.');
            }
            
            let trending = await LastFmService.getTrending();
            if (excludeIds.length > 0) {
                trending = trending.filter(t => !excludeIds.includes(t.id));
            }
            return res.status(200).json(trending);
        }

        res.status(200).json(recommendations);
    } catch (error) {
        console.error('[RecEngine] Controller Error:', error.message);
        res.status(500).json({ error: 'Failed to generate similar tracks' });
    }
};
