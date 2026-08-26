import { useState } from 'react';
import MovieRow from '../components/MovieRow';
import MovieModal from '../components/MovieModal';
import { Movie } from '../services/api.config';

const Movies = () => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  return (
    <div className="pt-24 min-h-screen pb-32">
      <div className="px-4 md:px-0">
        <h1 className="text-white text-4xl font-black mb-8 px-4 md:px-[60px] tracking-tight">Songs</h1>
        <MovieRow title="🏆 Top Global Hits"     endpoint="trending"                    onMovieClick={setSelectedMovie} />
        <MovieRow title="⚡ High Energy Workout" endpoint="tag-tracks?tag=workout"      onMovieClick={setSelectedMovie} />
        <MovieRow title="😊 Feel Good Vibes"    endpoint="tag-tracks?tag=happy"        onMovieClick={setSelectedMovie} />
        <MovieRow title="💕 Love Songs"         endpoint="tag-tracks?tag=romance"      onMovieClick={setSelectedMovie} />
        <MovieRow title="🌙 Chill & Acoustic"    endpoint="tag-tracks?tag=acoustic"     onMovieClick={setSelectedMovie} />
        <MovieRow title="🎵 Hindi Chartbusters" endpoint="tag-tracks?tag=hindi"        onMovieClick={setSelectedMovie} />
      </div>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
      {/* AudioFlixPlayer is mounted once globally in App.tsx — no duplicate here */}
    </div>
  );
};

export default Movies;