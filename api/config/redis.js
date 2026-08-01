import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('✅ Connected to Redis');

    // ── Enable persistence so the cache survives server restarts ──────────
    // Without this, every restart = cold cache = YouTube quota burned again.
    try {
      // AOF (Append Only File): every write is flushed to disk immediately.
      // Best for our use case — guarantees no cached video ID is ever lost.
      await redisClient.configSet('appendonly', 'yes');

      // RDB snapshots: point-in-time backups at intervals (belt-and-suspenders).
      //   900s  if ≥ 1  key changed   (15-min lazy snapshot)
      //   300s  if ≥ 10 keys changed  (5-min on moderate activity)
      //   60s   if ≥ 1000 keys changed (aggressive on burst writes)
      await redisClient.configSet('save', '900 1 300 10 60 1000');

      console.log('✅ Redis persistence enabled (AOF + RDB snapshots)');
    } catch (err) {
      // Some managed Redis providers (e.g. Redis Cloud free tier) block CONFIG SET.
      // This is non-fatal — the app still works, just without persistence.
      console.warn('⚠️  Could not enable Redis persistence via CONFIG SET:', err.message);
      console.warn('   If you are self-hosting Redis, add this to redis.conf instead:');
      console.warn('     appendonly yes');
      console.warn('     save 900 1 300 10 60 1000');
    }
  }
};