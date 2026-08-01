import express from 'express';
import { getMadeForYou, getSimilar } from '../controllers/recommendation.js';

const router = express.Router();

// GET /api/recommendations/for-you
// Returns personalized tracks powered by the Hybrid ML Engine
router.get('/for-you', getMadeForYou);

// GET /api/recommendations/similar?trackId=...
// Returns tracks contextually similar to trackId, ranked by Hybrid ML Engine for the user
router.get('/similar', getSimilar);

export default router;
