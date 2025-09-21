import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useEventRequestContext } from '../context/EventRequestContext';

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
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, data),
    onSuccess: async (updatedEvent, variables) => {
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
    },
    onError: (error: any) => {
      console.error('Update event request error:', error);
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
    mutationFn: (data: any) =>
      apiRequest('POST', '/api/event-requests', data),
    onSuccess: async () => {
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
      console.error('Create event request error:', error);
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
          console.error('Failed to fetch updated event data after toolkit sent:', error);
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
          console.error('Failed to fetch updated event data after call scheduled:', error);
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
          console.error('Failed to fetch updated event data after field update:', error);
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
          console.error('Failed to fetch updated event data after 1-day follow-up:', error);
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
          console.error('Failed to fetch updated event data after 1-month follow-up:', error);
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
  };
};