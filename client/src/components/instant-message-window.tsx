import { useState, useRef, useEffect } from 'react';
import { X, Minus, Send, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import type { ChatWindow, InstantMessage } from '@/contexts/instant-messaging-context';

interface InstantMessageWindowProps {
  window: ChatWindow;
  index: number;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onSendMessage: (content: string) => Promise<void>;
  onMarkAsRead: () => void;
}

function getInitials(user: ChatWindow['user']): string {
  if (user.displayName) {
    return user.displayName.substring(0, 2).toUpperCase();
  }
  if (user.firstName && user.lastName) {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }
  if (user.firstName) {
    return user.firstName.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return 'U';
}

function getDisplayName(user: ChatWindow['user']): string {
  if (user.displayName) return user.displayName;
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.email) return user.email.split('@')[0];
  return 'User';
}

export function InstantMessageWindow({
  window,
  index,
  onClose,
  onMinimize,
  onMaximize,
  onSendMessage,
  onMarkAsRead,
}: InstantMessageWindowProps) {
  const { user: currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate position from right side
  const rightOffset = 20 + index * 340; // 320px width + 20px gap

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!window.minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [window.messages, window.minimized]);

  // Focus input when maximized
  useEffect(() => {
    if (!window.minimized) {
      inputRef.current?.focus();
      // Only mark as read when window becomes maximized (not on every render)
      onMarkAsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.minimized]); // Only depend on minimized state, not onMarkAsRead

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(message);
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Minimized state - show as small bar
  if (window.minimized) {
    return (
      <div
        className="fixed bottom-0 bg-white border border-gray-200 rounded-t-lg shadow-lg cursor-pointer hover:bg-gray-50 transition-colors z-50"
        style={{ right: `${rightOffset}px`, width: '280px' }}
        onClick={onMaximize}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative">
              <Avatar className="h-6 w-6">
                <AvatarImage src={window.user.profileImageUrl || undefined} />
                <AvatarFallback className="bg-teal-100 text-teal-700 text-xs">
                  {getInitials(window.user)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white" />
            </div>
            <span className="font-medium text-sm truncate">
              {getDisplayName(window.user)}
            </span>
            {window.unreadCount > 0 && (
              <Badge className="h-5 min-w-[20px] text-xs bg-red-500 hover:bg-red-500">
                {window.unreadCount}
              </Badge>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded hover:bg-gray-200 text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Full chat window
  return (
    <div
      className="fixed bottom-0 bg-white border border-gray-200 rounded-t-lg shadow-xl z-50 flex flex-col"
      style={{ right: `${rightOffset}px`, width: '320px', height: '400px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <Avatar className="h-8 w-8 border-2 border-white/30">
              <AvatarImage src={window.user.profileImageUrl || undefined} />
              <AvatarFallback className="bg-white text-teal-700 text-xs">
                {getInitials(window.user)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white text-sm truncate">
              {getDisplayName(window.user)}
            </p>
            <p className="text-xs text-white/70">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="p-1 rounded hover:bg-white/20 text-white"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {window.messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            <p>No messages yet</p>
            <p className="text-xs mt-1">Say hello to start a conversation!</p>
          </div>
        ) : (
          window.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === currentUser?.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t bg-white">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 text-sm"
            disabled={sending}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="bg-teal-500 hover:bg-teal-600"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: InstantMessage; isOwn: boolean }) {
  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
          isOwn
            ? 'bg-teal-500 text-white rounded-br-md'
            : 'bg-white text-gray-900 border rounded-bl-md'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={cn(
            'text-[10px] mt-1',
            isOwn ? 'text-white/70' : 'text-gray-400'
          )}
        >
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export default InstantMessageWindow;
