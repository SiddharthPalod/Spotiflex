import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { encryptEmail, decryptEmail, hashEmail } from '../utils/crypto.js';
import { generateToken } from '../middlewares/auth.js';
import { sendOtpEmail } from '../utils/mailer.js';

const prisma = new PrismaClient();

/**
 * Step 1: Initiates registration by creating and sending a 6-digit OTP
 */
export const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const emailH = hashEmail(email);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { emailHash: emailH },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any older OTP for this email
    await prisma.otpCode.deleteMany({
      where: { emailHash: emailH },
    });

    // Store OTP in database
    await prisma.otpCode.create({
      data: {
        id: crypto.randomUUID(),
        emailHash: emailH,
        code: otp,
        expiresAt,
        attempts: 0,
      },
    });

    console.log(`\n=================================================`);
    console.log(`🔑 [OTP VERIFICATION] For: ${email}`);
    console.log(`🔑 [OTP CODE]: ${otp}`);
    console.log(`🔑 [EXPIRES IN]: 10 Minutes`);
    console.log(`=================================================\n`);

    // Dispatch real email via Gmail SMTP
    sendOtpEmail(email, otp).catch((err) => console.error('Email dispatch error:', err.message));


    return res.status(200).json({
      message: 'OTP verification code has been sent.',
      email,
      // For development ease, include in response if non-production
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Server error during signup initialization.' });
  }
};

/**
 * Step 2: Verifies OTP and completes account registration
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, code, password, name } = req.body;

    if (!email || !code || !password) {
      return res.status(400).json({ error: 'Email, OTP code, and password are required.' });
    }

    const emailH = hashEmail(email);

    const otpRecord = await prisma.otpCode.findFirst({
      where: { emailHash: emailH },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active OTP request found. Please request a new code.' });
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.otpCode.delete({ where: { id: otpRecord.id } });
      return res.status(400).json({ error: 'OTP code has expired. Please request a new one.' });
    }

    if (otpRecord.attempts >= 5) {
      await prisma.otpCode.delete({ where: { id: otpRecord.id } });
      return res.status(429).json({ error: 'Too many invalid attempts. Please request a new OTP.' });
    }

    if (otpRecord.code !== code.toString().trim()) {
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });
      return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
    }

    // OTP Verified! Clean up record
    await prisma.otpCode.delete({ where: { id: otpRecord.id } });

    // Hash Password with Bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Encrypt Email with AES-256-GCM
    const encEmail = encryptEmail(email);

    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: encEmail,
        emailHash: emailH,
        passwordHash,
        name: name?.trim() || email.split('@')[0],
        avatar: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
      },
    });

    const token = generateToken(newUser);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: 'Account created and verified successfully!',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: email.toLowerCase().trim(),
        avatar: newUser.avatar,
      },
      token,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Server error during account verification.' });
  }
};

/**
 * Resend OTP
 */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const emailH = hashEmail(email);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpCode.deleteMany({
      where: { emailHash: emailH },
    });

    await prisma.otpCode.create({
      data: {
        id: crypto.randomUUID(),
        emailHash: emailH,
        code: otp,
        expiresAt,
        attempts: 0,
      },
    });

    console.log(`\n=================================================`);
    console.log(`🔑 [RESENT OTP VERIFICATION] For: ${email}`);
    console.log(`🔑 [OTP CODE]: ${otp}`);
    console.log(`=================================================\n`);

    // Dispatch real email via Gmail SMTP
    sendOtpEmail(email, otp).catch((err) => console.error('Email dispatch error:', err.message));

    return res.status(200).json({
      message: 'New OTP code sent successfully.',
      email,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({ error: 'Failed to resend OTP code.' });
  }
};

/**
 * User Login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const emailH = hashEmail(email);

    // Look up by deterministic blind index
    const user = await prisma.user.findFirst({
      where: { emailHash: emailH },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    const plainEmail = decryptEmail(user.email);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: 'Logged in successfully.',
      user: {
        id: user.id,
        name: user.name,
        email: plainEmail,
        avatar: user.avatar || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
};

/**
 * User Logout
 */
export const logout = async (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Signed out successfully.' });
};

/**
 * Get current authenticated user
 */
export const getMe = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

/**
 * Helper to ensure a default profile exists for the user
 */
export const ensureDefaultProfile = async (userId, userName, userAvatar) => {
  const count = await prisma.profile.count({ where: { userId } });
  if (count === 0) {
    await prisma.profile.create({
      data: {
        userId,
        name: userName || 'Member',
        avatar: userAvatar || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
        isKids: false,
      },
    });
  }
};

/**
 * Get all family profiles for the current user account
 */
export const getProfiles = async (req, res) => {
  try {
    const userId = req.user.id;
    await ensureDefaultProfile(userId, req.user.name, req.user.avatar);
    const profiles = await prisma.profile.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return res.status(200).json({ profiles });
  } catch (err) {
    console.error('getProfiles error:', err);
    return res.status(500).json({ error: 'Failed to fetch profiles.' });
  }
};

/**
 * Create a new family profile under current account (max 5)
 */
