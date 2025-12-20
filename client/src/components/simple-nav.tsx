import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@shared/unified-auth-utils';
import type { UserForPermissions } from '@shared/types';
import { useMessaging } from '@/hooks/useMessaging';
import { useStreamChatUnread } from '@/hooks/useStreamChatUnread';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { HelpBubble } from '@/components/help-system/HelpBubble';
import { NavItem } from '@/nav.types';
import sandwich_logo from '@assets/LOGOS/sandwich logo.png';
import { logger } from '@/lib/logger';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SmartSearch } from '@/components/SmartSearch';

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
    const [location, setLocation] = useLocation();
    const { unreadCounts, totalUnread } = useMessaging();
    const { totalUnread: streamChatUnread } = useStreamChatUnread();

    // State for collapsible sections
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    // State for expanded parent items (like TSP Network)
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set(['tsp-network', 'collections']));

    // Get Gmail inbox unread count
    const { data: gmailUnreadCount = 0 } = useQuery({
      queryKey: ['/api/emails/unread-count', (user as any)?.id || 'no-user'],
      queryFn: async () => {
        if (!(user as any)?.id) return 0;
        try {
          const response = await apiRequest('GET', '/api/emails/unread-count');
          return typeof response?.count === 'number' ? response.count : 0;
        } catch (error) {
          logger.warn('Gmail unread count fetch failed:', error);
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
          logger.warn('Event reminders count fetch failed:', error);
          return 0;
        }
      },
      enabled: !!(user as any)?.id,
      refetchInterval: 60000,
      retry: false,
    });

    // Filter navigation items based on user permissions and exclude topNav items
    const filteredNavigationItems = navigationItems.filter(item => {
      // Exclude items marked for top nav
      if (item.topNav) {
        return false;
      }
      if (!item.permission) {
        return true;
      }
      // Cast user to UserForPermissions to satisfy type requirements
      const userForPermissions: UserForPermissions | null | undefined = user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: (user.permissions as string[] | number | null | undefined) ?? null,
        isActive: user.isActive,
      } : null;
      return hasPermission(userForPermissions, item.permission);
    });

    // Toggle section collapse
    const toggleSection = (group: string) => {
      const newCollapsed = new Set(collapsedSections);
      if (newCollapsed.has(group)) {
        newCollapsed.delete(group);
      } else {
        newCollapsed.add(group);
      }
      setCollapsedSections(newCollapsed);
    };

    // Toggle parent item expansion
    const toggleParent = (parentId: string) => {
      const newExpanded = new Set(expandedParents);
      if (newExpanded.has(parentId)) {
        newExpanded.delete(parentId);
      } else {
        newExpanded.add(parentId);
      }
      setExpandedParents(newExpanded);
    };

    const isActive = (href: string) => {
      // Extract base section from href (remove query params)
      const baseHref = href.split('?')[0];
      
      if (activeSection) {
        if (baseHref === 'dashboard')
          return activeSection === 'dashboard' || activeSection === '';
        return activeSection === baseHref;
      }

      if (baseHref === 'dashboard')
        return location === '/' || location === '/dashboard';
      return location === `/${baseHref}`;
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
        'quick-links': 'QUICK LINKS',
        workspace: 'MY WORKSPACE',
        logistics: 'LOGISTICS',
        network: 'NETWORK',
        operations: 'OPERATIONS',
        admin: 'ADMIN & RESOURCES',
      };
      return labels[group as keyof typeof labels] || group.toUpperCase();
    };

    const getBadgeCount = (itemId: string) => {
      switch (itemId) {
        case 'gmail-inbox':
          return gmailUnreadCount;
        case 'chat':
          // Use Stream Chat unread count for team chat
          return streamChatUnread || 0;
        case 'suggestions':
          return unreadCounts.suggestions || 0;
        case 'event-reminders':
          return remindersCount;
        default:
          return 0;
      }
    };

    return (
      <nav className="flex flex-col gap-1.5 p-3" data-tour="navigation">
        {/* AI-Powered Smart Search */}
        {!isCollapsed && (
          <div className="mb-3 px-1">
            <SmartSearch />
          </div>
        )}

        {groupedItems.map((groupItem, index) => {
          if (groupItem.type === 'separator') {
            const isCollapsedSection = collapsedSections.has(groupItem.group);
            return !isCollapsed ? (
              <div key={`separator-${groupItem.group}-${index}`} className="mt-4 mb-3">
                <button
                  onClick={() => toggleSection(groupItem.group)}
                  className="w-full from-brand-primary-lighter to-brand-primary-light rounded-lg px-3 py-2 mb-2 shadow-sm bg-[#47b3cbbf] hover:bg-[#47b3cbd0] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="font-bold text-brand-primary tracking-wide text-[14px] bg-[#47b3cb78] flex-1 text-left">
                    {getGroupLabel(groupItem.group)}
                  </div>
                  {isCollapsedSection ? (
                    <ChevronRight className="w-4 h-4 text-brand-primary group-hover:scale-110 transition-transform" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-brand-primary group-hover:scale-110 transition-transform" />
                  )}
                </button>
                <div className="border-t-2 border-brand-primary-border mx-2" />
              </div>
            ) : null;
          }

          const item = groupItem;
          const badgeCount = getBadgeCount(item.id);
          const active = isActive(item.href);

          // Hide items in collapsed sections (unless item is dashboard)
          const isInCollapsedSection = item.group && collapsedSections.has(item.group) && item.group !== 'dashboard';
          if (isInCollapsedSection) {
            return null;
          }

          // Check if this item has children
          const hasChildren = filteredNavigationItems.some(navItem => navItem.parentId === item.id);
          const isExpanded = expandedParents.has(item.id);

          // Hide sub-items if their parent is not expanded
          if (item.isSubItem && item.parentId && !expandedParents.has(item.parentId)) {
            return null;
          }

          return (

            <Button
              key={item.id}
              variant={active ? 'default' : 'ghost'}
              className={`
              w-full ${
                isCollapsed
                  ? 'justify-center px-2'
                  : item.isSubItem
                    ? 'justify-start pl-8 pr-2 sm:pr-3'
                    : 'justify-start px-2 sm:px-3'
              } text-left h-11 touch-manipulation relative ${
                item.isSubItem ? 'text-sm font-normal' : 'text-base font-medium'
              }
              ${
                active
                  ? 'bg-gradient-to-r from-brand-primary to-brand-primary-dark hover:shadow-lg text-white shadow-md border-l-4 border-l-brand-orange rounded-lg transition-all duration-200'
                  : item.highlighted
                    ? 'hover:bg-gradient-to-br hover:from-[#FBAD3F]/10 hover:to-[#FBAD3F]/20 text-[#FBAD3F] font-semibold rounded-lg hover:shadow-sm transition-all duration-200'
                    : item.isSubItem
                      ? 'hover:bg-slate-50 text-slate-600 ml-4 mr-1 rounded-md hover:shadow-sm transition-all duration-200'
                      : 'hover:bg-gradient-to-br hover:from-slate-50 hover:to-slate-100 text-slate-700 rounded-lg hover:shadow-sm transition-all duration-200'
              }
            `}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                logger.log('Navigation click:', item.href);

                // If item has children, toggle expansion
                if (hasChildren) {
                  toggleParent(item.id);

                  // If item has navigateAndExpand flag, also navigate (don't return early)
                  if (!item.navigateAndExpand) {
                    return; // Stop here - don't navigate for regular parent items
                  }
                }

                // Handle navigation for items WITHOUT children, or items with navigateAndExpand
                // Handle hrefs with query parameters
                if (item.href.includes('?')) {
                  const [baseSection, queryString] = item.href.split('?');
                  logger.log('Navigation with query params:', { baseSection, queryString });

                  // Navigate using Wouter's setLocation to keep router in sync
                  // The Dashboard will pick up the section and tab from URL params
                  const newUrl = `/dashboard?section=${baseSection}&${queryString}`;
                  setLocation(newUrl);
                } else {
                  onSectionChange(item.href);
                }

                // Scroll to top of page after navigation
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title={isCollapsed ? item.label : undefined}
              data-nav-id={item.id}
              data-testid={`nav-${item.id}`}
            >
              {item.customIcon ? (
                <img
                  src={sandwich_logo}
                  alt={item.label}
                  className={`h-4 w-4 flex-shrink-0 ${
                    isCollapsed ? '' : 'mr-2 sm:mr-3'
                  } ${item.highlighted && !active ? 'opacity-90' : ''}`}
                />
              ) : (
                <item.icon
                  className={`h-4 w-4 flex-shrink-0 ${
                    isCollapsed ? '' : 'mr-2 sm:mr-3'
                  } ${item.highlighted && !active ? 'text-[#FBAD3F]' : ''}`}

                />
              )}
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {badgeCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-auto h-5 min-w-[20px] text-xs"
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Badge>
                  )}
                  {hasChildren && (
                    <div className="ml-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  )}
                </>
              )}
            </Button>
          );
        })}
      </nav>
    );
  } catch (error) {
    logger.error('SimpleNav rendering error:', error);
    return (
      <nav className="flex flex-col gap-1 p-2">
        <div className="text-sm text-red-500">Navigation error</div>
      </nav>
    );
  }
}