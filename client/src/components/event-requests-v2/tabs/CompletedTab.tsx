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
  const { handleStatusChange, resolveUserName } = useEventAssignments();

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
  } = useEventRequestContext();

  const completedRequests = filterRequestsByStatus('completed');

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
            onView={() => {
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onDelete={() => {
              if (window.confirm('Are you sure you want to delete this completed event? This action cannot be undone.')) {
                deleteEventRequestMutation.mutate(request.id);
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
              if (window.confirm('Do you want to create a new event request based on this completed event?')) {
                handleStatusChange(request.id, 'new');
              }
            }}
            resolveUserName={resolveUserName}
          />
        ))
      )}
    </div>
  );
};