import express from 'express';
import { register, login, getProfile } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { inviteUser } from '../controllers/authController';
import { createOrganization } from '../controllers/authController';

const router = express.Router();

//routes
router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);
//router.post('/organizations/:organizationId/invite', protect, inviteUser);
//router.post('/organizations', protect, createOrganization);

export default router;
