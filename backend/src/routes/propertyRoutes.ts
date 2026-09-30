import { Router } from "express";
import {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
} from "../controllers/propertyController";
import {
  likeProperty,
  unlikeProperty,
  getLikeStatus,
} from "../controllers/likeController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// Public endpoints
router.get("/", getAllProperties);
router.get("/:id", getPropertyById);

// Protected property endpoints
router.post("/", authenticateToken, createProperty);
router.put("/:id", authenticateToken, updateProperty);
router.delete("/:id", authenticateToken, deleteProperty);

// Protected like endpoints
router.post("/:id/like", authenticateToken, likeProperty);
router.delete("/:id/like", authenticateToken, unlikeProperty);
router.get("/:id/like", authenticateToken, getLikeStatus);
router.get("/:id/liked", authenticateToken, getLikeStatus);

export default router;
