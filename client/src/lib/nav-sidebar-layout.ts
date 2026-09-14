import type { NavItem } from '@/nav.types';
import { NAV_GROUP_LABELS, NAV_SECTION_ORDER } from '@shared/nav-catalog';

export { NAV_GROUP_LABELS, NAV_SECTION_ORDER };

/** Build non-empty section groups for sidebar rendering. */
export function buildNavSectionGroups(items: NavItem[]) {
  return NAV_SECTION_ORDER.map((group) => ({
    group,
    items: items.filter((item) => item.group === group && !item.topNav),
  })).filter(({ items: groupItems }) => groupItems.length > 0);
}
