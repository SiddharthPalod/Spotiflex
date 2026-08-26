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
            return res.status(200).json(fallback.slice(0, 10));
        }

        res.status(200).json(recommendations.slice(0, 10));
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

export const getSpotiflexPicks = async (req, res) => {
    const { artist, title } = req.query;
    try {
        if (!artist || !title) {
            const trending = await LastFmService.getTrending();
            return res.status(200).json(trending.slice(0, 15));
        }
        let picks = await LastFmService.getSimilar(artist, title);
        if (!picks || picks.length === 0) {
            picks = await LastFmService.getTrending();
        }
        res.status(200).json(picks.slice(0, 15));
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch Spotiflex picks' });
    }
};

export const getHomeRows = async (req, res) => {
    const userId = 'alok-nath-1'; // simulated
    try {
        const history = await prisma.watchHistory.findMany({
            where: { userId },
            orderBy: { watchedAt: 'desc' },
            take: 50,
            include: { track: true }
        });

        // Extract top 5 artists from recent history to guess genres/languages
        const artistCounts = {};
        history.forEach(h => {
            const a = h.track.artist;
            artistCounts[a] = (artistCounts[a] || 0) + 1;
        });
        const topArtists = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(e => e[0]);
        
        let tagFrequencies = {};
        for (const artist of topArtists) {
            const tags = await LastFmService.getArtistTopTags(artist);
            tags.slice(0, 10).forEach(t => {
                let tagName = t;
                // Normalize some common India/Hindi tags
                if (['india', 'indian', 'hindie', 'bollywood'].includes(tagName)) tagName = 'hindi';
                if (['k-pop'].includes(tagName)) tagName = 'kpop';
                tagFrequencies[tagName] = (tagFrequencies[tagName] || 0) + 1;
            });
        }

        const sortedTags = Object.entries(tagFrequencies)
            .sort((a, b) => b[1] - a[1])
            .map(e => e[0]);

        // Available languages/genres we have specific rows for
        const languageTags = ['french', 'spanish', 'korean', 'japanese', 'hindi', 'punjabi', 'tamil', 'german', 'italian', 'kpop', 'latin'];
        const genreTags = ['pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'classical', 'indie', 'metal', 'acoustic', 'rnb'];
        
        const detectedLangs = sortedTags.filter(tag => languageTags.includes(tag));
        const detectedGenres = sortedTags.filter(tag => genreTags.includes(tag));

        const rows = [
            { title: 'Top 10 Recommendations (Made For You)', endpoint: 'recommendations/for-you' }
        ];

        // Dynamically add language rows based on user's actual tags!
        detectedLangs.slice(0, 2).forEach(lang => {
            const capLang = lang.charAt(0).toUpperCase() + lang.slice(1);
            rows.push({ title: `Trending in ${capLang}`, endpoint: `tag-tracks?tag=${lang}` });
        });

        // Dynamically add genre rows based on user's actual tags!
        detectedGenres.slice(0, 2).forEach(genre => {
            const capGenre = genre.charAt(0).toUpperCase() + genre.slice(1);
            rows.push({ title: `${capGenre} Hits`, endpoint: `tag-albums?tag=${genre}` });
        });

        // Add defaults if they lack history
        rows.push({ title: 'Trending Now', endpoint: 'trending' });
        
        if (detectedGenres.length === 0) {
            rows.push({ title: 'Top Pop Albums', endpoint: 'tag-albums?tag=pop' });
        }
        
        if (detectedLangs.length === 0) {
            rows.push({ title: 'High Energy', endpoint: 'tag-albums?tag=workout' });
        }
        
        res.status(200).json(rows);
    } catch (error) {
        console.error('[RecEngine] getHomeRows Error:', error.message);
        res.status(500).json({ error: 'Failed to generate home rows' });
    }
};

