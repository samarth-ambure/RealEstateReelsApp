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
  onOpenCreator: (property: Property) => void;
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
  onOpenCreator,
}: PropertyReelCardProps) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const [failedCreatorImageUri, setFailedCreatorImageUri] = useState<string | null>(null);
  const hasImageError = !property.image || failedImageUri === property.image;
  const hasCreatorImageError =
    !property.agentImage || failedCreatorImageUri === property.agentImage;
  const creatorInitials = getCreatorInitials(property.agentName);

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

      <View pointerEvents="none" style={styles.bottomScrim} />
      <View pointerEvents="none" style={styles.bottomFade} />

      <View style={[styles.content, { paddingBottom: Math.max(bottomInset, 24) }]}>
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${property.agentName}'s profile`}
            style={({ pressed }) => [styles.creatorRow, pressed && styles.pressed]}
            onPress={() => onOpenCreator(property)}>
            {hasCreatorImageError ? (
              <View style={styles.creatorAvatarFallback}>
                <Text style={styles.creatorAvatarText}>{creatorInitials}</Text>
              </View>
            ) : (
              <Image
                source={{ uri: property.agentImage }}
                style={styles.creatorAvatar}
                contentFit="cover"
                onError={() => setFailedCreatorImageUri(property.agentImage)}
              />
            )}
            <Text style={styles.creatorName} numberOfLines={1}>
              {property.agentName}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View this property: ${property.title}`}
            style={({ pressed }) => [styles.propertyCta, pressed && styles.pressed]}
            onPress={() => onOpen(property.id)}>
            <Text style={styles.propertyCtaText}>View this property</Text>
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

function getCreatorInitials(name?: string) {
  if (!name?.trim()) {
    return 'RE';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
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
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
    backgroundColor: 'rgba(8, 12, 24, 0.48)',
  },
  content: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 12,
  },
  footer: {
    flex: 1,
    gap: 10,
    paddingRight: 4,
  },
  creatorRow: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  creatorAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  creatorAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  creatorName: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  propertyCta: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  propertyCtaText: {
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
