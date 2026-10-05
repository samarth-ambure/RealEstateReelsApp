import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useThemeContext } from '@/context/ThemeContext';
import { mockProperties } from '@/data/properties';
import {
  getLikedProperties,
  getPropertiesByUserEmail,
  getPropertiesByUserId,
  getSavedProperties as getSqliteSavedProperties,
  likeProperty,
  saveProperty,
  unlikeProperty,
  unsaveProperty,
} from '@/database/propertyRepository';
import { getSavedProperties } from '@/services/engagementService';
import { getUserProperties } from '@/services/propertyService';
import { getUserById as getSqliteUserById, UserRow } from '@/database/userRepository';
import { notificationService } from '@/services/notificationService';
import { userService, UserStats, UserProfile } from '@/services/userService';
import { Property } from '@/types/property';

const DEFAULT_BIO = 'Real estate enthusiast';

type ProfileTab = 'posts' | 'liked' | 'saved';

function getInitials(name?: string) {
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

function getUsername(email?: string) {
  const emailName = email?.split('@')[0]?.trim();

  if (!emailName) {
    return '@realestateuser';
  }

  return `@${emailName.toLowerCase().replace(/[^a-z0-9._-]/g, '')}`;
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ProfileScreen() {
  const { logout, user, updateUser } = useAuth();
  const params = useLocalSearchParams<{
    userId?: string | string[];
    displayName?: string | string[];
    displayImage?: string | string[];
  }>();
  const requestedUserId = firstParam(params.userId);
  const displayName = firstParam(params.displayName);
  const displayImage = firstParam(params.displayImage);
  const parsedUserId = requestedUserId ? Number(requestedUserId) : NaN;
  const isOwnProfile =
    (!requestedUserId && !displayName) ||
    (Number.isFinite(parsedUserId) && user?.id === parsedUserId);

  const { themeMode, setThemeMode } = useThemeContext();

  const handleThemeToggle = () => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const [viewedUser, setViewedUser] = useState<UserProfile | UserRow | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userPosts, setUserPosts] = useState<Property[]>([]);
  const [likedProperties, setLikedProperties] = useState<Property[]>([]);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [failedAvatarUri, setFailedAvatarUri] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);

  // Edit profile modal state
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editImage, setEditImage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    setFailedAvatarUri(null);

    if (isOwnProfile) {
      if (!user) {
        setViewedUser(null);
        setUserStats(null);
        setUserPosts([]);
        setLikedProperties([]);
        setSavedProperties([]);
        return;
      }

      try {
        // Fetch live profile details and statistics from backend API
        try {
          const profileRes = await userService.getCurrentProfile();
          if (profileRes?.user) {
            if (profileRes.stats || profileRes.user.stats) {
              setUserStats(profileRes.stats || profileRes.user.stats || null);
            }
            if (
              profileRes.user.name !== user.name ||
              (profileRes.user.bio && profileRes.user.bio !== user.bio) ||
              (profileRes.user.profile_image &&
                profileRes.user.profile_image !== user.profileImage)
            ) {
              updateUser({
                name: profileRes.user.name,
                bio: profileRes.user.bio,
                profileImage:
                  profileRes.user.profile_image || profileRes.user.profileImage,
              });
            }
          }
        } catch (apiErr) {
          console.warn('Failed to fetch backend profile stats, falling back to local counts:', apiErr);
        }

        let posts: Property[] = [];
        try {
          posts = user.id ? await getUserProperties(user.id) : [];
        } catch {
          posts = user.id
            ? await getPropertiesByUserId(user.id)
            : await getPropertiesByUserEmail(user.email, user.id);
        }

        if (posts.length === 0 && user.id) {
          try {
            posts = await getPropertiesByUserId(user.id);
          } catch {}
        }

        setViewedUser(null);
        setUserPosts(posts);

        // Load liked and saved properties from backend with SQLite fallback
        if (user.id) {
          const liked = await getLikedProperties(user.id);
          setLikedProperties(liked);

          let saved: Property[] = [];
          try {
            saved = await getSavedProperties();
          } catch {
            saved = await getSqliteSavedProperties(user.id);
          }
          if (saved.length === 0) {
            try {
              saved = await getSqliteSavedProperties(user.id);
            } catch {}
          }
          setSavedProperties(saved);
        }
      } catch {
        setUserPosts([]);
        setLikedProperties([]);
        setSavedProperties([]);
      }
      return;
    }

    if (Number.isFinite(parsedUserId)) {
      try {
        let otherUser: UserProfile | UserRow | null = null;
        try {
          const profileRes = await userService.getUserById(parsedUserId);
          if (profileRes?.user) {
            otherUser = profileRes.user;
            if (profileRes.stats || profileRes.user.stats) {
              setUserStats(profileRes.stats || profileRes.user.stats || null);
            }
          }
        } catch (userApiErr) {
          console.warn('Failed to fetch user by id from API, falling back to local:', userApiErr);
        }

        if (!otherUser) {
          otherUser = await getSqliteUserById(parsedUserId);
        }

        setViewedUser(otherUser);

        let posts: Property[] = [];
        try {
          posts = await getUserProperties(parsedUserId);
        } catch {
          posts = otherUser ? await getPropertiesByUserId(otherUser.id) : [];
        }
        setUserPosts(posts);
        setLikedProperties([]);
        setSavedProperties([]);
      } catch {
        setViewedUser(null);
        setUserStats(null);
        setUserPosts([]);
        setLikedProperties([]);
        setSavedProperties([]);
      }
      return;
    }

    setViewedUser(null);
    setUserStats(null);
    setUserPosts(
      displayName
        ? mockProperties.filter((property) => property.agentName === displayName)
        : [],
    );
    setLikedProperties([]);
    setSavedProperties([]);
  }, [displayName, isOwnProfile, parsedUserId, user, updateUser]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setUnreadNotificationCount(data.unreadCount ?? data.unread_count ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadUnreadCount();
    }, [loadProfile, loadUnreadCount]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadProfile(), loadUnreadCount()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadProfile, loadUnreadCount]);

  const profile = useMemo(() => {
    const name = isOwnProfile
      ? user?.name || 'RealEstate User'
      : viewedUser?.name || displayName || 'Creator';
    const email = isOwnProfile ? user?.email || 'No email available' : viewedUser?.email;
    const bio = isOwnProfile ? user?.bio || DEFAULT_BIO : viewedUser?.bio?.trim() || '';

    let photoUri: string | null | undefined = null;
    if (isOwnProfile) {
      photoUri = user?.profileImage;
    } else if (viewedUser) {
      if ('profile_image' in viewedUser && viewedUser.profile_image) {
        photoUri = viewedUser.profile_image;
      } else if (viewedUser.profileImage) {
        photoUri = viewedUser.profileImage;
      }
    } else {
      photoUri = displayImage;
    }

    return {
      name,
      email,
      username: email ? getUsername(email) : '',
      bio,
      initials: getInitials(name),
      photoUri: photoUri?.trim() || '',
    };
  }, [displayImage, displayName, isOwnProfile, user, viewedUser]);

  const handleEditProfile = () => {
    setEditName(user?.name || '');
    setEditBio(user?.bio || '');
    setEditImage(user?.profileImage || '');
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty.');
      return;
    }

    try {
      setIsSavingProfile(true);
      const res = await userService.updateProfile({
        name: editName.trim(),
        bio: editBio.trim() || null,
        profile_image: editImage.trim() || null,
      });

      if (res?.user) {
        updateUser({
          name: res.user.name,
          bio: res.user.bio,
          profileImage: res.user.profile_image || res.user.profileImage,
        });
        if (res.stats || res.user.stats) {
          setUserStats(res.stats || res.user.stats || null);
        }
      }
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Update profile error:', error);
      Alert.alert('Error', error?.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreatePost = () => {
    router.push('/create-property');
  };

  const handleOpenProperty = (propertyId: string) => {
    router.push({
      pathname: '/property/[id]',
      params: { id: propertyId },
    });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleLike = async (propertyId: string) => {
    if (!user?.id) return;

    try {
      if (likedProperties.some((p) => p.id === propertyId)) {
        await unlikeProperty(user.id, propertyId);
        setLikedProperties((prev) => prev.filter((p) => p.id !== propertyId));
        setUserStats((prev) =>
          prev
            ? {
                ...prev,
                liked_properties: Math.max(0, (prev.liked_properties || 1) - 1),
              }
            : prev,
        );
      } else {
        await likeProperty(user.id, propertyId);
        // Add to liked properties
        const property = [...userPosts, ...savedProperties].find(
          (p) => p.id === propertyId,
        );
        if (property) {
          setLikedProperties((prev) => [{ ...property, isLiked: true }, ...prev]);
        }
        setUserStats((prev) =>
          prev
            ? {
                ...prev,
                liked_properties: (prev.liked_properties || 0) + 1,
              }
            : prev,
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleSave = async (propertyId: string) => {
    if (!user?.id) return;

    try {
      if (savedProperties.some((p) => p.id === propertyId)) {
        await unsaveProperty(user.id, propertyId);
        setSavedProperties((prev) => prev.filter((p) => p.id !== propertyId));
        setUserStats((prev) =>
          prev
            ? {
                ...prev,
                saved_properties: Math.max(0, (prev.saved_properties || 1) - 1),
              }
            : prev,
        );
      } else {
        await saveProperty(user.id, propertyId);
        // Add to saved properties
        const property = [...userPosts, ...likedProperties].find(
          (p) => p.id === propertyId,
        );
        if (property) {
          setSavedProperties((prev) => [{ ...property, isSaved: true }, ...prev]);
        }
        setUserStats((prev) =>
          prev
            ? {
                ...prev,
                saved_properties: (prev.saved_properties || 0) + 1,
              }
            : prev,
        );
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const postsCount =
    userStats?.posted_properties ?? userStats?.postedProperties ?? userPosts.length;
  const likedCount =
    userStats?.liked_properties ?? userStats?.likedProperties ?? likedProperties.length;
  const savedCount =
    userStats?.saved_properties ?? userStats?.savedProperties ?? savedProperties.length;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#2563eb"
            colors={['#2563eb']}
          />
        }>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.iconButton}
            onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <Text style={styles.screenTitle}>{isOwnProfile ? 'Profile' : 'Creator'}</Text>

          {isOwnProfile ? (
            <View style={styles.topBarActions}>
              <Pressable
                style={styles.notificationButton}
                onPress={() => router.push('/notifications' as any)}
                accessibilityLabel="Notifications">
                <Text style={styles.notificationButtonText}>🔔</Text>
                {unreadNotificationCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                style={styles.themeButton}
                onPress={handleThemeToggle}
                accessibilityLabel="Toggle theme">
                <Text style={styles.themeButtonText}>
                  {themeMode === 'light' ? '🌙' : '☀️'}
                </Text>
              </Pressable>
              <Pressable style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Logout</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.topBarSpacer} />
          )}
        </View>

        <View style={styles.profileHeader}>
          {profile.photoUri && failedAvatarUri !== profile.photoUri ? (
            <Image
              source={{ uri: profile.photoUri }}
              style={styles.avatar}
              resizeMode="cover"
              onError={() => setFailedAvatarUri(profile.photoUri)}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.initials}</Text>
            </View>
          )}

          <Text style={styles.name}>{profile.name}</Text>
          {isOwnProfile ? (
            <>
              <Text style={styles.username}>{profile.username}</Text>
              <Text style={styles.email}>{profile.email}</Text>
            </>
          ) : null}
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {isOwnProfile ? (
            <View style={styles.actionRow}>
              <Pressable style={styles.editButton} onPress={handleEditProfile}>
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </Pressable>

              <Pressable style={styles.postButton} onPress={handleCreatePost}>
                <Text style={styles.postButtonText}>+ Post</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {isOwnProfile ? (
          <View style={styles.tabsRow}>
            <ProfileTab
              label="Posts"
              count={postsCount}
              isActive={activeTab === 'posts'}
              onPress={() => setActiveTab('posts')}
            />
            <ProfileTab
              label="Liked"
              count={likedCount}
              isActive={activeTab === 'liked'}
              onPress={() => setActiveTab('liked')}
            />
            <ProfileTab
              label="Saved"
              count={savedCount}
              isActive={activeTab === 'saved'}
              onPress={() => setActiveTab('saved')}
            />
          </View>
        ) : (
          <View style={styles.tabsRow}>
            <ProfileTab
              label="Listings"
              count={postsCount}
              isActive={true}
              onPress={() => {}}
            />
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isOwnProfile
                ? activeTab === 'posts'
                  ? 'Your Posts'
                  : activeTab === 'liked'
                    ? 'Liked Properties'
                    : 'Saved Properties'
                : 'Properties'}
            </Text>
            {isOwnProfile && activeTab === 'posts' && userPosts.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create another post"
                style={styles.sectionPostButton}
                onPress={handleCreatePost}>
                <Text style={styles.sectionPostButtonText}>+ Post</Text>
              </Pressable>
            ) : null}
          </View>

          {(() => {
            const currentProperties =
              activeTab === 'posts'
                ? userPosts
                : activeTab === 'liked'
                  ? likedProperties
                  : savedProperties;

            if (currentProperties.length > 0) {
              return (
                <View style={styles.postsList}>
                  {currentProperties.map((post) => (
                    <Pressable
                      key={post.id}
                      style={styles.postCard}
                      onPress={() => handleOpenProperty(post.id)}>
                      <Image source={{ uri: post.image }} style={styles.postThumbnail} />
                      <View style={styles.postDetails}>
                        <Text style={styles.postPrice}>{post.price}</Text>
                        <Text style={styles.postTitle} numberOfLines={1}>
                          {post.title}
                        </Text>
                        <Text style={styles.postLocation} numberOfLines={1}>
                          📍 {post.location}
                        </Text>
                        <View style={styles.postMetaRow}>
                          <Text style={styles.postMetaBadge}>{post.propertyType}</Text>
                          <Text style={styles.postMetaBadge}>
                            {post.bedrooms} bd • {post.bathrooms} ba
                          </Text>
                          <Text style={styles.postMetaBadge}>{post.area}</Text>
                        </View>
                      </View>
                      {isOwnProfile && (activeTab === 'liked' || activeTab === 'saved') ? (
                        <Pressable
                          style={styles.removeButton}
                          onPress={() =>
                            activeTab === 'liked'
                              ? handleLike(post.id)
                              : handleSave(post.id)
                          }>
                          <Text style={styles.removeButtonText}>
                            {activeTab === 'liked' ? '💔' : '🗑️'}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.postChevron}>›</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              );
            }

            return (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  {isOwnProfile
                    ? activeTab === 'posts'
                      ? 'No posts yet'
                      : activeTab === 'liked'
                        ? 'No liked properties yet'
                        : 'No saved properties yet'
                    : 'No properties yet'}
                </Text>
                <Text style={styles.emptyText}>
                  {isOwnProfile
                    ? activeTab === 'posts'
                      ? 'Create your first property post.'
                      : activeTab === 'liked'
                        ? 'Like properties to see them here.'
                        : 'Save properties to see them here.'
                    : 'This creator has not listed any properties.'}
                </Text>
                {isOwnProfile && activeTab === 'posts' ? (
                  <Pressable style={styles.emptyPostButton} onPress={handleCreatePost}>
                    <Text style={styles.emptyPostButtonText}>+ Post</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })()}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !isSavingProfile && setIsEditModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                disabled={isSavingProfile}
                style={styles.modalCloseButton}
                onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <View style={styles.modalAvatarContainer}>
                {editImage.trim() ? (
                  <Image source={{ uri: editImage.trim() }} style={styles.modalAvatar} />
                ) : (
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {getInitials(editName || user?.name)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your Name"
                  placeholderTextColor="#9ca3af"
                  maxLength={100}
                  editable={!isSavingProfile}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Profile Photo URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={editImage}
                  onChangeText={setEditImage}
                  placeholder="https://images.unsplash.com/..."
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSavingProfile}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Write a short bio about yourself..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                  editable={!isSavingProfile}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                disabled={isSavingProfile}
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isSavingProfile}
                style={[
                  styles.modalButton,
                  styles.modalSaveButton,
                  isSavingProfile && styles.disabledButton,
                ]}
                onPress={handleSaveProfile}>
                {isSavingProfile ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

type ProfileTabProps = {
  label: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
};

function ProfileTab({ label, count, isActive, onPress }: ProfileTabProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.tab,
        isActive && styles.activeTab,
        pressed && styles.pressed,
      ]}
      onPress={onPress}>
      <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{label}</Text>
      <Text style={[styles.tabCount, isActive && styles.activeTabCount]}>{count}</Text>
    </Pressable>
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
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 34,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backIcon: {
    color: '#111827',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '600',
  },
  screenTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  topBarSpacer: {
    width: 72,
  },
  logoutButton: {
    borderRadius: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  notificationButtonText: {
    fontSize: 16,
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  themeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  themeButtonText: {
    fontSize: 16,
  },
  profileHeader: {
    alignItems: 'center',
    borderRadius: 26,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 22,
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#edf0f4',
  },
  avatar: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 48,
    backgroundColor: '#111827',
    borderWidth: 4,
    borderColor: '#eef2ff',
  },
  avatarText: {
    color: '#fff',
    fontSize: 31,
    fontWeight: '900',
  },
  name: {
    color: '#111827',
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 16,
  },
  username: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 5,
  },
  email: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  bio: {
    color: '#374151',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 14,
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
  },
  editButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  postButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#111827',
    paddingVertical: 14,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 4,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#edf0f4',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#111827',
  },
  tabLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: '#fff',
  },
  tabCount: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  activeTabCount: {
    color: '#93c5fd',
  },
  pressed: {
    opacity: 0.7,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 21,
    fontWeight: '900',
  },
  sectionPostButton: {
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionPostButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  postsList: {
    gap: 12,
  },
  postCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 12,
    borderWidth: 1,
    borderColor: '#edf0f4',
    gap: 12,
  },
  postThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
  },
  postDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  postPrice: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },
  postTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  postLocation: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  postMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  postMetaBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: '#4b5563',
    fontSize: 11,
    fontWeight: '700',
  },
  postChevron: {
    color: '#9ca3af',
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '600',
    paddingRight: 4,
  },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#fef2f2',
  },
  removeButtonText: {
    fontSize: 18,
  },
  emptyState: {
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: '#edf0f4',
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '900',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyPostButton: {
    borderRadius: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 18,
  },
  emptyPostButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6b7280',
  },
  modalScroll: {
    marginTop: 12,
  },
  modalAvatarContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#e5e7eb',
  },
  modalAvatarText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  modalSaveButton: {
    backgroundColor: '#111827',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
