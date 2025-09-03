import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, Users, AlertTriangle } from "lucide-react";

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
    }
  });

  // Weekly sandwich prediction calculator
  const weeklySandwichForecast = useMemo(() => {
    if (!eventRequests) return [];

    const weeklyData: Record<string, {
      weekStartDate: string;
      weekEndDate: string;
      events: EventRequest[];
      totalEstimated: number;
      confirmedCount: number;
      pendingCount: number;
    }> = {};

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
    const relevantEvents = eventRequests.filter(request => {
      if (!request.desiredEventDate || !request.estimatedSandwichCount || request.estimatedSandwichCount <= 0) {
        return false;
      }

      // Only include events that are likely to happen
      if (!['contact_completed', 'scheduled', 'completed'].includes(request.status)) {
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

    relevantEvents.forEach(request => {
      try {
        const eventDate = new Date(request.desiredEventDate!);
        const distributionThursday = getDistributionThursday(eventDate);
        const prepWednesday = getPrepWednesday(distributionThursday);
        const weekKey = distributionThursday.toISOString().split('T')[0];

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            weekStartDate: prepWednesday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            weekEndDate: distributionThursday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            distributionDate: distributionThursday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
            events: [],
            totalEstimated: 0,
            confirmedCount: 0,
            pendingCount: 0
          };
        }

        weeklyData[weekKey].events.push(request);
        weeklyData[weekKey].totalEstimated += request.estimatedSandwichCount || 0;
        
        if (request.status === 'completed' || request.status === 'scheduled') {
          weeklyData[weekKey].confirmedCount += request.estimatedSandwichCount || 0;
        } else {
          weeklyData[weekKey].pendingCount += request.estimatedSandwichCount || 0;
        }
      } catch (error) {
        console.warn('Error processing event date:', request.desiredEventDate);
      }
    });

    // Convert to array and sort by week start date
    return Object.entries(weeklyData)
      .map(([weekKey, data]) => ({
        weekKey,
        ...data
      }))
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .slice(0, 8); // Show next 8 weeks
  }, [eventRequests]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!weeklySandwichForecast.length) return { total: 0, confirmed: 0, pending: 0, events: 0 };

    return weeklySandwichForecast.reduce((acc, week) => ({
      total: acc.total + week.totalEstimated,
      confirmed: acc.confirmed + week.confirmedCount,
      pending: acc.pending + week.pendingCount,
      events: acc.events + week.events.length
    }), { total: 0, confirmed: 0, pending: 0, events: 0 });
  }, [weeklySandwichForecast]);

  if (isLoading) {
    return (
      <Card className="border-2 border-[#236383]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-[#236383] flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sandwich Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#236383]"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-[#236383]/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-[#236383] flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Weekly Sandwich Planning
        </CardTitle>
        <p className="text-sm text-[#646464] mt-1">
          Group sandwich production forecast by Thursday distribution dates
        </p>
        <p className="text-xs text-blue-600 mt-1 font-medium">
          📅 Individual makers prep Wednesdays • Group distributions Thursdays
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weekly Summary Cards */}
        {weeklySandwichForecast.length > 0 && (
          <div className="space-y-3">
            {/* Upcoming Week - Prominent Display */}
            <div className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white rounded-lg p-4 border-2 border-[#236383]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium opacity-90">UPCOMING WEEK</div>
                  <div className="text-lg font-bold">{weeklySandwichForecast[0].distributionDate}</div>
                  <div className="text-xs opacity-75">Prep: {weeklySandwichForecast[0].prepDate} • Distribute: {weeklySandwichForecast[0].distributionDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{weeklySandwichForecast[0].totalSandwiches.toLocaleString()}</div>
                  <div className="text-sm opacity-90">{weeklySandwichForecast[0].events} event{weeklySandwichForecast[0].events !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
            
            {/* Following Weeks - Compact Display */}
            {weeklySandwichForecast.length > 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {weeklySandwichForecast.slice(1).map((week, index) => (
                  <div key={week.weekKey} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#236383]">{week.distributionDate}</div>
                        <div className="text-xs text-gray-600">{week.events} event{week.events !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{week.totalSandwiches.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {weeklySandwichForecast.length === 0 ? (
          <div className="text-center py-8 text-[#646464]">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-lg font-medium">No upcoming events with sandwich estimates</p>
            <p className="text-sm">Events need contact completion and sandwich count estimates to appear here</p>
          </div>
        ) : (
          /* Weekly Breakdown */
          <div className="space-y-3">
            <h4 className="font-semibold text-[#236383] flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Weekly Breakdown (Next 8 Weeks)
            </h4>
            <div className="grid gap-3">
              {weeklySandwichForecast.map((week, index) => (
                <div key={week.weekKey} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-[#236383]">
                      {week.distributionDate}
                    </div>
                    <div className="text-sm text-[#646464] mt-1">
                      Prep: {week.weekStartDate} • Distribute: {week.weekEndDate}
                    </div>
                    <div className="text-sm text-[#646464]">
                      {week.events.length} group event{week.events.length !== 1 ? 's' : ''} scheduled
                    </div>
                    {week.events.length > 0 && (
                      <div className="text-xs text-[#646464] mt-1 truncate">
                        {week.events.slice(0, 2).map(e => e.organizationName).join(', ')}
                        {week.events.length > 2 && ` +${week.events.length - 2} more`}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold text-[#236383]">
                      {week.totalEstimated.toLocaleString()}
                    </div>
                    <div className="flex gap-1 mt-1">
                      {week.confirmedCount > 0 && (
                        <Badge className="text-xs bg-green-100 text-green-700">
                          {week.confirmedCount.toLocaleString()} confirmed
                        </Badge>
                      )}
                      {week.pendingCount > 0 && (
                        <Badge className="text-xs bg-orange-100 text-orange-700">
                          {week.pendingCount.toLocaleString()} pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {weeklySandwichForecast.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 font-medium">
              📊 Planning Insights
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Peak week: {Math.max(...weeklySandwichForecast.map(w => w.totalEstimated)).toLocaleString()} sandwiches
              • Average per week: {Math.round(totals.total / weeklySandwichForecast.length).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}