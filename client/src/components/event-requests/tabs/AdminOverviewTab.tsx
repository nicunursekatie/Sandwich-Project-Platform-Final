import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Calendar, ArrowUpDown, ChevronDown, ChevronRight, ExternalLink, MapPin } from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

interface TspContactStats {
  userId: string;
  name: string;
  totalAssigned: number;
  byStatus: {
    new: number;
    in_process: number;
    scheduled: number;
    completed: number;
    declined: number;
    postponed: number;
  };
  events: EventRequest[];
}

interface AdminOverviewTabProps {
  eventRequests: EventRequest[];
}

export function AdminOverviewTab({ eventRequests }: AdminOverviewTabProps) {
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'new' | 'in_process'>('total');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'in_process' | 'scheduled'>('all');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [eventSortBy, setEventSortBy] = useState<'status' | 'date' | 'organization'>('status');

  // Fetch users to get proper names
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const handleSort = (field: 'name' | 'total' | 'new' | 'in_process') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const tspContactStats = useMemo(() => {
    const statsMap = new Map<string, TspContactStats>();

    // Filter out completed/declined/postponed events by default unless includeCompleted is true
    let baseFilteredRequests = eventRequests;
    if (!includeCompleted) {
      baseFilteredRequests = eventRequests.filter(e => {
        const status = e.status?.toLowerCase();
        return status !== 'completed' && status !== 'declined' && status !== 'postponed' && status !== 'cancelled' && status !== 'contact_completed';
      });
    }

    // Apply status filter
    const filteredRequests = statusFilter === 'all'
      ? baseFilteredRequests
      : baseFilteredRequests.filter(e => e.status?.toLowerCase() === statusFilter);

    filteredRequests.forEach((event) => {
      const contactId = event.tspContact || event.customTspContact;
      if (!contactId) return;

      if (!statsMap.has(contactId)) {
        // Find the user name from users array
        const user = users.find(u => u.id === contactId);
        const userName = user
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || contactId
          : contactId;

        statsMap.set(contactId, {
          userId: contactId,
          name: userName,
          totalAssigned: 0,
          byStatus: {
            new: 0,
            in_process: 0,
            scheduled: 0,
            completed: 0,
            declined: 0,
            postponed: 0,
          },
          events: [],
        });
      }

      const stats = statsMap.get(contactId)!;
      stats.totalAssigned++;

      // Count by status
      const status = event.status?.toLowerCase() || 'new';
      if (status in stats.byStatus) {
        stats.byStatus[status as keyof typeof stats.byStatus]++;
      }

      stats.events.push(event);
    });

    // Convert to array and apply sorting
    const sortedStats = Array.from(statsMap.values()).sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'total':
          comparison = a.totalAssigned - b.totalAssigned;
          break;
        case 'new':
          comparison = a.byStatus.new - b.byStatus.new;
          break;
        case 'in_process':
          comparison = a.byStatus.in_process - b.byStatus.in_process;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sortedStats;
  }, [eventRequests, sortBy, sortDirection, statusFilter, includeCompleted, users]);

  // Calculate totals based on filtered events (excluding completed by default)
  const activeEvents = includeCompleted
    ? eventRequests
    : eventRequests.filter(e => {
        const status = e.status?.toLowerCase();
        return status !== 'completed' && status !== 'declined' && status !== 'postponed' && status !== 'cancelled' && status !== 'contact_completed';
      });

  const totalAssigned = activeEvents.filter(e => e.tspContact || e.customTspContact).length;
  const totalUnassigned = activeEvents.filter(e => !e.tspContact && !e.customTspContact).length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="premium-card-flat p-4">
          <div className="text-sm text-slate-600">Active Events</div>
          <div className="text-2xl font-bold text-brand-primary">{activeEvents.length}</div>
          <div className="text-xs text-slate-500 mt-1">
            {includeCompleted ? 'Including completed' : 'Excluding completed'}
          </div>
        </div>
        <div className="premium-card-flat p-4">
          <div className="text-sm text-slate-600">Assigned</div>
          <div className="text-2xl font-bold text-green-600">{totalAssigned}</div>
        </div>
        <div className="premium-card-flat p-4">
          <div className="text-sm text-slate-600">Unassigned</div>
          <div className="text-2xl font-bold text-orange-600">{totalUnassigned}</div>
        </div>
      </div>

      {/* Filter and Sort Controls */}
      <div className="premium-card p-4 space-y-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium text-slate-600">Status:</span>
            <div className="flex gap-1">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('new')}
              >
                New
              </Button>
              <Button
                variant={statusFilter === 'in_process' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('in_process')}
              >
                In Process
              </Button>
              <Button
                variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('scheduled')}
              >
                Scheduled
              </Button>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCompleted}
                onChange={(e) => setIncludeCompleted(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-600">Include completed/declined</span>
            </label>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm font-medium text-slate-600">Sort by:</span>
          <Button
            variant={sortBy === 'total' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('total')}
          >
            Total {sortBy === 'total' && <ArrowUpDown className="w-3 h-3 ml-1" />}
          </Button>
          <Button
            variant={sortBy === 'name' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('name')}
          >
            Name {sortBy === 'name' && <ArrowUpDown className="w-3 h-3 ml-1" />}
          </Button>
          <Button
            variant={sortBy === 'new' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('new')}
          >
            New {sortBy === 'new' && <ArrowUpDown className="w-3 h-3 ml-1" />}
          </Button>
          <Button
            variant={sortBy === 'in_process' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('in_process')}
          >
            In Process {sortBy === 'in_process' && <ArrowUpDown className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </div>

      {/* TSP Contact Stats */}
      <div className="space-y-3">
        {tspContactStats.length === 0 ? (
          <div className="text-center py-8 text-slate-500 premium-card">
            No TSP contact assignments found
          </div>
        ) : (
          <div className="space-y-2">
            {tspContactStats.map((stat) => {
              const isExpanded = expandedUserId === stat.userId;

              return (
                <div
                  key={stat.userId}
                  className="premium-card overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedUserId(isExpanded ? null : stat.userId)}
                    className="w-full p-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        )}
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{stat.name}</div>
                          <div className="text-sm text-slate-500">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {stat.totalAssigned} {stat.totalAssigned === 1 ? 'event' : 'events'} assigned
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-brand-primary text-white">
                        {stat.totalAssigned}
                      </Badge>
                    </div>

                    {/* Status Breakdown */}
                    <div className="flex flex-wrap gap-2 ml-13">
                      {stat.byStatus.new > 0 && (
                        <Badge variant="outline" className="text-xs border-[#47B3CB] bg-[#47B3CB]/10" style={{ color: '#236383' }}>
                          New: {stat.byStatus.new}
                        </Badge>
                      )}
                      {stat.byStatus.in_process > 0 && (
                        <Badge variant="outline" className="text-xs border-[#FBAD3F] bg-[#FBAD3F]/10" style={{ color: '#236383' }}>
                          In Process: {stat.byStatus.in_process}
                        </Badge>
                      )}
                      {stat.byStatus.scheduled > 0 && (
                        <Badge variant="outline" className="text-xs border-[#007E8C] bg-[#007E8C]/10" style={{ color: '#236383' }}>
                          Scheduled: {stat.byStatus.scheduled}
                        </Badge>
                      )}
                      {stat.byStatus.completed > 0 && (
                        <Badge variant="outline" className="text-xs border-[#007E8C] bg-[#007E8C]/20" style={{ color: '#236383' }}>
                          Completed: {stat.byStatus.completed}
                        </Badge>
                      )}
                      {stat.byStatus.declined > 0 && (
                        <Badge variant="outline" className="text-xs border-[#A31C41] bg-[#A31C41]/10" style={{ color: '#A31C41' }}>
                          Declined: {stat.byStatus.declined}
                        </Badge>
                      )}
                      {stat.byStatus.postponed > 0 && (
                        <Badge variant="outline" className="text-xs border-slate-400 bg-slate-50" style={{ color: '#236383' }}>
                          Postponed: {stat.byStatus.postponed}
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Expanded Event List */}
                  {isExpanded && (
                    <div className="border-t bg-slate-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm text-slate-700">Assigned Events</h4>
                        <div className="flex gap-1">
                          <Button
                            variant={eventSortBy === 'status' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEventSortBy('status')}
                            className="text-xs h-7"
                          >
                            Status
                          </Button>
                          <Button
                            variant={eventSortBy === 'date' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEventSortBy('date')}
                            className="text-xs h-7"
                          >
                            Date
                          </Button>
                          <Button
                            variant={eventSortBy === 'organization' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEventSortBy('organization')}
                            className="text-xs h-7"
                          >
                            Org
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {stat.events
                          .sort((a, b) => {
                            const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
                            const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;

                            if (eventSortBy === 'status') {
                              // Sort by status first, then date
                              const statusOrder = { new: 0, in_process: 1, scheduled: 2, completed: 3, declined: 4, postponed: 5, cancelled: 6, contact_completed: 7 };
                              const statusA = statusOrder[a.status?.toLowerCase() as keyof typeof statusOrder] ?? 99;
                              const statusB = statusOrder[b.status?.toLowerCase() as keyof typeof statusOrder] ?? 99;
                              if (statusA !== statusB) return statusA - statusB;
                              return dateB - dateA;
                            } else if (eventSortBy === 'date') {
                              return dateB - dateA;
                            } else {
                              return (a.organizationName || '').localeCompare(b.organizationName || '');
                            }
                          })
                          .map((event) => {
                            const eventDate = event.scheduledEventDate || event.desiredEventDate;
                            return (
                            <div
                              key={event.id}
                              className="bg-white rounded-lg p-3 border border-slate-200 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-base text-slate-900 truncate">
                                    {event.organizationName || 'Unnamed Organization'}
                                  </div>
                                  <div className="text-sm mt-1 space-y-1" style={{ color: '#236383' }}>
                                    {eventDate && (
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        {format(new Date(eventDate), 'MMM d, yyyy')}
                                      </div>
                                    )}
                                    {event.eventAddress && (
                                      <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.eventAddress)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:underline"
                                        style={{ color: '#007E8C' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MapPin className="w-4 h-4" />
                                        {event.eventAddress}
                                      </a>
                                    )}
                                    {event.estimatedSandwiches && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-base">🥪</span> {event.estimatedSandwiches} sandwiches
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <Badge
                                    variant="outline"
                                    className={`text-sm ${
                                      event.status === 'new'
                                        ? 'border-[#47B3CB] text-[#236383]'
                                        : event.status === 'in_process'
                                        ? 'border-[#FBAD3F] text-[#236383]'
                                        : event.status === 'scheduled'
                                        ? 'border-[#007E8C] text-[#236383]'
                                        : event.status === 'completed'
                                        ? 'border-[#007E8C] text-[#236383] bg-[#007E8C]/10'
                                        : event.status === 'declined' || event.status === 'cancelled'
                                        ? 'border-[#A31C41] text-[#A31C41]'
                                        : event.status === 'postponed'
                                        ? 'border-slate-400 text-slate-600'
                                        : event.status === 'contact_completed'
                                        ? 'border-[#007E8C] text-[#236383] bg-[#007E8C]/5'
                                        : 'border-slate-300 text-slate-600'
                                    }`}
                                  >
                                    {event.status?.replace('_', ' ') || '(no status)'}
                                  </Badge>
                                  <a
                                    href={`#/dashboard?section=event-requests&tab=${event.status || 'new'}&eventId=${event.id}`}
                                    className="text-sm flex items-center gap-1 font-medium"
                                    style={{ color: '#007E8C' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
