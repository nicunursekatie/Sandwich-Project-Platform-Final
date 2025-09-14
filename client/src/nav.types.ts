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
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavItem[];
}