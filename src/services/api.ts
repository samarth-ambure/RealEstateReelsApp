import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export const AUTH_TOKEN_KEY = '@auth_token';

/**
 * Retrieve the stored JWT token from AsyncStorage.
 */
export const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.warn('Failed to retrieve auth token from storage:', error);
    return null;
  }
};

/**
 * Persist the JWT token to AsyncStorage.
 */
export const setToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (error) {
    console.warn('Failed to save auth token to storage:', error);
  }
};

/**
 * Remove the JWT token from AsyncStorage.
 */
export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.warn('Failed to remove auth token from storage:', error);
  }
};

export interface ApiError extends Error {
  status?: number;
  data?: any;
}

/**
 * Centralized fetch wrapper that prepends API_BASE_URL, injects JWT headers,
 * sets Content-Type, and parses JSON with error handling.
 */
export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let responseData: any = null;
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      const text = await response.text();
      responseData = text ? JSON.parse(text) : null;
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const message =
      responseData?.message ||
      responseData?.error ||
      `Request failed with status ${response.status}`;
    const error: ApiError = new Error(message);
    error.status = response.status;
    error.data = responseData;
    throw error;
  }

  return responseData as T;
}

/**
 * HTTP verb convenience methods
 */
export const apiClient = {
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default apiClient;
