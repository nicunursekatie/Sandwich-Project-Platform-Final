import type { NavItem } from '@/nav.types';

/**
 * After permission filtering, apply User View preview — only show nav items
 * whose IDs are in the configured visible set. Parent items remain visible
 * when they have at least one visible child.
 */
export function filterNavItemsForUserView(
  items: NavItem[],
  visibleIds: Set<string>,
): NavItem[] {
  const visible = items.filter((item) => {
    if (visibleIds.has(item.id)) return true;
    if (item.isSubItem) return false;
    return items.some(
      (child) => child.parentId === item.id && visibleIds.has(child.id),
    );
  });

  // Hide parent items that lost all visible children
  return visible.filter((item) => {
    if (item.isSubItem) return true;
    const hasChildrenInConfig = items.some((navItem) => navItem.parentId === item.id);
    if (!hasChildrenInConfig) return true;
    return visible.some((navItem) => navItem.parentId === item.id);
  });
}
