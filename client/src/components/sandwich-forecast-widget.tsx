import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Users, AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { EventRequest } from '@shared/schema';
import { logger } from '@/lib/logger';
import { formatEventDate, formatTime12Hour } from '@/components/event-requests/utils';

interface SandwichForecastWidgetProps {
  hideHeader?: boolean;
}

export default function SandwichForecastWidget({ hideHeader = false }: SandwichForecastWidgetProps) {
  const { data: eventRequests, isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests?all=true'],
  });

  // Add state for extended week view (include until next collection Wednesday)
  const [includeUntilNextCollection, setIncludeUntilNextCollection] = useState(false);

  // Weekly sandwich prediction calculator
  const weeklySandwichForecast = useMemo(() => {
    if (!eventRequests) return [];

    const weeklyData: Record<
      string,
      {
        weekStartDate: string;
        weekEndDate: string;
        distributionDate?: string;
        isComplete: boolean;
        events: EventRequest[];
        totalEstimated: number;
        confirmedCount: number;
        pendingCount: number;
      }
    > = {};

    // Helper function to get the Monday of a calendar week
    const getWeekMonday = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay(); // 0=Sun, 1=Mon, ...
      // Adjust to get Monday (if Sunday, go back 6 days; otherwise go back (day-1) days)
      const daysToMonday = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + daysToMonday);
      return d;
    };

    // Helper function to get the Sunday of the same calendar week
    const getWeekSunday = (monday: Date) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + 6);
      return d;
    };

    // Helper function to get the next Wednesday after Sunday (collection day)
    const getNextWednesday = (sunday: Date) => {
      const d = new Date(sunday);
      d.setDate(d.getDate() + 3); // Sun + 3 = Wed
      return d;
    };

    // Helper function to check if a week is complete
    const isWeekComplete = (endDate: Date) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return now > endDate;
    };

    // Helper function to safely parse dates without timezone issues
    const parseEventDate = (dateString: string | null | undefined): Date | null => {
      if (!dateString) return null;
      
      try {
        let date: Date;
        const dateStr = dateString.toString().trim();
        
        // Handle different date formats
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // YYYY-MM-DD format - parse at noon to avoid timezone shift
          date = new Date(dateStr + 'T12:00:00');
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
          // Database timestamp format: "2024-12-01 00:00:00" - extract date part
          const dateOnly = dateStr.split(' ')[0];
          date = new Date(dateOnly + 'T12:00:00');
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
          // ISO format with midnight time - extract date part
          const dateOnly = dateStr.split('T')[0];
          date = new Date(dateOnly + 'T12:00:00');
        } else {
          // Other formats - parse and normalize to local date at midnight
          date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            // Normalize to local midnight to avoid timezone issues
            date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          }
        }
        
        if (isNaN(date.getTime())) return null;
        return date;
      } catch (error) {
        return null;
      }
    };

    // Get current date for filtering events
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate date range: 4 weeks ago to 12 weeks forward
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(today.getDate() - 28);
    fourWeeksAgo.setHours(0, 0, 0, 0);

    // Debug: Log current date information
    logger.log('📅 Sandwich Planning - Date Info:', {
      today: today.toISOString().split('T')[0],
      todayFormatted: today.toLocaleDateString('en-US'),
      fourWeeksAgo: fourWeeksAgo.toISOString().split('T')[0],
      fourWeeksAgoFormatted: fourWeeksAgo.toLocaleDateString('en-US'),
    });

    // Process events with dates and estimated sandwich counts (past and future)
    const relevantEvents = eventRequests.filter((request) => {
      // Use scheduledEventDate for scheduled/completed events, fall back to desiredEventDate
      const dateToCheck = (request.status === 'scheduled' || request.status === 'completed') && request.scheduledEventDate
        ? request.scheduledEventDate
        : request.desiredEventDate;
      
      if (
        !dateToCheck ||
        !request.estimatedSandwichCount ||
        request.estimatedSandwichCount <= 0
      ) {
        return false;
      }

      // Only include events that are likely to happen
      if (
        !['in_process', 'scheduled', 'completed'].includes(
          request.status
        )
      ) {
        return false;
      }

      try {
        const eventDate = parseEventDate(dateToCheck);
        if (!eventDate) return false;
        
        // Normalize event date to midnight for proper comparison
        const eventDateNormalized = new Date(eventDate);
        eventDateNormalized.setHours(0, 0, 0, 0);

        // Include events from 4 weeks ago onwards
        const isIncluded = eventDateNormalized >= fourWeeksAgo;
        
        // Debug: Log events from today to help diagnose
        const eventDateStr = eventDateNormalized.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];
        if (eventDateStr === todayStr) {
          logger.log('📅 Event on today\'s date:', {
            org: request.organizationName,
            eventDate: eventDateStr,
            eventDateRaw: dateToCheck,
            parsedDate: eventDateNormalized.toISOString(),
            isIncluded,
            fourWeeksAgo: fourWeeksAgo.toISOString().split('T')[0],
          });
        }
        
        return isIncluded;
      } catch (error) {
        return false;
      }
    });

    relevantEvents.forEach((request) => {
      try {
        // Use scheduledEventDate for scheduled/completed events, fall back to desiredEventDate
        const dateToUse = (request.status === 'scheduled' || request.status === 'completed') && request.scheduledEventDate
          ? request.scheduledEventDate
          : request.desiredEventDate!;
        const eventDate = parseEventDate(dateToUse);
        if (!eventDate) return;
        const weekMonday = getWeekMonday(eventDate);
        const weekSunday = getWeekSunday(weekMonday);

        // Determine the end date based on user preference
        const weekEndDate = includeUntilNextCollection
          ? getNextWednesday(weekSunday)
          : weekSunday;

        // Use Monday as the week key for consistent grouping
        const weekKey = weekMonday.toISOString().split('T')[0];

        // For extended mode, check if event falls within extended range
        // (Mon-Sun of calendar week, or Mon-Wed of following week if extended)
        if (includeUntilNextCollection) {
          // Check if event is Mon-Tue-Wed of the NEXT week (should belong to previous week)
          const eventDay = eventDate.getDay();
          if (eventDay >= 1 && eventDay <= 3) { // Mon, Tue, Wed
            // Get the previous week's Monday
            const prevWeekMonday = new Date(weekMonday);
            prevWeekMonday.setDate(prevWeekMonday.getDate() - 7);
            const prevWeekKey = prevWeekMonday.toISOString().split('T')[0];

            // Check if this event should belong to the previous week
            const prevWeekSunday = getWeekSunday(prevWeekMonday);
            const prevWeekWednesday = getNextWednesday(prevWeekSunday);

            if (eventDate <= prevWeekWednesday && eventDate > prevWeekSunday) {
              // This event belongs to the previous week's extended range
              const useWeekKey = prevWeekKey;
              const useWeekMonday = prevWeekMonday;
              const useWeekEndDate = prevWeekWednesday;
              const weekComplete = isWeekComplete(useWeekEndDate);

              if (!weeklyData[useWeekKey]) {
                weeklyData[useWeekKey] = {
                  weekStartDate: useWeekMonday.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  }),
                  weekEndDate: useWeekEndDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  }),
                  distributionDate: useWeekEndDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  }),
                  isComplete: weekComplete,
                  events: [],
                  totalEstimated: 0,
                  confirmedCount: 0,
                  pendingCount: 0,
                };
              }

              weeklyData[useWeekKey].events.push(request);

              const sandwichCount = request.status === 'completed' && request.actualSandwichCount
                ? request.actualSandwichCount
                : request.estimatedSandwichCount || 0;

              weeklyData[useWeekKey].totalEstimated += sandwichCount;

              if (request.status === 'completed' || request.status === 'scheduled') {
                weeklyData[useWeekKey].confirmedCount += sandwichCount;
              } else {
                weeklyData[useWeekKey].pendingCount += sandwichCount;
              }

              return; // Skip normal processing
            }
          }
        }

        const weekComplete = isWeekComplete(weekEndDate);

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            weekStartDate: weekMonday.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
            weekEndDate: weekEndDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
            distributionDate: weekEndDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }),
            isComplete: weekComplete,
            events: [],
            totalEstimated: 0,
            confirmedCount: 0,
            pendingCount: 0,
          };
        }

        weeklyData[weekKey].events.push(request);

        // Use actual count for completed events, estimated for others
        const sandwichCount = request.status === 'completed' && request.actualSandwichCount
          ? request.actualSandwichCount
          : request.estimatedSandwichCount || 0;

        weeklyData[weekKey].totalEstimated += sandwichCount;

        if (request.status === 'completed' || request.status === 'scheduled') {
          weeklyData[weekKey].confirmedCount += sandwichCount;
        } else {
          weeklyData[weekKey].pendingCount += sandwichCount;
        }
      } catch (error) {
        logger.warn('Error processing event date:', request.desiredEventDate);
      }
    });

    // Convert to array and sort by week start date
    return Object.entries(weeklyData)
      .map(([weekKey, data]) => ({
        weekKey,
        ...data,
      }))
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey)); // Show all weeks in range
  }, [eventRequests, includeUntilNextCollection]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!weeklySandwichForecast?.length)
      return { total: 0, confirmed: 0, pending: 0, events: 0 };

    return weeklySandwichForecast.reduce(
      (acc, week) => {
        // Ensure week object exists and has default values
        const safeWeek = week || {};
        return {
          total: acc.total + (safeWeek.totalEstimated || 0),
          confirmed: acc.confirmed + (safeWeek.confirmedCount || 0),
          pending: acc.pending + (safeWeek.pendingCount || 0),
          events: acc.events + (safeWeek.events?.length || 0),
        };
      },
      { total: 0, confirmed: 0, pending: 0, events: 0 }
    );
  }, [weeklySandwichForecast]);

  // Add state for current week index, starting at current/next week
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  // Update index when forecast data changes (using useEffect instead of useMemo)
  useEffect(() => {
    if (weeklySandwichForecast.length === 0) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Helper to get week Monday from weekKey
    const getWeekMonday = (weekKey: string) => {
      const d = new Date(weekKey);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    
    // Helper to get week Sunday from Monday
    const getWeekSunday = (monday: Date) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + 6);
      return d;
    };
    
    // Helper to get next Wednesday after Sunday
    const getNextWednesday = (sunday: Date) => {
      const d = new Date(sunday);
      d.setDate(d.getDate() + 3);
      return d;
    };
    
    // Find the week that contains today
    const currentIndex = weeklySandwichForecast.findIndex(week => {
      const weekMonday = getWeekMonday(week.weekKey);
      const weekSunday = getWeekSunday(weekMonday);
      const weekEndDate = includeUntilNextCollection
        ? getNextWednesday(weekSunday)
        : weekSunday;
      weekEndDate.setHours(23, 59, 59, 999);
      
      // Check if today falls within this week's range
      return today >= weekMonday && today <= weekEndDate;
    });
    
    // If today is not in any week, find the first future week
    if (currentIndex === -1) {
      const futureIndex = weeklySandwichForecast.findIndex(week => {
        const weekMonday = getWeekMonday(week.weekKey);
        return weekMonday > today;
      });
      
      // If all weeks are in the past, show the last week
      // If all weeks are in the future, show the first week
      const finalIndex = futureIndex === -1 ? Math.max(0, weeklySandwichForecast.length - 1) : futureIndex;
      setCurrentWeekIndex(finalIndex);
    } else {
      setCurrentWeekIndex(currentIndex);
    }
  }, [weeklySandwichForecast, includeUntilNextCollection]);

  // Only show one week at a time
  const currentWeek = weeklySandwichForecast[currentWeekIndex] || null;

  // Calculate unfulfilled driver/speaker needs for the current week
  const getAssignmentCount = (assignments: any) => {
    if (!assignments) return 0;
    if (Array.isArray(assignments)) return assignments.length;
    if (typeof assignments === 'string') {
      if (assignments === '{}' || assignments === '') return 0;
      let cleaned = assignments.replace(/^{|}$/g, '');
      if (!cleaned) return 0;
      if (cleaned.includes('"')) {
        const matches = cleaned.match(/"[^"]*"|[^",]+/g);
        return matches ? matches.filter(item => item.trim()).length : 0;
      } else {
        return cleaned.split(',').filter(item => item.trim()).length;
      }
    }
    return 0;
  };

  const unfulfilledDrivers = currentWeek?.events?.reduce((count, e) => {
    const needed = e.driversNeeded || 0;
    const assigned = getAssignmentCount(e.assignedDriverIds);
    return count + Math.max(0, needed - assigned);
  }, 0) || 0;

  const unfulfilledSpeakers = currentWeek?.events?.reduce((count, e) => {
    const needed = e.speakersNeeded || 0;
    const assigned = getAssignmentCount(e.assignedSpeakerIds);
    return count + Math.max(0, needed - assigned);
  }, 0) || 0;

  // Helper to parse dates consistently (avoid timezone issues)
  const parseEventDate = (dateStr: string) => {
    // Extract YYYY-MM-DD from any format
    let datePart = dateStr;
    if (dateStr.includes('T')) {
      datePart = dateStr.split('T')[0]; // Get YYYY-MM-DD
    }

    // Parse explicitly using Date constructor with year, month, day
    const [year, month, day] = datePart.split('-').map(Number);
    // Month is 0-indexed in JavaScript Date constructor
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  // Sort all events by date
  const allWeekEvents = (currentWeek?.events || [])
    .sort((a, b) => {
      // Sort by date (earliest first) - use scheduledEventDate if available
      const dateStrA = a.scheduledEventDate || a.desiredEventDate;
      const dateStrB = b.scheduledEventDate || b.desiredEventDate;
      const dateA = dateStrA ? parseEventDate(dateStrA.toString()).getTime() : 0;
      const dateB = dateStrB ? parseEventDate(dateStrB.toString()).getTime() : 0;
      return dateA - dateB;
    });

  // Totals - use actual count for completed events, estimated for others
  const getSandwichCount = (event: EventRequest) => {
    return event.status === 'completed' && event.actualSandwichCount
      ? event.actualSandwichCount
      : event.estimatedSandwichCount || 0;
  };

  const weekTotal = allWeekEvents.reduce((sum, e) => sum + getSandwichCount(e), 0);

  if (isLoading) {
    return (
      <Card className="border-2 border-brand-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-primary flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sandwich Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hideHeader ? "border-0 shadow-none" : "border-2 border-brand-primary/20"}>
      {!hideHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-brand-primary flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Weekly Sandwich Planning
              </CardTitle>
              <p className="text-sm text-[#646464] mt-1">
                Events grouped by calendar week (Mon-Sun).
                {includeUntilNextCollection && ' Extended to include events until next Wednesday collection.'}
              </p>
              <p className="text-xs text-brand-primary mt-1 font-medium">
                📅 Week view: {includeUntilNextCollection ? 'Mon-Wed (next week)' : 'Mon-Sun'}
              </p>
            </div>
            <div className="flex flex-col gap-1 items-end ml-4">
              <label className="text-xs font-medium text-[#646464]">Week Range</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={includeUntilNextCollection ? 'outline' : 'default'}
                  onClick={() => setIncludeUntilNextCollection(false)}
                  className="text-xs h-7"
                >
                  Mon-Sun
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={includeUntilNextCollection ? 'default' : 'outline'}
                  onClick={() => setIncludeUntilNextCollection(true)}
                  className="text-xs h-7"
                >
                  Until Next Collection
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className={hideHeader ? "p-0 space-y-6" : "space-y-6"}>
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            onClick={() => setCurrentWeekIndex(i => Math.max(0, i - 1))}
            disabled={currentWeekIndex === 0}
            style={{ color: '#236383', borderColor: '#236383' }}
          >
            Previous Week
          </Button>
          <div className="flex flex-col items-center">
            <div className="font-bold text-lg text-brand-primary">
              {currentWeek?.distributionDate || 'No week selected'}
            </div>
            {currentWeek && !currentWeek.isComplete && (
              <Badge className="bg-yellow-100 text-yellow-800 text-xs mt-1">
                Week in Progress
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setCurrentWeekIndex(i => Math.min(weeklySandwichForecast.length - 1, i + 1))}
            disabled={currentWeekIndex === weeklySandwichForecast.length - 1}
            style={{ color: '#236383', borderColor: '#236383' }}
          >
            Next Week
          </Button>
        </div>
        {/* Totals Section */}
        <div className="flex items-center gap-2 p-3 rounded-lg border border-[#236383] bg-[#F0FBFC] mb-4">
          <span style={{ color: '#236383', fontWeight: 700, fontSize: '1.1em' }}>
            Week Total:
          </span>
          <span style={{ color: '#236383', fontWeight: 700, fontSize: '1.1em' }}>
            {weekTotal.toLocaleString()} sandwiches
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-[#236383] cursor-pointer ml-1" />
              </TooltipTrigger>
              <TooltipContent>
                Total sandwiches for all events {includeUntilNextCollection ? 'from Monday through next Wednesday collection' : 'this week (Mon-Sun)'}.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {/* Unfulfilled needs summary row - only show if there are unfulfilled positions */}
        {(unfulfilledDrivers > 0 || unfulfilledSpeakers > 0) && (
          <div className="flex gap-4 items-center mb-2">
            {unfulfilledDrivers > 0 && (
              <span style={{ color: '#007E8C', fontWeight: 600 }}>
                🚗 {unfulfilledDrivers} Driver{unfulfilledDrivers > 1 ? 's' : ''} Still Needed
              </span>
            )}
            {unfulfilledSpeakers > 0 && (
              <span style={{ color: '#FBAD3F', fontWeight: 600 }}>
                🎤 {unfulfilledSpeakers} Speaker{unfulfilledSpeakers > 1 ? 's' : ''} Still Needed
              </span>
            )}
          </div>
        )}
        {/* Events Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold" style={{ color: '#236383' }}>
              Events This Week
            </h4>
            <span className="text-sm text-gray-500">
              ({currentWeek?.weekStartDate} - {currentWeek?.weekEndDate})
            </span>
          </div>
          {allWeekEvents.length === 0 ? (
            <div className="text-gray-500 text-sm">No events this week.</div>
          ) : (
            <div className="grid gap-2">
              {allWeekEvents.map(event => {
                // Use scheduledEventDate first, fall back to desiredEventDate
                const dateStr = event.scheduledEventDate || event.desiredEventDate;
                const dateInfo = dateStr ? formatEventDate(dateStr.toString()) : null;
                return (
                  <div key={event.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{event.organizationName}</div>
                      <div className="text-xs text-gray-600">
                        {dateInfo ? dateInfo.text : 'Date TBD'}
                        {event.eventStartTime && (
                          <span className="ml-2 text-gray-500">
                            @ {formatTime12Hour(event.eventStartTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const driversUnfulfilled = Math.max(0, (event.driversNeeded || 0) - getAssignmentCount(event.assignedDriverIds));
                        const speakersUnfulfilled = Math.max(0, (event.speakersNeeded || 0) - getAssignmentCount(event.assignedSpeakerIds));
                        return (
                          <>
                            {driversUnfulfilled > 0 && (
                              <Badge style={{ background: '#007E8C', color: 'white' }}>🚗 {driversUnfulfilled} Driver{driversUnfulfilled > 1 ? 's' : ''} Needed</Badge>
                            )}
                            {speakersUnfulfilled > 0 && (
                              <Badge style={{ background: '#FBAD3F', color: 'white' }}>🎤 {speakersUnfulfilled} Speaker{speakersUnfulfilled > 1 ? 's' : ''} Needed</Badge>
                            )}
                          </>
                        );
                      })()}
                      <div className="text-right">
                        <div className="font-semibold text-brand-primary">
                          {getSandwichCount(event).toLocaleString()}
                        </div>
                        {(() => {
                          const types = event.sandwichTypes as any[] | undefined;
                          if (!types || !Array.isArray(types) || types.length === 0) return null;
                          return (
                            <div className="text-xs text-gray-600">
                              {types.map((st: any, idx: number) => (
                                <span key={idx}>
                                  {st.quantity} {st.type}
                                  {idx < types.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                        <div className="text-xs text-gray-500">
                          {event.status === 'completed' && event.actualSandwichCount ? 'actual' : 'estimated'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
