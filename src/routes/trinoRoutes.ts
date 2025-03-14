import { Router } from "express";
import * as trinoController from "../controllers/trinoController";

const router = Router();

// Test connection route
router.post('/test-connection', trinoController.testConnection);

// Project routes
router.post('/projects', trinoController.createProject);

// Connection routes
router.post('/connections', trinoController.createConnection);

// Query execution route
router.post('/execute', trinoController.executeQuery);

export default router;
