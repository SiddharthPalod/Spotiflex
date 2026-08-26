// src/services/movieService.ts
import axios from 'axios';
import { Movie } from './api.config';

// Use relative path → Vite proxy forwards to Express backend (no CORS issues)
// In production set VITE_API_URL to your deployed backend URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL: API_BASE_URL });

// ── All UI row endpoints map to /mock-trending (Phase 1) ──────────────────
// Phase 2 will replace each with its own Spotify-backed endpoint.
const ENDPOINT_MAP: Record<string, string> = {
  trending:        'trending',
  netflixOriginals:'netflixOriginals',
  madeForYou:      'recommendations/for-you',
  topRated:        'topRated',
  actionMovies:    'actionMovies',
  comedyMovies:    'comedyMovies',
  horrorMovies:    'comedyMovies', // Fallback for unused rows
  romanceMovies:   'comedyMovies', // Fallback for unused rows
  documentaries:   'comedyMovies', // Fallback for unused rows
};

// ── YouTube thumbnail helper ──────────────────────────────────────────────
// Returns the best quality thumbnail YouTube has for a given video ID.
// Falls back to hqdefault (always exists) if maxresdefault 404s.
export const getYouTubeThumbnail = (videoId: string, quality: 'max' | 'hq' = 'max'): string => {
  const q = quality === 'max' ? 'maxresdefault' : 'hqdefault';
  return `https://img.youtube.com/vi/${videoId}/${q}.jpg`;
};

// ── Image URL resolver ────────────────────────────────────────────────────
// Priority: YouTube thumbnail (best) → full URL → TMDB relative path → placeholder
export const getImageUrl = (path: string | undefined, _size?: string): string => {
  if (!path) return 'https://placehold.co/300x450/111/1DB954?text=Track';
  if (path.startsWith('http')) return path;
  // TMDB relative path fallback
  const sizePrefix = _size === 'backdrop' ? '/original' : '/w500';
  return `https://image.tmdb.org/t/p${sizePrefix}${path}`;
};

// ── fetchTracks ───────────────────────────────────────────────────────────
// Fetches tracks and normalises them so the UI always has:
//  • coverArtUrl  = YouTube maxres thumbnail (if videoId known) or Wikipedia art
//  • poster_path / backdrop_path = same value (for legacy component compat)
//  • youtubeVideoId = passed through from backend
export const fetchTracks = async (endpoint: string): Promise<Movie[]> => {
  try {
    const backendPath = ENDPOINT_MAP[endpoint] ?? endpoint;
    const response = await api.get(`/${backendPath}`);
    const raw: any[] = response.data || [];

    return raw.map((item): Movie => {
      // If we don't have a youtubeVideoId yet (since it's fetched on-the-fly),
      // we just use the high-res coverArtUrl from Last.fm
      const coverArtUrl = item.coverArtUrl || '';

      return {
        ...item,
        youtubeVideoId: item.youtubeVideoId ?? null,
        coverArtUrl,
        poster_path:   coverArtUrl,
        backdrop_path: coverArtUrl,
        title:       item.title ?? item.name ?? 'Unknown',
        name:        item.name  ?? item.title ?? 'Unknown',
        overview:    item.overview ?? (item.album ? `Album: ${item.album}` : ''),
        vote_average:item.vote_average ?? 0,
        isAlbum:     item.isAlbum ?? false,
      };
    });
  } catch (error) {
    console.error(`[movieService] fetchTracks("${endpoint}") failed:`, error);
    return [];
  }
};

export const fetchSimilarTracks = async (trackId: string, artist?: string, title?: string, excludeIds?: string[]): Promise<Movie[]> => {
  try {
    const exclude = excludeIds ? excludeIds.join(',') : undefined;
    const response = await api.get('/recommendations/similar', { params: { trackId, artist, title, exclude } });
    const raw: any[] = response.data || [];

    return raw.map((item): Movie => {
      const coverArtUrl = item.coverArtUrl || '';
      return {
        ...item,
        youtubeVideoId: item.youtubeVideoId ?? null,
        coverArtUrl,
        poster_path:   coverArtUrl,
        backdrop_path: coverArtUrl,
        title:       item.title ?? item.name ?? 'Unknown',
        name:        item.name  ?? item.title ?? 'Unknown',
        overview:    item.overview ?? (item.album ? `Album: ${item.album}` : ''),
        vote_average:item.vote_average ?? 0,
        isAlbum:     item.isAlbum ?? false,
      };
    });
  } catch (error) {
    console.error(`[movieService] fetchSimilarTracks("${trackId}") failed:`, error);
    return [];
  }
};

// Named wrappers kept for backward compatibility
export const fetchTrending         = () => fetchTracks('trending');
export const fetchNetflixOriginals = () => fetchTracks('netflixOriginals');
export const fetchTopRated         = () => fetchTracks('topRated');
export const fetchActionMovies     = () => fetchTracks('actionMovies');
export const fetchComedyMovies     = () => fetchTracks('comedyMovies');
export const fetchHorrorMovies     = () => fetchTracks('horrorMovies');
export const fetchRomanceMovies    = () => fetchTracks('romanceMovies');
export const fetchDocumentaries    = () => fetchTracks('documentaries');

