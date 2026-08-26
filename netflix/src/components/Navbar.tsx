import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BellIcon, MagnifyingGlassIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { DEFAULT_AVATAR } from '../utils/avatarUtils';

const PROFILE_NAMES = ['Deep'];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profiles] = useState(() =>
    PROFILE_NAMES.map(name => ({
      name,
      avatar: DEFAULT_AVATAR
    }))
  );
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill search if navigating directly to /search?q=...
  useEffect(() => {
    if (location.pathname === '/search') {
      const params = new URLSearchParams(location.search);
      const q = params.get('q');
      if (q) {
        setSearchQuery(q);
        setSearchOpen(true);
      }
    } else {
      setSearchQuery('');
      setSearchOpen(false);
    }
  }, [location.pathname, location.search]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (isAuthPage) return null;

  return (
    <>
      {/* Gradient shadow under nav */}
      <div className="fixed top-0 z-[99] w-full h-[70px] bg-transparent pointer-events-none" />

      <nav
        className={`fixed top-0 z-[100] w-full h-[68px] flex items-center transition-all duration-500 ${
          isScrolled
            ? 'bg-[#0a0a0a]'
            : 'bg-transparent'
        }`}
      >
        <div className="flex items-center justify-between w-full px-4 md:px-[60px]">
          {/* ===== Left Section ===== */}
          <div className="flex items-center">
            {/* Spotiflex Logo */}
            <Link to="/" className="shrink-0 mr-[28px] flex items-center gap-2">
              {/* Green music note icon */}
              <img src="/spoiflex.png" alt="Spotiflex" className="h-[28px] object-contain" />
              <span
                className="text-[22px] font-black tracking-tight hidden sm:block"
                style={{
                  background: 'linear-gradient(135deg, #1DB954 0%, #00f5a0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontFamily: 'League Gothic',
                }}
              >
                SPOTIFLEX
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center">
              <Link to="/" className="nav-link">Home</Link>
              <Link to="/tv-shows" className="nav-link">Albums</Link>
              <Link to="/movies" className="nav-link">Songs</Link>
              <Link to="/my-list" className="nav-link">My List</Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-white p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* ===== Right Section ===== */}
          <div className="flex items-center gap-4">
            {/* Expandable Search (Netflix Style) */}
            <div 
              className={`flex items-center transition-all duration-300 ease-in-out h-[36px] ${
                searchOpen 
                  ? 'border border-white bg-black/80 px-2' 
                  : 'bg-transparent'
              }`}
            >
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Titles, people, genres" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Small delay to allow buttons click to register before closing
                  setTimeout(() => {
                    if (!searchQuery) setSearchOpen(false);
                  }, 150);
                }}
                className={`bg-transparent text-white text-[14px] outline-none placeholder-[#808080] transition-all duration-300 ease-in-out ${
                  searchOpen ? 'w-[180px] opacity-100 mr-2 px-1' : 'w-0 opacity-0 pointer-events-none p-0 m-0 border-none'
                }`}
              />
              
              <div 
                className={`flex items-center justify-center transition-all duration-300 ${
                  searchOpen && searchQuery ? 'w-[24px] opacity-100' : 'w-0 opacity-0 pointer-events-none overflow-hidden'
                }`}
              >
                <button 
                  onClick={() => { 
                    setSearchQuery(''); 
                    if (location.pathname === '/search') navigate('/');
                    setSearchOpen(false);
                  }} 
                  className="text-white hover:text-gray-300 mr-1"
                  tabIndex={searchOpen && searchQuery ? 0 : -1}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <button
                className="text-white flex-shrink-0 hover:text-gray-300 transition-colors flex items-center justify-center w-[24px] h-[24px]"
                onClick={(e) => {
                  e.preventDefault();
                  if (!searchOpen) {
                    setSearchOpen(true);
                  } else {
                    handleSearchSubmit();
                  }
                }}
                aria-label="Search"
              >
                <MagnifyingGlassIcon className={`transition-all duration-300 ${searchOpen ? 'h-5 w-5' : 'h-6 w-6'}`} />
              </button>
            </div>

            <button
              className="text-white/80 hover:text-white transition-colors p-[10px] relative"
              aria-label="Notifications"
            >
              <BellIcon className="h-[20px] w-[20px]" />
              <span className="absolute top-[4px] right-[4px] bg-[#1DB954] text-white text-[10px] font-bold h-[16px] min-w-[16px] rounded-full flex items-center justify-center leading-none">
                3
              </span>
            </button>

            {/* Profile dropdown */}
            <div className="group relative ml-[6px]">
              <div className="flex items-center gap-2 cursor-pointer py-[2px]">
                <img
                  src={profiles[0].avatar}
                  alt="Profile"
                  className="h-[32px] w-[32px] rounded ring-2 ring-transparent group-hover:ring-[#1DB954]/60 transition-all duration-200"
                />
                <div className="border-t-[4px] border-t-white/70 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent transition-transform duration-200 group-hover:rotate-180 mt-[2px]" />
              </div>

              {/* Dropdown panel */}
              <div className="absolute right-0 top-full pt-[8px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="bg-[rgba(10,10,10,0.97)] border border-white/10 rounded-lg min-w-[220px] py-[10px] shadow-2xl">
                  {profiles.map((profile, index) => (
                    <Link
                      key={index}
                      to="/profile"
                      className="flex items-center px-[12px] py-[7px] text-[13px] text-white hover:bg-white/5 transition-colors"
                    >
                      <img
                        src={profile.avatar}
                        alt={profile.name}
                        className="h-[32px] w-[32px] rounded mr-[10px]"
                      />
                      <span>{profile.name}</span>
                    </Link>
                  ))}
                  <div className="h-[1px] bg-white/10 my-[8px] mx-[12px]" />
                  <Link to="/manage-profiles" className="dropdown-link">Manage Profiles</Link>
                  <Link to="/account"         className="dropdown-link">Account</Link>
                  <Link to="/help"            className="dropdown-link">Help Center</Link>
                  <div className="h-[1px] bg-white/10 my-[8px] mx-[12px]" />
                  <Link to="/signout"         className="dropdown-link">Sign out of Spotiflex</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Full-screen Menu */}
      <div
        className={`fixed inset-0 bg-[#0a0a0a]/98 z-[90] transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="pt-[88px] px-8">
          <div className="flex flex-col space-y-5">
            <Link to="/"        onClick={() => setIsMobileMenuOpen(false)} className="text-[18px] text-white font-medium">Home</Link>
            <Link to="/tv-shows"onClick={() => setIsMobileMenuOpen(false)} className="text-[18px] text-white font-medium">Albums</Link>
            <Link to="/movies"  onClick={() => setIsMobileMenuOpen(false)} className="text-[18px] text-white font-medium">Songs</Link>
            <Link to="/my-list" onClick={() => setIsMobileMenuOpen(false)} className="text-[18px] text-white font-medium">My List</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;