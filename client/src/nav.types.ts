import { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  customIcon?: string;
  href: string;
  permission?: string;
  group?: string;
  requiredRoles?: string[];
  featureFlag?: string;
  parentId?: string; // ID of parent nav item for nested structure
  isSubItem?: boolean; // Flag to indicate this is a sub-item
  highlighted?: boolean; // Flag to highlight important menu items with special color
  topNav?: boolean; // Flag to indicate this item should appear in top nav instead of sidebar
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavItem[];
}