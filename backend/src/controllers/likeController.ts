import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

export const likeProperty = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const propertyId = Number(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Verify property exists
    const propCheck = await pool.query("SELECT id FROM properties WHERE id = $1", [propertyId]);
    if (propCheck.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check if already liked
    const existingLike = await pool.query(
      "SELECT id FROM likes WHERE user_id = $1 AND property_id = $2",
      [userId, propertyId]
    );

    if (existingLike.rows.length > 0) {
      return res.status(400).json({ message: "Property already liked" });
    }

    try {
      await pool.query(
        "INSERT INTO likes (user_id, property_id) VALUES ($1, $2)",
        [userId, propertyId]
      );
    } catch (insertError: any) {
      if (insertError.code === "23505") {
        return res.status(400).json({ message: "Property already liked" });
      }
      throw insertError;
    }

    const countResult = await pool.query(
      "SELECT COUNT(*)::INTEGER as count FROM likes WHERE property_id = $1",
      [propertyId]
    );
    const likesCount = countResult.rows[0].count;

    res.status(201).json({
      message: "Property liked successfully",
      is_liked: true,
      isLiked: true,
      likes_count: likesCount,
      likeCount: likesCount,
    });
  } catch (error) {
    console.error("Like property error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const unlikeProperty = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const propertyId = Number(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Verify property exists
    const propCheck = await pool.query("SELECT id FROM properties WHERE id = $1", [propertyId]);
    if (propCheck.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    const deleteResult = await pool.query(
      "DELETE FROM likes WHERE user_id = $1 AND property_id = $2 RETURNING id",
      [userId, propertyId]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(400).json({ message: "Property has not been liked yet" });
    }

    const countResult = await pool.query(
      "SELECT COUNT(*)::INTEGER as count FROM likes WHERE property_id = $1",
      [propertyId]
    );
    const likesCount = countResult.rows[0].count;

    res.json({
      message: "Property unliked successfully",
      is_liked: false,
      isLiked: false,
      likes_count: likesCount,
      likeCount: likesCount,
    });
  } catch (error) {
    console.error("Unlike property error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getLikeStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const propertyId = Number(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Verify property exists
    const propCheck = await pool.query("SELECT id FROM properties WHERE id = $1", [propertyId]);
    if (propCheck.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    const likeResult = await pool.query(
      "SELECT id FROM likes WHERE user_id = $1 AND property_id = $2",
      [userId, propertyId]
    );
    const isLiked = likeResult.rows.length > 0;

    const countResult = await pool.query(
      "SELECT COUNT(*)::INTEGER as count FROM likes WHERE property_id = $1",
      [propertyId]
    );
    const likesCount = countResult.rows[0].count;

    res.json({
      property_id: propertyId,
      is_liked: isLiked,
      isLiked: isLiked,
      likes_count: likesCount,
      likeCount: likesCount,
    });
  } catch (error) {
    console.error("Get like status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
