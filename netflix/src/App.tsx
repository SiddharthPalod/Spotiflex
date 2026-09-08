import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import Home from './pages/Home';
import Movies from './pages/Movies';
import TVShows from './pages/TVShows';
import MyList from './pages/MyList';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profiles from './pages/Profiles';
import ManageProfiles from './pages/ManageProfiles';
import Account from './pages/Account';
import SignOut from './pages/SignOut';
import Search from './pages/Search';
import { ProtectedRoute, PublicOnlyRoute } from './components/AuthGuard';
import { useAuthStore } from './utils/authStore';
import { useLikeStore } from './utils/store';
import './App.css';

function App() {
  const fetchLikes = useLikeStore((s) => s.fetchLikes);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('spotiflix_auth_token', urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    }

    checkAuth();
    fetchLikes();
  }, [checkAuth, fetchLikes]);

  return (
    <Router>
      <div className="bg-[#141414] min-h-screen">
        <Navbar />
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <Signup />
              </PublicOnlyRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/movies"
            element={
              <ProtectedRoute>
                <Movies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tv-shows"
            element={
              <ProtectedRoute>
                <TVShows />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-list"
            element={
              <ProtectedRoute>
                <MyList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profiles"
            element={
              <ProtectedRoute>
                <Profiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-profiles"
            element={
              <ProtectedRoute>
                <ManageProfiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route path="/signout" element={<SignOut />} />
        </Routes>

        {/* Global full-screen music video player — mounted once, survives route changes */}
        <VideoPlayer />
      </div>
    </Router>
  );
}

export default App;
