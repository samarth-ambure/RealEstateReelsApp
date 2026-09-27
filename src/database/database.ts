import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'realestate.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

      await db.execAsync(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          bio TEXT,
          profileImage TEXT,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS properties (
          id TEXT PRIMARY KEY,
          userId INTEGER,
          title TEXT NOT NULL,
          price REAL,
          location TEXT,
          propertyType TEXT,
          bedrooms INTEGER,
          bathrooms INTEGER,
          area REAL,
          description TEXT,
          image TEXT,
          agentName TEXT,
          agentImage TEXT,
          createdAt TEXT NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS active_session (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          userId INTEGER NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS likes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          propertyId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(userId, propertyId)
        );

        CREATE TABLE IF NOT EXISTS saves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          propertyId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(userId, propertyId)
        );
      `);

      dbInstance = db;
      return db;
    })();
  }

  return initPromise;
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  return getDatabase();
}
