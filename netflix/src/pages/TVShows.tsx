import MovieRow from '../components/MovieRow';

const TVShows = () => {
  return (
    <div className="pt-20 min-h-screen">
      <div className="px-4">
        <h1 className="text-white text-4xl font-bold mb-8">TV Shows</h1>
        <MovieRow title="Netflix Originals" endpoint="netflixOriginals" />
        <MovieRow title="Trending Shows" endpoint="trending" />
        <MovieRow title="Top Rated Shows" endpoint="topRated" />
      </div>
    </div>
  );
};

export default TVShows; 