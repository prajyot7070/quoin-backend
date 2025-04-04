import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { generateQuery, refineQuery } from '../controllers/aiController';
import { cacheSchema } from '../controllers/cacheController';
const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// AI query generation routes
router.post('/generate-query', protect, generateQuery);
router.post('/refine-query',protect , refineQuery);
router.post('/cache-schema',protect ,cacheSchema);

export default router;
