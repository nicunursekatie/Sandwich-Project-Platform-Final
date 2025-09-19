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
                  // Helper function to safely get array length for PostgreSQL arrays
                  const getAssignmentCount = (assignments: any) => {
                    if (!assignments) return 0;
                    
                    // If it's already a JavaScript array
                    if (Array.isArray(assignments)) {
                      return assignments.length;
                    }
                    
                    // If it's a string (PostgreSQL array format like "{item1,item2}" or '{"item1","item2"}')
                    if (typeof assignments === 'string') {
                      // Empty PostgreSQL array
                      if (assignments === '{}' || assignments === '') return 0;
                      
                      // Remove curly braces and handle quoted strings
                      let cleaned = assignments.replace(/^{|}$/g, '');
                      
                      if (!cleaned) return 0;
                      
                      // Handle quoted elements like "Andy Hiles","Barbara Bancroft"
                      if (cleaned.includes('"')) {
                        // Split by comma but handle quoted strings properly
                        const matches = cleaned.match(/"[^"]*"|[^",]+/g);
                        return matches ? matches.filter(item => item.trim()).length : 0;
                      } else {
                        // Simple comma-separated values
                        return cleaned.split(',').filter(item => item.trim()).length;
                      }
                    }
                    
                    // Fallback: if it's an object, check if it has length property
                    if (typeof assignments === 'object' && assignments.length !== undefined) {
                      return assignments.length;
                    }
                    
                    return 0;
                  };

                  const driversNeeded = Math.max(0, (event.driversNeeded || 0) - getAssignmentCount(event.assignedDriverIds));
                  const speakersNeeded = Math.max(0, (event.speakersNeeded || 0) - getAssignmentCount(event.assignedSpeakerIds));
                  const volunteersNeeded = Math.max(0, (event.volunteersNeeded || 0) - getAssignmentCount(event.assignedVolunteerIds));
                  const vanDriverNeeded = Math.max(0, (event.vanDriverNeeded ? 1 : 0) - (event.assignedVanDriverId ? 1 : 0));
                  const totalUnfulfilled = driversNeeded + speakersNeeded + volunteersNeeded + vanDriverNeeded;

                  return (
                    <div key={event.id} className="bg-white border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-medium text-brand-primary text-lg">
                            {event.organizationName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {(() => {
                              const date = new Date(event.desiredEventDate!);
                              // Add timezone offset to ensure local date interpretation
                              const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
                              return localDate.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              });
                            })()}
                          </div>
                        </div>
                        <Badge 
                          variant={totalUnfulfilled === 0 ? "secondary" : "destructive"}
                          className="ml-2"
                          data-testid={`badge-event-${event.id}-staffing`}
                        >
                          {totalUnfulfilled === 0 ? 'Fully Staffed' : `${totalUnfulfilled} needed`}
                        </Badge>
                      </div>
                      
                      {/* Show specific unfilled roles */}
                      {totalUnfulfilled > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {driversNeeded > 0 && (
                            <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                              <Truck className="w-3 h-3 mr-1" />
                              {driversNeeded} Driver{driversNeeded > 1 ? 's' : ''} needed
                            </Badge>
                          )}
                          {speakersNeeded > 0 && (
                            <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">
                              <Megaphone className="w-3 h-3 mr-1" />
                              {speakersNeeded} Speaker{speakersNeeded > 1 ? 's' : ''} needed
                            </Badge>
                          )}
                          {volunteersNeeded > 0 && (
                            <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                              <UserCheck className="w-3 h-3 mr-1" />
                              {volunteersNeeded} Volunteer{volunteersNeeded > 1 ? 's' : ''} needed
                            </Badge>
                          )}
                          {vanDriverNeeded > 0 && (
                            <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
                              <Users className="w-3 h-3 mr-1" />
                              Van Driver needed
                            </Badge>
                          )}
                        </div>
                      )}
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