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

import { mockProperties } from '@/data/properties';
import { getPropertyById } from '@/database/propertyRepository';
import { Property } from '@/types/property';

export default function PropertyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = Array.isArray(id) ? id[0] : id;

  const mockProperty = useMemo(
    () => mockProperties.find((item) => item.id === propertyId) ?? null,
    [propertyId],
  );

  const [userProperty, setUserProperty] = useState<Property | null>(null);
  const [isLoadingUserProperty, setIsLoadingUserProperty] = useState(!mockProperty);

  const property = mockProperty ?? userProperty;

  const [hasLiked, setHasLiked] = useState<boolean | null>(null);
  const [hasSaved, setHasSaved] = useState<boolean | null>(null);

  const isLiked = hasLiked ?? property?.isLiked ?? false;
  const isSaved = hasSaved ?? property?.isSaved ?? false;

  useEffect(() => {
    if (mockProperty) {
      return;
    }

    let isMounted = true;
    const fetchProperty = async () => {
      try {
        const found = await getPropertyById(propertyId ?? '');
        if (isMounted) {
          setUserProperty(found);
        }
      } catch {
        if (isMounted) {
          setUserProperty(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingUserProperty(false);
        }
      }
    };

    fetchProperty();

    return () => {
      isMounted = false;
    };
  }, [mockProperty, propertyId]);

  const handleContactAgent = () => {
    Alert.alert(
      'Contact Agent',
      'Contact Agent functionality will be available soon.',
    );
  };

  const handleToggleLike = () => {
    setHasLiked(!isLiked);
  };

  const handleToggleSave = () => {
    setHasSaved(!isSaved);
  };

  if (isLoadingUserProperty) {
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
});
