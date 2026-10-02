import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";
import { TokenPayload } from "../middleware/authMiddleware";

export const socketHandler = (io: Server): void => {
  // Socket.IO authentication middleware
  io.use((socket: Socket, next) => {
    try {
      const authHeaderOrToken =
        socket.handshake.auth?.token ||
        (Array.isArray(socket.handshake.headers?.authorization)
          ? socket.handshake.headers?.authorization[0]
          : socket.handshake.headers?.authorization);

      if (!authHeaderOrToken || typeof authHeaderOrToken !== "string") {
        return next(new Error("Authentication error: Access token required"));
      }

      const trimmed = authHeaderOrToken.trim();
      const token = trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed;

      if (!token) {
        return next(new Error("Authentication error: Malformed access token"));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error("JWT_SECRET is not defined in environment variables");
        return next(new Error("Server configuration error"));
      }

      const decoded = jwt.verify(token, secret) as TokenPayload;

      if (!decoded || typeof decoded.userId !== "number") {
        return next(new Error("Authentication error: Invalid token payload"));
      }

      socket.data.userId = decoded.userId;
      next();
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return next(new Error("Authentication error: Token expired"));
      }
      return next(new Error("Authentication error: Invalid or malformed token"));
    }
  });

  // Socket.IO connection handler
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as number;
    console.log(`User connected via socket: userId=${userId}, socketId=${socket.id}`);

    /**
     * Join conversation room
     * Event: join_conversation
     * Payload: { conversationId: number }
     */
    socket.on(
      "join_conversation",
      async (
        payload: { conversationId?: number } | number,
        callback?: (response: any) => void
      ) => {
        try {
          const rawConvId =
            typeof payload === "number" ? payload : payload?.conversationId;
          const conversationId = Number(rawConvId);

          if (!rawConvId || isNaN(conversationId)) {
            const errorPayload = { message: "Invalid conversation ID" };
            if (typeof callback === "function") {
              callback({ status: "error", ...errorPayload });
            }
            socket.emit("error", errorPayload);
            return;
          }

          // Verify conversation exists and user is an authorized participant
          const convResult = await pool.query(
            "SELECT id, user_id_1, user_id_2 FROM conversations WHERE id = $1",
            [conversationId]
          );

          if (convResult.rows.length === 0) {
            const errorPayload = { message: "Unauthorized or conversation not found" };
            if (typeof callback === "function") {
              callback({ status: "error", ...errorPayload });
            }
            socket.emit("error", errorPayload);
            return;
          }

          const conv = convResult.rows[0];
          if (conv.user_id_1 !== userId && conv.user_id_2 !== userId) {
            const errorPayload = { message: "Unauthorized or conversation not found" };
            if (typeof callback === "function") {
              callback({ status: "error", ...errorPayload });
            }
            socket.emit("error", errorPayload);
            return;
          }

          const room = `conversation:${conversationId}`;
          socket.join(room);

          const successPayload = {
            status: "ok",
            conversationId,
            room,
          };

          if (typeof callback === "function") {
            callback(successPayload);
          }
          socket.emit("joined_conversation", successPayload);
        } catch (error) {
          console.error("Error in join_conversation:", error);
          const errorPayload = { message: "Server error joining conversation" };
          if (typeof callback === "function") {
            callback({ status: "error", ...errorPayload });
          }
          socket.emit("error", errorPayload);
        }
      }
    );

    /**
     * Send real-time message
     * Event: send_message
     * Payload: { conversationId: number, message: string }
     */
    socket.on(
      "send_message",
      async (
        payload: {
          conversationId?: number;
          conversation_id?: number;
          message?: string;
          content?: string;
          text?: string;
        },
        callback?: (response: any) => void
      ) => {
        try {
          const rawConvId =
            payload?.conversationId ?? payload?.conversation_id;
          const conversationId = Number(rawConvId);

          if (!rawConvId || isNaN(conversationId)) {
            const errorPayload = { message: "Invalid conversation ID" };
            if (typeof callback === "function") {
              callback({ status: "error", ...errorPayload });
            }
            socket.emit("error", errorPayload);
            return;
          }

          // Validate message content
          const rawMessage =
            payload?.message ?? payload?.content ?? payload?.text;
          if (typeof rawMessage !== "string" || !rawMessage.trim()) {
            const errorPayload = { message: "Message content cannot be empty" };
            if (typeof callback === "function") {
              callback({ status: "error", ...errorPayload });
            }
            socket.emit("error", errorPayload);
            return;
          }

          const trimmedMessage = rawMessage.trim();

          // Verify conversation exists and user is an authorized participant
          const convResult = await pool.query(
            "SELECT id, user_id_1, user_id_2 FROM conversations WHERE id = $1",
            [conversationId]
          );

          if (convResult.rows.length === 0) {
            const errorPayload = { message: "Unauthorized or conversation not found" };
            if (typeof callback === "function") {
              callback({ status: "error", ...errorPayload });
            }
            socket.emit("error", errorPayload);
            return;
          }

          const conv = convResult.rows[0];
          if (conv.user_id_1 !== userId && conv.user_id_2 !== userId) {
            const errorPayload = {
              message: "You are not authorized to access this conversation",
            };
            if (typeof callback === "function") {
              callback({ status: "error", ...errorPayload });
            }
            socket.emit("error", errorPayload);
            return;
          }

          // Fetch sender info (strictly omitting password)
          const senderResult = await pool.query(
            "SELECT id, name, email, profile_image FROM users WHERE id = $1",
            [userId]
          );

          if (senderResult.rows.length === 0) {
            const errorPayload = { message: "Sender user not found" };
            if (typeof callback === "function") {
              callback({ status: "error", ...errorPayload });
            }
            socket.emit("error", errorPayload);
            return;
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

          // Standard formatted payload matching messageController.ts
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

          const room = `conversation:${conversationId}`;

          // Broadcast to everyone in the room
          io.to(room).emit("new_message", formattedMessage);

          // Invoke acknowledgement callback if provided
          if (typeof callback === "function") {
            callback({ status: "ok", data: formattedMessage });
          }
        } catch (error) {
          console.error("Error in send_message:", error);
          const errorPayload = { message: "Server error sending message" };
          if (typeof callback === "function") {
            callback({ status: "error", ...errorPayload });
          }
          socket.emit("error", errorPayload);
        }
      }
    );

    socket.on("disconnect", (reason) => {
      console.log(
        `User disconnected from socket: userId=${userId}, socketId=${socket.id}, reason=${reason}`
      );
    });
  });
};

export default socketHandler;
