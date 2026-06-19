import { useMemo, type ReactNode } from 'react';
import type { EventRequest } from '@shared/schema';
import { BatchedCollaborationProvider } from '@/contexts/batched-collaboration-context';
import {
  BatchedReturningOrgProvider,
  type ReturningOrgBatchItem,
} from '@/contexts/batched-returning-org-context';

interface EventListBatchProvidersProps {
  events: Pick<
    EventRequest,
    | 'id'
    | 'organizationName'
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'department'
    | 'status'
  >[];
  children: ReactNode;
  /** When false, skips batch fetches (e.g. empty list). */
  enabled?: boolean;
}

function toReturningOrgItems(
  events: EventListBatchProvidersProps['events']
): ReturningOrgBatchItem[] {
  return events
    .filter((event) => !!event.organizationName?.trim())
    .map((event) => ({
      eventId: event.id,
      orgName: event.organizationName!.trim(),
      contactEmail: event.email ?? undefined,
      contactName: [event.firstName, event.lastName].filter(Boolean).join(' ') || undefined,
      contactPhone: event.phone ?? undefined,
      department: event.department ?? undefined,
    }));
}

/**
 * One batch fetch per visible tab list — collaboration (comments + locks) and
 * returning-org checks — instead of N parallel requests per card.
 */
export function EventListBatchProviders({
  events,
  children,
  enabled = true,
}: EventListBatchProvidersProps) {
  const eventIds = useMemo(() => events.map((event) => event.id), [events]);
  const returningOrgItems = useMemo(() => toReturningOrgItems(events), [events]);

  return (
    <BatchedCollaborationProvider eventIds={eventIds} enabled={enabled && eventIds.length > 0}>
      <BatchedReturningOrgProvider
        items={returningOrgItems}
        enabled={enabled && returningOrgItems.length > 0}
      >
        {children}
      </BatchedReturningOrgProvider>
    </BatchedCollaborationProvider>
  );
}
