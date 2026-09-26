import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { initDatabase } from '@/database/database';
import { migrateFromAsyncStorage } from '@/database/migration';
import {
  clearActiveSession,
  createUser,
  findUserByEmail,
  findUserForAuth,
  getActiveSessionUser,
  setActiveSession,
  UserRow,
} from '@/database/userRepository';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  bio?: string | null;
  profileImage?: string | null;
  createdAt?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    bio: row.bio,
    profileImage: row.profileImage,
    createdAt: row.createdAt,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        await initDatabase();
        await migrateFromAsyncStorage();

        const activeUser = await getActiveSessionUser();
        if (isMounted && activeUser) {
          setUser(toAuthUser(activeUser));
        }
      } catch (err) {
        console.warn('Error during auth initialization:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const userRow = await findUserForAuth(email, password);

    if (!userRow) {
      const existingUser = await findUserByEmail(email);
      if (!existingUser) {
        throw new Error('No registered user found.');
      }
      throw new Error('Invalid email or password.');
    }

    await setActiveSession(userRow.id);
    setUser(toAuthUser(userRow));
  };

  const register = async (name: string, email: string, password: string) => {
    const createdUser = await createUser({
      name,
      email,
      password,
    });

    await setActiveSession(createdUser.id);
    setUser(toAuthUser(createdUser));
  };

  const logout = async () => {
    await clearActiveSession();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
