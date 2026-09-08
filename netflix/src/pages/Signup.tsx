import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import PasswordStrengthIndicator, { calculatePasswordStrength } from '../components/PasswordStrengthIndicator';
import { ExclamationCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import GoogleSignInButton from '../components/GoogleSignInButton';

const Signup = () => {
  // Step 1: Account Info | Step 2: OTP Verification
  const [step, setStep] = useState<1 | 2>(1);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 6-digit OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string; general?: string }>({});
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const { signup, verifyOtp, resendOtp, isLoading, clearError } = useAuthStore();
  const navigate = useNavigate();

  // Cooldown countdown timer for resending OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const validateStep1 = () => {
    const nextErrors: { email?: string; password?: string; name?: string } = {};

    if (!name.trim()) {
      nextErrors.name = 'Please enter your name.';
    }

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = 'Please enter a valid email address.';
    }

    const strength = calculatePasswordStrength(password);
    if (!password) {
      nextErrors.password = 'Please create a password.';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters long.';
    } else if (strength.score < 2) {
      nextErrors.password = 'Please choose a stronger password.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateStep1()) return;

    const result = await signup(email, password, name);
    if (result.success) {
      setStep(2);
      setResendCooldown(60); // 60s cooldown
      if (result.devOtp) {
        setDevOtpHint(result.devOtp);
      }
    } else {
      setErrors((prev) => ({
        ...prev,
        general: result.error || 'Failed to initiate signup. Please try again.',
      }));
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, '').slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = cleanVal;
    setOtp(nextOtp);

    // Auto-focus next input box
    if (cleanVal && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const nextOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        nextOtp[i] = pasted[i] || '';
      }
      setOtp(nextOtp);
      const nextIndex = Math.min(pasted.length, 5);
      otpInputsRef.current[nextIndex]?.focus();
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setErrors((prev) => ({ ...prev, general: 'Please enter all 6 digits of the OTP code.' }));
      return;
    }

    const result = await verifyOtp(email, fullCode, password, name);
    if (result.success) {
      navigate('/', { replace: true });
    } else {
      setErrors((prev) => ({ ...prev, general: result.error || 'Invalid OTP code.' }));
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const result = await resendOtp(email);
    if (result.success) {
      setResendCooldown(60);
      if (result.devOtp) setDevOtpHint(result.devOtp);
      setErrors({});
    } else {
      setErrors((prev) => ({ ...prev, general: result.error || 'Failed to resend code.' }));
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] flex flex-col justify-between overflow-x-hidden">
      {/* Background glow */}
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

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[480px]">
          <div className="bg-[#141414]/90 backdrop-blur-2xl p-8 md:p-12 rounded-2xl border border-white/[0.08] shadow-2xl">
            {step === 1 ? (
              /* STEP 1: Registration Form */
              <>
                <h1 className="text-white text-3xl font-black mb-2 tracking-tight">Create an account</h1>
                <p className="text-white/50 text-sm mb-6">
                  Unlimited songs, albums, and personalized picks curated just for you.
                </p>

                {errors.general && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-3 text-sm">
                    <ExclamationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Registration Error</p>
                      <p className="text-xs mt-0.5 opacity-90">{errors.general}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleStep1Submit} className="flex flex-col gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5 ml-0.5">Your Name</label>
                    <input
                      id="signup-name"
                      type="text"
                      placeholder="e.g. Siddharth"
                      className={`w-full rounded-xl bg-[#1f1f1f] border ${
                        errors.name ? 'border-red-500' : 'border-white/10'
                      } px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/50 transition-all`}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                    />
                    {errors.name && <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.name}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5 ml-0.5">Email address</label>
                    <input
                      id="signup-email"
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

                  {/* Password with Strength Indicator */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5 ml-0.5">Password</label>
                    <input
                      id="signup-password"
                      type="password"
                      placeholder="Create a strong password"
                      className={`w-full rounded-xl bg-[#1f1f1f] border ${
                        errors.password ? 'border-red-500' : 'border-white/10'
                      } px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/50 transition-all`}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                    />
                    <PasswordStrengthIndicator password={password} />
                    {errors.password && <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.password}</p>}
                  </div>

                  <button
                    id="signup-next"
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
                      'Continue & Send OTP'
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center my-6">
                  <div className="flex-1 h-[1px] bg-white/10" />
                  <span className="px-3 text-xs uppercase font-bold text-white/40 tracking-wider">OR</span>
                  <div className="flex-1 h-[1px] bg-white/10" />
                </div>

                {/* Google Sign Up Button */}
                <GoogleSignInButton text="signup_with" />

                <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-white/50">
                  Already have an account?{' '}
                  <Link to="/login" className="text-white font-bold hover:text-[#1DB954] transition-colors ml-1">
                    Sign in
                  </Link>
                </div>
              </>
            ) : (
              /* STEP 2: OTP Verification Form */
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors mb-6 cursor-pointer"
                >
                  <ArrowLeftIcon className="w-3.5 h-3.5" />
                  <span>Back to registration details</span>
                </button>

                <h1 className="text-white text-3xl font-black mb-2 tracking-tight">Verify Email</h1>
                <p className="text-white/50 text-sm mb-6">
                  We've sent a 6-digit verification code to <strong className="text-white">{email}</strong>.
                </p>

                {devOtpHint && (
                  <div className="mb-6 p-3 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/30 text-xs text-white flex items-center justify-between">
                    <div>
                      <span className="text-white/50 block text-[10px] uppercase font-bold">Dev Mode Auto-Detect</span>
                      <span>Code: <strong className="font-mono text-[#1DB954] tracking-wider">{devOtpHint}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const digits = devOtpHint.split('').slice(0, 6);
                        setOtp(digits);
                      }}
                      className="px-2 py-1 bg-[#1DB954]/20 hover:bg-[#1DB954]/30 text-[#1DB954] rounded text-[11px] font-bold transition"
                    >
                      Fill Code
                    </button>
                  </div>
                )}

                {errors.general && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-3 text-sm">
                    <ExclamationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Verification Failed</p>
                      <p className="text-xs mt-0.5 opacity-90">{errors.general}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleVerifySubmit} className="flex flex-col gap-6">
                  {/* 6 Digits Boxes */}
                  <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputsRef.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-12 h-14 text-center text-2xl font-black rounded-xl bg-[#1f1f1f] border border-white/10 text-white focus:outline-none focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/40 transition-all"
                      />
                    ))}
                  </div>

                  <button
                    id="verify-otp-submit"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-black transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-[#1DB954]/20 cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #1DB954 0%, #00f5a0 100%)',
                    }}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Verify & Start Listening'
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-white/50 flex flex-col gap-2">
                  <span>Didn't receive the email?</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className={`font-semibold transition-colors ${
                      resendCooldown > 0
                        ? 'text-white/30 cursor-not-allowed'
                        : 'text-[#1DB954] hover:underline cursor-pointer'
                    }`}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              </>
            )}
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

export default Signup;
