import { Property } from '@/types/property';
import { apiClient } from './api';
import { formatBackendProperty } from './propertyService';

export interface LikeResponse {
  message: string;
  isLiked: boolean;
  likeCount: number;
}

export interface SaveResponse {
  message: string;
  isSaved: boolean;
}

export interface LikeStatusResponse {
  property_id: number;
  isLiked: boolean;
  likeCount: number;
}

export interface SaveStatusResponse {
  property_id: number;
  isSaved: boolean;
}

/**
 * Like a property (POST /api/properties/:id/like)
 */
export async function likeProperty(
  propertyId: string | number
): Promise<LikeResponse> {
  const response = await apiClient.post<any>(
    `/api/properties/${propertyId}/like`
  );
  return {
    message: response.message,
    isLiked: Boolean(response.isLiked ?? response.is_liked ?? true),
    likeCount: Number(response.likeCount ?? response.likes_count ?? 0),
  };
}

/**
 * Unlike a property (DELETE /api/properties/:id/like)
 */
export async function unlikeProperty(
  propertyId: string | number
): Promise<LikeResponse> {
  const response = await apiClient.delete<any>(
    `/api/properties/${propertyId}/like`
  );
  return {
    message: response.message,
    isLiked: Boolean(response.isLiked ?? response.is_liked ?? false),
    likeCount: Number(response.likeCount ?? response.likes_count ?? 0),
  };
}

/**
 * Get like status for a property (GET /api/properties/:id/like)
 */
export async function getLikeStatus(
  propertyId: string | number
): Promise<LikeStatusResponse> {
  const response = await apiClient.get<any>(
    `/api/properties/${propertyId}/like`
  );
  return {
    property_id: Number(response.property_id),
    isLiked: Boolean(response.isLiked ?? response.is_liked ?? false),
    likeCount: Number(response.likeCount ?? response.likes_count ?? 0),
  };
}

/**
 * Save / Bookmark a property (POST /api/properties/:id/save)
 */
export async function saveProperty(
  propertyId: string | number
): Promise<SaveResponse> {
  const response = await apiClient.post<any>(
    `/api/properties/${propertyId}/save`
  );
  return {
    message: response.message,
    isSaved: Boolean(response.isSaved ?? response.is_saved ?? true),
  };
}

/**
 * Unsave a property (DELETE /api/properties/:id/save)
 */
export async function unsaveProperty(
  propertyId: string | number
): Promise<SaveResponse> {
  const response = await apiClient.delete<any>(
    `/api/properties/${propertyId}/save`
  );
  return {
    message: response.message,
    isSaved: Boolean(response.isSaved ?? response.is_saved ?? false),
  };
}

/**
 * Get save status for a property (GET /api/properties/:id/save)
 */
export async function getSaveStatus(
  propertyId: string | number
): Promise<SaveStatusResponse> {
  const response = await apiClient.get<any>(
    `/api/properties/${propertyId}/save`
  );
  return {
    property_id: Number(response.property_id),
    isSaved: Boolean(response.isSaved ?? response.is_saved ?? false),
  };
}

/**
 * Get all saved properties for the authenticated user (GET /api/properties/saved)
 */
export async function getSavedProperties(): Promise<Property[]> {
  try {
    const response = await apiClient.get<{ properties?: any[]; data?: any[] }>(
      '/api/properties/saved'
    );
    const rawList = response.properties || response.data || [];
    return rawList.map((raw) => ({
      ...formatBackendProperty(raw),
      isSaved: true,
    }));
  } catch (error) {
    console.warn('Failed to fetch saved properties:', error);
    return [];
  }
}
