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
import {
  saveProperty,
  unsaveProperty,
  getSaveStatus,
  getSavedProperties,
} from "../controllers/saveController";
import { getUserProperties } from "../controllers/userController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// Public endpoints
router.get("/", getAllProperties);

// Protected saved properties list (registered before /:id)
router.get("/saved", authenticateToken, getSavedProperties);

// Public properties by user ID
router.get("/user/:userId", getUserProperties);

// Public single property endpoint
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

// Protected save endpoints
router.post("/:id/save", authenticateToken, saveProperty);
router.delete("/:id/save", authenticateToken, unsaveProperty);
router.get("/:id/save", authenticateToken, getSaveStatus);

export default router;
