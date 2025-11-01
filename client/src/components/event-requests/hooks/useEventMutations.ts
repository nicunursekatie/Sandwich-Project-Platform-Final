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
    onSuccess: () => {
      toast({
        title: 'Event request deleted',
        description: 'The event request has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
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
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== UPDATE SUCCESS ===');
      logger.log('Updated event:', updatedEvent);
      logger.log('Variables:', variables);

      toast({
        title: 'Event request updated',
        description: 'The event request has been successfully updated.',
      });

      await queryClient.invalidateQueries({
        queryKey: ['/api/event-requests'],
        refetchType: 'all'
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

      await queryClient.refetchQueries({
        queryKey: ['/api/event-requests']
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
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: 'Call scheduled',
        description: 'Call has been scheduled successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

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
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: 'Field updated',
        description: 'Event field has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

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
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update field.',
        variant: 'destructive',
      });
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
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

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
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: '1-month follow-up completed',
        description: 'Follow-up has been marked as completed.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

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
    onSuccess: async () => {
      toast({
        title: 'Event rescheduled',
        description: 'The event date has been updated successfully.',
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
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
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== RECIPIENT ASSIGNMENT SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      toast({
        title: 'Recipients assigned',
        description: 'Recipients have been successfully assigned to this event.',
      });

      // Invalidate and refetch event requests
      await queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      // Update the selected event if it matches
      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data:', error);
        }
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
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== TSP CONTACT ASSIGNMENT SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      const description = variables.tspContact
        ? 'TSP contact has been successfully assigned and notified via email.'
        : 'Custom TSP contact has been successfully assigned.';

      toast({
        title: 'TSP contact assigned',
        description,
      });

      // Invalidate and refetch event requests
      await queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      // Update the selected event if it matches
      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data:', error);
        }
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