import { useMemo, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Users, AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { EventRequest } from '@shared/schema';

export default function SandwichForecastWidget() {
  const { data: eventRequests, isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests?all=true'],
  });

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

    // Helper function to get the Thursday of a distribution week
    // For planning purposes, we group events by the Thursday they distribute on
    const getDistributionThursday = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);

      const day = d.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

      // Events on Tue/Wed/Thu go to that week's Thursday
      // Events on Fri/Sat/Sun/Mon go to the next Thursday
      if (day >= 2 && day <= 4) {
        // It's Tue/Wed/Thu - find this week's Thursday
        const daysToThursday = 4 - day;
        d.setDate(d.getDate() + daysToThursday);
      } else {
        // It's Fri/Sat/Sun/Mon - find next Thursday
        const daysToNextThursday = (11 - day) % 7;
        d.setDate(d.getDate() + daysToNextThursday);
      }

      return d;
    };

    // Helper function to check if a distribution week is complete
    const isWeekComplete = (thursdayDate: Date) => {
      const now = new Date();
      return now > thursdayDate;
    };

    // Get current date for filtering events
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate date range: 4 weeks ago to 12 weeks forward
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(today.getDate() - 28);

    // Process events with dates and estimated sandwich counts (past and future)
    const relevantEvents = eventRequests.filter((request) => {
      if (
        !request.desiredEventDate ||
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
        const eventDate = new Date(request.desiredEventDate);
        if (isNaN(eventDate.getTime())) return false;

        // Include events from 4 weeks ago onwards
        return eventDate >= fourWeeksAgo;
      } catch (error) {
        return false;
      }
    });

    relevantEvents.forEach((request) => {
      try {
        const eventDate = new Date(request.desiredEventDate!);
        const distributionThursday = getDistributionThursday(eventDate);
        const weekKey = distributionThursday.toISOString().split('T')[0];
        const weekComplete = isWeekComplete(distributionThursday);

        // Debug logging for event grouping
        if (eventDate.getDay() === 5) { // Friday
          logger.log('🔍 Friday Event Grouping:', {
            org: request.organizationName,
            eventDate: eventDate.toDateString(),
            eventDayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][eventDate.getDay()],
            assignedThursday: distributionThursday.toDateString(),
            weekKey
          });
        }

        // Calculate Tuesday (2 days before Thursday) as the start of the distribution window
        const tuesdayStart = new Date(distributionThursday);
        tuesdayStart.setDate(distributionThursday.getDate() - 2);

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            weekStartDate: tuesdayStart.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
            weekEndDate: distributionThursday.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
            distributionDate: distributionThursday.toLocaleDateString('en-US', {
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
  }, [eventRequests]);

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

  // Find the current or next week index
  const getCurrentWeekIndex = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find the first week that hasn't passed yet (Thursday >= today)
    const currentIndex = weeklySandwichForecast.findIndex(week => {
      const weekDate = new Date(week.weekKey);
      return weekDate >= today;
    });
    
    // If all weeks are in the past, show the last week
    // If all weeks are in the future, show the first week
    return currentIndex === -1 ? Math.max(0, weeklySandwichForecast.length - 1) : currentIndex;
  };

  // Add state for current week index, starting at current/next week
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  // Update index when forecast data changes (using useEffect instead of useMemo)
  useEffect(() => {
    if (weeklySandwichForecast.length > 0) {
      setCurrentWeekIndex(getCurrentWeekIndex());
    }
  }, [weeklySandwichForecast]);

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

  // New logic for distribution events (Tue/Wed/Thu) and other events
  const isDistributionEvent = (dateStr: string) => {
    const date = parseEventDate(dateStr);
    const day = date.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu
    return day === 2 || day === 3 || day === 4; // Tue, Wed, Thu
  };
  const isOtherEvent = (dateStr: string) => {
    const date = parseEventDate(dateStr);
    const day = date.getDay();
    return day !== 2 && day !== 3 && day !== 4;
  };

  const distributionEvents = (currentWeek?.events || [])
    .filter(e => {
      if (!e.desiredEventDate) return false;
      return isDistributionEvent(e.desiredEventDate);
    })
    .sort((a, b) => {
      // Sort by date (earliest first)
      const dateA = parseEventDate(a.desiredEventDate!).getTime();
      const dateB = parseEventDate(b.desiredEventDate!).getTime();
      return dateA - dateB;
    });

  const otherEvents = (currentWeek?.events || [])
    .filter(e => {
      if (!e.desiredEventDate) return false;
      return isOtherEvent(e.desiredEventDate);
    })
    .sort((a, b) => {
      // Sort by date (earliest first)
      const dateA = parseEventDate(a.desiredEventDate!).getTime();
      const dateB = parseEventDate(b.desiredEventDate!).getTime();
      return dateA - dateB;
    });

  // Totals - use actual count for completed events, estimated for others
  const getSandwichCount = (event: EventRequest) => {
    return event.status === 'completed' && event.actualSandwichCount 
      ? event.actualSandwichCount 
      : event.estimatedSandwichCount || 0;
  };
  
  const thursdayTotal = distributionEvents.reduce((sum, e) => sum + getSandwichCount(e), 0);
  const weekTotal = (currentWeek?.events || []).reduce((sum, e) => sum + getSandwichCount(e), 0);

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
    <Card className="border-2 border-brand-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-brand-primary flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Weekly Sandwich Planning
        </CardTitle>
        <p className="text-sm text-[#646464] mt-1">
          Events grouped by Thursday distribution date. Tue/Wed/Thu events feed into that Thursday's distribution.
        </p>
        <p className="text-xs text-brand-primary mt-1 font-medium">
          📅 Distribution window: Tue-Thu • Individual makers prep Wed • Group distributions Thu
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
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
        {/* Totals Section - separated visually */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 flex items-center gap-2 p-3 rounded-lg border border-[#007E8C] bg-[#F0FBFC]">
            <span style={{ color: '#236383', fontWeight: 700, fontSize: '1.1em' }}>
              Thursday Distribution Total:
            </span>
            <span style={{ color: '#236383', fontWeight: 700, fontSize: '1.1em' }}>
              {thursdayTotal.toLocaleString()} sandwiches
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-[#007E8C] cursor-pointer ml-1" />
                </TooltipTrigger>
                <TooltipContent>
                  Sandwiches needed for Thursday group distribution (includes events on Tuesday, Wednesday, and Thursday).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 flex items-center gap-2 p-3 rounded-lg border border-[#A31C41] bg-[#FDF6F8]">
            <span style={{ color: '#A31C41', fontWeight: 700, fontSize: '1.1em' }}>
              Week Total:
            </span>
            <span style={{ color: '#A31C41', fontWeight: 700, fontSize: '1.1em' }}>
              {weekTotal.toLocaleString()} sandwiches
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-[#A31C41] cursor-pointer ml-1" />
                </TooltipTrigger>
                <TooltipContent>
                  Total sandwiches for all events this week (includes early events not counted for Thursday distribution).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
        {/* Distribution Events Section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold" style={{ color: '#236383' }}>
              Distribution Events (Tue/Wed/Thu)
            </h4>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-[#236383] cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent>
                  These events are counted toward Thursday's group distribution total.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {distributionEvents.length === 0 ? (
            <div className="text-gray-500 text-sm">No distribution events this week.</div>
          ) : (
            <div className="grid gap-2">
              {distributionEvents.map(event => {
                const eventDate = new Date(event.desiredEventDate!);
                return (
                  <div key={event.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{event.organizationName}</div>
                      <div className="text-xs text-gray-600">
                        {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
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
                      <div className="font-semibold text-brand-primary">
                        {getSandwichCount(event).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {event.status === 'completed' && event.actualSandwichCount ? 'actual' : 'estimated'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* Other Events Section */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold" style={{ color: '#A31C41' }}>
              Other Events This Week
            </h4>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-[#A31C41] cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent>
                  These events are not counted toward Thursday's group distribution total, but are included in the week total.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {otherEvents.length === 0 ? (
            <div className="text-gray-500 text-sm">No other events this week.</div>
          ) : (
            <div className="grid gap-2">
              {otherEvents.map(event => {
                const eventDate = new Date(event.desiredEventDate!);
                return (
                  <div key={event.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{event.organizationName}</div>
                      <div className="text-xs text-gray-600">
                        {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
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
                      <div className="font-semibold text-brand-primary">
                        {getSandwichCount(event).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {event.status === 'completed' && event.actualSandwichCount ? 'actual' : 'estimated'}
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
