import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import RequestCard from '@/components/event-requests/RequestCard';

export const DeclinedTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const {
    handleStatusChange,
    resolveUserName,
    resolveRecipientName,
  } = useEventAssignments();

  const {
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setShowContactOrganizerDialog,
    setContactEventRequest,

    // Not used for declined but needed for RequestCard
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

  const declinedRequests = filterRequestsByStatus('declined');

  // No features available for declined/postponed events except viewing and reactivating
  const startEditing = () => {};
  const saveEdit = () => {};
  const cancelEdit = () => {};
  const addInlineSandwichType = () => {};
  const updateInlineSandwichType = () => {};
  const removeInlineSandwichType = () => {};
  const openAssignmentDialog = () => {};
  const openEditAssignmentDialog = () => {};
  const handleRemoveAssignment = () => {};
  const handleSelfSignup = () => {};
  const canSelfSignup = () => false;
  const isUserSignedUp = () => false;

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
              // View only for declined events
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onDelete={(id) => {
              if (window.confirm('Are you sure you want to permanently delete this declined event?')) {
                deleteEventRequestMutation.mutate(id);
              }
            }}
            onSchedule={() => {}}
            onCall={handleCall}
            onToolkit={() => {}}
            onScheduleCall={() => {}}
            onFollowUp1Day={() => {}}
            onFollowUp1Month={() => {}}
            onReschedule={(id) => {
              // Reactivate declined event
              if (window.confirm('Do you want to reactivate this event request?')) {
                handleStatusChange(id, 'new');
                toast({
                  title: 'Event reactivated',
                  description: 'The event request has been moved back to New Requests.',
                });
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