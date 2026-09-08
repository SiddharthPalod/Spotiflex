import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { ExclamationCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';
import GoogleSignInButton from '../components/GoogleSignInButton';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isRateLimited, setIsRateLimited] = useState(false);

  const { login, isLoading, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  const validate = () => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nextErrors.email = 'Please enter a valid email address.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = 'Please enter a valid email format (e.g. user@domain.com).';
    }

    if (!password) {
      nextErrors.password = 'Please enter your password.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsRateLimited(false);

    if (!validate()) return;

    const result = await login(email, password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      if (result.status === 429) {
        setIsRateLimited(true);
      }
      setErrors((prev) => ({
        ...prev,
        general: result.error || 'Invalid email or password.',
      }));
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] flex flex-col justify-between overflow-x-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#1DB954]/10 blur-[120px] animate-pulse" />
        <div
          className="absolute -bottom-48 -right-32 w-[600px] h-[600px] rounded-full bg-[#1DB954]/8 blur-[140px] animate-pulse"
          style={{ animationDelay: '1.5s' }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 px-6 md:px-12 py-6 flex items-center justify-between">
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

      {/* Main card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[450px]">
          <div className="bg-[#141414]/90 backdrop-blur-2xl p-8 md:p-12 rounded-2xl border border-white/[0.08] shadow-2xl">
            <h1 className="text-white text-3xl font-black mb-2 tracking-tight">Sign In</h1>
            <p className="text-white/50 text-sm mb-6">
              Sign in to your account to stream high quality music and sync your favorites.
            </p>

            {/* General or Rate Limit Error Banner */}
            {errors.general && (
              <div
                className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm ${
                  isRateLimited
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}
              >
                <ExclamationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{isRateLimited ? 'Rate Limit Exceeded' : 'Authentication Failed'}</p>
                  <p className="text-xs mt-0.5 opacity-90">{errors.general}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5 ml-0.5">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  className={`w-full rounded-xl bg-[#1f1f1f] border ${
                    errors.email ? 'border-red-500' : 'border-white/10'
                  } px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/50 transition-all`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5 ml-0.5">
                  <label className="block text-xs font-semibold text-white/70">Password</label>
                </div>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  className={`w-full rounded-xl bg-[#1f1f1f] border ${
                    errors.password ? 'border-red-500' : 'border-white/10'
                  } px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/50 transition-all`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                />
                {errors.password && <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.password}</p>}
              </div>

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-black transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 mt-3 flex items-center justify-center gap-2 shadow-lg shadow-[#1DB954]/20 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #1DB954 0%, #00f5a0 100%)',
                }}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 h-[1px] bg-white/10" />
              <span className="px-3 text-xs uppercase font-bold text-white/40 tracking-wider">OR</span>
              <div className="flex-1 h-[1px] bg-white/10" />
            </div>

            {/* Google Sign In Button */}
            <GoogleSignInButton text="signin_with" />

            {/* Switch to Signup */}
            <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-white/50">
              New to Spotiflex?{' '}
              <Link to="/signup" className="text-white font-bold hover:text-[#1DB954] transition-colors ml-1">
                Sign up now
              </Link>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-white/30">
              <ShieldCheckIcon className="w-4 h-4 text-[#1DB954]/80" />
              <span>Protected with AES-256 email encryption & rate limiting</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-white/30">
        &copy; {new Date().getFullYear()} Spotiflex. All rights reserved.
      </footer>
    </div>
  );
};

export default Login;