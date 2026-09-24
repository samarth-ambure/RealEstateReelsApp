import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ListRenderItem,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { PropertyReelCard } from '@/components/PropertyReelCard';
import { useAuth } from '@/context/AuthContext';
import { mockProperties } from '@/data/properties';
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
  const { logout, user } = useAuth();
  const { height } = useWindowDimensions();
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const propertyTypeOptions = useMemo(
    () => [
      'All',
      ...Array.from(new Set(mockProperties.map((property) => property.propertyType))),
    ],
    [],
  );

  const locationOptions = useMemo(
    () => [
      'All',
      ...Array.from(new Set(mockProperties.map((property) => property.location))),
    ],
    [],
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

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleLike = useCallback((propertyId: string) => {
    setProperties((currentProperties) =>
      currentProperties.map((property) =>
        property.id === propertyId
          ? { ...property, isLiked: !property.isLiked }
          : property,
      ),
    );
  }, []);

  const handleSave = useCallback((propertyId: string) => {
    setProperties((currentProperties) =>
      currentProperties.map((property) =>
        property.id === propertyId
          ? { ...property, isSaved: !property.isSaved }
          : property,
      ),
    );
  }, []);

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

  const handleClearAll = useCallback(() => {
    setSearchQuery('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const renderProperty: ListRenderItem<Property> = useCallback(
    ({ item }) => (
      <PropertyReelCard
        property={item}
        height={height}
        onLike={handleLike}
        onSave={handleSave}
        onComment={handleComment}
        onShare={handleShare}
        onOpen={handleOpenProperty}
      />
    ),
    [
      handleComment,
      handleLike,
      handleOpenProperty,
      handleSave,
      handleShare,
      height,
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

  const greeting = useMemo(
    () => (user?.name ? `Hi, ${user.name}` : 'RealEstate Reels'),
    [user?.name],
  );

  return (
    <View style={styles.container}>
      {filteredProperties.length > 0 ? (
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
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No properties found</Text>
          <Text style={styles.emptyText}>
            Try a different search or clear the current filters.
          </Text>
          <Pressable style={styles.emptyButton} onPress={handleClearAll}>
            <Text style={styles.emptyButtonText}>Clear All</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{greeting}</Text>
          <Text style={styles.headerSubtitle}>Swipe for homes</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search properties..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchText}>×</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={styles.filterButton}
            onPress={() => setIsFilterVisible(true)}>
            <Text style={styles.filterButtonText}>
              Filter{activeFilterCount ? ` ${activeFilterCount}` : ''}
            </Text>
          </Pressable>
        </View>

        {isFilteringActive ? (
          <View style={styles.resultRow}>
            <Text style={styles.resultText}>{resultCountText}</Text>
            <Pressable onPress={handleClearAll}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </Pressable>
          </View>
        ) : null}
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

          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable onPress={() => setIsFilterVisible(false)}>
                <Text style={styles.closeFilterText}>Done</Text>
              </Pressable>
            </View>

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

            <Pressable style={styles.clearFiltersButton} onPress={handleClearAll}>
              <Text style={styles.clearFiltersButtonText}>Clear All</Text>
            </Pressable>
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
};

function FilterChip({ label, isSelected, onPress }: FilterChipProps) {
  return (
    <Pressable
      style={[styles.filterChip, isSelected && styles.selectedFilterChip]}
      onPress={onPress}>
      <Text
        style={[
          styles.filterChipText,
          isSelected && styles.selectedFilterChipText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  headerSubtitle: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  searchPanel: {
    position: 'absolute',
    top: 106,
    left: 18,
    right: 18,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingLeft: 14,
    paddingRight: 8,
  },
  searchIcon: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '800',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 12,
  },
  clearSearchButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#e5e7eb',
  },
  clearSearchText: {
    color: '#111827',
    fontSize: 21,
    lineHeight: 23,
    fontWeight: '800',
  },
  filterButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#111827',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  resultText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  clearAllText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: '#d1d5db',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  emptyButton: {
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#f6f7f9',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
  },
  closeFilterText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  filterSection: {
    marginTop: 16,
  },
  filterSectionTitle: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  selectedFilterChip: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedFilterChipText: {
    color: '#fff',
  },
  clearFiltersButton: {
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#111827',
    paddingVertical: 15,
    marginTop: 22,
  },
  clearFiltersButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
