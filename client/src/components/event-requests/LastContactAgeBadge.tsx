/**
 * Tiered badge showing how long it's been since the most recent contact attempt
 * on an event request. Renders nothing when:
 *  - There's no contact attempt history at all (shouldn't happen for in-process events)
 *  - The most recent attempt was less than 1 week ago
 *  - There's a future scheduled call (so a follow-up is already planned)
 *
 * Severity escalates by week, capped only by reality.
 */
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Clock } from 'lucide-react';
import { getContactAgeBadge, getLastContactTimestamp, type ContactAgeTier } from '@shared/contact-age';

interface LastContactAgeBadgeProps {
  request: {
    contactAttemptsLog?: unknown;
    lastContactAttempt?: Date | string | null;
    scheduledCallDate?: Date | string | null;
  };
  className?: string;
}

const TIER_STYLES: Record<ContactAgeTier, { className: string; variant: 'outline' | 'default' }> = {
  fresh: { variant: 'outline', className: 'bg-transparent text-slate-500 border-slate-300' },
  wk1: { variant: 'outline', className: 'bg-transparent text-slate-600 border-slate-300' },
  wk2: { variant: 'outline', className: 'bg-slate-50 text-slate-700 border-slate-400' },
  wk3: { variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-300' },
  mo1: { variant: 'default', className: 'bg-amber-500 text-white border-amber-600' },
  wk6: { variant: 'outline', className: 'bg-red-50 text-red-700 border-red-300' },
  mo2plus: { variant: 'default', className: 'bg-[#A31C41] text-white border-[#A31C41]' },
};

export function LastContactAgeBadge({ request, className = '' }: LastContactAgeBadgeProps) {
  // Skip if a scheduled call is already in the future — we're not stale, we're queued.
  if (request.scheduledCallDate) {
    const scheduled = typeof request.scheduledCallDate === 'string'
      ? new Date(request.scheduledCallDate)
      : request.scheduledCallDate;
    if (!Number.isNaN(scheduled.getTime()) && scheduled.getTime() > Date.now()) {
      return null;
    }
  }

  const lastTs = getLastContactTimestamp(request);
  const ageBadge = getContactAgeBadge(lastTs);
  if (!ageBadge) return null;

  const style = TIER_STYLES[ageBadge.tier];
  const tooltipText = lastTs
    ? `Last contact attempt: ${lastTs.toLocaleDateString()} (${ageBadge.weeks} week${ageBadge.weeks === 1 ? '' : 's'} ago)`
    : ageBadge.label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={style.variant}
            className={`whitespace-nowrap cursor-help inline-flex items-center gap-1 ${style.className} ${className}`}
            data-testid="badge-last-contact-age"
          >
            <Clock className="w-3 h-3" />
            {ageBadge.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
