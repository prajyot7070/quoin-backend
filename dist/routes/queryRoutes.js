"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const queryController_1 = require("../controllers/queryController");
const router = express_1.default.Router();
// Apply auth middleware to all routes
router.use(authMiddleware_1.protect);
// Query execution and management
router.post('/execute', queryController_1.executeQuery);
router.get('/history/:projectId', queryController_1.getQueryHistory);
router.post('/feedback', queryController_1.provideFeedback);
router.post('/save', queryController_1.saveQuery);
router.get('/savedqueries/:projectId', queryController_1.getSavedQueries);
exports.default = router;
