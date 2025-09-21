import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building, Calendar, MapPin, AlertTriangle } from 'lucide-react';
import { formatEventDate } from '@/components/event-requests/utils';
import { statusColors, statusIcons } from '@/components/event-requests/constants';
import type { EventRequest } from '@shared/schema';

interface CardHeaderProps {
  request: EventRequest;
  isInProcessStale?: boolean;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ request, isInProcessStale }) => {
  const StatusIcon = statusIcons[request.status as keyof typeof statusIcons] || statusIcons.new;

  // Use scheduledEventDate for scheduled/completed events, otherwise use desiredEventDate
  const displayDate = (request.status === 'scheduled' || request.status === 'completed') && request.scheduledEventDate
    ? request.scheduledEventDate
    : request.desiredEventDate;

  const dateInfo = formatEventDate(displayDate || '');

  // Determine the date label based on status
  let dateLabel = 'Requested Date';
  if (request.status === 'scheduled') {
    dateLabel = 'Scheduled Date';
  } else if (request.status === 'completed') {
    dateLabel = 'Event Date';
  }

  // Show if scheduled date differs from requested date
  const hasRescheduled = request.scheduledEventDate && request.desiredEventDate &&
    new Date(request.scheduledEventDate).toDateString() !== new Date(request.desiredEventDate).toDateString();

  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007E8C] to-[#40C1AC] flex items-center justify-center text-white font-bold">
          {request.organizationName?.charAt(0) || '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-[#1A2332]">
              {request.organizationName}
            </h3>
            <Badge className={statusColors[request.status as keyof typeof statusColors] || statusColors.new}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {request.status.replace('_', ' ')}
            </Badge>
            {isInProcessStale && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs follow-up
              </Badge>
            )}
          </div>
          <div className="text-sm text-[#236383] mt-1 space-y-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Building className="w-3 h-3" />
                {request.organizationType}
              </span>
              {request.eventAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {request.eventAddress}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>
                {dateLabel}: {' '}
                <strong className={`${dateInfo.isPast ? 'text-red-600' : ''}`}>
                  {dateInfo.display}
                </strong>
                {dateInfo.relativeTime && (
                  <span className="text-[#236383] ml-1">({dateInfo.relativeTime})</span>
                )}
                {hasRescheduled && (
                  <span className="text-amber-600 ml-2 text-xs">(rescheduled)</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};