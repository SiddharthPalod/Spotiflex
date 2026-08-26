import { useEffect, useState, useRef } from 'react';
import {
  PlayIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline';
import { Movie } from '../services/api.config';
import { 
  api, 
  fetchAlbumTracks, 
  searchTracks, 
  addTrackToPlaylist, 
  removeTrackFromPlaylist 
} from '../services/movieService';
import { usePlayerStore, useLikeStore, Track } from '../utils/store';
import YouTubeImage from './YouTubeImage';

const ShuffleIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const MusicNoteIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
  </svg>
);

interface MovieModalProps {
  movie: Movie;
  onClose: () => void;
}

export default function MovieModal({ movie, onClose }: MovieModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { openPlayer } = usePlayerStore();
  const likedIds = useLikeStore((s) => s.likedIds);
  const toggleLike = useLikeStore((s) => s.toggleLike);
  
  const [likeLoading, setLikeLoading] = useState(false);
  const [albumTracks, setAlbumTracks] = useState<Movie[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Playlist specific states
  const isPlaylist = !!movie.isPlaylist;
  const playlistId = movie.playlistId || String(movie.id);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [songSearchResults, setSongSearchResults] = useState<Movie[]>([]);
  const [searchingSongs, setSearchingSongs] = useState(false);
  const [addingTrackId, setAddingTrackId] = useState<string | number | null>(null);
  const [removingTrackId, setRemovingTrackId] = useState<string | number | null>(null);

  useEffect(() => {
    if ((movie as any)._likedSongsTracks) {
      setAlbumTracks((movie as any)._likedSongsTracks);
      setLoadingTracks(false);
      return;
    }

    if ((movie as any)._playlistTracks) {
      setAlbumTracks((movie as any)._playlistTracks);
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

  // Focus search input when Add Songs is toggled
  useEffect(() => {
    if (showAddSongs) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showAddSongs]);

  // Search songs only (excludes albums & playlists)
  useEffect(() => {
    if (!showAddSongs || !songSearchQuery.trim()) {
      setSongSearchResults([]);
      setSearchingSongs(false);
      return;
    }

    setSearchingSongs(true);
    const timer = setTimeout(() => {
      searchTracks(songSearchQuery.trim(), 'tracks')
        .then((results) => {
          const songsOnly = results.filter(r => !r.isAlbum && !r.isPlaylist);
          setSongSearchResults(songsOnly);
        })
        .catch(console.error)
        .finally(() => setSearchingSongs(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [songSearchQuery, showAddSongs]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const firstValidTrackArt = albumTracks.find(t => t.coverArtUrl && !t.coverArtUrl.includes('placehold.co'))?.coverArtUrl;
  const rawCover = movie.backdrop_path || movie.coverArtUrl || movie.poster_path || firstValidTrackArt || '';
  const hasValidCover = Boolean(rawCover && !rawCover.includes('placehold.co'));
  const coverUrl = rawCover;

  const displayTitle = movie.title || movie.name || 'Unknown Playlist';

  const toTrackQueue = (tracks: Movie[]): Track[] => {
    return tracks.map(t => ({
      id:             String(t.id),
      title:          t.title || t.name || '',
      artist:         t.artist || '',
      album:          t.album  || '',
      coverArtUrl:    t.coverArtUrl || t.poster_path || '',
      youtubeVideoId: t.youtubeVideoId,
    }));
  };

  const handlePlay = (trackToPlay?: Movie) => {
    let track = trackToPlay || movie;
    if (!trackToPlay && (movie.isAlbum || isPlaylist) && albumTracks.length > 0) {
      track = albumTracks[0];
    }

    const queue = toTrackQueue(albumTracks.length > 0 ? albumTracks : [track]);

    openPlayer({
      id:             String(track.id),
      title:          track.title || track.name || '',
      artist:         track.artist || '',
      album:          track.album  || '',
      coverArtUrl:    track.coverArtUrl || track.poster_path || '',
      youtubeVideoId: track.youtubeVideoId,
    }, queue);
    onClose();
  };

  const handleShuffle = () => {
    if (albumTracks.length === 0) return handlePlay();
    const shuffledTracks = [...albumTracks].sort(() => Math.random() - 0.5);
    const queue = toTrackQueue(shuffledTracks);
    const first = queue[0];

    openPlayer(first, queue);
    onClose();
  };

  const handleHeart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (likeLoading || isPlaylist) return;
    
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
      toggleLike(id, wasLiked);
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
        albumTracks: [],
        isLike: !wasLiked,
      });
    } catch (err) {
      console.error('[Heart] failed', err);
      toggleLike(id, wasLiked);
    }
  };

  const handleAddTrack = async (track: Movie) => {
    if (addingTrackId) return;
    setAddingTrackId(track.id);
    try {
      const updated = await addTrackToPlaylist(playlistId, track);
      if (updated?.tracks) {
        setAlbumTracks(updated.tracks);
      } else {
        setAlbumTracks((prev) => [...prev, track]);
      }
      movie._onTracksUpdated?.();
    } catch (err) {
      console.error('[AddTrack] failed', err);
    } finally {
      setAddingTrackId(null);
    }
  };

  const handleRemoveTrack = async (e: React.MouseEvent, track: Movie) => {
    e.stopPropagation();
    if (removingTrackId) return;
    setRemovingTrackId(track.id);
    try {
      await removeTrackFromPlaylist(playlistId, track.id);
      setAlbumTracks((prev) => prev.filter((t) => String(t.id) !== String(track.id)));
      movie._onTracksUpdated?.();
    } catch (err) {
      console.error('[RemoveTrack] failed', err);
    } finally {
      setRemovingTrackId(null);
    }
  };

  const isTrackInPlaylist = (trackId: string | number) => {
    return albumTracks.some(t => String(t.id) === String(trackId));
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

            {/* Hero image / banner */}
            <div className="relative aspect-video bg-gradient-to-br from-[#1a3a25] via-[#122018] to-[#181818] flex items-center justify-center overflow-hidden">
              {hasValidCover ? (
                <YouTubeImage
                  src={coverUrl}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1DB954]/25 via-[#181818] to-[#121212]">
                  <div className="w-20 h-20 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center shadow-2xl mb-4">
                    <MusicNoteIcon className="w-10 h-10 text-[#1DB954]" />
                  </div>
                </div>
              )}
              
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#181818]/50 to-[#181818]" />

              {/* Overlay content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <h2
                  id="modal-title"
                  className="text-2xl md:text-4xl font-black text-white mb-2 leading-tight drop-shadow-lg"
                >
                  {displayTitle}
                </h2>
                <p className="text-[#1DB954] text-base font-semibold mb-4">
                  {isPlaylist 
                    ? `${albumTracks.length} song${albumTracks.length !== 1 ? 's' : ''} · Custom Playlist` 
                    : movie.artist || (movie.isAlbum ? `${albumTracks.length} tracks` : '')}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Play */}
                  <button
                    id="modal-play"
                    disabled={albumTracks.length === 0 && (movie.isAlbum || isPlaylist)}
                    className={`flex items-center justify-center bg-white text-black px-6 py-2.5 rounded-full font-bold transition-all duration-200 ${
                      albumTracks.length === 0 && (movie.isAlbum || isPlaylist)
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-white/85 hover:scale-105'
                    }`}
                    onClick={() => handlePlay()}
                  >
                    <PlayIcon className="h-5 w-5 mr-2" />
                    {isPlaylist ? 'Play Playlist' : movie.isAlbum ? 'Play Album' : 'Play'}
                  </button>

                  {/* Shuffle Button */}
                  {(movie.isAlbum || isPlaylist) && (
                    <button
                      id="modal-shuffle"
                      className="flex items-center justify-center rounded-full p-2.5 border-2 border-white/40 text-white hover:border-[#1DB954] hover:text-[#1DB954] transition-all duration-300 hover:scale-110"
                      aria-label="Shuffle"
                      onClick={() => handleShuffle()}
                    >
                      <ShuffleIcon className="h-6 w-6" />
                    </button>
                  )}

                  {/* Add Songs button for custom playlists */}
                  {isPlaylist && (
                    <button
                      id="modal-add-songs-toggle"
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border-2 font-bold transition-all duration-300 hover:scale-105 ${
                        showAddSongs
                          ? 'border-[#1DB954] bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20'
                          : 'border-white/40 text-white hover:border-[#1DB954] hover:text-[#1DB954]'
                      }`}
                      onClick={() => setShowAddSongs(!showAddSongs)}
                    >
                      <PlusIcon className={`h-5 w-5 transition-transform duration-200 ${showAddSongs ? 'rotate-45' : ''}`} />
                      <span>{showAddSongs ? 'Close Search' : 'Add Songs'}</span>
                    </button>
                  )}

                  {/* Heart / Liked Songs button (for albums & singles) */}
                  {!isPlaylist && (
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
                  )}
                </div>
              </div>
            </div>

            {/* ── Add Songs Search Section (for Playlists) ── */}
            {isPlaylist && showAddSongs && (
              <div className="p-6 md:p-8 border-b border-white/10 bg-[#1a1a1a]/95 backdrop-blur-md animate-slide-down">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MagnifyingGlassIcon className="h-5 w-5 text-[#1DB954]" />
                    Find songs to add
                  </h3>
                  <span className="text-xs text-white/40 font-medium">Songs only · Albums excluded</span>
                </div>

                {/* Netflix-style Search Input */}
                <div className="relative mb-4">
                  <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={songSearchQuery}
                    onChange={(e) => setSongSearchQuery(e.target.value)}
                    placeholder="Search for songs or artists..."
                    className="w-full bg-[#2a2a2a] text-white pl-11 pr-10 py-3 rounded-xl border border-white/10 focus:border-[#1DB954] focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-sm md:text-base placeholder:text-white/30 transition-colors"
                  />
                  {songSearchQuery && (
                    <button
                      onClick={() => setSongSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white rounded-full hover:bg-white/10"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Search Loading Indicator */}
                {searchingSongs && (
                  <div className="flex items-center justify-center py-6 gap-3 text-[#1DB954]">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                    <span className="text-sm font-medium">Searching songs...</span>
                  </div>
                )}

                {/* Search Results in Matching Episode-Style Row Layout */}
                {!searchingSongs && songSearchResults.length > 0 && (
                  <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                    {songSearchResults.map((track, idx) => {
                      const alreadyAdded = isTrackInPlaylist(track.id);
                      const isAdding = addingTrackId === track.id;

                      return (
                        <div
                          key={track.id || idx}
                          className="flex items-center gap-4 p-2.5 hover:bg-white/10 rounded-xl transition-colors group"
                        >
                          <span className="text-white/40 font-bold w-6 text-right text-sm">
                            {idx + 1}
                          </span>

                          <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-[#242424] border border-white/5 flex items-center justify-center">
                            {track.coverArtUrl ? (
                              <img
                                src={track.coverArtUrl}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <MusicNoteIcon className="w-5 h-5 text-[#1DB954]/60" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold text-sm truncate group-hover:text-[#1DB954] transition-colors">
                              {track.title || track.name}
                            </h4>
                            <p className="text-white/50 text-xs truncate">{track.artist}</p>
                          </div>

                          <button
                            disabled={alreadyAdded || isAdding}
                            onClick={() => handleAddTrack(track)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                              alreadyAdded
                                ? 'bg-white/10 text-[#1DB954] cursor-default'
                                : 'bg-white text-black hover:bg-[#1DB954] hover:text-black active:scale-95'
                            }`}
                          >
                            {alreadyAdded ? (
                              <>
                                <CheckIcon className="h-3.5 w-3.5 stroke-[3]" />
                                Added
                              </>
                            ) : isAdding ? (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-black"></div>
                            ) : (
                              <>
                                <PlusIcon className="h-3.5 w-3.5 stroke-[3]" />
                                Add
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* No results message */}
                {!searchingSongs && songSearchQuery.trim() && songSearchResults.length === 0 && (
                  <p className="text-white/40 text-sm text-center py-4">No songs found for "{songSearchQuery}".</p>
                )}
              </div>
            )}

            {/* ── Episode-Style Tracklist ── */}
            {(movie.isAlbum || isPlaylist) && (
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">
                    Tracklist
                  </h3>
                  <span className="text-white/40 text-sm font-medium">
                    {albumTracks.length} song{albumTracks.length !== 1 ? 's' : ''}
                  </span>
                </div>

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
                  <div className="flex flex-col gap-1.5">
                    {albumTracks.map((track, idx) => (
                      <div
                        key={track.id || idx}
                        className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-xl cursor-pointer transition-colors group"
                        onClick={() => handlePlay(track)}
                      >
                        {/* Track Number / Play Icon */}
                        <span className="text-white/40 font-bold w-6 text-right group-hover:hidden text-sm">
                          {idx + 1}
                        </span>
                        <PlayIcon className="h-5 w-5 text-white hidden group-hover:block w-6" />

                        {/* Song Cover Thumbnail (matching episode style) */}
                        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-[#242424] border border-white/5 flex items-center justify-center">
                          {track.coverArtUrl ? (
                            <img
                              src={track.coverArtUrl}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <MusicNoteIcon className="w-5 h-5 text-[#1DB954]/60" />
                          )}
                        </div>

                        {/* Title & Artist */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-semibold text-sm md:text-base truncate group-hover:text-[#1DB954] transition-colors">
                            {track.title || track.name}
                          </h4>
                          <p className="text-white/50 text-xs md:text-sm truncate">{track.artist}</p>
                        </div>

                        {/* Individual Track Heart */}
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

                        {/* Delete from Custom Playlist */}
                        {isPlaylist && (
                          <button
                            className="p-2 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                            onClick={(e) => handleRemoveTrack(e, track)}
                            title="Remove song from playlist"
                            aria-label="Remove song"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 bg-white/5 rounded-2xl border border-dashed border-white/10">
                    <p className="text-white/60 font-semibold mb-2">This playlist is empty</p>
                    <p className="text-white/40 text-xs md:text-sm mb-4">Search and add songs to build your custom playlist.</p>
                    {isPlaylist && !showAddSongs && (
                      <button
                        onClick={() => setShowAddSongs(true)}
                        className="inline-flex items-center gap-2 bg-[#1DB954] text-black font-bold px-5 py-2 rounded-full text-sm hover:scale-105 transition-transform"
                      >
                        <PlusIcon className="h-4 w-4 stroke-[3]" />
                        Add Songs Now
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}