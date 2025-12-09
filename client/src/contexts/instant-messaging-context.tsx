import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getOrCreateSocket } from '@/lib/socket-singleton';
import { useToast } from '@/hooks/use-toast';

export interface ChatUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
}

export interface InstantMessage {
  id: number;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface ChatWindow {
  id: string; // unique window id
  user: ChatUser;
  minimized: boolean;
  messages: InstantMessage[];
  unreadCount: number;
}

interface InstantMessagingContextType {
  openWindows: ChatWindow[];
  openChat: (user: ChatUser) => void;
  closeChat: (windowId: string) => void;
  minimizeChat: (windowId: string) => void;
  maximizeChat: (windowId: string) => void;
  sendMessage: (windowId: string, content: string) => Promise<void>;
  markAsRead: (windowId: string) => void;
  addMessage: (message: InstantMessage) => void;
}

const InstantMessagingContext = createContext<InstantMessagingContextType | null>(null);

export function useInstantMessaging() {
  const context = useContext(InstantMessagingContext);
  if (!context) {
    throw new Error('useInstantMessaging must be used within an InstantMessagingProvider');
  }
  return context;
}

const MAX_OPEN_WINDOWS = 3;

export function InstantMessagingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [openWindows, setOpenWindows] = useState<ChatWindow[]>([]);
  const { toast } = useToast();

  // Use refs to access current state in socket handler
  const openWindowsRef = useRef<ChatWindow[]>([]);
  const openChatRef = useRef<(user: ChatUser) => void>(() => {});

  // Keep refs in sync with state
  useEffect(() => {
    openWindowsRef.current = openWindows;
  }, [openWindows]);

  // Join messaging channel for real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const socket = getOrCreateSocket();
    if (!socket) return;

    // Join user's messaging channel
    socket.emit('join-messaging-channel', { userId: user.id });

    // Listen for new instant messages
    const handleNewMessage = (message: InstantMessage) => {
      // Skip messages from yourself entirely - they're added by the sendMessage API response
      // This prevents duplicate messages (the API adds it, then socket would add it again)
      if (message.senderId === user.id) {
        return;
      }

      const senderId = message.senderId;
      const currentWindows = openWindowsRef.current;
      const existingWindow = currentWindows.find(w => w.user.id === senderId);

      if (existingWindow) {
        // Window is open - add message to it
        setOpenWindows(prev => {
          return prev.map(w => {
            if (w.user.id === senderId) {
              const messageExists = w.messages.some(m => m.id === message.id);
              if (messageExists) return w;
              return {
                ...w,
                messages: [...w.messages, message],
                unreadCount: w.minimized ? w.unreadCount + 1 : 0,
              };
            }
            return w;
          });
        });
      } else {
        // No window open - show toast notification
        const truncatedContent = message.content.length > 50
          ? message.content.substring(0, 50) + '...'
          : message.content;

        toast({
          title: `New message from ${message.senderName}`,
          description: truncatedContent,
          duration: 5000,
          action: (
            <button
              onClick={() => {
                // Open chat with this user
                openChatRef.current({
                  id: message.senderId,
                  firstName: null,
                  lastName: null,
                  displayName: message.senderName,
                  email: null,
                  profileImageUrl: null,
                });
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition-colors"
            >
              Reply
            </button>
          ),
        });
      }
    };

    socket.on('instant_message', handleNewMessage);

    return () => {
      socket.off('instant_message', handleNewMessage);
    };
  }, [user?.id, toast]);

  const openChat = useCallback((chatUser: ChatUser) => {
    if (!user?.id) return;

    setOpenWindows(prev => {
      // Check if window is already open
      const existingIndex = prev.findIndex(w => w.user.id === chatUser.id);

      if (existingIndex !== -1) {
        // Maximize and bring to front
        const updated = [...prev];
        const [existing] = updated.splice(existingIndex, 1);
        return [...updated, { ...existing, minimized: false }];
      }

      // Create new window
      const newWindow: ChatWindow = {
        id: `chat-${chatUser.id}-${Date.now()}`,
        user: chatUser,
        minimized: false,
        messages: [],
        unreadCount: 0,
      };

      // Limit number of open windows
      if (prev.length >= MAX_OPEN_WINDOWS) {
        return [...prev.slice(1), newWindow];
      }

      return [...prev, newWindow];
    });

    // Load message history
    loadMessageHistory(chatUser.id);
  }, [user?.id]);

