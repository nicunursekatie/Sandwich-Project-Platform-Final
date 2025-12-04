// Mobile app types and configuration

export interface MobileNavItem {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  href: string;
  badge?: number;
}

export interface MobileRoute {
  path: string;
  component: React.ComponentType;
  title: string;
  showBack?: boolean;
  showNav?: boolean;
}

// Bottom navigation items - keep to 4-5 max for thumb reach
export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: 'home', label: 'Home', icon: 'Home', href: '/m' },
  { id: 'collections', label: 'Log', icon: 'ClipboardList', href: '/m/collections' },
  { id: 'chat', label: 'Chat', icon: 'MessageCircle', href: '/m/chat' },
  { id: 'events', label: 'Events', icon: 'Calendar', href: '/m/events' },
  { id: 'more', label: 'More', icon: 'Menu', href: '/m/more' },
];

// Quick actions for the home screen
export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  href: string;
  color: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'log-collection',
    label: 'Log Collection',
    description: 'Record a sandwich pickup',
    icon: 'Plus',
    href: '/m/collections/new',
    color: 'bg-green-500',
  },
  {
    id: 'my-route',
    label: 'My Route',
    description: 'View today\'s deliveries',
    icon: 'Route',
    href: '/m/route',
    color: 'bg-blue-500',
  },
  {
    id: 'send-message',
    label: 'Send Message',
    description: 'Quick team message',
    icon: 'Send',
    href: '/m/chat/new',
    color: 'bg-purple-500',
  },
  {
    id: 'check-events',
    label: 'Today\'s Events',
    description: 'See scheduled events',
    icon: 'CalendarCheck',
    href: '/m/events/today',
    color: 'bg-orange-500',
  },
];
