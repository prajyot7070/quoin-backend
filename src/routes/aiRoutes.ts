import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { generateQuery, refineQuery } from '../controllers/aiController';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// AI query generation routes
router.post('/generate-query', generateQuery);
router.post('/refine-query', refineQuery);

export default router;