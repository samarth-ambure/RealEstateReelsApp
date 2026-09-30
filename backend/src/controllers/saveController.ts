import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

export const saveProperty = async (req: AuthRequest, res: Response) => {
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

    // Check if already saved
    const existingSave = await pool.query(
      "SELECT id FROM saved_properties WHERE user_id = $1 AND property_id = $2",
      [userId, propertyId]
    );

    if (existingSave.rows.length > 0) {
      return res.status(400).json({ message: "Property already saved" });
    }

    try {
      await pool.query(
        "INSERT INTO saved_properties (user_id, property_id) VALUES ($1, $2)",
        [userId, propertyId]
      );
    } catch (insertError: any) {
      if (insertError.code === "23505") {
        return res.status(400).json({ message: "Property already saved" });
      }
      throw insertError;
    }

    res.status(201).json({
      message: "Property saved successfully",
      is_saved: true,
      isSaved: true,
    });
  } catch (error) {
    console.error("Save property error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const unsaveProperty = async (req: AuthRequest, res: Response) => {
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
      "DELETE FROM saved_properties WHERE user_id = $1 AND property_id = $2 RETURNING id",
      [userId, propertyId]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(400).json({ message: "Property has not been saved yet" });
    }

    res.json({
      message: "Property removed from saved",
      is_saved: false,
      isSaved: false,
    });
  } catch (error) {
    console.error("Unsave property error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSaveStatus = async (req: AuthRequest, res: Response) => {
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

    const saveResult = await pool.query(
      "SELECT id FROM saved_properties WHERE user_id = $1 AND property_id = $2",
      [userId, propertyId]
    );
    const isSaved = saveResult.rows.length > 0;

    res.json({
      property_id: propertyId,
      is_saved: isSaved,
      isSaved: isSaved,
    });
  } catch (error) {
    console.error("Get save status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSavedProperties = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
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
        sp.created_at as saved_at,
        COALESCE(l.likes_count, 0)::INTEGER as likes_count,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'profile_image', u.profile_image
        ) as creator
      FROM saved_properties sp
      JOIN properties p ON sp.property_id = p.id
      JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT property_id, COUNT(*)::INTEGER as likes_count
        FROM likes
        GROUP BY property_id
      ) l ON p.id = l.property_id
      WHERE sp.user_id = $1
      ORDER BY sp.created_at DESC, sp.id DESC`,
      [userId]
    );

    res.json({
      properties: result.rows,
    });
  } catch (error) {
    console.error("Get saved properties error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
