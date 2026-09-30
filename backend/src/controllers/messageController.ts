import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

/**
 * Send a message to a conversation
 * POST /api/conversations/:id/messages
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const rawConvId = req.params.id ?? req.params.conversationId ?? req.body.conversationId ?? req.body.conversation_id;
    const conversationId = Number(rawConvId);

    if (!rawConvId || isNaN(conversationId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Enforce that message belongs to the specified conversation if client passes an explicit mismatched ID
    const bodyConvId = req.body.conversationId ?? req.body.conversation_id;
    if (bodyConvId !== undefined && !isNaN(Number(bodyConvId)) && Number(bodyConvId) !== conversationId) {
      return res.status(400).json({ message: "Conversation ID mismatch" });
    }

    // Validate message content
    const rawMessage = req.body.message ?? req.body.content ?? req.body.text;
    if (typeof rawMessage !== "string" || !rawMessage.trim()) {
      return res.status(400).json({ message: "Message content cannot be empty" });
    }

    const trimmedMessage = rawMessage.trim();

    // Verify conversation exists
    const convResult = await pool.query(
      "SELECT id, user_id_1, user_id_2 FROM conversations WHERE id = $1",
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const conv = convResult.rows[0];

    // Verify authenticated user is a participant in this conversation
    if (conv.user_id_1 !== userId && conv.user_id_2 !== userId) {
      return res.status(403).json({ message: "You are not authorized to access this conversation" });
    }

    // Fetch sender info (strictly omitting password)
    const senderResult = await pool.query(
      "SELECT id, name, email, profile_image FROM users WHERE id = $1",
      [userId]
    );

    if (senderResult.rows.length === 0) {
      return res.status(404).json({ message: "Sender user not found" });
    }

    const sender = senderResult.rows[0];

    // Persist message in PostgreSQL
    const insertResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, message, created_at`,
      [conversationId, userId, trimmedMessage]
    );

    const savedMessage = insertResult.rows[0];

    const formattedMessage = {
      id: savedMessage.id,
      conversation_id: savedMessage.conversation_id,
      conversationId: savedMessage.conversation_id,
      sender_id: savedMessage.sender_id,
      senderId: savedMessage.sender_id,
      message: savedMessage.message,
      content: savedMessage.message,
      text: savedMessage.message,
      created_at: savedMessage.created_at,
      createdAt: savedMessage.created_at,
      sender: {
        id: sender.id,
        name: sender.name,
        email: sender.email,
        profile_image: sender.profile_image,
      },
    };

    return res.status(201).json({
      message: "Message sent successfully",
      data: formattedMessage,
      chatMessage: formattedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get message history for a conversation
 * GET /api/conversations/:id/messages
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const rawConvId = req.params.id ?? req.params.conversationId;
    const conversationId = Number(rawConvId);

    if (!rawConvId || isNaN(conversationId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Verify conversation exists
    const convResult = await pool.query(
      "SELECT id, user_id_1, user_id_2 FROM conversations WHERE id = $1",
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const conv = convResult.rows[0];

    // Verify authenticated user is a participant
    if (conv.user_id_1 !== userId && conv.user_id_2 !== userId) {
      return res.status(403).json({ message: "You are not authorized to access this conversation" });
    }

    // Retrieve message history in chronological order (oldest first: created_at ASC, id ASC)
    const messagesResult = await pool.query(
      `SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.message,
        m.created_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'profile_image', u.profile_image
        ) as sender
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC, m.id ASC`,
      [conversationId]
    );

    const formattedMessages = messagesResult.rows.map((row: any) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      conversationId: row.conversation_id,
      sender_id: row.sender_id,
      senderId: row.sender_id,
      message: row.message,
      content: row.message,
      text: row.message,
      created_at: row.created_at,
      createdAt: row.created_at,
      sender: row.sender,
    }));

    return res.status(200).json({
      conversation_id: conversationId,
      conversationId: conversationId,
      messages: formattedMessages,
      total: formattedMessages.length,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
