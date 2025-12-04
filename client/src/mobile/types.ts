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
  { id: 'events', label: 'Events', icon: 'Calendar', href: '/m/events' },
  { id: 'drivers', label: 'Drivers', icon: 'Truck', href: '/m/driver-planning' },
  { id: 'collections', label: 'Log', icon: 'ClipboardList', href: '/m/collections' },
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
    id: 'add-task',
    label: 'Add Task',
    description: 'Quick task to holding zone',
    icon: 'StickyNote',
    href: '/m/holding-zone/new',
    color: 'bg-amber-500',
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
    id: 'driver-planning',
    label: 'Driver Planning',
    description: 'Assign drivers to events',
    icon: 'Truck',
    href: '/m/driver-planning',
    color: 'bg-blue-500',
  },
];
