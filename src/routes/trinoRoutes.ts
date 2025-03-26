import { Router } from "express";
import * as trinoController from "../controllers/trinoController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

// Test connection route
router.post('/test-connection',protect , trinoController.testConnection);

// Project routes
router.post('/projects',protect , trinoController.createProject);
router.get('/projects/:id',protect , trinoController.getProject); // New route to get project by ID

// Connection routes
router.post('/connections',protect , trinoController.createConnection);

// Query execution route
router.post('/execute' ,protect , trinoController.executeQuery);
export default router;
