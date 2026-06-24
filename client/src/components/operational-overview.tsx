import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Car,
  Mic2,
  Users,
  CheckCircle2,
  ArrowRight,
  Clock,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { format, isValid, formatDistanceToNowStrict } from 'date-fns';
import { parseDateOnly } from '@shared/date-utils';

interface UpcomingDeadline {
  id: number;
  organizationName: string;
  eventDate: string;
  status: string;
  needsDriver: boolean;
  needsSpeaker: boolean;
  needsVolunteer: boolean;
  isToday: boolean;
}

interface MyAssignmentItem {
  id: number;
  organizationName: string | null;
  status: string | null;
  eventDate: string | null;
  lastContactAttempt: string | null;
}

interface MyAssignments {
  total: number;
  newRequestsCount: number;
  inProcessStaleCount: number;
  byStatus: {
    new: number;
    in_process: number;
    scheduled: number;
    rescheduled: number;
  };
  newRequests: MyAssignmentItem[];
  inProcessStale: MyAssignmentItem[];
  allMyEvents: MyAssignmentItem[];
}

interface OperationalStats {
  thisWeekEventsCount: number;
  eventsNeedingDrivers: number;
  eventsNeedingSpeakers: number;
  eventsNeedingVolunteers: number;
  totalDriversNeeded: number;
  totalSpeakersNeeded: number;
  totalVolunteersNeeded: number;
  lastWeekCompletionRate: number | null;
  lastWeekCompleted: number;
  lastWeekTotal: number;
  upcomingDeadlines: UpcomingDeadline[];
  todayEventsCount: number;
  tomorrowEventsCount: number;
  activeEventsCount: number;
  statusCounts: {
    new: number;
    in_process: number;
    scheduled: number;
    rescheduled: number;
  };
  /** When the logged-in user has TSP-contact assignments, server returns
      this personalized snapshot. Null when no assignments (or user is not
      logged in). */
  myAssignments?: MyAssignments | null;
}

interface OperationalOverviewProps {
  onNavigate: (section: string) => void;
}

/**
 * Personalized snapshot rendered in place of the generic overview when the
 * current user has TSP-contact assignments. Layout priority (top → bottom):
 *   1. New requests assigned to me (highest urgency — needs first contact)
 *   2. In-process events with no contact in the last 7 days (stale)
 *   3. Full assignment breakdown by status (snapshot)
 *   4. List of every assigned event with status + last-contact freshness
 */
