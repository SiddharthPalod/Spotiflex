import express from 'express';
import rateLimit from 'express-rate-limit';
import { signup, verifyOtp, resendOtp, login, logout, getMe, updateProfile, googleAuth, getAuthConfig, getGoogleAuthUrl, googleCallback, getProfiles, createProfile, updateProfileById, deleteProfileById } from '../controllers/auth.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// Public auth config
router.get('/config', getAuthConfig);

// Google OAuth URL & Callback (Universal: Supports Web & Desktop client IDs)
router.get('/google/url', getGoogleAuthUrl);
router.get('/google/callback', googleCallback);

// Rate limiter for login endpoint to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // Limit to 5 attempts per window per IP
  message: { error: 'Too many login attempts from this IP. Please wait 1 minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for signup and OTP requests to prevent spam
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // 5 requests per minute
  message: { error: 'Too many verification requests. Please wait 1 minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public auth endpoints
router.post('/signup', otpLimiter, signup);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtp);
router.post('/login', loginLimiter, login);
router.post('/google', googleAuth);
router.post('/logout', logout);

// Protected account & profile endpoints
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);

// Family / Sub-profile endpoints (Scoped strictly to the authenticated account)
router.get('/profiles', requireAuth, getProfiles);
router.post('/profiles', requireAuth, createProfile);
router.put('/profiles/:id', requireAuth, updateProfileById);
router.delete('/profiles/:id', requireAuth, deleteProfileById);

export default router;
