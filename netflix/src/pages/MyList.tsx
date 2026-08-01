import { useState, useEffect } from 'react';
import { HeartIcon } from '@heroicons/react/24/solid';
import { api, fetchAlbumTracks } from '../services/movieService';
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

const MyList = () => {
  const [albums, setAlbums] = useState<ListItem[]>([]);
  const [tracks, setTracks] = useState<ListItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
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

  // ── Virtual "Liked Songs" album card ─────────────────────────────────────
  // Uses the cover of the most recently liked track, or a gradient placeholder
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

  // ── All cards to render: Liked Songs first, then Watch History, then liked albums ─────────────
  const allCards: Array<{ item: ListItem | null; isLikedSongs?: boolean; isWatchHistory?: boolean }> = [
    ...(tracks.length > 0 ? [{ item: null, isLikedSongs: true }] : []),
    ...(watchHistory.length > 0 ? [{ item: null, isWatchHistory: true }] : []),
    ...albums.map(a => ({ item: a })),
  ];

  const isEmpty = !isLoading && albums.length === 0 && tracks.length === 0 && watchHistory.length === 0;

  return (
    <div className="pt-24 min-h-screen pb-32 bg-[#141414]">
      <div className="px-4 md:px-[60px]">

        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <HeartIcon className="h-9 w-9 text-[#1DB954]" />
          <div>
            <h1 className="text-white text-4xl font-black tracking-tight">My List</h1>
            <p className="text-white/40 text-sm mt-1">
              {tracks.length > 0 && `${tracks.length} liked song${tracks.length !== 1 ? 's' : ''}`}
              {tracks.length > 0 && albums.length > 0 && ' · '}
              {albums.length > 0 && `${albums.length} liked album${albums.length !== 1 ? 's' : ''}`}
              {(tracks.length > 0 || albums.length > 0) && watchHistory.length > 0 && ' · '}
              {watchHistory.length > 0 && `${watchHistory.length} recently played`}
            </p>
          </div>
        </div>

        {/* Loading skeleton — same card dimensions as home */}
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
              Heart any song or album to instantly add it to your list.
            </p>
          </div>
        )}

        {/* Card grid — identical to home / search */}
        {!isLoading && !isEmpty && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6">
            {allCards.map(({ item, isLikedSongs, isWatchHistory }) => {
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
                      // Build a fake album movie so the modal shows the tracklist
                      setSelectedMovie({
                        ...likedSongsCard,
                        isAlbum: true,
                        // Pass tracks as album tracklist via override
                        _likedSongsTracks: tracks,
                      } as any);
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
                    onHeart={(e) => e.stopPropagation()} // can't like the watch history playlist
                    onInfo={(e) => {
                      e.stopPropagation();
                      setSelectedMovie({
                        ...watchHistoryCard,
                        isAlbum: true,
                        // Pass tracks as album tracklist via override
                        _likedSongsTracks: watchHistory,
                      } as any);
                    }}
                  />
                );
              }

              // Real album card
              const a = item!;
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

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
        />
      )}
    </div>
  );
};

export default MyList;