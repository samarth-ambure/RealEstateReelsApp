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

function mapRowToProperty(row: PropertyDbRow, likedIds: Set<string> = new Set<string>(), savedIds: Set<string> = new Set<string>()): Property {
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
    isLiked: likedIds.has(row.id),
    isSaved: savedIds.has(row.id),
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

export async function getAllProperties(userId?: number): Promise<Property[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PropertyDbRow>(
    `SELECT p.*, u.email as userEmail
     FROM properties p
     LEFT JOIN users u ON p.userId = u.id
     ORDER BY p.createdAt DESC`,
  );

  const likedIds = userId ? await getLikedPropertyIds(userId) : new Set<string>();
  const savedIds = userId ? await getSavedPropertyIds(userId) : new Set<string>();

  return rows.map((row) => mapRowToProperty(row, likedIds, savedIds));
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

  const likedIds = await getLikedPropertyIds(userId);
  const savedIds = await getSavedPropertyIds(userId);

  return rows.map((row) => mapRowToProperty(row, likedIds, savedIds));
}

export async function getPropertiesByUserEmail(email: string, currentUserId?: number): Promise<Property[]> {
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

  const likedIds = currentUserId ? await getLikedPropertyIds(currentUserId) : new Set<string>();
  const savedIds = currentUserId ? await getSavedPropertyIds(currentUserId) : new Set<string>();

  return rows.map((row) => mapRowToProperty(row, likedIds, savedIds));
}

export async function getPropertyById(id: string, userId?: number): Promise<Property | null> {
  // 1. Check existing mock properties
  const mock = mockProperties.find((item) => item.id === id);
  if (mock) {
    const likedIds = userId ? await getLikedPropertyIds(userId) : new Set<string>();
    const savedIds = userId ? await getSavedPropertyIds(userId) : new Set<string>();
    return { ...mock, isLiked: likedIds.has(id), isSaved: savedIds.has(id) };
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

  const likedIds = userId ? await getLikedPropertyIds(userId) : new Set<string>();
  const savedIds = userId ? await getSavedPropertyIds(userId) : new Set<string>();

  return mapRowToProperty(row, likedIds, savedIds);
}

export async function deleteProperty(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM properties WHERE id = ?', [id]);
}

// Like/Save operations
export async function likeProperty(userId: number, propertyId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT OR IGNORE INTO likes (userId, propertyId, createdAt) VALUES (?, ?, ?)',
    [userId, propertyId, now],
  );
}

export async function unlikeProperty(userId: number, propertyId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM likes WHERE userId = ? AND propertyId = ?', [userId, propertyId]);
}

export async function saveProperty(userId: number, propertyId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT OR IGNORE INTO saves (userId, propertyId, createdAt) VALUES (?, ?, ?)',
    [userId, propertyId, now],
  );
}

export async function unsaveProperty(userId: number, propertyId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM saves WHERE userId = ? AND propertyId = ?', [userId, propertyId]);
}

export async function getLikedPropertyIds(userId: number): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ propertyId: string }>(
    'SELECT propertyId FROM likes WHERE userId = ?',
    [userId],
  );
  return new Set(rows.map((row) => row.propertyId));
}

export async function getSavedPropertyIds(userId: number): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ propertyId: string }>(
    'SELECT propertyId FROM saves WHERE userId = ?',
    [userId],
  );
  return new Set(rows.map((row) => row.propertyId));
}

export async function isPropertyLiked(userId: number, propertyId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM likes WHERE userId = ? AND propertyId = ?',
    [userId, propertyId],
  );
  return (row?.count ?? 0) > 0;
}

export async function isPropertySaved(userId: number, propertyId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM saves WHERE userId = ? AND propertyId = ?',
    [userId, propertyId],
  );
  return (row?.count ?? 0) > 0;
}

export async function getLikedProperties(userId: number): Promise<Property[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PropertyDbRow>(
    `SELECT p.*, u.email as userEmail
     FROM properties p
     INNER JOIN likes l ON p.id = l.propertyId
     LEFT JOIN users u ON p.userId = u.id
     WHERE l.userId = ?
     ORDER BY l.createdAt DESC`,
    [userId],
  );

  const likedIds = await getLikedPropertyIds(userId);
  const savedIds = await getSavedPropertyIds(userId);

  const dbProperties = rows.map((row) => mapRowToProperty(row, likedIds, savedIds));

  // Also include mock properties that are liked
  const mockLikedProperties = mockProperties
    .filter((mock) => likedIds.has(mock.id))
    .map((mock) => ({
      ...mock,
      isLiked: true,
      isSaved: savedIds.has(mock.id),
    }));

  return [...mockLikedProperties, ...dbProperties];
}

export async function getSavedProperties(userId: number): Promise<Property[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PropertyDbRow>(
    `SELECT p.*, u.email as userEmail
     FROM properties p
     INNER JOIN saves s ON p.id = s.propertyId
     LEFT JOIN users u ON p.userId = u.id
     WHERE s.userId = ?
     ORDER BY s.createdAt DESC`,
    [userId],
  );

  const likedIds = await getLikedPropertyIds(userId);
  const savedIds = await getSavedPropertyIds(userId);

  const dbProperties = rows.map((row) => mapRowToProperty(row, likedIds, savedIds));

  // Also include mock properties that are saved
  const mockSavedProperties = mockProperties
    .filter((mock) => savedIds.has(mock.id))
    .map((mock) => ({
      ...mock,
      isLiked: likedIds.has(mock.id),
      isSaved: true,
    }));

  return [...mockSavedProperties, ...dbProperties];
}
