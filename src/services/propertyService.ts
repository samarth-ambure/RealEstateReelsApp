import { Property } from '@/types/property';
import { apiClient } from './api';

export interface PropertyQueryParams {
  search?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface CreatePropertyPayload {
  title: string;
  price: number | string;
  location: string;
  propertyType?: string;
  property_type?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  area?: number | string;
  description?: string;
  image?: string;
  agentName?: string;
  agent_name?: string;
  agentImage?: string;
  agent_image?: string;
}

/**
 * Format raw backend property (PostgreSQL schema with snake_case) into the Property model
 */
export function formatBackendProperty(raw: any): Property {
  const numericPrice =
    typeof raw.price === 'number'
      ? raw.price
      : parseFloat(String(raw.price).replace(/[^0-9.]/g, '')) || 0;

  const numericArea =
    typeof raw.area === 'number'
      ? raw.area
      : parseFloat(String(raw.area).replace(/[^0-9.]/g, '')) || 0;

  return {
    id: String(raw.id),
    title: raw.title || 'Untitled Property',
    price:
      typeof raw.price === 'string' && raw.price.startsWith('$')
        ? raw.price
        : `$${Math.round(numericPrice).toLocaleString()}`,
    location: raw.location || 'Location Unspecified',
    propertyType: raw.property_type || raw.propertyType || 'Apartment',
    bedrooms: Number(raw.bedrooms) || 0,
    bathrooms: Number(raw.bathrooms) || 0,
    area:
      typeof raw.area === 'string' && raw.area.includes('sq ft')
        ? raw.area
        : `${Math.round(numericArea).toLocaleString()} sq ft`,
    description: raw.description || '',
    image:
      raw.image ||
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    agentName:
      raw.agent_name ||
      raw.agentName ||
      raw.creator?.name ||
      'Owner',
    agentImage:
      raw.agent_image ||
      raw.agentImage ||
      raw.creator?.profile_image ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80',
    isLiked: Boolean(raw.isLiked ?? raw.is_liked ?? false),
    isSaved: Boolean(raw.isSaved ?? raw.is_saved ?? false),
    createdBy: raw.creator?.email || raw.userEmail || undefined,
  };
}

/**
 * Fetch properties from backend API with optional filter parameters
 */
export async function getProperties(
  params?: PropertyQueryParams
): Promise<Property[]> {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.append('search', params.search);
  if (params?.type && params.type !== 'All') queryParams.append('type', params.type);
  if (params?.minPrice !== undefined) queryParams.append('minPrice', String(params.minPrice));
  if (params?.maxPrice !== undefined) queryParams.append('maxPrice', String(params.maxPrice));

  const queryString = queryParams.toString();
  const endpoint = `/api/properties${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient.get<{ properties?: any[]; data?: any[] }>(endpoint);
  const rawList = response.properties || response.data || [];
  return rawList.map(formatBackendProperty);
}

/**
 * Fetch a single property by ID from the backend API
 */
export async function getPropertyById(id: number | string): Promise<Property | null> {
  try {
    const response = await apiClient.get<{ property?: any; data?: any }>(
      `/api/properties/${id}`
    );
    const raw = response.property || response.data;
    if (!raw) return null;
    return formatBackendProperty(raw);
  } catch (error: any) {
    if (error?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch properties created by a specific user (GET /api/properties/user/:userId)
 */
export async function getUserProperties(userId: number | string): Promise<Property[]> {
  try {
    const response = await apiClient.get<{ properties?: any[]; data?: any[] }>(
      `/api/properties/user/${userId}`
    );
    const rawList = response.properties || response.data || [];
    return rawList.map(formatBackendProperty);
  } catch (error) {
    console.warn(`Failed to fetch properties for user ${userId}:`, error);
    return [];
  }
}

/**
 * Create a new property listing on the backend API (POST /api/properties)
 */
export async function createProperty(
  data: CreatePropertyPayload
): Promise<Property> {
  const numericPrice =
    typeof data.price === 'number'
      ? data.price
      : parseFloat(String(data.price).replace(/[^0-9.]/g, '')) || 0;

  const numericArea =
    data.area !== undefined && data.area !== ''
      ? typeof data.area === 'number'
        ? data.area
        : parseFloat(String(data.area).replace(/[^0-9.]/g, '')) || 0
      : undefined;

  const numericBedrooms =
    data.bedrooms !== undefined && data.bedrooms !== ''
      ? Number(data.bedrooms)
      : undefined;

  const numericBathrooms =
    data.bathrooms !== undefined && data.bathrooms !== ''
      ? Number(data.bathrooms)
      : undefined;

  const payload = {
    title: data.title.trim(),
    price: numericPrice,
    location: data.location.trim(),
    propertyType: data.propertyType || data.property_type || 'Apartment',
    bedrooms: numericBedrooms,
    bathrooms: numericBathrooms,
    area: numericArea,
    description: data.description?.trim(),
    image: data.image?.trim(),
    agentName: data.agentName || data.agent_name,
    agentImage: data.agentImage || data.agent_image,
  };

  const response = await apiClient.post<{ message: string; property: any }>(
    '/api/properties',
    payload
  );

  return formatBackendProperty(response.property);
}

/**
 * Update an existing property listing on the backend API (PUT /api/properties/:id)
 */
export async function updateProperty(
  id: string | number,
  data: Partial<CreatePropertyPayload>
): Promise<Property> {
  const payload: Record<string, any> = {};

  if (data.title !== undefined) payload.title = data.title.trim();
  if (data.price !== undefined) {
    payload.price =
      typeof data.price === 'number'
        ? data.price
        : parseFloat(String(data.price).replace(/[^0-9.]/g, '')) || 0;
  }
  if (data.location !== undefined) payload.location = data.location.trim();
  if (data.propertyType !== undefined || data.property_type !== undefined) {
    payload.propertyType = data.propertyType || data.property_type;
  }
  if (data.bedrooms !== undefined && data.bedrooms !== '') {
    payload.bedrooms = Number(data.bedrooms);
  }
  if (data.bathrooms !== undefined && data.bathrooms !== '') {
    payload.bathrooms = Number(data.bathrooms);
  }
  if (data.area !== undefined && data.area !== '') {
    payload.area =
      typeof data.area === 'number'
        ? data.area
        : parseFloat(String(data.area).replace(/[^0-9.]/g, '')) || 0;
  }
  if (data.description !== undefined) payload.description = data.description.trim();
  if (data.image !== undefined) payload.image = data.image.trim();
  if (data.agentName !== undefined || data.agent_name !== undefined) {
    payload.agentName = data.agentName || data.agent_name;
  }
  if (data.agentImage !== undefined || data.agent_image !== undefined) {
    payload.agentImage = data.agentImage || data.agent_image;
  }

  const response = await apiClient.put<{ message: string; property: any }>(
    `/api/properties/${id}`,
    payload
  );

  return formatBackendProperty(response.property);
}

/**
 * Delete a property listing from the backend API (DELETE /api/properties/:id)
 */
export async function deleteProperty(
  id: string | number
): Promise<{ message: string }> {
  return await apiClient.delete<{ message: string }>(`/api/properties/${id}`);
}
