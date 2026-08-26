import express from 'express';
import { 
  recordWatch, 
  recordLike, 
  recordSearch, 
  recordClick, 
  getMyList, 
  getWatchHistory, 
  recordHover,
  createPlaylist,
  getPlaylists,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist
} from '../controllers/telemetry.js';

const router = express.Router();

// POST /api/telemetry/watch   — Implicit feedback: how long was a track watched
router.post('/watch',    recordWatch);

// POST /api/telemetry/like    — Explicit feedback: heart button (adds to Liked Songs)
router.post('/like',     recordLike);

// POST /api/telemetry/search  — Search query tracking
router.post('/search',   recordSearch);

// POST /api/telemetry/click   — Track/album detail modal opened
router.post('/click',    recordClick);

// GET /api/telemetry/my-list  — Fetch Liked Songs, History & Playlists
router.get('/my-list',   getMyList);

// GET /api/telemetry/watch-history — Fetch user's watch history
router.get('/watch-history', getWatchHistory);

// POST /api/telemetry/hover   — Track hover duration for interest without interaction
router.post('/hover',    recordHover);

// Playlist Management
router.post('/playlist', createPlaylist);
router.get('/playlists', getPlaylists);
router.post('/playlist/:playlistId/tracks', addTrackToPlaylist);
router.delete('/playlist/:playlistId/tracks/:trackId', removeTrackFromPlaylist);
router.delete('/playlist/:playlistId', deletePlaylist);

export default router;
