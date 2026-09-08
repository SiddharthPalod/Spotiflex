import React, { useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { api } from '../services/movieService';

interface Props {
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

const GoogleSignInButton: React.FC<Props> = ({ text = 'continue_with' }) => {
  const { isLoading } = useAuthStore();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsRedirecting(true);
    try {
      // 1. First check if backend has Google OAuth URL ready
      const res = await api.get('/auth/google/url');
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
    } catch (err) {
      console.error('Failed to get Google OAuth URL:', err);
      setIsRedirecting(false);
      alert('Could not start Google Sign In. Please make sure OAUTH_CLIENT_ID is set in your backend .env file.');
    }
  };

  const label =
    text === 'signup_with'
      ? 'Sign up with Google'
      : text === 'signin_with'
      ? 'Sign in with Google'
      : 'Continue with Google';

  return (
    <button
      type="button"
      disabled={isLoading || isRedirecting}
      onClick={handleGoogleSignIn}
      className="w-full py-3 px-4 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] active:scale-[0.99] border border-white/10 text-white text-sm font-semibold flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer disabled:opacity-50 shadow-md"
    >
      {isRedirecting ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

export default GoogleSignInButton;
