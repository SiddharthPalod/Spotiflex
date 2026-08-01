import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PlayIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { HeartIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline';
import { Movie } from '../services/api.config';
import { searchTracks, getImageUrl, fetchAlbumTracks, api } from '../services/movieService';
import { usePlayerStore, useLikeStore } from '../utils/store';
import MovieModal from '../components/MovieModal';
import MediaCard from '../components/MediaCard';

const Search = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const { openPlayer } = usePlayerStore();
  const likedIds = useLikeStore((s) => s.likedIds);
  const toggleLike = useLikeStore((s) => s.toggleLike);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    
    if (q) {
      setIsLoading(true);
      searchTracks(q).then(async (data) => {
        const processedData = await Promise.all(data.map(async (movie) => {
          if (!movie.coverArtUrl && movie.isAlbum && movie.artist) {
            try {
              const tracks = await fetchAlbumTracks(movie.artist, movie.title);
              if (tracks && tracks.length > 0 && tracks[0].coverArtUrl) {
                return {
                  ...movie,
                  coverArtUrl: tracks[0].coverArtUrl,
                  poster_path: tracks[0].coverArtUrl,
                  backdrop_path: tracks[0].coverArtUrl
                };
              }
            } catch (err) {
              console.error('Failed to fetch album tracks for image fallback', err);
            }
          }
          return movie;
        }));
        setMovies(processedData);
        setIsLoading(false);
        // Fire search telemetry
        api.post('/telemetry/search', { query: q, resultCount: processedData.length }).catch(console.error);
      });
    } else {
      setMovies([]);
    }
  }, [location.search]);
  const getMatchScore = (movie: Movie) => movie.vote_average ? `${Math.round(movie.vote_average * 10)}% Match` : '';

  return (
    <div className="pt-24 min-h-screen pb-32">
      <div className="px-4 md:px-[60px]">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1DB954]"></div>
          </div>
        ) : movies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-10 gap-x-4">
            {movies.map((movie) => {
              const matchStr  = getMatchScore(movie);

              return (
                <div key={movie.id} className="flex-none w-[140px] md:w-[200px]">
                  <MediaCard
                    movie={movie}
                    isLiked={!!likedIds[String(movie.id)]}
                    matchStr={matchStr || undefined}
                    onPlay={(e) => {
                      e.stopPropagation();
                      if (movie.isAlbum) {
                        fetchAlbumTracks(movie.artist!, movie.title)
                          .then((tracks) => {
                            if (tracks?.length) {
                              const first = tracks[0];
                              openPlayer({
                                id: String(first.id), title: first.title || '',
                                artist: first.artist || '', album: first.album || movie.title,
                                coverArtUrl: first.coverArtUrl || movie.coverArtUrl || '',
                                youtubeVideoId: first.youtubeVideoId,
                              }, tracks as any[]);
                            } else {
                              openPlayer(movie as any);
                            }
                          }).catch(() => openPlayer(movie as any));
                      } else {
                        openPlayer(movie as any);
                      }
                    }}
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
                        toggleLike(id, wasLiked);
                      }
                    }}
                    onInfo={(e) => {
                      e.stopPropagation();
                      setSelectedMovie(movie);
                      api.post('/telemetry/click', { track: movie, source: 'search' }).catch(console.error);
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex justify-center items-center h-64 text-gray-400 text-xl">
            No results found.
          </div>
        )}
      </div>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
};

export default Search;
