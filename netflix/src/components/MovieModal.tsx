import { useEffect, useState, useRef } from 'react';
import {
  PlayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline';
import { Movie } from '../services/api.config';
import { getImageUrl, api, fetchAlbumTracks } from '../services/movieService';
import { usePlayerStore, useLikeStore } from '../utils/store';
import YouTubeImage from './YouTubeImage';

const ShuffleIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

interface MovieModalProps {
  movie: Movie;
  onClose: () => void;
}

export default function MovieModal({ movie, onClose }: MovieModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { openPlayer } = usePlayerStore();
  const likedIds = useLikeStore((s) => s.likedIds);
  const toggleLike = useLikeStore((s) => s.toggleLike);
  
  const [likeLoading, setLikeLoading] = useState(false);
  const [albumTracks, setAlbumTracks] = useState<Movie[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  useEffect(() => {
    if ((movie as any)._likedSongsTracks) {
      setAlbumTracks((movie as any)._likedSongsTracks);
      setLoadingTracks(false);
      return;
    }
    
    if (movie.isAlbum && movie.artist) {
      setLoadingTracks(true);
      fetchAlbumTracks(movie.artist, movie.title).then((tracks) => {
        setAlbumTracks(tracks);
        setLoadingTracks(false);
      });
    }
  }, [movie]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const coverUrl = getImageUrl(
    movie.backdrop_path || movie.coverArtUrl || movie.poster_path || '',
    'backdrop',
  );

  const displayTitle = movie.title || movie.name || 'Unknown Track';
  const matchScore   = movie.vote_average
    ? `${Math.round(movie.vote_average * 10)}% Match`
    : null;
  const year =
    movie.release_date?.split('-')[0] ||
    movie.first_air_date?.split('-')[0] ||
    null;

  const handlePlay = (trackToPlay?: Movie) => {
    let track = trackToPlay || movie;
    if (!trackToPlay && movie.isAlbum && albumTracks.length > 0) {
      track = albumTracks[0];
    }

    openPlayer({
      id:             String(track.id),
      title:          track.title || track.name || '',
      artist:         track.artist || '',
      album:          track.album  || '',
      coverArtUrl:    track.coverArtUrl || track.poster_path || '',
      youtubeVideoId: track.youtubeVideoId,
    }, albumTracks);
    onClose();
  };

  const handleShuffle = () => {
    if (albumTracks.length === 0) return handlePlay();
    // Create a shuffled copy of the tracklist
    const shuffled = [...albumTracks].sort(() => Math.random() - 0.5);
    const first = shuffled[0];

    openPlayer({
      id:             String(first.id),
      title:          first.title || first.name || '',
      artist:         first.artist || '',
      album:          first.album  || '',
      coverArtUrl:    first.coverArtUrl || first.poster_path || '',
      youtubeVideoId: first.youtubeVideoId,
    }, shuffled);
    onClose();
  };

  /**
   * Heart button handler.
   * - Sends telemetry/like to backend (which also creates "Liked Songs" playlist entry).
   * - For albums: sends all fetched tracks so the backend adds every song.
   * - For singles: sends just the one track.
   */
  const handleHeart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (likeLoading) return;
    
    const id = String(movie.id);
    const wasLiked = !!likedIds[id];
    toggleLike(id, !wasLiked);
    setLikeLoading(true);

    try {
      await api.post('/telemetry/like', {
        track:       movie,
        albumTracks: movie.isAlbum ? albumTracks : [],
        isLike:      !wasLiked,
      });
    } catch (err) {
      console.error('[Heart] failed', err);
      toggleLike(id, wasLiked); // revert
    } finally {
      setLikeLoading(false);
    }
  };

  const handleTrackHeart = async (e: React.MouseEvent, track: Movie) => {
    e.stopPropagation();
    const id = String(track.id);
    const wasLiked = !!likedIds[id];
    toggleLike(id, !wasLiked);

    try {
      await api.post('/telemetry/like', {
        track: track,
        albumTracks: [], // Just liking this individual song
        isLike: !wasLiked,
      });
    } catch (err) {
      console.error('[Heart] failed', err);
      toggleLike(id, wasLiked); // revert
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Scrollable Modal Container */}
      <div className="fixed inset-0 overflow-y-auto pointer-events-none">
        <div className="flex items-center justify-center min-h-full px-4 py-8 pointer-events-auto">
          <div className="relative w-full max-w-3xl animate-slide-up">
            <div className="relative bg-[#181818] rounded-2xl shadow-2xl overflow-hidden">

            {/* Close button */}
            <button
              id="modal-close"
              className="absolute right-4 top-4 z-20 rounded-full bg-[#181818]/90 p-2 hover:bg-[#2a2a2a] transition-colors"
              onClick={onClose}
              aria-label="Close modal"
            >
              <XMarkIcon className="h-5 w-5 text-white" />
            </button>

            {/* Hero image */}
            <div className="relative aspect-video">
              <YouTubeImage
                src={coverUrl}
                alt={displayTitle}
                className="w-full h-full object-cover"
                draggable={false}
                finalFallback="https://placehold.co/300x300/111/1DB954?text=Track"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#181818]/30 to-[#181818]" />

              {/* Overlay content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <h2
                  id="modal-title"
                  className="text-2xl md:text-4xl font-black text-white mb-2 leading-tight drop-shadow-lg"
                >
                  {displayTitle}
                </h2>
                {movie.artist && (
                  <p className="text-[#1DB954] text-base font-semibold mb-4">{movie.artist}</p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Play */}
                  <button
                    id="modal-play"
                    className="flex items-center justify-center bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-white/85 transition-all duration-200 hover:scale-105"
                    onClick={() => handlePlay()}
                  >
                    <PlayIcon className="h-5 w-5 mr-2" />
                    {movie.isAlbum ? 'Play Album' : 'Play'}
                  </button>

                  {movie.isAlbum && albumTracks.length > 1 && (
                    <button
                      id="modal-shuffle"
                      className="flex items-center justify-center rounded-full p-2.5 border-2 border-white/40 text-white hover:border-[#1DB954] hover:text-[#1DB954] transition-all duration-300 hover:scale-110"
                      aria-label="Shuffle Album"
                      onClick={() => handleShuffle()}
                    >
                      <ShuffleIcon className="h-6 w-6" />
                    </button>
                  )}

                  {/* ❤ Heart / Liked Songs button */}
                  <button
                    id="modal-heart"
                    className={`flex items-center justify-center rounded-full p-2.5 border-2 transition-all duration-300 hover:scale-110 ${
                      !!likedIds[String(movie.id)]
                        ? 'border-[#1DB954] bg-[#1DB954]/15 text-[#1DB954]'
                        : 'border-white/40 text-white hover:border-[#1DB954] hover:text-[#1DB954]'
                    } ${likeLoading ? 'opacity-60 cursor-wait' : ''}`}
                    aria-label={!!likedIds[String(movie.id)] ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                    onClick={handleHeart}
                  >
                    {!!likedIds[String(movie.id)] ? (
                      <HeartIcon className="h-6 w-6 text-[#1DB954]" />
                    ) : (
                      <HeartOutlineIcon className="h-6 w-6 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* <div className="p-6 md:p-8"> */}
              {/* Metadata row
              <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
                {matchScore && (
                  <span className="text-[#1DB954] font-bold text-base">{matchScore}</span>
                )}
                {year && <span className="text-white/60">{year}</span>}
                {movie.album && (
                  <span className="text-white/60 border border-white/20 rounded px-2 py-0.5 text-xs">
                    {movie.album}
                  </span>
                )}
                <span className="text-white/40 border border-white/20 rounded px-2 py-0.5 text-xs">HD</span>
              </div>

              Overview / description
              {movie.overview && (
                <p className="text-white/80 text-sm md:text-base leading-relaxed">
                  {movie.overview}
                </p>
              )} */}

              {/* Album Tracklist */}
              {movie.isAlbum && (
                <div className="p-6 md:p-8">
                  <h3 className="text-xl font-bold text-white mb-4">Tracklist</h3>
                  {loadingTracks ? (
                    <div className="flex flex-col gap-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-lg animate-shimmer">
                          <div className="w-6 h-6 rounded bg-white/10"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-white/5 rounded w-1/4"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : albumTracks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {albumTracks.map((track, idx) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-lg cursor-pointer transition-colors group"
                          onClick={() => handlePlay(track)}
                        >
                          <span className="text-white/50 font-bold w-6 text-right group-hover:hidden">
                            {idx + 1}
                          </span>
                          <PlayIcon className="h-5 w-5 text-white hidden group-hover:block w-6" />
                          <div className="flex-1">
                            <h4 className="text-white font-semibold text-base">{track.title}</h4>
                            <p className="text-white/50 text-sm">{track.artist}</p>
                          </div>
                          <button
                            className="p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleTrackHeart(e, track)}
                            aria-label={!!likedIds[String(track.id)] ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                          >
                            {!!likedIds[String(track.id)] ? (
                              <HeartIcon className="h-5 w-5 text-[#1DB954]" />
                            ) : (
                              <HeartOutlineIcon className="h-5 w-5 text-white/50 hover:text-white" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-white/50 italic py-4">No tracklist available for this album.</div>
                  )}
                </div>
              )}
            {/* </div> */}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};