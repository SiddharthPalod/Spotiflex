// services/api.config.ts
export const SPOTIFY_ROW_LABELS = {
  trending:        'Trending Now',
  netflixOriginals:'Spotiflex Originals',
  topRated:        'Top Rated',
  actionMovies:    'High Energy',
  comedyMovies:    'Feel Good Vibes',
  horrorMovies:    'Dark & Intense',
  romanceMovies:   'Love Songs',
  documentaries:   'Deep Cuts',
} as const;

// Shape returned by the backend /api/mock-trending
export interface Movie {
  id: string | number;
  // Core track fields (from backend)
  title: string;
  artist?: string;
  album?: string;
  youtubeVideoId?: string;   // ← used to build thumbnail + play video
  overview?: string;
  // TMDB-compat aliases (kept so existing component code doesn't break)
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  coverArtUrl?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  isAlbum?: boolean;
}