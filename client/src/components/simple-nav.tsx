import React, { useState, useEffect } from 'react';
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
import tsp_wordmark from '@assets/LOGOS/TSP_transparent.png';
import { logger } from '@/lib/logger';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { SmartSearch } from '@/components/SmartSearch';
import { OnboardingTooltip } from '@/components/ui/onboarding-tooltip';
import { useOnboarding, OnboardingStep } from '@/hooks/useOnboarding';

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
    const { totalUnread: streamChatUnread, dmsUnread, groupsUnread, roomsUnread } = useStreamChatUnread();

    // ── Persisted sidebar state ────────────────────────────────────────
    // Both collapsedSections and expandedParents are persisted to
    // localStorage so the sidebar's shape stays consistent across reloads
    // and tabs. Previously these reset to defaults on every page load, which
    // made the sidebar feel like it was "context-switching" because
    // different parent items would be expanded depending on when the page
    // was loaded.
    //
    // Versioned keys (`v1` suffix): bump if the default sets change so an
    // old persisted state doesn't trap a user in a stale shape.
    const COLLAPSED_SECTIONS_KEY = 'sidebar.collapsedSections.v1';
    const EXPANDED_PARENTS_KEY = 'sidebar.expandedParents.v1';

    const loadPersistedSet = (key: string, fallback: string[]): Set<string> => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return new Set(fallback);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set(fallback);
        return new Set(parsed.filter((v): v is string => typeof v === 'string'));
      } catch {
        return new Set(fallback);
      }
    };

    const persistSet = (key: string, value: Set<string>) => {
      try {
        localStorage.setItem(key, JSON.stringify(Array.from(value)));
      } catch {
        // localStorage may be disabled / over quota — fail silently so the
        // sidebar still works in-session.
      }
    };

    // State for collapsible sections — default to all-expanded (empty Set).
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
      () => loadPersistedSet(COLLAPSED_SECTIONS_KEY, [])
    );

    // State for expanded parent items (like TSP Network). Default opens the
    // most commonly accessed parents so first-time visitors see useful
    // content. Returning users get whatever state they left it in.
    const [expandedParents, setExpandedParents] = useState<Set<string>>(
      () => loadPersistedSet(EXPANDED_PARENTS_KEY, ['tsp-network', 'collections', 'calendars', 'chat', 'event-requests'])
    );

    // Persist on change.
    useEffect(() => {
      persistSet(COLLAPSED_SECTIONS_KEY, collapsedSections);
    }, [collapsedSections]);
    useEffect(() => {
      persistSet(EXPANDED_PARENTS_KEY, expandedParents);
    }, [expandedParents]);

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
      refetchInterval: 2 * 60 * 1000, // 2 minutes (reduced from 30 seconds for cost optimization)
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
    const permissionFilteredItems = navigationItems.filter(item => {
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

    // Second pass: hide parent items that have no visible children
    const filteredNavigationItems = permissionFilteredItems.filter(item => {
      // If this item is a sub-item, keep it
      if (item.isSubItem) {
        return true;
      }
      // Check if this item is a parent (has children in the original nav items)
      const hasChildrenInConfig = navigationItems.some(navItem => navItem.parentId === item.id);
      if (!hasChildrenInConfig) {
        // Not a parent, keep it
        return true;
      }
      // This is a parent - check if it has any visible children
      const hasVisibleChildren = permissionFilteredItems.some(navItem => navItem.parentId === item.id);
      return hasVisibleChildren;
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

    const isActive = (href: string | undefined) => {
      // Guard against undefined href
      if (!href) return false;
      // Base section (everything before the query string) and the query portion.
      // Sub-items that target a specific tab carry a query string in their href
      // (e.g. "event-requests?tab=admin_overview"). Previously we stripped query
      // params and only compared bases — which made the parent ("event-requests")
      // and any same-page sub-item both light up when on the parent page. Now we
      // compare the full href whenever a query is present so a sub-item only
      // activates when the URL actually carries the matching tab.
      const [baseHref, hrefQuery] = (() => {
        const idx = href.indexOf('?');
        if (idx === -1) return [href, ''];
        return [href.slice(0, idx), href.slice(idx + 1)];
      })();
      const hrefHasQuery = hrefQuery.length > 0;

      if (activeSection) {
        if (baseHref === 'dashboard')
          return activeSection === 'dashboard' || activeSection === '';
        // When the sub-item targets a specific tab, require an exact match
        // against the full activeSection (which carries the query when set).
        if (hrefHasQuery) return activeSection === href;
        // For tab-less items, only match when activeSection has no tab either —
        // otherwise the parent would steal the highlight from its own sub-items.
        return activeSection === baseHref;
      }

      if (baseHref === 'dashboard')
        return location === '/' || location === '/dashboard';
      // URL-fallback path: read the actual query string off window.location so
      // tab-specific sub-items only match when the URL has the same tab param.
      if (hrefHasQuery) {
        if (typeof window === 'undefined') return false;
        const currentSearch = window.location.search.startsWith('?')
          ? window.location.search.slice(1)
          : window.location.search;
        return location === `/${baseHref}` && currentSearch === hrefQuery;
      }
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
        events: 'EVENTS & VOLUNTEERS',
        network: 'NETWORK',
        resources: 'RESOURCES & TOOLS',
        communication: 'COMMUNICATION',
        data: 'DATA & REPORTS',
        settings: 'SETTINGS',
      };
      return labels[group as keyof typeof labels] || group.toUpperCase();
    };

    const getGroupColors = (group: string) => {
      const colorMap: Record<string, { bg: string; hover: string; border: string; gradient: string }> = {
        'quick-links': {
          bg: 'bg-brand-primary',
          hover: 'hover:bg-brand-primary-dark',
          border: 'border-l-brand-orange',
          gradient: 'from-brand-primary to-brand-primary-dark'
        },
        'events': {
          bg: 'bg-[#007E8C]',
          hover: 'hover:bg-[#006270]',
          border: 'border-l-[#47B3CB]',
          gradient: 'from-[#007E8C] to-[#006270]'
        },
        'network': {
          bg: 'bg-[#47B3CB]',
          hover: 'hover:bg-[#3A9AB5]',
          border: 'border-l-[#007E8C]',
          gradient: 'from-[#47B3CB] to-[#3A9AB5]'
        },
        'communication': {
          bg: 'bg-brand-primary',
          hover: 'hover:bg-brand-primary-dark',
          border: 'border-l-brand-orange',
          gradient: 'from-brand-primary to-brand-primary-dark'
        },
        'resources': {
          bg: 'bg-[#007E8C]',
          hover: 'hover:bg-[#006270]',
          border: 'border-l-[#47B3CB]',
          gradient: 'from-[#007E8C] to-[#006270]'
        },
        'data': {
          bg: 'bg-[#47B3CB]',
          hover: 'hover:bg-[#3A9AB5]',
          border: 'border-l-brand-orange',
          gradient: 'from-[#47B3CB] to-[#3A9AB5]'
        },
        'settings': {
          bg: 'bg-slate-600',
          hover: 'hover:bg-slate-700',
          border: 'border-l-slate-400',
          gradient: 'from-slate-600 to-slate-700'
        }
      };
      return colorMap[group] || colorMap['quick-links'];
    };

    const getBadgeCount = (itemId: string) => {
      switch (itemId) {
        case 'gmail-inbox':
          return gmailUnreadCount;
        case 'inbox-consolidated':
          // Project Threads uses the email system, so use gmail unread count
          return gmailUnreadCount;
        case 'chat':
          // Show only room unread count on the parent item (DMs/groups have their own badges)
          return roomsUnread || 0;
        case 'chat-dms':
          return dmsUnread || 0;
        case 'chat-groups':
          return groupsUnread || 0;
        case 'suggestions':
          return unreadCounts.suggestions || 0;
        case 'kudos':
          return unreadCounts.kudos || 0;
        case 'event-reminders':
          return remindersCount;
        default:
          return 0;
      }
    };

    // Map nav item IDs to onboarding steps
    const getOnboardingStep = (itemId: string): OnboardingStep | null => {
      switch (itemId) {
        case 'gmail-inbox':
          return 'gmail-badge';
        case 'chat':
          return 'team-chat-badge';
        case 'suggestions':
          return 'suggestions-badge';
        case 'event-reminders':
          return 'event-reminders-badge';
        case 'inbox-consolidated':
          return 'project-threads-intro';
        case 'holding-zone':
          return 'holding-zone-intro';
        default:
          return null;
      }
    };

    // Track if we've shown the first badge intro
    const { shouldShowStep, completeStep } = useOnboarding();
    const [hasShownFirstBadge, setHasShownFirstBadge] = useState(false);

    // Find the first item with a badge to show the intro tooltip
    const firstItemWithBadge = filteredNavigationItems.find(item => getBadgeCount(item.id) > 0);
    const showNavBadgeIntro = firstItemWithBadge && shouldShowStep('nav-badge-intro') && !hasShownFirstBadge;

    return (
      <nav className="flex flex-col gap-1.5 p-3" data-tour="navigation">
        {/* Brand block — top-left anchor.
            The logo previously lived as a large centered card on the dashboard,
            consuming above-the-fold space that should belong to actionable
            content. Moving it to the sidebar follows the standard SaaS
            convention (Slack, Linear, Notion, etc.) and lets the dashboard
            promote the Universal Search / Collection CTA into the top slot.
            Clicking the block routes to the dashboard so it doubles as a
            "home" anchor. Hidden in the icon-only collapsed state — the
            existing sidebar header outside this component handles brand in
            that mode. */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={() => {
              onSectionChange('dashboard');
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/dashboard');
              }
            }}
            className="flex items-center gap-2.5 px-2 py-2 mb-3 rounded-lg hover:bg-slate-100 transition-colors group"
            aria-label="The Sandwich Project — go to dashboard"
            data-testid="sidebar-brand"
          >
            <img
              src={tsp_wordmark}
              alt=""
              className="h-9 w-auto flex-shrink-0"
              width="36"
              height="36"
            />
            <div className="flex flex-col items-start min-w-0 leading-tight">
              <span className="text-[15px] font-bold text-brand-primary truncate">
                The Sandwich Project
              </span>
              <span className="text-[11px] text-slate-500 truncate italic">
                Nourish The Hungry. Feed The Soul.
              </span>
            </div>
          </button>
        )}

        {/* AI-Powered Smart Search */}
        {!isCollapsed && (
          <div className="mb-3 px-1">
            <SmartSearch />
          </div>
        )}

        {groupedItems.map((groupItem, index) => {
          if (groupItem.type === 'separator') {
            const isCollapsedSection = collapsedSections.has(groupItem.group);
            const groupColors = getGroupColors(groupItem.group);
            return !isCollapsed ? (
              <div key={`separator-${groupItem.group}-${index}`} className="mt-4 mb-3">
                <button
                  onClick={() => toggleSection(groupItem.group)}
                  className={`w-full rounded-lg px-3 py-2.5 mb-2 shadow-sm ${groupColors.bg} ${groupColors.hover} transition-colors cursor-pointer flex items-center justify-between group`}
                >
                  <div className="font-bold text-white tracking-wide text-[15px] flex-1 text-left">
                    {getGroupLabel(groupItem.group)}
                  </div>
                  {isCollapsedSection ? (
                    <ChevronRight className="w-4 h-4 text-white/80 group-hover:scale-110 transition-transform" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/80 group-hover:scale-110 transition-transform" />
                  )}
                </button>
                <div className={`border-t ${groupColors.bg} opacity-30 mx-2`} />
              </div>
            ) : null;
          }

          const item = groupItem;
          const badgeCount = getBadgeCount(item.id);

          // Debug: log if we encounter an item without href
          if (!item.href) {
            logger.warn('Navigation item missing href:', { id: item.id, label: item.label, type: item.type });
          }

          const active = isActive(item.href);
          const itemColors = getGroupColors(item.group || 'quick-links');

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
                  ? `bg-gradient-to-r ${itemColors.gradient} hover:shadow-lg text-white shadow-md border-l-4 ${itemColors.border} rounded-lg transition-all duration-200`
                  : item.highlighted
                    ? 'hover:bg-[#006e7e]/10 text-[#006e7e] font-semibold rounded-lg hover:shadow-sm transition-all duration-200'
                    : item.accentColor
                      ? 'hover:bg-gradient-to-br hover:from-[#007E8C]/5 hover:to-[#007E8C]/10 rounded-lg hover:shadow-sm transition-all duration-200 font-semibold'
                      : item.isSubItem
                        ? 'hover:bg-slate-50 text-slate-600 ml-4 mr-1 rounded-md hover:shadow-sm transition-all duration-200'
                        : 'hover:bg-gradient-to-br hover:from-slate-50 hover:to-slate-100 text-slate-700 rounded-lg hover:shadow-sm transition-all duration-200'
              }
            `}
              style={!active && item.accentColor ? { color: item.accentColor } : undefined}
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
                // Guard against missing href
                if (!item.href) {
                  logger.warn('Attempted to navigate to item without href:', item.id);
                  return;
                }

                // Handle externalUrl - open in new tab
                if (item.externalUrl) {
                  logger.log('Opening external URL in new tab:', item.externalUrl);
                  window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
                  return;
                }

                // Handle external items - navigate directly to the URL (for pages outside dashboard)
                if (item.external) {
                  logger.log('External navigation:', item.href);
                  setLocation(item.href);
                  return;
                }

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
                  } ${item.highlighted && !active ? 'text-[#47B3CB]' : ''}`}

                />
              )}
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.externalUrl && (
                    <ExternalLink className={`h-3 w-3 flex-shrink-0 ml-1 ${active ? 'text-white/70' : 'text-slate-400'}`} />
                  )}
                  {/* One-time discovery tooltip for Toolkit & Apps */}
                  {item.id === 'quick-tools' && shouldShowStep('toolkit-apps-intro') && (
                    <OnboardingTooltip
                      step="toolkit-apps-intro"
                      position="right"
                      showWhen={true}
                      delay={2000}
                      completeOnChildClick={true}
                    >
                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#47B3CB] text-white text-[9px] font-bold animate-bounce">
                        !
                      </span>
                    </OnboardingTooltip>
                  )}
                  {badgeCount > 0 && (
                    <>
                      {/* Show intro tooltip on first badge user sees */}
                      {showNavBadgeIntro && item.id === firstItemWithBadge?.id ? (
                        <OnboardingTooltip
                          step="nav-badge-intro"
                          position="right"
                          showWhen={true}
                          delay={1500}
                          onComplete={() => {
                            setHasShownFirstBadge(true);
                          }}
                        >
                          <Badge
                            variant="destructive"
                            className="ml-auto h-5 min-w-[20px] text-xs animate-pulse"
                          >
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </Badge>
                        </OnboardingTooltip>
                      ) : (
                        /* After intro is done, show feature-specific tooltips */
                        (() => {
                          const featureStep = getOnboardingStep(item.id);
                          const showFeatureTooltip = featureStep &&
                            !shouldShowStep('nav-badge-intro') &&
                            shouldShowStep(featureStep);

                          if (showFeatureTooltip && featureStep) {
                            return (
                              <OnboardingTooltip
                                step={featureStep}
                                position="right"
                                showWhen={true}
                                delay={2000}
                              >
                                <Badge
                                  variant="destructive"
                                  className="ml-auto h-5 min-w-[20px] text-xs animate-pulse"
                                >
                                  {badgeCount > 99 ? '99+' : badgeCount}
                                </Badge>
                              </OnboardingTooltip>
                            );
                          }

                          return (
                            <Badge
                              variant="destructive"
                              className="ml-auto h-5 min-w-[20px] text-xs"
                            >
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </Badge>
                          );
                        })()
                      )}
                    </>
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