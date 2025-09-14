import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@shared/auth-utils';
import { useMessaging } from '@/hooks/useMessaging';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { HelpBubble } from '@/components/help-system/HelpBubble';
import { NavItem } from '@/nav.types';

export default function SimpleNav({
  navigationItems,
  onSectionChange,
  activeSection,
  isCollapsed = false,
}: {
  navigationItems: NavItem[];
  onSectionChange: (section: string) => void;
  activeSection?: string;
  isCollapsed?: boolean;
}) {
  try {
    const { user } = useAuth();
    const [location] = useLocation();
    const { unreadCounts, totalUnread } = useMessaging();

    // Get Gmail inbox unread count
    const { data: gmailUnreadCount = 0 } = useQuery({
      queryKey: ['/api/emails/unread-count', (user as any)?.id || 'no-user'],
      queryFn: async () => {
        if (!(user as any)?.id) return 0;
        try {
          const response = await apiRequest('GET', '/api/emails/unread-count');
          return typeof response?.count === 'number' ? response.count : 0;
        } catch (error) {
          console.warn('Gmail unread count fetch failed:', error);
          return 0;
        }
      },
      enabled: !!(user as any)?.id,
      refetchInterval: 30000,
      retry: false,
    });

    // Get event reminders pending count
    const { data: remindersCount = 0 } = useQuery({
      queryKey: ['/api/event-reminders/count', (user as any)?.id || 'no-user'],
      queryFn: async () => {
        if (!(user as any)?.id) return 0;
        try {
          const response = await apiRequest('GET', '/api/event-reminders/count');
          return typeof response?.count === 'number' ? response.count : 0;
        } catch (error) {
          console.warn('Event reminders count fetch failed:', error);
          return 0;
        }
      },
      enabled: !!(user as any)?.id,
      refetchInterval: 60000,
      retry: false,
    });

    // Filter navigation items based on user permissions
    const filteredNavigationItems = navigationItems.filter(item => {
      if (!item.permission) {
        return true;
      }
      return hasPermission(user, item.permission);
    });

    const isActive = (href: string) => {
      if (activeSection) {
        if (href === 'dashboard')
          return activeSection === 'dashboard' || activeSection === '';
        return activeSection === href;
      }

      if (href === 'dashboard')
        return location === '/' || location === '/dashboard';
      return location === `/${href}`;
    };

    // Group items for visual separation
    const groupedItems = filteredNavigationItems.reduce((acc, item, index) => {
      const prevItem = filteredNavigationItems[index - 1];
      const showSeparator =
        prevItem && prevItem.group !== item.group && item.group;

      if (showSeparator) {
        acc.push({ type: 'separator', group: item.group });
      }
      acc.push({ type: 'item', ...item });
      return acc;
    }, [] as any[]);

    const getGroupLabel = (group: string) => {
      const labels = {
        dashboard: 'DASHBOARD',
        collections: 'COLLECTIONS',
        core: 'CORE TOOLS',
        communication: 'COMMUNICATION',
        operations: 'OPERATIONS',
        planning: 'PLANNING & COORDINATION',
        documentation: 'DOCUMENTATION',
        admin: 'ADMIN',
      };
      return labels[group as keyof typeof labels] || group.toUpperCase();
    };

    const getBadgeCount = (itemId: string) => {
      switch (itemId) {
        case 'gmail-inbox':
          return gmailUnreadCount;
        case 'chat':
          return totalUnread;
        case 'suggestions':
          return unreadCounts.suggestions || 0;
        case 'event-reminders':
          return remindersCount;
        default:
          return 0;
      }
    };

    return (
      <nav className="flex flex-col gap-1 p-2">
        {groupedItems.map((groupItem, index) => {
          if (groupItem.type === 'separator') {
            return (
              <div key={`separator-${groupItem.group}-${index}`} className="my-2">
                <div className="text-xs font-semibold text-muted-foreground px-2 mb-1">
                  {getGroupLabel(groupItem.group)}
                </div>
                <div className="border-t border-border" />
              </div>
            );
          }

          const item = groupItem;
          const badgeCount = getBadgeCount(item.id);
          const active = isActive(item.href);

          return (
            <div key={item.id} className="relative">
              <Button
                data-testid={`nav-${item.id}`}
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                className={`w-full justify-start gap-2 relative ${
                  active ? 'bg-secondary text-secondary-foreground' : ''
                }`}
                onClick={() => onSectionChange(item.href)}
              >
                {item.customIcon ? (
                  <img
                    src={item.customIcon}
                    alt={item.label}
                    className="h-4 w-4 object-contain"
                  />
                ) : item.icon ? (
                  <item.icon className="h-4 w-4" />
                ) : null}
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {badgeCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="ml-auto h-5 min-w-[20px] text-xs"
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
              {item.id === 'collections' && !isCollapsed && (
                <HelpBubble
                  className="absolute -top-1 -right-1"
                  content="Click here to log your sandwich collections and track daily sandwich counts"
                  title="Collections Log"
                />
              )}
            </div>
          );
        })}
      </nav>
    );
  } catch (error) {
    console.error('SimpleNav rendering error:', error);
    return (
      <nav className="flex flex-col gap-1 p-2">
        <div className="text-sm text-red-500">Navigation error</div>
      </nav>
    );
  }
}