import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Calendar, TrendingDown, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EventRequest } from '@shared/schema';
import { logger } from '@/lib/logger';

interface LowVolumeAlertProps {
  onNavigateToEvents?: () => void;
}

interface WeekForecast {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  totalSandwiches: number;
  eventCount: number;
  events: Array<{
    id: number;
    organizationName: string | null;
    sandwichCount: number;
    isRange: boolean;
    date: Date;
  }>;
}

/**
 * Calculate sandwich count for an event, handling ranges appropriately.
 * For ranges, use the midpoint for forecasting purposes.
 */
function getEventSandwichCount(event: EventRequest): { count: number; isRange: boolean } {
  // Priority: actualSandwichCount > estimatedSandwichCount > range midpoint > sandwichTypes sum
  if (event.actualSandwichCount && event.actualSandwichCount > 0) {
    return { count: event.actualSandwichCount, isRange: false };
  }

  if (event.estimatedSandwichCount && event.estimatedSandwichCount > 0) {
    return { count: event.estimatedSandwichCount, isRange: false };
  }

  // Handle range estimates - use midpoint for forecasting
  const min = event.estimatedSandwichCountMin;
  const max = event.estimatedSandwichCountMax;
  if (min && max && min > 0 && max > 0) {
    const midpoint = Math.round((min + max) / 2);
    return { count: midpoint, isRange: true };
  }

  if (max && max > 0) {
    return { count: max, isRange: true };
  }

  if (min && min > 0) {
    return { count: min, isRange: true };
  }

  // Fall back to sandwichTypes if available
  if (event.sandwichTypes && Array.isArray(event.sandwichTypes)) {
    const typesTotal = event.sandwichTypes.reduce((sum: number, type: any) => {
      return sum + (type.quantity || type.count || 0);
    }, 0);
    if (typesTotal > 0) {
      return { count: typesTotal, isRange: false };
    }
  }

  return { count: 0, isRange: false };
}

/**
 * Get the start of a week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of a week (Sunday)
 */
function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Format a week range for display
 */
function formatWeekRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startStr} - ${endStr}`;
}

export function LowVolumeAlert({ onNavigateToEvents }: LowVolumeAlertProps) {
  // Fetch event requests
  const { data: eventRequests = [] } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
  });

  // Fetch historical collection data to calculate baseline
  const { data: collectionsData } = useQuery<{ collections: any[] }>({
    queryKey: ['/api/sandwich-collections', { limit: 5000 }],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=5000', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  // Calculate forecasts for the next 3 weeks
  const { weekForecasts, historicalAverage, lowVolumeWeeks } = useMemo(() => {
    const today = new Date();
    const forecasts: WeekForecast[] = [];

    // Calculate historical weekly average from GROUP events only
    // (excluding individual donations to focus on group event volume)
    let historicalGroupTotal = 0;
    let historicalWeekCount = 0;

    if (collectionsData?.collections) {
      const weeklyGroupTotals: Record<string, number> = {};

      collectionsData.collections.forEach((collection: any) => {
        if (collection.collectionDate && collection.groupCollections) {
          const date = new Date(collection.collectionDate);
          const weekStart = getWeekStart(date);
          const weekKey = weekStart.toISOString().split('T')[0];

          const groupTotal = Array.isArray(collection.groupCollections)
            ? collection.groupCollections.reduce((sum: number, group: any) => {
                return sum + (group.count || group.sandwichCount || 0);
              }, 0)
            : 0;

          weeklyGroupTotals[weekKey] = (weeklyGroupTotals[weekKey] || 0) + groupTotal;
        }
      });

      // Calculate average from weeks that had group collections
      const weeksWithGroups = Object.values(weeklyGroupTotals).filter(total => total > 0);
      if (weeksWithGroups.length > 0) {
        historicalGroupTotal = weeksWithGroups.reduce((a, b) => a + b, 0);
        historicalWeekCount = weeksWithGroups.length;
      }
    }

    const avgWeeklyFromGroups = historicalWeekCount > 0
      ? Math.round(historicalGroupTotal / historicalWeekCount)
      : 3000; // Default baseline if no historical data

    // Look at weeks 1, 2, and 3 from now (skip current week)
    for (let weekOffset = 1; weekOffset <= 3; weekOffset++) {
      const weekStart = getWeekStart(today);
      weekStart.setDate(weekStart.getDate() + (weekOffset * 7));
      const weekEnd = getWeekEnd(weekStart);

      // Get events for this week (new, in_process, and scheduled)
      const eventsThisWeek = eventRequests.filter((event) => {
        // Use scheduledEventDate if available, otherwise desiredEventDate
        const eventDateStr = event.scheduledEventDate || event.desiredEventDate;
        if (!eventDateStr) return false;

        // Include new, in_process, and scheduled events
        if (!['new', 'in_process', 'scheduled'].includes(event.status)) return false;

        const eventDate = new Date(eventDateStr);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });

      // Calculate total sandwiches for this week
      const eventsWithCounts = eventsThisWeek.map(event => {
        const { count, isRange } = getEventSandwichCount(event);
        const eventDateStr = event.scheduledEventDate || event.desiredEventDate;
        return {
          id: event.id,
          organizationName: event.organizationName,
          sandwichCount: count,
          isRange,
          date: new Date(eventDateStr!),
        };
      });

      const totalSandwiches = eventsWithCounts.reduce((sum, e) => sum + e.sandwichCount, 0);

      // Format week label
      let weekLabel: string;
      if (weekOffset === 1) {
        weekLabel = 'Next Week';
      } else if (weekOffset === 2) {
        weekLabel = 'In 2 Weeks';
      } else {
        weekLabel = 'In 3 Weeks';
      }

      forecasts.push({
        weekStart,
        weekEnd,
        weekLabel,
        totalSandwiches,
        eventCount: eventsThisWeek.length,
        events: eventsWithCounts,
      });
    }

    // Identify weeks that are below 60% of the historical average
    const threshold = avgWeeklyFromGroups * 0.6;
    const lowWeeks = forecasts.filter(f => f.totalSandwiches < threshold);

    logger.log('Low Volume Alert Analysis:', {
      historicalAverage: avgWeeklyFromGroups,
      threshold,
      forecasts: forecasts.map(f => ({
        week: f.weekLabel,
        total: f.totalSandwiches,
        eventCount: f.eventCount,
        isBelowThreshold: f.totalSandwiches < threshold,
      })),
    });

    return {
      weekForecasts: forecasts,
      historicalAverage: avgWeeklyFromGroups,
      lowVolumeWeeks: lowWeeks,
    };
  }, [eventRequests, collectionsData]);

  // Don't render if there are no low volume weeks
  if (lowVolumeWeeks.length === 0) {
    return null;
  }

  // Get the most urgent low volume week (closest in time)
  const urgentWeek = lowVolumeWeeks[0];
  const shortfall = historicalAverage - urgentWeek.totalSandwiches;
  const percentBelow = Math.round((shortfall / historicalAverage) * 100);

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
        Low Sandwich Volume Alert
        <Badge variant="outline" className="text-amber-700 border-amber-400">
          {lowVolumeWeeks.length} week{lowVolumeWeeks.length > 1 ? 's' : ''} affected
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-3">
        <div className="space-y-4">
          {/* Summary */}
          <div className="text-amber-700 dark:text-amber-300">
            <p className="font-medium">
              Group events {urgentWeek.weekLabel.toLowerCase()} ({formatWeekRange(urgentWeek.weekStart, urgentWeek.weekEnd)})
              are forecasting <span className="font-bold">{urgentWeek.totalSandwiches.toLocaleString()}</span> sandwiches
              {' '}&mdash; <span className="font-bold">{percentBelow}% below</span> our typical weekly average of{' '}
              <span className="font-bold">{historicalAverage.toLocaleString()}</span>.
            </p>
          </div>

          {/* Week-by-week breakdown */}
          <div className="grid gap-2 sm:grid-cols-3">
            {weekForecasts.map((week, index) => {
              const isLow = lowVolumeWeeks.some(lw => lw.weekStart.getTime() === week.weekStart.getTime());
              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    isLow
                      ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700'
                      : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{week.weekLabel}</span>
                    {isLow && <TrendingDown className="w-4 h-4 text-amber-600" />}
                  </div>
                  <div className="text-lg font-bold">
                    {week.totalSandwiches.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {week.eventCount} event{week.eventCount !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendation */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Recommendation:</strong> Consider sending a callout for individual sandwich donations
              to supplement the lower group event volume. You may need approximately{' '}
              <strong>{shortfall.toLocaleString()} additional sandwiches</strong> to reach typical levels.
            </p>
          </div>

          {/* Action button */}
          {onNavigateToEvents && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToEvents}
              className="border-amber-400 text-amber-700 hover:bg-amber-100"
            >
              View Upcoming Events
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
