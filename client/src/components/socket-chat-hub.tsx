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
    case "general": return <Hash className="h-4 w-4" />;
    case "core-team": return <Hash className="h-4 w-4" />;
    case "committee": return <Users className="h-4 w-4" />;
    case "host": return <Hash className="h-4 w-4" />;
    case "driver": return <Hash className="h-4 w-4" />;
    case "recipient": return <Hash className="h-4 w-4" />;
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
    <div className="flex h-full bg-white relative">
      {/* Left Sidebar - Channels */}
      <div className="w-72 bg-gray-50 border-r border-gray-200 relative">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Channels</h2>
          <p className="text-sm text-gray-600">Team communication</p>
        </div>

        <div className="p-4 space-y-2">
          {rooms.map((room) => (
            <div key={room.id} className={`rounded-lg border ${
              currentRoom === room.id ? 'bg-[#236383] border-[#236383]' : 'bg-white border-gray-200 hover:border-gray-300'
            } transition-colors`}>
              <button
                className="w-full text-left p-4"
                onClick={() => setCurrentRoom(room.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={currentRoom === room.id ? 'text-white' : 'text-[#236383]'}>
                      {getRoomIcon(room.id)}
                    </span>
                    <span className={`font-medium ${currentRoom === room.id ? 'text-white' : 'text-gray-900'}`}>
                      {room.name}
                    </span>
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
                <p className={`text-xs ${currentRoom === room.id ? 'text-blue-100' : 'text-gray-500'}`}>
                  {room.id === 'general' && (messages.general?.length > 0 ? 'Katie (Main): Thank you so much everyone for logging...' : 'No messages yet • Click to start the conversation')}
                  {room.id === 'core-team' && 'Katie (Main): Is stephanie!'} 
                  {room.id === 'committee' && 'No messages yet • Click to start the conversation'}
                  {room.id === 'host' && 'No messages yet • Click to start the conversation'}
                  {room.id === 'driver' && 'No messages yet • Click to start the conversation'}
                  {room.id === 'recipient' && 'No messages yet • Click to start the conversation'}
                </p>
              </button>
            </div>
          ))}
        </div>
        
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-xs text-gray-600">
            <span>Connected as Katie (Main)</span>
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
            <ScrollArea className="flex-1 px-6 py-4 bg-white">
              <div className="space-y-2">
                {(messages[currentRoom] || []).map((message: ChatMessage, index) => {
                  console.log("Rendering socket chat message:", message);
                  
                  // Generate consistent colors based on user name
                  const getAvatarColor = (userName: string) => {
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500'];
                    const hash = userName.split('').reduce((a, b) => {
                      a = ((a << 5) - a) + b.charCodeAt(0);
                      return a & a;
                    }, 0);
                    return colors[Math.abs(hash) % colors.length];
                  };
                  
                  return (
                    <div key={message.id} className="flex gap-3 group">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className={`text-xs font-medium text-white ${getAvatarColor(message.userName)}`}>
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
                        <p className="text-gray-800 leading-relaxed">
                          <MessageWithMentions content={message.content} />
                        </p>
                        {/* Message actions */}
                        <div className="flex items-center mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <MentionInput
                value={newMessage}
                onChange={setNewMessage}
                onSend={handleSendMessage}
                placeholder={`Message ${rooms.find(r => r.id === currentRoom)?.name || 'General'}...`}
                disabled={!connected}
              />
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