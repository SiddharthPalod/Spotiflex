import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { decryptEmail } from '../utils/crypto.js';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'spotiflix_jwt_secret_key_2026_super_secure';

export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const requireAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: decryptEmail(user.email),
      avatar: user.avatar || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
};

/**
 * Optional auth middleware: extracts user if token exists, otherwise defaults to 'alok-nath-1' for legacy compatibility.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (user) {
        req.user = {
          id: user.id,
          name: user.name,
          email: decryptEmail(user.email),
          avatar: user.avatar || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
        };
        return next();
      }
    }
  } catch (err) {
    // Ignore invalid optional token
  }

  // Fallback to active demo user
  req.user = {
    id: 'alok-nath-1',
    name: 'Alok Nath',
    email: 'alok@spotiflix.com',
    avatar: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
  };
  next();
};
