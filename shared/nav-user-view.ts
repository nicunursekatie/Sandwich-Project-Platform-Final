/** app_settings key — JSON array of nav item IDs visible in admin "User View" preview */
export const NAV_USER_VIEW_SETTING_KEY = 'nav_user_view_visible_ids';

/**
 * Nav items hidden by default in User View preview (admin-only / power-user tools).
 * Admins can still enable them manually in Admin Panel → Nav User View.
 */
export const NAV_USER_VIEW_DEFAULT_HIDDEN_IDS = [
  'admin',
  'user-management',
  'historical-import',
  'organizations-merge',
  'settings',
  'admin-overview',
  'event-planning',
  'sandwich-destinations',
  'smart-search-admin',
  'generate-service-hours',
  'document-management',
  'analytics',
  'grant-metrics',
  'weekly-monitoring',
  'event-impact-reports',
  'cooler-tracking',
  'weekly-collections-report',
  'group-collections',
  'team-availability',
  'google-calendar-availability',
  'groups-insights',
  'event-contacts-directory',
  'signup-genius',
  'inventory-calculator',
  'quick-sms-links',
  'expenses',
  'promotion',
  'tools',
  'documents',
  'inbox-consolidated',
] as const;

export function getDefaultNavUserViewVisibleIds(allNavIds: string[]): string[] {
  const hidden = new Set<string>(NAV_USER_VIEW_DEFAULT_HIDDEN_IDS);
  return allNavIds.filter((id) => !hidden.has(id));
}

export function parseNavUserViewVisibleIds(
  raw: string | null | undefined,
  allNavIds?: string[],
): string[] {
  const fallback = allNavIds ? getDefaultNavUserViewVisibleIds(allNavIds) : [];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const ids = parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (!allNavIds) return ids;
    const valid = new Set(allNavIds);
    return ids.filter((id) => valid.has(id));
  } catch {
    return fallback;
  }
}
