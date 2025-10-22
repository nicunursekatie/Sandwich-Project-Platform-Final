import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

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
  backgroundColor?: string;
  foregroundColor?: string;
}

export default function GoogleCalendarAvailability() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate month boundaries
  const monthStart = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return date;
  }, [currentDate]);

  const monthEnd = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return date;
  }, [currentDate]);

  // Fetch events for the current month
  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/google-calendar/events', monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: async () => {
      return apiRequest('GET', `/api/google-calendar/events?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`);
    },
  });

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days = [];
    const firstDayOfMonth = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    // Previous month's trailing days
    const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    const prevMonthDays = prevMonthEnd.getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
        isCurrentMonth: true,
      });
    }

    // Next month's leading days
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate, monthStart, monthEnd]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = event.start.date || event.start.dateTime?.split('T')[0];
      const dayStr = date.toISOString().split('T')[0];
      return eventDate?.startsWith(dayStr);
    });
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date().toDateString();

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                TSP Volunteer Availability
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Live view with event colors from Google Calendar
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[150px] text-center">
              {monthYear}
            </span>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDay(day.date);
              const isToday = day.date.toDateString() === today;

              return (
                <div
                  key={index}
                  className={`min-h-[120px] border-r border-b border-slate-200 dark:border-slate-700 p-2 ${
                    !day.isCurrentMonth ? 'bg-slate-50 dark:bg-slate-900' : ''
                  } ${isToday ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                >
                  <div className={`text-sm mb-1 ${
                    !day.isCurrentMonth ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                  } ${isToday ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                    {day.date.getDate()}
                  </div>

                  {/* Events for this day */}
                  <div className="space-y-1">
                    {dayEvents.map((event, eventIndex) => (
                      <div
                        key={event.id || eventIndex}
                        className="text-xs px-2 py-1 rounded truncate"
                        style={{
                          backgroundColor: event.backgroundColor || '#a4bdfc',
                          color: event.foregroundColor || '#1d1d1d',
                        }}
                        title={`${event.summary}${event.description ? '\n' + event.description : ''}`}
                      >
                        {event.summary}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {isLoading ? 'Loading events...' : `Showing ${events.length} events with their original Google Calendar colors`}
          </span>
        </div>
      </div>
    </div>
  );
}
