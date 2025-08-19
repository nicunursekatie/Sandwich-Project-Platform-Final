import { useState, useEffect, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface UnreadCounts {
  general: number;
  committee: number;
  hosts: number;
  drivers: number;
  recipients: number;
  core_team: number;
  direct: number;
  groups: number;
  kudos: number;
  total: number;
}

interface MessageNotificationsProps {
  user: any; // User object passed from parent Dashboard
}

function MessageNotifications({ user }: MessageNotificationsProps) {
  const isAuthenticated = !!user;
  const [lastCheck, setLastCheck] = useState(Date.now());

  // Early return if user is not authenticated to prevent any queries
  if (!isAuthenticated || !user) {
    return null;
  }

  // Query for unread message counts - only when authenticated
  const { data: unreadCounts, refetch, error, isLoading } = useQuery<UnreadCounts>({
    queryKey: ['/api/message-notifications/unread-counts'],
    enabled: !!user && isAuthenticated,
    refetchInterval: isAuthenticated ? 120000 : false, // Check every 2 minutes only when authenticated (reduced from 30 seconds)
  });



  // Listen for custom refresh events from chat system
  useEffect(() => {
    if (!user) return;

    const handleRefreshNotifications = () => {
      console.log('Refreshing notification counts after chat read');
      refetch();
    };

    window.addEventListener('refreshNotifications', handleRefreshNotifications);
    
    return () => {
      window.removeEventListener('refreshNotifications', handleRefreshNotifications);
    };
  }, [user, refetch]);

  // Listen for WebSocket notifications
  useEffect(() => {
    if (!user) {
      return;
    }

    // Declare variables in outer scope for cleanup
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;

    try {
      // Fix WebSocket URL construction for different environments
      const getWebSocketUrl = () => {
        if (typeof window === 'undefined') return '';
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        // Handle different deployment scenarios
        if (host.includes('replit.dev') || host.includes('replit.com')) {
          return `${protocol}//${host}/notifications`;
        } else if (host.includes('localhost') || host.startsWith('127.0.0.1')) {
          // For localhost development, always use port 5000 explicitly
          return `${protocol}//localhost:5000/notifications`;
        } else {
          // Default case for other deployments - use current host
          return `${protocol}//${host}/notifications`;
        }
      };

      const wsUrl = getWebSocketUrl();
      console.log('Connecting to WebSocket at:', wsUrl);
      
      if (!wsUrl) {
        console.warn('Unable to construct WebSocket URL');
        return;
      }

      const connectWebSocket = () => {
        try {
          socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          console.log('WebSocket connected successfully');
          // Send identification message
          if (socket && user) {
            socket.send(JSON.stringify({
              type: 'identify',
              userId: user.id
            }));
          }
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket notification received:', data);
            
            // Refresh counts when notifications are received
            if (data.type === 'notification') {
              refetch();
              setLastCheck(Date.now());
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        socket.onclose = (event) => {
          console.log('WebSocket connection closed:', event.code, event.reason);
          socket = null;
          
          // Attempt to reconnect after a delay if not intentionally closed
          if (event.code !== 1000) {
            reconnectTimeoutId = setTimeout(connectWebSocket, 5000);
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Prevent unhandled promise rejections
          socket = null;
        };
        
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        // Retry after delay
        reconnectTimeoutId = setTimeout(connectWebSocket, 10000);
      }
      };

      // Initialize WebSocket connection
      connectWebSocket();

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }

    return () => {
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
      if (socket) {
        socket.close(1000, 'Component unmounting');
      }
    };
  }, [user, refetch]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show loading state or empty state instead of returning null
  if (isLoading) {
    return null; // Could show a loading spinner here
  }

  if (error) {
    return null; // Could show error state here
  }

  const finalUnreadCounts = unreadCounts || {
    general: 0, committee: 0, hosts: 0, drivers: 0, recipients: 0,
    core_team: 0, direct: 0, groups: 0, kudos: 0, total: 0
  };

  const totalUnread = finalUnreadCounts.total || 0;

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('POST', '/api/message-notifications/mark-all-read');
      refetch();
    } catch (error) {
      // Silently handle errors
    }
  };

  const getChatDisplayName = (committee: string) => {
    const names = {
      general: 'General Chat',
      committee: 'Committee Chat',
      hosts: 'Host Chat',
      drivers: 'Driver Chat',
      recipients: 'Recipient Chat',
      core_team: 'Core Team',
      direct: 'Direct Messages',
      groups: 'Group Messages',
      kudos: 'Kudos Received'
    };
    return names[committee as keyof typeof names] || committee;
  };

  const navigateToChat = (chatType: string) => {
    // Updated navigation - route all chat notifications to the current messaging system
    if (chatType === 'direct' || chatType === 'groups') {
      // Direct messages and groups go to messages inbox
      if ((window as any).dashboardSetActiveSection) {
        (window as any).dashboardSetActiveSection('gmail-inbox');
      } else {
        window.location.href = '/dashboard?section=gmail-inbox';
      }
    } else if (chatType === 'kudos') {
      // Kudos go to inbox where they can be viewed
      if ((window as any).dashboardSetActiveSection) {
        (window as any).dashboardSetActiveSection('gmail-inbox');
      } else {
        window.location.href = '/dashboard?section=gmail-inbox';
      }
    } else if (chatType === 'general') {
      // General chat goes to the Team Chat section (SocketChatHub)
      if ((window as any).dashboardSetActiveSection) {
        (window as any).dashboardSetActiveSection('chat');
      } else {
        window.location.href = '/dashboard?section=chat';
      }
    } else {
      // Other chat types (committee, hosts, drivers, recipients, core_team) go to their respective chat sections
      if ((window as any).dashboardSetActiveSection) {
        (window as any).dashboardSetActiveSection('chat');
      } else {
        window.location.href = '/dashboard?section=chat';
      }
    }
  };



  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative p-2 rounded-lg transition-colors hover:bg-teal-50">
          <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-xs font-medium bg-red-500 hover:bg-red-600"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 sm:w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="font-semibold text-sm">
          <div className="flex items-center justify-between">
            <span>Notifications</span>
            {totalUnread > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleMarkAllRead}
                className="text-xs h-6 px-2 hover:bg-gray-100"
              >
                Mark all read
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {totalUnread === 0 ? (
          <DropdownMenuItem className="text-muted-foreground text-sm py-4 text-center">
            All caught up! No new notifications.
          </DropdownMenuItem>
        ) : (
          <div className="space-y-1">
            {Object.entries(finalUnreadCounts)
              .filter(([key, count]) => key !== 'total' && count > 0)
              .map(([committee, count]) => (
                <DropdownMenuItem 
                  key={committee}
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-3 rounded-md"
                  onClick={() => navigateToChat(committee)}
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">{getChatDisplayName(committee)}</span>
                  </div>
                  <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                    {count}
                  </Badge>
                </DropdownMenuItem>
              ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Memoize the component to prevent unnecessary re-renders when props haven't changed
export default memo(MessageNotifications, (prevProps, nextProps) => {
  // Only re-render if the user ID changes, not the entire user object
  return prevProps.user?.id === nextProps.user?.id;
});