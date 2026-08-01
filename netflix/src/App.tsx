import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import Home from './pages/Home';
import Movies from './pages/Movies';
import TVShows from './pages/TVShows';
import MyList from './pages/MyList';
import Login from './pages/Login';
import Search from './pages/Search';
import './App.css';
import { useEffect } from 'react';
import { useLikeStore } from './utils/store';

function App() {
  const fetchLikes = useLikeStore((s) => s.fetchLikes);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  return (
    <Router>
      <div className="bg-[#141414] min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/movies"   element={<Movies />} />
          <Route path="/tv-shows" element={<TVShows />} />
          <Route path="/my-list"  element={<MyList />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/search"   element={<Search />} />
        </Routes>

        {/* Global full-screen music video player — mounted once, survives route changes */}
        <VideoPlayer />
      </div>
    </Router>
  );
}

export default App;
