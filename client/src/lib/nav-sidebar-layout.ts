import type { NavItem } from '@/nav.types';

/** Top-of-sidebar items (order matters). Shown directly under Dashboard. */
export const PROMOTED_SIDEBAR_NAV_IDS = ['collections', 'event-requests'] as const;

export function isPromotedSidebarNavItem(
  item: NavItem,
  promotedIds: ReadonlySet<string> = new Set(PROMOTED_SIDEBAR_NAV_IDS),
): boolean {
  return promotedIds.has(item.id) || (!!item.parentId && promotedIds.has(item.parentId));
}

/** Items rendered inside collapsible section groups (excludes dashboard + promoted block). */
export function filterItemsForSidebarSections(items: NavItem[]): NavItem[] {
  return items.filter(
    (item) => item.group !== 'dashboard' && !isPromotedSidebarNavItem(item),
  );
}

/** Top-of-sidebar items in display order (parent + sub-items per promoted parent). */
export function buildPromotedSidebarNavItems(
  items: NavItem[],
  promotedIds: readonly string[] = PROMOTED_SIDEBAR_NAV_IDS,
): NavItem[] {
  return promotedIds.flatMap((id) => {
    const parent = items.find((item) => item.id === id);
    if (!parent) return [];
    const children = items.filter((item) => item.parentId === id);
    return [parent, ...children];
  });
}

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
