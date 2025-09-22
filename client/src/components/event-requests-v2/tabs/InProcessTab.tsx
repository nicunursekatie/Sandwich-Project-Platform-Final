import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { InProcessCard } from '../cards/InProcessCard';

export const InProcessTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const { handleStatusChange, resolveUserName } = useEventAssignments();

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
  } = useEventRequestContext();

  const inProcessRequests = filterRequestsByStatus('in_process');

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

  // Check if event has been in process for over a week
  const isStale = (request: any) => {
    if (request.status !== 'in_process') return false;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return request.statusChangedAt ? new Date(request.statusChangedAt) < oneWeekAgo : false;
  };

  return (
    <div className="space-y-4">
      {inProcessRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No events in process
        </div>
      ) : (
        inProcessRequests.map((request) => (
          <InProcessCard
            key={request.id}
            request={request}
            resolveUserName={resolveUserName}
            isStale={isStale(request)}
            onEdit={() => {
              setSelectedEventRequest(request);
              setIsEditing(true);
              setShowEventDetails(true);
            }}
            onDelete={() => deleteEventRequestMutation.mutate(request.id)}
            onSchedule={() => {
              setSchedulingEventRequest(request);
              setShowSchedulingDialog(true);
            }}
            onCall={() => handleCall(request)}
            onContact={() => {
              setContactEventRequest(request);
              setShowContactOrganizerDialog(true);
            }}
            onScheduleCall={() => {
              setSelectedEventRequest(request);
              setShowScheduleCallDialog(true);
            }}
            onResendToolkit={() => {
              setSelectedEventRequest(request);
              setToolkitEventRequest(request);
              setShowToolkitSentDialog(true);
            }}
          />
        ))
      )}
    </div>
  );
};