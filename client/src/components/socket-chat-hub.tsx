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
    case "core-team": return <Shield className="h-4 w-4" />;
    case "committee": return <Users className="h-4 w-4" />;
    case "host": return <Heart className="h-4 w-4" />;
    case "driver": return <Truck className="h-4 w-4" />;
    case "recipient": return <MessageSquare className="h-4 w-4" />;
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
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages[currentRoom]]);

  // Handle mobile detection and responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setShowSidebar(false); // Always show sidebar on desktop
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const handleRoomSelect = (roomId: string) => {
    setCurrentRoom(roomId);
    if (isMobile) {
      setShowSidebar(false); // Hide sidebar on mobile after selection
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    // Show "now" for very recent messages
    if (diffInMinutes < 1) return "now";
    
    // Show relative time for very recent messages
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    // Check if it's today
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if it's yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Check if it's this week
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (date > weekAgo) {
      return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // For older messages, show full date and time
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRelativeTimeLabel = (timestamp: Date) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    // Less than 1 minute
    if (diffInMinutes < 1) return "now";
    
    // Less than 1 hour - show minutes
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    // Less than 24 hours - show hours
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    // Yesterday
    if (diffInDays === 1) return "Yesterday";
    
    // Today (should not happen given the logic above, but safety check)
    if (date.toDateString() === now.toDateString()) return "Today";
    
    // Less than a week - show day name
    if (diffInDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    // More than a week - show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group messages by relative time periods
  const groupMessagesByTime = (messages: ChatMessage[]) => {
    return messages.reduce((groups: { [key: string]: ChatMessage[] }, message) => {
      const timeLabel = getRelativeTimeLabel(message.timestamp);
      if (!groups[timeLabel]) {
        groups[timeLabel] = [];
      }
      groups[timeLabel].push(message);
      return groups;
    }, {});
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
      {/* Mobile Overlay */}
      {isMobile && showSidebar && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      {/* Left Sidebar - Channels */}
      <div className={`
        ${isMobile 
          ? `fixed left-0 top-0 h-full w-80 z-20 transform transition-transform duration-300 ${
              showSidebar ? 'translate-x-0' : '-translate-x-full'
            }`
          : 'w-72 relative'
        } bg-gray-50 border-r border-gray-200
      `}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Channels</h2>
              <p className="text-sm text-gray-600">Team communication</p>
            </div>
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(false)}
                className="md:hidden"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="p-3 space-y-1">
          {rooms.map((room) => (
            <div key={room.id} className={`rounded border ${
              currentRoom === room.id ? 'bg-[#236383] border-[#236383]' : 'bg-white border-gray-200 hover:border-gray-300'
            } transition-colors`}>
              <button
                className="w-full text-left p-3"
                onClick={() => handleRoomSelect(room.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={currentRoom === room.id ? 'text-white' : 'text-[#236383]'}>
                      {getRoomIcon(room.id)}
                    </span>
                    <span className={`font-medium text-sm ${currentRoom === room.id ? 'text-white' : 'text-gray-900'}`}>
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
                <p className={`text-xs leading-tight ${currentRoom === room.id ? 'text-blue-100' : 'text-gray-500'}`}>
                  {(() => {
                    const roomMessages = messages[room.id] || [];
                    if (roomMessages.length === 0) {
                      return 'No messages yet • Click to start the conversation';
                    }
                    const lastMessage = roomMessages[roomMessages.length - 1];
                    const preview = lastMessage.content.length > 40 
                      ? lastMessage.content.substring(0, 40) + '...' 
                      : lastMessage.content;
                    return `${lastMessage.userName}: ${preview}`;
                  })()}
                </p>
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            {/* Chat Header */}
            <div className="px-4 md:px-6 py-4 bg-[#236383] text-white border-b border-[#1e5573]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSidebar(true)}
                      className="text-white hover:bg-white/10 p-1"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  )}
                  <span className="text-white">
                    {getRoomIcon(currentRoom)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold truncate">
                      {rooms.find(r => r.id === currentRoom)?.name || 'Unknown Room'}
                    </h3>
                    <p className="text-blue-100 text-sm truncate">
                      {currentRoom === 'general' && 'Open discussion for all team members'}
                      {currentRoom === 'core-team' && 'Core team coordination'}
                      {currentRoom === 'committee' && 'Committee discussions'}
                      {currentRoom === 'host' && 'Host coordination'}
                      {currentRoom === 'driver' && 'Driver coordination'}
                      {currentRoom === 'recipient' && 'Recipient communication'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-500 text-white border-green-400 hidden sm:block">
                  {connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-2 md:px-4 py-3 bg-white">
              <div className="space-y-1">
                {(() => {
                  const currentMessages = messages[currentRoom] || [];
                  const groupedMessages = groupMessagesByTime(currentMessages);
                  
                  return Object.entries(groupedMessages).map(([timeLabel, timeMessages]) => (
                    <div key={timeLabel} className="mb-6">
                      {/* Time separator - iMessage style */}
                      <div className="flex items-center justify-end mb-4">
                        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                          {timeLabel}
                        </span>
                      </div>
                      
                      {/* Messages for this time period */}
                      {timeMessages.map((message: ChatMessage, index) => {
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
                          <div key={message.id} className="flex gap-2 group py-1">
                            <Avatar className="h-6 w-6 md:h-7 md:w-7 flex-shrink-0">
                              <AvatarFallback className={`text-xs font-medium text-white ${getAvatarColor(message.userName)}`}>
                                {getInitials(message.userName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-0 flex-wrap">
                                <span className="font-medium text-gray-900 text-sm break-words">{message.userName}</span>
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                  {formatTime(message.timestamp)}
                                </span>
                              </div>
                              <p className="text-gray-800 text-sm leading-tight break-words">
                                <MessageWithMentions content={message.content} />
                              </p>
                              {/* Message actions */}
                              <div className="flex items-center mt-0">
                                <ChatMessageLikeButton messageId={message.id} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input with Mentions */}
            <div className="px-2 md:px-4 py-3 bg-gray-50 border-t border-gray-200">
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
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Select a room to start chatting</p>
              {isMobile && (
                <Button 
                  onClick={() => setShowSidebar(true)}
                  className="bg-[#236383] hover:bg-[#1e5573]"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Choose Channel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}