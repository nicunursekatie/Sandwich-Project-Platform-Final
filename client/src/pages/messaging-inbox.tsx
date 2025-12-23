import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import {
  Inbox as InboxIcon,
  Send,
  MessageSquare,
  CheckCircle2,
  Circle,
  Search,
  RefreshCw,
  Star,
  Paperclip,
  FileText,
  Image,
  File,
  Download,
  ExternalLink,
} from 'lucide-react';
import { MessageContextBadge } from '@/components/message-context-badge';
import { logger } from '@/lib/logger';

interface MessageAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface Message {
  id: number;
  content: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  contextType?: string;
  contextId?: string;
  contextTitle?: string;
  createdAt: string;
  read?: boolean;
  readAt?: string;
  attachments?: string; // JSON string of MessageAttachment[]
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper to get icon for file type
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type === 'application/pdf') return FileText;
  return File;
}

// Parse attachments from JSON string
function parseAttachments(attachmentsStr?: string): MessageAttachment[] {
  if (!attachmentsStr) return [];
  try {
    return JSON.parse(attachmentsStr);
  } catch {
    return [];
  }
}

export default function MessagingInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all messages
  const { data: allMessagesData, isLoading: loadingAll } = useQuery({
    queryKey: ['/api/messaging/all'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/messaging/all');
      return response.messages || [];
    },
  });

  // Fetch unread messages
  const { data: unreadMessagesData, isLoading: loadingUnread } = useQuery({
    queryKey: ['/api/messaging'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/messaging');
      return response.messages || [];
    },
  });

  const messages = activeTab === 'all' ? allMessagesData || [] : unreadMessagesData || [];
  const isLoading = activeTab === 'all' ? loadingAll : loadingUnread;

  // Filter messages by search query
  const filteredMessages = messages.filter((msg: Message) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      msg.content?.toLowerCase().includes(searchLower) ||
      msg.senderName?.toLowerCase().includes(searchLower) ||
      msg.contextTitle?.toLowerCase().includes(searchLower)
    );
  });

  // Mark message as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return await apiRequest('POST', `/api/messaging/${messageId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/all'] });
      toast({ description: 'Message marked as read' });
    },
  });

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    if (!message.read) {
      markAsReadMutation.mutate(message.id);
    }
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const unreadCount = unreadMessagesData?.length || 0;

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          Comments
        </h1>
        <p className="text-gray-600 mt-2">
          View comments and notifications about events, projects, and tasks
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {/* Message List */}
        <Card className="md:col-span-1 flex flex-col">
          <CardContent className="p-4 flex flex-col h-full">
            <div className="mb-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'unread')}>
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">
                    <InboxIcon className="w-4 h-4 mr-2" />
                    All
                  </TabsTrigger>
                  <TabsTrigger value="unread" className="flex-1">
                    <Circle className="w-4 h-4 mr-2" />
                    Unread {unreadCount > 0 && `(${unreadCount})`}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading comments...
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="text-4xl mb-2">💬</div>
                  <div>No comments yet</div>
                </div>
              ) : (
                filteredMessages.map((message: Message) => (
                  <div
                    key={message.id}
                    onClick={() => handleSelectMessage(message)}
                    className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedMessage?.id === message.id ? 'bg-brand-primary-lighter' : ''
                    } ${!message.read ? 'bg-blue-25' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
                          {getInitials(message.senderName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm ${
                              !message.read
                                ? 'font-bold text-gray-900'
                                : 'font-normal text-gray-600'
                            }`}
                          >
                            {message.senderName}
                          </span>
                          {!message.read && (
                            <Circle className="w-2 h-2 text-brand-primary fill-current" />
                          )}
                        </div>

                        {message.contextType && (
                          <div className="mb-1">
                            <MessageContextBadge
                              contextType={message.contextType}
                              contextTitle={message.contextTitle}
                            />
                          </div>
                        )}

                        <div className="text-xs text-gray-500 truncate">
                          {message.content.substring(0, 100)}
                          {message.content.length > 100 && '...'}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(message.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                          {parseAttachments(message.attachments).length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Paperclip className="w-3 h-3" />
                              {parseAttachments(message.attachments).length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Detail */}
        <Card className="md:col-span-2 flex flex-col">
          <CardContent className="p-6 flex flex-col h-full">
            {selectedMessage ? (
              <div className="flex flex-col h-full">
                {/* Message Header */}
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gray-200 text-gray-600">
                          {getInitials(selectedMessage.senderName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {selectedMessage.senderName}
                        </div>
                        {selectedMessage.senderEmail && (
                          <div className="text-sm text-gray-500">
                            {selectedMessage.senderEmail}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(selectedMessage.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedMessage.read && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Read
                        </Badge>
                      )}
                    </div>
                  </div>

                  {selectedMessage.contextType && (
                    <div className="mt-3">
                      <MessageContextBadge
                        contextType={selectedMessage.contextType}
                        contextTitle={selectedMessage.contextTitle}
                      />
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <ScrollArea className="flex-1">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap text-gray-800">
                      {selectedMessage.content}
                    </div>

                    {/* Attachments */}
                    {parseAttachments(selectedMessage.attachments).length > 0 && (
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <Paperclip className="w-4 h-4" />
                          Attachments ({parseAttachments(selectedMessage.attachments).length})
                        </h4>
                        <div className="space-y-2">
                          {parseAttachments(selectedMessage.attachments).map((attachment, index) => {
                            const FileIcon = getFileIcon(attachment.type);
                            const isImage = attachment.type.startsWith('image/');

                            return (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
                              >
                                {isImage ? (
                                  <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                    <FileIcon className="w-6 h-6 text-gray-500" />
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {attachment.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatFileSize(attachment.size)}
                                  </p>
                                </div>

                                <a
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Open
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <div className="text-xl mb-2">Select a comment to read</div>
                  <div>Choose a comment from the list to view its contents</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
