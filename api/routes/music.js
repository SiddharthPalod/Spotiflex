import express from 'express';
import { 
    getTrending, 
    getNetflixOriginals, 
    getTopRated, 
    getActionMovies, 
    getComedyMovies, 
    fetchVideo,
    getAlbumTracks,
    searchMedia,
    resolveVideo
} from '../controllers/music.js';

const router = express.Router();

// Dynamic Last.fm Endpoints
router.get('/trending', getTrending);
router.get('/netflixOriginals', getNetflixOriginals);
router.get('/topRated', getTopRated);
router.get('/actionMovies', getActionMovies);
router.get('/comedyMovies', getComedyMovies);

// Legacy fallback (in case the frontend hasn't updated yet)
router.get('/mock-trending', getTrending);

// YouTube Video Resolution
router.get('/fetch-video', fetchVideo);

// Album Tracks Resolution
router.get('/album-tracks', getAlbumTracks);

// Search
router.get('/search', searchMedia);

// Persist resolved YouTube ID back to the Track table
router.post('/resolve-video', resolveVideo);

export default router;