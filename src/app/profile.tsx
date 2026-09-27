import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
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
    getLikedProperties,
    getPropertiesByUserEmail,
    getPropertiesByUserId,
    getSavedProperties,
    likeProperty,
    saveProperty,
    unlikeProperty,
    unsaveProperty,
} from '@/database/propertyRepository';
import { getUserById, UserRow } from '@/database/userRepository';
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
  const { logout, user } = useAuth();
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

  const [viewedUser, setViewedUser] = useState<UserRow | null>(null);
  const [userPosts, setUserPosts] = useState<Property[]>([]);
  const [likedProperties, setLikedProperties] = useState<Property[]>([]);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [failedAvatarUri, setFailedAvatarUri] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setFailedAvatarUri(null);

    if (isOwnProfile) {
      if (!user) {
        setViewedUser(null);
        setUserPosts([]);
        setLikedProperties([]);
        setSavedProperties([]);
        return;
      }

      try {
        const posts = user.id
          ? await getPropertiesByUserId(user.id)
          : await getPropertiesByUserEmail(user.email, user.id);
        setViewedUser(null);
        setUserPosts(posts);

        // Load liked and saved properties
        if (user.id) {
          const liked = await getLikedProperties(user.id);
          const saved = await getSavedProperties(user.id);
          setLikedProperties(liked);
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
        const otherUser = await getUserById(parsedUserId);
        setViewedUser(otherUser);
        const posts = otherUser ? await getPropertiesByUserId(otherUser.id) : [];
        setUserPosts(posts);
        setLikedProperties([]);
        setSavedProperties([]);
      } catch {
        setViewedUser(null);
        setUserPosts([]);
        setLikedProperties([]);
        setSavedProperties([]);
      }
      return;
    }

    setViewedUser(null);
    setUserPosts(
      displayName
        ? mockProperties.filter((property) => property.agentName === displayName)
        : [],
    );
    setLikedProperties([]);
    setSavedProperties([]);
  }, [displayName, isOwnProfile, parsedUserId, user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const profile = useMemo(() => {
    const name = isOwnProfile
      ? user?.name || 'RealEstate User'
      : viewedUser?.name || displayName || 'Creator';
    const email = isOwnProfile ? user?.email || 'No email available' : viewedUser?.email;
    const bio = isOwnProfile ? user?.bio || DEFAULT_BIO : viewedUser?.bio?.trim() || '';
    const photoUri = isOwnProfile
      ? user?.profileImage
      : viewedUser?.profileImage || displayImage;

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
    Alert.alert('Edit Profile', 'Edit Profile feature will be available soon.');
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
      } else {
        await likeProperty(user.id, propertyId);
        // Add to liked properties
        const property = [...userPosts, ...savedProperties].find((p) => p.id === propertyId);
        if (property) {
          setLikedProperties((prev) => [{ ...property, isLiked: true }, ...prev]);
        }
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
      } else {
        await saveProperty(user.id, propertyId);
        // Add to saved properties
        const property = [...userPosts, ...likedProperties].find((p) => p.id === propertyId);
        if (property) {
          setSavedProperties((prev) => [{ ...property, isSaved: true }, ...prev]);
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
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
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>
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

        <View style={styles.statsRow}>
          <ProfileStat label="Posts" value={String(userPosts.length)} />
          {isOwnProfile ? (
            <>
              <ProfileStat label="Saved" value={String(savedProperties.length)} />
              <ProfileStat label="Likes" value={String(likedProperties.length)} />
            </>
          ) : null}
        </View>

        {isOwnProfile ? (
          <View style={styles.tabsRow}>
            <ProfileTab
              label="Posts"
              count={userPosts.length}
              isActive={activeTab === 'posts'}
              onPress={() => setActiveTab('posts')}
            />
            <ProfileTab
              label="Liked"
              count={likedProperties.length}
              isActive={activeTab === 'liked'}
              onPress={() => setActiveTab('liked')}
            />
            <ProfileTab
              label="Saved"
              count={savedProperties.length}
              isActive={activeTab === 'saved'}
              onPress={() => setActiveTab('saved')}
            />
          </View>
        ) : null}

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
    </View>
  );
}

type ProfileStatProps = {
  label: string;
  value: string;
};

function ProfileStat({ label, value }: ProfileStatProps) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  statsRow: {
    flexDirection: 'row',
    borderRadius: 22,
    backgroundColor: '#fff',
    paddingVertical: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#edf0f4',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
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
});