export const createProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, avatar, isKids } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Profile name is required.' });
    }

    const count = await prisma.profile.count({ where: { userId } });
    if (count >= 5) {
      return res.status(400).json({ error: 'Maximum 5 profiles allowed per account.' });
    }

    const profile = await prisma.profile.create({
      data: {
        userId,
        name: name.trim(),
        avatar: avatar || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
        isKids: Boolean(isKids),
      },
    });

    return res.status(201).json({ profile, message: 'Profile created successfully.' });
  } catch (err) {
    console.error('createProfile error:', err);
    return res.status(500).json({ error: 'Failed to create profile.' });
  }
};

/**
 * Update an existing family profile
 */
export const updateProfileById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, avatar, isKids } = req.body;

    const existing = await prisma.profile.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const updated = await prisma.profile.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(avatar && { avatar }),
        ...(typeof isKids === 'boolean' && { isKids }),
      },
    });

    // Also update main user name/avatar if this is the first/primary profile
    const firstProfile = await prisma.profile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (firstProfile && firstProfile.id === id) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name && { name: name.trim() }),
          ...(avatar && { avatar }),
        },
      });
    }

    return res.status(200).json({ profile: updated, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('updateProfileById error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
};

/**
 * Delete a family profile (cannot delete if it's the only one)
 */
export const deleteProfileById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const count = await prisma.profile.count({ where: { userId } });
    if (count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only remaining profile.' });
    }

    const existing = await prisma.profile.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    await prisma.profile.delete({ where: { id } });

    return res.status(200).json({ message: 'Profile deleted successfully.' });
  } catch (err) {
    console.error('deleteProfileById error:', err);
    return res.status(500).json({ error: 'Failed to delete profile.' });
  }
};

/**
 * Update Profile (Name / Avatar) legacy/direct
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const userId = req.user.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name: name.trim() }),
        ...(avatar && { avatar }),
      },
    });

    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: decryptEmail(updatedUser.email),
        avatar: updatedUser.avatar,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
};

/**
 * Sign in / Sign up with Google OAuth ID token or access token
 */
export const googleAuth = async (req, res) => {
  try {
    const { credential, accessToken } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({ error: 'Google authentication credential is required.' });
    }

    let email = '';
    let name = '';
    let picture = '';

    if (credential) {
      const googleClient = new OAuth2Client(process.env.OAUTH_CLIENT_ID);
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.OAUTH_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ error: 'Invalid Google credential token.' });
      }
      email = payload.email;
      name = payload.name || '';
      picture = payload.picture || '';
    } else if (accessToken) {
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      email = response.data.email;
      name = response.data.name || '';
      picture = response.data.picture || '';
    }

    if (!email) {
      return res.status(400).json({ error: 'Could not retrieve email from Google profile.' });
    }

    const emailH = hashEmail(email);

    // Look up existing user by blind index
    let user = await prisma.user.findFirst({
      where: { emailHash: emailH },
    });

    if (!user) {
      const encEmail = encryptEmail(email);
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: encEmail,
          emailHash: emailH,
          name: name || email.split('@')[0],
          avatar: picture || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
        },
      });
    }

    const token = generateToken(user);
    const plainEmail = decryptEmail(user.email);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: 'Signed in with Google successfully.',
      user: {
        id: user.id,
        name: user.name,
        email: plainEmail,
        avatar: user.avatar || picture || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
      },
      token,
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    return res.status(500).json({ error: 'Failed to authenticate with Google.' });
  }
};

/**
 * Public auth config endpoint (provides Google Client ID to frontend)
 */
export const getAuthConfig = (req, res) => {
  return res.status(200).json({
    googleClientId: process.env.OAUTH_CLIENT_ID || '',
  });
};

/**
 * Generates Google OAuth redirect URL for Desktop / Web OAuth flow
 */
export const getGoogleAuthUrl = (req, res) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({ error: 'OAUTH_CLIENT_ID not configured in backend .env' });
  }
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&access_type=offline&prompt=select_account`;

  return res.status(200).json({ url });
};

/**
 * Handles Google OAuth authorization code exchange and redirects back to frontend
 */
export const googleCallback = async (req, res) => {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error || !code) {
    console.error('Google OAuth error:', error);
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error || 'Google authorization cancelled')}`);
  }

  try {
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

    // Exchange authorization code for tokens
    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code: code.toString(),
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenRes.data;

    // Fetch user profile from Google UserInfo endpoint
    const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { email, name, picture } = userInfoRes.data;
    if (!email) {
      return res.redirect(`${frontendUrl}/login?error=No_Email_From_Google`);
    }

    const emailH = hashEmail(email);

    // Look up or create user
    let user = await prisma.user.findFirst({
      where: { emailHash: emailH },
    });

    if (!user) {
      const encEmail = encryptEmail(email);
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: encEmail,
          emailHash: emailH,
          name: name || email.split('@')[0],
          avatar: picture || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
        },
      });
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Redirect to frontend root with token in URL param for client initialization
    return res.redirect(`${frontendUrl}/?token=${token}`);
  } catch (err) {
    console.error('Google OAuth callback failed:', err.response?.data || err.message);
    return res.redirect(`${frontendUrl}/login?error=Google_Auth_Failed`);
  }
};




