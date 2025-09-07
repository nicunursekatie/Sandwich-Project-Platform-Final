import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Filter, User, Phone, Mail, Calendar, Clock, MapPin, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface EventRequest {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  eventDate: string;
  status: string;
  assignedDriverIds?: string[];
  assignedSpeakerIds?: string[];
  [key: string]: any;
}

export function EventRequestsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingDriversFor, setEditingDriversFor] = useState<number | null>(null);
  const [tempDriverInput, setTempDriverInput] = useState('');
  
  // Fetch event requests
  const { data: eventRequests = [], isLoading } = useQuery({
    queryKey: ['/api/event-requests'],
    refetchInterval: 30000
  });

  // Fetch users for assignments
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users/for-assignments']
  });

  // Update mutation with debugging
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => {
      console.log('=== MUTATION DEBUG ===');
      console.log('Mutation data type:', typeof data);
      console.log('Mutation data:', data);
      console.log('Serialized:', JSON.stringify(data));
      console.log('=====================');
      return apiRequest("PUT", `/api/event-requests/${id}`, data);
    },
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

  // Helper function to get user display name
  const getUserDisplayName = (userId: string) => {
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name || user.email : userId;
  };

  // Filter event requests
  const filteredRequests = useMemo(() => {
    return eventRequests.filter((request: EventRequest) => {
      const matchesSearch = 
        request.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [eventRequests, searchTerm, statusFilter]);

  if (isLoading) {
    return <div className="p-4">Loading event requests...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Event Requests Management</h1>
        <Badge variant="secondary">
          {filteredRequests.length} of {eventRequests.length} events
        </Badge>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by name, organization, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Event Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRequests.map((request: EventRequest) => (
          <Card key={request.id} className="border border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {request.organizationName}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    {request.firstName} {request.lastName}
                  </p>
                </div>
                <Badge 
                  variant={request.status === 'completed' ? 'default' : 
                          request.status === 'scheduled' ? 'secondary' : 'outline'}
                >
                  {request.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Contact Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="truncate">{request.email}</span>
                </div>
                {request.eventDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>{new Date(request.eventDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Driver Assignment Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Drivers</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingDriversFor(request.id)}
                  >
                    <Truck className="w-3 h-3 mr-1" />
                    Assign
                  </Button>
                </div>

                {/* Assigned Drivers Display */}
                <div className="flex flex-wrap gap-1">
                  {(request.assignedDriverIds || []).map((driverId: string, index: number) => (
                    <div key={index} className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {getUserDisplayName(driverId)}
                      <button
                        className="ml-1 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center"
                        onClick={() => {
                          const updatedDrivers = (request.assignedDriverIds || []).filter((_: string, i: number) => i !== index);
                          handleAssignmentUpdate(request.id, 'assignedDriverIds', updatedDrivers);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Driver Assignment Input */}
                {editingDriversFor === request.id && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter driver name..."
                      value={tempDriverInput}
                      onChange={(e) => setTempDriverInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tempDriverInput.trim()) {
                          const currentDrivers = (request as any).assignedDriverIds || [];
                          const updatedDrivers = [...currentDrivers, tempDriverInput.trim()];
                          
                          console.log('Adding driver:', tempDriverInput.trim());
                          console.log('Current drivers:', currentDrivers);
                          console.log('Updated drivers:', updatedDrivers);
                          
                          handleAssignmentUpdate(request.id, 'assignedDriverIds', updatedDrivers);
                          setTempDriverInput("");
                          setEditingDriversFor(null);
                          toast({
                            title: "Driver added successfully",
                            description: `Added ${tempDriverInput.trim()} as driver`,
                          });
                        }
                        if (e.key === "Escape") {
                          setEditingDriversFor(null);
                          setTempDriverInput("");
                        }
                      }}
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingDriversFor(null);
                        setTempDriverInput("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Speaker Assignment Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Speakers</span>
                  <span className="text-xs text-gray-500">
                    {(request.assignedSpeakerIds || []).length} assigned
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(request.assignedSpeakerIds || []).map((speakerId: string, index: number) => (
                    <div key={index} className="flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                      {getUserDisplayName(speakerId)}
                      <button
                        className="ml-1 hover:bg-purple-200 rounded-full w-4 h-4 flex items-center justify-center"
                        onClick={() => {
                          const updatedSpeakers = (request.assignedSpeakerIds || []).filter((_: string, i: number) => i !== index);
                          handleAssignmentUpdate(request.id, 'assignedSpeakerIds', updatedSpeakers);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No event requests found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}

export default EventRequestsManagement;