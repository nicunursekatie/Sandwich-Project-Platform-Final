import { useState, useEffect, memo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Bell, 
  MessageCircle, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Star,
  X, 
  Archive, 
  ExternalLink, 
  Calendar,
  Users,
  Settings,
  Filter,
  MoreVertical
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Notification {
  id: number;
  userId: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  category?: string;
  actionUrl?: string;
  actionText?: string;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
  expiresAt?: string;
  metadata?: any;
  relatedType?: string;
  relatedId?: number;
}

interface NotificationCounts {
  total: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

interface EnhancedNotificationsProps {
  user: any;
}

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'urgent': return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'high': return <AlertCircle className="h-4 w-4 text-orange-500" />;
    case 'medium': return <Info className="h-4 w-4 text-blue-500" />;
    case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'social': return <Users className="h-4 w-4" />;
    case 'system': return <Settings className="h-4 w-4" />;
    case 'event': return <Calendar className="h-4 w-4" />;
    case 'task': return <CheckCircle className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

const getPriorityBadgeColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

function EnhancedNotifications({ user }: EnhancedNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    unreadOnly: false,
    categories: [] as string[],
    priorities: [] as string[],
  });

  if (!user) return null;

  // Query for notification counts
  const { data: counts } = useQuery<NotificationCounts>({
    queryKey: ['/api/notifications/counts'],
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Query for notifications with filters
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['/api/notifications', currentTab, filters],
    enabled: !!user && isOpen,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentTab === 'unread') params.set('unread_only', 'true');
      if (filters.categories.length > 0) params.set('category', filters.categories[0]);
      if (filters.unreadOnly) params.set('unread_only', 'true');
      
      return apiRequest(`/api/notifications?${params.toString()}`);
    },
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) => 
      apiRequest(`/api/notifications/${notificationId}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    },
  });

  // Archive notification mutation
  const archiveNotificationMutation = useMutation({
    mutationFn: (notificationId: number) => 
      apiRequest(`/api/notifications/${notificationId}/archive`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => 
      apiRequest('/api/notifications/bulk/read', { 
        method: 'PATCH',
        body: { notificationIds: [] }, // Empty array marks all as read
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    if (notification.actionUrl) {
      if (notification.actionUrl.startsWith('http')) {
        window.open(notification.actionUrl, '_blank');
      } else {
        window.location.href = notification.actionUrl;
      }
    }
  };

  const handleArchive = (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    archiveNotificationMutation.mutate(notification.id);
  };

  const notifications = notificationsData?.notifications || [];
  const unreadCount = counts?.total || 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0"
          data-testid="button-notifications-enhanced"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 max-h-96"
        data-testid="dropdown-notifications-enhanced"
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-7 w-7 p-0"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-3 w-3" />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-xs h-7 px-2"
                data-testid="button-mark-all-read"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-1">
              {counts?.byCategory && Object.keys(counts.byCategory).map((category) => (
                <Badge
                  key={category}
                  variant={filters.categories.includes(category) ? "default" : "outline"}
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    setFilters(prev => ({
                      ...prev,
                      categories: prev.categories.includes(category)
                        ? prev.categories.filter(c => c !== category)
                        : [category]
                    }));
                  }}
                  data-testid={`filter-category-${category}`}
                >
                  {category} ({counts.byCategory[category]})
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 m-2 mb-0">
            <TabsTrigger value="all" className="text-xs" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs" data-testid="tab-unread">
              Unread ({unreadCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={currentTab} className="mt-2">
            <ScrollArea className="max-h-64">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {currentTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification: Notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "group flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                        !notification.isRead && "bg-blue-50/50"
                      )}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getCategoryIcon(notification.category)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-brand-primary rounded-full flex-shrink-0" />
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Badge 
                            className={cn("text-xs", getPriorityBadgeColor(notification.priority))}
                          >
                            {notification.priority}
                          </Badge>
                          
                          {notification.category && (
                            <Badge variant="outline" className="text-xs">
                              {notification.category}
                            </Badge>
                          )}
                          
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                          </span>
                        </div>

                        {notification.actionText && (
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {notification.actionText}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Badge>
                          </div>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-notification-menu-${notification.id}`}
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {!notification.isRead && (
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsReadMutation.mutate(notification.id);
                              }}
                              data-testid={`button-mark-read-${notification.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as read
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={(e) => handleArchive(notification, e)}
                            data-testid={`button-archive-${notification.id}`}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to full notifications page if implemented
                }}
                data-testid="button-view-all-notifications"
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default memo(EnhancedNotifications);