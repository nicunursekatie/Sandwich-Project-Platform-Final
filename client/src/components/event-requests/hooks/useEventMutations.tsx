import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, invalidateEventRequestQueries } from '@/lib/queryClient';
import { useEventRequestContext } from '../context/EventRequestContext';
import { logger } from '@/lib/logger';

export const useEventMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    selectedEventRequest,
    setSelectedEventRequest,
    setShowEventDetails,
    setIsEditing,
    setShowToolkitSentDialog,
    setToolkitEventRequest,
    setShowScheduleCallDialog,
    setScheduleCallDate,
    setScheduleCallTime,
    setShowOneDayFollowUpDialog,
    setShowOneMonthFollowUpDialog,
    setFollowUpNotes,
    setEditingScheduledId,
    setEditingField,
    setEditingValue,
  } = useEventRequestContext();

  const deleteEventRequestMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('DELETE', `/api/event-requests/${id}`),
    onSuccess: async (_, deletedId) => {
      const { dismiss } = toast({
        title: 'Event request deleted',
        description: 'Click Undo to restore',
        duration: 10000,
        action: (
          <button
            onClick={async () => {
              try {
                await apiRequest('POST', `/api/event-requests/${deletedId}/restore`);
                await invalidateEventRequestQueries(queryClient);
                dismiss();
                toast({
                  title: 'Event request restored',
                  description: 'The event request has been successfully restored.',
                });
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'Failed to restore event request.',
                  variant: 'destructive',
                });
              }
            }}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Undo
          </button>
        ),
      });
      await invalidateEventRequestQueries(queryClient);
      setShowEventDetails(false);
      setSelectedEventRequest(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || 'Failed to delete event request.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const updateEventRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => {
      logger.log('=== UPDATE MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('Data being sent:', JSON.stringify(data, null, 2));

      // Row-level updatedAt locking was removed server-side (PR #417) and the
      // legacy _expectedVersion field is ignored/stripped there. Keep the
      // client payload clean so this path behaves like the other PATCH flows.
      const { _skipVersionCheck, ...rest } = data;
      const payload = { ...rest };

      return apiRequest('PATCH', `/api/event-requests/${id}`, payload);
    },
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== UPDATE SUCCESS ===');
      logger.log('Updated event:', updatedEvent);
      logger.log('Variables:', variables);

      const orgName = updatedEvent?.organizationName || 'Event';

      // Server attaches _droppedFields when it silently skipped any fields during processing
      // (invalid dates, missing columns, permission-gated fields, etc.). Surface that to the user
      // so silent drops never go unnoticed again.
      const droppedFields: Array<{ field: string; reason: string }> | undefined = updatedEvent?._droppedFields;
      if (Array.isArray(droppedFields) && droppedFields.length > 0) {
        logger.warn('Save succeeded but some fields were dropped:', droppedFields);
        const summary = droppedFields
          .map((d) => `• ${d.field}: ${d.reason}`)
          .join('\n');
        toast({
          title: '⚠️ Partial Save',
          description: `Saved "${orgName}" — but the following fields were not saved:\n${summary}`,
          variant: 'destructive',
          duration: Number.POSITIVE_INFINITY,
        });
      } else {
        toast({
          title: '✓ Changes Saved Successfully',
          description: `Your changes to "${orgName}" have been saved to the database.`,
          duration: 8000,
        });
      }

      // Await query invalidation so the UI has fresh data before we close the dialog
      await invalidateEventRequestQueries(queryClient);

      setShowEventDetails(false);
      setSelectedEventRequest(null);
      setIsEditing(false);

      // Clear inline editing state as well
      setEditingScheduledId(null);
      setEditingField(null);
      setEditingValue('');
    },
    onError: (error: any) => {
      logger.error('Update event request error:', error);

      const status = error?.status;
      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Request timeout') ||
                            error?.code?.includes('NETWORK_ERROR');
      const isConflict = status === 409 || error?.code?.includes('CONFLICT');
      const isPermissionDenied = status === 403;
      const isUnauthenticated = status === 401;

      const serverMessage = error?.data?.message ||
                           error?.message ||
                           error?.details;
      const missingFields = error?.data?.missingFields;

      let errorTitle = 'Save Failed';
      let errorDescription = serverMessage || 'Failed to update event request. Please check your data and try again.';

      if (missingFields && Array.isArray(missingFields) && missingFields.length > 0) {
        errorDescription = `${serverMessage || 'Missing required fields:'} ${missingFields.join(', ')}`;
      }

      if (isConflict) {
        errorTitle = 'Edit Conflict';
        errorDescription = 'This event was modified by another user or process. The latest data has been loaded — please reapply your changes and save again.';
        // Refresh the data so the user sees the latest version. Selected event
        // is also re-fetched so the next save attempt starts from fresh data.
        invalidateEventRequestQueries(queryClient);
        if (selectedEventRequest?.id) {
          (async () => {
            try {
              const fresh = await apiRequest('GET', `/api/event-requests/${selectedEventRequest.id}`);
              setSelectedEventRequest(fresh);
            } catch {
              // best-effort — invalidation above will repopulate next time the dialog is opened
            }
          })();
        }
      } else if (isPermissionDenied) {
        errorTitle = 'Permission Denied';
        errorDescription = "Your account doesn't have permission to edit events. Ask an admin to grant you the EVENT_REQUESTS_EDIT permission.";
      } else if (isUnauthenticated) {
        errorTitle = 'Session Expired';
        errorDescription = 'Your session has expired. Please refresh the page and sign in again.';
      } else if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription = 'Could not save changes. Please check your internet connection and try again.';
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
        // Save failures are sticky — they don't auto-dismiss. User must click ✕ to acknowledge,
        // so silent failures stop slipping past busy operators.
        duration: Number.POSITIVE_INFINITY,
      });
    },
  });

  const createEventRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      logger.log('=== CREATE EVENT MUTATION STARTED ===');
      logger.log('Data being sent:', JSON.stringify(data, null, 2));
      const result = await apiRequest('POST', '/api/event-requests', data);
      logger.log('=== CREATE EVENT API RESPONSE ===');
      logger.log('Response:', result);
      return result;
    },
    onSuccess: async (data) => {
      logger.log('=== CREATE EVENT SUCCESS HANDLER ===');
      logger.log('Created event:', data);

      const orgName = data?.organizationName || 'New event';
      toast({
        title: '✓ Event Created Successfully',
        description: `"${orgName}" has been created and saved to the database.`,
        duration: 8000,
      });

      // Await query invalidation so the list reflects the new event
      await invalidateEventRequestQueries(queryClient);

      setShowEventDetails(false);
      setSelectedEventRequest(null);
      setIsEditing(false);
    },
    onError: (error: any) => {
      logger.error('Create event request error:', error);

      // Check for network/timeout errors
      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Request timeout') ||
                            error?.code?.includes('NETWORK_ERROR');

      let errorTitle = 'Creation Failed';
      let errorDescription = error?.data?.message || error?.message || 'Failed to create event request. Please check your data and try again.';

      if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription = 'Could not create event. Please check your internet connection and try again.';
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  const markToolkitSentMutation = useMutation({
    mutationFn: ({
      id,
      toolkitSentDate,
      contactAttempt,
    }: {
      id: number;
      toolkitSentDate: string;
      contactAttempt?: {
        method: string;
        outcome: string;
        notes?: string;
      };
    }) =>
      apiRequest('PATCH', `/api/event-requests/${id}/toolkit-sent`, {
        toolkitSentDate,
        contactAttempt,
      }),
    onSuccess: async (updatedEvent, variables) => {
      const message = variables.contactAttempt
        ? 'Toolkit marked as sent and phone call logged.'
        : 'Event status updated to "In Process".';
      toast({
        title: 'Toolkit marked as sent',
        description: message,
      });
      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after toolkit sent:', error);
        }
      }

      setShowToolkitSentDialog(false);
      setToolkitEventRequest(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to mark toolkit as sent.',
        variant: 'destructive',
      });
    },
  });

  const scheduleCallMutation = useMutation({
    mutationFn: ({
      id,
      scheduledCallDate,
    }: {
      id: number;
      scheduledCallDate: string;
    }) =>
      apiRequest('PATCH', `/api/event-requests/${id}/schedule-call`, {
        scheduledCallDate,
      }),
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: 'Call scheduled',
        description: 'Call has been scheduled successfully.',
      });

      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after call scheduled:', error);
        }
      }

      setShowScheduleCallDialog(false);
      setScheduleCallDate('');
      setScheduleCallTime('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to schedule call.',
        variant: 'destructive',
      });
    },
  });

  const updateScheduledFieldMutation = useMutation({
    mutationFn: ({
      id,
      field,
      value,
    }: {
      id: number;
      field: string;
      value: any;
    }) => apiRequest('PATCH', `/api/event-requests/${id}`, { [field]: value }),
    // No optimistic update: the previous one patched ['/api/event-requests'] and
    // [..,'v2'] cache keys that nothing reads (the list uses
    // ['/api/event-requests/list', .., 'v3']), so it never affected the UI.
    // onSettled below refreshes the real queries.
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: 'Field updated',
        description: 'Event field has been updated successfully.',
      });

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after field update:', error);
        }
      }

      setEditingScheduledId(null);
      setEditingField(null);
      setEditingValue('');
    },
    onError: (error: any) => {
      logger.error('Inline field update error:', error);

      const status = error?.status;
      let errorTitle = 'Save Failed';
      let errorDescription = error?.data?.message || error?.message || 'Failed to update field.';

      if (status === 403) {
        errorTitle = 'Permission Denied';
        errorDescription = "Your account doesn't have permission to edit events. Ask an admin to grant you the EVENT_REQUESTS_EDIT permission.";
      } else if (status === 401) {
        errorTitle = 'Session Expired';
        errorDescription = 'Your session has expired. Please refresh the page and sign in again.';
      } else if (status === 409) {
        errorTitle = 'Edit Conflict';
        errorDescription = 'This event was modified by another user or process. The latest data has been loaded — please try your edit again.';
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
        // Sticky toast so a quick destructive error isn't missed during busy editing sessions.
        duration: Number.POSITIVE_INFINITY,
      });
    },
    // Refetch once in onSettled (covers both success and error paths).
    // Removed duplicate invalidation that was in onSuccess.
    onSettled: () => {
      invalidateEventRequestQueries(queryClient);
    },
  });

  const oneDayFollowUpMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, {
        followUpOneDayCompleted: true,
        followUpOneDayDate: new Date().toISOString(),
        followUpNotes: notes,
      }),
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: '1-day follow-up completed',
        description: 'Follow-up has been marked as completed.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after 1-day follow-up:', error);
        }
      }

      setShowOneDayFollowUpDialog(false);
      setFollowUpNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to complete follow-up.',
        variant: 'destructive',
      });
    },
  });

  const oneMonthFollowUpMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, {
        followUpOneMonthCompleted: true,
        followUpOneMonthDate: new Date().toISOString(),
        followUpNotes: notes,
      }),
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: '1-month follow-up completed',
        description: 'Follow-up has been marked as completed.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after 1-month follow-up:', error);
        }
      }

      setShowOneMonthFollowUpDialog(false);
      setFollowUpNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to complete follow-up.',
        variant: 'destructive',
      });
    },
  });

  const rescheduleEventMutation = useMutation({
    mutationFn: ({ id, newDate, previousDate }: { id: number; newDate: Date; previousDate?: string | null }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, {
        scheduledEventDate: newDate.toISOString(),
      }),
    onSuccess: (_, variables) => {
      const { id, newDate, previousDate } = variables;
      const newDateStr = newDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const prevDateStr = previousDate
        ? new Date(previousDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

      // Show toast with undo action if we have a previous date
      if (previousDate) {
        const { dismiss } = toast({
          title: 'Event rescheduled',
          description: `Date changed to ${newDateStr}. Click Undo to restore.`,
          duration: 10000,
          action: (
            <button
              onClick={async () => {
                try {
                  await apiRequest('PATCH', `/api/event-requests/${id}`, {
                    scheduledEventDate: previousDate,
                  });
                  invalidateEventRequestQueries(queryClient);
                  dismiss();
                  toast({
                    title: 'Date restored',
                    description: `Event date restored to ${prevDateStr}.`,
                  });
                } catch (error) {
                  toast({
                    title: 'Restore failed',
                    description: 'Failed to restore event date.',
                    variant: 'destructive',
                  });
                }
              }}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Undo
            </button>
          ),
        });
      } else {
        toast({
          title: 'Event rescheduled',
          description: `The event date has been set to ${newDateStr}.`,
        });
      }

      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to reschedule event.',
        variant: 'destructive',
      });
    },
  });

  // Recipient assignment mutation - uses the specific recipients endpoint
  const assignRecipientsMutation = useMutation({
    mutationFn: ({ id, assignedRecipientIds, recipientAllocations }: {
      id: number;
      assignedRecipientIds?: string[];
      recipientAllocations?: Array<{
        recipientId: string;
        recipientName: string;
        sandwichCount: number;
        sandwichType?: string;
        notes?: string;
      }>;
    }) => {
      logger.log('=== RECIPIENT ASSIGNMENT MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('Recipient IDs:', assignedRecipientIds);
      logger.log('Recipient Allocations:', recipientAllocations);
      return apiRequest('PATCH', `/api/event-requests/${id}/recipients`, { assignedRecipientIds, recipientAllocations });
    },
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== RECIPIENT ASSIGNMENT SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      toast({
        title: 'Recipients assigned',
        description: 'Recipients have been successfully assigned to this event.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data:', error);
        }
      }
    },
    onError: (error: any) => {
      logger.error('=== RECIPIENT ASSIGNMENT ERROR ===');
      logger.error(error);

      toast({
        title: 'Failed to assign recipients',
        description: error?.data?.message || error?.message || 'There was an error assigning recipients to this event.',
        variant: 'destructive',
      });
    },
  });

  // TSP contact assignment mutation - uses the specific tsp-contact endpoint
  const assignTspContactMutation = useMutation({
    mutationFn: ({ id, tspContact, customTspContact }: { id: number; tspContact?: string | null; customTspContact?: string | null }) => {
      logger.log('=== TSP CONTACT ASSIGNMENT MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('TSP Contact:', tspContact);
      logger.log('Custom TSP Contact:', customTspContact);
      return apiRequest('PATCH', `/api/event-requests/${id}/tsp-contact`, { tspContact, customTspContact });
    },
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== TSP CONTACT ASSIGNMENT SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      const isRemoval = !variables.tspContact && !variables.customTspContact;
      const isCustom = !!variables.customTspContact;

      toast({
        title: isRemoval ? 'TSP contact removed' : 'TSP contact assigned',
        description: isRemoval
          ? 'The TSP contact assignment has been cleared.'
          : isCustom
            ? 'Custom TSP contact has been successfully assigned.'
            : 'TSP contact has been successfully assigned and notified.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data:', error);
        }
      }
    },
    onError: (error: any) => {
      logger.error('=== TSP CONTACT ASSIGNMENT ERROR ===');
      logger.error(error);

      toast({
        title: 'Failed to assign TSP contact',
        description: error?.data?.message || error?.message || 'There was an error assigning the TSP contact to this event.',
        variant: 'destructive',
      });
    },
  });

  // Corporate priority toggle mutation
  const toggleCorporatePriorityMutation = useMutation({
    mutationFn: ({ id, isCorporatePriority, coreTeamMemberNotes }: {
      id: number;
      isCorporatePriority: boolean;
      coreTeamMemberNotes?: string;
    }) => {
      logger.log('=== CORPORATE PRIORITY TOGGLE MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('Corporate Priority:', isCorporatePriority);
      return apiRequest('PATCH', `/api/event-requests/${id}/corporate-priority`, {
        isCorporatePriority,
        coreTeamMemberNotes
      });
    },
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== CORPORATE PRIORITY TOGGLE SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      const action = variables.isCorporatePriority ? 'marked as' : 'removed from';
      toast({
        title: `Event ${action} Corporate Priority`,
        description: variables.isCorporatePriority
          ? 'Christine and Katie have been notified. This event requires immediate attention and core team member assignment.'
          : 'This event is no longer marked as corporate priority.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data:', error);
        }
      }
    },
    onError: (error: any) => {
      logger.error('=== CORPORATE PRIORITY TOGGLE ERROR ===');
      logger.error(error);

      toast({
        title: 'Failed to update corporate priority',
        description: error?.data?.message || error?.message || 'There was an error updating the corporate priority status.',
        variant: 'destructive',
      });
    },
  });

  return {
    deleteEventRequestMutation,
    updateEventRequestMutation,
    createEventRequestMutation,
    markToolkitSentMutation,
    scheduleCallMutation,
    updateScheduledFieldMutation,
    oneDayFollowUpMutation,
    oneMonthFollowUpMutation,
    rescheduleEventMutation,
    assignRecipientsMutation,
    assignTspContactMutation,
    toggleCorporatePriorityMutation,
  };
};
