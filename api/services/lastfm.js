import axios from 'axios';
import { redisClient } from '../config/redis.js';
import { CoverArtService } from './coverArt.js';

const LASTFM_URL = 'http://ws.audioscrobbler.com/2.0/';

export class LastFmService {
  /**
   * Universal fetcher for Last.fm API
   * Caches responses in Redis for 24 hours to prevent rate limiting.
   */
  static async fetchTracks(method, extraParams = {}) {
    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) {
      throw new Error('LASTFM_API_KEY is missing from the backend .env file');
    }

    const cacheKey = `lastfm:${method}:${JSON.stringify(extraParams)}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`[LASTFM CACHE HIT] ${cacheKey}`);
      return JSON.parse(cached);
    }

    console.log(`[LASTFM CACHE MISS] Fetching ${method}`);
    const response = await axios.get(LASTFM_URL, {
      params: {
        method,
        api_key: apiKey,
        format: 'json',
        limit: 25, // Fetch 25 to ensure we have enough even if YouTube validation drops some
        ...extraParams,
      },
    });

    // Last.fm returns the track array differently depending on the endpoint
    let rawTracks = [];
    if (response.data?.tracks?.track) {
      rawTracks = response.data.tracks.track;
    } else if (response.data?.similartracks?.track) {
      rawTracks = response.data.similartracks.track;
    }

    if (!Array.isArray(rawTracks)) {
      rawTracks = [rawTracks];
    }

    // Normalize Last.fm data into our Spotiflex Track format
    // We use Promise.all to fetch iTunes cover art concurrently
    const mappedTracks = await Promise.all(rawTracks.map(async (t) => {
      // Find the largest available image from Last.fm (usually just a placeholder star)
      let lastFmCover = t.image?.find((img) => img.size === 'extralarge')?.['#text'] || 
                          t.image?.find((img) => img.size === 'large')?.['#text'] || '';
      
      // Last.fm's default grey star image
      if (lastFmCover.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
         lastFmCover = '';
      }
      
      // Attempt to grab beautiful, high-res 600x600 album art from iTunes
      let realCover = await CoverArtService.getArtwork(t.name, t.artist.name);
      if (realCover === 'NOT_FOUND') realCover = null;

      // Generate a fake "match percentage" out of 10 based on playcount or listeners
      let fakeScore = 8.5; 
      if (t.playcount) {
        fakeScore = Math.min(6 + (parseInt(t.playcount) / 1000000), 9.9);
      }

      return {
        id: t.mbid || `${t.name}-${t.artist.name}`.replace(/\s+/g, '-'),
        title: t.name,
        artist: t.artist.name,
        album: '', 
        coverArtUrl: realCover || lastFmCover,
        vote_average: parseFloat(fakeScore.toFixed(1)),
      };
    }));

    // Filter out items without images before caching
    const validTracks = mappedTracks.filter(t => t.coverArtUrl);
    
    // Cache the parsed response for 24 hours
    await redisClient.set(cacheKey, JSON.stringify(validTracks), { EX: 24 * 60 * 60 });
    return validTracks;
  }

  /**
   * Fetch Albums from Last.fm
   */
  static async fetchAlbums(method, extraParams = {}) {
    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) {
      throw new Error('LASTFM_API_KEY is missing from the backend .env file');
    }

    const cacheKey = `lastfm-albums:${method}:${JSON.stringify(extraParams)}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`[LASTFM CACHE HIT] ${cacheKey}`);
      return JSON.parse(cached);
    }

    console.log(`[LASTFM CACHE MISS] Fetching ${method}`);
    const response = await axios.get(LASTFM_URL, {
      params: {
        method,
        api_key: apiKey,
        format: 'json',
        limit: 25,
        ...extraParams,
      },
    });

    let rawAlbums = [];
    if (response.data?.albums?.album) {
      rawAlbums = response.data.albums.album;
    }

    const mappedAlbums = await Promise.all(rawAlbums.map(async (a) => {
      let lastFmCover = a.image?.find((img) => img.size === 'extralarge')?.['#text'] || 
                          a.image?.find((img) => img.size === 'large')?.['#text'] || '';
      
      if (lastFmCover.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
         lastFmCover = '';
      }
      
      let artistName = typeof a.artist === 'object' ? a.artist.name : a.artist;
      let realCover = await CoverArtService.getArtwork(a.name, artistName);
      if (realCover === 'NOT_FOUND') realCover = null;

      let fakeScore = 8.5; 
      if (a.playcount) {
        fakeScore = Math.min(6 + (parseInt(a.playcount) / 1000000), 9.9);
      }

      return {
        id: a.mbid || `${a.name}-${artistName}`.replace(/\s+/g, '-'),
        title: a.name,
        name: a.name, // compatibility
        artist: artistName,
        album: a.name, // It is an album itself
        coverArtUrl: realCover || lastFmCover,
        vote_average: parseFloat(fakeScore.toFixed(1)),
        isAlbum: true // custom flag to distinguish in UI
      };
    }));

    const validAlbums = mappedAlbums.filter(a => a.coverArtUrl);
    await redisClient.set(cacheKey, JSON.stringify(validAlbums), { EX: 24 * 60 * 60 });
    return validAlbums;
  }

  /**
   * Get all tracks for a specific album
   */
  static async getAlbumTracklist(artist, album) {
    const apiKey = process.env.LASTFM_API_KEY;
    const cacheKey = `lastfm-tracklist:${artist}:${album}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await axios.get(LASTFM_URL, {
      params: {
        method: 'album.getinfo',
        artist,
        album,
        api_key: apiKey,
        format: 'json',
      },
    });

    let rawTracks = [];
    if (response.data?.album?.tracks?.track) {
      rawTracks = response.data.album.tracks.track;
      if (!Array.isArray(rawTracks)) {
        rawTracks = [rawTracks]; // Sometimes single track is returned as object
      }
    }

    let albumCover = response.data?.album?.image?.find((img) => img.size === 'extralarge')?.['#text'] || '';
    if (albumCover.includes('2a96cbd8b46e442fc41c2b86b821562f')) albumCover = '';
    
    const mappedTracks = await Promise.all(rawTracks.map(async (t) => {
      let realCover = await CoverArtService.getArtwork(t.name, t.artist.name);
      if (realCover === 'NOT_FOUND') realCover = null;

      return {
        id: t.mbid || `${t.name}-${t.artist.name}`.replace(/\s+/g, '-'),
        title: t.name,
        artist: t.artist.name,
        album: album, 
        coverArtUrl: realCover || albumCover,
        vote_average: 8.5,
      };
    }));

    const validTracks = mappedTracks.filter(t => t.coverArtUrl);
    await redisClient.set(cacheKey, JSON.stringify(validTracks), { EX: 24 * 60 * 60 });
    return validTracks;
  }

  // ── Row Specific Endpoints ───────────────────────────────────────────────

  static async getTrending() {
    return this.fetchTracks('chart.gettoptracks');
  }

  static async getByTag(tag) {
    // Instead of top tracks, let's fetch top albums for genres to act as playlists!
    return this.fetchAlbums('tag.gettopalbums', { tag });
  }

  static async getSimilar(artist, track) {
    if (!artist || !track) return [];
    return this.fetchTracks('track.getsimilar', { artist, track });
  }

  /**
   * Search for tracks and albums
   */
  static async search(query) {
    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) {
      throw new Error('LASTFM_API_KEY is missing from the backend .env file');
    }

    const cacheKey = `lastfm-search:${query}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`[LASTFM CACHE HIT] ${cacheKey}`);
      return JSON.parse(cached);
    }

    console.log(`[LASTFM CACHE MISS] Fetching search for ${query}`);
    
    // Fire concurrent requests for track search and album search
    const [trackRes, albumRes] = await Promise.all([
      axios.get(LASTFM_URL, {
        params: { method: 'track.search', track: query, api_key: apiKey, format: 'json', limit: 15 }
      }).catch(() => ({ data: {} })),
      axios.get(LASTFM_URL, {
        params: { method: 'album.search', album: query, api_key: apiKey, format: 'json', limit: 10 }
      }).catch(() => ({ data: {} }))
    ]);

    let rawTracks = trackRes.data?.results?.trackmatches?.track || [];
    let rawAlbums = albumRes.data?.results?.albummatches?.album || [];
    
    if (!Array.isArray(rawTracks)) rawTracks = [rawTracks];
    if (!Array.isArray(rawAlbums)) rawAlbums = [rawAlbums];

    // Normalize Tracks
    const mappedTracks = await Promise.all(rawTracks.map(async (t) => {
      let lastFmCover = t.image?.find((img) => img.size === 'extralarge')?.['#text'] || 
                          t.image?.find((img) => img.size === 'large')?.['#text'] || '';
      if (lastFmCover.includes('2a96cbd8b46e442fc41c2b86b821562f')) lastFmCover = '';
      let realCover = await CoverArtService.getArtwork(t.name, t.artist);
      if (realCover === 'NOT_FOUND') realCover = null;

      let fakeScore = 8.5; 
      if (t.listeners) {
        fakeScore = Math.min(6 + (parseInt(t.listeners) / 100000), 9.9);
      }

      return {
        id: t.mbid || `${t.name}-${t.artist}`.replace(/\s+/g, '-'),
        title: t.name,
        artist: t.artist,
        album: '', 
        coverArtUrl: realCover || lastFmCover,
        vote_average: parseFloat(fakeScore.toFixed(1)),
        isAlbum: false
      };
    }));

    // Normalize Albums
    const mappedAlbums = await Promise.all(rawAlbums.map(async (a) => {
      let lastFmCover = a.image?.find((img) => img.size === 'extralarge')?.['#text'] || 
                          a.image?.find((img) => img.size === 'large')?.['#text'] || '';
      if (lastFmCover.includes('2a96cbd8b46e442fc41c2b86b821562f')) lastFmCover = '';
      let realCover = await CoverArtService.getArtwork(a.name, a.artist);
      if (realCover === 'NOT_FOUND') realCover = null;

      return {
        id: a.mbid || `${a.name}-${a.artist}`.replace(/\s+/g, '-'),
        title: a.name,
        name: a.name,
        artist: a.artist,
        album: a.name,
        coverArtUrl: realCover || lastFmCover,
        vote_average: 7.5,
        isAlbum: true
      };
    }));

    // Filter out albums that have no tracks
    const validAlbums = [];
    await Promise.all(mappedAlbums.map(async (album) => {
      try {
        const tracks = await LastFmService.getAlbumTracklist(album.artist, album.title);
        if (tracks && tracks.length > 0) {
          validAlbums.push(album);
        }
      } catch (err) {
        // ignore
      }
    }));

    // Tracks first, then valid albums, then sort by relevance + popularity
    const combined = [...mappedTracks, ...validAlbums];
    
    const queryLower = query.toLowerCase();
    combined.forEach(item => {
      const titleLower = item.title.toLowerCase();
      // Massive boost for exact match
      if (titleLower === queryLower) {
        item.vote_average += 50;
      } 
      // Moderate boost if it starts with the query
      else if (titleLower.startsWith(queryLower)) {
        item.vote_average += 20;
      }
      // Small boost if it contains the query
      else if (titleLower.includes(queryLower)) {
        item.vote_average += 5;
      }
    });

    combined.sort((a, b) => b.vote_average - a.vote_average);

    // Normalize vote_average back down to max 9.9 for UI display
    combined.forEach(item => {
      if (item.vote_average > 9.9) {
        item.vote_average = 9.9;
      }
    });

    const validCombined = combined.filter(c => c.coverArtUrl);
    await redisClient.set(cacheKey, JSON.stringify(validCombined), { EX: 24 * 60 * 60 });
    return validCombined;
  }
}
