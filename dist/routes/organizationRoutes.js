"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const authController_1 = require("../controllers/authController");
const organizationController_1 = require("../controllers/organizationController");
const router = express_1.default.Router();
// Create organization
router.post('/', authMiddleware_1.protect, authController_1.createOrganization);
// Invite user to organization
router.post('/:organizationId/invite', authMiddleware_1.protect, authController_1.inviteUser);
// Get all members in organization
router.get('/:organizationId/members', authMiddleware_1.protect, organizationController_1.getOrganizationMembers);
// In organizationRoutes.ts
router.get('/me/with-projects', authMiddleware_1.protect, organizationController_1.getUserOrganizationsWithProjects);
// Update member role
router.patch('/:organizationId/members/:userId', authMiddleware_1.protect, organizationController_1.updateMemberRole);
// Remove member
router.delete('/:organizationId/members/:userId', authMiddleware_1.protect, organizationController_1.removeMember);
exports.default = router;
