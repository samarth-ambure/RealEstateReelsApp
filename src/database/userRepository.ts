import { getDatabase } from './database';

export type UserRow = {
  id: number;
  name: string;
  email: string;
  password?: string;
  bio?: string | null;
  profileImage?: string | null;
  createdAt: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  bio?: string;
  profileImage?: string;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const db = await getDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db.getFirstAsync<UserRow>(
    'SELECT id, name, email, password, bio, profileImage, createdAt FROM users WHERE LOWER(email) = ? LIMIT 1',
    [normalizedEmail],
  );

  return user ?? null;
}

export async function findUserForAuth(
  email: string,
  password: string,
): Promise<UserRow | null> {
  const db = await getDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db.getFirstAsync<UserRow>(
    'SELECT id, name, email, password, bio, profileImage, createdAt FROM users WHERE LOWER(email) = ? AND password = ? LIMIT 1',
    [normalizedEmail, password],
  );

  return user ?? null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const db = await getDatabase();

  const user = await db.getFirstAsync<UserRow>(
    'SELECT id, name, email, bio, profileImage, createdAt FROM users WHERE id = ? LIMIT 1',
    [id],
  );

  return user ?? null;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const db = await getDatabase();
  const normalizedEmail = input.email.trim().toLowerCase();
  const trimmedName = input.name.trim();

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('A user with this email already exists.');
  }

  const now = new Date().toISOString();
  const bio = input.bio?.trim() || 'Real estate enthusiast';
  const profileImage = input.profileImage?.trim() || null;

  const result = await db.runAsync(
    'INSERT INTO users (name, email, password, bio, profileImage, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [trimmedName, normalizedEmail, input.password, bio, profileImage, now],
  );

  return {
    id: result.lastInsertRowId,
    name: trimmedName,
    email: normalizedEmail,
    bio,
    profileImage,
    createdAt: now,
  };
}

export type GoogleUserPayload = {
  id?: string;
  email: string;
  name?: string | null;
  photo?: string | null;
};

export async function findOrCreateGoogleUser(
  googleUser: GoogleUserPayload,
): Promise<UserRow> {
  const normalizedEmail = googleUser.email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    if (!existing.profileImage && googleUser.photo) {
      await updateUserProfile(existing.id, { profileImage: googleUser.photo });
      existing.profileImage = googleUser.photo;
    }
    return existing;
  }

  const db = await getDatabase();
  const name =
    googleUser.name?.trim() || normalizedEmail.split('@')[0] || 'Google User';
  const now = new Date().toISOString();
  const bio = 'Real estate enthusiast';
  const profileImage = googleUser.photo?.trim() || null;
  const placeholderPassword = `oauth_google_${googleUser.id ?? Date.now()}`;

  const result = await db.runAsync(
    'INSERT INTO users (name, email, password, bio, profileImage, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [name, normalizedEmail, placeholderPassword, bio, profileImage, now],
  );

  return {
    id: result.lastInsertRowId,
    name,
    email: normalizedEmail,
    bio,
    profileImage,
    createdAt: now,
  };
}

export async function updateUserProfile(
  id: number,
  updates: { name?: string; bio?: string; profileImage?: string },
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name.trim());
  }

  if (updates.bio !== undefined) {
    fields.push('bio = ?');
    values.push(updates.bio.trim());
  }

  if (updates.profileImage !== undefined) {
    fields.push('profileImage = ?');
    values.push(updates.profileImage.trim());
  }

  if (fields.length === 0) {
    return;
  }

  values.push(id);
  await db.runAsync(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export async function setActiveSession(userId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO active_session (id, userId) VALUES (1, ?)',
    [userId],
  );
}

export async function clearActiveSession(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM active_session WHERE id = 1');
}

export async function getActiveSessionUser(): Promise<UserRow | null> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<{ userId: number }>(
    'SELECT userId FROM active_session WHERE id = 1 LIMIT 1',
  );

  if (!session?.userId) {
    return null;
  }

  return getUserById(session.userId);
}
