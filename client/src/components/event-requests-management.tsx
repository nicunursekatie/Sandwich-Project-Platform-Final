import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function EventRequestsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update mutation for event requests
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiRequest("PUT", `/api/event-requests/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({
        title: "Event request updated",
        description: "The event request has been updated successfully",
      });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({
        title: "Error updating event request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assignment update function with debugging
  const handleAssignmentUpdate = (eventId: number, field: string, value: any) => {
    console.log('=== ASSIGNMENT UPDATE DEBUG ===');
    console.log('Field:', field);
    console.log('Raw value type:', typeof value);
    console.log('Raw value:', value);
    console.log('Is Array:', Array.isArray(value));
    
    if (field === 'assignedDriverIds' || field === 'assignedSpeakerIds') {
      console.log('JSONB field detected - value serialization check:');
      console.log('JSON.stringify test:', JSON.stringify(value));
    }

    const updateData = {
      id: eventId,
      [field]: value,
    };

    console.log('Final update data:', updateData);
    console.log('Update data serialized:', JSON.stringify(updateData));
    console.log('================================');

    updateMutation.mutate(updateData);
  };

  return (
    <div className="p-4">
      <h1>Event Requests Management</h1>
      <p>Component restored - debugging enabled for handleAssignmentUpdate</p>
      <p>Check console for detailed logging when assignments are made</p>
    </div>
  );
}

export default EventRequestsManagement;