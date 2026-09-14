import { NAV_ITEMS } from '@/nav.config';
import { BreadcrumbSegment } from '@/components/page-breadcrumbs';
import { NAV_GROUP_LABELS, getDashboardSectionUrl } from '@shared/nav-catalog';

/**
 * Generate breadcrumb segments for a given section ID
 *
 * Produces trails like:
 *   Home → Admin → User Management
 *   Home → Events → Event Ops
 */
export function generateBreadcrumbs(
  sectionId: string,
  additionalSegments: BreadcrumbSegment[] = []
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];

  const navItem = NAV_ITEMS.find((item) => item.id === sectionId || item.href === sectionId || item.href.split('?')[0] === sectionId);

  if (!navItem) {
    return additionalSegments;
  }

  if (navItem.group && navItem.group !== 'home') {
    const groupLabel = NAV_GROUP_LABELS[navItem.group] || titleCaseFromKey(navItem.group);
    const duplicatesItem =
      navItem.label.trim().toLowerCase() === groupLabel.trim().toLowerCase();
    if (!duplicatesItem) {
      segments.push({
        label: groupLabel,
        href: undefined,
      });
    }
  }

  if (sectionId !== 'dashboard') {
    segments.push({
      label: navItem.label,
      href: getDashboardSectionUrl(navItem.href),
    });
  }

  return [...segments, ...additionalSegments];
}

function titleCaseFromKey(key: string): string {
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function generateProjectBreadcrumbs(projectId: number, projectName?: string): BreadcrumbSegment[] {
  return [
    { label: 'Operations' },
    { label: 'Projects', href: '/dashboard?section=projects' },
    { label: projectName || `Project #${projectId}` },
  ];
}

export function generateStandaloneBreadcrumbs(pageName: string, category?: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];

  if (category) {
    segments.push({ label: category });
  }

  segments.push({ label: pageName });

  return segments;
}
