import React, { useState } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { ScheduledCard } from '../cards/ScheduledCard';
import { RescheduleDialog } from '../dialogs/RescheduleDialog';
import { parseSandwichTypes, stringifySandwichTypes } from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';

export const ScheduledTab: React.FC = () => {
  const { toast } = useToast();
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState<EventRequest | null>(null);

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
  } = useEventRequestContext();

  const scheduledRequests = filterRequestsByStatus('scheduled');

  // Inline editing functions - SPECIFIC to scheduled tab
  const startEditing = (id: number, field: string, currentValue: string) => {
    setEditingScheduledId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');

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
      // Show confirmation for critical fields
      const criticalFields = ['eventStartTime', 'eventEndTime', 'pickupTime', 'overnightPickupTime', 'eventAddress', 'overnightHoldingLocation', 'deliveryDestination', 'hasRefrigeration', 'driversNeeded', 'speakersNeeded', 'volunteersNeeded'];

      if (criticalFields.includes(editingField)) {
        const fieldName = editingField.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
        const confirmed = window.confirm(`Are you sure you want to update ${fieldName}?\n\nThis will change the event details and may affect planning.`);
        if (!confirmed) {
          cancelEdit();
          return;
        }
      }

      // Special handling for sandwich types
      if (editingField === 'sandwichTypes') {
        const updateData: any = {};

        if (inlineSandwichMode === 'total') {
          updateData.estimatedSandwichCount = inlineTotalCount;
          updateData.sandwichTypes = null;
        } else {
          updateData.sandwichTypes = stringifySandwichTypes(inlineSandwichTypes);
          updateData.estimatedSandwichCount = inlineSandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
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
      } else {
        // Regular field update
        updateScheduledFieldMutation.mutate({
          id: editingScheduledId,
          field: editingField,
          value: editingValue,
        });
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
      <div className="space-y-4">
        {scheduledRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No scheduled events
          </div>
        ) : (
          scheduledRequests.map((request) => (
          <ScheduledCard
            key={request.id}
            request={request}
            editingField={editingField}
            editingValue={editingValue}
            isEditingThisCard={editingScheduledId === request.id}
            inlineSandwichMode={inlineSandwichMode}
            inlineTotalCount={inlineTotalCount}
            inlineSandwichTypes={inlineSandwichTypes}
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
            onStatusChange={(status) => handleStatusChange(request.id, status)}
            onFollowUp={() => {
              setSelectedEventRequest(request);
              setShowOneDayFollowUpDialog(true);
            }}
            onReschedule={() => handleReschedule(request)}
            startEditing={(field, value) => startEditing(request.id, field, value)}
            saveEdit={saveEdit}
            cancelEdit={cancelEdit}
            setEditingValue={setEditingValue}
            setInlineSandwichMode={setInlineSandwichMode}
            setInlineTotalCount={setInlineTotalCount}
            addInlineSandwichType={addInlineSandwichType}
            updateInlineSandwichType={updateInlineSandwichType}
            removeInlineSandwichType={removeInlineSandwichType}
            resolveUserName={resolveUserName}
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

    <RescheduleDialog
      isOpen={showRescheduleDialog}
      onClose={() => {
        setShowRescheduleDialog(false);
        setRescheduleRequest(null);
      }}
      request={rescheduleRequest}
      onReschedule={performReschedule}
    />
  </>
  );
};