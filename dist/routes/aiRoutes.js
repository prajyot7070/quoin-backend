"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const aiController_1 = require("../controllers/aiController");
const router = express_1.default.Router();
// Apply authentication middleware to all routes
router.use(authMiddleware_1.protect);
// AI query generation routes
router.post('/generate-query', authMiddleware_1.protect, aiController_1.generateQuery);
router.post('/refine-query', authMiddleware_1.protect, aiController_1.refineQuery);
exports.default = router;
