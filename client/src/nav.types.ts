import { LucideIcon } from 'lucide-react';
import type { NavCatalogItem } from '@shared/nav-catalog';

export interface NavItem extends NavCatalogItem {
  icon?: LucideIcon;
  /** @deprecated Use permissionKey. Kept so existing callers keep compiling. */
  permission?: string;
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavItem[];
}
