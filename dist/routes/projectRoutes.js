"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const projectController_1 = require("../controllers/projectController");
const router = express_1.default.Router();
router.post('/', authMiddleware_1.protect, projectController_1.createProject);
router.get('/:id', authMiddleware_1.protect, projectController_1.getProject);
router.get('/organization/:organizationId', authMiddleware_1.protect, projectController_1.getProjectsForOrganization);
router.delete('/:id', authMiddleware_1.protect, projectController_1.deleteProject);
exports.default = router;
