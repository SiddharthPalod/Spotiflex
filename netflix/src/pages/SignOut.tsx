import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';

const SignOut = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    logout();
  }, [logout]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      navigate('/login');
    }
  }, [countdown, navigate]);

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col justify-between">
      {/* Nav Header */}
      <nav className="px-6 md:px-12 py-6 flex items-center">
        <Link to="/" className="flex items-center gap-2">
          <img src="/spoiflex.png" alt="Spotiflex" className="h-[30px] object-contain" />
          <span
            className="text-[24px] font-black tracking-tight"
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
      </nav>

      {/* Center card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#141414]/90 backdrop-blur-2xl p-8 md:p-10 rounded-2xl border border-white/10 text-center shadow-2xl">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <img src="/spoiflex.png" alt="Spotiflex" className="h-8 object-contain opacity-80" />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Signed Out
          </h1>
          <p className="text-sm text-white/60 mb-6">
            You have been safely signed out of Spotiflex.
          </p>

          <p className="text-xs text-white/40 mb-6">
            Redirecting to sign in screen in <span className="font-bold text-[#1DB954]">{countdown}s</span>...
          </p>

          <Link
            to="/login"
            className="w-full inline-block py-3 rounded-xl font-bold text-sm text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #1DB954 0%, #00f5a0 100%)',
            }}
          >
            Sign In Now
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-white/30">
        &copy; {new Date().getFullYear()} Spotiflex. All rights reserved.
      </footer>
    </div>
  );
};

export default SignOut;
