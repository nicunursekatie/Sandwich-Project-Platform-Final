/**
 * Single contact-state badge for an event request. Renders whichever state
 * applies, with precedence:
 *
 *   1. "Call scheduled"     — a future scheduledCallDate exists
 *   2. "Recently contacted" — last contact was less than 1 week ago
 *   3. "Last contact N ago" — last contact is stale (>= 1 week), tiered by age
 *
 * Renders nothing when there's no contact history and no scheduled call —
 * which shouldn't happen for in-process events but is handled defensively.
 *
 * The name "LastContactAgeBadge" is historical; the component now owns all
 * contact-state signaling for cards/admin views.
 */
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CalendarClock, Check, Clock } from 'lucide-react';
import {
  getContactAgeBadge,
  getLastContactTimestamp,
  type ContactAgeTier,
} from '@shared/contact-age';

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

// Positive-state palette for "Call scheduled" and "Recently contacted".
// Both use the sky-blue accent (#47B3CB) so they read as friendly, on-top-of-it
// signals — the visual opposite of the escalating stale tiers above.
const POSITIVE_BADGE_CLASS =
  'bg-[#47B3CB]/15 text-[#236383] border-[#47B3CB]';

function parseDate(input: Date | string | null | undefined): Date | null {
  if (!input) return null;
  const d = typeof input === 'string' ? new Date(input) : input;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function LastContactAgeBadge({ request, className = '' }: LastContactAgeBadgeProps) {
  // ── 1. Call scheduled (highest precedence) ─────────────────────────────
  const scheduledCall = parseDate(request.scheduledCallDate);
  if (scheduledCall && scheduledCall.getTime() > Date.now()) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`whitespace-nowrap cursor-help inline-flex items-center gap-1 ${POSITIVE_BADGE_CLASS} ${className}`}
              data-testid="badge-call-scheduled"
            >
              <CalendarClock className="w-3 h-3" />
              Call scheduled
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Follow-up call scheduled for {scheduledCall.toLocaleString()}.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const lastTs = getLastContactTimestamp(request);

  // ── 2. Recently contacted (< 1 week since last attempt) ────────────────
  if (lastTs) {
    const msSinceLast = Date.now() - lastTs.getTime();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    if (msSinceLast >= 0 && msSinceLast < oneWeekMs) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`whitespace-nowrap cursor-help inline-flex items-center gap-1 ${POSITIVE_BADGE_CLASS} ${className}`}
                data-testid="badge-recently-contacted"
              >
                <Check className="w-3 h-3" />
                Recently contacted
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Last contact attempt: {lastTs.toLocaleDateString()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
  }

  // ── 3. Stale: "Last contact N ago" (>= 1 week) ─────────────────────────
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
