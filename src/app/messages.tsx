import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();

  const handleOpenHome = () => {
    router.push('/home');
  };

  const handleOpenPost = () => {
    router.push('/create-property');
  };

  const handleOpenProfile = () => {
    router.push('/profile');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchBar}>
        <View style={styles.searchInputContainer}>
          <AppIcon
            ios="magnifyingglass"
            android="search"
            size={16}
            color="#94a3b8"
            fallback="⌕"
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#94a3b8"
            editable={false}
          />
        </View>
      </View>

      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <AppIcon
            ios="bubble.left.and.bubble.right"
            android="chat"
            size={48}
            color="#93c5fd"
            fallback="💬"
          />
        </View>
        <Text style={styles.emptyTitle}>Messages coming soon</Text>
        <Text style={styles.emptyText}>
          Messaging will be available in a future update.
        </Text>
      </View>

      <View style={[styles.bottomNavWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.bottomNav}>
          <NavItem
            label="Home"
            ios="house.fill"
            android="home"
            fallback="⌂"
            onPress={handleOpenHome}
          />
          <NavItem
            label="Messages"
            ios="bubble.left.and.bubble.right.fill"
            android="chat"
            fallback="💬"
            isActive
            onPress={() => undefined}
          />
          <NavItem
            label="Post"
            ios="plus.circle.fill"
            android="add_circle"
            fallback="＋"
            onPress={handleOpenPost}
          />
          <NavItem
            label="Profile"
            ios="person.fill"
            android="person"
            fallback="👤"
            onPress={handleOpenProfile}
          />
        </View>
      </View>
    </View>
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

function NavItem({
  label,
  ios,
  android,
  fallback,
  isActive = false,
  onPress,
}: {
  label: string;
  ios: string;
  android: string;
  fallback: string;
  isActive?: boolean;
  onPress: () => void;
}) {
  const color = isActive ? '#1d4ed8' : '#64748b';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
      onPress={onPress}>
      <AppIcon ios={ios} android={android} size={22} color={color} fallback={fallback} />
      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomNavWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  navLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  navLabelActive: {
    color: '#1d4ed8',
  },
  pressed: {
    opacity: 0.7,
  },
});
