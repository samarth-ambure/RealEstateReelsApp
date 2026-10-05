import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useThemeContext } from '@/context/ThemeContext';
import {
  ChatMessage,
  chatService,
  Conversation,
} from '@/services/chatService';
import { socketService } from '@/services/socketService';

function getInitials(name?: string) {
  if (!name?.trim()) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

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

function formatMessageTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === 'dark';

  const params = useLocalSearchParams<{ conversationId?: string }>();
  const initialConvId = params.conversationId ? Number(params.conversationId) : null;

  // Conversations list state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active chat state
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

  const flatListRef = useRef<FlatList>(null);

  // Initialize socket connection
  useEffect(() => {
    let isMounted = true;
    socketService.initSocket().then((sock) => {
      if (isMounted && sock) {
        setIsSocketConnected(sock.connected);
        sock.on('connect', () => isMounted && setIsSocketConnected(true));
        sock.on('disconnect', () => isMounted && setIsSocketConnected(false));
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await chatService.getConversations();
      setConversations(data);

      // If initialConvId passed in URL params, automatically open that conversation
      if (initialConvId) {
        const matching = data.find((c) => c.id === initialConvId);
        if (matching) {
          setActiveConversation(matching);
        } else {
          // If not in current list yet, create minimal conversation object to enter chat
          setActiveConversation({
            id: initialConvId,
            user_id_1: user?.id || 0,
            user_id_2: 0,
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load conversations:', error);
    } finally {
      setIsLoadingConversations(false);
      setIsRefreshing(false);
    }
  }, [initialConvId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadConversations();
  }, [loadConversations]);

  // Load messages and listen to real-time events when entering a conversation
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const conversationId = activeConversation.id;

    setIsLoadingMessages(true);

    // Join room
    socketService.joinConversation(conversationId);

    // Load message history from backend
    chatService
      .getMessages(conversationId)
      .then((history) => {
        if (isMounted) {
          setMessages(history);
        }
      })
      .catch((err) => {
        console.warn('Failed to load message history:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      });

    // Real-time listener for incoming messages
    const handleNewMessage = (newMsg: any) => {
      const msgConvId = Number(newMsg.conversationId ?? newMsg.conversation_id);
      if (msgConvId === conversationId && isMounted) {
        setMessages((prev) => {
          // Replace matching optimistic message or append
          const existingIdx = prev.findIndex(
            (m) =>
              m.id === newMsg.id ||
              (m.isSending &&
                m.message === newMsg.message &&
                m.senderId === (newMsg.senderId ?? newMsg.sender_id))
          );

          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = {
              ...newMsg,
              conversationId: msgConvId,
              senderId: newMsg.senderId ?? newMsg.sender_id,
              createdAt: newMsg.createdAt ?? newMsg.created_at,
              isSending: false,
            };
            return updated;
          }

          return [
            ...prev,
            {
              ...newMsg,
              conversationId: msgConvId,
              senderId: newMsg.senderId ?? newMsg.sender_id,
              createdAt: newMsg.createdAt ?? newMsg.created_at,
              isSending: false,
            },
          ];
        });

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    socketService.onNewMessage(handleNewMessage);

    return () => {
      isMounted = false;
      socketService.offNewMessage(handleNewMessage);
    };
  }, [activeConversation]);

  // Send message with optimistic update, Socket.IO delivery, and REST fallback
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeConversation || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    const tempId = Date.now();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: activeConversation.id,
      senderId: user?.id || 0,
      message: textToSend,
      createdAt: new Date().toISOString(),
      isSending: true,
      sender: {
        id: user?.id || 0,
        name: user?.name || 'Me',
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    let socketSuccess = false;

    try {
      await socketService.sendMessageSocket(
        activeConversation.id,
        textToSend,
        (res: any) => {
          if (res?.status === 'ok' && res?.data) {
            socketSuccess = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId
                  ? {
                      ...res.data,
                      conversationId: activeConversation.id,
                      senderId: res.data.senderId ?? res.data.sender_id,
                      isSending: false,
                    }
                  : m
              )
            );
          }
        }
      );
    } catch {
      // Fallback below
    }

    // Brief timeout to fallback to REST if socket acknowledgement was not received
    setTimeout(async () => {
      if (!socketSuccess) {
        try {
          const sent = await chatService.sendMessageRest(
            activeConversation.id,
            textToSend
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...sent, isSending: false } : m
            )
          );
        } catch (restErr: any) {
          console.error('Failed to send message via REST fallback:', restErr);
        }
      }
      setIsSending(false);
    }, 450);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const name = c.otherUser?.name?.toLowerCase() || '';
    const email = c.otherUser?.email?.toLowerCase() || '';
    const q = searchQuery.toLowerCase().trim();
    return name.includes(q) || email.includes(q);
  });

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
    cardTitle: {
      color: isDark ? '#f3f4f6' : '#111827',
    },
    subtitle: {
      color: isDark ? '#9ca3af' : '#64748b',
    },
    inputBar: {
      backgroundColor: isDark ? '#111827' : '#ffffff',
      borderTopColor: isDark ? '#1f2937' : '#e5e7eb',
    },
    input: {
      backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
      color: isDark ? '#ffffff' : '#111827',
    },
    receivedBubble: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    receivedText: {
      color: isDark ? '#f3f4f6' : '#111827',
    },
  };

  // ==========================================
  // RENDER: ACTIVE CONVERSATION CHAT VIEW
  // ==========================================
  if (activeConversation) {
    const otherUser = activeConversation.otherUser;
    const otherName = otherUser?.name || 'Agent';

    return (
      <View
        style={[
          styles.container,
          dynamicStyles.container,
          { paddingTop: insets.top },
        ]}>
        {/* Chat Header */}
        <View style={[styles.chatHeader, dynamicStyles.header]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to conversations"
            style={styles.backButton}
            onPress={() => setActiveConversation(null)}>
            <Text style={[styles.backIcon, dynamicStyles.title]}>‹</Text>
          </Pressable>

          <View style={styles.chatHeaderUser}>
            <View style={styles.chatAvatar}>
              {otherUser?.profile_image || otherUser?.profileImage ? (
                <Image
                  source={{
                    uri: otherUser.profile_image || otherUser.profileImage || '',
                  }}
                  style={styles.chatAvatarImage}
                />
              ) : (
                <Text style={styles.chatAvatarText}>{getInitials(otherName)}</Text>
              )}
            </View>

            <View>
              <Text style={[styles.chatHeaderName, dynamicStyles.title]}>
                {otherName}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isSocketConnected ? '#22c55e' : '#94a3b8' },
                  ]}
                />
                <Text style={[styles.statusText, dynamicStyles.subtitle]}>
                  {isSocketConnected ? 'Real-time active' : 'Connecting...'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Message History */}
        {isLoadingMessages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={[styles.loadingText, dynamicStyles.subtitle]}>
              Loading conversation...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={[
              styles.messagesContent,
              messages.length === 0 && styles.emptyMessagesContent,
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIconText}>💬</Text>
                <Text style={[styles.emptyTitle, dynamicStyles.title]}>
                  No messages yet
                </Text>
                <Text style={[styles.emptyText, dynamicStyles.subtitle]}>
                  Say hello and inquire about property details!
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMine = item.senderId === user?.id;

              return (
                <View
                  style={[
                    styles.messageRow,
                    isMine ? styles.myMessageRow : styles.otherMessageRow,
                  ]}>
                  <View
                    style={[
                      styles.bubble,
                      isMine ? styles.myBubble : [styles.otherBubble, dynamicStyles.receivedBubble],
                    ]}>
                    <Text
                      style={[
                        styles.messageText,
                        isMine ? styles.myMessageText : dynamicStyles.receivedText,
                      ]}>
                      {item.message}
                    </Text>
                    <View style={styles.bubbleFooter}>
                      <Text
                        style={[
                          styles.timeText,
                          isMine ? styles.myTimeText : dynamicStyles.subtitle,
                        ]}>
                        {formatMessageTime(item.createdAt || item.created_at)}
                      </Text>
                      {item.isSending && (
                        <Text style={styles.sendingIndicator}> ⏱</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Bottom Message Input Bar */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 6 : 0}>
          <View
            style={[
              styles.inputBar,
              dynamicStyles.inputBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your message..."
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
            />

            <Pressable
              disabled={!inputText.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleSendMessage}>
              <Text style={styles.sendIcon}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ==========================================
  // RENDER: CONVERSATIONS LIST VIEW
  // ==========================================
  return (
    <View
      style={[
        styles.container,
        dynamicStyles.container,
        { paddingTop: insets.top },
      ]}>
      {/* Header */}
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={[styles.headerTitle, dynamicStyles.title]}>Messages</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <View style={[styles.searchInputContainer, dynamicStyles.input]}>
          <AppIcon
            ios="magnifyingglass"
            android="search"
            size={16}
            color="#94a3b8"
            fallback="⌕"
          />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#fff' : '#111827' }]}
            placeholder="Search conversations..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <Text style={{ color: '#94a3b8', fontSize: 16 }}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Conversations List */}
      {isLoadingConversations ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.loadingText, dynamicStyles.subtitle]}>
            Loading conversations...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            filteredConversations.length === 0 && styles.emptyListContent,
            { paddingBottom: insets.bottom + 84 },
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
                  ios="bubble.left.and.bubble.right"
                  android="chat"
                  size={44}
                  color="#93c5fd"
                  fallback="💬"
                />
              </View>
              <Text style={[styles.emptyTitle, dynamicStyles.title]}>
                No conversations yet
              </Text>
              <Text style={[styles.emptyText, dynamicStyles.subtitle]}>
                Contact an agent directly from any property listing to start a chat!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const other = item.otherUser;
            const name = other?.name || 'Agent';

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Conversation with ${name}`}
                style={({ pressed }) => [
                  styles.conversationCard,
                  dynamicStyles.card,
                  pressed && styles.pressed,
                ]}
                onPress={() => setActiveConversation(item)}>
                <View style={styles.avatar}>
                  {other?.profile_image || other?.profileImage ? (
                    <Image
                      source={{
                        uri: other.profile_image || other.profileImage || '',
                      }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarText}>{getInitials(name)}</Text>
                  )}
                </View>

                <View style={styles.convDetails}>
                  <View style={styles.convHeader}>
                    <Text
                      style={[styles.convName, dynamicStyles.cardTitle]}
                      numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.convTime, dynamicStyles.subtitle]}>
                      {formatRelativeTime(item.created_at)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.convPreview, dynamicStyles.subtitle]}
                    numberOfLines={1}>
                    {item.lastMessage || 'Tap to view conversation'}
                  </Text>
                </View>

                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* Bottom Navigation */}
      <View
        style={[
          styles.bottomNavWrap,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}>
        <View style={styles.bottomNav}>
          <NavItem
            label="Home"
            ios="house.fill"
            android="home"
            fallback="⌂"
            onPress={() => router.push('/home')}
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
            onPress={() => router.push('/create-property')}
          />
          <NavItem
            label="Profile"
            ios="person.fill"
            android="person"
            fallback="👤"
            onPress={() => router.push('/profile')}
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
      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 4,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  convDetails: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  convName: {
    fontSize: 15,
    fontWeight: '700',
  },
  convTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  convPreview: {
    fontSize: 13,
    fontWeight: '400',
  },
  chevron: {
    fontSize: 22,
    color: '#94a3b8',
    paddingRight: 4,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '600',
  },
  chatHeaderUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  chatAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  emptyMessagesContent: {
    flex: 1,
    justifyContent: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#2563eb',
    borderTopRightRadius: 4,
  },
  otherBubble: {
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  sendingIndicator: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.5,
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    transform: [{ rotate: '0deg' }],
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
  emptyIconText: {
    fontSize: 48,
    marginBottom: 12,
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
    paddingVertical: 8,
  },
  navLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  navLabelActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