  // Keep openChatRef in sync
  useEffect(() => {
    openChatRef.current = openChat;
  }, [openChat]);

  const loadMessageHistory = async (otherUserId: string) => {
    try {
      const response = await fetch(`/api/instant-messages/${otherUserId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const messages: InstantMessage[] = await response.json();
        setOpenWindows(prev =>
          prev.map(w =>
            w.user.id === otherUserId
              ? { ...w, messages, unreadCount: 0 }
              : w
          )
        );
      }
    } catch (error) {
      console.error('Failed to load message history:', error);
    }
  };

  const closeChat = useCallback((windowId: string) => {
    // Clear any pending markAsRead timeout for this window
    const timeout = markAsReadTimeouts.current.get(windowId);
    if (timeout) {
      clearTimeout(timeout);
      markAsReadTimeouts.current.delete(windowId);
    }
    setOpenWindows(prev => prev.filter(w => w.id !== windowId));
  }, []);

  const minimizeChat = useCallback((windowId: string) => {
    setOpenWindows(prev =>
      prev.map(w =>
        w.id === windowId ? { ...w, minimized: true } : w
      )
    );
  }, []);

  const maximizeChat = useCallback((windowId: string) => {
    setOpenWindows(prev =>
      prev.map(w =>
        w.id === windowId ? { ...w, minimized: false, unreadCount: 0 } : w
      )
    );
  }, []);

  const sendMessage = useCallback(async (windowId: string, content: string) => {
    if (!user?.id || !content.trim()) return;

    // Use ref to get current windows to avoid stale closure
    const currentWindow = openWindowsRef.current.find(w => w.id === windowId);
    if (!currentWindow) return;

    try {
      const response = await fetch('/api/instant-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientId: currentWindow.user.id,
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMessage: InstantMessage = await response.json();

      // Add message to window with deduplication check
      // The socket may also broadcast this message, so we need to prevent duplicates
      setOpenWindows(prev =>
        prev.map(w => {
          if (w.id === windowId) {
            const messageExists = w.messages.some(m => m.id === newMessage.id);
            if (messageExists) return w;
            return { ...w, messages: [...w.messages, newMessage] };
          }
          return w;
        })
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [user?.id]);

  // Debounce markAsRead calls to prevent excessive API requests
  const markAsReadTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const markAsRead = useCallback((windowId: string) => {
    // Use ref to get current windows to avoid stale closure
    const currentWindow = openWindowsRef.current.find(w => w.id === windowId);
    if (!currentWindow) return;

    // Clear any existing timeout for this window
    const existingTimeout = markAsReadTimeouts.current.get(windowId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Update UI immediately
    setOpenWindows(prev =>
      prev.map(w =>
        w.id === windowId ? { ...w, unreadCount: 0 } : w
      )
    );

    // Debounce the API call - only send after 500ms of no calls
    const timeout = setTimeout(() => {
      fetch(`/api/instant-messages/${currentWindow.user.id}/read`, {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        console.error('Failed to mark messages as read:', error);
      });
      markAsReadTimeouts.current.delete(windowId);
    }, 500);

    markAsReadTimeouts.current.set(windowId, timeout);
  }, []);

  const addMessage = useCallback((message: InstantMessage) => {
    setOpenWindows(prev => {
      const otherUserId = message.senderId === user?.id ? message.recipientId : message.senderId;
      return prev.map(w => {
        if (w.user.id === otherUserId) {
          const messageExists = w.messages.some(m => m.id === message.id);
          if (messageExists) return w;
          return {
            ...w,
            messages: [...w.messages, message],
            unreadCount: w.minimized ? w.unreadCount + 1 : 0,
          };
        }
        return w;
      });
    });
  }, [user?.id]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      markAsReadTimeouts.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      markAsReadTimeouts.current.clear();
    };
  }, []);

  return (
    <InstantMessagingContext.Provider
      value={{
        openWindows,
        openChat,
        closeChat,
        minimizeChat,
        maximizeChat,
        sendMessage,
        markAsRead,
        addMessage,
      }}
    >
      {children}
    </InstantMessagingContext.Provider>
  );
}
