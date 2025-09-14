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
        operations: 'OPERATIONS',
        planning: 'PLANNING & COORDINATION',
        communication: 'COMMUNICATION',
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
                <div className="text-xs font-semibold text-muted-foreground px-2 mb-1 text-right">
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

            <Button
              key={item.id}
              variant={isCurrentlyActive ? 'default' : 'ghost'}
              className={`
              w-full ${
                isCollapsed
                  ? 'justify-center px-2'
                  : 'justify-start px-2 sm:px-3'
              } text-left h-11 touch-manipulation relative
              ${
                isCurrentlyActive
                  ? 'bg-brand-primary hover:bg-brand-primary-dark text-white shadow-sm border-l-4 border-l-brand-orange'
                  : 'hover:bg-slate-100 text-slate-700'
              }
            `}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Navigation click:', item.href);
                onSectionChange(item.href);
              }}
              title={isCollapsed ? item.label : undefined}
            >
              {item.customIcon ? (
                <img
                  src={sandwich_logo}
                  alt={item.label}
                  className={`h-4 w-4 flex-shrink-0 ${
                    isCollapsed ? '' : 'mr-2 sm:mr-3'
                  }`}
                />
              ) : (
                <item.icon
                  className={`h-4 w-4 flex-shrink-0 ${
                    isCollapsed ? '' : 'mr-2 sm:mr-3'
                  }`}

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