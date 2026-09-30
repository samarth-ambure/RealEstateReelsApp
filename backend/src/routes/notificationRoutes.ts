import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// Protect all notification routes
router.use(authenticateToken);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);

export default router;
