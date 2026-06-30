/**
 * Badge component to show refrigeration warnings on event cards/forms
 */
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Snowflake, HelpCircle } from 'lucide-react';
import {
  hasCriticalRefrigerationIssue,
  needsRefrigerationConfirmation,
  getRefrigerationMessage,
  hasPerishableSandwiches,
  type SandwichType
} from '@/lib/refrigeration-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RefrigerationWarningBadgeProps {
  sandwichTypes: SandwichType[] | null | undefined;
  hasRefrigeration: boolean | null | undefined;
  className?: string;
  showTooltip?: boolean;
}

export function RefrigerationWarningBadge({
  sandwichTypes,
  hasRefrigeration,
  className = '',
  showTooltip = true,
}: RefrigerationWarningBadgeProps) {
  const hasCriticalIssue = hasCriticalRefrigerationIssue(sandwichTypes, hasRefrigeration);
  const needsConfirmation = needsRefrigerationConfirmation(hasRefrigeration);
  const hasPerishable = hasPerishableSandwiches(sandwichTypes);
  const showConfirmed = hasRefrigeration === true && hasPerishable;
  const message = getRefrigerationMessage(sandwichTypes, hasRefrigeration);

  if (!hasCriticalIssue && !needsConfirmation && !showConfirmed) {
    return null;
  }

  const badge = (
    <>
      {hasCriticalIssue && (
        <Badge
          variant="destructive"
          className={`gap-1 ${className}`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span className="font-semibold">NO REFRIGERATION!</span>
        </Badge>
      )}

      {!hasCriticalIssue && needsConfirmation && (
        // ACTION: refrigeration status is unknown — escalate to a real
        // warning treatment (solid amber + ⚠️) so the chip clearly asks
        // for an answer instead of reading as decorative info.
        <Badge
          className={`gap-1 bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 ${className}`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span>Refrigeration needed?</span>
        </Badge>
      )}

      {!hasCriticalIssue && !needsConfirmation && showConfirmed && (
        // STATUS: refrigeration is confirmed — mute it. Informational,
        // no action required.
        <Badge
          variant="secondary"
          className={`gap-1 bg-gray-100 text-gray-700 border border-gray-300 ${className}`}
        >
          <Snowflake className="h-3 w-3" />
          <span>Refrigeration confirmed</span>
        </Badge>
      )}
    </>
  );

  if (!showTooltip || !message) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="font-medium">{message.message}</p>
          {hasCriticalIssue && (
            <p className="text-xs mt-1 opacity-90">
              Perishable sandwiches (turkey/ham/deli) require refrigeration for food safety.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Larger, more prominent version for use in forms or detailed views
 */
export function RefrigerationWarningAlert({
  sandwichTypes,
  hasRefrigeration,
  className = '',
}: RefrigerationWarningBadgeProps) {
  const message = getRefrigerationMessage(sandwichTypes, hasRefrigeration);

  if (!message) {
    return null;
  }

  const bgColor = {
    error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
    warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  }[message.type];

  const textColor = {
    error: 'text-red-900 dark:text-red-100',
    warning: 'text-amber-900 dark:text-amber-100',
    info: 'text-blue-900 dark:text-blue-100',
  }[message.type];

  const Icon = {
    error: AlertTriangle,
    warning: HelpCircle,
    info: Snowflake,
  }[message.type];

  return (
    <div className={`flex items-start gap-2 p-3 rounded-md border ${bgColor} ${className}`}>
      <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${textColor}`} />
      <div className={`text-sm ${textColor}`}>
        <p className="font-medium">{message.message}</p>
        {message.type === 'error' && (
          <p className="text-xs mt-1 opacity-90">
            ⚠️ This is a food safety concern. Please either confirm refrigeration is available or switch to PB&J sandwiches.
          </p>
        )}
      </div>
    </div>
  );
}
