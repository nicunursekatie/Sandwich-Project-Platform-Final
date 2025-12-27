export type EventRequestsQuickFilter = 'week' | 'today' | 'needsDriver' | 'needsVan' | null;

export type EventRequestsListFilterParams = {
  days?: number;
  status?: string;
  needsAction?: string;
  needsDriver?: string;
  needsVan?: string;
};

function buildQueryString(filterParams: EventRequestsListFilterParams): string {
  const queryParams = new URLSearchParams();
  if (filterParams.days) queryParams.set('days', filterParams.days.toString());
  if (filterParams.status) queryParams.set('status', filterParams.status);
  if (filterParams.needsAction) queryParams.set('needsAction', filterParams.needsAction);
  if (filterParams.needsDriver) queryParams.set('needsDriver', filterParams.needsDriver);
  if (filterParams.needsVan) queryParams.set('needsVan', filterParams.needsVan);
  return queryParams.toString();
}

export function buildEventRequestsListFilterParams(
  activeTab: string,
  quickFilter: EventRequestsQuickFilter
): EventRequestsListFilterParams {
  // Handle quick filters first
  if (quickFilter === 'week') {
    const status =
      activeTab === 'scheduled'
        ? 'scheduled'
        : activeTab === 'in_process'
          ? 'in_process'
          : activeTab === 'new'
            ? 'new'
            : undefined;
    return status ? { days: 7, status } : { days: 7 };
  }

  if (quickFilter === 'today') {
    const status =
      activeTab === 'scheduled'
        ? 'scheduled'
        : activeTab === 'in_process'
          ? 'in_process'
          : activeTab === 'new'
            ? 'new'
            : undefined;
    return status ? { days: 1, status } : { days: 1 };
  }

  if (quickFilter === 'needsDriver') {
    // Show ALL scheduled events that need drivers (no date restriction)
    return { status: 'scheduled', needsDriver: 'true' };
  }

  if (quickFilter === 'needsVan') {
    // Show ALL scheduled events that need a van (no date restriction)
    return { status: 'scheduled', needsVan: 'true' };
  }

  // Status-based tabs (no date restrictions)
  if (activeTab === 'new') return { status: 'new' };
  if (activeTab === 'in_process') return { status: 'in_process' };
  if (activeTab === 'scheduled') return { status: 'scheduled' };

  // Other status tabs (no date restrictions) - lazy load these on demand
  if (['completed', 'declined', 'postponed'].includes(activeTab)) {
    return { status: activeTab };
  }

  // For "all", "my_assignments", admin_overview, planning, etc:
  // Only load active events (new, in_process, scheduled) by default.
  // Completed/declined/postponed events are lazy-loaded when those tabs are clicked.
  return { status: 'new,in_process,scheduled' };
}

export function buildEventRequestsListQuery(activeTab: string, quickFilter: EventRequestsQuickFilter) {
  const filterParams = buildEventRequestsListFilterParams(activeTab, quickFilter);
  const queryString = buildQueryString(filterParams);

  const listUrl = queryString ? `/api/event-requests/list?${queryString}` : '/api/event-requests/list';
  const fullUrl = queryString ? `/api/event-requests?${queryString}` : '/api/event-requests';

  // IMPORTANT: Keep this query key aligned with EventRequestContext's useQuery key.
  // Dashboard prefetch relies on this to warm the exact cache entry the context consumes.
  const queryKey = ['/api/event-requests/list', filterParams, quickFilter, 'v3'] as const;

  return { queryKey, listUrl, fullUrl, filterParams, queryString };
}


