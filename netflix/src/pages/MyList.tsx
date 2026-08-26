import { useState, useEffect } from 'react';
import { HeartIcon, PlusIcon } from '@heroicons/react/24/solid';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { api, fetchAlbumTracks, createPlaylist } from '../services/movieService';
import { usePlayerStore, useLikeStore, Track } from '../utils/store';
import MovieModal from '../components/MovieModal';
import MediaCard from '../components/MediaCard';
import { Movie } from '../services/api.config';

interface ListItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverArtUrl?: string;
  youtubeVideoId?: string;
  isAlbum: boolean;
  addedAt: string;
}

interface CustomPlaylist {
  id: string;
  name: string;
  title: string;
  createdAt: string;
  tracks: ListItem[];
  coverArtUrl?: string;
  trackCount: number;
}

const MyList = () => {
  const [albums, setAlbums] = useState<ListItem[]>([]);
  const [tracks, setTracks] = useState<ListItem[]>([]);
  const [playlists, setPlaylists] = useState<CustomPlaylist[]>([]);
  const [watchHistory, setWatchHistory] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  // New playlist modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const { openPlayer } = usePlayerStore();
  const likedIds = useLikeStore((s) => s.likedIds);
  const toggleLike = useLikeStore((s) => s.toggleLike);

  const load = () => {
    setIsLoading(true);
    Promise.all([
      api.get('/telemetry/my-list'),
      api.get('/telemetry/watch-history').catch(() => ({ data: { tracks: [] } }))
    ])
      .then(([likesRes, historyRes]) => {
        setAlbums(likesRes.data.albums || []);
        setTracks(likesRes.data.tracks || []);
        setPlaylists(likesRes.data.playlists || []);
        setWatchHistory(historyRes.data.tracks || []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePlay = async (item: ListItem) => {
    if (item.isAlbum) {
      try {
        const albumTracks = await fetchAlbumTracks(item.artist, item.title);
        if (albumTracks?.length) {
          const first = albumTracks[0];
          openPlayer({
            id: String(first.id), title: first.title || '',
            artist: first.artist || '', album: first.album || item.title,
            coverArtUrl: first.coverArtUrl || item.coverArtUrl || '',
            youtubeVideoId: first.youtubeVideoId,
          }, albumTracks as Track[]);
          return;
        }
      } catch { /* fall through */ }
    }
    openPlayer({
      id: item.id, title: item.title,
      artist: item.artist, album: item.album || '',
      coverArtUrl: item.coverArtUrl || '',
      youtubeVideoId: item.youtubeVideoId,
    });
  };

  /** Play all liked songs as one playlist */
  const handlePlayLikedSongs = () => {
    if (!tracks.length) return;
    const playlist: Track[] = tracks.map(t => ({
      id: t.id, title: t.title, artist: t.artist,
      album: t.album || '', coverArtUrl: t.coverArtUrl || '',
      youtubeVideoId: t.youtubeVideoId,
    }));
    openPlayer(playlist[0], playlist);
  };

  /** Play custom playlist */
  const handlePlayCustomPlaylist = (playlist: CustomPlaylist) => {
    if (!playlist.tracks || !playlist.tracks.length) return;
    const queue: Track[] = playlist.tracks.map(t => ({
      id: t.id, title: t.title, artist: t.artist,
      album: t.album || '', coverArtUrl: t.coverArtUrl || '',
      youtubeVideoId: t.youtubeVideoId,
    }));
    openPlayer(queue[0], queue);
  };

  /** Play watch history as one playlist */
  const handlePlayWatchHistory = () => {
    if (!watchHistory.length) return;
    const playlist: Track[] = watchHistory.map(t => ({
      id: t.id, title: t.title, artist: t.artist,
      album: t.album || '', coverArtUrl: t.coverArtUrl || '',
      youtubeVideoId: t.youtubeVideoId,
    }));
    openPlayer(playlist[0], playlist);
  };

  const handleHeart = async (e: React.MouseEvent, item: ListItem) => {
    e.stopPropagation();
    const id = item.id;
    const wasLiked = !!likedIds[id];
    toggleLike(id, !wasLiked);
    try {
      const albumTracks = item.isAlbum ? await fetchAlbumTracks(item.artist, item.title) : [];
      await api.post('/telemetry/like', {
        track: { ...item, isAlbum: item.isAlbum },
        albumTracks,
        isLike: !wasLiked,
      });
      // Refresh list after un-hearting
      if (wasLiked) load();
    } catch {
      toggleLike(id, wasLiked);
    }
  };

  const handleInfo = (e: React.MouseEvent, item: ListItem) => {
    e.stopPropagation();
    setSelectedMovie({
      id: item.id, title: item.title, name: item.title,
      artist: item.artist, album: item.album || item.title,
      coverArtUrl: item.coverArtUrl, isAlbum: item.isAlbum,
    } as Movie);
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const created = await createPlaylist(newPlaylistName.trim());
      setShowCreateModal(false);
      setNewPlaylistName('');
      load();

      // Open new playlist modal immediately so user can add songs
      setSelectedMovie({
        id: created.id,
        title: created.name,
        name: created.name,
        artist: '0 songs',
        coverArtUrl: '',
        isAlbum: true,
        isPlaylist: true,
        playlistId: created.id,
        _playlistTracks: [],
        _onTracksUpdated: load,
      } as any);
    } catch (err) {
      console.error('Failed to create playlist', err);
    } finally {
      setIsCreating(false);
    }
  };

  // ── Virtual "Liked Songs" album card ─────────────────────────────────────
  const likedSongsCard: Movie = {
    id: '__liked-songs__',
    title: 'Liked Songs',
    name: 'Liked Songs',
    artist: `${tracks.length} song${tracks.length !== 1 ? 's' : ''}`,
    coverArtUrl: tracks[0]?.coverArtUrl || 'https://placehold.co/300x300/1a1a2e/1DB954?text=♥',
    isAlbum: true,
  } as Movie;

  // ── Virtual "Watch History" album card ────────────────────────────────────
  const watchHistoryCard: Movie = {
    id: '__watch-history__',
    title: 'Watch History',
    name: 'Watch History',
    artist: `${watchHistory.length} song${watchHistory.length !== 1 ? 's' : ''}`,
    coverArtUrl: watchHistory[0]?.coverArtUrl || 'https://placehold.co/300x300/1a1a2e/FFFFFF?text=⏱️',
    isAlbum: true,
  } as Movie;

  // ── All cards to render: Liked Songs first, Custom Playlists, Watch History, then liked albums ─────────────
  const allCards: Array<{ item: ListItem | CustomPlaylist | null; isLikedSongs?: boolean; isWatchHistory?: boolean; isPlaylist?: boolean }> = [
    ...(tracks.length > 0 ? [{ item: null, isLikedSongs: true }] : []),
    ...playlists.map(p => ({ item: p, isPlaylist: true })),
    ...(watchHistory.length > 0 ? [{ item: null, isWatchHistory: true }] : []),
    ...albums.map(a => ({ item: a })),
  ];

  const isEmpty = !isLoading && albums.length === 0 && tracks.length === 0 && watchHistory.length === 0 && playlists.length === 0;

  return (
    <div className="pt-24 min-h-screen pb-32 bg-[#141414]">
      <div className="px-4 md:px-[60px]">

        {/* Header with Create Playlist Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <HeartIcon className="h-9 w-9 text-[#1DB954]" />
            <div>
              <h1 className="text-white text-4xl font-black tracking-tight">My List</h1>
              <p className="text-white/40 text-sm mt-1">
                {playlists.length > 0 && `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`}
                {playlists.length > 0 && tracks.length > 0 && ' · '}
                {tracks.length > 0 && `${tracks.length} liked song${tracks.length !== 1 ? 's' : ''}`}
                {tracks.length > 0 && albums.length > 0 && ' · '}
                {albums.length > 0 && `${albums.length} liked album${albums.length !== 1 ? 's' : ''}`}
                {(tracks.length > 0 || albums.length > 0 || playlists.length > 0) && watchHistory.length > 0 && ' · '}
                {watchHistory.length > 0 && `${watchHistory.length} recently played`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="self-start sm:self-auto inline-flex items-center gap-2 bg-[#1DB954] text-black font-bold px-5 py-2.5 rounded-full hover:bg-[#1ed760] transition-all hover:scale-105 shadow-lg shadow-[#1DB954]/20"
          >
            <PlusIcon className="h-5 w-5 stroke-[2]" />
            Create Playlist
          </button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[200px] md:h-[240px] rounded-lg animate-shimmer" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <HeartIcon className="h-16 w-16 text-white/10" />
            <p className="text-white/50 text-xl font-semibold">Nothing here yet</p>
            <p className="text-white/30 text-sm text-center max-w-xs">
              Heart any song or create a custom playlist to build your music library.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-2 inline-flex items-center gap-2 bg-white/10 text-white font-bold px-5 py-2.5 rounded-full hover:bg-white/20 transition-all"
            >
              <PlusIcon className="h-5 w-5" />
              Create your first playlist
            </button>
          </div>
        )}

        {/* Card grid */}
        {!isLoading && !isEmpty && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6">
            {allCards.map(({ item, isLikedSongs, isWatchHistory, isPlaylist }) => {
              if (isLikedSongs) {
                // Virtual "Liked Songs" card
                return (
                  <MediaCard
                    key="__liked-songs__"
                    movie={likedSongsCard}
                    isLiked={true}
                    onPlay={(e) => { e.stopPropagation(); handlePlayLikedSongs(); }}
                    onHeart={(e) => e.stopPropagation()} // can't un-heart the whole playlist
                    onInfo={(e) => {
                      e.stopPropagation();
                      setSelectedMovie({
                        ...likedSongsCard,
                        isAlbum: true,
                        _likedSongsTracks: tracks,
                      } as any);
                    }}
                  />
                );
              }

              if (isPlaylist) {
                // Custom User Playlist card
                const p = item as CustomPlaylist;
                const coverArt = p.coverArtUrl || p.tracks?.[0]?.coverArtUrl || 'https://placehold.co/300x300/181818/1DB954?text=♪';
                const movieCard: Movie = {
                  id: p.id,
                  title: p.name,
                  name: p.name,
                  artist: `${p.tracks?.length || 0} song${p.tracks?.length !== 1 ? 's' : ''}`,
                  coverArtUrl: coverArt,
                  isAlbum: true,
                  isPlaylist: true,
                  playlistId: p.id,
                  _playlistTracks: p.tracks || [],
                  _onTracksUpdated: load,
                } as Movie;

                return (
                  <MediaCard
                    key={`playlist-${p.id}`}
                    movie={movieCard}
                    isLiked={true}
                    onPlay={(e) => {
                      e.stopPropagation();
                      handlePlayCustomPlaylist(p);
                    }}
                    onHeart={(e) => e.stopPropagation()}
                    onInfo={(e) => {
                      e.stopPropagation();
                      setSelectedMovie(movieCard);
                    }}
                  />
                );
              }

              if (isWatchHistory) {
                // Virtual "Watch History" card
                return (
                  <MediaCard
                    key="__watch-history__"
                    movie={watchHistoryCard}
                    isLiked={false}
                    onPlay={(e) => { e.stopPropagation(); handlePlayWatchHistory(); }}
                    onHeart={(e) => e.stopPropagation()}
                    onInfo={(e) => {
                      e.stopPropagation();
                      setSelectedMovie({
                        ...watchHistoryCard,
                        isAlbum: true,
                        _likedSongsTracks: watchHistory,
                      } as any);
                    }}
                  />
                );
              }

              // Real album card
              const a = item as ListItem;
              const movie: Movie = {
                id: a.id, title: a.title, name: a.title,
                artist: a.artist, album: a.title,
                coverArtUrl: a.coverArtUrl, isAlbum: true,
              } as Movie;

              return (
                <MediaCard
                  key={a.id}
                  movie={movie}
                  isLiked={!!likedIds[a.id]}
                  onPlay={(e) => { e.stopPropagation(); handlePlay(a); }}
                  onHeart={(e) => handleHeart(e, a)}
                  onInfo={(e) => handleInfo(e, a)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Create Playlist Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => !isCreating && setShowCreateModal(false)}
          />
          <div className="relative bg-[#181818] border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-slide-up z-10">
            <button
              onClick={() => !isCreating && setShowCreateModal(false)}
              className="absolute right-4 top-4 text-white/40 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <h3 className="text-2xl font-bold text-white mb-2">Create Playlist</h3>
            <p className="text-white/40 text-sm mb-6">Give your playlist a title to start adding tracks.</p>

            <form onSubmit={handleCreatePlaylist}>
              <div className="mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                  Playlist Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Late Night Vibes"
                  className="w-full bg-[#242424] text-white px-4 py-3 rounded-xl border border-white/10 focus:border-[#1DB954] focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-base placeholder:text-white/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim() || isCreating}
                  className="bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold px-6 py-2.5 rounded-full text-sm transition-all hover:scale-105 shadow-lg shadow-[#1DB954]/20"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => {
            setSelectedMovie(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default MyList;