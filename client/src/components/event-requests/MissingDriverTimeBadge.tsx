import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MissingDriverTimeBadgeProps {
  driversNeeded?: number | null;
  selfTransport?: boolean | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  pickupTime?: string | null;
  pickupDateTime?: string | null;
  pickupTimeWindow?: string | null;
  driverPickupTime?: string | null;
  className?: string;
  showTooltip?: boolean;
}

function isEmpty(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === '';
}

/**
 * ACTION badge: event needs a driver but no time is set on it. Drivers
 * can't be dispatched without knowing when to arrive or pick up, so this
 * escalates to the same amber-warning treatment used by other
 * "data missing" chips on scheduled cards.
 *
 * Trigger: driversNeeded >= 1, selfTransport !== true, and every one of
 * (eventStartTime, eventEndTime, pickupTime, pickupDateTime,
 * pickupTimeWindow, driverPickupTime) is empty. If any single time is set
 * the driver has something to work with — don't show the badge.
 */
export function MissingDriverTimeBadge({
  driversNeeded,
  selfTransport,
  eventStartTime,
  eventEndTime,
  pickupTime,
  pickupDateTime,
  pickupTimeWindow,
  driverPickupTime,
  className = '',
  showTooltip = true,
}: MissingDriverTimeBadgeProps) {
  const needsDriver = (driversNeeded ?? 0) >= 1 && selfTransport !== true;
  if (!needsDriver) return null;

  const anyTimeSet =
    !isEmpty(eventStartTime) ||
    !isEmpty(eventEndTime) ||
    !isEmpty(pickupTime) ||
    !isEmpty(pickupDateTime) ||
    !isEmpty(pickupTimeWindow) ||
    !isEmpty(driverPickupTime);
  if (anyTimeSet) return null;

  const badge = (
    <Badge
      className={`gap-1 bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 ${className}`}
    >
      <AlertTriangle className="h-3 w-3" />
      <span>Time needed for driver</span>
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="font-medium">
            This event needs a driver but no start time, end time, or pickup
            time has been set. Assign at least one so the driver knows when
            to arrive.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