function MyAssignmentsView({
  my,
  onNavigate,
  drillToEvents,
}: {
  my: MyAssignments;
  onNavigate: (section: string) => void;
  drillToEvents: (tab: string, filter?: string) => void;
}) {
  const formatEventDate = (dateString: string | null) => {
    if (!dateString) return 'Date TBD';
    try {
      const date = parseDateOnly(dateString);
      return date && isValid(date) ? format(date, 'EEE, MMM d') : 'Date TBD';
    } catch {
      return 'Date TBD';
    }
  };

  // Human-friendly "X days ago" for last contact, or "never" when null.
  const formatLastContact = (ts: string | null): string => {
    if (!ts) return 'never';
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return 'never';
      return `${formatDistanceToNowStrict(d)} ago`;
    } catch {
      return 'never';
    }
  };

  // Per-status pill styling — matches the brand semantics already used elsewhere.
  const statusStyle: Record<string, string> = {
    new: 'bg-[#FBAD3F]/15 text-[#B8860B] border-[#FBAD3F]/40',
    in_process: 'bg-[#47B3CB]/15 text-[#236383] border-[#47B3CB]/40',
    scheduled: 'bg-[#007E8C]/15 text-[#007E8C] border-[#007E8C]/40',
    rescheduled: 'bg-[#007E8C]/15 text-[#007E8C] border-[#007E8C]/40',
  };
  const statusLabel: Record<string, string> = {
    new: 'New',
    in_process: 'In Process',
    scheduled: 'Scheduled',
    rescheduled: 'Rescheduled',
  };

  return (
    <div className="mx-4 mb-8">
      <div className="premium-card-elevated p-6" style={{ borderTop: '4px solid #007E8C' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-teal rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="premium-text-h4 text-brand-primary">My Assignments</h3>
              <p className="premium-text-body-sm text-gray-600">
                {my.total} {my.total === 1 ? 'event' : 'events'} you're the TSP contact for
              </p>
            </div>
          </div>
          {(my.newRequestsCount > 0 || my.inProcessStaleCount > 0) && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertCircle className="w-3 h-3 mr-1" />
              Needs Action
            </Badge>
          )}
        </div>

        {/* PRIORITY 1: New requests assigned to me — first contact owed */}
        {my.newRequests.length > 0 && (
          <div className="mb-6 rounded-lg border border-[#FBAD3F]/40 bg-[#FBAD3F]/[0.04] p-4">
            <h4 className="text-sm font-semibold text-[#B8860B] mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              {my.newRequests.length === 1 ? 'New request' : `${my.newRequests.length} new requests`} assigned to you
              <span className="text-xs font-normal text-[#B8860B]/80">
                — make first contact
              </span>
            </h4>
            <div className="space-y-2">
              {my.newRequests.slice(0, 5).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onNavigate('event-requests')}
                  className="w-full text-left p-3 rounded-md bg-white border border-[#FBAD3F]/30 hover:border-[#FBAD3F] hover:bg-[#FBAD3F]/5 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">
                      {e.organizationName || 'Untitled organization'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {formatEventDate(e.eventDate)}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#B8860B] shrink-0" />
                </button>
              ))}
              {my.newRequests.length > 5 && (
                <div className="text-xs text-[#B8860B]/80 pl-3">
                  + {my.newRequests.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRIORITY 2: In-process events with no contact in the last 7 days */}
        {my.inProcessStale.length > 0 && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50/60 p-4">
            <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {my.inProcessStale.length === 1
                ? 'In-process event needs follow-up'
                : `${my.inProcessStale.length} in-process events need follow-up`}
              <span className="text-xs font-normal text-amber-700">
                — no contact in 7+ days
              </span>
            </h4>
            <div className="space-y-2">
              {my.inProcessStale.slice(0, 5).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onNavigate('event-requests')}
                  className="w-full text-left p-3 rounded-md bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">
                      {e.organizationName || 'Untitled organization'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      Last contacted {formatLastContact(e.lastContactAttempt)}
                      {e.eventDate && ` · event ${formatEventDate(e.eventDate)}`}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-700 shrink-0" />
                </button>
              ))}
              {my.inProcessStale.length > 5 && (
                <div className="text-xs text-amber-700 pl-3">
                  + {my.inProcessStale.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRIORITY 3: Status breakdown at a glance */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Your assignments by status
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(['new', 'in_process', 'scheduled', 'rescheduled'] as const).map((key) => {
              const count = my.byStatus[key];
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => drillToEvents(key)}
                  className={`px-3 py-2 rounded-md border text-left transition-all hover:shadow-sm ${statusStyle[key]}`}
                >
                  <div className="text-2xl font-bold leading-none">{count}</div>
                  <div className="text-xs font-medium mt-0.5">{statusLabel[key]}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PRIORITY 4: Full list of every assigned event (collapsed by default
            for tidiness — when total ≤ 8 just show them all; otherwise show
            the top 8 with a link to the full list). */}
        {my.allMyEvents.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              All your events
            </h4>
            <div className="space-y-1.5">
              {my.allMyEvents.slice(0, 8).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onNavigate('event-requests')}
                  className="w-full text-left px-3 py-2 rounded-md bg-white border border-gray-200 hover:border-brand-primary hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${statusStyle[e.status || ''] || 'bg-gray-100 text-gray-700 border-gray-300'}`}
                    >
                      {statusLabel[e.status || ''] || e.status}
                    </span>
                    <span className="font-medium text-gray-900 truncate">
                      {e.organizationName || 'Untitled organization'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {formatEventDate(e.eventDate)}
                  </span>
                </button>
              ))}
              {my.allMyEvents.length > 8 && (
                <button
                  type="button"
                  onClick={() => onNavigate('event-requests')}
                  className="w-full text-center text-sm text-brand-primary hover:underline py-2"
                >
                  View all {my.allMyEvents.length} of your events →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => onNavigate('event-requests')}
            className="bg-brand-primary hover:bg-brand-primary-dark"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Open Event Requests
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('volunteer-hub')}
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
          >
            <Users className="w-4 h-4 mr-2" />
            Volunteer Hub
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OperationalOverview({ onNavigate }: OperationalOverviewProps) {
  const { data: stats, isLoading, error } = useQuery<OperationalStats>({
    queryKey: ['/api/event-requests/operational-stats'],
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
  });

  const formatDate = (dateString: string) => {
    try {
      const date = parseDateOnly(dateString);
      return date && isValid(date) ? format(date, 'EEE, MMM d') : '';
    } catch {
      return '';
    }
  };

  // Drill down into the filtered Event Requests view. We stash the target tab
  // + quick filter in sessionStorage (read on mount by EventRequestContext)
  // then navigate. The tiles drill in via the "all" tab so the opened list
  // spans every active stage and its total exactly matches the tile count
  // (which /operational-stats computes across all active statuses). (There is
  // no needsSpeaker quick filter, so the speakers card just opens the list.)
  const drillToEvents = (tab: string, filter?: string) => {
    try {
      sessionStorage.setItem('eventRequests.pendingFilter', JSON.stringify({ tab, filter }));
    } catch {
      // ignore unavailable sessionStorage
    }
    onNavigate('event-requests');
  };

  if (error) {
    return null; // Silently fail if user doesn't have permission
  }

  if (isLoading) {
    return (
      <div className="mx-4 mb-8">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Personalized snapshot takes priority for users with TSP-contact
  // assignments — they need to see THEIR events, not the global view. Users
  // with no assignments fall through to the existing generic overview below.
  if (stats.myAssignments && stats.myAssignments.total > 0) {
    return (
      <MyAssignmentsView
        my={stats.myAssignments}
        onNavigate={onNavigate}
        drillToEvents={drillToEvents}
      />
    );
  }

  // Check if there are urgent items: events today that still need staffing
  const hasUrgentItems = stats.upcomingDeadlines.some(
    d => d.isToday && (d.needsDriver || d.needsSpeaker || d.needsVolunteer)
  );

  return (
    <div className="mx-4 mb-8">
      <div className="premium-card-elevated p-6" style={{ borderTop: '4px solid #007E8C' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-teal rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="premium-text-h4 text-brand-primary">Operational Overview</h3>
              <p className="premium-text-body-sm text-gray-600">What needs attention right now</p>
            </div>
          </div>
          {hasUrgentItems && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertCircle className="w-3 h-3 mr-1" />
              Attention Needed
            </Badge>
          )}
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* This Week's Events */}
          <div
            className="bg-white rounded-lg p-4 border border-gray-200 hover:border-brand-primary cursor-pointer transition-all"
            onClick={() => drillToEvents('all', 'week')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-brand-primary" />
              <span className="text-sm font-medium text-gray-600">This Week</span>
            </div>
            <div className="text-2xl font-bold text-brand-primary">{stats.thisWeekEventsCount}</div>
            <div className="text-xs text-gray-500">events scheduled</div>
          </div>

          {/* Events Needing Drivers */}
          <div
            className={`bg-white rounded-lg p-4 border cursor-pointer transition-all ${
              stats.eventsNeedingDrivers > 0
                ? 'border-red-300 hover:border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-brand-primary'
            }`}
            onClick={() => drillToEvents('all', 'needsDriver')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Car className={`w-5 h-5 ${stats.eventsNeedingDrivers > 0 ? 'text-red-500' : 'text-brand-orange'}`} />
              <span className="text-sm font-medium text-gray-600">Need Drivers</span>
            </div>
            <div className={`text-2xl font-bold ${stats.eventsNeedingDrivers > 0 ? 'text-red-600' : 'text-brand-orange'}`}>
              {stats.eventsNeedingDrivers}
            </div>
            <div className="text-xs text-gray-500">events</div>
          </div>

          {/* Events Needing Speakers */}
          <div
            className={`bg-white rounded-lg p-4 border cursor-pointer transition-all ${
              stats.eventsNeedingSpeakers > 0
                ? 'border-amber-300 hover:border-amber-500 bg-amber-50'
                : 'border-gray-200 hover:border-brand-primary'
            }`}
            onClick={() => drillToEvents('all')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Mic2 className={`w-5 h-5 ${stats.eventsNeedingSpeakers > 0 ? 'text-amber-500' : 'text-brand-light-blue'}`} />
              <span className="text-sm font-medium text-gray-600">Need Speakers</span>
            </div>
            <div className={`text-2xl font-bold ${stats.eventsNeedingSpeakers > 0 ? 'text-amber-600' : 'text-brand-light-blue'}`}>
              {stats.eventsNeedingSpeakers}
            </div>
            <div className="text-xs text-gray-500">events</div>
          </div>

          {/* Completion Rate */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Last Week</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {stats.lastWeekCompletionRate !== null ? `${stats.lastWeekCompletionRate}%` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">
              {stats.lastWeekTotal > 0
                ? `${stats.lastWeekCompleted}/${stats.lastWeekTotal} completed`
                : 'no events'
              }
            </div>
          </div>
        </div>

        {/* Staffing Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Staffing Needs Across All Active Events
          </h4>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                stats.totalSpeakersNeeded > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>
                <Mic2 className="w-4 h-4 mr-1" />
                {stats.totalSpeakersNeeded} {stats.totalSpeakersNeeded === 1 ? 'speaker' : 'speakers'} needed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                stats.totalDriversNeeded > 0 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
              }`}>
                <Car className="w-4 h-4 mr-1" />
                {stats.totalDriversNeeded} {stats.totalDriversNeeded === 1 ? 'driver' : 'drivers'} needed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                stats.totalVolunteersNeeded > 0 ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              }`}>
                <Users className="w-4 h-4 mr-1" />
                {stats.totalVolunteersNeeded} {stats.totalVolunteersNeeded === 1 ? 'volunteer' : 'volunteers'} needed
              </span>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        {stats.upcomingDeadlines.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Upcoming Deadlines
              {stats.todayEventsCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stats.todayEventsCount} TODAY
                </Badge>
              )}
            </h4>
            <div className="space-y-2">
              {stats.upcomingDeadlines.slice(0, 5).map((deadline) => (
                <div
                  key={deadline.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg cursor-pointer transition-all gap-2 bg-white border border-gray-200 hover:border-brand-primary"
                  onClick={() => onNavigate('event-requests')}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Calendar className="w-5 h-5 text-brand-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{deadline.organizationName}</div>
                      <div className="text-sm text-gray-500">
                        {deadline.isToday ? 'Today' : 'Tomorrow'} - {formatDate(deadline.eventDate)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pl-8 sm:pl-0">
                    {deadline.needsDriver && (
                      <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 text-xs">
                        <Car className="w-3 h-3 mr-1" />
                        Driver
                      </Badge>
                    )}
                    {deadline.needsSpeaker && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-xs">
                        <Mic2 className="w-3 h-3 mr-1" />
                        Speaker
                      </Badge>
                    )}
                    {deadline.needsVolunteer && (
                      <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        Volunteer
                      </Badge>
                    )}
                    <ArrowRight className="w-4 h-4 text-gray-400 hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => onNavigate('event-requests')}
            className="bg-brand-primary hover:bg-brand-primary-dark"
          >
            <Calendar className="w-4 h-4 mr-2" />
            View All Events
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('drivers')}
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
          >
            <Car className="w-4 h-4 mr-2" />
            Assign Drivers
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('volunteer-hub')}
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
          >
            <Users className="w-4 h-4 mr-2" />
            Volunteer Hub
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('collections')}
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
          >
            Log Collection Data
          </Button>
        </div>
      </div>
    </div>
  );
}
