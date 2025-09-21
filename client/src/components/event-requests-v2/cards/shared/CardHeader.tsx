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

  // Hide requested date once there's a scheduled date (keep requested date in database but don't display)
  const displayDate = request.scheduledEventDate || request.desiredEventDate;

  // Format the date for display
  const dateInfo = displayDate ? formatEventDate(displayDate) : null;

  // Calculate if date is past
  const isPast = displayDate ? new Date(displayDate) < new Date() : false;

  // Calculate relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    return '';
  };

  // Determine the date label based on what date we're showing
  let dateLabel = 'Requested Date';
  if (request.scheduledEventDate) {
    if (request.status === 'completed') {
      dateLabel = 'Event Date';
    } else {
      dateLabel = 'Scheduled Date';
    }
  }

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
                <a 
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(request.eventAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#236383] hover:text-[#FBAD3F] hover:underline transition-colors"
                >
                  <MapPin className="w-3 h-3" />
                  {request.eventAddress}
                </a>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>
                {dateLabel}: {' '}
                <strong className={displayDate && isPast ? 'text-red-600' : displayDate ? '' : 'text-gray-500'}>
                  {displayDate && dateInfo ? dateInfo.text : 'No date set'}
                </strong>
                {displayDate && getRelativeTime(displayDate) && (
                  <span className="text-[#236383] ml-1">({getRelativeTime(displayDate)})</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};