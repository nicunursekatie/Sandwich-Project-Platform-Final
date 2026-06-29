import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Shared styling primitives for event-request cards.
 *
 * This module holds STYLING ONLY — it does not own card content or props, so
 * cards can adopt it incrementally without any change to their prop signatures
 * (and therefore without touching the tab files that render them).
 *
 * Two goals from the card-streamlining feedback:
 *  1. "Use color coding sparingly" — every indicator badge maps to one of a
 *     small set of semantic TONES instead of an ad-hoc per-badge color.
 *  2. "Sufficient contrast for accessibility" — all tones use the light-fill /
 *     dark-text pattern, which clears WCAG AA (≥4.5:1). This replaces the
 *     previous white-on-gold (#FBAD3F ≈ 1.9:1) and white-on-light-blue
 *     (#47B3CB ≈ 2.4:1) surfaces, which failed.
 *
 * Colors are the existing TSP brand palette (see tailwind.config.ts:
 * brand-primary #236383, brand-teal #007E8C, brand-orange #FBAD3F,
 * brand-burgundy #A31C41, brand-light-blue #47B3CB).
 */

export type BadgeTone =
  | 'neutral'   // gray — informational, low priority
  | 'info'      // teal — brand-primary signal (returning contact, open date…)
  | 'attention' // gold — needs-attention / pending (follow-up, scheduled conflict…)
  | 'urgent'    // burgundy — time-critical / problem (past date, missing info…)
  | 'positive'; // green — confirmed / complete / good-to-go

/** AA-contrast class strings, one per tone (light fill + dark text + soft border). */
export const badgeTone: Record<BadgeTone, string> = {
  neutral: 'bg-gray-50 text-gray-700 border-gray-300',
  info: 'bg-[#E2F5F6] text-[#1a4a63] border-[#9fd5db]',
  attention: 'bg-amber-50 text-amber-800 border-amber-400',
  urgent: 'bg-[#FAE7ED] text-[#A31C41] border-[#e0a0b1]',
  positive: 'bg-green-50 text-green-700 border-green-300',
};

interface InfoBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: BadgeTone;
  /** Optional leading lucide icon component (pass the component, not an element). */
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

/**
 * Thin wrapper over the shadcn Badge that applies a semantic tone and an
 * optional leading icon. Use this for indicator badges (returning org,
 * corporate, conflicts, flexibility, staffing, date population, etc.) so they
 * share one accessible style. Pass extra classes via `className` as usual.
 */
export const InfoBadge: React.FC<InfoBadgeProps> = ({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
  onClick,
  ...rest
}) => {
  // When the badge is interactive (has an onClick — e.g. the date-conflict
  // badges that open the calendar), give it real button semantics so it's
  // keyboard-accessible: focusable and activatable with Enter/Space. The
  // underlying Badge already renders a visible focus ring.
  const interactive = typeof onClick === 'function';
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap gap-1',
        interactive && 'cursor-pointer',
        badgeTone[tone],
        className
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.currentTarget.click();
              }
            }
          : undefined
      }
      {...rest}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </Badge>
  );
};

/**
 * Standard footer for a card's action zone. Gives every card the same
 * separator, padding, and flex behavior so the action row reads consistently.
 */
export const CardActionRow: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200',
      className
    )}
    {...rest}
  >
    {children}
  </div>
);

/** Pushes everything after it to the right edge of a CardActionRow. */
export const ActionRowSpacer: React.FC = () => <div className="flex-1" />;

/**
 * Shared spacing tokens so vertical rhythm matches across cards. Use these
 * instead of sprinkling ad-hoc mb-3 / mb-4 / gap-3 values.
 */
export const CARD_ZONE = {
  /** Card content padding (CardContent). */
  padding: 'p-3',
  /** Gap between the header zone and the next zone. */
  headerGap: 'mb-3',
  /** Gap between stacked content sections. */
  sectionGap: 'space-y-3',
  /** Standard tinted info box. */
  box: 'rounded-lg p-3',
} as const;
