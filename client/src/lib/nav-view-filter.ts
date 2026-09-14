import type { NavItem } from '@/nav.types';

/**
 * After permission filtering, apply User View preview — only show nav items
 * whose IDs are in the configured visible set.
 */
export function filterNavItemsForUserView(
  items: NavItem[],
  visibleIds: Set<string>,
): NavItem[] {
  return items.filter((item) => visibleIds.has(item.id));
}
