import { apiClient } from './api';

export interface UserStats {
  posted_properties: number;
  postedProperties?: number;
  liked_properties: number;
  likedProperties?: number;
  saved_properties: number;
  savedProperties?: number;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  bio?: string | null;
  profile_image?: string | null;
  profileImage?: string | null;
  created_at?: string;
  createdAt?: string;
  stats?: UserStats;
}

export interface UpdateProfilePayload {
  name?: string;
  bio?: string | null;
  profile_image?: string | null;
  profileImage?: string | null;
  email?: string;
}

export interface ProfileResponse {
  message?: string;
  user: UserProfile;
  stats?: UserStats;
}

/**
 * Fetch the authenticated user's profile and live statistics
 * Calls GET /api/users/profile
 */
export async function getCurrentProfile(): Promise<ProfileResponse> {
  const data = await apiClient.get<ProfileResponse>('/api/users/profile');
  return data;
}

/**
 * Update the authenticated user's profile (name, bio, profile image)
 * Calls PUT /api/users/profile
 */
export async function updateProfile(data: UpdateProfilePayload): Promise<ProfileResponse> {
  const response = await apiClient.put<ProfileResponse>('/api/users/profile', data);
  return response;
}

/**
 * Fetch public user profile and live statistics by user ID
 * Calls GET /api/users/:id
 */
export async function getUserById(id: string | number): Promise<ProfileResponse> {
  const response = await apiClient.get<ProfileResponse>(`/api/users/${id}`);
  return response;
}

export const userService = {
  getCurrentProfile,
  updateProfile,
  getUserById,
};

export default userService;
