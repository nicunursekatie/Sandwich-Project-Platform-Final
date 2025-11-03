import React, { useState, useEffect } from 'react';
import { useMessaging } from '@/hooks/useMessaging';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: number;
  senderId: string;
  content: string;
  senderName?: string;
  senderEmail?: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  deletedAt?: string;
}

interface EventMessageThreadProps {
  eventId: string;
  eventTitle?: string;
  maxHeight?: string;
  showHeader?: boolean;
}

export const EventMessageThread: React.FC<EventMessageThreadProps> = ({
  eventId,
  eventTitle,
  maxHeight = '400px',
  showHeader = true,
}) => {
  const { getContextMessages } = useMessaging();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!eventId) return;

      setLoading(true);
      setError(null);

      try {
        const contextMessages = await getContextMessages('event', eventId);
        // Filter out deleted messages and sort by creation date
        const activeMessages = contextMessages
          .filter((msg: Message) => !msg.deletedAt)
          .sort((a: Message, b: Message) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        setMessages(activeMessages);
      } catch (err) {
        console.error('Failed to fetch event messages:', err);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Refresh messages every 30 seconds, but only when page is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchMessages();
      }
    }, 30000);

    // Also fetch when page becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchMessages();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // getContextMessages is stable (wrapped in useCallback with empty deps in useMessaging)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading messages...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No messages yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Use the message button to start a conversation
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message Thread
              <Badge variant="secondary" className="text-xs">
                {messages.length}
              </Badge>
            </h3>
            {eventTitle && (
              <p className="text-xs text-gray-500 mt-1">{eventTitle}</p>
            )}
          </div>
        </div>
      )}

      <ScrollArea style={{ maxHeight }} className="pr-4">
        <div className="space-y-3">
          {messages.map((message) => (
            <Card key={message.id} className="p-3 bg-gray-50 border-gray-200">
              <div className="space-y-2">
                {/* Message Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {message.senderName || message.senderEmail || 'Unknown User'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(message.createdAt), {
                        addSuffix: true
                      })}
                      {message.editedAt && (
                        <span className="ml-1 text-gray-400">(edited)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Message Content */}
                <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
