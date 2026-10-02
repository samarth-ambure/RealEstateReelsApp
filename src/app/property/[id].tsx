import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { mockProperties } from '@/data/properties';
import {
    getLikeStatus,
    getSaveStatus,
    likeProperty,
    saveProperty,
    unlikeProperty,
    unsaveProperty,
} from '@/services/engagementService';
import { deleteProperty, getPropertyById } from '@/services/propertyService';
import { Property } from '@/types/property';

export default function PropertyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const propertyId = Array.isArray(id) ? id[0] : id;

  const [property, setProperty] = useState<Property | null>(null);
  const [isLoadingProperty, setIsLoadingProperty] = useState(true);

  const [hasLiked, setHasLiked] = useState<boolean | null>(null);
  const [hasSaved, setHasSaved] = useState<boolean | null>(null);

  const isLiked = hasLiked ?? property?.isLiked ?? false;
  const isSaved = hasSaved ?? property?.isSaved ?? false;

  useEffect(() => {
    let isMounted = true;

    const fetchProperty = async () => {
      if (!propertyId) {
        setIsLoadingProperty(false);
        return;
      }

      setIsLoadingProperty(true);
      try {
        const found = await getPropertyById(propertyId);
        if (isMounted) {
          if (found) {
            setProperty(found);
            if (user) {
              try {
                const [likeRes, saveRes] = await Promise.all([
                  getLikeStatus(propertyId),
                  getSaveStatus(propertyId),
                ]);
                if (isMounted) {
                  setHasLiked(likeRes.isLiked);
                  setHasSaved(saveRes.isSaved);
                }
              } catch {
                // Ignore status query errors, use property defaults
              }
            }
          } else {
            const fallback =
              mockProperties.find((item) => item.id === propertyId) ?? null;
            setProperty(fallback);
          }
        }
      } catch (err) {
        console.warn('Error fetching property from backend:', err);
        if (isMounted) {
          const fallback =
            mockProperties.find((item) => item.id === propertyId) ?? null;
          setProperty(fallback);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProperty(false);
        }
      }
    };

    fetchProperty();

    return () => {
      isMounted = false;
    };
  }, [propertyId, user]);

  const handleContactAgent = () => {
    Alert.alert(
      'Contact Agent',
      'Contact Agent functionality will be available soon.',
    );
  };

  const handleToggleLike = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to like properties.');
      return;
    }
    if (!property) return;

    const newLikedState = !isLiked;
    setHasLiked(newLikedState);

    try {
      if (newLikedState) {
        await likeProperty(property.id);
      } else {
        await unlikeProperty(property.id);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setHasLiked(isLiked);
    }
  };

  const handleToggleSave = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save properties.');
      return;
    }
    if (!property) return;

    const newSavedState = !isSaved;
    setHasSaved(newSavedState);

    try {
      if (newSavedState) {
        await saveProperty(property.id);
      } else {
        await unsaveProperty(property.id);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      setHasSaved(isSaved);
    }
  };

  const isOwner = Boolean(
    user &&
      property &&
      (property.createdBy === user.email || property.agentName === user.name)
  );

  const handleDeleteProperty = () => {
    if (!property) return;

    Alert.alert(
      'Delete Property',
      'Are you sure you want to permanently delete this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProperty(property.id);
              Alert.alert('Deleted', 'Property has been successfully deleted.');
              router.replace('/home');
            } catch (err: any) {
              Alert.alert(
                'Delete Failed',
                err?.message || 'Unable to delete property. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  if (isLoadingProperty) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundTitle}>Property not found</Text>
        <Text style={styles.notFoundText}>
          This listing may have been removed or the link is invalid.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/home')}>
          <Text style={styles.primaryButtonText}>Return to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: property.image }} style={styles.heroImage} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={() => router.back()}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.headingRow}>
            <View style={styles.headingText}>
              <Text style={styles.price}>{property.price}</Text>
              <Text style={styles.title}>{property.title}</Text>
              <Text style={styles.location}>{property.location}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.secondaryButton, isLiked && styles.activeButton]}
              onPress={handleToggleLike}>
              <Text
                style={[
                  styles.secondaryButtonText,
                  isLiked && styles.activeButtonText,
                ]}>
                {isLiked ? '❤️ Liked' : '🤍 Like'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, isSaved && styles.activeButton]}
              onPress={handleToggleSave}>
              <Text
                style={[
                  styles.secondaryButtonText,
                  isSaved && styles.activeButtonText,
                ]}>
                {isSaved ? '🔖 Saved' : '📑 Save'}
              </Text>
            </Pressable>
          </View>

          {isOwner && (
            <View style={styles.ownerActionsRow}>
              <Pressable
                style={[styles.ownerButton, styles.editButton]}
                onPress={() =>
                  router.push({
                    pathname: '/create-property',
                    params: { id: property.id },
                  })
                }>
                <Text style={styles.editButtonText}>✏️ Edit Listing</Text>
              </Pressable>

              <Pressable
                style={[styles.ownerButton, styles.deleteButton]}
                onPress={handleDeleteProperty}>
                <Text style={styles.deleteButtonText}>🗑️ Delete Listing</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.statsGrid}>
            <StatCard label="Type" value={property.propertyType} />
            <StatCard label="Bedrooms" value={`${property.bedrooms}`} />
            <StatCard label="Bathrooms" value={`${property.bathrooms}`} />
            <StatCard label="Area" value={property.area} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.description}>{property.description}</Text>
          </View>

          <View style={styles.agentCard}>
            <Image
              source={{ uri: property.agentImage }}
              style={styles.agentImage}
            />
            <View style={styles.agentDetails}>
              <Text style={styles.agentLabel}>Listing Agent</Text>
              <Text style={styles.agentName}>{property.agentName}</Text>
              <Text style={styles.agentMeta}>
                Local real-estate specialist
              </Text>
            </View>
          </View>

          <Pressable style={styles.contactButton} onPress={handleContactAgent}>
            <Text style={styles.contactButtonText}>Contact Agent</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

type StatCardProps = {
  label: string;
  value: string;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 34,
  },
  hero: {
    height: 360,
    backgroundColor: '#111827',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 54,
    left: 18,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '600',
  },
  body: {
    marginTop: -24,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#f6f7f9',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  headingRow: {
    flexDirection: 'row',
    gap: 14,
  },
  headingText: {
    flex: 1,
  },
  price: {
    color: '#111827',
    fontSize: 31,
    fontWeight: '800',
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    marginTop: 8,
  },
  location: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activeButton: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  activeButtonText: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 22,
  },
  statCard: {
    width: '47%',
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 16,
    borderWidth: 1,
    borderColor: '#edf0f4',
  },
  statValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  description: {
    color: '#374151',
    fontSize: 16,
    lineHeight: 24,
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 26,
    borderWidth: 1,
    borderColor: '#edf0f4',
  },
  agentImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#d1d5db',
  },
  agentDetails: {
    flex: 1,
  },
  agentLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  agentName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 3,
  },
  agentMeta: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  contactButton: {
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#111827',
    paddingVertical: 17,
    marginTop: 18,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f7f9',
    padding: 24,
  },
  notFoundTitle: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  notFoundText: {
    color: '#6b7280',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f7f9',
  },
  ownerActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  ownerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
  },
  editButton: {
    backgroundColor: '#111827',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '800',
  },
});
