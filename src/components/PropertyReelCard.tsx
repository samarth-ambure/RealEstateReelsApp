import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Property } from '@/types/property';

type PropertyReelCardProps = {
  property: Property;
  height: number;
  onLike: (propertyId: string) => void;
  onSave: (propertyId: string) => void;
  onComment: (property: Property) => void;
  onShare: (property: Property) => void;
  onOpen: (propertyId: string) => void;
};

export function PropertyReelCard({
  property,
  height,
  onLike,
  onSave,
  onComment,
  onShare,
  onOpen,
}: PropertyReelCardProps) {
  return (
    <View style={[styles.container, { height }]}>
      <ImageBackground
        source={{ uri: property.image }}
        style={styles.image}
        resizeMode="cover">
        <View style={styles.overlay}>
          <View style={styles.content}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View details for ${property.title}`}
              style={styles.details}
              onPress={() => onOpen(property.id)}>
              <Text style={styles.price}>{property.price}</Text>
              <Text style={styles.title}>{property.title}</Text>
              <Text style={styles.location}>{property.location}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaPill}>{property.propertyType}</Text>
                <Text style={styles.metaPill}>{property.bedrooms} Beds</Text>
                <Text style={styles.metaPill}>{property.bathrooms} Baths</Text>
                <Text style={styles.metaPill}>{property.area}</Text>
              </View>

              <Text style={styles.description} numberOfLines={3}>
                {property.description}
              </Text>

              <View style={styles.agentRow}>
                <Image
                  source={{ uri: property.agentImage }}
                  style={styles.agentImage}
                />
                <View>
                  <Text style={styles.agentLabel}>Listed by</Text>
                  <Text style={styles.agentName}>{property.agentName}</Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.actions}>
              <ActionButton
                label={property.isLiked ? 'Liked' : 'Like'}
                icon={property.isLiked ? '❤️' : '🤍'}
                isActive={property.isLiked}
                onPress={() => onLike(property.id)}
              />
              <ActionButton
                label={property.isSaved ? 'Saved' : 'Save'}
                icon={property.isSaved ? '🔖' : '📑'}
                isActive={property.isSaved}
                onPress={() => onSave(property.id)}
              />
              <ActionButton
                label="Comment"
                icon="💬"
                onPress={() => onComment(property)}
              />
              <ActionButton
                label="Share"
                icon="↗"
                onPress={() => onShare(property)}
              />
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  icon: string;
  isActive?: boolean;
  onPress: () => void;
};

function ActionButton({ label, icon, isActive = false, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.actionButton, isActive && styles.activeActionButton]}
      onPress={onPress}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#111',
  },
  image: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 34,
    gap: 14,
  },
  details: {
    flex: 1,
    gap: 8,
  },
  price: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  title: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 27,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  location: {
    color: '#f3f4f6',
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metaPill: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  description: {
    color: '#f9fafb',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 310,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  agentImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#ddd',
  },
  agentLabel: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  agentName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  actionButton: {
    width: 58,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
    paddingVertical: 8,
  },
  activeActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  actionIcon: {
    color: '#fff',
    fontSize: 22,
    textAlign: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
});
