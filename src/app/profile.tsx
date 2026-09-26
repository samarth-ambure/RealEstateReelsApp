import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';

const DEFAULT_BIO = 'Real estate enthusiast';

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

export default function ProfileScreen() {
  const { logout, user } = useAuth();

  const profile = useMemo(
    () => ({
      name: user?.name || 'RealEstate User',
      email: user?.email || 'No email available',
      username: getUsername(user?.email),
      bio: DEFAULT_BIO,
      initials: getInitials(user?.name),
    }),
    [user?.email, user?.name],
  );

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Edit Profile feature will be available soon.');
  };

  const handleCreatePost = () => {
    Alert.alert('Post', 'Post feature will be available soon.');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
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

          <Text style={styles.screenTitle}>Profile</Text>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.initials}</Text>
          </View>

          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.username}>{profile.username}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          <Text style={styles.bio}>{profile.bio}</Text>

          <View style={styles.actionRow}>
            <Pressable style={styles.editButton} onPress={handleEditProfile}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>

            <Pressable style={styles.postButton} onPress={handleCreatePost}>
              <Text style={styles.postButtonText}>+ Post</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <ProfileStat label="Posts" value="0" />
          <ProfileStat label="Saved" value="0" />
          <ProfileStat label="Likes" value="0" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Posts</Text>

          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>Create your first property post.</Text>
            <Pressable style={styles.emptyPostButton} onPress={handleCreatePost}>
              <Text style={styles.emptyPostButtonText}>+ Post</Text>
            </Pressable>
          </View>
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
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 12,
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
