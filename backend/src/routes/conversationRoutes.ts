import { Router } from "express";
import {
  getOrCreateConversation,
  getConversations,
  getConversationById,
} from "../controllers/conversationController";
import {
  sendMessage,
  getMessages,
} from "../controllers/messageController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// Protect all conversation routes with JWT
router.use(authenticateToken);

router.post("/", getOrCreateConversation);
router.get("/", getConversations);
router.get("/:id", getConversationById);

// Message endpoints for a conversation
router.post("/:id/messages", sendMessage);
router.get("/:id/messages", getMessages);

export default router;
