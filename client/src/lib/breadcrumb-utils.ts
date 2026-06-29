import { NAV_ITEMS } from '@/nav.config';
import { BreadcrumbSegment } from '@/components/page-breadcrumbs';

/**
 * Display labels for every nav group key currently in nav.config. Keep this
 * in sync — when a new group is introduced in nav.config.ts, add it here too.
 * If a group is missing from this map the breadcrumb will fall back to the
 * raw kebab-case key, which is what produced the old "Home → settings → …"
 * lowercase trails.
 */
const GROUP_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  events: 'Events & Volunteers',
  network: 'Network',
  resources: 'Resources & Tools',
  communication: 'Communication',
  data: 'Data & Reports',
  help: 'Help',
  settings: 'Settings',
};

/**
 * Generate breadcrumb segments for a given section ID
 *
 * Produces trails like:
 *   Home → Settings → User Management        (not "Home → settings → Settings → …")
 *   Home → Events & Volunteers → Ops Dashboard
 *
 * Rules:
 *   - Always start with the human group label (never the raw kebab-case key)
 *   - Skip the group segment when it would duplicate the parent item's label —
 *     e.g. for the "settings" group + a "Settings" parent item, we only want
 *     one "Settings" in the trail.
 *
 * @param sectionId - The active section ID (e.g., 'event-requests', 'analytics')
 * @param additionalSegments - Optional additional segments to append
 * @returns Array of breadcrumb segments
 */
export function generateBreadcrumbs(
  sectionId: string,
  additionalSegments: BreadcrumbSegment[] = []
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];

  // Find the nav item for this section
  const navItem = NAV_ITEMS.find((item) => item.id === sectionId);

  if (!navItem) {
    // If not found, return just the additional segments
    return additionalSegments;
  }

  // Resolve the parent (if any) up front so we can de-duplicate against
  // the group label below.
  const parentItem =
    navItem.isSubItem && navItem.parentId
      ? NAV_ITEMS.find((item) => item.id === navItem.parentId)
      : undefined;

  // Add group label if it exists and isn't 'dashboard'. Skip it when it
  // would duplicate the parent item (case-insensitive, trimmed).
  if (navItem.group && navItem.group !== 'dashboard') {
    const groupLabel = GROUP_LABELS[navItem.group] || titleCaseFromKey(navItem.group);
    const duplicatesParent =
      parentItem && parentItem.label.trim().toLowerCase() === groupLabel.trim().toLowerCase();
    if (!duplicatesParent) {
      segments.push({
        label: groupLabel,
        href: undefined, // Groups are not directly linkable
      });
    }
  }

  // If this is a sub-item, push the parent
  if (parentItem) {
    segments.push({
      label: parentItem.label,
      href: `/dashboard?section=${parentItem.href}`,
    });
  }

  // Add the current section (unless it's the dashboard itself)
  if (sectionId !== 'dashboard') {
    segments.push({
      label: navItem.label,
      href: navItem.isSubItem ? undefined : `/dashboard?section=${navItem.href}`,
    });
  }

  // Add any additional segments
  return [...segments, ...additionalSegments];
}

/**
 * Convert a kebab-case key into a presentable Title Case fallback. Used as a
 * last-resort label when a group key isn't in GROUP_LABELS so that an unmapped
 * key surfaces as "Some Group" rather than "some-group" or "some group".
 */
function titleCaseFromKey(key: string): string {
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generate breadcrumbs for a project detail page
 */
export function generateProjectBreadcrumbs(projectId: number, projectName?: string): BreadcrumbSegment[] {
  return [
    { label: 'Strategic Planning' },
    { label: 'Projects', href: '/dashboard?section=projects' },
    { label: projectName || `Project #${projectId}` },
  ];
}

/**
 * Generate breadcrumbs for standalone pages (not in dashboard)
 */
export function generateStandaloneBreadcrumbs(pageName: string, category?: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];

  if (category) {
    segments.push({ label: category });
  }

  segments.push({ label: pageName });

  return segments;
}
