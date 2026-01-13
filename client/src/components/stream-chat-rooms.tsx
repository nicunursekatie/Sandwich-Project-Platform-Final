import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Thread,
  Window,
  ChannelHeader,
  LoadingIndicator,
  Message,
  useMessageContext,
  useChannelStateContext,
} from 'stream-chat-react';
import { StreamChat, Channel as ChannelType } from 'stream-chat';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Hash,
  Shield,
  Users,
  Heart,
  Truck,
  MessageSquare,
  Plus,
  Search,
  X,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, CheckCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Import Stream Chat styles
import 'stream-chat-react/dist/css/v2/index.css';
import { logger } from '@/lib/logger';

// Custom Message component with read receipts
const CustomMessage = () => {
  const { message, readBy } = useMessageContext();
  const { channel } = useChannelStateContext();
  const { user } = useAuth();
  
  // Check if this is the current user's message
  const isOwnMessage = message?.user?.id === `user_${user?.id}`;
  const currentUserId = user?.id ? `user_${user.id}` : null;
  
  // Get read receipts - Stream Chat tracks reads in readBy array
  // Filter out the sender from the readers array (sender should not count as a reader)
  const allReaders = readBy || [];
  const readers = currentUserId
    ? allReaders.filter((reader: any) => reader.user?.id !== currentUserId)
    : allReaders;
  const hasReaders = readers.length > 0;

  // Get channel member count to determine if all have read
  // Ensure memberCount is never negative (edge case when members object is empty or undefined)
  const rawMemberCount = channel?.state?.members ? Object.keys(channel.state.members).length - 1 : 0; // -1 to exclude sender
  const memberCount = Math.max(0, rawMemberCount);
  const allRead = memberCount > 0 && readers.length >= memberCount;
  
  return (
    <>
      <Message message={message} />
      {/* Show read receipts for your own messages */}
      {isOwnMessage && (
        <div className="read-receipt-indicator">
          {hasReaders ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center">
                    {allRead ? (
                      <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="text-xs">
                    <p className="font-medium mb-1">
                      {memberCount === 0
                        ? 'Read'
                        : allRead
                          ? 'Read by everyone'
                          : `Read by ${readers.length} of ${memberCount}`}
                    </p>
                    {readers.length > 0 && (
                      <div className="space-y-1">
                        {readers.slice(0, 5).map((reader: any, index: number) => {
                          const readerName = reader.user?.name || reader.user?.id || 'Someone';
                          return (
                            <p key={reader.user?.id || `reader-${index}`} className="text-gray-300">
                              {readerName}
                            </p>
                          );
                        })}
                        {readers.length > 5 && (
                          <p className="text-gray-400 italic">+{readers.length - 5} more</p>
                        )}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center">
                  <Check className="w-3.5 h-3.5 text-gray-400" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Sent
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </>
  );
};

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
    color: #ffffff !important;
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
    color: #ffffff !important;
  }

  /* Read receipts for own messages */
  .str-chat__message--me .str-chat__message-bubble {
    position: relative;
  }

  /* Link colors for better contrast */
  .str-chat__message--me .str-chat__message-bubble a {
    color: #A3E8FF !important;
    text-decoration: underline !important;
  }

  .str-chat__message--me .str-chat__message-bubble a:hover {
    color: #ffffff !important;
  }

  .str-chat__message--other .str-chat__message-bubble a {
    color: #236383 !important;
    text-decoration: underline !important;
  }

  .str-chat__message--other .str-chat__message-bubble a:hover {
    color: #007E8C !important;
  }

  .read-receipt-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    padding-left: 8px;
    font-size: 11px;
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
  { id: 'volunteer-management', name: 'Volunteer Chat', icon: Users, permission: 'CHAT_VOLUNTEER_MANAGEMENT' },
  { id: 'host', name: 'Host Chat', icon: Heart, permission: 'CHAT_HOST' },
  { id: 'driver', name: 'Driver Chat', icon: Truck, permission: 'CHAT_DRIVER' },
  { id: 'recipient', name: 'Recipient Chat', icon: MessageSquare, permission: 'CHAT_RECIPIENT' },
];

// Extended room type with member info
interface RoomWithMembers {
  id: string;
  name: string;
  icon: any;
  permission: string;
  memberCount: number;
  channel?: ChannelType;
}

export default function StreamChatRooms() {
  const { user } = useAuth();
  const { track } = useOnboardingTracker();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [userRooms, setUserRooms] = useState<typeof CHAT_ROOMS>([]);
  const [teamRoomChannels, setTeamRoomChannels] = useState<Map<string, RoomWithMembers>>(new Map());
  const [streamUserId, setStreamUserId] = useState<string>('');
  const [directMessages, setDirectMessages] = useState<ChannelType[]>([]);
  const [groupChats, setGroupChats] = useState<ChannelType[]>([]);
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [activeSection, setActiveSection] = useState<'rooms' | 'dms' | 'groups'>('rooms');
  const [unreadCounts, setUnreadCounts] = useState<{ rooms: number; dms: number; groups: number }>({ rooms: 0, dms: 0, groups: 0 });
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Members dialog (for group chats / channels where preview truncates member list)
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [membersDialogTitle, setMembersDialogTitle] = useState<string>('Chat Members');
  const [membersDialogUsers, setMembersDialogUsers] = useState<Array<{ id: string; name: string }>>([]);

  const openMembersDialog = (channel: ChannelType) => {
    const members = Object.values(channel.state?.members || {})
      .map((m: any) => {
        const id = String(m.user?.id || m.user_id || '');
        const name = String(m.user?.name || m.user_id || m.user?.id || 'Unknown');
        return { id, name };
      })
      .filter((m) => m.id && m.id !== streamUserId)
      .sort((a, b) => a.name.localeCompare(b.name));

    setMembersDialogUsers(members);
    setMembersDialogTitle(String((channel.data as any)?.name || 'Chat Members'));
    setShowMembersDialog(true);
  };

  // Fetch all users for DM/group creation (uses for-assignments endpoint - no special permissions needed)
  const { data: allUsers = [] } = useQuery({
    queryKey: ['/api/users/for-assignments'],
    queryFn: () => apiRequest('GET', '/api/users/for-assignments'),
  });

  // Filter users for search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const query = searchQuery.toLowerCase();
    return allUsers.filter((u: any) =>
      u.firstName?.toLowerCase().includes(query) ||
      u.lastName?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query)
    );
  }, [allUsers, searchQuery]);

  // Get user display name
  const getUserDisplayName = (u: any) => {
    if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
    if (u.firstName) return u.firstName;
    return u.email;
  };

  // Get user initials
  const getUserInitials = (u: any) => {
    if (u.firstName && u.lastName) return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
    if (u.firstName) return u.firstName[0].toUpperCase();
    return u.email?.[0]?.toUpperCase() || '?';
  };

  // Calculate and update unread counts for all sections
  const updateUnreadCounts = (dmChannels: ChannelType[], groupChannels: ChannelType[], roomChannelsMap: Map<string, RoomWithMembers>) => {
    const dmsUnread = dmChannels.reduce((sum, ch) => sum + (ch.countUnread() || 0), 0);
    const groupsUnread = groupChannels.reduce((sum, ch) => sum + (ch.countUnread() || 0), 0);
    const roomsUnread = Array.from(roomChannelsMap.values()).reduce((sum, r) => sum + (r.channel?.countUnread() || 0), 0);
    setUnreadCounts({ rooms: roomsUnread, dms: dmsUnread, groups: groupsUnread });
  };

  // Load DMs and group chats - returns arrays for unread count calculation
  const loadUserChannels = async (chatClient: StreamChat, currentStreamUserId: string): Promise<{ dmChannels: ChannelType[]; groupChannels: ChannelType[] }> => {
    try {
      // Query for direct message channels (1:1)
      const dmFilter = {
        type: 'messaging',
        members: { $in: [currentStreamUserId] },
        member_count: 2,
      };
      const dmChannels = await chatClient.queryChannels(dmFilter, { last_message_at: -1 }, { limit: 20 });
      setDirectMessages(dmChannels);

      // Query for group chats (3+ members)
      const groupFilter = {
        type: 'messaging',
        members: { $in: [currentStreamUserId] },
        member_count: { $gt: 2 },
      };
      const groupChannels = await chatClient.queryChannels(groupFilter, { last_message_at: -1 }, { limit: 20 });
      setGroupChats(groupChannels);

      return { dmChannels, groupChannels };
    } catch (error) {
      logger.error('Failed to load user channels:', error);
      return { dmChannels: [], groupChannels: [] };
    }
  };

  // Create a new DM
  const createDirectMessage = async (targetUserId: string) => {
    if (!client || !streamUserId) return;

    try {
      // Use the server endpoint to create the channel (ensures users are registered with Stream)
      const response = await apiRequest('POST', '/api/stream/channels', {
        participants: [targetUserId],
        channelType: 'messaging',
      });

      if (!response?.channelCid) {
        throw new Error('Failed to create channel');
      }

      // Now watch the channel from the client
      const channel = client.channel('messaging', response.channelId);
      await channel.watch();

      setActiveChannel(channel);
      setActiveSection('dms');
      setShowNewMessageDialog(false);
      setSearchQuery('');

      // Refresh DM list
      await loadUserChannels(client, streamUserId);

      toast({
        title: 'Conversation started',
        description: 'You can now send messages.',
      });
    } catch (error) {
      logger.error('Failed to create DM:', error);
      toast({
        title: 'Failed to start conversation',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Create a new group chat
  const createGroupChat = async () => {
    if (!client || !streamUserId || selectedUsers.length < 2) return;

    try {
      // Use the server endpoint to create the channel (ensures all users are registered with Stream)
      const response = await apiRequest('POST', '/api/stream/channels', {
        participants: selectedUsers,
        channelType: 'messaging',
        channelName: groupName || `Group Chat (${selectedUsers.length + 1} members)`,
      });

      if (!response?.channelCid) {
        throw new Error('Failed to create channel');
      }

      // Now watch the channel from the client
      const channel = client.channel('messaging', response.channelId);
      await channel.watch();

      setActiveChannel(channel);
      setActiveSection('groups');
      setShowNewGroupDialog(false);
      setSelectedUsers([]);
      setGroupName('');
      setSearchQuery('');

      // Refresh group list
      await loadUserChannels(client, streamUserId);

      toast({
        title: 'Group created',
        description: `Group chat with ${selectedUsers.length + 1} members created.`,
      });
    } catch (error) {
      logger.error('Failed to create group:', error);
      toast({
        title: 'Failed to create group',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Toggle user selection for group chat
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Initialize Stream Chat client
  useEffect(() => {
    let isInitialized = false;

    const initializeClient = async () => {
      if (!user || isInitialized) return;

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

        // Only connect if not already connected
        if (!chatClient.userID) {
          await chatClient.connectUser(
            {
              id: streamUserId,
              name: (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email) || user.email || 'User',
            } as any,
            userToken
          );
        }

        isInitialized = true;

        // Listen for new messages from this user to track challenge completion
        chatClient.on('message.new', (event) => {
          // Only track if it's the current user sending the message
          if (event.user?.id === streamUserId) {
            track('chat_first_message');
          }
        });

        setClient(chatClient);
        setStreamUserId(streamUserId);

        // Send heartbeat to mark user as online (for notification suppression)
        const sendHeartbeat = () => {
          fetch('/api/stream/heartbeat', {
            method: 'POST',
            credentials: 'include',
          }).catch(() => {}); // Ignore errors
        };

        // Send initial heartbeat
        sendHeartbeat();

        // Send heartbeat every 2 minutes while chat is open
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, 2 * 60 * 1000);

        // Load DMs and group chats
        const { dmChannels, groupChannels } = await loadUserChannels(chatClient, streamUserId);

        // Filter rooms based on user permissions
        const accessibleRooms = CHAT_ROOMS.filter(room => {
          // Check if user has permission for this room
          const permissions = user.permissions as string[] | undefined;
          if (!permissions || !Array.isArray(permissions)) return false;
          return permissions.includes(room.permission);
        });

        setUserRooms(accessibleRooms);

        // Query all team channels to get proper member counts
        const roomChannelsMap = new Map<string, RoomWithMembers>();

        // Query channels with full member data
        const teamChannelFilter = {
          type: 'team',
          id: { $in: accessibleRooms.map(r => r.id) }
        };

        try {
          const channels = await chatClient.queryChannels(
            teamChannelFilter,
            { created_at: -1 },
            {
              limit: 20,
              state: true,
              watch: true,
            }
          );

          // Map channels to rooms with member counts
          for (const room of accessibleRooms) {
            const channel = channels.find(c => c.id === room.id);
            if (channel) {
              // Use channel.data.member_count for accurate server-side count
              const memberCount = (channel.data?.member_count as number) || Object.keys(channel.state?.members || {}).length;
              roomChannelsMap.set(room.id, {
                ...room,
                memberCount,
                channel
              });
              logger.log(`Channel ${room.id} has ${memberCount} members (data.member_count: ${channel.data?.member_count})`);
            } else {
              // Channel doesn't exist yet, just watch it
              const newChannel = chatClient.channel('team', room.id);
              await newChannel.watch();
              const memberCount = (newChannel.data?.member_count as number) || Object.keys(newChannel.state?.members || {}).length;
              roomChannelsMap.set(room.id, {
                ...room,
                memberCount,
                channel: newChannel
              });
            }
          }
        } catch (queryError) {
          logger.error('Failed to query team channels:', queryError);
          // Fallback: just watch each channel individually
          for (const room of accessibleRooms) {
            try {
              const channel = chatClient.channel('team', room.id);
              await channel.watch();
              const memberCount = (channel.data?.member_count as number) || Object.keys(channel.state?.members || {}).length;
              roomChannelsMap.set(room.id, {
                ...room,
                memberCount,
                channel
              });
            } catch (error) {
              logger.error(`Failed to join channel ${room.id}:`, error);
            }
          }
        }

        setTeamRoomChannels(roomChannelsMap);

        // Update unread counts for all sections
        updateUnreadCounts(dmChannels, groupChannels, roomChannelsMap);

        // Set first accessible room as active
        if (accessibleRooms.length > 0) {
          const firstRoomData = roomChannelsMap.get(accessibleRooms[0].id);
          if (firstRoomData?.channel) {
            setActiveChannel(firstRoomData.channel);
          } else {
            const firstChannel = chatClient.channel('team', accessibleRooms[0].id);
            await firstChannel.watch();
            setActiveChannel(firstChannel);
          }

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
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [user]);

  // Real-time unread count updates
  useEffect(() => {
    if (!client) return;

    const handleMessageEvent = () => {
      // Recalculate unread counts from current state
      const dmsUnread = directMessages.reduce((sum, ch) => sum + (ch.countUnread() || 0), 0);
      const groupsUnread = groupChats.reduce((sum, ch) => sum + (ch.countUnread() || 0), 0);
      const roomsUnread = Array.from(teamRoomChannels.values()).reduce((sum, r) => sum + (r.channel?.countUnread() || 0), 0);
      setUnreadCounts({ rooms: roomsUnread, dms: dmsUnread, groups: groupsUnread });
    };

    // Listen for message events to update unread counts
    client.on('message.new', handleMessageEvent);
    client.on('message.read', handleMessageEvent);
    client.on('notification.mark_read', handleMessageEvent);

    return () => {
      client.off('message.new', handleMessageEvent);
      client.off('message.read', handleMessageEvent);
      client.off('notification.mark_read', handleMessageEvent);
    };
  }, [client, directMessages, groupChats, teamRoomChannels]);

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

  // Helper to get channel display name for DMs
  const getDMDisplayName = (channel: ChannelType) => {
    const members = Object.values(channel.state?.members || {});
    const otherMember = members.find((m: any) => m.user_id !== streamUserId);
    return otherMember?.user?.name || otherMember?.user?.id || 'Unknown';
  };

  // Helper to get channel initials for DMs
  const getDMInitials = (channel: ChannelType) => {
    const name = getDMDisplayName(channel);
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name[0]?.toUpperCase() || '?';
  };

  return (
    <>
      <style>{customChatStyles}</style>
      <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg border">
        <Chat client={client}>
        {/* Sidebar */}
        <div className="w-72 border-r border-[#47B3CB]/30 bg-gradient-to-b from-[#236383]/5 to-white flex flex-col">
          {/* Header with section tabs */}
          <div className="p-3 border-b border-[#47B3CB]/30 bg-[#236383] text-white">
            <h2 className="text-lg font-semibold mb-2">Messages</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveSection('rooms')}
                className={`relative flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeSection === 'rooms'
                    ? 'bg-white text-[#236383]'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Rooms
                {unreadCounts.rooms > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCounts.rooms > 99 ? '99+' : unreadCounts.rooms}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSection('dms')}
                className={`relative flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeSection === 'dms'
                    ? 'bg-white text-[#236383]'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                DMs
                {unreadCounts.dms > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCounts.dms > 99 ? '99+' : unreadCounts.dms}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSection('groups')}
                className={`relative flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeSection === 'groups'
                    ? 'bg-white text-[#236383]'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Groups
                {unreadCounts.groups > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCounts.groups > 99 ? '99+' : unreadCounts.groups}
                  </span>
                )}
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {/* Team Rooms Section */}
            {activeSection === 'rooms' && (
              <div>
                {userRooms.map((room) => {
                  const Icon = room.icon;
                  const isActive = activeChannel?.id === room.id && activeChannel?.type === 'team';
                  const roomData = teamRoomChannels.get(room.id);
                  const memberCount = roomData?.memberCount || 0;
                  const unreadCount = roomData?.channel?.countUnread() || 0;
                  return (
                    <div
                      key={room.id}
                      className={`p-3 border-b border-[#47B3CB]/20 cursor-pointer transition-all ${
                        isActive
                          ? 'bg-[#47B3CB]/20 border-l-4 border-l-[#236383] text-[#236383] font-medium'
                          : 'hover:bg-[#47B3CB]/10 hover:border-l-4 hover:border-l-[#FBAD3F]/50 text-gray-700'
                      }`}
                      onClick={async () => {
                        try {
                          const existingChannel = roomData?.channel || client.channel('team', room.id);
                          await existingChannel.watch();
                          setActiveChannel(existingChannel);
                        } catch (error) {
                          logger.error(`Failed to switch to channel ${room.id}:`, error);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          isActive
                            ? 'bg-[#236383] text-white'
                            : 'bg-[#47B3CB]/20 text-[#007E8C]'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate block">
                              {room.name}
                            </span>
                            {unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs flex-shrink-0">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Direct Messages Section */}
            {activeSection === 'dms' && (
              <div>
                <div className="p-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-[#47B3CB] text-[#007E8C] hover:bg-[#47B3CB]/10"
                    onClick={() => setShowNewMessageDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Message
                  </Button>
                </div>
                {directMessages.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No direct messages yet
                  </div>
                ) : (
                  directMessages.map((channel) => {
                    const isActive = activeChannel?.cid === channel.cid;
                    const unreadCount = channel.countUnread();
                    return (
                      <div
                        key={channel.cid}
                        className={`p-3 border-b border-[#47B3CB]/20 cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[#47B3CB]/20 border-l-4 border-l-[#236383] text-[#236383] font-medium'
                            : 'hover:bg-[#47B3CB]/10 hover:border-l-4 hover:border-l-[#FBAD3F]/50 text-gray-700'
                        }`}
                        onClick={async () => {
                          await channel.watch();
                          setActiveChannel(channel);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className={isActive ? 'bg-[#236383] text-white' : 'bg-[#47B3CB]/20 text-[#007E8C]'}>
                              {getDMInitials(channel)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {getDMDisplayName(channel)}
                            </span>
                            {channel.state?.messages?.length > 0 && (
                              <span className="text-xs text-gray-500 truncate block">
                                {channel.state.messages[channel.state.messages.length - 1]?.text?.substring(0, 30)}...
                              </span>
                            )}
                          </div>
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Group Chats Section */}
            {activeSection === 'groups' && (
              <div>
                <div className="p-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-[#47B3CB] text-[#007E8C] hover:bg-[#47B3CB]/10"
                    onClick={() => setShowNewGroupDialog(true)}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    New Group
                  </Button>
                </div>
                {groupChats.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No group chats yet
                  </div>
                ) : (
                  groupChats.map((channel) => {
                    const isActive = activeChannel?.cid === channel.cid;
                    const unreadCount = channel.countUnread();
                    const members = Object.values(channel.state?.members || {});
                    const memberCount = members.length;
                    // Get member names (excluding current user, limit to first 3)
                    const memberNames = members
                      .filter((m: any) => m.user_id !== streamUserId)
                      .slice(0, 3)
                      .map((m: any) => {
                        const name = m.user?.name || m.user_id;
                        // Get first name only for brevity
                        return name.split(' ')[0];
                      });
                    const additionalCount = memberCount - 1 - memberNames.length; // -1 for current user
                    const memberDisplay = additionalCount > 0
                      ? `${memberNames.join(', ')} +${additionalCount}`
                      : memberNames.join(', ');

                    return (
                      <div
                        key={channel.cid}
                        className={`p-3 border-b border-[#47B3CB]/20 cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[#47B3CB]/20 border-l-4 border-l-[#236383] text-[#236383] font-medium'
                            : 'hover:bg-[#47B3CB]/10 hover:border-l-4 hover:border-l-[#FBAD3F]/50 text-gray-700'
                        }`}
                        onClick={async () => {
                          await channel.watch();
                          setActiveChannel(channel);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                            isActive ? 'bg-[#236383] text-white' : 'bg-[#47B3CB]/20 text-[#007E8C]'
                          }`}>
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {(channel.data as any)?.name || `Group (${memberCount})`}
                            </span>
                            <span className="text-xs text-gray-500 truncate block" title={memberDisplay}>
                              {memberNames.length > 0 ? (
                                <>
                                  {memberNames.join(', ')}
                                  {additionalCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        openMembersDialog(channel);
                                      }}
                                      className="ml-1 text-[#007E8C] hover:underline font-medium"
                                      aria-label={`View all ${memberCount} members`}
                                    >
                                      +{additionalCount} more
                                    </button>
                                  )}
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    openMembersDialog(channel);
                                  }}
                                  className="text-[#007E8C] hover:underline font-medium"
                                  aria-label={`View all ${memberCount} members`}
                                >
                                  {memberCount} members
                                </button>
                              )}
                            </span>
                          </div>
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeChannel ? (
            <Channel channel={activeChannel}>
              <Window>
                <ChannelHeader />
                {/* Members affordance: lets users see the full member list even when previews are truncated */}
                <div className="px-4 py-2 border-b bg-white flex items-center justify-between">
                  <div className="text-xs text-gray-600 truncate">
                    Members hidden in preview? View the full list here.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => openMembersDialog(activeChannel)}
                  >
                    <Users className="w-3.5 h-3.5 mr-1" />
                    Members
                  </Button>
                </div>
                <MessageList Message={CustomMessage} />
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

    {/* Members Dialog */}
    <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{membersDialogTitle}</DialogTitle>
          <DialogDescription>
            {membersDialogUsers.length} member{membersDialogUsers.length === 1 ? '' : 's'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[320px] pr-3">
          <div className="space-y-2">
            {membersDialogUsers.map((m) => {
              const initials = m.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0])
                .join('')
                .toUpperCase();

              return (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[#47B3CB]/20 text-[#007E8C] text-xs">
                      {initials || 'TM'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                    <div className="text-xs text-gray-500 truncate">{m.id}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* New Direct Message Dialog */}
    <Dialog open={showNewMessageDialog} onOpenChange={setShowNewMessageDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
          <DialogDescription>
            Search for a team member to start a conversation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <ScrollArea className="h-64">
            {filteredUsers
              .filter((u: any) => u.id !== user?.id)
              .map((u: any) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => createDirectMessage(u.id)}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-[#47B3CB]/20 text-[#007E8C]">
                      {getUserInitials(u)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{getUserDisplayName(u)}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                  <MessageCircle className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            {filteredUsers.filter((u: any) => u.id !== user?.id).length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No users found
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>

    {/* New Group Chat Dialog */}
    <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
          <DialogDescription>
            Select team members to add to your group
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Group name (optional)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((userId) => {
                const selectedUser = allUsers.find((u: any) => u.id === userId);
                return selectedUser ? (
                  <Badge
                    key={userId}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {getUserDisplayName(selectedUser)}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => toggleUserSelection(userId)}
                    />
                  </Badge>
                ) : null;
              })}
            </div>
          )}
          <ScrollArea className="h-48">
            {filteredUsers
              .filter((u: any) => u.id !== user?.id)
              .map((u: any) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                    selectedUsers.includes(u.id) ? 'bg-[#47B3CB]/20' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => toggleUserSelection(u.id)}
                >
                  <Checkbox
                    checked={selectedUsers.includes(u.id)}
                    onCheckedChange={() => toggleUserSelection(u.id)}
                  />
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[#47B3CB]/20 text-[#007E8C] text-xs">
                      {getUserInitials(u)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{getUserDisplayName(u)}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                </div>
              ))}
          </ScrollArea>
          <Button
            className="w-full bg-[#007E8C] hover:bg-[#236383]"
            disabled={selectedUsers.length < 2}
            onClick={createGroupChat}
          >
            <Users className="w-4 h-4 mr-2" />
            Create Group ({selectedUsers.length + 1} members)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}