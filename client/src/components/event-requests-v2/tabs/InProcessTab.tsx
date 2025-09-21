import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import RequestCard from '@/components/event-requests/RequestCard';

export const InProcessTab: React.FC = () => {
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
    setSchedulingEventRequest,
    setShowSchedulingDialog,
    setShowScheduleCallDialog,
    setToolkitEventRequest,
    setShowToolkitSentDialog,
    setShowContactOrganizerDialog,
    setContactEventRequest,
    setShowOneDayFollowUpDialog,
    setShowOneMonthFollowUpDialog,

    // These states are not used for in_process but needed for RequestCard
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

  const inProcessRequests = filterRequestsByStatus('in_process');

  // Placeholder functions for features not available in in_process status
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
      {inProcessRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No events in process
        </div>
      ) : (
        inProcessRequests.map((request) => (
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
              // Toolkit already sent for in_process, but allow resending
              setSelectedEventRequest(request);
              setToolkitEventRequest(request);
              setShowToolkitSentDialog(true);
            }}
            onScheduleCall={(request) => {
              // Important for in_process events - schedule follow-up calls
              setSelectedEventRequest(request);
              setShowScheduleCallDialog(true);
            }}
            onFollowUp1Day={() => {}}
            onFollowUp1Month={() => {}}
            onReschedule={(id) => handleStatusChange(id, 'new')}
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