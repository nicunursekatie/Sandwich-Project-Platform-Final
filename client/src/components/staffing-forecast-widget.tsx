import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  ChevronRight,
  MapPin
} from 'lucide-react';

import type { EventRequest } from '@shared/schema';
import { logger } from '@/lib/logger';
import { formatEventDate, formatTime12Hour, getSandwichTypesSummary } from '@/components/event-requests/utils';

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

interface StaffingForecastWidgetProps {
  hideHeader?: boolean;
}

export default function StaffingForecastWidget({ hideHeader = false }: StaffingForecastWidgetProps) {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [weekRange, setWeekRange] = useState<'mon-sun' | 'until-collection'>('mon-sun');
  const [includePreviousWeekend, setIncludePreviousWeekend] = useState(false);

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

    // Helper function to get the previous weekend (Saturday and Sunday before Monday)
    const getPreviousWeekend = (monday: Date) => {
      const saturday = new Date(monday);
      saturday.setDate(saturday.getDate() - 2); // 2 days before Monday = Saturday
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() - 1); // 1 day before Monday = Sunday
      return { saturday, sunday };
    };

    // Get current date for filtering events
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

        // Only future events (or past weekend if includePreviousWeekend is enabled)
        if (includePreviousWeekend) {
          // Include events from previous weekend onwards
          const thisWeekMonday = getWeekMonday(today);
          const prevWeekend = getPreviousWeekend(thisWeekMonday);
          const minDate = new Date(prevWeekend.saturday);
          minDate.setHours(0, 0, 0, 0);
          return eventDate >= minDate;
        } else {
          return eventDate >= today;
        }
      } catch (error) {
        return false;
      }
    });

    relevantEvents.forEach((request) => {
      try {
        const eventDate = new Date(request.desiredEventDate!);
        const weekMonday = getWeekMonday(eventDate);
        const weekSunday = getWeekSunday(weekMonday);

        // Determine the end date based on user preference
        const weekEndDate = weekRange === 'until-collection'
          ? getNextWednesday(weekSunday)
          : weekSunday;

        // Handle previous weekend events if enabled
        let useWeekKey = weekMonday.toISOString().split('T')[0];
        let useWeekMonday = weekMonday;
        let useWeekEndDate = weekEndDate;

        if (includePreviousWeekend) {
          // Check if this event is on the previous weekend (Saturday/Sunday before current week's Monday)
          const thisWeekMonday = getWeekMonday(today);
          const prevWeekend = getPreviousWeekend(thisWeekMonday);
          const eventDay = eventDate.getDay();
          
          // If event is on previous weekend, it should belong to this week
          if (eventDay === 6 || eventDay === 0) { // Saturday or Sunday
            const saturdayStr = prevWeekend.saturday.toDateString();
            const sundayStr = prevWeekend.sunday.toDateString();
            const eventDateStr = eventDate.toDateString();
            
            if (eventDateStr === saturdayStr || eventDateStr === sundayStr) {
              // This event is on the previous weekend - assign it to this week
              useWeekMonday = thisWeekMonday;
              useWeekEndDate = weekRange === 'until-collection'
                ? getNextWednesday(getWeekSunday(thisWeekMonday))
                : getWeekSunday(thisWeekMonday);
              useWeekKey = thisWeekMonday.toISOString().split('T')[0];
            }
          }
        }

        // For extended mode (until collection), check if event falls in Mon-Wed of next week
        if (weekRange === 'until-collection') {
          const eventDay = eventDate.getDay();
          if (eventDay >= 1 && eventDay <= 3) { // Mon, Tue, Wed
            // Get the previous week's Monday to check if this event belongs there
            const prevWeekMonday = new Date(weekMonday);
            prevWeekMonday.setDate(prevWeekMonday.getDate() - 7);
            const prevWeekSunday = getWeekSunday(prevWeekMonday);
            const prevWeekWednesday = getNextWednesday(prevWeekSunday);
            
            // Check if this event should belong to the previous week's extended range
            if (eventDate <= prevWeekWednesday && eventDate > prevWeekSunday) {
              // This event belongs to the previous week's extended range
              const useWeekKey = prevWeekMonday.toISOString().split('T')[0];
              const useWeekMonday = prevWeekMonday;
              const useWeekEndDate = prevWeekWednesday;

              if (!weeklyData[useWeekKey]) {
                weeklyData[useWeekKey] = {
                  weekKey: useWeekKey,
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

              const week = weeklyData[useWeekKey];
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

              return; // Skip normal processing
            }
          }
        }

        if (!weeklyData[useWeekKey]) {
          weeklyData[useWeekKey] = {
            weekKey: useWeekKey,
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

        const week = weeklyData[useWeekKey];
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
        logger.warn('Error processing event date:', request.desiredEventDate);
      }
    });

    // Convert to array and sort by week start date
    return Object.values(weeklyData)
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .slice(0, 8); // Show next 8 weeks
  }, [eventRequests, weekRange, includePreviousWeekend]);

  // Reset week index when date range options change
  useEffect(() => {
    setCurrentWeekIndex(0);
  }, [weekRange, includePreviousWeekend]);

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
      <Card className={hideHeader ? "border-0 shadow-none" : "border-2 border-orange-200"}>
        {!hideHeader && (
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
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
              </div>
              <div className="flex flex-col gap-3 items-end ml-4">
                <div className="flex flex-col gap-1 items-end">
                  <label className="text-xs font-medium text-[#646464]">Week Range</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={weekRange === 'mon-sun' ? 'default' : 'outline'}
                      onClick={() => setWeekRange('mon-sun')}
                      className="text-xs h-7"
                    >
                      Mon-Sun
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={weekRange === 'until-collection' ? 'default' : 'outline'}
                      onClick={() => setWeekRange('until-collection')}
                      className="text-xs h-7"
                    >
                      Until Next Collection
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-previous-weekend"
                    checked={includePreviousWeekend}
                    onCheckedChange={(checked) => setIncludePreviousWeekend(checked === true)}
                  />
                  <label
                    htmlFor="include-previous-weekend"
                    className="text-xs font-medium text-[#646464] cursor-pointer"
                  >
                    Include Previous Weekend
                  </label>
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
                {[...currentWeek.events]
                  .sort((a, b) => {
                    // Sort by date (earliest first)
                    const dateA = a.scheduledEventDate || a.desiredEventDate;
                    const dateB = b.scheduledEventDate || b.desiredEventDate;
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    return new Date(dateA).getTime() - new Date(dateB).getTime();
                  })
                  .map((event) => {
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

                  // Get sandwich count
                  const sandwichInfo = getSandwichTypesSummary(event);
                  const sandwichCount = sandwichInfo.total || event.estimatedSandwichCount || 0;

                  return (
                    <div key={event.id} className="bg-white border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-medium text-brand-primary text-lg">
                            {event.organizationName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {(() => {
                              // Use scheduledEventDate first, fall back to desiredEventDate
                              const dateStr = event.scheduledEventDate || event.desiredEventDate;
                              if (!dateStr) return 'Date TBD';
                              const dateInfo = formatEventDate(dateStr.toString());
                              return dateInfo.text || 'Date TBD';
                            })()}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            {event.eventStartTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {formatTime12Hour(event.eventStartTime)}
                              </span>
                            )}
                            {sandwichCount > 0 && (
                              <span className="flex items-center gap-1">
                                🥪 {sandwichCount.toLocaleString()} sandwiches
                              </span>
                            )}
                          </div>
                          {event.eventAddress && (
                            <div className="mt-1">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.eventAddress)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-[#236383] hover:text-[#007E8C] hover:underline"
                              >
                                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="line-clamp-1">{event.eventAddress}</span>
                              </a>
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className={`ml-2 ${totalUnfulfilled === 0 ? 'bg-green-100 text-green-800' : 'text-white'}`}
                          style={totalUnfulfilled > 0 ? { backgroundColor: '#A31C41' } : undefined}
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
                            <Badge variant="outline" className="border-brand-primary-border-strong text-brand-primary bg-brand-primary-lighter">
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