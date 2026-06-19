import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  useBatchedReturningOrgContext,
  getReturningOrgFromBatch,
} from '@/contexts/batched-returning-org-context';
import {
  type ReturningOrganizationData,
  EMPTY_RETURNING_ORG,
} from '@/hooks/use-batched-returning-org';

export type { ReturningOrganizationData };

/**
 * Check if an organization is returning. When rendered inside EventListBatchProviders,
 * reads from the tab-level bulk fetch instead of firing one request per card.
 */
export function useReturningOrganization(
  organizationName: string | undefined | null,
  currentEventId?: number,
  contactEmail?: string | null,
  contactName?: string | null,
  contactPhone?: string | null,
  department?: string | null,
  enabled: boolean = true
): UseQueryResult<ReturningOrganizationData> {
  const batchedContext = useBatchedReturningOrgContext();
  const useBatch = !!batchedContext && enabled && !!organizationName && !!currentEventId;

  const individualQuery = useQuery<ReturningOrganizationData>({
    queryKey: [
      'returning-organization',
      organizationName,
      currentEventId,
      contactEmail,
      contactName,
      contactPhone,
      department,
    ],
    queryFn: async () => {
      if (!organizationName) return EMPTY_RETURNING_ORG;

      const params = new URLSearchParams({
        orgName: organizationName,
        ...(currentEventId && { currentEventId: currentEventId.toString() }),
        ...(contactEmail && { contactEmail }),
        ...(contactName && { contactName }),
        ...(contactPhone && { contactPhone }),
        ...(department && { department }),
      });

      const response = await fetch(`/api/event-requests/check-returning-org?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check returning organization');
      }

      return response.json();
    },
    enabled: enabled && !!organizationName && !useBatch,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (useBatch) {
    const batchedData =
      getReturningOrgFromBatch(batchedContext, currentEventId) ?? EMPTY_RETURNING_ORG;
    return {
      ...individualQuery,
      data: batchedData,
      isLoading: batchedContext!.isLoading,
      isFetching: batchedContext!.isLoading,
      isSuccess: !batchedContext!.isLoading,
      status: batchedContext!.isLoading ? 'pending' : 'success',
    } as UseQueryResult<ReturningOrganizationData>;
  }

  return individualQuery;
}
