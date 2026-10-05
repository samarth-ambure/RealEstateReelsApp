export type Property = {
  id: string;
  title: string;
  price: string;
  location: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  area: string;
  description: string;
  image: string;
  agentName: string;
  agentImage: string;
  isLiked: boolean;
  isSaved: boolean;
  createdBy?: string;
  userId?: number;
  creator?: {
    id: number;
    name: string;
    email?: string;
    profile_image?: string;
  };
};
