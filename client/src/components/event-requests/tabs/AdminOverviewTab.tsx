import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Calendar, ArrowUpDown, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
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
        return status !== 'completed' && status !== 'declined' && status !== 'postponed' && status !== 'cancelled';
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
        return status !== 'completed' && status !== 'declined' && status !== 'postponed' && status !== 'cancelled';
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
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          New: {stat.byStatus.new}
                        </Badge>
                      )}
                      {stat.byStatus.in_process > 0 && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          In Process: {stat.byStatus.in_process}
                        </Badge>
                      )}
                      {stat.byStatus.scheduled > 0 && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          Scheduled: {stat.byStatus.scheduled}
                        </Badge>
                      )}
                      {stat.byStatus.completed > 0 && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Completed: {stat.byStatus.completed}
                        </Badge>
                      )}
                      {stat.byStatus.declined > 0 && (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                          Declined: {stat.byStatus.declined}
                        </Badge>
                      )}
                      {stat.byStatus.postponed > 0 && (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                          Postponed: {stat.byStatus.postponed}
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Expanded Event List */}
                  {isExpanded && (
                    <div className="border-t bg-slate-50 p-4">
                      <h4 className="font-semibold text-sm text-slate-700 mb-3">Assigned Events</h4>
                      <div className="space-y-2">
                        {stat.events
                          .sort((a, b) => {
                            // Sort by event date, most recent first
                            const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
                            const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
                            return dateB - dateA;
                          })
                          .map((event) => (
                            <div
                              key={event.id}
                              className="bg-white rounded-lg p-3 border border-slate-200 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-slate-900 truncate">
                                    {event.organizationName || 'Unnamed Organization'}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                    {event.eventDate && (
                                      <div>
                                        <Calendar className="w-3 h-3 inline mr-1" />
                                        {format(new Date(event.eventDate), 'MMM d, yyyy')}
                                      </div>
                                    )}
                                    {event.estimatedAttendees && (
                                      <div>
                                        👥 {event.estimatedAttendees} attendees
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      event.status === 'new'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : event.status === 'in_process'
                                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                        : event.status === 'scheduled'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : event.status === 'completed'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : event.status === 'declined'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : event.status === 'postponed'
                                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                                        : event.status === 'cancelled'
                                        ? 'bg-gray-50 text-gray-700 border-gray-200'
                                        : 'bg-pink-50 text-pink-700 border-pink-200'
                                    }`}
                                  >
                                    {event.status || '(no status)'}
                                  </Badge>
                                  <a
                                    href={`#/dashboard?section=event-requests&tab=${event.status || 'new'}&eventId=${event.id}`}
                                    className="text-xs text-brand-primary hover:text-brand-primary/80 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
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
