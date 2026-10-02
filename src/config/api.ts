import { Platform } from 'react-native';

const getDefaultBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
};

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL || getDefaultBaseUrl();

export default API_BASE_URL;
