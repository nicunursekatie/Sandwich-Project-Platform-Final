import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { EventRequest } from '@shared/schema';
import { getMissingIntakeInfo } from '@/lib/event-request-validation';

interface EventWithMissingInfo {
  event: EventRequest;
  missingItems: string[];
}

export function MissingInfoSummaryDialog() {
  const [open, setOpen] = useState(false);

  const { data: allRequests = [] } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
  });

  const eventsWithMissingInfo: EventWithMissingInfo[] = allRequests
    .filter(
      (request) =>
        (request.status === 'in_process' || request.status === 'scheduled') &&
        getMissingIntakeInfo(request).length > 0
    )
    .map((request) => ({
      event: request,
      missingItems: getMissingIntakeInfo(request),
    }))
    .sort((a, b) => {
      if (a.event.status === 'scheduled' && b.event.status !== 'scheduled')
        return -1;
      if (a.event.status !== 'scheduled' && b.event.status === 'scheduled')
        return 1;
      return b.missingItems.length - a.missingItems.length;
    });

  const formatEventDate = (dateValue: any) => {
    if (!dateValue) return 'No date';
    
    try {
      // Create a Date object from whatever value we receive
      const date = new Date(dateValue);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'No date';
      }
      
      // Format using UTC to prevent timezone conversion
      return date.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      return 'No date';
    }
  };

  const scrollToEvent = (eventId: number) => {
    const element = document.getElementById(`event-card-${eventId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-teal-500', 'ring-offset-2');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-2');
      }, 2000);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          data-testid="button-missing-info-summary"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Incomplete Events ({eventsWithMissingInfo.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Events with Missing Intake Information
          </DialogTitle>
        </DialogHeader>

        {eventsWithMissingInfo.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm mt-1">
              No in-process or scheduled events have missing intake information.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The following {eventsWithMissingInfo.length} event
              {eventsWithMissingInfo.length === 1 ? '' : 's'} need additional
              information to ensure proper planning and execution:
            </p>

            <div className="space-y-3">
              {eventsWithMissingInfo.map(({ event, missingItems }) => (
                <div
                  key={event.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  data-testid={`missing-info-item-${event.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {event.organizationName || 'Unnamed Organization'}
                        </h3>
                        <Badge
                          variant="outline"
                          className={
                            event.status === 'scheduled'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }
                        >
                          {event.status === 'scheduled'
                            ? 'Scheduled'
                            : 'In Process'}
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Date:</span>{' '}
                        {formatEventDate(
                          event.scheduledEventDate || event.desiredEventDate
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-red-700">
                          Missing Information:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-700">
                          {missingItems.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => scrollToEvent(event.id)}
                      className="shrink-0 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                      data-testid={`button-view-event-${event.id}`}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
