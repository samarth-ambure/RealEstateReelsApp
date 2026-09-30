import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

export const getOrCreateConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const rawOtherUserId = req.body.participantId ?? req.body.userId ?? req.body.recipientId ?? req.body.otherUserId;
    const otherUserId = Number(rawOtherUserId);

    if (!rawOtherUserId || isNaN(otherUserId)) {
      return res.status(400).json({ message: "Valid participant ID is required" });
    }

    if (otherUserId === userId) {
      return res.status(400).json({ message: "Cannot create a conversation with yourself" });
    }

    // Verify other user exists
    const userCheck = await pool.query(
      "SELECT id, name, email, profile_image FROM users WHERE id = $1",
      [otherUserId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const otherUser = userCheck.rows[0];

    // Canonical order to satisfy UNIQUE(user_id_1, user_id_2) regardless of who initiates
    const u1 = Math.min(userId, otherUserId);
    const u2 = Math.max(userId, otherUserId);

    // Check if conversation already exists
    const existingResult = await pool.query(
      `SELECT id, user_id_1, user_id_2, created_at
       FROM conversations
       WHERE user_id_1 = $1 AND user_id_2 = $2`,
      [u1, u2]
    );

    if (existingResult.rows.length > 0) {
      const conv = existingResult.rows[0];
      return res.status(200).json({
        message: "Conversation found",
        conversation: {
          ...conv,
          other_user: otherUser,
          otherUser: otherUser,
        },
      });
    }

    // Create new conversation
    const insertResult = await pool.query(
      `INSERT INTO conversations (user_id_1, user_id_2)
       VALUES ($1, $2)
       ON CONFLICT (user_id_1, user_id_2) DO UPDATE
       SET created_at = conversations.created_at
       RETURNING id, user_id_1, user_id_2, created_at`,
      [u1, u2]
    );

    const newConv = insertResult.rows[0];

    res.status(201).json({
      message: "Conversation created successfully",
      conversation: {
        ...newConv,
        other_user: otherUser,
        otherUser: otherUser,
      },
    });
  } catch (error) {
    console.error("Get or create conversation error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await pool.query(
      `SELECT 
        c.id,
        c.user_id_1,
        c.user_id_2,
        c.created_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'profile_image', u.profile_image
        ) as other_user
      FROM conversations c
      JOIN users u ON u.id = CASE 
        WHEN c.user_id_1 = $1 THEN c.user_id_2 
        ELSE c.user_id_1 
      END
      WHERE c.user_id_1 = $1 OR c.user_id_2 = $1
      ORDER BY c.created_at DESC, c.id DESC`,
      [userId]
    );

    const formattedConversations = result.rows.map((row: any) => ({
      ...row,
      otherUser: row.other_user,
    }));

    res.json({
      conversations: formattedConversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getConversationById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const conversationId = Number(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const checkResult = await pool.query(
      "SELECT id, user_id_1, user_id_2 FROM conversations WHERE id = $1",
      [conversationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const conv = checkResult.rows[0];

    if (conv.user_id_1 !== userId && conv.user_id_2 !== userId) {
      return res.status(403).json({ message: "You are not authorized to access this conversation" });
    }

    const otherUserId = conv.user_id_1 === userId ? conv.user_id_2 : conv.user_id_1;

    const userResult = await pool.query(
      "SELECT id, name, email, profile_image FROM users WHERE id = $1",
      [otherUserId]
    );
    const otherUser = userResult.rows[0];

    const detailResult = await pool.query(
      "SELECT id, user_id_1, user_id_2, created_at FROM conversations WHERE id = $1",
      [conversationId]
    );

    const conversation = {
      ...detailResult.rows[0],
      other_user: otherUser,
      otherUser: otherUser,
    };

    res.json({
      conversation,
    });
  } catch (error) {
    console.error("Get conversation by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
