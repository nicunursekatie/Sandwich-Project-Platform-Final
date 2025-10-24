import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { DeclinedCard } from '../cards/DeclinedCard';

export const DeclinedTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const { handleStatusChange, resolveUserName } = useEventAssignments();

  const {
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setShowContactOrganizerDialog,
    setContactEventRequest,
  } = useEventRequestContext();

  const declinedRequests = filterRequestsByStatus('declined');
  const postponedRequests = filterRequestsByStatus('postponed');

  const handleCall = (request: any) => {
    const phoneNumber = request.phone;

    if (isMobile) {
      window.location.href = `tel:${phoneNumber}`;
    } else {
      navigator.clipboard.writeText(phoneNumber || '').then(() => {
        toast({
          title: 'Phone number copied!',
          description: `${phoneNumber} has been copied to your clipboard.`,
        });
      }).catch(() => {
        toast({
          title: 'Failed to copy',
          description: 'Please copy manually: ' + phoneNumber,
          variant: 'destructive',
        });
      });
    }
  };

  return (
    <div className="space-y-6">
      {declinedRequests.length === 0 && postponedRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No declined or postponed events
        </div>
      ) : (
        <>
          {/* Declined Events Section */}
          {declinedRequests.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-red-200">
                <h3 className="text-lg font-semibold text-red-700">Declined Events</h3>
                <span className="text-sm text-gray-500">({declinedRequests.length})</span>
              </div>
              {declinedRequests.map((request) => (
                <DeclinedCard
                  key={request.id}
                  request={request}
                  resolveUserName={resolveUserName}
                  onView={() => {
                    setSelectedEventRequest(request);
                    setIsEditing(false);
                    setShowEventDetails(true);
                  }}
                  onDelete={() => {
                    if (window.confirm('Are you sure you want to permanently delete this declined event?')) {
                      deleteEventRequestMutation.mutate(request.id);
                    }
                  }}
                  onContact={() => {
                    setContactEventRequest(request);
                    setShowContactOrganizerDialog(true);
                  }}
                  onCall={() => handleCall(request)}
                  onReactivate={() => {
                    if (window.confirm('Do you want to reactivate this event request?')) {
                      handleStatusChange(request.id, 'new');
                      toast({
                        title: 'Event reactivated',
                        description: 'The event request has been moved back to New Requests.',
                      });
                    }
                  }}
                />
              ))}
            </div>
          )}

          {/* Postponed Events Section */}
          {postponedRequests.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-amber-200">
                <h3 className="text-lg font-semibold text-amber-700">Postponed Events</h3>
                <span className="text-sm text-gray-500">({postponedRequests.length})</span>
              </div>
              {postponedRequests.map((request) => (
                <DeclinedCard
                  key={request.id}
                  request={request}
                  resolveUserName={resolveUserName}
                  onView={() => {
                    setSelectedEventRequest(request);
                    setIsEditing(false);
                    setShowEventDetails(true);
                  }}
                  onDelete={() => {
                    if (window.confirm('Are you sure you want to permanently delete this postponed event?')) {
                      deleteEventRequestMutation.mutate(request.id);
                    }
                  }}
                  onContact={() => {
                    setContactEventRequest(request);
                    setShowContactOrganizerDialog(true);
                  }}
                  onCall={() => handleCall(request)}
                  onReactivate={() => {
                    if (window.confirm('Do you want to reactivate this event request?')) {
                      handleStatusChange(request.id, 'new');
                      toast({
                        title: 'Event reactivated',
                        description: 'The event request has been moved back to New Requests.',
                      });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};