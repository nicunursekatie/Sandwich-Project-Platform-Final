import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useEventQueries } from '../hooks/useEventQueries';
import { useToast } from '@/hooks/use-toast';
import RequestCard from '@/components/event-requests/RequestCard';

export const NewRequestsTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation, updateEventRequestMutation } = useEventMutations();
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
    setSchedulingEventRequest,
    setShowSchedulingDialog,
    setShowScheduleCallDialog,
    setToolkitEventRequest,
    setShowToolkitSentDialog,
    setShowContactOrganizerDialog,
    setContactEventRequest,

    // Inline editing states - not used for 'new' status but needed for RequestCard
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

  const newRequests = filterRequestsByStatus('new');

  // These functions are needed for RequestCard but aren't used for 'new' status
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

  return (
    <div className="space-y-4">
      {newRequests.map((request) => (
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
            setSelectedEventRequest(request);
            setIsEditing(true);
            setShowEventDetails(true);
          }}
          onDelete={(id) => deleteEventRequestMutation.mutate(id)}
          onSchedule={(request) => {
            setSchedulingEventRequest(request);
            setShowSchedulingDialog(true);
          }}
          onCall={handleCall}
          onToolkit={(request) => {
            setSelectedEventRequest(request);
            setToolkitEventRequest(request);
            setShowToolkitSentDialog(true);
          }}
          onScheduleCall={(request) => {
            setSelectedEventRequest(request);
            setShowScheduleCallDialog(true);
          }}
          onFollowUp1Day={() => {}}
          onFollowUp1Month={() => {}}
          onReschedule={() => {}}
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
      ))}
      {newRequests.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No new event requests
        </div>
      )}
    </div>
  );
};