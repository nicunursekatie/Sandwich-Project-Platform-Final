import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
  ChevronDown,
  ChevronUp,
  Truck,
  Sandwich,
} from 'lucide-react';
import { format, isValid, formatDistanceToNowStrict } from 'date-fns';
import { parseDateOnly } from '@shared/date-utils';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';

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
  estimatedSandwichCount: number | null;
  estimatedSandwichCountMin: number | null;
  estimatedSandwichCountMax: number | null;
  sandwichTypes: unknown;
  needsFollowUp: boolean;
  vanNeeded: boolean;
  vanDriverNeeded: boolean;
  vanNeededLikely: boolean;
  isLargeEvent: boolean;
  isCorporatePriority: boolean;
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
  byStatusEvents: {
    new: MyAssignmentItem[];
    in_process: MyAssignmentItem[];
    scheduled: MyAssignmentItem[];
    rescheduled: MyAssignmentItem[];
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
 *   3. Full assignment breakdown by status (expandable detail lists)
 *   4. List of every assigned event with status + last-contact freshness
 */
type AssignmentStatusKey = 'new' | 'in_process' | 'scheduled' | 'rescheduled';

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

function formatEventDateParts(dateString: string | null) {
  if (!dateString) {
    return { day: '—', month: 'TBD', weekday: 'Date TBD', full: 'Date TBD' };
  }
  try {
    const date = parseDateOnly(dateString);
    if (!date || !isValid(date)) {
      return { day: '—', month: 'TBD', weekday: 'Date TBD', full: 'Date TBD' };
    }
    return {
      day: format(date, 'd'),
      month: format(date, 'MMM'),
      weekday: format(date, 'EEE'),
      full: format(date, 'EEE, MMM d, yyyy'),
    };
  } catch {
    return { day: '—', month: 'TBD', weekday: 'Date TBD', full: 'Date TBD' };
  }
}

function formatLastContact(ts: string | null): string {
  if (!ts) return 'never';
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'never';
    return `${formatDistanceToNowStrict(d)} ago`;
  } catch {
    return 'never';
  }
}

function getSandwichSummary(event: MyAssignmentItem): string {
  return formatSandwichTypesDisplay(
    event.sandwichTypes,
    event.estimatedSandwichCount ?? undefined,
  );
}

