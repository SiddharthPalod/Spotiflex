import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import musicRoutes from './routes/music.js';
import authRoutes from './routes/auth.js';
import telemetryRoutes from './routes/telemetry.js';
import recommendationRoutes from './routes/recommendation.js';
import { connectRedis } from './config/redis.js';
import { MLService } from './services/ml.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware (Allows your Vite frontend on port 5173 to talk to this backend)
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api', musicRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Boot
app.listen(PORT, async () => {
  await connectRedis();
  
  // Boot persistent ML Python Daemon
  MLService.getInstance();
  
  console.log(`🚀 SpotiFlix API running on http://localhost:${PORT}`);
});