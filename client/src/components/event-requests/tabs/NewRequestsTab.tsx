import React, { useState } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConfirmation } from '@/components/ui/confirmation-dialog';
import { NewRequestCard } from '../cards/NewRequestCard';

export const NewRequestsTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { confirm, ConfirmationDialogComponent } = useConfirmation();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation, updateEventRequestMutation } = useEventMutations();
  const { handleStatusChange } = useEventAssignments();

  // Inline editing state
  const [editingNewRequestId, setEditingNewRequestId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [tempIsConfirmed, setTempIsConfirmed] = useState(false);

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
    setShowLogContactDialog,
    setLogContactEventRequest,
    setShowAiDateSuggestionDialog,
    setAiSuggestionEventRequest,
    setShowAiIntakeAssistantDialog,
    setAiIntakeAssistantEventRequest,
  } = useEventRequestContext();

  const newRequests = filterRequestsByStatus('new');

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

  // Inline editing functions
  const startEditing = (id: number, field: string, currentValue: string) => {
    setEditingNewRequestId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');

    // When editing a date field, also load the current confirmation status
    if (field === 'desiredEventDate' || field === 'scheduledEventDate') {
      const eventRequest = newRequests.find(req => req.id === id);
      if (eventRequest) {
        setTempIsConfirmed(eventRequest.isConfirmed || false);
      }
    }
  };

  const saveEdit = () => {
    if (editingNewRequestId && editingField) {
      // Define the actual save logic
      const performSave = () => {
        if (editingField === 'isConfirmed') {
          // Special handling for boolean toggles
          const boolValue = editingValue === 'true';
          updateEventRequestMutation.mutate({
            id: editingNewRequestId,
            data: { [editingField]: boolValue },
          });
        } else if (editingField === 'desiredEventDate' || editingField === 'scheduledEventDate') {
          // When saving a date field, also save the confirmation status if needed
          updateEventRequestMutation.mutate({
            id: editingNewRequestId,
            data: {
              [editingField]: editingValue,
              isConfirmed: tempIsConfirmed,
            },
          });
        } else {
          // Default handling for other fields
          updateEventRequestMutation.mutate({
            id: editingNewRequestId,
            data: { [editingField]: editingValue },
          });
        }
      };

      // Always show confirmation for inline edits
      const fieldName = editingField.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
      confirm(
        `Update ${fieldName}`,
        `Are you sure you want to update ${fieldName}?`,
        () => {
          performSave();
          // Reset editing state
          setEditingNewRequestId(null);
          setEditingField(null);
          setEditingValue('');
        },
        'default',
        () => {
          // Reset editing state on cancel
          setEditingNewRequestId(null);
          setEditingField(null);
          setEditingValue('');
        }
      );
    }
  };

  const cancelEdit = () => {
    setEditingNewRequestId(null);
    setEditingField(null);
    setEditingValue('');
  };

  return (
    <>
      {newRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No new event requests
        </div>
      ) : (
        <div className="space-y-4">
          {newRequests.map((request) => (
            <NewRequestCard
              key={request.id}
              request={request}
              onEdit={() => {
                setSelectedEventRequest(request);
                setIsEditing(true);
                setShowEventDetails(true);
              }}
              onDelete={() => deleteEventRequestMutation.mutate(request.id)}
              onCall={() => handleCall(request)}
              onContact={() => {
                setContactEventRequest(request);
                setShowContactOrganizerDialog(true);
              }}
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
              onAiSuggest={() => {
                setAiSuggestionEventRequest(request);
                setShowAiDateSuggestionDialog(true);
              }}
              onAiIntakeAssist={() => {
                setAiIntakeAssistantEventRequest(request);
                setShowAiIntakeAssistantDialog(true);
              }}
              // Inline editing props
              startEditing={(field, value) => startEditing(request.id, field, value)}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              setEditingValue={setEditingValue}
              isEditingThisCard={editingNewRequestId === request.id}
              editingField={editingField || ''}
              editingValue={editingValue}
              tempIsConfirmed={tempIsConfirmed}
            />
          ))}
        </div>
      )}
      {ConfirmationDialogComponent}
    </>
  );
};