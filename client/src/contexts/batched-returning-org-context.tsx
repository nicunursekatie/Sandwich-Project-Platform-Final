import { createContext, useContext, useMemo } from 'react';
import {
  useBatchedReturningOrg,
  type ReturningOrgBatchItem,
  type BatchedReturningOrgResult,
  type ReturningOrganizationData,
  EMPTY_RETURNING_ORG,
} from '@/hooks/use-batched-returning-org';

interface BatchedReturningOrgContextValue {
  batchedData: BatchedReturningOrgResult | undefined;
  isLoading: boolean;
  getReturningOrgForEvent: (eventId: number) => ReturningOrganizationData | undefined;
}

const BatchedReturningOrgContext = createContext<BatchedReturningOrgContextValue | null>(null);

interface BatchedReturningOrgProviderProps {
  items: ReturningOrgBatchItem[];
  children: React.ReactNode;
  enabled?: boolean;
}

export function BatchedReturningOrgProvider({
  items,
  children,
  enabled = true,
}: BatchedReturningOrgProviderProps) {
  const { data, isLoading } = useBatchedReturningOrg(items, { enabled });

  const value = useMemo(
    () => ({
      batchedData: data,
      isLoading,
      getReturningOrgForEvent: (eventId: number) => data?.[eventId],
    }),
    [data, isLoading]
  );

  return (
    <BatchedReturningOrgContext.Provider value={value}>
      {children}
    </BatchedReturningOrgContext.Provider>
  );
}

export function useBatchedReturningOrgContext() {
  return useContext(BatchedReturningOrgContext);
}

export type { ReturningOrgBatchItem };

export function getReturningOrgFromBatch(
  batched: BatchedReturningOrgContextValue | null,
  eventId: number | undefined
): ReturningOrganizationData | undefined {
  if (!batched || !eventId) return undefined;
  return batched.getReturningOrgForEvent(eventId) ?? EMPTY_RETURNING_ORG;
}
