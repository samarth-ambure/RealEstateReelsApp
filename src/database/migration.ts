import AsyncStorage from '@react-native-async-storage/async-storage';

import { Property } from '@/types/property';

import { createProperty, getPropertyById } from './propertyRepository';
import {
  createUser,
  findUserByEmail,
  getActiveSessionUser,
  setActiveSession,
} from './userRepository';

const LOCAL_USER_KEY = 'localUser';
const USER_PROPERTIES_KEY = 'userProperties';

export async function migrateFromAsyncStorage(): Promise<void> {
  try {
    let migratedUserId: number | null = null;

    // 1. Check if legacy localUser exists in AsyncStorage
    const savedUserJson = await AsyncStorage.getItem(LOCAL_USER_KEY);
    if (savedUserJson) {
      try {
        const parsed = JSON.parse(savedUserJson);
        if (parsed?.email && parsed?.name) {
          const existing = await findUserByEmail(parsed.email);
          if (!existing) {
            const created = await createUser({
              name: parsed.name,
              email: parsed.email,
              password: parsed.password || 'password123',
              bio: parsed.bio || 'Real estate enthusiast',
            });
            migratedUserId = created.id;
          } else {
            migratedUserId = existing.id;
          }

          // If no active session is set, set the migrated user as active session
          const activeUser = await getActiveSessionUser();
          if (!activeUser && migratedUserId) {
            await setActiveSession(migratedUserId);
          }
        }
      } catch (userErr) {
        console.warn('Could not parse legacy user for SQLite migration:', userErr);
      }
    }

    // 2. Check if legacy userProperties exist in AsyncStorage
    const savedPropsJson = await AsyncStorage.getItem(USER_PROPERTIES_KEY);
    if (savedPropsJson) {
      try {
        const parsedProps = JSON.parse(savedPropsJson);
        if (Array.isArray(parsedProps)) {
          for (const item of parsedProps as Property[]) {
            if (item?.id && item?.title) {
              const existingProp = await getPropertyById(item.id);
              if (!existingProp) {
                await createProperty(item, migratedUserId);
              }
            }
          }
        }
      } catch (propErr) {
        console.warn('Could not parse legacy properties for SQLite migration:', propErr);
      }
    }
  } catch (err) {
    console.warn('AsyncStorage to SQLite migration error:', err);
  }
}
