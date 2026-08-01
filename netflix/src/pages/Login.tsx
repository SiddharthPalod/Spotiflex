import { useState } from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errors, setErrors]     = useState({ email: '', password: '' });

  const validateForm = () => {
    const newErrors = { email: '', password: '' };
    let isValid = true;

    if (!email) {
      newErrors.email = 'Please enter a valid email.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Your password must contain between 4 and 60 characters.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // TODO: Implement authentication
      console.log('Form submitted:', { email, password, isSignUp });
    }
  };

  return (
    <div className="relative h-screen w-full bg-[#0a0a0a] overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#1DB954]/10 blur-[100px] animate-pulse" />
        <div className="absolute -bottom-48 -right-32 w-[600px] h-[600px] rounded-full bg-[#1DB954]/8 blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Nav */}
        <nav className="px-6 md:px-12 py-5 flex items-center">
          <Link to="/" className="flex items-center gap-2">
            <img src="/spoiflex.png" alt="Spotiflex" className="h-[28px] object-contain" />
            <span
              className="text-[22px] font-black tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #1DB954 0%, #00f5a0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Spotiflex
            </span>
          </Link>
        </nav>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            {/* Card */}
            <div className="bg-[#141414]/90 backdrop-blur-xl p-8 md:p-10 rounded-2xl border border-white/[0.07] shadow-2xl">
              <h2 className="text-white text-3xl md:text-4xl font-black mb-2 tracking-tight">
                {isSignUp ? 'Create account' : 'Welcome back'}
              </h2>
              <p className="text-white/50 text-sm mb-8">
                {isSignUp
                  ? 'Join Spotiflex to discover music your way.'
                  : 'Sign in to continue to Spotiflex.'}
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Email field */}
                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    placeholder="Email address"
                    className={`w-full rounded-xl bg-[#1a1a1a] border ${
                      errors.email ? 'border-red-500/60' : 'border-white/10'
                    } px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954]/60 focus:ring-1 focus:ring-[#1DB954]/30 transition-all`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.email}</p>
                  )}
                </div>

                {/* Password field */}
                <div className="relative">
                  <input
                    id="login-password"
                    type="password"
                    placeholder="Password"
                    className={`w-full rounded-xl bg-[#1a1a1a] border ${
                      errors.password ? 'border-red-500/60' : 'border-white/10'
                    } px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954]/60 focus:ring-1 focus:ring-[#1DB954]/30 transition-all`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {errors.password && (
                    <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.password}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  id="login-submit"
                  type="submit"
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] mt-2"
                  style={{
                    background: 'linear-gradient(135deg, #1DB954 0%, #00f5a0 100%)',
                  }}
                >
                  {isSignUp ? 'Create account' : 'Sign in'}
                </button>

                {/* Remember me */}
                <div className="flex items-center justify-between text-xs text-white/40 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="remember-me"
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-[#1DB954] cursor-pointer"
                    />
                    Remember me
                  </label>
                  <button type="button" className="hover:text-white/70 transition-colors">
                    Need help?
                  </button>
                </div>
              </form>

              {/* Toggle sign in / sign up */}
              <div className="text-white/40 mt-8 text-sm">
                <p>
                  {isSignUp ? 'Already have an account?' : 'New to Spotiflex?'}{' '}
                  <button
                    className="text-white font-semibold hover:text-[#1DB954] transition-colors ml-1"
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? 'Sign in' : 'Sign up now'}
                  </button>
                </p>
                <p className="text-xs mt-4 text-white/25">
                  This page is protected by Google reCAPTCHA to ensure you're not a bot.{' '}
                  <span className="text-[#1DB954]/60 hover:text-[#1DB954] cursor-pointer transition-colors">
                    Learn more
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;