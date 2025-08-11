import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSocketChat, ChatMessage, ChatRoom } from "@/hooks/useSocketChat";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessageLikeButton } from "./chat-message-like-button";
import { MentionInput, MessageWithMentions } from "@/components/mention-input";
import { 
  MessageSquare, 
  Send, 
  Users, 
  Building2, 
  Truck, 
  Heart, 
  Shield,
  Hash,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const getRoomIcon = (roomId: string) => {
  switch (roomId) {
    case "general": return <MessageSquare className="h-4 w-4" />;
    case "core_team": return <Shield className="h-4 w-4" />;
    case "committee": return <Users className="h-4 w-4" />;
    case "hosts": return <Building2 className="h-4 w-4" />;
    case "drivers": return <Truck className="h-4 w-4" />;
    case "recipients": return <Heart className="h-4 w-4" />;
    default: return <Hash className="h-4 w-4" />;
  }
};

const getRoomColor = (roomId: string) => {
  switch (roomId) {
    case "general": return "bg-blue-100 text-blue-800";
    case "core_team": return "bg-red-100 text-red-800";
    case "committee": return "bg-purple-100 text-purple-800";
    case "hosts": return "bg-green-100 text-green-800";
    case "drivers": return "bg-orange-100 text-orange-800";
    case "recipients": return "bg-pink-100 text-pink-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export default function SocketChatHub() {
  const { user } = useAuth();
  const {
    connected,
    rooms,
    messages,
    activeUsers,
    currentRoom,
    sendMessage,
    joinRoom,
    setCurrentRoom
  } = useSocketChat();
  
  const [newMessage, setNewMessage] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages[currentRoom]]);

  useEffect(() => {
    if (currentRoom) {
      joinRoom(currentRoom);
    }
  }, [currentRoom, joinRoom]);

  const handleSendMessage = () => {
    if (newMessage.trim() && currentRoom) {
      sendMessage(currentRoom, newMessage.trim());
      setNewMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please log in to access chat</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white">
      {/* Left Sidebar - Channels */}
      <div className="w-80 bg-gray-50 border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Hash className="h-5 w-5 text-[#236383]" />
            Team Chat
          </h2>
          <p className="text-sm text-gray-600 mt-1">Real-time communication with your team across different channels</p>
        </div>

        <div className="p-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
            connected ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Channels Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Channels</h3>
            {rooms.map((room) => (
              <div key={room.id}>
                <button
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    currentRoom === room.id 
                      ? 'bg-[#236383] text-white shadow-sm' 
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => setCurrentRoom(room.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={currentRoom === room.id ? 'text-white' : 'text-[#236383]'}>
                        {getRoomIcon(room.id)}
                      </span>
                      <span className="font-medium">{room.name}</span>
                    </div>
                    {(messages[room.id] || []).length > 0 && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          currentRoom === room.id 
                            ? 'border-white/30 text-white/90' 
                            : 'border-gray-300 text-gray-500'
                        }`}
                      >
                        {(messages[room.id] || []).length}
                      </Badge>
                    )}
                  </div>
                  {currentRoom !== room.id && (
                    <p className="text-xs text-gray-500 mt-1">
                      {room.id === 'general' && 'Open discussion for all team members'}
                      {room.id === 'core-team' && 'Core team coordination'}
                      {room.id === 'committee' && 'Committee discussions'}
                      {room.id === 'host' && 'Host coordination'}
                      {room.id === 'driver' && 'Driver coordination'}
                      {room.id === 'recipient' && 'Recipient communication'}
                    </p>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 bg-[#236383] text-white border-b border-[#1e5573]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-white">
                    {getRoomIcon(currentRoom)}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {rooms.find(r => r.id === currentRoom)?.name || 'Unknown Room'}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      {currentRoom === 'general' && 'Open discussion for all team members'}
                      {currentRoom === 'core-team' && 'Core team coordination'}
                      {currentRoom === 'committee' && 'Committee discussions'}
                      {currentRoom === 'host' && 'Host coordination'}
                      {currentRoom === 'driver' && 'Driver coordination'}
                      {currentRoom === 'recipient' && 'Recipient communication'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-500 text-white border-green-400">
                  {connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-4 bg-gray-50">
              <div className="space-y-6">
                {(messages[currentRoom] || []).map((message: ChatMessage) => {
                  console.log("Rendering socket chat message:", message);
                  return (
                    <div key={message.id} className="flex gap-4">
                      <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                        <AvatarFallback className="text-sm font-medium bg-[#236383] text-white">
                          {getInitials(message.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{message.userName}</span>
                          <span className="text-xs text-gray-500">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
                          <p className="text-gray-800 leading-relaxed">
                            <MessageWithMentions content={message.content} />
                          </p>
                        </div>
                        {/* Message actions */}
                        <div className="flex items-center mt-2 space-x-2">
                          <ChatMessageLikeButton messageId={message.id} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input with Mentions */}
            <div className="px-6 py-4 bg-white border-t border-gray-200">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <MentionInput
                    value={newMessage}
                    onChange={setNewMessage}
                    onSend={handleSendMessage}
                    placeholder={`Message ${rooms.find(r => r.id === currentRoom)?.name || 'room'}...`}
                    disabled={!connected}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Type @ to mention users • Press Tab or Enter to select • Press Esc to cancel
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Select a room to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}