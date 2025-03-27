"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const authController_2 = require("../controllers/authController");
const authController_3 = require("../controllers/authController");
const router = express_1.default.Router();
//routes
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.get('/profile', authMiddleware_1.protect, authController_1.getProfile);
router.post('/organizations/:organizationId/invite', authMiddleware_1.protect, authController_2.inviteUser);
router.post('/organizations', authMiddleware_1.protect, authController_3.createOrganization);
exports.default = router;
