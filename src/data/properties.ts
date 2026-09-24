import { Property } from '@/types/property';

export const mockProperties: Property[] = [
  {
    id: 'skyline-penthouse',
    title: 'Skyline Penthouse With Private Terrace',
    price: '$1,250,000',
    location: 'Downtown Miami, FL',
    propertyType: 'Penthouse',
    bedrooms: 3,
    bathrooms: 3,
    area: '2,420 sq ft',
    description:
      'A bright top-floor residence with floor-to-ceiling glass, city views, and an entertainer-ready terrace.',
    image:
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
    agentName: 'Maya Rodriguez',
    agentImage:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80',
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'lakefront-villa',
    title: 'Lakefront Villa With Infinity Pool',
    price: '$2,850,000',
    location: 'Lake Austin, TX',
    propertyType: 'Villa',
    bedrooms: 5,
    bathrooms: 5,
    area: '5,100 sq ft',
    description:
      'Resort-style living with open-plan interiors, a chef kitchen, private dock access, and sunset lake views.',
    image:
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
    agentName: 'Daniel Brooks',
    agentImage:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
    isLiked: false,
    isSaved: true,
  },
  {
    id: 'modern-townhouse',
    title: 'Modern Townhouse Near The Arts District',
    price: '$785,000',
    location: 'Charlotte, NC',
    propertyType: 'Townhouse',
    bedrooms: 4,
    bathrooms: 3,
    area: '2,050 sq ft',
    description:
      'Low-maintenance urban living with a rooftop lounge, flexible office nook, and two-car garage.',
    image:
      'https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=1200&q=80',
    agentName: 'Priya Shah',
    agentImage:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=240&q=80',
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'coastal-bungalow',
    title: 'Renovated Coastal Bungalow Steps From Sand',
    price: '$940,000',
    location: 'Santa Cruz, CA',
    propertyType: 'Bungalow',
    bedrooms: 2,
    bathrooms: 2,
    area: '1,360 sq ft',
    description:
      'A breezy beach retreat with warm wood accents, updated baths, and a garden patio for slow mornings.',
    image:
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
    agentName: 'Ethan Miller',
    agentImage:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80',
    isLiked: true,
    isSaved: false,
  },
  {
    id: 'suburban-family-home',
    title: 'Move-In Ready Family Home With Backyard',
    price: '$625,000',
    location: 'Scottsdale, AZ',
    propertyType: 'Single Family',
    bedrooms: 4,
    bathrooms: 3,
    area: '2,780 sq ft',
    description:
      'Spacious everyday comfort with a sunny breakfast area, covered patio, smart upgrades, and mature landscaping.',
    image:
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
    agentName: 'Lena Carter',
    agentImage:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80',
    isLiked: false,
    isSaved: false,
  },
];
