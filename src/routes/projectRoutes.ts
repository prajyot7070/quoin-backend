import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { createProject, deleteProject, getProject, getProjectsForOrganization } from '../controllers/projectController';

const router = express.Router();

router.post('/', protect, createProject);
router.get('/:id', protect, getProject);
router.get('/organization/:organizationId', protect, getProjectsForOrganization);
router.delete('/:id', protect, deleteProject);

export default router;