// ── fetchVideoId ──────────────────────────────────────────────────────────
// Called by the VideoPlayer when it needs to resolve a video ID at play-time.
// For mock tracks the backend already has the ID cached and returns it instantly.
export const fetchVideoId = async (
  trackName: string,
  artistName: string,
): Promise<string | null> => {
  try {
    const res = await api.get('/fetch-video', { params: { trackName, artistName } });
    return res.data.videoId ?? null;
  } catch (err) {
    console.error('[movieService] fetchVideoId failed:', err);
    return null;
  }
};

// ── fetchAlbumTracks ──────────────────────────────────────────────────────
export const fetchAlbumTracks = async (artist: string, album: string): Promise<Movie[]> => {
  try {
    const response = await api.get('/album-tracks', { params: { artist, album } });
    const raw: any[] = response.data || [];

    return raw.map((item): Movie => {
      const coverArtUrl = item.coverArtUrl || '';
      return {
        ...item,
        youtubeVideoId: item.youtubeVideoId ?? null,
        coverArtUrl,
        poster_path:   coverArtUrl,
        backdrop_path: coverArtUrl,
        title:       item.title ?? item.name ?? 'Unknown',
        name:        item.name  ?? item.title ?? 'Unknown',
        overview:    item.overview ?? (item.album ? `Album: ${item.album}` : ''),
        vote_average:item.vote_average ?? 0,
        isAlbum:     false,
      };
    });
  } catch (error) {
    console.error(`[movieService] fetchAlbumTracks failed:`, error);
    return [];
  }
};

// ── searchTracks ──────────────────────────────────────────────────────────
export const searchTracks = async (query: string, type?: 'tracks' | 'all'): Promise<Movie[]> => {
  try {
    const response = await api.get('/search', { params: { q: query, type: type || 'all' } });
    const raw: any[] = response.data || [];

    return raw.map((item): Movie => {
      const coverArtUrl = item.coverArtUrl || '';
      return {
        ...item,
        youtubeVideoId: item.youtubeVideoId ?? null,
        coverArtUrl,
        poster_path:   coverArtUrl,
        backdrop_path: coverArtUrl,
        title:       item.title ?? item.name ?? 'Unknown',
        name:        item.name  ?? item.title ?? 'Unknown',
        overview:    item.overview ?? (item.album ? `Album: ${item.album}` : ''),
        vote_average:item.vote_average ?? 0,
        isAlbum:     item.isAlbum ?? false,
      };
    });
  } catch (error) {
    console.error(`[movieService] searchTracks failed:`, error);
    return [];
  }
};

// ── Custom Playlist API Methods ───────────────────────────────────────────

export const createPlaylist = async (name: string) => {
  const res = await api.post('/telemetry/playlist', { name });
  return res.data.playlist;
};

export const fetchPlaylists = async () => {
  const res = await api.get('/telemetry/playlists');
  return res.data.playlists || [];
};

export const addTrackToPlaylist = async (playlistId: string, track: Movie | any) => {
  const res = await api.post(`/telemetry/playlist/${playlistId}/tracks`, { track });
  return res.data.playlist;
};

export const removeTrackFromPlaylist = async (playlistId: string, trackId: string | number) => {
  const res = await api.delete(`/telemetry/playlist/${playlistId}/tracks/${trackId}`);
  return res.data;
};

export const deletePlaylist = async (playlistId: string) => {
  const res = await api.delete(`/telemetry/playlist/${playlistId}`);
  return res.data;
};
export const fetchHomeRows = async () => {
  try {
    const res = await api.get('/recommendations/home-rows');
    return res.data;
  } catch(e) {
    console.error('fetchHomeRows failed', e);
    return [];
  }
};

export const fetchTagTracks = async (tag: string, type: 'tracks'|'albums' = 'tracks'): Promise<Movie[]> => {
  try {
    const ep = type === 'albums' ? '/tag-albums' : '/tag-tracks';
    const response = await api.get(ep, { params: { tag } });
    const raw: any[] = response.data || [];
    return raw.map((item): Movie => {
      const coverArtUrl = item.coverArtUrl || '';
      return {
        ...item,
        youtubeVideoId: item.youtubeVideoId ?? null,
        coverArtUrl,
        poster_path:   coverArtUrl,
        backdrop_path: coverArtUrl,
        title:       item.title ?? item.name ?? 'Unknown',
        name:        item.name  ?? item.title ?? 'Unknown',
        overview:    item.overview ?? (item.album ? 'Album: ' + item.album : ''),
        vote_average:item.vote_average ?? 0,
        isAlbum:     item.isAlbum ?? (type === 'albums'),
      };
    });
  } catch (error) {
    console.error('fetchTagTracks failed', error);
    return [];
  }
};

export const fetchSpotiflexPicks = async (artist: string, title: string): Promise<Movie[]> => {
  try {
    const response = await api.get('/recommendations/spotiflex-picks', { params: { artist, title } });
    const raw: any[] = response.data || [];
    return raw.map((item): Movie => {
      const coverArtUrl = item.coverArtUrl || '';
      return {
        ...item,
        youtubeVideoId: item.youtubeVideoId ?? null,
        coverArtUrl,
        poster_path:   coverArtUrl,
        backdrop_path: coverArtUrl,
        title:       item.title ?? item.name ?? 'Unknown',
        name:        item.name  ?? item.title ?? 'Unknown',
        overview:    item.overview ?? (item.album ? 'Album: ' + item.album : ''),
        vote_average:item.vote_average ?? 0,
        isAlbum:     item.isAlbum ?? false,
      };
    });
  } catch (error) {
    console.error('fetchSpotiflexPicks failed', error);
    return [];
  }
};

