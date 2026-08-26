import { useState } from 'react';
import MovieRow from '../components/MovieRow';
import MovieModal from '../components/MovieModal';
import { Movie } from '../services/api.config';

const TVShows = () => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  return (
    <div className="pt-24 min-h-screen pb-32">
      <div className="px-4 md:px-0">
        <h1 className="text-white text-4xl font-black mb-8 px-4 md:px-[60px] tracking-tight">Albums</h1>
        <MovieRow title="🔥 Trending Albums"      endpoint="tag-albums?tag=pop"       onMovieClick={setSelectedMovie} />
        <MovieRow title="🎸 Rock & Alternative"   endpoint="tag-albums?tag=rock"      onMovieClick={setSelectedMovie} />
        <MovieRow title="🎤 Hip Hop Essentials"   endpoint="tag-albums?tag=hiphop"    onMovieClick={setSelectedMovie} />
        <MovieRow title="🎧 Electronic Vibes"     endpoint="tag-albums?tag=electronic"onMovieClick={setSelectedMovie} />
        <MovieRow title="🎷 Jazz Classics"        endpoint="tag-albums?tag=jazz"      onMovieClick={setSelectedMovie} />
      </div>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
};

export default TVShows;