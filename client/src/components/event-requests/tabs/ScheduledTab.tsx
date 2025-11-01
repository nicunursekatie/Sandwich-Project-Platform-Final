import React, { useState } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScheduledCardEnhanced } from '../cards/ScheduledCardEnhanced';
import { RescheduleDialog } from '../dialogs/RescheduleDialog';
import { parseSandwichTypes, stringifySandwichTypes } from '@/lib/sandwich-utils';
import { useConfirmation } from '@/components/ui/confirmation-dialog';
import type { EventRequest } from '@shared/schema';

export const ScheduledTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { confirm, ConfirmationDialogComponent } = useConfirmation();
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState<EventRequest | null>(null);

  // State for confirmation checkbox when editing dates
  const [tempIsConfirmed, setTempIsConfirmed] = useState(false);

  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation, updateEventRequestMutation, updateScheduledFieldMutation, rescheduleEventMutation } = useEventMutations();
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
    eventRequests,
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setSchedulingEventRequest,
    setShowSchedulingDialog,
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

    // Inline editing states - IMPORTANT for scheduled tab
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
    inlineRangeMin,
    setInlineRangeMin,
    inlineRangeMax,
    setInlineRangeMax,
    inlineRangeType,
    setInlineRangeType,
  } = useEventRequestContext();

  const scheduledRequests = filterRequestsByStatus('scheduled');

  // Inline editing functions - SPECIFIC to scheduled tab
  const startEditing = (id: number, field: string, currentValue: string) => {
    setEditingScheduledId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');

    // When editing a date field, also load the current confirmation status
    if (field === 'desiredEventDate' || field === 'scheduledEventDate') {
      const eventRequest = eventRequests.find(req => req.id === id);
      if (eventRequest) {
        setTempIsConfirmed(eventRequest.isConfirmed || false);
      }
    }

    // Special handling for sandwich types
    if (field === 'sandwichTypes') {
      const eventRequest = eventRequests.find(req => req.id === id);
      if (eventRequest) {
        const existingSandwichTypes = parseSandwichTypes(eventRequest.sandwichTypes) || [];
        const hasTypesData = existingSandwichTypes.length > 0;
        const totalCount = eventRequest.estimatedSandwichCount || 0;

        setInlineSandwichMode(hasTypesData ? 'types' : 'total');
        setInlineTotalCount(totalCount);
        setInlineSandwichTypes(hasTypesData ? existingSandwichTypes : []);
      }
    }
  };

  const saveEdit = () => {
    if (editingScheduledId && editingField) {
      // Define the actual save logic
      const performSave = () => {

      // Special handling for sandwich types
      if (editingField === 'sandwichTypes') {
        const updateData: any = {};

        if (inlineSandwichMode === 'total') {
          updateData.estimatedSandwichCount = inlineTotalCount;
          updateData.sandwichTypes = null;
          updateData.estimatedSandwichCountMin = null;
          updateData.estimatedSandwichCountMax = null;
          updateData.estimatedSandwichRangeType = null;
        } else if (inlineSandwichMode === 'range') {
          updateData.estimatedSandwichCountMin = inlineRangeMin;
          updateData.estimatedSandwichCountMax = inlineRangeMax;
          updateData.estimatedSandwichRangeType = inlineRangeType || null;
          updateData.estimatedSandwichCount = null;
          updateData.sandwichTypes = null;
        } else {
          updateData.sandwichTypes = stringifySandwichTypes(inlineSandwichTypes);
          updateData.estimatedSandwichCount = inlineSandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
          updateData.estimatedSandwichCountMin = null;
          updateData.estimatedSandwichCountMax = null;
          updateData.estimatedSandwichRangeType = null;
        }

        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: updateData,
        });
      } else if (editingField === 'hasRefrigeration') {
        // Special handling for refrigeration
        let refrigerationValue: boolean | null;
        if (editingValue === 'true') {
          refrigerationValue = true;
        } else if (editingValue === 'false') {
          refrigerationValue = false;
        } else {
          refrigerationValue = null;
        }

        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { hasRefrigeration: refrigerationValue },
        });
      } else if (editingField === 'isConfirmed' || editingField === 'addedToOfficialSheet') {
        // Special handling for boolean toggles
        const boolValue = editingValue === 'true';
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { [editingField]: boolValue },
        });
      } else if (editingField === 'desiredEventDate' || editingField === 'scheduledEventDate') {
        // When saving a date field, also save the confirmation status
        // Completed events are always confirmed
        const eventRequest = eventRequests.find(r => r.id === editingScheduledId);
        const isCompleted = eventRequest?.status === 'completed';

        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: {
            [editingField]: editingValue,
            isConfirmed: isCompleted ? true : tempIsConfirmed
          },
        });
      } else if (editingField === 'assignedRecipientIds') {
        // Special handling for assignedRecipientIds - parse JSON string to array
        const recipientIds = JSON.parse(editingValue);
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { assignedRecipientIds: recipientIds },
        });
      } else {
        // Regular field update
        updateScheduledFieldMutation.mutate({
          id: editingScheduledId,
          field: editingField,
          value: editingValue,
        });
      }
      };

      // Check if this is a critical field that requires confirmation
      const criticalFields = ['eventStartTime', 'eventEndTime', 'pickupTime', 'overnightPickupTime', 'eventAddress', 'overnightHoldingLocation', 'deliveryDestination', 'hasRefrigeration', 'driversNeeded', 'speakersNeeded', 'volunteersNeeded'];

      if (criticalFields.includes(editingField)) {
        const fieldName = editingField.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
        confirm(
          `Update ${fieldName}`,
          `Are you sure you want to update ${fieldName}? This will change the event details and may affect planning.`,
          () => {
            performSave();
            cancelEdit();
          },
          'default',
          () => {
            // Cancel callback: reset editing state
            cancelEdit();
          }
        );
      } else {
        // For non-critical fields, save directly
        performSave();
        cancelEdit();
      }
    }
  };

  const cancelEdit = () => {
    setEditingScheduledId(null);
    setEditingField(null);
    setEditingValue('');
    setInlineSandwichMode('total');
    setInlineTotalCount(0);
    setInlineSandwichTypes([]);
  };

  const addInlineSandwichType = () => {
    setInlineSandwichTypes(prev => [...prev, { type: 'turkey', quantity: 0 }]);
  };

  const updateInlineSandwichType = (index: number, field: 'type' | 'quantity', value: string | number) => {
    setInlineSandwichTypes(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeInlineSandwichType = (index: number) => {
    setInlineSandwichTypes(prev => prev.filter((_, i) => i !== index));
  };

  const quickToggleBoolean = (id: number, field: 'isConfirmed' | 'addedToOfficialSheet', currentValue: boolean) => {
    updateEventRequestMutation.mutate({
      id,
      data: { [field]: !currentValue },
    });
  };

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

  const handleReschedule = (request: EventRequest) => {
    setRescheduleRequest(request);
    setShowRescheduleDialog(true);
  };

  const performReschedule = async (eventId: number, newDate: Date) => {
    await rescheduleEventMutation.mutateAsync({ id: eventId, newDate });
    setShowRescheduleDialog(false);
    setRescheduleRequest(null);
  };

  return (
    <>
      {scheduledRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No scheduled events
        </div>
      ) : (
        <div className="space-y-4 max-w-7xl mx-auto px-4">
          {scheduledRequests.map((request) => (
            <div key={request.id} className="w-full">
              <ScheduledCardEnhanced
                request={request}
                editingField={editingField}
                editingValue={editingValue}
                isEditingThisCard={editingScheduledId === request.id}
                inlineSandwichMode={inlineSandwichMode}
                inlineTotalCount={inlineTotalCount}
                inlineSandwichTypes={inlineSandwichTypes}
                inlineRangeMin={inlineRangeMin}
                inlineRangeMax={inlineRangeMax}
                inlineRangeType={inlineRangeType}
                isSaving={updateEventRequestMutation.isPending || updateScheduledFieldMutation.isPending}
                onEdit={() => {
                  setSelectedEventRequest(request);
                  setIsEditing(true);
                  setShowEventDetails(true);
                }}
                onDelete={() => deleteEventRequestMutation.mutate(request.id)}
                onContact={() => {
                  setContactEventRequest(request);
                  setShowContactOrganizerDialog(true);
                }}
                onLogContact={() => {
                  setLogContactEventRequest(request);
                  setShowLogContactDialog(true);
                }}
                onFollowUp={() => {
                  setShowOneDayFollowUpDialog(true);
                }}
                onReschedule={() => {
                  setRescheduleRequest(request);
                  setShowRescheduleDialog(true);
                }}
                onAssignTspContact={() => {
                  setTspContactEventRequest(request);
                  setShowTspContactAssignmentDialog(true);
                }}
                onEditTspContact={() => {
                  setTspContactEventRequest(request);
                  setShowTspContactAssignmentDialog(true);
                }}
                startEditing={(field, value) => startEditing(request.id, field, value)}
                saveEdit={saveEdit}
                cancelEdit={cancelEdit}
                setEditingValue={setEditingValue}
                tempIsConfirmed={tempIsConfirmed}
                setTempIsConfirmed={setTempIsConfirmed}
                quickToggleBoolean={(field, value) => quickToggleBoolean(request.id, field, value)}
                setInlineSandwichMode={setInlineSandwichMode}
                setInlineTotalCount={setInlineTotalCount}
                setInlineRangeMin={setInlineRangeMin}
                setInlineRangeMax={setInlineRangeMax}
                setInlineRangeType={setInlineRangeType}
                addInlineSandwichType={addInlineSandwichType}
                updateInlineSandwichType={updateInlineSandwichType}
                removeInlineSandwichType={removeInlineSandwichType}
                resolveUserName={resolveUserName}
                openAssignmentDialog={(type) => openAssignmentDialog(request.id, type)}
                handleRemoveAssignment={(type, personId) => handleRemoveAssignment(personId, type, request.id)}
                canEdit={true}
              />
            </div>
          ))}
        </div>
      )}

    <RescheduleDialog
      isOpen={showRescheduleDialog}
      onClose={() => {
        setShowRescheduleDialog(false);
        setRescheduleRequest(null);
      }}
      request={rescheduleRequest}
      onReschedule={performReschedule}
    />
    {ConfirmationDialogComponent}
  </>
  );
};