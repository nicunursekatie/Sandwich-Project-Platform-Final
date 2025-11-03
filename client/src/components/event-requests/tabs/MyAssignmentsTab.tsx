import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { NewRequestCard } from '../cards/NewRequestCard';
import { ScheduledCard } from '../cards/ScheduledCard';
import { CompletedCard } from '../cards/CompletedCard';
import { InProcessCard } from '../cards/InProcessCard';
import { DeclinedCard } from '../cards/DeclinedCard';

export const MyAssignmentsTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation, updateEventRequestMutation, updateScheduledFieldMutation } = useEventMutations();
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
    setShowTspContactAssignmentDialog,
    setTspContactEventRequest,
    setShowOneDayFollowUpDialog,
    setShowOneMonthFollowUpDialog,
    setShowCollectionLog,
    setCollectionLogEventRequest,
    setShowLogContactDialog,
    setLogContactEventRequest,

    // Inline editing states for scheduled events
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

    // Completed editing
    editingCompletedId,
    setEditingCompletedId,
    completedEdit,
    setCompletedEdit,
  } = useEventRequestContext();

  const myAssignments = filterRequestsByStatus('my_assignments');

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

  // Function to render appropriate card based on status
  const renderEventCard = (request: any) => {
    const commonProps = {
      key: request.id,
      request,
      onEdit: () => {
        setSelectedEventRequest(request);
        setIsEditing(true);
        setShowEventDetails(true);
      },
      onDelete: () => deleteEventRequestMutation.mutate(request.id),
      onCall: () => handleCall(request),
      onContact: () => {
        setContactEventRequest(request);
        setShowContactOrganizerDialog(true);
      },
    };

    switch (request.status) {
      case 'new':
        return (
          <NewRequestCard
            {...commonProps}
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
            onLogContact={() => {
              setLogContactEventRequest(request);
              setShowLogContactDialog(true);
            }}
          />
        );

      case 'in_process':
        return (
          <InProcessCard
            {...commonProps}
            resolveUserName={resolveUserName}
            onSchedule={() => {
              setSelectedEventRequest(request);
              setSchedulingEventRequest(request);
              setShowSchedulingDialog(true);
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
            onAssignTspContact={() => {
              setTspContactEventRequest(request);
              setShowTspContactAssignmentDialog(true);
            }}
            onEditTspContact={() => {
              setTspContactEventRequest(request);
              setShowTspContactAssignmentDialog(true);
            }}
            onStatusChange={(status) => handleStatusChange(request.id, status)}
          />
        );

      case 'scheduled':
        return (
          <ScheduledCard
            {...commonProps}
            editingField={editingField}
            editingValue={editingValue}
            isEditingThisCard={editingScheduledId === request.id}
            inlineSandwichMode={inlineSandwichMode}
            inlineTotalCount={inlineTotalCount}
            inlineSandwichTypes={inlineSandwichTypes}
            inlineRangeMin={0}
            inlineRangeMax={0}
            inlineRangeType=""
            onStatusChange={(status) => handleStatusChange(request.id, status)}
            onFollowUp={() => {
              setSelectedEventRequest(request);
              setShowOneDayFollowUpDialog(true);
            }}
            onReschedule={() => {
              // Handle reschedule if needed
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
            startEditing={(field, value) => {
              setEditingScheduledId(request.id);
              setEditingField(field);
              setEditingValue(value || '');
            }}
            saveEdit={() => {
              if (editingScheduledId && editingField) {
                updateScheduledFieldMutation.mutate({
                  id: editingScheduledId,
                  field: editingField,
                  value: editingValue,
                });
              }
            }}
            cancelEdit={() => {
              setEditingScheduledId(null);
              setEditingField(null);
              setEditingValue('');
            }}
            setEditingValue={setEditingValue}
            setInlineSandwichMode={setInlineSandwichMode}
            setInlineTotalCount={setInlineTotalCount}
            setInlineRangeMin={() => {}}
            setInlineRangeMax={() => {}}
            setInlineRangeType={() => {}}
            addInlineSandwichType={() => {
              setInlineSandwichTypes(prev => [...prev, { type: 'turkey', quantity: 0 }]);
            }}
            updateInlineSandwichType={(index, field, value) => {
              setInlineSandwichTypes(prev => prev.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
              ));
            }}
            removeInlineSandwichType={(index) => {
              setInlineSandwichTypes(prev => prev.filter((_, i) => i !== index));
            }}
            resolveUserName={resolveUserName}
            openAssignmentDialog={(type) => openAssignmentDialog(request.id, type)}
            openEditAssignmentDialog={(type, personId) => openEditAssignmentDialog(request.id, type, personId)}
            handleRemoveAssignment={(type, personId) => handleRemoveAssignment(personId, type, request.id)}
            handleSelfSignup={(type) => handleSelfSignup(request.id, type)}
            canSelfSignup={canSelfSignup}
            isUserSignedUp={isUserSignedUp}
            canEdit={true}
          />
        );

      case 'completed':
        return (
          <CompletedCard
            {...commonProps}
            onView={() => {
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
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
            resolveUserName={resolveUserName}
            openAssignmentDialog={(type) => openAssignmentDialog(request.id, type)}
            openEditAssignmentDialog={(type, personId) => openEditAssignmentDialog(request.id, type, personId)}
            handleRemoveAssignment={(type, personId) => handleRemoveAssignment(personId, type, request.id)}
            handleSelfSignup={(type) => handleSelfSignup(request.id, type)}
            canSelfSignup={canSelfSignup}
            isUserSignedUp={isUserSignedUp}
          />
        );

      case 'declined':
        return (
          <DeclinedCard
            {...commonProps}
            onView={() => {
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onReactivate={() => {
              if (window.confirm('Do you want to reactivate this event request?')) {
                handleStatusChange(request.id, 'new');
                toast({
                  title: 'Event reactivated',
                  description: 'The event request has been moved back to New Requests.',
                });
              }
            }}
            onLogContact={() => {
              setLogContactEventRequest(request);
              setShowLogContactDialog(true);
            }}
            resolveUserName={resolveUserName}
          />
        );

      default:
        return (
          <NewRequestCard
            {...commonProps}
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
            onLogContact={() => {
              setLogContactEventRequest(request);
              setShowLogContactDialog(true);
            }}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {myAssignments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="mb-2">No active assignments found</div>
          <div className="text-sm">
            You are not currently assigned to any upcoming or in-progress events as a TSP contact, driver, speaker, or volunteer.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Showing {myAssignments.length} active event{myAssignments.length !== 1 ? 's' : ''} where you are assigned as TSP contact, driver, speaker, or volunteer (completed events excluded)
          </div>
          {myAssignments.map((request) => (
            <div
              key={request.id}
              className="border-2 border-[#47B3CB] rounded-lg p-1 bg-[#47B3CB]/5 shadow-sm hover:shadow-md transition-all"
            >
              {renderEventCard(request)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};