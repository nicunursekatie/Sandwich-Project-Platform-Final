import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RefreshCw } from 'lucide-react';
import { useReturningOrganization } from '@/hooks/use-returning-organization';

interface ReturningOrgBadgeProps {
  organizationName: string | null | undefined;
  eventId: number;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  department?: string | null;
}

/**
 * Self-contained returning organization badge.
 * Calls the useReturningOrganization hook internally and renders the badge + tooltip
 * if the organization is a returning org. Renders nothing otherwise.
 *
 * Drop this into any card component to show the returning org indicator.
 */
export function ReturningOrgBadge({
  organizationName,
  eventId,
  email,
  firstName,
  lastName,
  phone,
  department,
}: ReturningOrgBadgeProps) {
  const contactFullName = [firstName, lastName].filter(Boolean).join(' ') || null;
  const { data: returningOrgData } = useReturningOrganization(
    organizationName,
    eventId,
    email,
    contactFullName,
    phone,
    department,
  );

  if (!returningOrgData?.isReturning) return null;

  const isNewDepartment = department &&
    returningOrgData.pastDepartments &&
    returningOrgData.pastDepartments.length > 0 &&
    !returningOrgData.pastDepartments.some(
      d => d === department?.trim().replace(/\s+/g, ' ').toLowerCase()
    );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`whitespace-nowrap cursor-help ${
              returningOrgData.isReturningContact
                ? 'bg-purple-50 text-purple-700 border-purple-300'
                : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Returning Org
            {returningOrgData.isReturningContact
              ? <span className="ml-1 text-xs opacity-80">&middot; Same Contact</span>
              : <span className="ml-1 text-xs opacity-80">&middot; New Contact</span>
            }
            {returningOrgData.pastEventCount > 0 && (
              <span className="ml-1 text-xs opacity-80">
                ({returningOrgData.pastEventCount} past event{returningOrgData.pastEventCount !== 1 ? 's' : ''})
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">This organization has worked with us before!</p>
            {returningOrgData.pastEventCount > 0 && (
              <p className="text-sm">
                {returningOrgData.pastEventCount} previous event{returningOrgData.pastEventCount !== 1 ? 's' : ''} on file
              </p>
            )}
            {returningOrgData.collectionCount > 0 && (
              <p className="text-sm">
                {returningOrgData.collectionCount} sandwich collection{returningOrgData.collectionCount !== 1 ? 's' : ''} recorded
              </p>
            )}
            {returningOrgData.mostRecentEvent && (
              <p className="text-xs text-muted-foreground">
                Most recent: {returningOrgData.mostRecentEvent.eventDate
                  ? new Date(returningOrgData.mostRecentEvent.eventDate).toLocaleDateString()
                  : 'Date unknown'}
                {returningOrgData.mostRecentEvent.status && ` (${returningOrgData.mostRecentEvent.status})`}
              </p>
            )}
            {returningOrgData.pastDepartments && returningOrgData.pastDepartments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Past department{returningOrgData.pastDepartments.length !== 1 ? 's' : ''}: {returningOrgData.pastDepartments.join(', ')}
              </p>
            )}
            {returningOrgData.isReturningContact ? (
              <p className="text-xs text-purple-600 font-medium mt-2">
                Same contact as a previous event &mdash; personalize your outreach!
              </p>
            ) : (
              <div className="mt-2">
                {returningOrgData.pastContactName && (
                  <p className="text-xs text-muted-foreground">
                    Past contact: {returningOrgData.pastContactName}
                  </p>
                )}
                <p className="text-xs text-amber-600 font-medium">
                  New contact for this org &mdash; treat as a first-time outreach
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
      {isNewDepartment && (
        <Badge
          variant="outline"
          className="whitespace-nowrap bg-blue-50 text-blue-700 border-blue-300"
        >
          New Department
        </Badge>
      )}
    </>
  );
}
