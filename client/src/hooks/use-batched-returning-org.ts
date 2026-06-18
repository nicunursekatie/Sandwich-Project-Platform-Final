import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ReturningOrganizationData {
  isReturning: boolean;
  isReturningContact: boolean;
  inCatalog: boolean;
  pastEventCount: number;
  collectionCount: number;
  pastDepartments: string[];
  mostRecentEvent?: {
    id: number;
    eventDate: string | null;
    status: string | null;
  };
  mostRecentCollection?: {
    id: number;
    dateCollected: string | null;
  };
  pastContactName?: string;
  contactPastOrgs?: string[];
  orgSimilarityScore?: number;
}

export interface ReturningOrgBatchItem {
  eventId: number;
  orgName: string;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  department?: string | null;
}

export type BatchedReturningOrgResult = Record<number, ReturningOrganizationData>;

const EMPTY_RETURNING_ORG: ReturningOrganizationData = {
  isReturning: false,
  isReturningContact: false,
  inCatalog: false,
  pastEventCount: 0,
  collectionCount: 0,
  pastDepartments: [],
};

export function useBatchedReturningOrg(
  items: ReturningOrgBatchItem[],
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled !== false && items.length > 0;
  const sortedKey = [...items]
    .sort((a, b) => a.eventId - b.eventId)
    .map(
      (item) =>
        `${item.eventId}:${item.orgName}:${item.contactEmail ?? ''}:${item.contactName ?? ''}:${item.contactPhone ?? ''}:${item.department ?? ''}`
    )
    .join('|');

  const { data, isLoading, error, refetch } = useQuery<{ data: BatchedReturningOrgResult }>({
    queryKey: ['/api/event-requests/check-returning-org/bulk', sortedKey],
    queryFn: async () => {
      if (items.length === 0) return { data: {} };
      return apiRequest('POST', '/api/event-requests/check-returning-org/bulk', { items });
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: data?.data,
    isLoading,
    error: error as Error | null,
    refetch,
    emptyResult: EMPTY_RETURNING_ORG,
  };
}

export { EMPTY_RETURNING_ORG };
