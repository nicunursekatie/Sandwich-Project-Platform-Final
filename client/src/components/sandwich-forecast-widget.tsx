import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Users, AlertTriangle } from 'lucide-react';

interface EventRequest {
  id: number;
  organizationName: string;
  desiredEventDate?: string;
  estimatedSandwichCount?: number;
  status: 'new' | 'contact_completed' | 'scheduled' | 'completed' | 'declined';
}

export default function SandwichForecastWidget() {
  const { data: eventRequests, isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests/all'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests?all=true');
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
  });

  // Weekly sandwich prediction calculator
  const weeklySandwichForecast = useMemo(() => {
    if (!eventRequests) return [];

    const weeklyData: Record<
      string,
      {
        weekStartDate: string;
        weekEndDate: string;
        events: EventRequest[];
        totalEstimated: number;
        confirmedCount: number;
        pendingCount: number;
      }
    > = {};

    // Helper function to get the Thursday of a given week (distribution day)
    const getDistributionThursday = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay(); // 0 = Sunday, 4 = Thursday
      const daysToThursday = (4 - day + 7) % 7; // Days until next Thursday

      // If it's already Thursday or later in the week, get this week's Thursday
      // Otherwise get next week's Thursday
      if (day <= 4) {
        d.setDate(d.getDate() + daysToThursday);
      } else {
        d.setDate(d.getDate() + (7 - day + 4)); // Next Thursday
      }

      d.setHours(0, 0, 0, 0);
      return d;
    };

    // Helper function to get Wednesday (prep day) before Thursday
    const getPrepWednesday = (thursday: Date) => {
      const d = new Date(thursday);
      d.setDate(d.getDate() - 1); // Day before Thursday
      return d;
    };

    // Get current date for filtering future events
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Process events with dates and estimated sandwich counts (future events only)
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
        !['contact_completed', 'scheduled', 'completed'].includes(
          request.status
        )
      ) {
        return false;
      }

      try {
        const eventDate = new Date(request.desiredEventDate);
        if (isNaN(eventDate.getTime())) return false;

        // Only future events
        return eventDate >= today;
      } catch (error) {
        return false;
      }
    });

    relevantEvents.forEach((request) => {
      try {
        const eventDate = new Date(request.desiredEventDate!);
        const distributionThursday = getDistributionThursday(eventDate);
        const prepWednesday = getPrepWednesday(distributionThursday);
        const weekKey = distributionThursday.toISOString().split('T')[0];

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            weekStartDate: prepWednesday.toLocaleDateString('en-US', {
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
            events: [],
            totalEstimated: 0,
            confirmedCount: 0,
            pendingCount: 0,
          };
        }

        weeklyData[weekKey].events.push(request);
        weeklyData[weekKey].totalEstimated +=
          request.estimatedSandwichCount || 0;

        if (request.status === 'completed' || request.status === 'scheduled') {
          weeklyData[weekKey].confirmedCount +=
            request.estimatedSandwichCount || 0;
        } else {
          weeklyData[weekKey].pendingCount +=
            request.estimatedSandwichCount || 0;
        }
      } catch (error) {
        console.warn('Error processing event date:', request.desiredEventDate);
      }
    });

    // Convert to array and sort by week start date
    return Object.entries(weeklyData)
      .map(([weekKey, data]) => ({
        weekKey,
        ...data,
      }))
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .slice(0, 8); // Show next 8 weeks
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
          Group sandwich production forecast by Thursday distribution dates
        </p>
        <p className="text-xs text-brand-primary mt-1 font-medium">
          📅 Individual makers prep Wednesdays • Group distributions Thursdays
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {weeklySandwichForecast.length === 0 ? (
          <div className="text-center py-8 text-[#646464]">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-lg font-medium">
              No upcoming events with sandwich estimates
            </p>
            <p className="text-sm">
              Events need contact completion and sandwich count estimates to
              appear here
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards Grid - Next 8 Weeks */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {weeklySandwichForecast.map((week, index) => (
                <div
                  key={week.weekKey}
                  className={`rounded-lg p-3 border ${
                    index === 0
                      ? 'bg-gradient-to-r from-brand-primary to-brand-teal text-white border-brand-primary'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div
                      className={`text-xs font-medium ${
                        index === 0 ? 'opacity-90' : 'text-gray-600'
                      }`}
                    >
                      {index === 0 ? 'UPCOMING WEEK' : week.distributionDate}
                    </div>
                    {index === 0 && (
                      <div className="text-sm font-bold mt-1">
                        {week.distributionDate}
                      </div>
                    )}
                    <div
                      className={`text-2xl font-bold mt-1 ${
                        index === 0 ? 'text-white' : 'text-brand-primary'
                      }`}
                    >
                      {(week.totalEstimated || 0).toLocaleString()}
                    </div>
                    <div
                      className={`text-xs ${
                        index === 0 ? 'opacity-90' : 'text-gray-600'
                      }`}
                    >
                      {week.events?.length || 0} event
                      {(week.events?.length || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Weekly Breakdown */}
            <div className="space-y-4">
              <h4 className="font-semibold text-brand-primary flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Weekly Breakdown (Next 8 Weeks)
              </h4>
              <div className="space-y-3">
                {weeklySandwichForecast.map((week, index) => (
                  <div
                    key={week.weekKey}
                    className="border rounded-lg p-4 bg-white"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="font-semibold text-brand-primary">
                          {week.distributionDate}
                        </h5>
                        <p className="text-sm text-gray-600">
                          Prep: {week.weekStartDate} • Distribute:{' '}
                          {week.weekEndDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-brand-primary">
                          {(week.totalEstimated || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          {week.events?.length || 0} group event
                          {(week.events?.length || 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Event Details */}
                    {Array.isArray(week.events) && week.events.length > 0 && (
                      <div className="grid gap-2">
                        {week.events.map((event, eventIndex) => {
                          const eventDate = new Date(event.desiredEventDate!);
                          const dayName = eventDate.toLocaleDateString(
                            'en-US',
                            { weekday: 'long' }
                          );

                          return (
                            <div
                              key={event.id}
                              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">
                                  {event.organizationName}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {dayName}, {eventDate.toLocaleDateString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-brand-primary">
                                  {(
                                    event.estimatedSandwichCount || 0
                                  ).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  sandwiches
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(!week.events || week.events.length === 0) && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No events scheduled for this week
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
