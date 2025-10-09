import { Calendar as CalendarIcon } from 'lucide-react';

export default function GoogleCalendarAvailability() {
  // Extract calendar ID from the cid parameter (base64 decoded)
  const calendarId = '0813cd575e262fbc020927f88f1fd5a1906f5bd9b2f27a66a49202359e5ff4@group.calendar.google.com';
  
  // Create embed URL with calendar ID and timezone
  const embedUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=America/New_York&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=0`;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
            <CalendarIcon className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              TSP Volunteer Availability
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Live view of team member availability calendar
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Container */}
      <div className="flex-1 p-4 sm:p-6 overflow-hidden">
        <div className="h-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            frameBorder="0"
            scrolling="yes"
            title="TSP Volunteer Availability Calendar"
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <CalendarIcon className="h-4 w-4" />
          <span>This calendar displays real-time volunteer availability from Google Calendar</span>
        </div>
      </div>
    </div>
  );
}