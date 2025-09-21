import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { NewRequestCard } from '../cards/NewRequestCard';

export const NewRequestsTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation, updateEventRequestMutation } = useEventMutations();
  const { handleStatusChange } = useEventAssignments();

  const {
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setSchedulingEventRequest,
    setShowSchedulingDialog,
    setShowScheduleCallDialog,
    setToolkitEventRequest,
    setShowToolkitSentDialog,
    setShowContactOrganizerDialog,
    setContactEventRequest,
    setShowTspContactAssignmentDialog,
    setTspContactEventRequest,
  } = useEventRequestContext();

  const newRequests = filterRequestsByStatus('new');

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
      {newRequests.map((request) => (
        <NewRequestCard
          key={request.id}
          request={request}
          onEdit={() => {
            setSelectedEventRequest(request);
            setIsEditing(true);
            setShowEventDetails(true);
          }}
          onDelete={() => deleteEventRequestMutation.mutate(request.id)}
          onCall={() => handleCall(request)}
          onContact={() => {
            setContactEventRequest(request);
            setShowContactOrganizerDialog(true);
          }}
          onToolkit={() => {
            setSelectedEventRequest(request);
            setToolkitEventRequest(request);
            setShowToolkitSentDialog(true);
          }}
          onScheduleCall={() => {
            setSelectedEventRequest(request);
            setShowScheduleCallDialog(true);
          }}
          onAssignTspContact={() => {
            setTspContactEventRequest(request);
            setShowTspContactAssignmentDialog(true);
          }}
          onEditTspContact={() => {
            setTspContactEventRequest(request);
            setShowTspContactAssignmentDialog(true);
          }}
          onApprove={() => handleStatusChange(request.id, 'in_process')}
          onDecline={() => handleStatusChange(request.id, 'declined')}
        />
      ))}
      {newRequests.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No new event requests
        </div>
      )}
    </div>
  );
};