import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Movie } from '../services/api.config';
import { fetchTracks, getImageUrl, fetchAlbumTracks, api } from '../services/movieService';
import { usePlayerStore, useLikeStore, Track } from '../utils/store';
import MediaCard from './MediaCard';

interface MovieRowProps {
  title: string;
  endpoint: string;
  onMovieClick?: (movie: Movie) => void;
}

const MovieRow = ({ title, endpoint, onMovieClick }: MovieRowProps) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [hoveredMovie, setHoveredMovie] = useState<Movie | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { openPlayer } = usePlayerStore();
  const likedIds = useLikeStore((s) => s.likedIds);
  const toggleLike = useLikeStore((s) => s.toggleLike);

  useEffect(() => {
    const loadMovies = async () => {
      try {
        const data = await fetchTracks(endpoint);
        setMovies(data);
      } catch (error) {
        console.error('Error loading tracks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadMovies();
  }, [endpoint]);

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    const slider = sliderRef.current;
    if (!slider) return;
    const scrollAmount = slider.clientWidth * 0.75;
    slider.scrollTo({
      left: direction === 'left'
        ? slider.scrollLeft - scrollAmount
        : slider.scrollLeft + scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  const handleSliderScroll = useCallback(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    setShowLeftArrow(slider.scrollLeft > 0);
    setShowRightArrow(slider.scrollLeft + slider.clientWidth < slider.scrollWidth - 1);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - sliderRef.current.offsetLeft);
    setScrollLeft(sliderRef.current.scrollLeft);
    setDragStartTime(Date.now());
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    sliderRef.current.scrollLeft = scrollLeft - (x - startX) * 2;
  };

  const handleMouseUp = (_e: React.MouseEvent<HTMLDivElement>, movie: Movie) => {
    setIsDragging(false);
    if (Date.now() - dragStartTime < 150 && onMovieClick) {
      onMovieClick(movie);
      // Fire click telemetry when user opens the modal
      api.post('/telemetry/click', { track: movie, source: 'browse' }).catch(console.error);
    }
  };

  const handleMouseEnter = (movie: Movie) => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredMovie(movie);
    }, 600);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredMovie(null);
  };

  useEffect(() => {
    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener('scroll', handleSliderScroll);
      handleSliderScroll();
    }
    return () => { if (slider) slider.removeEventListener('scroll', handleSliderScroll); };
  }, [movies, handleSliderScroll]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mb-10">
        <h2 className="text-white text-xl md:text-2xl font-bold mb-4 px-4 md:px-[60px]">{title}</h2>
        <div className="flex space-x-3 px-4 md:px-[60px] overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex-none w-[140px] md:w-[160px] h-[200px] md:h-[240px] rounded-lg animate-shimmer"
            />
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0) return null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCoverUrl = (movie: Movie) =>
    getImageUrl(movie.coverArtUrl || movie.poster_path || '');

  const getMatchScore = (movie: Movie) =>
    movie.vote_average
      ? `${Math.round(movie.vote_average * 10)}% Match`
      : '';

  const handleRowPlay = async (e: React.MouseEvent, movie: Movie, coverUrl: string) => {
    e.stopPropagation();
    
    if (movie.isAlbum && movie.artist) {
      try {
        // Fetch the album tracks first so we can play the first song and have the playlist for Up Next
        const tracks = await fetchAlbumTracks(movie.artist, movie.title);
        if (tracks && tracks.length > 0) {
          openPlayer({
            id: String(tracks[0].id),
            title: tracks[0].title || '',
            artist: tracks[0].artist || '',
            album: tracks[0].album || '',
            coverArtUrl: tracks[0].coverArtUrl || coverUrl,
            youtubeVideoId: tracks[0].youtubeVideoId,
          }, tracks as any as Track[]);
          return;
        }
      } catch (err) {
        console.error("Failed to fetch album tracks for quick play", err);
      }
    }
    
    // Fallback for regular tracks or if album fetch fails
    openPlayer({
      id:             String(movie.id),
      title:          movie.title || movie.name || '',
      artist:         movie.artist || '',
      album:          movie.album  || '',
      coverArtUrl:    coverUrl,
      youtubeVideoId: movie.youtubeVideoId,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="group/row mb-10">
      <h2 className="text-white text-xl md:text-2xl font-bold mb-4 px-4 md:px-[60px] tracking-tight">
        {title}
      </h2>

      <div className="relative">
        {/* Left chevron */}
        {showLeftArrow && (
          <button
            className="absolute left-0 top-0 bottom-0 z-50 flex items-center justify-center w-10 md:w-14 bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
            onClick={() => handleScroll('left')}
            aria-label="Scroll left"
          >
            <ChevronLeftIcon className="h-7 w-7 text-white drop-shadow-lg" />
          </button>
        )}

        {/* Slider container */}
        <div className="relative px-4 md:px-[60px] overflow-hidden">
          <div
            ref={sliderRef}
            className={`flex gap-2 md:gap-3 overflow-x-scroll scroll-smooth scrollbar-hide py-4 ${
              isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setIsDragging(false)}
          >
            {movies.map((movie) => {
              const isHovered = hoveredMovie?.id === movie.id;
              const coverUrl  = getCoverUrl(movie);
              const matchStr  = getMatchScore(movie);

              return (
                <div
                  key={movie.id}
                  className="flex-none w-[140px] md:w-[200px]"
                  draggable={false}
                  onMouseUp={(e) => handleMouseUp(e, movie)}
                  onMouseEnter={() => handleMouseEnter(movie)}
                  onMouseLeave={handleMouseLeave}
                >
                  <MediaCard
                    movie={movie}
                    isLiked={!!likedIds[String(movie.id)]}
                    matchStr={matchStr || undefined}
                    className={isHovered ? 'scale-110 z-50 shadow-2xl shadow-black/60' : ''}
                    onPlay={(e) => handleRowPlay(e, movie, coverUrl)}
                    onHeart={async (e) => {
                      e.stopPropagation();
                      const id = String(movie.id);
                      const wasLiked = !!likedIds[id];
                      toggleLike(id, !wasLiked);
                      try {
                        const albumTracks = (movie.isAlbum && movie.artist)
                          ? await fetchAlbumTracks(movie.artist, movie.title)
                          : [];
                        await api.post('/telemetry/like', {
                          track: movie,
                          albumTracks,
                          isLike: !wasLiked,
                        });
                      } catch (err) {
                        console.error('[Heart] failed', err);
                        toggleLike(id, wasLiked); // revert
                      }
                    }}
                    onInfo={(e) => {
                      e.stopPropagation();
                      onMovieClick?.(movie);
                      api.post('/telemetry/click', { track: movie, source: 'browse' }).catch(console.error);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right chevron */}
        {showRightArrow && (
          <button
            className="absolute right-0 top-0 bottom-0 z-50 flex items-center justify-center w-10 md:w-14 bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
            onClick={() => handleScroll('right')}
            aria-label="Scroll right"
          >
            <ChevronRightIcon className="h-7 w-7 text-white drop-shadow-lg" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MovieRow;