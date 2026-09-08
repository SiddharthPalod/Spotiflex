import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// 32-byte key for AES-256-GCM
const ENCRYPTION_KEY_RAW = process.env.EMAIL_ENCRYPTION_KEY || 'spotiflix_super_secret_encryption_key_32bytes!!';
// Derive a fixed 32-byte buffer
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest();

const BLIND_INDEX_SALT = process.env.EMAIL_HASH_SALT || 'spotiflix_blind_index_salt_secure_2026';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Deterministic blind index hash for email lookups (HMAC-SHA256).
 * Normalizes email to lowercase & trimmed before hashing.
 */
export function hashEmail(email) {
  if (!email) return '';
  const normalized = email.trim().toLowerCase();
  return crypto
    .createHmac('sha256', BLIND_INDEX_SALT)
    .update(normalized)
    .digest('hex');
}

/**
 * Encrypts an email using AES-256-GCM.
 * Output format: iv:authTag:encryptedText (hex)
 */
export function encryptEmail(email) {
  if (!email) return '';
  const normalized = email.trim().toLowerCase();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(normalized, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted email formatted as iv:authTag:encryptedText.
 */
export function decryptEmail(cipherText) {
  if (!cipherText || !cipherText.includes(':')) {
    // Return as is if legacy plain text email exists
    return cipherText;
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed for email payload:', err.message);
    return '[Encrypted Email]';
  }
}
