import { useState, useEffect } from 'react';
import { PlayIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import MovieRow from '../components/MovieRow';
import MovieModal from '../components/MovieModal';

import { Movie } from '../services/api.config';
import { fetchTracks, getImageUrl, fetchHomeRows } from '../services/movieService';
import { usePlayerStore } from '../utils/store';
import YouTubeImage from '../components/YouTubeImage';

const Home = () => {
  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);
  const [homeRows, setHomeRows] = useState<{title: string, endpoint: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const { openPlayer } = usePlayerStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tracks, rows] = await Promise.all([
          fetchTracks('trending'),
          fetchHomeRows()
        ]);
        if (tracks.length > 0) {
          const random = tracks[Math.floor(Math.random() * tracks.length)];
          setHeroMovie(random);
        }
        setHomeRows(rows);
      } catch (error) {
        console.error('Error loading home data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#141414] animate-shimmer" />
    );
  }

  const heroCover = heroMovie
    ? getImageUrl(heroMovie.backdrop_path || heroMovie.coverArtUrl || heroMovie.poster_path || '')
    : '';

  const handleHeroPlay = () => {
    if (!heroMovie) return;
    openPlayer({
      id:             String(heroMovie.id),
      title:          heroMovie.title || heroMovie.name || '',
      artist:         heroMovie.artist || '',
      album:          heroMovie.album  || '',
      coverArtUrl:    heroMovie.coverArtUrl || heroMovie.poster_path || '',
      youtubeVideoId: heroMovie.youtubeVideoId,
    });
  };

  return (
    <div className="relative min-h-screen bg-[#141414] overflow-x-hidden">
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <div className="relative min-h-[500px] h-[56.25vw] max-h-[85vh] w-full cursor-pointer flex flex-col justify-end pb-24 sm:pb-28 md:pb-32" onClick={handleHeroPlay}>
        {/* Background gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#141414]/30 to-[#141414] z-10" />

        {/* Hero cover art */}
        {heroCover && (
          <YouTubeImage
            src={heroCover}
            alt={heroMovie?.title || heroMovie?.name}
            className="absolute inset-0 w-full h-full object-cover object-center"
            hideOnFail={true}
          />
        )}

        {/* Hero content */}
        <div className="relative z-20 px-4 md:px-[60px] max-w-[90%] sm:max-w-[75%] md:max-w-[60%] lg:max-w-[50%] animate-slide-up">
          {/* Now Playing chip */}
          {heroMovie && (
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                Spotiflex Pick
              </span>
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 leading-tight drop-shadow-2xl line-clamp-2 break-words">
            {heroMovie?.title || heroMovie?.name}
          </h1>

          {heroMovie?.artist && (
            <p className="text-[#1DB954] text-base sm:text-lg md:text-xl font-semibold mb-3 truncate">
              {heroMovie.artist}
            </p>
          )}

          {heroMovie?.overview && (
            <p className="text-white/80 text-xs sm:text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-5 leading-relaxed">
              {heroMovie.overview}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              id="hero-play"
              className="flex items-center justify-center bg-white text-black px-6 sm:px-8 py-2.5 rounded-full font-bold text-sm sm:text-base hover:bg-white/85 transition-all duration-200 hover:scale-105 shadow-lg"
              onClick={handleHeroPlay}
            >
              <PlayIcon className="h-5 w-5 mr-2" />
              Play
            </button>
            <button
              id="hero-more-info"
              className="flex items-center justify-center bg-white/20 backdrop-blur-sm text-white px-6 sm:px-8 py-2.5 rounded-full font-semibold text-sm sm:text-base hover:bg-white/30 transition-all duration-200 border border-white/20"
              onClick={() => heroMovie && setSelectedMovie(heroMovie)}
            >
              <InformationCircleIcon className="h-5 w-5 mr-2" />
              More Info
            </button>
          </div>
        </div>
      </div>

      {/* ── Music Rows ───────────────────────────────────────────────────── */}
      <div className="relative z-20 pb-32">
        {homeRows.length > 0 ? (
          <>
            <MovieRow
              title={homeRows[0].title}
              endpoint={homeRows[0].endpoint}
              onMovieClick={setSelectedMovie}
            />
            
            {/* Spotiflex Picks: Contextual to Hero Track */}
            {heroMovie && (
              <MovieRow
                title="Spotiflex Picks"
                endpoint={`recommendations/spotiflex-picks?artist=${encodeURIComponent(heroMovie.artist || '')}&title=${encodeURIComponent(heroMovie.title || heroMovie.name || '')}`}
                onMovieClick={setSelectedMovie}
              />
            )}

            {homeRows.slice(1).map((row, i) => (
              <MovieRow
                key={`dynamic-row-${i}`}
                title={row.title}
                endpoint={row.endpoint}
                onMovieClick={setSelectedMovie}
              />
            ))}
          </>
        ) : (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#1DB954] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* ── Track Detail Modal ───────────────────────────────────────────── */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
        />
      )}

    </div>
  );
};

export default Home;