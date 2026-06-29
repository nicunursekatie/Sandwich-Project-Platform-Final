import type { NavItem } from '@/nav.types';

/** Shown directly under Dashboard so external tools are easy to find. */
export const PROMOTED_SIDEBAR_NAV_ID = 'quick-tools';

/** Section display order (QUICK LINKS removed — items live in their logical group). */
export const NAV_SECTION_ORDER = [
  'events',
  'communication',
  'network',
  'resources',
  'data',
  'settings',
] as const;

export const NAV_GROUP_LABELS: Record<string, string> = {
  events: 'EVENTS & VOLUNTEERS',
  network: 'NETWORK',
  resources: 'RESOURCES & TOOLS',
  communication: 'COMMUNICATION',
  data: 'DATA & REPORTS',
  settings: 'SETTINGS',
};

/** Build non-empty section groups for sidebar rendering. */
export function buildNavSectionGroups(items: NavItem[]) {
  return NAV_SECTION_ORDER.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  })).filter(({ items: groupItems }) => groupItems.length > 0);
}
