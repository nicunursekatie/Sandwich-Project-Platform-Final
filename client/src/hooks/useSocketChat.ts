import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./useAuth";
// Remove getUserPermissions import as it doesn't exist

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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeUsers, setActiveUsers] = useState<Record<string, ChatUser[]>>({});
  const [currentRoom, setCurrentRoom] = useState<string>("");

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    // Use current origin for Socket.IO connection
    const socketUrl = window.location.origin;
    console.log("Connecting to Socket.IO at:", socketUrl);

    const newSocket = io(socketUrl, {
      path: "/socket.io/",
      transports: ["polling", "websocket"], // Try polling first, then upgrade to websocket
      upgrade: true,
      timeout: 30000,
      forceNew: true,
      autoConnect: true
    });

    newSocket.on("connect", () => {
      setConnected(true);
      console.log("Socket.io connected");
      
      // Get available rooms first
      newSocket.emit("get-rooms");
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
      console.log("Socket.io disconnected");
    });

    newSocket.on("rooms", ({ available }) => {
      setRooms(available);
      console.log("Received rooms:", available);
      // Auto-select first room if none selected
      if (available.length > 0 && !currentRoom) {
        setCurrentRoom(available[0].id);
      }
    });

    newSocket.on("new-message", (message: ChatMessage) => {
      setMessages(prev => ({
        ...prev,
        [message.room]: [...(prev[message.room] || []), message]
      }));
    });

    newSocket.on("message-history", (messages: ChatMessage[]) => {
      if (messages.length > 0) {
        const room = messages[0].room;
        setMessages(prev => ({
          ...prev,
          [room]: messages
        }));
      }
    });

    newSocket.on("joined-channel", ({ channel }) => {
      console.log(`Successfully joined channel: ${channel}`);
    });

    newSocket.on("user_joined", ({ userId, username, room }) => {
      setActiveUsers(prev => ({
        ...prev,
        [room]: [...(prev[room] || []).filter(u => u.userId !== userId), { userId, username, room }]
      }));
    });

    newSocket.on("user_left", ({ userId, room }) => {
      setActiveUsers(prev => ({
        ...prev,
        [room]: (prev[room] || []).filter(u => u.userId !== userId)
      }));
    });

    newSocket.on("error", ({ message }) => {
      console.error("Socket.io error:", message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  // Send message
  const sendMessage = useCallback((room: string, content: string) => {
    if (socket && connected && user) {
      socket.emit("send-message", { 
        channel: room, 
        content 
      });
    }
  }, [socket, connected, user]);

  // Join room and get history
  const joinRoom = useCallback((roomId: string) => {
    if (socket && connected && user) {
      setCurrentRoom(roomId);
      const userName = (user as any)?.firstName || (user as any)?.email || 'Anonymous';
      const userId = (user as any)?.id || 'anonymous';
      socket.emit("join-channel", { 
        channel: roomId, 
        userId: userId,
        userName: userName
      });
    }
  }, [socket, connected, user]);

  return {
    connected,
    rooms,
    messages,
    activeUsers,
    currentRoom,
    sendMessage,
    joinRoom,
    setCurrentRoom
  };
}