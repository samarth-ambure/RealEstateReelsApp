import { Router } from "express";
import {
  getUserProfile,
  updateProfile,
  getUserProperties,
} from "../controllers/userController";
import { getMe } from "../controllers/authController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// Current user profile endpoints
router.get("/profile", authenticateToken, getMe);
router.put("/profile", authenticateToken, updateProfile);
router.get("/me", authenticateToken, getMe);
router.put("/me", authenticateToken, updateProfile);

// Specific user profile and posted properties
router.get("/:id", getUserProfile);
router.put("/:id", authenticateToken, updateProfile);
router.get("/:id/properties", getUserProperties);

export default router;
