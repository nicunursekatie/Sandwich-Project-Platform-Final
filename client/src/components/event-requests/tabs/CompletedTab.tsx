import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { CompletedCard } from '../cards/CompletedCard';

export const CompletedTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const {
    handleStatusChange,
    resolveUserName,
    openAssignmentDialog,
    openEditAssignmentDialog,
    handleRemoveAssignment,
    handleSelfSignup,
    canSelfSignup,
    isUserSignedUp,
  } = useEventAssignments();

  const {
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setShowCollectionLog,
    setCollectionLogEventRequest,
    setShowContactOrganizerDialog,
    setContactEventRequest,
    setShowOneDayFollowUpDialog,
    setShowOneMonthFollowUpDialog,
    setTspContactEventRequest,
    setShowTspContactAssignmentDialog,
    setShowLogContactDialog,
    setLogContactEventRequest,
  } = useEventRequestContext();

  const completedRequests = filterRequestsByStatus('completed') || [];

  return (
    <div className="space-y-4">
      {completedRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No completed events
        </div>
      ) : (
        completedRequests.map((request) => (
          <CompletedCard
            key={request.id}
            request={request}
            resolveUserName={resolveUserName}
            onView={() => {
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onEdit={() => {
              setSelectedEventRequest(request);
              setIsEditing(true);
              setShowEventDetails(true);
            }}
            onDelete={() => {
              if (
                window.confirm(
                  'Are you sure you want to delete this completed event? This action cannot be undone.'
                )
              ) {
                deleteEventRequestMutation.mutate(request.id, {
                  onSuccess: () => {
                    toast({
                      title: 'Deleted',
                      description: 'The completed event was deleted.',
                    });
                  },
                  onError: (err: unknown) => {
                    toast({
                      variant: 'destructive',
                      title: 'Delete failed',
                      description:
                        err instanceof Error ? err.message : 'Unknown error',
                    });
                  },
                });
              }
            }}
            onContact={() => {
              setContactEventRequest(request);
              setShowContactOrganizerDialog(true);
            }}
            onFollowUp1Day={() => {
              setSelectedEventRequest(request);
              setShowOneDayFollowUpDialog(true);
            }}
            onFollowUp1Month={() => {
              setSelectedEventRequest(request);
              setShowOneMonthFollowUpDialog(true);
            }}
            onViewCollectionLog={() => {
              setCollectionLogEventRequest(request);
              setShowCollectionLog(true);
            }}
            onReschedule={() => {
              if (
                window.confirm(
                  'Do you want to create a new event request based on this completed event?'
                )
              ) {
                handleStatusChange(request.id, 'new');
              }
            }}
            onAssignTspContact={() => {
              setTspContactEventRequest(request);
              setShowTspContactAssignmentDialog(true);
            }}
            onEditTspContact={() => {
              setTspContactEventRequest(request);
              setShowTspContactAssignmentDialog(true);
            }}
            onLogContact={() => {
              setLogContactEventRequest(request);
              setShowLogContactDialog(true);
            }}
            openAssignmentDialog={(type) => openAssignmentDialog(request.id, type)}
            openEditAssignmentDialog={(type, personId) => openEditAssignmentDialog(request.id, type, personId)}
            handleRemoveAssignment={(type, personId) => handleRemoveAssignment(personId, type, request.id)}
            handleSelfSignup={(type) => handleSelfSignup(request.id, type)}
            canSelfSignup={canSelfSignup}
            isUserSignedUp={isUserSignedUp}
          />
        ))
      )}
    </div>
  );
};
