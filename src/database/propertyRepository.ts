import { mockProperties } from '@/data/properties';
import { Property } from '@/types/property';

import { getDatabase } from './database';
import { findUserByEmail } from './userRepository';

type PropertyDbRow = {
  id: string;
  userId: number | null;
  title: string;
  price: number;
  location: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  description: string;
  image: string;
  agentName: string | null;
  agentImage: string | null;
  createdAt: string;
  userEmail?: string | null;
};

function parseNumericValue(val: string | number | undefined): number {
  if (typeof val === 'number') {
    return val;
  }
  if (!val) {
    return 0;
  }
  const clean = val.replace(/[^0-9.]/g, '');
  return parseFloat(clean) || 0;
}

function mapRowToProperty(row: PropertyDbRow): Property {
  return {
    id: row.id,
    title: row.title,
    price: `$${Number(row.price).toLocaleString()}`,
    location: row.location,
    propertyType: row.propertyType,
    bedrooms: Number(row.bedrooms),
    bathrooms: Number(row.bathrooms),
    area: `${Number(row.area).toLocaleString()} sq ft`,
    description: row.description,
    image: row.image,
    agentName: row.agentName || 'Owner',
    agentImage:
      row.agentImage ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80',
    isLiked: false,
    isSaved: false,
    createdBy: row.userEmail || undefined,
  };
}

export async function createProperty(
  property: Property,
  userId?: number | null,
): Promise<void> {
  const db = await getDatabase();

  let resolvedUserId: number | null = userId ?? null;
  if (!resolvedUserId && property.createdBy) {
    const user = await findUserByEmail(property.createdBy);
    if (user) {
      resolvedUserId = user.id;
    }
  }

  const numericPrice = parseNumericValue(property.price);
  const numericArea = parseNumericValue(property.area);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO properties (
      id, userId, title, price, location, propertyType,
      bedrooms, bathrooms, area, description, image,
      agentName, agentImage, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      property.id,
      resolvedUserId,
      property.title.trim(),
      numericPrice,
      property.location.trim(),
      property.propertyType.trim(),
      property.bedrooms,
      property.bathrooms,
      numericArea,
      property.description.trim(),
      property.image.trim(),
      property.agentName?.trim() || null,
      property.agentImage?.trim() || null,
      now,
    ],
  );
}

export async function getAllProperties(): Promise<Property[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PropertyDbRow>(
    `SELECT p.*, u.email as userEmail
     FROM properties p
     LEFT JOIN users u ON p.userId = u.id
     ORDER BY p.createdAt DESC`,
  );

  return rows.map(mapRowToProperty);
}

export async function getPropertiesByUserId(userId: number): Promise<Property[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PropertyDbRow>(
    `SELECT p.*, u.email as userEmail
     FROM properties p
     LEFT JOIN users u ON p.userId = u.id
     WHERE p.userId = ?
     ORDER BY p.createdAt DESC`,
    [userId],
  );

  return rows.map(mapRowToProperty);
}

export async function getPropertiesByUserEmail(email: string): Promise<Property[]> {
  const db = await getDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await db.getAllAsync<PropertyDbRow>(
    `SELECT p.*, u.email as userEmail
     FROM properties p
     LEFT JOIN users u ON p.userId = u.id
     WHERE LOWER(u.email) = ?
     ORDER BY p.createdAt DESC`,
    [normalizedEmail],
  );

  return rows.map(mapRowToProperty);
}

export async function getPropertyById(id: string): Promise<Property | null> {
  // 1. Check existing mock properties
  const mock = mockProperties.find((item) => item.id === id);
  if (mock) {
    return mock;
  }

  // 2. Check SQLite database
  const db = await getDatabase();
  const row = await db.getFirstAsync<PropertyDbRow>(
    `SELECT p.*, u.email as userEmail
     FROM properties p
     LEFT JOIN users u ON p.userId = u.id
     WHERE p.id = ?
     LIMIT 1`,
    [id],
  );

  if (!row) {
    return null;
  }

  return mapRowToProperty(row);
}

export async function deleteProperty(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM properties WHERE id = ?', [id]);
}
