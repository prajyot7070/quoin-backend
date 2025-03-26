import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { inviteUser, createOrganization } from '../controllers/authController';
import { 
 getOrganizationMembers, 
 updateMemberRole, 
 removeMember, 
 getUserOrganizationsWithProjects
} from '../controllers/organizationController';

const router = express.Router();

// Create organization
router.post('/', protect, createOrganization);

// Invite user to organization
router.post('/:organizationId/invite', protect, inviteUser);

// Get all members in organization
router.get('/:organizationId/members', protect, getOrganizationMembers);

// In organizationRoutes.ts
router.get('/me/with-projects', protect, getUserOrganizationsWithProjects);

// Update member role
router.patch('/:organizationId/members/:userId', protect, updateMemberRole);

// Remove member
router.delete('/:organizationId/members/:userId', protect, removeMember);

export default router;