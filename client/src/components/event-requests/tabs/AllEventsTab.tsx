import React from 'react';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventRequestContext } from '../context/EventRequestContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MapPin, Calendar, UserCheck } from 'lucide-react';
import type { EventRequest } from '@shared/schema';

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return 'Date TBD';
  try {
    return format(new Date(date), 'EEE, MMM d, yyyy');
  } catch {
    return 'Date TBD';
  }
};

const statusLabels: Record<string, string> = {
  new: 'New',
  in_process: 'In Process',
  scheduled: 'Scheduled',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
};

const statusStyles: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  in_process: 'bg-amber-50 text-amber-700 border-amber-200',
  scheduled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
  declined: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  postponed: 'bg-purple-50 text-purple-700 border-purple-200',
};

export const AllEventsTab: React.FC = () => {
  const { paginatedRequests } = useEventFilters();
  const { setSelectedEventRequest, setIsEditing, setShowEventDetails } = useEventRequestContext();

  const openEvent = (request: EventRequest) => {
    setSelectedEventRequest(request);
    setIsEditing(false);
    setShowEventDetails(true);
  };

  if (!paginatedRequests.length) {
    return (
      <Card className="p-6 text-center text-gray-600">
        No events match your search.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {paginatedRequests.map((request) => {
        const status = request.status || 'new';
        const statusLabel = statusLabels[status] || status;
        const statusClass = statusStyles[status] || 'bg-slate-50 text-slate-700 border-slate-200';

        return (
          <Card
            key={request.id}
            className="p-4 hover:border-[#007E8C] hover:shadow-sm transition cursor-pointer"
            onClick={() => openEvent(request)}
            data-event-id={request.id}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-gray-900">{request.organizationName || 'No organization'}</h3>
                  <Badge variant="outline" className={statusClass}>
                    {statusLabel}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(request.scheduledEventDate || request.desiredEventDate)}</span>
                  {request.eventAddress && (
                    <>
                      <span className="text-gray-400">•</span>
                      <MapPin className="w-4 h-4" />
                      <span>{request.eventAddress}</span>
                    </>
                  )}
                </div>
                {request.tspContact && (
                  <div className="mt-1 text-sm text-gray-600 flex items-center gap-1">
                    <UserCheck className="w-4 h-4" />
                    <span>TSP Contact: {request.tspContactName || request.tspContact}</span>
                  </div>
                )}
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>Submitted: {formatDate(request.createdAt as any)}</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default AllEventsTab;
