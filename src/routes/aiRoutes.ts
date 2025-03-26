
import { Router } from "express";
import * as aiController from "../controllers/aiController";  // Correct Import
import { protect } from "../middleware/authMiddleware";

const router = Router();

// Generate query route
router.post('/generate',protect , aiController.generateQuery);

// Generate and execute query route
//router.post('/generate-execute', aiController.generateAndExecuteQuery);

export default router;

