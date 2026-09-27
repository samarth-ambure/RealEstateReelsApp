import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const THEME_STORAGE_KEY = '@app_theme';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  themeMode: ThemeMode;
  colorScheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const systemColorScheme = useColorScheme();

  // Load theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemeMode(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  // Save theme preference when it changes
  useEffect(() => {
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, themeMode);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    };
    saveTheme();
  }, [themeMode]);

  // Determine actual color scheme
  const colorScheme = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  const value = useMemo(
    () => ({
      themeMode,
      colorScheme,
      setThemeMode: (mode: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => {
        if (typeof mode === 'function') {
          setThemeMode((mode as (prev: ThemeMode) => ThemeMode)(themeMode));
        } else {
          setThemeMode(mode);
        }
      },
    }),
    [themeMode, colorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
}
