/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemeContext } from '@/context/ThemeContext';

export function useTheme() {
  const { colorScheme } = useThemeContext();
  return Colors[colorScheme];
}
