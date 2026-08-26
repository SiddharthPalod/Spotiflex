/**
 * MediaCard — the single reusable card used everywhere (home rows, search, my list).
 * Props mirror the Movie interface loosely so existing call-sites stay simple.
 */
import { useRef } from 'react';
import { PlayIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { HeartIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline';
import { Movie } from '../services/api.config';
import { api } from '../services/movieService';
import YouTubeImage from './YouTubeImage';

interface MediaCardProps {
  movie: Movie & { coverArtUrl?: string };
  isLiked?: boolean;
  matchStr?: string;
  className?: string;
  onPlay: (e: React.MouseEvent) => void;
  onHeart: (e: React.MouseEvent) => void;
  onInfo: (e: React.MouseEvent) => void;
}

export default function MediaCard({ movie, isLiked = false, matchStr, className = '', onPlay, onHeart, onInfo }: MediaCardProps) {
  const coverUrl = (movie.coverArtUrl || movie.poster_path || '');
  const hoverStartRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    hoverStartRef.current = Date.now();
  };

  const handleMouseLeave = () => {
    if (hoverStartRef.current) {
      const durationMs = Date.now() - hoverStartRef.current;
      hoverStartRef.current = null;
      // If user hovered for more than 2 seconds without interacting, log it
      if (durationMs > 2000) {
        api.post('/telemetry/hover', { track: movie, durationMs }).catch(console.error);
      }
    }
  };

  return (
    <div 
      className={`group/item relative track-card-glow ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Card image area */}
      <div
        className="relative h-[200px] md:h-[240px] rounded-lg overflow-hidden transition-all duration-300 group-hover/item:scale-105 cursor-pointer"
        onClick={onPlay}
      >
        <YouTubeImage
          src={coverUrl}
          alt={movie.title || movie.name || ''}
          className="w-full h-full object-cover transition-transform duration-500"
          draggable={false}
          finalFallback="https://placehold.co/300x300/111/1DB954?text=Track"
        />

        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />

        {/* Slide-up info panel */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/90 transform translate-y-full group-hover/item:translate-y-0 transition-transform duration-300">

          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-2 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 delay-75">
            {/* Play */}
            <button
              className="flex items-center justify-center bg-white rounded-full p-1.5 hover:bg-white/80 transition-all duration-200 hover:scale-110"
              onClick={onPlay}
              aria-label={`Play ${movie.title}`}
            >
              <PlayIcon className="h-4 w-4 text-black" />
            </button>

            {/* Heart */}
            <button
              className={`flex items-center justify-center border-2 rounded-full p-1.5 transition-all duration-200 hover:scale-110 ${
                isLiked
                  ? 'border-[#1DB954] text-[#1DB954]'
                  : 'border-white/40 text-white hover:border-[#1DB954] hover:text-[#1DB954]'
              }`}
              aria-label={isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
              onClick={onHeart}
            >
              {isLiked
                ? <HeartIcon className="h-3.5 w-3.5 fill-current" />
                : <HeartOutlineIcon className="h-3.5 w-3.5" />}
            </button>

            {/* Info */}
            <button
              className="ml-auto flex items-center justify-center border-2 border-[#2a2a2a] bg-[#2a2a2a]/80 hover:bg-[#2a2a2a] rounded-full p-1.5 transition-all duration-200 opacity-0 group-hover/item:opacity-100 hover:scale-110"
              onClick={onInfo}
              aria-label="More info"
            >
              <InformationCircleIcon className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Match score */}
          {matchStr && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white mb-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 delay-100">
              <span className="text-[#1DB954] font-semibold">{matchStr}</span>
            </div>
          )}

          {/* Title + artist */}
          <div className="opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 delay-150">
            <p className="text-white text-xs font-semibold leading-tight truncate">
              {movie.title || movie.name}
            </p>
            {movie.artist && (
              <p className="text-[#1DB954] text-[11px] truncate mt-0.5">{movie.artist}</p>
            )}
            {movie.album && !movie.artist && (
              <p className="text-gray-400 text-[11px] truncate mt-0.5">{movie.album}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
