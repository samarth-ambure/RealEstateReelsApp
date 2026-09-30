import { pool } from "../config/db";

export interface CreateNotificationParams {
  userId: number; // recipient ID
  type: string;   // e.g. 'LIKE', 'SAVE'
  title: string;  // e.g. 'New Like', 'Property Saved'
  message: string;// descriptive message
}

export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const { userId, type, title, message } = params;

    if (!userId || !type || !title || !message) {
      return null;
    }

    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, type, title, message, is_read, created_at`,
      [userId, type.trim(), title.trim(), message.trim()]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};
