import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Property } from '@/types/property';

type PropertyReelCardProps = {
  property: Property;
  height: number;
  bottomInset?: number;
  onLike: (propertyId: string) => void;
  onSave: (propertyId: string) => void;
  onComment: (property: Property) => void;
  onShare: (property: Property) => void;
  onOpen: (propertyId: string) => void;
};

export function PropertyReelCard({
  property,
  height,
  bottomInset = 24,
  onLike,
  onSave,
  onComment,
  onShare,
  onOpen,
}: PropertyReelCardProps) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const hasImageError = !property.image || failedImageUri === property.image;

  const badgeLabel = property.propertyType?.trim() || 'For Sale';

  return (
    <View style={[styles.container, { height }]}>
      {hasImageError ? (
        <View style={styles.fallback}>
          <AppIcon
            ios="house.fill"
            android="home"
            size={42}
            color="rgba(255,255,255,0.55)"
            fallback="⌂"
          />
          <Text style={styles.fallbackText}>Property photo unavailable</Text>
        </View>
      ) : (
        <Image
          source={{ uri: property.image }}
          style={styles.image}
          contentFit="cover"
          onError={() => setFailedImageUri(property.image)}
        />
      )}

      <View pointerEvents="none" style={styles.topScrim} />
      <View pointerEvents="none" style={styles.bottomScrim} />
      <View pointerEvents="none" style={styles.bottomFade} />

      <View style={[styles.content, { paddingBottom: Math.max(bottomInset, 24) }]}>
        <View style={styles.details}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>

          <Text style={styles.price}>{property.price}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {property.title}
          </Text>
          <View style={styles.locationRow}>
            <AppIcon
              ios="mappin.and.ellipse"
              android="location_on"
              size={14}
              color="rgba(255,255,255,0.78)"
              fallback="📍"
            />
            <Text style={styles.location} numberOfLines={1}>
              {property.location}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <Stat
              ios="bed.double.fill"
              android="bed"
              fallback="🛏"
              value={`${property.bedrooms} Beds`}
            />
            <Stat
              ios="shower.fill"
              android="bathtub"
              fallback="🛁"
              value={`${property.bathrooms} Baths`}
            />
            <Stat ios="square.dashed" android="square_foot" fallback="📐" value={property.area} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View details for ${property.title}`}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={() => onOpen(property.id)}>
            <Text style={styles.ctaText}>View Details</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <ActionButton
            label="Like"
            ios={property.isLiked ? 'heart.fill' : 'heart'}
            android={property.isLiked ? 'favorite' : 'favorite_border'}
            fallback={property.isLiked ? '❤️' : '♡'}
            isActive={property.isLiked}
            activeColor="#fb7185"
            onPress={() => onLike(property.id)}
          />
          <ActionButton
            label="Comment"
            ios="bubble.right"
            android="chat_bubble_outline"
            fallback="💬"
            onPress={() => onComment(property)}
          />
          <ActionButton
            label="Save"
            ios={property.isSaved ? 'bookmark.fill' : 'bookmark'}
            android={property.isSaved ? 'bookmark' : 'bookmark_border'}
            fallback={property.isSaved ? '🔖' : '📑'}
            isActive={property.isSaved}
            activeColor="#93c5fd"
            onPress={() => onSave(property.id)}
          />
          <ActionButton
            label="Share"
            ios="square.and.arrow.up"
            android="share"
            fallback="↗"
            onPress={() => onShare(property)}
          />
        </View>
      </View>
    </View>
  );
}

function Stat({
  ios,
  android,
  fallback,
  value,
}: {
  ios: string;
  android: string;
  fallback: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <AppIcon ios={ios} android={android} size={14} color="#fff" fallback={fallback} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  ios: string;
  android: string;
  fallback: string;
  isActive?: boolean;
  activeColor?: string;
  onPress: () => void;
};

function ActionButton({
  label,
  ios,
  android,
  fallback,
  isActive = false,
  activeColor = '#fff',
  onPress,
}: ActionButtonProps) {
  const iconColor = isActive ? activeColor : '#fff';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionButton,
        isActive && styles.activeActionButton,
        pressed && styles.pressed,
      ]}
      onPress={onPress}>
      <View style={styles.actionIconWrap}>
        <AppIcon
          ios={ios}
          android={android}
          size={22}
          color={iconColor}
          fallback={fallback}
        />
      </View>
      <Text style={[styles.actionLabel, isActive && { color: iconColor }]}>{label}</Text>
    </Pressable>
  );
}

function AppIcon({
  ios,
  android,
  size,
  color,
  fallback,
}: {
  ios: string;
  android: string;
  size: number;
  color: string;
  fallback: string;
}) {
  return (
    <SymbolView
      name={{ ios: ios as never, android: android as never, web: android as never }}
      size={size}
      tintColor={color}
      fallback={<Text style={{ color, fontSize: size * 0.9, lineHeight: size }}>{fallback}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0b1220',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    gap: 12,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 340,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    backgroundColor: 'rgba(8, 12, 24, 0.55)',
  },
  content: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 12,
  },
  details: {
    flex: 1,
    gap: 8,
    paddingRight: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  price: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  location: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  activeActionButton: {
    transform: [{ scale: 1.02 }],
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
});
