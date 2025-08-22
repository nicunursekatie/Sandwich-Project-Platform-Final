import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sandwich, 
  LayoutDashboard, 
  ListTodo, 
  MessageCircle, 
  ClipboardList, 
  FolderOpen, 
  BarChart3, 
  Users, 
  Car, 
  Building2, 
  FileText, 
  Settings,
  Sheet,
  Lightbulb,
  Inbox,
  Hash,
  Scale,
  Calendar,
  MapPin,
  Route,
  Clock,
  Gift
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { useMessaging } from "@/hooks/useMessaging";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { HelpBubble } from "@/components/help-system/HelpBubble";
import sandwich_logo from "@assets/LOGOS/sandwich logo.png";

interface NavigationItem {
  id: string;
  label: string;
  icon?: any;
  customIcon?: string;
  href: string;
  permission?: string;
  group?: string;
}

export default function SimpleNav({ onSectionChange, activeSection, isCollapsed = false }: { onSectionChange: (section: string) => void; activeSection?: string; isCollapsed?: boolean }) {
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
        return response.count || 0;
      } catch (error) {
        console.error('Failed to fetch Gmail unread count:', error);
        return 0;
      }
    },
    enabled: !!(user as any)?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Navigation organized by sections: DASHBOARD (at top), COLLECTIONS LOG, COMMUNICATION, OPERATIONS, PLANNING & COORDINATION, DOCUMENTATION, ADMIN
  const navigationItems: NavigationItem[] = [
    // DASHBOARD (at the very top)
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "dashboard", group: "dashboard" },
    
    // COLLECTIONS LOG
    { id: "collections", label: "Collections Log", customIcon: sandwich_logo, href: "collections", group: "collections" },
    
    // COMMUNICATION
    { id: "chat", label: "Team Chat", icon: Hash, href: "chat", group: "communication" },
    { id: "gmail-inbox", label: "Inbox", icon: Inbox, href: "gmail-inbox", group: "communication" },
    ...(hasPermission(user, PERMISSIONS.VIEW_SUGGESTIONS) ? [{ id: "suggestions", label: "Suggestions", icon: Lightbulb, href: "suggestions", group: "communication" }] : []),
    
    // OPERATIONS (the weekly flow)
    ...(hasPermission(user, PERMISSIONS.VIEW_HOSTS) ? [{ id: "hosts", label: "Hosts", icon: Building2, href: "hosts", group: "operations" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_HOSTS) ? [{ id: "host-directory", label: "Host Directory", icon: MapPin, href: "host-directory", group: "operations" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_DRIVERS) ? [{ id: "drivers", label: "Drivers", icon: Car, href: "drivers", group: "operations" }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_VOLUNTEERS) ? [{ id: "volunteers", label: "Volunteers", icon: Users, href: "volunteers", group: "operations" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_RECIPIENTS) ? [{ id: "recipients", label: "Recipients", icon: Users, href: "recipients", group: "operations" }] : []),
    { id: "donation-tracking", label: "Donation Tracking", icon: Route, href: "donation-tracking", group: "operations" },
    ...(hasPermission(user, PERMISSIONS.ADMIN_ACCESS) ? [{ id: "weekly-monitoring", label: "Weekly Monitoring", icon: Clock, href: "weekly-monitoring", group: "operations" }] : []),
    
    // PLANNING & COORDINATION
    ...(hasPermission(user, PERMISSIONS.VIEW_PROJECTS) ? [{ id: "projects", label: "Projects", icon: ClipboardList, href: "projects", group: "planning" }] : []),
    { id: "events", label: "Events", icon: Calendar, href: "events", group: "planning" },
    { id: "signup-genius", label: "SignUp Genius", icon: Users, href: "signup-genius", group: "planning" },
    { id: "wishlist", label: "Amazon Wishlist", icon: Gift, href: "wishlist", group: "planning" },
    { id: "toolkit", label: "Toolkit", icon: FolderOpen, href: "toolkit", group: "planning" },
    
    // DOCUMENTATION
    ...(hasPermission(user, PERMISSIONS.ADMIN_ACCESS) ? [{ id: "admin", label: "Important Documents", icon: FileText, href: "admin", group: "documentation" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_GOVERNANCE) ? [{ id: "governance", label: "Governance", icon: Scale, href: "governance", group: "documentation" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_MEETINGS) ? [{ id: "meetings", label: "Meetings", icon: ClipboardList, href: "meetings", group: "documentation" }] : []),
    
    // ADMIN
    ...(hasPermission(user, PERMISSIONS.VIEW_ANALYTICS) ? [{ id: "analytics", label: "Analytics", icon: BarChart3, href: "analytics", group: "admin" }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_WORK_LOGS) ? [{ id: "work-log", label: "Work Log", icon: ListTodo, href: "work-log", group: "admin" }] : []),
    ...(hasPermission(user, PERMISSIONS.MANAGE_USERS) ? [{ id: "user-management", label: "User Management", icon: Settings, href: "user-management", group: "admin" }] : [])
  ];

  const isActive = (href: string) => {
    // If activeSection is provided, use it directly
    if (activeSection) {
      // For dashboard, check both "dashboard" and root
      if (href === "dashboard") return activeSection === "dashboard" || activeSection === "";
      return activeSection === href;
    }
    
    // Fallback to URL-based navigation for standalone usage
    if (href === "dashboard") return location === "/" || location === "/dashboard";
    return location === `/${href}`;
  };

  // Group items for visual separation
  const groupedItems = navigationItems.reduce((acc, item, index) => {
    const prevItem = navigationItems[index - 1];
    const showSeparator = prevItem && prevItem.group !== item.group && item.group;
    
    if (showSeparator) {
      acc.push({ type: 'separator', group: item.group });
    }
    acc.push({ type: 'item', ...item });
    return acc;
  }, [] as any[]);

  const getGroupLabel = (group: string) => {
    const labels = {
      operations: "OPERATIONS",
      planning: "PLANNING & COORDINATION", 
      communication: "COMMUNICATION",
      documentation: "DOCUMENTATION",
      admin: "ADMIN"
    };
    return labels[group as keyof typeof labels] || group;
  };

  return (
    <nav className={`space-y-1 ${isCollapsed ? 'p-2' : 'p-3 sm:p-4'} pb-6 sm:pb-8`}>
      {/* Navigation Help Header - Hidden when collapsed */}
      {!isCollapsed && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Navigation</div>
          <HelpBubble
            content={{
              id: 'navigation-help',
              title: 'Finding Your Way Around',
              message: "Think of this sidebar as your map to everything TSP! Each section is designed to help you contribute in your own unique way. Take your time exploring - there's no rush.",
              tone: 'informative',
              character: 'guide',
              position: 'right'
            }}
            trigger="click"
          />
        </div>
      )}
      {groupedItems.map((item, index) => {
        if (item.type === 'separator') {
          // Hide separators when collapsed
          if (isCollapsed) return null;
          return (
            <div key={`sep-${index}`} className="pt-3 sm:pt-4 pb-2">
              <div className="flex items-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                <div className="h-px bg-slate-200 flex-1 mr-2 sm:mr-3" />
                <span className="text-[10px] sm:text-xs">{getGroupLabel(item.group)}</span>
              </div>
            </div>
          );
        }

        const isCurrentlyActive = isActive(item.href);
        
        // Get unread count for specific items
        let unreadCount = 0;
        if (item.id === 'gmail-inbox') {
          unreadCount = gmailUnreadCount; // Gmail inbox unread count
        } else if (item.id === 'messages') {
          unreadCount = totalUnread; // Direct/Group messages
        } else if (item.id === 'chat') {
          unreadCount = unreadCounts.general; // Chat rooms
        } else if (item.id === 'committee-chat') {
          unreadCount = unreadCounts.committee;
        } else if (item.id === 'suggestions' && unreadCounts.suggestion) {
          unreadCount = unreadCounts.suggestion;
        }
        
        return (
          <Button
            key={item.id}
            variant={isCurrentlyActive ? "default" : "ghost"}
            className={`
              w-full ${isCollapsed ? 'justify-center px-2' : 'justify-start px-2 sm:px-3'} text-left h-10 sm:h-11 touch-manipulation relative
              ${isCurrentlyActive 
                ? "bg-[#236383] hover:bg-[#1d5470] text-white shadow-sm border-l-4 border-l-[#FBAD3F]" 
                : "hover:bg-slate-100 text-slate-700"
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
                className={`h-4 w-4 flex-shrink-0 ${isCollapsed ? '' : 'mr-2 sm:mr-3'}`}
              />
            ) : (
              <item.icon className={`h-4 w-4 flex-shrink-0 ${isCollapsed ? '' : 'mr-2 sm:mr-3'}`} />
            )}
            {!isCollapsed && (
              <span className="truncate flex-1 text-xs sm:text-sm">{item.label}</span>
            )}
            {unreadCount > 0 && (
              <Badge 
                variant={isCurrentlyActive ? "secondary" : "destructive"} 
                className={`${isCollapsed ? 'absolute -top-1 -right-1 h-4 w-4 p-0 text-xs' : 'ml-auto h-4 sm:h-5 px-1 sm:px-1.5 min-w-[16px] sm:min-w-[20px] text-xs'} flex items-center justify-center`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        );
      })}
    </nav>
  );
  } catch (error) {
    console.error('SimpleNav error:', error);
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-500">Navigation temporarily unavailable</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
        >
          Refresh Page
        </button>
      </div>
    );
  }
}