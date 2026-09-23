import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const LOCAL_USER_KEY = 'localUser';

type StoredUser = {
  name: string;
  email: string;
  password: string;
};

type AuthUser = {
  name: string;
  email: string;
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

function isStoredUser(value: unknown): value is StoredUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Partial<StoredUser>;

  return (
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    typeof user.password === 'string'
  );
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    name: user.name,
    email: user.email,
  };
}

async function getStoredUser(): Promise<StoredUser | null> {
  const savedUser = await AsyncStorage.getItem(LOCAL_USER_KEY);

  if (!savedUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(savedUser);
    return isStoredUser(parsedUser) ? parsedUser : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const storedUser = await getStoredUser();

        if (isMounted && storedUser) {
          setUser(toAuthUser(storedUser));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const storedUser = await getStoredUser();

    if (!storedUser) {
      throw new Error('No registered user found.');
    }

    if (storedUser.email !== email || storedUser.password !== password) {
      throw new Error('Invalid email or password.');
    }

    setUser(toAuthUser(storedUser));
  };

  const register = async (name: string, email: string, password: string) => {
    const newUser: StoredUser = {
      name,
      email,
      password,
    };

    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(newUser));
    setUser(toAuthUser(newUser));
  };

  const logout = async () => {
    await AsyncStorage.removeItem(LOCAL_USER_KEY);
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
