
import { Router } from "express";
import * as aiController from "../controllers/aiController";  // Correct Import

const router = Router();

// Generate query route
router.post('/generate', aiController.generateQuery);

// Generate and execute query route
router.post('/generate-execute', aiController.generateAndExecuteQuery);

export default router;

