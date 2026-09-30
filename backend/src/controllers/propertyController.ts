import { Request, Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

const PROPERTY_SELECT_WITH_CREATOR = `
  SELECT 
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
`;

export const createProperty = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      title,
      price,
      location,
      property_type,
      propertyType,
      bedrooms,
      bathrooms,
      area,
      description,
      image,
      agent_name,
      agentName,
      agent_image,
      agentImage,
    } = req.body;

    if (!title || price === undefined || price === null || price === "" || !location) {
      return res.status(400).json({ message: "Title, price, and location are required" });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: "Price must be a valid positive number" });
    }

    const cleanPropertyType = property_type ?? propertyType ?? null;
    const cleanBedrooms = bedrooms !== undefined && bedrooms !== null && bedrooms !== "" ? Number(bedrooms) : null;
    const cleanBathrooms = bathrooms !== undefined && bathrooms !== null && bathrooms !== "" ? Number(bathrooms) : null;
    const cleanArea = area !== undefined && area !== null && area !== "" ? Number(area) : null;
    const cleanAgentName = agent_name ?? agentName ?? null;
    const cleanAgentImage = agent_image ?? agentImage ?? null;

    const insertResult = await pool.query(
      `INSERT INTO properties (
        user_id, title, price, location, property_type,
        bedrooms, bathrooms, area, description, image,
        agent_name, agent_image
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        userId,
        title.trim(),
        numericPrice,
        location.trim(),
        cleanPropertyType,
        cleanBedrooms,
        cleanBathrooms,
        cleanArea,
        description ?? null,
        image ?? null,
        cleanAgentName,
        cleanAgentImage,
      ]
    );

    const newPropertyId = insertResult.rows[0].id;

    const fullResult = await pool.query(
      `${PROPERTY_SELECT_WITH_CREATOR} WHERE p.id = $1`,
      [newPropertyId]
    );

    res.status(201).json({
      message: "Property created successfully",
      property: fullResult.rows[0],
    });
  } catch (error) {
    console.error("Create property error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllProperties = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `${PROPERTY_SELECT_WITH_CREATOR} ORDER BY p.created_at DESC, p.id DESC`
    );

    res.json({
      properties: result.rows,
    });
  } catch (error) {
    console.error("Get all properties error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPropertyById = async (req: Request, res: Response) => {
  try {
    const propertyId = Number(req.params.id);

    if (isNaN(propertyId)) {
      return res.status(404).json({ message: "Property not found" });
    }

    const result = await pool.query(
      `${PROPERTY_SELECT_WITH_CREATOR} WHERE p.id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json({
      property: result.rows[0],
    });
  } catch (error) {
    console.error("Get property by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProperty = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const propertyId = Number(req.params.id);

    if (isNaN(propertyId)) {
      return res.status(404).json({ message: "Property not found" });
    }

    const checkResult = await pool.query(
      "SELECT * FROM properties WHERE id = $1",
      [propertyId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    const existing = checkResult.rows[0];

    if (existing.user_id !== userId) {
      return res.status(403).json({ message: "You are not authorized to update this property" });
    }

    const {
      title,
      price,
      location,
      property_type,
      propertyType,
      bedrooms,
      bathrooms,
      area,
      description,
      image,
      agent_name,
      agentName,
      agent_image,
      agentImage,
    } = req.body;

    let updatedPrice = existing.price;
    if (price !== undefined && price !== null && price !== "") {
      const num = Number(price);
      if (isNaN(num) || num < 0) {
        return res.status(400).json({ message: "Price must be a valid positive number" });
      }
      updatedPrice = num;
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedLocation = location !== undefined ? location.trim() : existing.location;
    const updatedPropertyType = property_type ?? propertyType ?? existing.property_type;
    const updatedBedrooms = bedrooms !== undefined ? (bedrooms !== null && bedrooms !== "" ? Number(bedrooms) : null) : existing.bedrooms;
    const updatedBathrooms = bathrooms !== undefined ? (bathrooms !== null && bathrooms !== "" ? Number(bathrooms) : null) : existing.bathrooms;
    const updatedArea = area !== undefined ? (area !== null && area !== "" ? Number(area) : null) : existing.area;
    const updatedDescription = description !== undefined ? description : existing.description;
    const updatedImage = image !== undefined ? image : existing.image;
    const updatedAgentName = agent_name ?? agentName ?? existing.agent_name;
    const updatedAgentImage = agent_image ?? agentImage ?? existing.agent_image;

    await pool.query(
      `UPDATE properties SET
        title = $1,
        price = $2,
        location = $3,
        property_type = $4,
        bedrooms = $5,
        bathrooms = $6,
        area = $7,
        description = $8,
        image = $9,
        agent_name = $10,
        agent_image = $11
      WHERE id = $12`,
      [
        updatedTitle,
        updatedPrice,
        updatedLocation,
        updatedPropertyType,
        updatedBedrooms,
        updatedBathrooms,
        updatedArea,
        updatedDescription,
        updatedImage,
        updatedAgentName,
        updatedAgentImage,
        propertyId,
      ]
    );

    const fullResult = await pool.query(
      `${PROPERTY_SELECT_WITH_CREATOR} WHERE p.id = $1`,
      [propertyId]
    );

    res.json({
      message: "Property updated successfully",
      property: fullResult.rows[0],
    });
  } catch (error) {
    console.error("Update property error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteProperty = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const propertyId = Number(req.params.id);

    if (isNaN(propertyId)) {
      return res.status(404).json({ message: "Property not found" });
    }

    const checkResult = await pool.query(
      "SELECT user_id FROM properties WHERE id = $1",
      [propertyId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    const existing = checkResult.rows[0];

    if (existing.user_id !== userId) {
      return res.status(403).json({ message: "You are not authorized to delete this property" });
    }

    await pool.query("DELETE FROM properties WHERE id = $1", [propertyId]);

    res.json({
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("Delete property error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
