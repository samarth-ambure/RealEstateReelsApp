import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ListRenderItem,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PropertyReelCard } from '@/components/PropertyReelCard';
import { useAuth } from '@/context/AuthContext';
import { mockProperties } from '@/data/properties';
import {
    likeProperty,
    saveProperty,
    unlikeProperty,
    unsaveProperty,
} from '@/services/engagementService';
import { getProperties } from '@/services/propertyService';
import { notificationService } from '@/services/notificationService';
import { Property } from '@/types/property';

type BedroomFilter = 'Any' | '1' | '2' | '3' | '4+';
type PriceFilter = 'Any' | 'Under $750K' | '$750K - $1M' | '$1M - $2M' | 'Above $2M';

type FilterState = {
  propertyType: string;
  location: string;
  bedrooms: BedroomFilter;
  price: PriceFilter;
};

const DEFAULT_FILTERS: FilterState = {
  propertyType: 'All',
  location: 'All',
  bedrooms: 'Any',
  price: 'Any',
};

const BEDROOM_OPTIONS: BedroomFilter[] = ['Any', '1', '2', '3', '4+'];
const PRICE_OPTIONS: PriceFilter[] = [
  'Any',
  'Under $750K',
  '$750K - $1M',
  '$1M - $2M',
  'Above $2M',
];

function getPropertyPriceValue(price: string) {
  return Number(price.replace(/[^0-9]/g, ''));
}

