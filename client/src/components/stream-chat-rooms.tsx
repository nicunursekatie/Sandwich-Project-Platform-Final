import React, { useState, useEffect } from 'react';
import {
  Chat,
  Channel,
  ChannelList,
  MessageList,
  MessageInput,
  Thread,
  Window,
  ChannelHeader,
  LoadingIndicator,
} from 'stream-chat-react';
import { StreamChat, Channel as ChannelType } from 'stream-chat';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import {
  Hash,
  Shield,
  Users,
  Heart,
  Truck,
  MessageSquare,
} from 'lucide-react';

// Import Stream Chat styles
import 'stream-chat-react/dist/css/v2/index.css';
import { logger } from '@/lib/logger';

// Custom CSS for Stream Chat with brand colors
const customChatStyles = `
  /* Multi-line textarea */
  .str-chat__textarea textarea {
    min-height: 60px !important;
    max-height: 200px !important;
    resize: vertical !important;
  }

  /* Brand colors */
  .str-chat__message--me .str-chat__message-bubble {
    background: #236383 !important;
  }

  .str-chat__message--other .str-chat__message-bubble {
    background: #47B3CB20 !important;
    border: 1px solid #47B3CB40 !important;
  }

  .str-chat__input-flat {
    border-color: #47B3CB !important;
  }

  .str-chat__input-flat:focus-within {
    border-color: #236383 !important;
    box-shadow: 0 0 0 1px #236383 !important;
  }

  .str-chat__send-button {
    background: #007E8C !important;
  }

  .str-chat__send-button:hover {
    background: #236383 !important;
  }

  /* Channel list active state */
  .str-chat__channel-list-messenger__main .str-chat__channel-preview-messenger--active {
    background: #47B3CB20 !important;
    border-left: 4px solid #236383 !important;
  }

  /* Header */
  .str-chat__header-livestream {
    background: #236383 !important;
  }
`;

// Room definitions matching your Socket.io setup
const CHAT_ROOMS = [
  { id: 'general', name: 'General Chat', icon: Hash, permission: 'CHAT_GENERAL' },
  { id: 'core-team', name: 'Core Team', icon: Shield, permission: 'CHAT_CORE_TEAM' },
  { id: 'grants-committee', name: 'Grants Committee', icon: Users, permission: 'CHAT_GRANTS_COMMITTEE' },
  { id: 'events-committee', name: 'Events Committee', icon: Users, permission: 'CHAT_EVENTS_COMMITTEE' },
  { id: 'board-chat', name: 'Board Chat', icon: Users, permission: 'CHAT_BOARD' },
  { id: 'web-committee', name: 'Web Committee', icon: Users, permission: 'CHAT_WEB_COMMITTEE' },
  { id: 'volunteer-management', name: 'Volunteer Management', icon: Users, permission: 'CHAT_VOLUNTEER_MANAGEMENT' },
  { id: 'host', name: 'Host Chat', icon: Heart, permission: 'CHAT_HOST' },
  { id: 'driver', name: 'Driver Chat', icon: Truck, permission: 'CHAT_DRIVER' },
  { id: 'recipient', name: 'Recipient Chat', icon: MessageSquare, permission: 'CHAT_RECIPIENT' },
];

export default function StreamChatRooms() {
  const { user } = useAuth();
  const { track } = useOnboardingTracker();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [userRooms, setUserRooms] = useState<typeof CHAT_ROOMS>([]);

  // Initialize Stream Chat client
  useEffect(() => {
    const initializeClient = async () => {
      if (!user) return;

      try {
        // Get Stream credentials and user token from backend
        const response = await fetch('/api/stream/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || 'Failed to get Stream credentials'
          );
        }

        const { apiKey, userToken, streamUserId } = await response.json();

        const chatClient = StreamChat.getInstance(apiKey);

        await chatClient.connectUser(
          {
            id: streamUserId,
            name: `${user.firstName} ${user.lastName}` || user.email,
            email: user.email,
          },
          userToken
        );

        // Listen for new messages from this user to track challenge completion
        chatClient.on('message.new', (event) => {
          // Only track if it's the current user sending the message
          if (event.user?.id === streamUserId) {
            track('chat_first_message');
          }
        });

        setClient(chatClient);

        // Filter rooms based on user permissions
        const accessibleRooms = CHAT_ROOMS.filter(room => {
          // Check if user has permission for this room
          if (!user.permissions) return false;
          return user.permissions.includes(room.permission);
        });

        setUserRooms(accessibleRooms);

        // Join channels for accessible rooms (channels are created server-side)
        // Don't try to create them here - just watch them
        for (const room of accessibleRooms) {
          try {
            const channel = chatClient.channel('team', room.id);
            await channel.watch();
          } catch (error) {
            logger.error(`Failed to join channel ${room.id}:`, error);
          }
        }

        // Set first accessible room as active
        if (accessibleRooms.length > 0) {
          const firstChannel = chatClient.channel('team', accessibleRooms[0].id);
          await firstChannel.watch();
          setActiveChannel(firstChannel);

          // Track that user has viewed team chat messages
          track('chat_read_messages');
        }

      } catch (error) {
        logger.error('Failed to initialize Stream Chat:', error);
        toast({
          title: 'Chat Initialization Failed',
          description: 'Unable to connect to chat service. Please try refreshing.',
          variant: 'destructive',
        });
      }
    };

    initializeClient();

    return () => {
      if (client) {
        client.disconnectUser();
      }
    };
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          Please log in to access chat rooms
        </p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingIndicator />
      </div>
    );
  }

  if (userRooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            You don't have access to any chat rooms yet.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Contact an administrator to get access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{customChatStyles}</style>
      <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg border">
        <Chat client={client}>
        {/* Sidebar - Room List */}
        <div className="w-64 border-r border-[#47B3CB]/30 bg-gradient-to-b from-[#236383]/5 to-white flex flex-col">
          <div className="p-4 border-b border-[#47B3CB]/30 bg-[#236383] text-white">
            <h2 className="text-lg font-semibold">Chat Rooms</h2>
            <p className="text-xs text-white/80 mt-1">
              {userRooms.length} room{userRooms.length !== 1 ? 's' : ''} available
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {userRooms.map((room) => {
              const Icon = room.icon;
              return (
                <div
                  key={room.id}
                  className={`p-3 border-b border-[#47B3CB]/20 cursor-pointer transition-all ${
                    activeChannel?.id === room.id
                      ? 'bg-[#47B3CB]/20 border-l-4 border-l-[#236383] text-[#236383] font-medium'
                      : 'hover:bg-[#47B3CB]/10 hover:border-l-4 hover:border-l-[#FBAD3F]/50 text-gray-700'
                  }`}
                  onClick={async () => {
                    try {
                      const channel = client.channel('team', room.id);
                      await channel.watch();
                      setActiveChannel(channel);
                    } catch (error) {
                      logger.error(`Failed to switch to channel ${room.id}:`, error);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      activeChannel?.id === room.id
                        ? 'bg-[#236383] text-white'
                        : 'bg-[#47B3CB]/20 text-[#007E8C]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {room.name}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeChannel ? (
            <Channel channel={activeChannel}>
              <Window>
                <ChannelHeader />
                <MessageList />
                <MessageInput />
              </Window>
              <Thread />
            </Channel>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Select a chat room to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </Chat>
    </div>
    </>
  );
}