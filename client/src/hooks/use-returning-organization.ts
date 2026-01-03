import { useQuery } from '@tanstack/react-query';

interface ReturningOrganizationData {
  isReturning: boolean;
  inCatalog: boolean;
  pastEventCount: number;
  collectionCount: number;
  mostRecentEvent?: {
    id: number;
    eventDate: string | null;
    status: string | null;
  };
  mostRecentCollection?: {
    id: number;
    dateCollected: string | null;
  };
  similarNames?: string[];
}

/**
 * Hook to check if an organization is a returning organization
 *
 * This helps the intake team identify organizations that have worked with TSP before,
 * so they can personalize their outreach instead of sending generic first-time emails.
 *
 * @param organizationName - The organization name to check
 * @param currentEventId - Optional event ID to exclude from the check (for current request)
 * @param enabled - Whether to enable the query (default: true)
 */
export function useReturningOrganization(
  organizationName: string | undefined | null,
  currentEventId?: number,
  enabled: boolean = true
) {
  return useQuery<ReturningOrganizationData>({
    queryKey: ['returning-organization', organizationName, currentEventId],
    queryFn: async () => {
      if (!organizationName) {
        return {
          isReturning: false,
          inCatalog: false,
          pastEventCount: 0,
          collectionCount: 0,
        };
      }

      const params = new URLSearchParams({
        orgName: organizationName,
        ...(currentEventId && { currentEventId: currentEventId.toString() }),
      });

      const response = await fetch(`/api/event-requests/check-returning-org?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check returning organization');
      }

      return response.json();
    },
    enabled: enabled && !!organizationName,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1,
  });
}
