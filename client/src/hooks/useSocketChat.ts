import { useEffect, useState, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { getOrCreateSocket, onSocketConnect } from '@/lib/socket-singleton';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  room: string;
}

export interface ChatRoom {
  id: string;
  name: string;
}

export interface ChatUser {
  userId: string;
  userName: string;
  room: string;
}

export function useSocketChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeUsers, setActiveUsers] = useState<Record<string, ChatUser[]>>(
    {}
  );
  const [currentRoom, setCurrentRoom] = useState<string>('');

  const currentRoomRef = useRef<string>('');
  const roomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    if (!user) return;

    const sharedSocket = getOrCreateSocket();
    setSocket(sharedSocket);

    const handleConnect = () => {
      setConnected(true);
      logger.log('[SocketChat] Connected via shared socket');
      sharedSocket.emit('get-rooms');
    };

    const handleDisconnect = () => {
      setConnected(false);
      logger.log('[SocketChat] Disconnected');
    };

    const handleRooms = ({ available }: { available?: ChatRoom[] }) => {
      setRooms(available || []);
      logger.log('Received rooms:', available);

      (available || []).forEach((room: ChatRoom) => {
        sharedSocket.emit('get-history', room.id);
      });

      if ((available || []).length > 0 && !currentRoomRef.current) {
        setCurrentRoom((available || [])[0]?.id);
      }
    };

    const handleNewMessage = (message: ChatMessage) => {
      setMessages((prev) => ({
        ...prev,
        [message.room]: [...(prev[message.room] || []), message],
      }));

      window.dispatchEvent(new CustomEvent('refreshNotifications'));
      logger.log('New message received, triggering notification refresh');

      const isFromOtherUser = message.userId !== (user as any)?.id;
      const isInDifferentRoom = message.room !== currentRoomRef.current;
      const isOnChatPage = window.location.pathname.includes('/chat');

      if (isFromOtherUser && (isInDifferentRoom || !isOnChatPage)) {
        const roomName = roomsRef.current.find(r => r.id === message.room)?.name || message.room;
        const truncatedContent = message.content.length > 50
          ? message.content.substring(0, 50) + '...'
          : message.content;

        toast({
          title: `${message.userName} in ${roomName}`,
          description: truncatedContent,
          duration: 5000,
        });
      }
    };

    const handleMessageHistory = (data: { room: string; messages: ChatMessage[] }) => {
      const { room, messages: roomMessages } = data;
      setMessages((prev) => ({
        ...prev,
        [room]: roomMessages || [],
      }));
      logger.log(
        `Received message history for ${room}:`,
        roomMessages?.length || 0,
        'messages'
      );
    };

    const handleJoinedChannel = ({ channel }: { channel: string }) => {
      logger.log(`Successfully joined channel: ${channel}`);
    };

    const handleUserJoined = ({ userId, username, room }: { userId: string; username: string; room: string }) => {
      setActiveUsers((prev) => ({
        ...prev,
        [room]: [
          ...(prev[room] || []).filter((u) => u.userId !== userId),
          { userId, userName: username, room },
        ],
      }));
    };

    const handleUserLeft = ({ userId, room }: { userId: string; room: string }) => {
      setActiveUsers((prev) => ({
        ...prev,
        [room]: (prev[room] || []).filter((u) => u.userId !== userId),
      }));
    };

    const handleError = ({ message }: { message: string }) => {
      logger.error('Socket.io error:', message);
    };

    setConnected(sharedSocket.connected);
    const offConnect = onSocketConnect(sharedSocket, handleConnect);

    sharedSocket.on('disconnect', handleDisconnect);
    sharedSocket.on('rooms', handleRooms);
    sharedSocket.on('new-message', handleNewMessage);
    sharedSocket.on('message-history', handleMessageHistory);
    sharedSocket.on('joined-channel', handleJoinedChannel);
    sharedSocket.on('user_joined', handleUserJoined);
    sharedSocket.on('user_left', handleUserLeft);
    sharedSocket.on('error', handleError);

    return () => {
      offConnect();
      sharedSocket.off('disconnect', handleDisconnect);
      sharedSocket.off('rooms', handleRooms);
      sharedSocket.off('new-message', handleNewMessage);
      sharedSocket.off('message-history', handleMessageHistory);
      sharedSocket.off('joined-channel', handleJoinedChannel);
      sharedSocket.off('user_joined', handleUserJoined);
      sharedSocket.off('user_left', handleUserLeft);
      sharedSocket.off('error', handleError);
      setSocket(null);
      setConnected(false);
    };
  }, [user, toast]);

  const sendMessage = useCallback(
    (room: string, content: string) => {
      if (socket && connected && user) {
        socket.emit('send-message', {
          channel: room,
          content,
        });
      }
    },
    [socket, connected, user]
  );

  const joinRoom = useCallback(
    (roomId: string) => {
      if (socket && connected && user) {
        setCurrentRoom(roomId);
        const userName =
          (user as any)?.firstName || (user as any)?.email || 'Anonymous';
        const userId = (user as any)?.id || 'anonymous';
        socket.emit('join-channel', {
          channel: roomId,
          userId: userId,
          userName: userName,
        });
      }
    },
    [socket, connected, user]
  );

  return {
    connected,
    rooms,
    messages,
    activeUsers,
    currentRoom,
    sendMessage,
    joinRoom,
    setCurrentRoom,
  };
}
