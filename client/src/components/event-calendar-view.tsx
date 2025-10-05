import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Car,
  Mic,
  UserCheck,
  Sandwich,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventRequest } from '@shared/schema';

interface EventCalendarViewProps {
  onEventClick?: (event: EventRequest) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new':
      return 'bg-brand-primary-light text-brand-primary-dark border-brand-primary-border-strong';
    case 'in_process':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'scheduled':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'completed':
      return 'bg-navy-100 text-navy-800 border-navy-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

// Helper function to get staffing indicators for an event
const getStaffingIndicators = (event: EventRequest) => {
  const indicators = [];

  if (event.driversNeeded && event.driversNeeded > 0) {
    indicators.push({
      icon: Car,
      count: event.driversNeeded,
      color: 'text-blue-600',
      tooltip: `${event.driversNeeded} driver${event.driversNeeded > 1 ? 's' : ''} needed`,
    });
  }

  if (event.speakersNeeded && event.speakersNeeded > 0) {
    indicators.push({
      icon: Mic,
      count: event.speakersNeeded,
      color: 'text-purple-600',
      tooltip: `${event.speakersNeeded} speaker${event.speakersNeeded > 1 ? 's' : ''} needed`,
    });
  }

  if (event.volunteersNeeded && event.volunteersNeeded > 0) {
    indicators.push({
      icon: UserCheck,
      count: event.volunteersNeeded,
      color: 'text-green-600',
      tooltip: `${event.volunteersNeeded} volunteer${event.volunteersNeeded > 1 ? 's' : ''} needed`,
    });
  }

  return indicators;
};

// Helper function to get sandwich information for an event
const getSandwichInfo = (event: EventRequest) => {
  const sandwichInfo = [];

  // Check for estimated sandwich count
  if (event.estimatedSandwichCount && event.estimatedSandwichCount > 0) {
    sandwichInfo.push({
      icon: Sandwich,
      count: event.estimatedSandwichCount,
      color: 'text-[#fbad3f]',
      tooltip: `${event.estimatedSandwichCount} sandwiches estimated`,
    });
  }

  // Check for actual sandwich count (for completed events)
  if (event.actualSandwichCount && event.actualSandwichCount > 0) {
    sandwichInfo.push({
      icon: Sandwich,
      count: event.actualSandwichCount,
      color: 'text-[#fbad3f]',
      tooltip: `${event.actualSandwichCount} sandwiches delivered`,
    });
  }

  // Check for sandwich types (if available)
  if (
    event.sandwichTypes &&
    Array.isArray(event.sandwichTypes) &&
    event.sandwichTypes.length > 0
  ) {
    const typesText = event.sandwichTypes
      .map((type) => `${type.quantity} ${type.type}`)
      .join(', ');
    sandwichInfo.push({
      icon: Sandwich,
      count: null,
      color: 'text-[#fbad3f]',
      tooltip: `Types: ${typesText}`,
      showTypes: true,
      types: event.sandwichTypes,
    });
  }

  return sandwichInfo;
};

export function EventCalendarView({ onEventClick }: EventCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch all event requests
  const { data: events = [] } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
  });

  // Get the first and last day of the current month
  const firstDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const lastDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  }, [currentDate]);

  // Calculate calendar grid (including days from previous/next month)
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const startDay = firstDayOfMonth.getDay(); // 0 = Sunday

    // Add days from previous month
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(firstDayOfMonth);
      date.setDate(date.getDate() - (i + 1));
      days.push(date);
    }

    // Add days from current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows x 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(lastDayOfMonth);
      date.setDate(date.getDate() + i);
      days.push(date);
    }

    return days;
  }, [firstDayOfMonth, lastDayOfMonth, currentDate]);

  // Group events by date, filtering out cancelled/declined/postponed events
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, EventRequest[]>();

    events.forEach((event) => {
      // Filter out cancelled, declined, and postponed events
      if (
        event.status === 'cancelled' ||
        event.status === 'declined' ||
        event.status === 'postponed'
      ) {
        return;
      }

      // Use scheduledEventDate if available, otherwise use desiredEventDate
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      if (!eventDate) return;

      const dateStr = new Date(eventDate).toISOString().split('T')[0];
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, []);
      }
      grouped.get(dateStr)!.push(event);
    });

    return grouped;
  }, [events]);

  const goToPreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Event Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-[200px] text-center font-semibold">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="p-2 text-center font-semibold text-sm text-gray-600 bg-gray-50 rounded"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((date, index) => {
            const dateKey = getDateKey(date);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentMonthDay = isCurrentMonth(date);
            const isTodayDay = isToday(date);

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[120px] border rounded-lg p-2',
                  isCurrentMonthDay
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50 border-gray-100',
                  isTodayDay && 'ring-2 ring-blue-500'
                )}
              >
                {/* Date number */}
                <div
                  className={cn(
                    'text-sm font-medium mb-1',
                    isCurrentMonthDay ? 'text-gray-900' : 'text-gray-400',
                    isTodayDay &&
                      'bg-brand-primary-lighter0 text-white rounded-full w-6 h-6 flex items-center justify-center'
                  )}
                >
                  {date.getDate()}
                </div>

                {/* Events for this day */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    const staffingIndicators = getStaffingIndicators(event);
                    const sandwichInfo = getSandwichInfo(event);

                    return (
                      <button
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className={cn(
                          'w-full text-left text-xs p-1 rounded border truncate hover:shadow-md transition-shadow',
                          getStatusColor(event.status)
                        )}
                        title={`${event.organizationName} - ${event.status}`}
                      >
                        <div className="font-medium truncate">
                          {event.organizationName}
                        </div>

                        {/* Staffing indicators row */}
                        {staffingIndicators.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {staffingIndicators.map((indicator, idx) => {
                              const IconComponent = indicator.icon;
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    'flex items-center',
                                    indicator.color
                                  )}
                                  title={indicator.tooltip}
                                >
                                  <IconComponent className="w-2.5 h-2.5" />
                                  {indicator.count > 1 && (
                                    <span className="text-[9px] ml-0.5 font-medium">
                                      {indicator.count}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Sandwich information row */}
                        {sandwichInfo.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {sandwichInfo.map((info, idx) => {
                              const IconComponent = info.icon;
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    'flex items-center',
                                    info.color
                                  )}
                                  title={info.tooltip}
                                >
                                  <IconComponent className="w-2.5 h-2.5" />
                                  {info.count && (
                                    <span className="text-[9px] ml-0.5 font-medium">
                                      {info.count}
                                    </span>
                                  )}
                                  {info.showTypes && (
                                    <span className="text-[8px] ml-0.5 opacity-75 truncate max-w-[60px]">
                                      {info.types.map((t) => t.type).join(', ')}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {event.eventStartTime && (
                          <div className="text-[10px] opacity-75 mt-0.5">
                            {event.eventStartTime}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t space-y-4">
          {/* Status Legend */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <Badge className="bg-brand-primary-light text-brand-primary-dark border-brand-primary-border-strong">
              New
            </Badge>
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
              In Process
            </Badge>
            <Badge className="bg-green-100 text-green-800 border-green-300">
              Scheduled
            </Badge>
            <Badge className="bg-navy-100 text-navy-800 border-navy-300">
              Completed
            </Badge>
            <Badge className="bg-red-100 text-red-800 border-red-300">
              Cancelled
            </Badge>
          </div>

          {/* Staffing Indicators Legend */}
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-gray-700">
              Staffing Needed:
            </span>
            <div className="flex items-center gap-1">
              <Car className="w-3 h-3 text-blue-600" />
              <span className="text-xs text-gray-600">Drivers</span>
            </div>
            <div className="flex items-center gap-1">
              <Mic className="w-3 h-3 text-purple-600" />
              <span className="text-xs text-gray-600">Speakers</span>
            </div>
            <div className="flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-600">Volunteers</span>
            </div>
          </div>

          {/* Sandwich Information Legend */}
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-gray-700">
              Sandwiches:
            </span>
            <div className="flex items-center gap-1">
              <Sandwich className="w-3 h-3 text-[#fbad3f]" />
              <span className="text-xs text-gray-600">Count & Types</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
