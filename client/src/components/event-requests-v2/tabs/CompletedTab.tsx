import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import RequestCard from '@/components/event-requests/RequestCard';

export const CompletedTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const {
    handleStatusChange,
    openAssignmentDialog,
    openEditAssignmentDialog,
    handleRemoveAssignment,
    handleSelfSignup,
    canSelfSignup,
    isUserSignedUp,
    resolveUserName,
    resolveRecipientName,
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

    // Not used for completed but needed for RequestCard
    editingScheduledId,
    setEditingScheduledId,
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,
    inlineSandwichMode,
    setInlineSandwichMode,
    inlineTotalCount,
    setInlineTotalCount,
    inlineSandwichTypes,
    setInlineSandwichTypes,
  } = useEventRequestContext();

  const completedRequests = filterRequestsByStatus('completed');

  // No inline editing for completed events
  const startEditing = () => {};
  const saveEdit = () => {};
  const cancelEdit = () => {};
  const addInlineSandwichType = () => {};
  const updateInlineSandwichType = () => {};
  const removeInlineSandwichType = () => {};

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

  const handleViewCollectionLog = (request: any) => {
    setCollectionLogEventRequest(request);
    setShowCollectionLog(true);
  };

  return (
    <div className="space-y-4">
      {completedRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No completed events
        </div>
      ) : (
        completedRequests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            isEditing={false}
            setIsEditing={setIsEditing}
            editingField={editingField}
            setEditingField={setEditingField}
            editingValue={editingValue}
            setEditingValue={setEditingValue}
            editingScheduledId={editingScheduledId}
            setEditingScheduledId={setEditingScheduledId}
            inlineSandwichMode={inlineSandwichMode}
            setInlineSandwichMode={setInlineSandwichMode}
            inlineTotalCount={inlineTotalCount}
            setInlineTotalCount={setInlineTotalCount}
            inlineSandwichTypes={inlineSandwichTypes}
            setInlineSandwichTypes={setInlineSandwichTypes}
            onEdit={(request) => {
              // View only for completed events
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onDelete={(id) => {
              // Confirm before deleting completed events
              if (window.confirm('Are you sure you want to delete this completed event? This action cannot be undone.')) {
                deleteEventRequestMutation.mutate(id);
              }
            }}
            onSchedule={() => {}}  // Not applicable for completed
            onCall={handleCall}
            onToolkit={() => {}}  // Not applicable for completed
            onScheduleCall={() => {}}  // Not applicable for completed
            onFollowUp1Day={(request) => {
              // Important for completed events - 1-day follow-up
              setSelectedEventRequest(request);
              setShowOneDayFollowUpDialog(true);
            }}
            onFollowUp1Month={(request) => {
              // Important for completed events - 1-month follow-up
              setSelectedEventRequest(request);
              setShowOneMonthFollowUpDialog(true);
            }}
            onReschedule={(id) => {
              // Allow rescheduling if they want to run the event again
              if (window.confirm('Do you want to create a new event request based on this completed event?')) {
                handleStatusChange(id, 'new');
              }
            }}
            onContact={(request) => {
              setContactEventRequest(request);
              setShowContactOrganizerDialog(true);
            }}
            onStatusChange={handleStatusChange}
            startEditing={startEditing}
            saveEdit={saveEdit}
            cancelEdit={cancelEdit}
            addInlineSandwichType={addInlineSandwichType}
            updateInlineSandwichType={updateInlineSandwichType}
            removeInlineSandwichType={removeInlineSandwichType}
            openAssignmentDialog={openAssignmentDialog}
            openEditAssignmentDialog={openEditAssignmentDialog}
            handleRemoveAssignment={handleRemoveAssignment}
            handleSelfSignup={handleSelfSignup}
            canSelfSignup={canSelfSignup}
            isUserSignedUp={isUserSignedUp}
            resolveUserName={resolveUserName}
            resolveRecipientName={resolveRecipientName}
          />
        ))
      )}
    </div>
  );
};