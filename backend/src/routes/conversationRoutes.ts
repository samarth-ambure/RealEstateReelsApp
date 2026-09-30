import { Router } from "express";
import {
  getOrCreateConversation,
  getConversations,
  getConversationById,
} from "../controllers/conversationController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// Protect all conversation routes with JWT
router.use(authenticateToken);

router.post("/", getOrCreateConversation);
router.get("/", getConversations);
router.get("/:id", getConversationById);

export default router;
