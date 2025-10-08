import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  status?: string;
}

export default function GoogleCalendarAvailability() {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const handleBack = () => {
    window.location.href = '/dashboard';
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 }); // Saturday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch calendar events
  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/google-calendar/events', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
      });
      const response = await fetch(`/api/google-calendar/events?${params}`);
      if (!response.ok) throw new Error('Failed to fetch calendar events');
      return response.json();
    },
  });

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventDate = event.start.dateTime ? parseISO(event.start.dateTime) : parseISO(event.start.date!);
      return isSameDay(eventDate, day);
    });
  };

  if (isLoading) {
    return <LoadingState text="Loading calendar..." size="lg" />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4"
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
            <CalendarIcon className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Volunteer Calendar
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Team member availability from Google Calendar
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Container */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <Card className="p-6">
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                data-testid="button-previous-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(new Date())}
                data-testid="button-current-week"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                data-testid="button-next-week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekly Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`border rounded-lg p-3 min-h-[150px] ${
                    isToday ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200'
                  }`}
                  data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                >
                  <div className={`font-semibold text-sm mb-2 ${
                    isToday ? 'text-brand-primary' : 'text-gray-900'
                  }`}>
                    {format(day, 'EEE')}
                    <div className="text-xs text-gray-500">{format(day, 'MMM dd')}</div>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map((event) => {
                      const startTime = event.start.dateTime
                        ? format(parseISO(event.start.dateTime), 'h:mm a')
                        : 'All day';

                      return (
                        <div
                          key={event.id}
                          className="text-xs p-2 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                          data-testid={`event-${event.id}`}
                        >
                          <div className="font-medium truncate">{event.summary}</div>
                          <div className="text-xs opacity-75">{startTime}</div>
                        </div>
                      );
                    })}
                    {dayEvents.length === 0 && (
                      <div className="text-xs text-gray-400 italic">No events</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <CalendarIcon className="h-4 w-4" />
          <span>Showing {events.length} event{events.length !== 1 ? 's' : ''} this week</span>
        </div>
      </div>
    </div>
  );
}
