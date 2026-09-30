import { Request, Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

export const getUserStats = async (userId: number) => {
  const statsRes = await pool.query(
    `SELECT
      (SELECT COUNT(*)::INTEGER FROM properties WHERE user_id = $1) as posted_properties,
      (SELECT COUNT(*)::INTEGER FROM likes WHERE user_id = $1) as liked_properties,
      (SELECT COUNT(*)::INTEGER FROM saved_properties WHERE user_id = $1) as saved_properties`,
    [userId]
  );
  const row = statsRes.rows[0];
  return {
    posted_properties: row.posted_properties,
    postedProperties: row.posted_properties,
    liked_properties: row.liked_properties,
    likedProperties: row.liked_properties,
    saved_properties: row.saved_properties,
    savedProperties: row.saved_properties,
  };
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // If an id parameter was specified (e.g. PUT /api/users/:id), verify ownership
    if (req.params.id) {
      const targetId = Number(req.params.id);
      if (isNaN(targetId)) {
        return res.status(404).json({ message: "User not found" });
      }
      if (targetId !== userId) {
        return res.status(403).json({ message: "You are not authorized to update another user's profile" });
      }
    }

    const { name, bio, profile_image, profileImage, email } = req.body;

    // Verify at least one field is provided
    if (
      name === undefined &&
      bio === undefined &&
      profile_image === undefined &&
      profileImage === undefined &&
      email === undefined
    ) {
      return res.status(400).json({ message: "No valid profile fields provided for update" });
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ message: "Name cannot exceed 100 characters" });
      }
    }

    // Validate email if provided
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== "string" || !emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const emailCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email.trim(), userId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ message: "Email is already in use" });
      }
    }

    // Fetch existing user to preserve fields
    const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const existing = userRes.rows[0];

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedBio = bio !== undefined ? (bio === null ? null : String(bio).trim()) : existing.bio;
    const updatedProfileImage = (profile_image !== undefined || profileImage !== undefined)
      ? (profile_image ?? profileImage ?? null)
      : existing.profile_image;
    const updatedEmail = email !== undefined ? email.trim() : existing.email;

    const updateRes = await pool.query(
      `UPDATE users
       SET name = $1, bio = $2, profile_image = $3, email = $4
       WHERE id = $5
       RETURNING id, name, email, bio, profile_image, created_at`,
      [updatedName, updatedBio, updatedProfileImage, updatedEmail, userId]
    );

    const stats = await getUserStats(userId);

    res.json({
      message: "Profile updated successfully",
      user: {
        ...updateRes.rows[0],
        stats,
      },
      stats,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.id);
    if (isNaN(targetUserId)) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRes = await pool.query(
      `SELECT id, name, email, bio, profile_image, created_at
       FROM users
       WHERE id = $1`,
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const stats = await getUserStats(targetUserId);

    res.json({
      user: {
        ...userRes.rows[0],
        stats,
      },
      stats,
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserProperties = async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.id || req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify user exists
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [targetUserId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const result = await pool.query(
      `SELECT 
        p.id,
        p.user_id,
        p.title,
        p.price,
        p.location,
        p.property_type,
        p.bedrooms,
        p.bathrooms,
        p.area,
        p.description,
        p.image,
        p.agent_name,
        p.agent_image,
        p.created_at,
        COALESCE(l.likes_count, 0)::INTEGER as likes_count,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'profile_image', u.profile_image
        ) as creator
      FROM properties p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT property_id, COUNT(*)::INTEGER as likes_count
        FROM likes
        GROUP BY property_id
      ) l ON p.id = l.property_id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC, p.id DESC`,
      [targetUserId]
    );

    res.json({
      properties: result.rows,
    });
  } catch (error) {
    console.error("Get user properties error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
