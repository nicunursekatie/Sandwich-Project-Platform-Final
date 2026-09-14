import { getNavigationTabEntries } from '@shared/nav-catalog';
import { NAV_ITEMS } from '@/nav.config';
import type { LucideIcon } from 'lucide-react';

export function getNavigationTabFeatures(): Array<{
  permission: string;
  label: string;
  icon: LucideIcon;
}> {
  const iconByPermission = new Map<string, LucideIcon>();
  for (const item of NAV_ITEMS) {
    if (item.icon && !iconByPermission.has(item.permissionKey)) {
      iconByPermission.set(item.permissionKey, item.icon);
    }
  }

  return getNavigationTabEntries().map((entry) => ({
    permission: entry.permissionKey,
    label: entry.label,
    icon: iconByPermission.get(entry.permissionKey) as LucideIcon,
  }));
}
