import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { DeclinedCard } from '../cards/DeclinedCard';

export const DeclinedTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const { handleStatusChange } = useEventAssignments();

  const {
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setShowContactOrganizerDialog,
    setContactEventRequest,
  } = useEventRequestContext();

  const declinedRequests = filterRequestsByStatus('declined');

  const handleCall = (request: any) => {
    const phoneNumber = request.phone;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
    <div className="space-y-4">
      {declinedRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No declined or postponed events
        </div>
      ) : (
        declinedRequests.map((request) => (
          <DeclinedCard
            key={request.id}
            request={request}
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
        ))
      )}
    </div>
  );
};