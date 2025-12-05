import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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
    onSuccess: (_, deletedId) => {
      const { dismiss } = toast({
        title: 'Event request deleted',
        description: 'Click Undo to restore',
        duration: 5000,
        action: (
          <button
            onClick={async () => {
              try {
                await apiRequest('POST', `/api/event-requests/${deletedId}/restore`);
                queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
                queryClient.invalidateQueries({ queryKey: ['/api/event-requests', 'v2'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests', 'v2'] });
      queryClient.invalidateQueries({ queryKey: ['/api/event-map'] });
      setShowEventDetails(false);
      setSelectedEventRequest(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete event request.',
        variant: 'destructive',
      });
    },
  });

  const updateEventRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => {
      logger.log('=== UPDATE MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('Data being sent:', JSON.stringify(data, null, 2));
      return apiRequest('PATCH', `/api/event-requests/${id}`, data);
    },
    onSuccess: (updatedEvent, variables) => {
      logger.log('=== UPDATE SUCCESS ===');
      logger.log('Updated event:', updatedEvent);
      logger.log('Variables:', variables);

      toast({
        title: 'Event request updated',
        description: 'The event request has been successfully updated.',
      });

      // Use refetchQueries to force immediate data refresh
      // This is necessary because staleTime is set to 5 minutes which can prevent immediate refetch
      // NOTE: Do NOT await this - it blocks dialog close and causes poor UX
      queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      // Invalidate event map if address or coordinates might have changed
      queryClient.invalidateQueries({
        queryKey: ['/api/event-map'],
        refetchType: 'active'
      });

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
      toast({
        title: 'Update Failed',
        description:
          error?.message ||
          error?.details ||
          'Failed to update event request. Please check your data and try again.',
        variant: 'destructive',
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
      
      toast({
        title: 'Event request created',
        description: 'The new event request has been successfully created.',
      });

      await queryClient.invalidateQueries({
        queryKey: ['/api/event-requests'],
        refetchType: 'all'
      });
      await queryClient.invalidateQueries({
        queryKey: ['/api/event-requests', 'v2'],
        refetchType: 'all'
      });
      await queryClient.invalidateQueries({
        queryKey: ['/api/event-map'],
        refetchType: 'all'
      });

      await queryClient.refetchQueries({
        queryKey: ['/api/event-requests']
      });
      await queryClient.refetchQueries({
        queryKey: ['/api/event-requests', 'v2']
      });

      setShowEventDetails(false);
      setSelectedEventRequest(null);
      setIsEditing(false);
    },
    onError: (error: any) => {
      logger.error('Create event request error:', error);
      toast({
        title: 'Creation Failed',
        description:
          error?.message ||
          error?.details ||
          'Failed to create event request. Please check your data and try again.',
        variant: 'destructive',
      });
    },
  });

  const markToolkitSentMutation = useMutation({
    mutationFn: ({
      id,
      toolkitSentDate,
    }: {
      id: number;
      toolkitSentDate: string;
    }) =>
      apiRequest('PATCH', `/api/event-requests/${id}/toolkit-sent`, {
        toolkitSentDate,
      }),
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: 'Toolkit marked as sent',
        description: 'Event status updated to "In Process".',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests', 'v2'] });

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
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to mark toolkit as sent.',
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
    onSuccess: (updatedEvent, variables) => {
      toast({
        title: 'Call scheduled',
        description: 'Call has been scheduled successfully.',
      });
      
      // Use refetchQueries for immediate data refresh (don't await - it blocks dialog close)
      queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        apiRequest('GET', `/api/event-requests/${variables.id}`)
          .then(freshEventData => setSelectedEventRequest(freshEventData))
          .catch(error => logger.error('Failed to fetch updated event data after call scheduled:', error));
      }

      setShowScheduleCallDialog(false);
      setScheduleCallDate('');
      setScheduleCallTime('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to schedule call.',
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
      value: string;
    }) => apiRequest('PATCH', `/api/event-requests/${id}`, { [field]: value }),
    onMutate: async ({ id, field, value }) => {
      // Cancel outgoing fetches so we can optimistically update
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests', 'v2'] });

      const patchList = (data: any) => {
        if (!data) return data;
        const patchArray = (arr: any[]) =>
          arr.map((item) => (item?.id === id ? { ...item, [field]: value } : item));

        if (Array.isArray(data)) return patchArray(data);
        if (Array.isArray(data?.requests)) return { ...data, requests: patchArray(data.requests) };
        if (Array.isArray(data?.items)) return { ...data, items: patchArray(data.items) };
        return data;
      };

      const previousV1 = queryClient.getQueryData(['/api/event-requests']);
      const previousV2 = queryClient.getQueryData(['/api/event-requests', 'v2']);

      queryClient.setQueryData(['/api/event-requests'], (data) => patchList(data));
      queryClient.setQueryData(['/api/event-requests', 'v2'], (data) => patchList(data));

      return { previousV1, previousV2 };
    },
    onSuccess: (updatedEvent, variables) => {
      toast({
        title: 'Field updated',
        description: 'Event field has been updated successfully.',
      });
      
      // Use refetchQueries instead of invalidateQueries to force immediate data refresh
      // This is necessary because staleTime is set to 5 minutes which can prevent immediate refetch
      // NOTE: Don't await - it blocks UI updates
      queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        apiRequest('GET', `/api/event-requests/${variables.id}`)
          .then(freshEventData => setSelectedEventRequest(freshEventData))
          .catch(error => logger.error('Failed to fetch updated event data after field update:', error));
      }

      setEditingScheduledId(null);
      setEditingField(null);
      setEditingValue('');
    },
    onError: (_error, _vars, context) => {
      // Roll back optimistic update
      if (context?.previousV1) {
        queryClient.setQueryData(['/api/event-requests'], context.previousV1);
      }
      if (context?.previousV2) {
        queryClient.setQueryData(['/api/event-requests', 'v2'], context.previousV2);
      }
      toast({
        title: 'Error',
        description: 'Failed to update field.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests', 'v2'] });
    },
  });

  const oneDayFollowUpMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, {
        followUpOneDayCompleted: true,
        followUpOneDayDate: new Date().toISOString(),
        followUpNotes: notes,
      }),
    onSuccess: (updatedEvent, variables) => {
      toast({
        title: '1-day follow-up completed',
        description: 'Follow-up has been marked as completed.',
      });
      
      // Use refetchQueries for immediate data refresh (don't await - it blocks dialog close)
      queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        apiRequest('GET', `/api/event-requests/${variables.id}`)
          .then(freshEventData => setSelectedEventRequest(freshEventData))
          .catch(error => logger.error('Failed to fetch updated event data after 1-day follow-up:', error));
      }

      setShowOneDayFollowUpDialog(false);
      setFollowUpNotes('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to complete follow-up.',
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
    onSuccess: (updatedEvent, variables) => {
      toast({
        title: '1-month follow-up completed',
        description: 'Follow-up has been marked as completed.',
      });
      
      // Use refetchQueries for immediate data refresh (don't await - it blocks dialog close)
      queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        apiRequest('GET', `/api/event-requests/${variables.id}`)
          .then(freshEventData => setSelectedEventRequest(freshEventData))
          .catch(error => logger.error('Failed to fetch updated event data after 1-month follow-up:', error));
      }

      setShowOneMonthFollowUpDialog(false);
      setFollowUpNotes('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to complete follow-up.',
        variant: 'destructive',
      });
    },
  });

  const rescheduleEventMutation = useMutation({
    mutationFn: ({ id, newDate }: { id: number; newDate: Date }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, {
        scheduledEventDate: newDate.toISOString(),
      }),
    onSuccess: () => {
      toast({
        title: 'Event rescheduled',
        description: 'The event date has been updated successfully.',
      });
      // Use refetchQueries for immediate data refresh (don't await - it blocks UI updates)
      queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to reschedule event.',
        variant: 'destructive',
      });
    },
  });

  // Recipient assignment mutation - uses the specific recipients endpoint
  const assignRecipientsMutation = useMutation({
    mutationFn: ({ id, assignedRecipientIds }: { id: number; assignedRecipientIds: string[] }) => {
      logger.log('=== RECIPIENT ASSIGNMENT MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('Recipient IDs:', assignedRecipientIds);
      return apiRequest('PATCH', `/api/event-requests/${id}/recipients`, { assignedRecipientIds });
    },
    onSuccess: (updatedEvent, variables) => {
      logger.log('=== RECIPIENT ASSIGNMENT SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      toast({
        title: 'Recipients assigned',
        description: 'Recipients have been successfully assigned to this event.',
      });

      // Use refetchQueries for immediate data refresh (don't await - it blocks dialog close)
      queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      // Update the selected event if it matches
      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        apiRequest('GET', `/api/event-requests/${variables.id}`)
          .then(freshEventData => setSelectedEventRequest(freshEventData))
          .catch(error => logger.error('Failed to fetch updated event data:', error));
      }
    },
    onError: (error) => {
      logger.error('=== RECIPIENT ASSIGNMENT ERROR ===');
      logger.error(error);

      toast({
        title: 'Failed to assign recipients',
        description: 'There was an error assigning recipients to this event.',
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
    onSuccess: (updatedEvent, variables) => {
      logger.log('=== TSP CONTACT ASSIGNMENT SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      const description = variables.tspContact
        ? 'TSP contact has been successfully assigned and notified via email.'
        : 'Custom TSP contact has been successfully assigned.';

      toast({
        title: 'TSP contact assigned',
        description,
      });

      // Use refetchQueries for immediate data refresh (don't await - it blocks dialog close)
      queryClient.refetchQueries({ queryKey: ['/api/event-requests', 'v2'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      // Update the selected event if it matches
      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        apiRequest('GET', `/api/event-requests/${variables.id}`)
          .then(freshEventData => setSelectedEventRequest(freshEventData))
          .catch(error => logger.error('Failed to fetch updated event data:', error));
      }
    },
    onError: (error) => {
      logger.error('=== TSP CONTACT ASSIGNMENT ERROR ===');
      logger.error(error);

      toast({
        title: 'Failed to assign TSP contact',
        description: 'There was an error assigning the TSP contact to this event.',
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
  };
};
