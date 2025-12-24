export type EventRequestsQuickFilter = 'week' | 'today' | 'needsDriver' | null;

export type EventRequestsListFilterParams = {
  days?: number;
  status?: string;
  needsAction?: string;
};

function buildQueryString(filterParams: EventRequestsListFilterParams): string {
  const queryParams = new URLSearchParams();
  if (filterParams.days) queryParams.set('days', filterParams.days.toString());
  if (filterParams.status) queryParams.set('status', filterParams.status);
  if (filterParams.needsAction) queryParams.set('needsAction', filterParams.needsAction);
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
    return { days: 14, status: 'scheduled', needsAction: 'true' };
  }

  // Status-based tabs (no date restrictions)
  if (activeTab === 'new') return { status: 'new' };
  if (activeTab === 'in_process') return { status: 'in_process' };
  if (activeTab === 'scheduled') return { status: 'scheduled' };

  // Other status tabs (no date restrictions)
  if (['completed', 'declined', 'postponed'].includes(activeTab)) {
    return { status: activeTab };
  }

  // For "all", "my_assignments", admin_overview, planning, etc: fetch unfiltered list
  return {};
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