function AssignmentEventRow({
  event,
  onOpen,
  showStatus = false,
}: {
  event: MyAssignmentItem;
  onOpen: (event: MyAssignmentItem) => void;
  showStatus?: boolean;
}) {
  const dateParts = formatEventDateParts(event.eventDate);
  const sandwichSummary = getSandwichSummary(event);
  const hasSandwichInfo = sandwichSummary !== 'Not specified';

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="w-full text-left p-3 rounded-lg bg-white border border-gray-200 hover:border-brand-primary hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-[4.5rem] text-center rounded-lg bg-[#007E8C]/10 border border-[#007E8C]/20 px-2 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#007E8C]">
            {dateParts.month}
          </div>
          <div className="text-2xl font-bold leading-none text-[#007E8C] mt-0.5">
            {dateParts.day}
          </div>
          <div className="text-[10px] font-medium text-gray-500 mt-0.5">
            {dateParts.weekday}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {showStatus && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border mb-1 ${statusStyle[event.status || ''] || 'bg-gray-100 text-gray-700 border-gray-300'}`}
                >
                  {statusLabel[event.status || ''] || event.status}
                </span>
              )}
              <div className="font-semibold text-gray-900 truncate">
                {event.organizationName || 'Untitled organization'}
              </div>
              <div className="text-sm font-medium text-gray-600 mt-0.5">
                {dateParts.full}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
          </div>

          {hasSandwichInfo && (
            <div className="flex items-center gap-1.5 text-sm text-gray-700 mt-2">
              <Sandwich className="w-3.5 h-3.5 text-[#FBAD3F] shrink-0" />
              <span>{sandwichSummary}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mt-2">
            {event.needsFollowUp && (
              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800 bg-amber-50">
                <AlertTriangle className="w-3 h-3 mr-1" />
                No contact in 7+ days
              </Badge>
            )}
            {event.vanNeeded && (
              <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-800 bg-orange-50">
                <Truck className="w-3 h-3 mr-1" />
                {event.vanDriverNeeded ? 'Van needed' : 'Van likely needed'}
              </Badge>
            )}
            {event.isLargeEvent && (
              <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-800 bg-purple-50">
                Large event (500+)
              </Badge>
            )}
            {event.isCorporatePriority && (
              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-900 bg-amber-50">
                Corporate priority
              </Badge>
            )}
          </div>

          {event.lastContactAttempt != null && (
            <div className="text-xs text-gray-500 mt-2">
              Last contact {formatLastContact(event.lastContactAttempt)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function MyAssignmentsView({
  my,
  onNavigate,
  drillToEvents,
}: {
  my: MyAssignments;
  onNavigate: (section: string) => void;
  drillToEvents: (tab: string, filter?: string) => void;
}) {
  const [expandedStatus, setExpandedStatus] = useState<AssignmentStatusKey | null>(null);

  const openAssignmentEvent = (event: MyAssignmentItem) => {
    try {
      sessionStorage.setItem(
        'eventRequests.pendingFilter',
        JSON.stringify({
          tab: 'my_assignments',
          myAssignmentsStatuses: event.status ? [event.status] : undefined,
        }),
      );
    } catch {
      // ignore unavailable sessionStorage
    }
    window.history.pushState({}, '', '/dashboard?section=event-requests&tab=my_assignments');
    onNavigate('event-requests');
  };

  const drillToStatusTab = (tab: AssignmentStatusKey) => {
    try {
      sessionStorage.setItem(
        'eventRequests.pendingFilter',
        JSON.stringify({
          tab: 'my_assignments',
          myAssignmentsStatuses: [tab],
        }),
      );
    } catch {
      // ignore unavailable sessionStorage
    }
    window.history.pushState({}, '', '/dashboard?section=event-requests&tab=my_assignments');
    onNavigate('event-requests');
  };

  const toggleStatusExpand = (key: AssignmentStatusKey) => {
    setExpandedStatus((prev) => (prev === key ? null : key));
  };

  const byStatusEvents = my.byStatusEvents ?? {
    new: my.newRequests,
    in_process: my.allMyEvents.filter((e) => e.status === 'in_process'),
    scheduled: my.allMyEvents.filter((e) => e.status === 'scheduled'),
    rescheduled: my.allMyEvents.filter((e) => e.status === 'rescheduled'),
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
                <AssignmentEventRow key={e.id} event={e} onOpen={openAssignmentEvent} />
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
                <AssignmentEventRow key={e.id} event={e} onOpen={openAssignmentEvent} />
              ))}
              {my.inProcessStale.length > 5 && (
                <div className="text-xs text-amber-700 pl-3">
                  + {my.inProcessStale.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRIORITY 3: Status breakdown — click a tile to expand event details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Your assignments by status
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Click a status to expand details. Click an event to open it in Event Requests.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(['new', 'in_process', 'scheduled', 'rescheduled'] as const).map((key) => {
              const count = my.byStatus[key];
              if (count === 0) return null;
              const isExpanded = expandedStatus === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleStatusExpand(key)}
                  aria-expanded={isExpanded}
                  className={`px-3 py-2 rounded-md border text-left transition-all hover:shadow-sm ${statusStyle[key]} ${
                    isExpanded ? 'ring-2 ring-offset-1 ring-brand-primary shadow-sm' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-2xl font-bold leading-none">{count}</div>
                      <div className="text-xs font-medium mt-0.5">{statusLabel[key]}</div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 shrink-0 opacity-70" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {expandedStatus && byStatusEvents[expandedStatus]?.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h5 className="text-sm font-semibold text-gray-800">
                  {statusLabel[expandedStatus]} events
                </h5>
                <button
                  type="button"
                  onClick={() => drillToStatusTab(expandedStatus)}
                  className="text-xs text-brand-primary hover:underline shrink-0"
                >
                  Open in Event Requests →
                </button>
              </div>
              {byStatusEvents[expandedStatus].map((event) => (
                <AssignmentEventRow
                  key={event.id}
                  event={event}
                  onOpen={openAssignmentEvent}
                />
              ))}
            </div>
          )}
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
            <div className="space-y-2">
              {my.allMyEvents.slice(0, 8).map((e) => (
                <AssignmentEventRow
                  key={e.id}
                  event={e}
                  onOpen={openAssignmentEvent}
                  showStatus
                />
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
    const url = tab
      ? `/dashboard?section=event-requests&tab=${encodeURIComponent(tab)}`
      : '/dashboard?section=event-requests';
    window.history.pushState({}, '', url);
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
