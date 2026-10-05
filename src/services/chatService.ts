import { apiClient } from './api';

export interface ChatUser {
  id: number;
  name: string;
  email?: string;
  profile_image?: string | null;
  profileImage?: string | null;
}

export interface Conversation {
  id: number;
  user_id_1: number;
  user_id_2: number;
  created_at: string;
  otherUser?: ChatUser;
  other_user?: ChatUser;
  lastMessage?: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  conversation_id?: number;
  senderId: number;
  sender_id?: number;
  message: string;
  createdAt: string;
  created_at?: string;
  sender?: ChatUser;
  isSending?: boolean;
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface MessagesResponse {
  conversationId?: number;
  conversation_id?: number;
  messages: ChatMessage[];
  total?: number;
}

export interface SendMessageResponse {
  message: string;
  data?: ChatMessage;
  chatMessage?: ChatMessage;
}

/**
 * Fetch all conversations for the authenticated user.
 * Calls GET /api/conversations
 */
export async function getConversations(): Promise<Conversation[]> {
  const data = await apiClient.get<ConversationsResponse>('/api/conversations');
  return (data?.conversations || []).map((conv) => ({
    ...conv,
    otherUser: conv.otherUser || conv.other_user,
  }));
}

/**
 * Get an existing conversation with another user or create a new one.
 * Calls POST /api/conversations
 */
export async function getOrCreateConversation(
  otherUserId: number
): Promise<Conversation> {
  const data = await apiClient.post<{
    message: string;
    conversation: Conversation;
  }>('/api/conversations', {
    otherUserId,
  });

  const conv = data.conversation;
  return {
    ...conv,
    otherUser: conv.otherUser || conv.other_user,
  };
}

/**
 * Fetch message history for a conversation.
 * Calls GET /api/conversations/:id/messages
 */
export async function getMessages(
  conversationId: number
): Promise<ChatMessage[]> {
  const data = await apiClient.get<MessagesResponse>(
    `/api/conversations/${conversationId}/messages`
  );

  return (data?.messages || []).map((msg) => ({
    ...msg,
    conversationId: msg.conversationId ?? msg.conversation_id ?? conversationId,
    senderId: msg.senderId ?? msg.sender_id ?? 0,
    createdAt: msg.createdAt ?? msg.created_at ?? new Date().toISOString(),
  }));
}

/**
 * Send a message via REST API (fallback for socket or initial post).
 * Calls POST /api/conversations/:id/messages
 */
export async function sendMessageRest(
  conversationId: number,
  message: string
): Promise<ChatMessage> {
  const data = await apiClient.post<SendMessageResponse>(
    `/api/conversations/${conversationId}/messages`,
    {
      message,
    }
  );

  const raw = data?.data || data?.chatMessage;
  if (!raw) {
    throw new Error('Invalid response from server');
  }

  return {
    ...raw,
    conversationId: raw.conversationId ?? raw.conversation_id ?? conversationId,
    senderId: raw.senderId ?? raw.sender_id ?? 0,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

export const chatService = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessageRest,
};

export default chatService;