function matchesPriceFilter(property: Property, priceFilter: PriceFilter) {
  const price = getPropertyPriceValue(property.price);

  switch (priceFilter) {
    case 'Under $750K':
      return price < 750000;
    case '$750K - $1M':
      return price >= 750000 && price <= 1000000;
    case '$1M - $2M':
      return price > 1000000 && price <= 2000000;
    case 'Above $2M':
      return price > 2000000;
    default:
      return true;
  }
}

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);

  const loadProperties = useCallback(async () => {
    try {
      const apiProperties = await getProperties();

      setProperties((currentProperties) => {
        const likedSavedById = new Map(
          currentProperties.map((property) => [
            property.id,
            { isLiked: property.isLiked, isSaved: property.isSaved },
          ]),
        );

        const propertiesToDisplay =
          apiProperties.length > 0 ? apiProperties : mockProperties;

        return propertiesToDisplay.map((property) => {
          const previous = likedSavedById.get(property.id);
          return previous
            ? { ...property, isLiked: previous.isLiked, isSaved: previous.isSaved }
            : property;
        });
      });
    } catch (error) {
      console.warn('Error fetching properties from backend API:', error);
      setProperties((current) => (current.length > 0 ? current : mockProperties));
    } finally {
      setIsFeedLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setUnreadNotificationCount(data.unreadCount ?? data.unread_count ?? 0);
    } catch {
      // ignore network errors for badge
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProperties();
      void loadUnreadCount();
    }, [loadProperties, loadUnreadCount]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadProperties();
    void loadUnreadCount();
  }, [loadProperties, loadUnreadCount]);

  const propertyTypeOptions = useMemo(
    () => [
      'All',
      ...Array.from(new Set(properties.map((property) => property.propertyType))),
    ],
    [properties],
  );

  const locationOptions = useMemo(
    () => [
      'All',
      ...Array.from(new Set(properties.map((property) => property.location))),
    ],
    [properties],
  );

  const activeFilterCount = useMemo(
    () =>
      [
        filters.propertyType !== DEFAULT_FILTERS.propertyType,
        filters.location !== DEFAULT_FILTERS.location,
        filters.bedrooms !== DEFAULT_FILTERS.bedrooms,
        filters.price !== DEFAULT_FILTERS.price,
      ].filter(Boolean).length,
    [filters],
  );

  const isSearchActive = searchQuery.trim().length > 0;
  const isFilteringActive = isSearchActive || activeFilterCount > 0;

  const filteredProperties = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return properties.filter((property) => {
      const searchableText = [
        property.title,
        property.location,
        property.propertyType,
        property.description,
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      const matchesPropertyType =
        filters.propertyType === 'All' ||
        property.propertyType === filters.propertyType;

      const matchesLocation =
        filters.location === 'All' || property.location === filters.location;

      const matchesBedrooms =
        filters.bedrooms === 'Any' ||
        (filters.bedrooms === '4+'
          ? property.bedrooms >= 4
          : property.bedrooms === Number(filters.bedrooms));

      return (
        matchesSearch &&
        matchesPropertyType &&
        matchesLocation &&
        matchesBedrooms &&
        matchesPriceFilter(property, filters.price)
      );
    });
  }, [filters, properties, searchQuery]);

  const resultCountText =
    filteredProperties.length === 1
      ? '1 property found'
      : `${filteredProperties.length} properties found`;

  const handleOpenProfile = () => {
    router.push('/profile');
  };

  const handleOpenPost = () => {
    router.push('/create-property');
  };

  const handleOpenMessages = () => {
    router.push('/messages');
  };

  const handleOpenNotifications = () => {
    router.push('/notifications' as any);
  };

  const handleLike = useCallback(
    async (propertyId: string) => {
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in to like properties.');
        return;
      }

      const property = properties.find((p) => p.id === propertyId);
      if (!property) return;

      const newLikedState = !property.isLiked;

      // Optimistic UI update
      setProperties((currentProperties) =>
        currentProperties.map((p) =>
          p.id === propertyId ? { ...p, isLiked: newLikedState } : p,
        ),
      );

      // Persist to backend API
      try {
        if (newLikedState) {
          await likeProperty(propertyId);
        } else {
          await unlikeProperty(propertyId);
        }
      } catch (error) {
        console.error('Error toggling like:', error);
        // Revert on error
        setProperties((currentProperties) =>
          currentProperties.map((p) =>
            p.id === propertyId ? { ...p, isLiked: property.isLiked } : p,
          ),
        );
      }
    },
    [properties, user],
  );

  const handleSave = useCallback(
    async (propertyId: string) => {
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in to save properties.');
        return;
      }

      const property = properties.find((p) => p.id === propertyId);
      if (!property) return;

      const newSavedState = !property.isSaved;

      // Optimistic UI update
      setProperties((currentProperties) =>
        currentProperties.map((p) =>
          p.id === propertyId ? { ...p, isSaved: newSavedState } : p,
        ),
      );

      // Persist to backend API
      try {
        if (newSavedState) {
          await saveProperty(propertyId);
        } else {
          await unsaveProperty(propertyId);
        }
      } catch (error) {
        console.error('Error toggling save:', error);
        // Revert on error
        setProperties((currentProperties) =>
          currentProperties.map((p) =>
            p.id === propertyId ? { ...p, isSaved: property.isSaved } : p,
          ),
        );
      }
    },
    [properties, user],
  );

  const handleComment = useCallback((property: Property) => {
    Alert.alert(
      'Comments coming soon',
      `You will be able to comment on ${property.title} in a future update.`,
    );
  }, []);

  const handleShare = useCallback(async (property: Property) => {
    await Share.share({
      title: property.title,
      message: `${property.title}\n${property.price}\n${property.location}`,
    });
  }, []);

  const handleOpenProperty = useCallback((propertyId: string) => {
    router.push({
      pathname: '/property/[id]',
      params: { id: propertyId },
    });
  }, []);

  const handleOpenCreator = useCallback((property: Property) => {
    const creatorId = property.userId || property.creator?.id;
    if (creatorId) {
      router.push({
        pathname: '/profile',
        params: { userId: String(creatorId) },
      });
      return;
    }

    router.push({
      pathname: '/profile',
      params: {
        displayName: property.agentName,
        displayImage: property.agentImage,
      },
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setSearchQuery('');
    setFilters(DEFAULT_FILTERS);
    setIsSearchExpanded(false);
  }, []);

  const bottomNavHeight = 64 + Math.max(insets.bottom, 12);
  const reelBottomInset = bottomNavHeight + 12;

  const renderProperty: ListRenderItem<Property> = useCallback(
    ({ item }) => (
      <PropertyReelCard
        property={item}
        height={height}
        bottomInset={reelBottomInset}
        onLike={handleLike}
        onSave={handleSave}
        onComment={handleComment}
        onShare={handleShare}
        onOpen={handleOpenProperty}
        onOpenCreator={handleOpenCreator}
      />
    ),
    [
      handleComment,
      handleLike,
      handleOpenCreator,
      handleOpenProperty,
      handleSave,
      handleShare,
      height,
      reelBottomInset,
    ],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Property> | null | undefined, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height],
  );

  const isSearchOpen = isSearchExpanded || isSearchActive;

  return (
    <View style={styles.container}>
      {isFeedLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loadingText}>Loading homes</Text>
        </View>
      ) : filteredProperties.length > 0 ? (
        <FlatList
          data={filteredProperties}
          renderItem={renderProperty}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <AppIcon
              ios="magnifyingglass"
              android="search"
              size={28}
              color="#93c5fd"
              fallback="⌕"
            />
          </View>
          <Text style={styles.emptyTitle}>No properties found</Text>
          <Text style={styles.emptyText}>Try changing your search or filters.</Text>
          <Pressable
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
            onPress={handleClearAll}>
            <Text style={styles.emptyButtonText}>Clear Filters</Text>
          </Pressable>
        </View>
      )}

      <View
        pointerEvents="box-none"
        style={[styles.topOverlay, { paddingTop: insets.top + 4 }]}>
        <View style={styles.searchRow}>
          {isSearchOpen ? (
            <View style={styles.searchInputWrap}>
              <AppIcon
                ios="magnifyingglass"
                android="search"
                size={16}
                color="#1e293b"
                fallback="⌕"
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoFocus
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close search"
                style={styles.clearSearchButton}
                onPress={() => {
                  setSearchQuery('');
                  setIsSearchExpanded(false);
                }}>
                <AppIcon ios="xmark" android="close" size={14} color="#334155" fallback="×" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search properties"
              style={({ pressed }) => [styles.searchIconButton, pressed && styles.pressed]}
              onPress={() => setIsSearchExpanded(true)}>
              <AppIcon
                ios="magnifyingglass"
                android="search"
                size={18}
                color="#1e293b"
                fallback="⌕"
              />
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={({ pressed }) => [styles.notificationIconButton, pressed && styles.pressed]}
            onPress={handleOpenNotifications}>
            <AppIcon
              ios="bell.fill"
              android="notifications"
              size={18}
              color="#1e293b"
              fallback="🔔"
            />
            {unreadNotificationCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filters"
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
            onPress={() => setIsFilterVisible(true)}>
            <AppIcon ios="slider.horizontal.3" android="tune" size={16} color="#fff" fallback="☰" />
            <Text style={styles.filterButtonText}>Filter</Text>
            {activeFilterCount ? (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {isFilteringActive ? (
          <View style={styles.resultRow}>
            <Text style={styles.resultText}>{resultCountText}</Text>
            <Pressable onPress={handleClearAll} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottomNavWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.bottomNav}>
          <NavItem
            label="Home"
            ios="house.fill"
            android="home"
            fallback="⌂"
            isActive
            onPress={() => undefined}
          />
          <NavItem
            label="Messages"
            ios="bubble.left.and.bubble.right.fill"
            android="chat"
            fallback="💬"
            onPress={handleOpenMessages}
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

      <Modal
        visible={isFilterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsFilterVisible(false)}
          />

          <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.filterHandle} />
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable onPress={() => setIsFilterVisible(false)}>
                <Text style={styles.closeFilterText}>Done</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.filterSheetBody}>
            <FilterSection title="Property Type">
              {propertyTypeOptions.map((option) => (
                <FilterChip
                  key={option}
                  label={option}
                  isSelected={filters.propertyType === option}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      propertyType: option,
                    }))
                  }
                />
              ))}
            </FilterSection>

            <FilterSection title="Location">
              {locationOptions.map((option) => (
                <FilterChip
                  key={option}
                  label={option}
                  isSelected={filters.location === option}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      location: option,
                    }))
                  }
                />
              ))}
            </FilterSection>

            <FilterSection title="Bedrooms">
              {BEDROOM_OPTIONS.map((option) => (
                <FilterChip
                  key={option}
                  label={option}
                  isSelected={filters.bedrooms === option}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      bedrooms: option,
                    }))
                  }
                />
              ))}
            </FilterSection>

            <FilterSection title="Price">
              {PRICE_OPTIONS.map((option) => (
                <FilterChip
                  key={option}
                  label={option}
                  isSelected={filters.price === option}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      price: option,
                    }))
                  }
                />
              ))}
            </FilterSection>

            {isFilteringActive ? (
              <Pressable
                style={({ pressed }) => [styles.clearFiltersButton, pressed && styles.pressed]}
                onPress={handleClearAll}>
                <Text style={styles.clearFiltersButtonText}>Clear All</Text>
              </Pressable>
            ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type FilterSectionProps = {
  title: string;
  children: React.ReactNode;
};

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <View style={styles.filterChipRow}>{children}</View>
    </View>
  );
}

type FilterChipProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  dark?: boolean;
};

function FilterChip({ label, isSelected, onPress, dark = false }: FilterChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.filterChip,
        dark && styles.filterChipDark,
        isSelected && (dark ? styles.selectedFilterChipDark : styles.selectedFilterChip),
        pressed && styles.pressed,
      ]}
      onPress={onPress}>
      <Text
        style={[
          styles.filterChipText,
          dark && styles.filterChipTextDark,
          isSelected &&
            (dark ? styles.selectedFilterChipTextOnLight : styles.selectedFilterChipText),
        ]}>
        {label}
      </Text>
    </Pressable>
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
    flex: 1,
    backgroundColor: '#000',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'flex-end',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  searchIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  notificationIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  searchInputWrap: {
    width: 176,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingLeft: 12,
    paddingRight: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
  },
  clearSearchButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  filterButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 22,
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  filterCount: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 4,
  },
  filterCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  resultRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  clearAllText: {
    color: '#bfdbfe',
    fontSize: 13,
    fontWeight: '800',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(147, 197, 253, 0.14)',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
  bottomNav: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  navLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  navLabelActive: {
    color: '#1d4ed8',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  filterSheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  filterSheetBody: {
    maxHeight: 520,
  },
  filterHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 12,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  closeFilterText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '800',
  },
  filterSection: {
    marginTop: 16,
  },
  filterSectionTitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  selectedFilterChip: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  selectedFilterChipDark: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterChipText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextDark: {
    color: '#fff',
  },
  selectedFilterChipText: {
    color: '#fff',
  },
  selectedFilterChipTextOnLight: {
    color: '#0f172a',
  },
  clearFiltersButton: {
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    marginTop: 22,
  },
  clearFiltersButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
});
