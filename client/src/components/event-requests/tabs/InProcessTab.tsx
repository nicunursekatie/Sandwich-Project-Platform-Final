import React, { useState } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConfirmation } from '@/components/ui/confirmation-dialog';
import { InProcessCard } from '../cards/InProcessCard';

export const InProcessTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { confirm, ConfirmationDialogComponent } = useConfirmation();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation, updateEventRequestMutation } = useEventMutations();
  const { handleStatusChange, resolveUserName } = useEventAssignments();

  // Inline editing state
  const [editingInProcessId, setEditingInProcessId] = useState<number | null>(null);
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
    setTspContactEventRequest,
    setShowTspContactAssignmentDialog,
    setShowLogContactDialog,
    setLogContactEventRequest,
    setShowAiDateSuggestionDialog,
    setAiSuggestionEventRequest,
  } = useEventRequestContext();

  const inProcessRequests = filterRequestsByStatus('in_process');

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

  // Check if event needs follow-up
  // Returns: 'toolkit' if toolkit sent > 1 week ago and no recent contact attempts
  //          'contact' if last contact attempt > 1 week ago
  //          null if no follow-up needed
  const getFollowUpStatus = (request: any) => {
    if (request.status !== 'in_process') return null;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // If there's a contact attempt logged
    if (request.contactAttempts && request.contactAttempts > 0 && request.lastContactAttempt) {
      const lastContactDate = new Date(request.lastContactAttempt);
      // If last contact was more than a week ago, need follow-up on that contact
      if (lastContactDate < oneWeekAgo) {
        return 'contact';
      }
      // If last contact was within a week, no follow-up needed
      return null;
    }
    
    // No contact attempts - check if toolkit sent over a week ago
    if (request.toolkitSentDate && new Date(request.toolkitSentDate) < oneWeekAgo) {
      return 'toolkit';
    }
    
    // Fallback: check if status changed to in_process over a week ago (for events without toolkit)
    if (request.statusChangedAt && new Date(request.statusChangedAt) < oneWeekAgo) {
      return 'toolkit';
    }
    
    return null;
  };
  
  // For backwards compatibility
  const isStale = (request: any) => {
    return getFollowUpStatus(request) === 'toolkit';
  };

  // Inline editing functions
  const startEditing = (id: number, field: string, currentValue: string) => {
    setEditingInProcessId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');

    // When editing a date field, also load the current confirmation status
    if (field === 'desiredEventDate' || field === 'scheduledEventDate') {
      const eventRequest = inProcessRequests.find(req => req.id === id);
      if (eventRequest) {
        setTempIsConfirmed(eventRequest.isConfirmed || false);
      }
    }
  };

  const saveEdit = () => {
    if (editingInProcessId && editingField) {
      // Define the actual save logic
      const performSave = () => {
        if (editingField === 'isConfirmed') {
          // Special handling for boolean toggles
          const boolValue = editingValue === 'true';
          updateEventRequestMutation.mutate({
            id: editingInProcessId,
            data: { [editingField]: boolValue },
          });
        } else if (editingField === 'desiredEventDate' || editingField === 'scheduledEventDate') {
          // When saving a date field, also save the confirmation status if needed
          updateEventRequestMutation.mutate({
            id: editingInProcessId,
            data: {
              [editingField]: editingValue,
              isConfirmed: tempIsConfirmed,
            },
          });
        } else {
          // Default handling for other fields
          updateEventRequestMutation.mutate({
            id: editingInProcessId,
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
          setEditingInProcessId(null);
          setEditingField(null);
          setEditingValue('');
        },
        'default',
        () => {
          // Reset editing state on cancel
          cancelEdit();
        }
      );
    }
  };

  const cancelEdit = () => {
    setEditingInProcessId(null);
    setEditingField(null);
    setEditingValue('');
  };

  return (
    <>
      {inProcessRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No events in process
        </div>
      ) : (
        <div className="space-y-4">
          {inProcessRequests.map((request) => (
            <InProcessCard
              key={request.id}
              request={request}
              resolveUserName={resolveUserName}
              isStale={isStale(request)}
              followUpStatus={getFollowUpStatus(request)}
              onEdit={() => {
                setSelectedEventRequest(request);
                setIsEditing(true);
                setShowEventDetails(true);
              }}
              onDelete={() => deleteEventRequestMutation.mutate(request.id)}
              onSchedule={() => {
                setSchedulingEventRequest(request);
                setShowSchedulingDialog(true);
              }}
              onCall={() => handleCall(request)}
              onContact={() => {
                setContactEventRequest(request);
                setShowContactOrganizerDialog(true);
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
              onLogContact={() => {
                setLogContactEventRequest(request);
                setShowLogContactDialog(true);
              }}
              onAiSuggest={() => {
                setAiSuggestionEventRequest(request);
                setShowAiDateSuggestionDialog(true);
              }}
              // Inline editing props
              startEditing={(field, value) => startEditing(request.id, field, value)}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              setEditingValue={setEditingValue}
              isEditingThisCard={editingInProcessId === request.id}
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