import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { apiClient, getToken, removeToken, setToken } from '@/services/api';
import { disconnectSocket } from '@/services/socketService';

export type GoogleUserPayload = {
  id?: string | null;
  name?: string | null;
  email: string;
  photoUrl?: string | null;
  photo?: string | null;
};

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
  loginWithGoogle: (googleUser: GoogleUserPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toAuthUser(row: any): AuthUser {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    bio: row.bio ?? null,
    profileImage: row.profile_image ?? row.profileImage ?? null,
    createdAt: row.created_at ?? row.createdAt,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        const token = await getToken();
        if (token) {
          try {
            const data = await apiClient.get<{ user: any }>('/api/auth/me');
            if (isMounted && data?.user) {
              const authUser = toAuthUser(data.user);
              setUser(authUser);
            }
          } catch (apiErr) {
            console.warn('Stored token invalid or expired. Clearing token.', apiErr);
            await removeToken();
            if (isMounted) {
              setUser(null);
            }
          }
        } else {
          if (isMounted) {
            setUser(null);
          }
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
    const data = await apiClient.post<{
      message: string;
      token: string;
      user: any;
    }>('/api/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });

    if (data.token) {
      await setToken(data.token);
    }

    const authUser = toAuthUser(data.user);
    setUser(authUser);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiClient.post<{
      message: string;
      user: any;
      token?: string;
    }>('/api/auth/register', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    if (data.token) {
      await setToken(data.token);
      const authUser = toAuthUser(data.user);
      setUser(authUser);
    } else {
      // Backend /api/auth/register creates account; log in to retrieve JWT session
      await login(email, password);
    }
  };

  const loginWithGoogle = async (googleUser: GoogleUserPayload) => {
    setUser({
      id: Number(googleUser.id) || Date.now(),
      name: googleUser.name || googleUser.email.split('@')[0],
      email: googleUser.email,
      profileImage: googleUser.photoUrl ?? googleUser.photo ?? null,
    });
  };

  const logout = async () => {
    disconnectSocket();
    await removeToken();
    setUser(null);
  };

  const updateUser = (updated: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updated } : prev));
  };

  const refreshUser = async () => {
    try {
      const data = await apiClient.get<{ user: any }>('/api/users/profile');
      if (data?.user) {
        setUser(toAuthUser(data.user));
      }
    } catch (e) {
      console.warn('Failed to refresh user:', e);
    }
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      loginWithGoogle,
      logout,
      updateUser,
      refreshUser,
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
