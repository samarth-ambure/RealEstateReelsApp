import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { getToken } from './api';

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Initialize or retrieve the existing Socket.IO connection.
 * Passes the JWT token in auth: { token } and extraHeaders.
 */
export async function initSocket(): Promise<Socket | null> {
  const token = await getToken();

  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
      currentToken = null;
    }
    return null;
  }

  // If already connected with the same token, return the active instance
  if (socket && socket.connected && currentToken === token) {
    return socket;
  }

  // If token changed or socket exists in disconnected state, clean up before reconnecting
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    auth: {
      token,
    },
    extraHeaders: {
      Authorization: `Bearer ${token}`,
    },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket.IO connected successfully. Socket ID:', socket?.id);
  });

  socket.on('connect_error', (error) => {
    console.warn('Socket.IO connection error:', error?.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected. Reason:', reason);
  });

  return socket;
}

/**
 * Clean up and disconnect the socket (e.g. on user logout).
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}

/**
 * Join a conversation room (conversation:<id>).
 * Emits 'join_conversation' with { conversationId }.
 */
export async function joinConversation(
  conversationId: number,
  callback?: (response: any) => void
): Promise<void> {
  const s = await initSocket();
  if (s) {
    s.emit('join_conversation', { conversationId }, (res: any) => {
      if (typeof callback === 'function') {
        callback(res);
      }
    });
  }
}

/**
 * Send a real-time message to a conversation.
 * Emits 'send_message' with { conversationId, message }.
 */
export async function sendMessageSocket(
  conversationId: number,
  message: string,
  callback?: (res: any) => void
): Promise<void> {
  const s = await initSocket();
  if (s && s.connected) {
    s.emit('send_message', { conversationId, message }, (res: any) => {
      if (typeof callback === 'function') {
        callback(res);
      }
    });
  } else {
    if (typeof callback === 'function') {
      callback({ status: 'error', message: 'Socket not connected' });
    }
  }
}

/**
 * Subscribe to real-time incoming messages ('new_message' event).
 */
export function onNewMessage(listener: (message: any) => void): void {
  if (socket) {
    socket.on('new_message', listener);
  }
}

/**
 * Unsubscribe a listener or all listeners from 'new_message'.
 */
export function offNewMessage(listener?: (message: any) => void): void {
  if (socket) {
    if (listener) {
      socket.off('new_message', listener);
    } else {
      socket.off('new_message');
    }
  }
}

/**
 * Get current socket instance (if any).
 */
export function getSocket(): Socket | null {
  return socket;
}

export const socketService = {
  initSocket,
  disconnectSocket,
  joinConversation,
  sendMessageSocket,
  onNewMessage,
  offNewMessage,
  getSocket,
};

export default socketService;
