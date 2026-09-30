import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await pool.query(
      `SELECT id, user_id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER as count
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    const unreadCount = countResult.rows[0].count;

    res.json({
      unread_count: unreadCount,
      unreadCount,
      notifications: result.rows,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER as count
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    const unreadCount = countResult.rows[0].count;

    res.json({
      unread_count: unreadCount,
      unreadCount,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notificationId = Number(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const checkResult = await pool.query(
      "SELECT id, user_id, is_read FROM notifications WHERE id = $1",
      [notificationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const notification = checkResult.rows[0];

    if (notification.user_id !== userId) {
      return res.status(403).json({ message: "You are not authorized to update this notification" });
    }

    const updateResult = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, type, title, message, is_read, created_at`,
      [notificationId, userId]
    );

    res.json({
      message: "Notification marked as read",
      notification: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const updateResult = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({
      message: "All notifications marked as read",
      updated_count: updateResult.rowCount,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
