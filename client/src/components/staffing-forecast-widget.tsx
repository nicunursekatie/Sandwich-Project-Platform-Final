import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Truck,
  UserCheck,
  Megaphone,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import type { EventRequest } from '@shared/schema';

interface WeeklyStaffing {
  weekKey: string;
  weekStartDate: string;
  weekEndDate: string;
  distributionDate: string;
  events: EventRequest[];
  totalDriversNeeded: number;
  totalSpeakersNeeded: number;
  totalVolunteersNeeded: number;
  totalVanDriversNeeded: number;
  driversAssigned: number;
  speakersAssigned: number;
  volunteersAssigned: number;
  vanDriversAssigned: number;
  unfulfilled: {
    drivers: number;
    speakers: number;
    volunteers: number;
    vanDrivers: number;
  };
}

export default function StaffingForecastWidget() {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  const { data: eventRequests, isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests/all'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests?all=true');
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
  });

  // Weekly staffing forecast calculator
  const weeklyStaffingForecast = useMemo(() => {
    if (!eventRequests) return [];

    const weeklyData: Record<string, WeeklyStaffing> = {};

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

    // Process events that need staffing (future scheduled/in-process events only)
    const relevantEvents = eventRequests.filter((request) => {
      if (!request.desiredEventDate) return false;

      // Only include events that need staffing
      const needsStaffing = 
        (request.driversNeeded && request.driversNeeded > 0) ||
        (request.speakersNeeded && request.speakersNeeded > 0) ||
        (request.volunteersNeeded && request.volunteersNeeded > 0) ||
        request.vanDriverNeeded;

      if (!needsStaffing) return false;

      // Only include scheduled or in-process events
      if (!['in_process', 'scheduled'].includes(request.status)) {
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
            weekKey,
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
            totalDriversNeeded: 0,
            totalSpeakersNeeded: 0,
            totalVolunteersNeeded: 0,
            totalVanDriversNeeded: 0,
            driversAssigned: 0,
            speakersAssigned: 0,
            volunteersAssigned: 0,
            vanDriversAssigned: 0,
            unfulfilled: {
              drivers: 0,
              speakers: 0,
              volunteers: 0,
              vanDrivers: 0,
            }
          };
        }

        const week = weeklyData[weekKey];
        week.events.push(request);

        // Calculate staffing needs
        const driversNeeded = request.driversNeeded || 0;
        const speakersNeeded = request.speakersNeeded || 0;
        const volunteersNeeded = request.volunteersNeeded || 0;
        const vanDriversNeeded = request.vanDriverNeeded ? 1 : 0;

        const driversAssigned = request.assignedDriverIds?.length || 0;
        const speakersAssigned = request.assignedSpeakerIds?.length || 0;
        const volunteersAssigned = request.assignedVolunteerIds?.length || 0;
        const vanDriversAssigned = request.assignedVanDriverId ? 1 : 0;

        week.totalDriversNeeded += driversNeeded;
        week.totalSpeakersNeeded += speakersNeeded;
        week.totalVolunteersNeeded += volunteersNeeded;
        week.totalVanDriversNeeded += vanDriversNeeded;

        week.driversAssigned += driversAssigned;
        week.speakersAssigned += speakersAssigned;
        week.volunteersAssigned += volunteersAssigned;
        week.vanDriversAssigned += vanDriversAssigned;

        // Calculate unfulfilled positions
        week.unfulfilled.drivers += Math.max(0, driversNeeded - driversAssigned);
        week.unfulfilled.speakers += Math.max(0, speakersNeeded - speakersAssigned);
        week.unfulfilled.volunteers += Math.max(0, volunteersNeeded - volunteersAssigned);
        week.unfulfilled.vanDrivers += Math.max(0, vanDriversNeeded - vanDriversAssigned);

      } catch (error) {
        console.warn('Error processing event date:', request.desiredEventDate);
      }
    });

    // Convert to array and sort by week start date
    return Object.values(weeklyData)
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .slice(0, 8); // Show next 8 weeks
  }, [eventRequests]);

  // Only show one week at a time
  const currentWeek = weeklyStaffingForecast[currentWeekIndex] || null;

  const getTotalUnfulfilled = (week: WeeklyStaffing) => {
    return week.unfulfilled.drivers + week.unfulfilled.speakers + 
           week.unfulfilled.volunteers + week.unfulfilled.vanDrivers;
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-brand-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-primary flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staffing Forecast
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
    <TooltipProvider>
      <Card className="border-2 border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-orange flex items-center gap-2">
            <Users className="h-5 w-5" />
            Weekly Staffing Planning
          </CardTitle>
          <p className="text-sm text-[#646464] mt-1">
            Track driver, speaker, and volunteer needs for upcoming events requiring staffing.
          </p>
          <p className="text-xs text-brand-orange mt-1 font-medium">
            👥 Focus on scheduled events that need volunteers
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
              data-testid="button-previous-week"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="font-bold text-lg text-brand-primary">
              {currentWeek?.distributionDate || 'No week selected'}
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentWeekIndex(i => Math.min(weeklyStaffingForecast.length - 1, i + 1))}
              disabled={currentWeekIndex === weeklyStaffingForecast.length - 1}
              style={{ color: '#236383', borderColor: '#236383' }}
              data-testid="button-next-week"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {currentWeek ? (
            <div className="space-y-4">
              {/* Staffing Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Drivers */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Truck className="w-5 h-5 text-red-600" />
                    <Badge 
                      variant={currentWeek.unfulfilled.drivers > 0 ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {currentWeek.unfulfilled.drivers > 0 ? 'NEEDED' : 'FILLED'}
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-red-800">
                    {currentWeek.driversAssigned}/{currentWeek.totalDriversNeeded}
                  </div>
                  <div className="text-xs text-red-600">Drivers</div>
                  {currentWeek.unfulfilled.drivers > 0 && (
                    <div className="text-xs font-medium text-red-700 mt-1">
                      {currentWeek.unfulfilled.drivers} still needed
                    </div>
                  )}
                </div>

                {/* Speakers */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Megaphone className="w-5 h-5 text-yellow-600" />
                    <Badge 
                      variant={currentWeek.unfulfilled.speakers > 0 ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {currentWeek.unfulfilled.speakers > 0 ? 'NEEDED' : 'FILLED'}
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-yellow-800">
                    {currentWeek.speakersAssigned}/{currentWeek.totalSpeakersNeeded}
                  </div>
                  <div className="text-xs text-yellow-600">Speakers</div>
                  {currentWeek.unfulfilled.speakers > 0 && (
                    <div className="text-xs font-medium text-yellow-700 mt-1">
                      {currentWeek.unfulfilled.speakers} still needed
                    </div>
                  )}
                </div>

                {/* Volunteers */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <UserCheck className="w-5 h-5 text-blue-600" />
                    <Badge 
                      variant={currentWeek.unfulfilled.volunteers > 0 ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {currentWeek.unfulfilled.volunteers > 0 ? 'NEEDED' : 'FILLED'}
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-blue-800">
                    {currentWeek.volunteersAssigned}/{currentWeek.totalVolunteersNeeded}
                  </div>
                  <div className="text-xs text-blue-600">Volunteers</div>
                  {currentWeek.unfulfilled.volunteers > 0 && (
                    <div className="text-xs font-medium text-blue-700 mt-1">
                      {currentWeek.unfulfilled.volunteers} still needed
                    </div>
                  )}
                </div>

                {/* Van Drivers */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <Badge 
                      variant={currentWeek.unfulfilled.vanDrivers > 0 ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {currentWeek.unfulfilled.vanDrivers > 0 ? 'NEEDED' : 'FILLED'}
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-purple-800">
                    {currentWeek.vanDriversAssigned}/{currentWeek.totalVanDriversNeeded}
                  </div>
                  <div className="text-xs text-purple-600">Van Drivers</div>
                  {currentWeek.unfulfilled.vanDrivers > 0 && (
                    <div className="text-xs font-medium text-purple-700 mt-1">
                      {currentWeek.unfulfilled.vanDrivers} still needed
                    </div>
                  )}
                </div>
              </div>

              {/* Overall Status */}
              <div className={`rounded-lg p-4 border-2 ${
                getTotalUnfulfilled(currentWeek) === 0 
                  ? 'bg-green-50 border-green-300 text-green-800' 
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}>
                <div className="flex items-center space-x-2">
                  {getTotalUnfulfilled(currentWeek) === 0 ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold">All positions filled for this week!</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold">
                        {getTotalUnfulfilled(currentWeek)} total positions still needed
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Events List */}
              <div className="space-y-3">
                <h4 className="font-semibold text-brand-primary">Events Requiring Staffing:</h4>
                {currentWeek.events.map((event) => {
                  const eventUnfulfilled = 
                    Math.max(0, (event.driversNeeded || 0) - (event.assignedDriverIds?.length || 0)) +
                    Math.max(0, (event.speakersNeeded || 0) - (event.assignedSpeakerIds?.length || 0)) +
                    Math.max(0, (event.volunteersNeeded || 0) - (event.assignedVolunteerIds?.length || 0)) +
                    Math.max(0, (event.vanDriverNeeded ? 1 : 0) - (event.assignedVanDriverId ? 1 : 0));

                  return (
                    <div key={event.id} className="bg-white border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-brand-primary">
                            {event.organizationName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(event.desiredEventDate!).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                        <Badge 
                          variant={eventUnfulfilled === 0 ? "secondary" : "destructive"}
                          className="ml-2"
                          data-testid={`badge-event-${event.id}-staffing`}
                        >
                          {eventUnfulfilled === 0 ? 'Fully Staffed' : `${eventUnfulfilled} needed`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No upcoming events requiring staffing</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}