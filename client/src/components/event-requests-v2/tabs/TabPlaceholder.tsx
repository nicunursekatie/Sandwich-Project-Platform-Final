import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import RequestCard from '@/components/event-requests/RequestCard';

interface TabPlaceholderProps {
  status: 'in_process' | 'scheduled' | 'completed' | 'declined';
}

export const TabPlaceholder: React.FC<TabPlaceholderProps> = ({ status }) => {
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
    setCollectionLogEventRequest,
    setShowCollectionLog,

    // Inline editing states
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
    eventRequests,
  } = useEventRequestContext();

  const requests = filterRequestsByStatus(status);

  // Inline editing functions for scheduled tab
  const startEditing = (id: number, field: string, currentValue: string) => {
    if (status !== 'scheduled') return;

    setEditingScheduledId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');

    if (field === 'sandwichTypes') {
      const eventRequest = eventRequests.find(req => req.id === id);
      if (eventRequest) {
        const existingSandwichTypes = eventRequest.sandwichTypes ?
          (typeof eventRequest.sandwichTypes === 'string' ?
            JSON.parse(eventRequest.sandwichTypes) : eventRequest.sandwichTypes) : [];

        const hasTypesData = Array.isArray(existingSandwichTypes) && existingSandwichTypes.length > 0;
        const totalCount = eventRequest.estimatedSandwichCount || 0;

        setInlineSandwichMode(hasTypesData ? 'types' : 'total');
        setInlineTotalCount(totalCount);
        setInlineSandwichTypes(hasTypesData ? existingSandwichTypes : []);
      }
    }
  };

  const saveEdit = () => {
    // Implementation would go here - using updateEventRequestMutation
    setEditingScheduledId(null);
    setEditingField(null);
    setEditingValue('');
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

  return (
    <div className="space-y-4">
      {requests.map((request) => (
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
          onFollowUp1Day={(request) => {
            setSelectedEventRequest(request);
            setShowOneDayFollowUpDialog(true);
          }}
          onFollowUp1Month={(request) => {
            setSelectedEventRequest(request);
            setShowOneMonthFollowUpDialog(true);
          }}
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
      ))}
      {requests.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No {status.replace('_', ' ')} event requests
        </div>
      )}
    </div>
  );
};