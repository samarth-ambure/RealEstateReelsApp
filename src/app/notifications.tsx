import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeContext } from '@/context/ThemeContext';
import {
  AppNotification,
  notificationService,
} from '@/services/notificationService';

type TabType = 'all' | 'unread';

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getNotificationIcon(type?: string) {
  switch (type?.toLowerCase()) {
    case 'like':
      return { ios: 'heart.fill', android: 'favorite', fallback: '❤️', color: '#ef4444' };
    case 'save':
    case 'bookmark':
      return { ios: 'bookmark.fill', android: 'bookmark', fallback: '🔖', color: '#f59e0b' };
    case 'message':
    case 'chat':
      return { ios: 'bubble.left.fill', android: 'chat', fallback: '💬', color: '#3b82f6' };
    case 'property':
    case 'listing':
      return { ios: 'house.fill', android: 'home', fallback: '🏠', color: '#10b981' };
    default:
      return { ios: 'bell.fill', android: 'notifications', fallback: '🔔', color: '#6366f1' };
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === 'dark';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? data.unread_count ?? 0);
    } catch (error) {
      console.warn('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notification: AppNotification) => {
    if (notification.is_read || notification.isRead) {
      return;
    }

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true, isRead: true }
          : item
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationService.markAsRead(notification.id);
    } catch (error) {
      console.warn(`Failed to mark notification ${notification.id} as read:`, error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 && !notifications.some((n) => !n.is_read && !n.isRead)) {
      return;
    }

    try {
      setIsMarkingAll(true);
      // Optimistic update
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true, isRead: true }))
      );
      setUnreadCount(0);

      await notificationService.markAllAsRead();
    } catch (error: any) {
      console.error('Failed to mark all notifications as read:', error);
      Alert.alert('Error', error?.message || 'Could not mark all as read');
      // Revert from server
      await loadNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const displayedNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.is_read && !n.isRead);
    }
    return notifications;
  }, [notifications, activeTab]);

  const dynamicStyles = {
    container: {
      backgroundColor: isDark ? '#000000' : '#f6f7f9',
    },
    header: {
      backgroundColor: isDark ? '#111827' : '#ffffff',
      borderBottomColor: isDark ? '#1f2937' : '#e5e7eb',
    },
    title: {
      color: isDark ? '#ffffff' : '#111827',
    },
    card: {
      backgroundColor: isDark ? '#111827' : '#ffffff',
      borderColor: isDark ? '#1f2937' : '#edf0f4',
    },
    cardUnread: {
      backgroundColor: isDark ? '#1e293b' : '#eff6ff',
      borderColor: isDark ? '#3b82f6' : '#bfdbfe',
    },
    cardTitle: {
      color: isDark ? '#f3f4f6' : '#111827',
    },
    cardMessage: {
      color: isDark ? '#9ca3af' : '#4b5563',
    },
    timeText: {
      color: isDark ? '#6b7280' : '#9ca3af',
    },
    emptyTitle: {
      color: isDark ? '#ffffff' : '#111827',
    },
    emptyText: {
      color: isDark ? '#9ca3af' : '#6b7280',
    },
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const isUnread = !item.is_read && !item.isRead;
    const iconConfig = getNotificationIcon(item.type);

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.message}`}
        style={({ pressed }) => [
          styles.notificationCard,
          dynamicStyles.card,
          isUnread && dynamicStyles.cardUnread,
          pressed && styles.pressed,
        ]}
        onPress={() => handleMarkAsRead(item)}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: `${iconConfig.color}15` },
          ]}>
          <AppIcon
            ios={iconConfig.ios}
            android={iconConfig.android}
            size={20}
            color={iconConfig.color}
            fallback={iconConfig.fallback}
          />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <Text
              style={[
                styles.cardTitle,
                dynamicStyles.cardTitle,
                isUnread && styles.unreadTitle,
              ]}
              numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.timeText, dynamicStyles.timeText]}>
              {formatRelativeTime(item.created_at || item.createdAt)}
            </Text>
          </View>

          <Text
            style={[styles.cardMessage, dynamicStyles.cardMessage]}
            numberOfLines={2}>
            {item.message}
          </Text>
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        dynamicStyles.container,
        { paddingTop: insets.top },
      ]}>
      {/* Header */}
      <View style={[styles.header, dynamicStyles.header]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}>
          <Text style={[styles.backIcon, dynamicStyles.title]}>‹</Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, dynamicStyles.title]}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all as read"
          disabled={isMarkingAll || unreadCount === 0}
          style={({ pressed }) => [
            styles.markAllButton,
            (unreadCount === 0 || isMarkingAll) && styles.disabledButton,
            pressed && styles.pressed,
          ]}
          onPress={handleMarkAllAsRead}>
          {isMarkingAll ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <Text
              style={[
                styles.markAllText,
                unreadCount === 0 && styles.disabledText,
              ]}>
              Mark all read
            </Text>
          )}
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'all' && styles.activeTabText,
            ]}>
            All
          </Text>
          <View
            style={[
              styles.tabCountBadge,
              activeTab === 'all' && styles.activeTabCountBadge,
            ]}>
            <Text
              style={[
                styles.tabCountText,
                activeTab === 'all' && styles.activeTabCountText,
              ]}>
              {notifications.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'unread' && styles.activeTab]}
          onPress={() => setActiveTab('unread')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'unread' && styles.activeTabText,
            ]}>
            Unread
          </Text>
          {unreadCount > 0 && (
            <View
              style={[
                styles.tabCountBadge,
                activeTab === 'unread' && styles.activeTabCountBadge,
                { backgroundColor: '#ef4444' },
              ]}>
              <Text style={[styles.tabCountText, { color: '#ffffff' }]}>
                {unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Notifications List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.loadingText, dynamicStyles.emptyText]}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedNotifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            displayedNotifications.length === 0 && styles.emptyListContent,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#2563eb"
              colors={['#2563eb']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <AppIcon
                  ios={
                    activeTab === 'unread'
                      ? 'checkmark.circle.fill'
                      : 'bell.slash.fill'
                  }
                  android={
                    activeTab === 'unread'
                      ? 'check_circle'
                      : 'notifications_off'
                  }
                  size={42}
                  color="#93c5fd"
                  fallback={activeTab === 'unread' ? '✓' : '🔔'}
                />
              </View>
              <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>
                {activeTab === 'unread'
                  ? 'All caught up!'
                  : 'No notifications yet'}
              </Text>
              <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
                {activeTab === 'unread'
                  ? 'You have read all your notifications.'
                  : "We'll let you know when properties you follow get updates or likes."}
              </Text>
            </View>
          }
        />
      )}
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
      name={{
        ios: ios as never,
        android: android as never,
        web: android as never,
      }}
      size={size}
      tintColor={color}
      fallback={
        <Text style={{ color, fontSize: size * 0.9, lineHeight: size }}>
          {fallback}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  backIcon: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '600',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#9ca3af',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  activeTab: {
    backgroundColor: '#111827',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  activeTabText: {
    color: '#ffffff',
  },
  tabCountBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  activeTabCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeTabCountText: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '900',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#2563eb',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
