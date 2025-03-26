import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { executeQuery, getQueryHistory, provideFeedback } from '../controllers/queryController';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Query execution and management
router.post('/execute', executeQuery);
router.get('/history/:projectId', getQueryHistory);
router.post('/feedback', provideFeedback);

export default router;