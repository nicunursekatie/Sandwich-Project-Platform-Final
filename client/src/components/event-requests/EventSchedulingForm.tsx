import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { EventRequest } from '@shared/schema';
import { SANDWICH_TYPES } from './constants';

// Event Scheduling Form Component
interface EventSchedulingFormProps {
  eventRequest: EventRequest | null;
  isVisible: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

const EventSchedulingForm: React.FC<EventSchedulingFormProps> = ({
  eventRequest,
  isVisible,
  onClose,
  onScheduled,
}) => {
  const [formData, setFormData] = useState({
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '',
    eventAddress: '',
    sandwichTypes: [] as Array<{type: string, quantity: number}>,
    hasRefrigeration: '',
    driversNeeded: 0,
    vanDriverNeeded: false,
    speakersNeeded: 0,
    volunteersNeeded: false,
    tspContact: '',
    schedulingNotes: '',
    totalSandwichCount: 0,
  });

  const [sandwichMode, setSandwichMode] = useState<'total' | 'types'>('total');

  const [showContactInfo, setShowContactInfo] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users for TSP contact selection
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    staleTime: 10 * 60 * 1000,
  });

  // Initialize form with existing data when dialog opens
  useEffect(() => {
    if (isVisible && eventRequest) {
      const existingSandwichTypes = eventRequest.sandwichTypes ? 
        (typeof eventRequest.sandwichTypes === 'string' ? 
          JSON.parse(eventRequest.sandwichTypes) : eventRequest.sandwichTypes) : [];
      
      // Determine mode based on existing data
      const hasTypesData = Array.isArray(existingSandwichTypes) && existingSandwichTypes.length > 0;
      const totalCount = eventRequest.estimatedSandwichCount || 0;
      
      setFormData({
        eventStartTime: eventRequest.eventStartTime || '',
        eventEndTime: eventRequest.eventEndTime || '',
        pickupTime: eventRequest.pickupTime || '',
        eventAddress: eventRequest.eventAddress || '',
        sandwichTypes: existingSandwichTypes,
        hasRefrigeration: eventRequest.hasRefrigeration?.toString() || '',
        driversNeeded: eventRequest.driversNeeded || 0,
        vanDriverNeeded: eventRequest.vanDriverNeeded || false,
        speakersNeeded: eventRequest.speakersNeeded || 0,
        volunteersNeeded: eventRequest.volunteersNeeded || false,
        tspContact: eventRequest.tspContact || '',
        schedulingNotes: (eventRequest as any).schedulingNotes || '',
        totalSandwichCount: totalCount,
      });
      
      // Set mode based on existing data
      setSandwichMode(hasTypesData ? 'types' : 'total');
    }
  }, [isVisible, eventRequest]);

  const updateEventRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, data),
    onSuccess: () => {
      toast({
        title: 'Event scheduled successfully',
        description: 'The event has been moved to scheduled status with all details.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      onScheduled();
      onClose();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to schedule event.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventRequest) return;

    // All fields are optional - no validation required

    // Prepare update data
    const updateData = {
      status: 'scheduled',
      ...formData,
      // Handle sandwich data based on mode
      ...(sandwichMode === 'total' ? {
        estimatedSandwichCount: formData.totalSandwichCount,
        sandwichTypes: null, // Clear specific types when using total mode
      } : {
        sandwichTypes: JSON.stringify(formData.sandwichTypes),
        estimatedSandwichCount: formData.sandwichTypes.reduce((sum, item) => sum + item.quantity, 0),
      }),
      hasRefrigeration: formData.hasRefrigeration === 'true' ? true : 
                        formData.hasRefrigeration === 'false' ? false : null,
    };

    updateEventRequestMutation.mutate({
      id: eventRequest.id,
      data: updateData,
    });
  };

  const addSandwichType = () => {
    setFormData(prev => ({
      ...prev,
      sandwichTypes: [...prev.sandwichTypes, { type: 'deli_turkey', quantity: 0 }]
    }));
  };

  const updateSandwichType = (index: number, field: 'type' | 'quantity', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      sandwichTypes: prev.sandwichTypes.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeSandwichType = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sandwichTypes: prev.sandwichTypes.filter((_, i) => i !== index)
    }));
  };

  if (!eventRequest) return null;

  return (
    <Dialog open={isVisible} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#236383]">
            Schedule Event: {eventRequest.organizationName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Information Section - Collapsible */}
          <div className="border rounded-lg">
            <Button
              type="button"
              variant="ghost"
              className="w-full flex justify-between items-center p-4"
              onClick={() => setShowContactInfo(!showContactInfo)}
            >
              <span className="font-semibold">
                {eventRequest ? 'Contact Information (Pre-filled)' : 'Contact Information (Enter details)'}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showContactInfo ? 'rotate-180' : ''}`} />
            </Button>
            
            {showContactInfo && (
              <div className="p-4 border-t bg-[#e6f2f5] grid grid-cols-1 md:grid-cols-2 gap-4">
                {eventRequest ? (
                  // Existing event - show pre-filled data
                  <>
                    <div>
                      <Label>Contact Name</Label>
                      <Input value={`${eventRequest.firstName} ${eventRequest.lastName}`} disabled />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={eventRequest.email} disabled />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={eventRequest.phone || 'Not provided'} disabled />
                    </div>
                    <div>
                      <Label>Organization</Label>
                      <Input value={eventRequest.organizationName} disabled />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input value={eventRequest.department || 'Not provided'} disabled />
                    </div>
                    <div>
                      <Label>Desired Date</Label>
                      <Input value={eventRequest.desiredEventDate || 'Not provided'} disabled />
                    </div>
                  </>
                ) : (
                  // New event - show editable contact fields
                  <>
                    <div>
                      <Label htmlFor="newFirstName">First Name *</Label>
                      <Input 
                        id="newFirstName"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newLastName">Last Name *</Label>
                      <Input 
                        id="newLastName"
                        placeholder="Enter last name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newEmail">Email *</Label>
                      <Input 
                        id="newEmail"
                        type="email"
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newPhone">Phone</Label>
                      <Input 
                        id="newPhone"
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newOrganization">Organization *</Label>
                      <Input 
                        id="newOrganization"
                        placeholder="Enter organization name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newDesiredDate">Desired Event Date</Label>
                      <Input 
                        id="newDesiredDate"
                        type="date"
                        placeholder="Select desired date"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Event Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="eventStartTime">Start Time</Label>
              <Input
                id="eventStartTime"
                type="time"
                value={formData.eventStartTime}
                onChange={(e) => setFormData(prev => ({ ...prev, eventStartTime: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="eventEndTime">End Time</Label>
              <Input
                id="eventEndTime"
                type="time"
                value={formData.eventEndTime}
                onChange={(e) => setFormData(prev => ({ ...prev, eventEndTime: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="pickupTime">Pickup Time</Label>
              <Input
                id="pickupTime"
                type="time"
                value={formData.pickupTime}
                onChange={(e) => setFormData(prev => ({ ...prev, pickupTime: e.target.value }))}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="eventAddress">Event Address</Label>
            <Input
              id="eventAddress"
              value={formData.eventAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, eventAddress: e.target.value }))}
              placeholder="Enter the event location address"
            />
          </div>

          {/* Sandwich Planning */}
          <div className="space-y-4">
            <Label>Sandwich Planning</Label>
            
            {/* Mode Selector */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={sandwichMode === 'total' ? 'default' : 'outline'}
                onClick={() => setSandwichMode('total')}
                className="text-xs"
              >
                Total Count Only
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sandwichMode === 'types' ? 'default' : 'outline'}
                onClick={() => setSandwichMode('types')}
                className="text-xs"
              >
                Specify Types
              </Button>
            </div>

            {/* Total Count Mode */}
            {sandwichMode === 'total' && (
              <div className="space-y-2">
                <Label htmlFor="totalSandwichCount">Total Number of Sandwiches</Label>
                <Input
                  id="totalSandwichCount"
                  type="number"
                  value={formData.totalSandwichCount}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalSandwichCount: parseInt(e.target.value) || 0 }))}
                  placeholder="Enter total sandwich count"
                  min="0"
                  className="w-40"
                />
                <p className="text-sm text-[#236383]">
                  Use this when you know the total count but types will be determined later.
                </p>
              </div>
            )}

            {/* Specific Types Mode */}
            {sandwichMode === 'types' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Sandwich Types & Quantities</Label>
                  <Button type="button" onClick={addSandwichType} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Type
                  </Button>
                </div>
                
                {formData.sandwichTypes.length === 0 ? (
                  <div className="text-center py-4 text-[#007E8C] border-2 border-dashed border-[#236383]/30 rounded">
                    <p>No sandwich types added yet. Click "Add Type" to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.sandwichTypes.map((sandwich, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded">
                        <Select
                          value={sandwich.type}
                          onValueChange={(value) => updateSandwichType(index, 'type', value)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SANDWICH_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Quantity"
                          value={sandwich.quantity}
                          onChange={(e) => updateSandwichType(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-24"
                          min="0"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSandwichType(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="text-sm text-[#236383] bg-[#e6f2f5] p-2 rounded">
                      <strong>Total:</strong> {formData.sandwichTypes.reduce((sum, item) => sum + item.quantity, 0)} sandwiches
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Refrigeration */}
          <div>
            <Label htmlFor="hasRefrigeration">Refrigeration Available?</Label>
            <Select value={formData.hasRefrigeration} onValueChange={(value) => setFormData(prev => ({ ...prev, hasRefrigeration: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select refrigeration status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resource Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Drivers */}
            <div className="space-y-3">
              <Label>Driver Requirements</Label>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="driversNeeded">How many drivers needed?</Label>
                  <Input
                    id="driversNeeded"
                    type="number"
                    value={formData.driversNeeded}
                    onChange={(e) => setFormData(prev => ({ ...prev, driversNeeded: parseInt(e.target.value) || 0 }))}
                    min="0"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="vanDriverNeeded"
                    checked={formData.vanDriverNeeded}
                    onChange={(e) => setFormData(prev => ({ ...prev, vanDriverNeeded: e.target.checked }))}
                  />
                  <Label htmlFor="vanDriverNeeded">Van driver needed?</Label>
                </div>
              </div>
            </div>

            {/* Speakers and Volunteers */}
            <div className="space-y-3">
              <Label>Additional Resources</Label>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="speakersNeeded">How many speakers needed?</Label>
                  <Input
                    id="speakersNeeded"
                    type="number"
                    value={formData.speakersNeeded}
                    onChange={(e) => setFormData(prev => ({ ...prev, speakersNeeded: parseInt(e.target.value) || 0 }))}
                    min="0"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="volunteersNeeded"
                    checked={formData.volunteersNeeded}
                    onChange={(e) => setFormData(prev => ({ ...prev, volunteersNeeded: e.target.checked }))}
                  />
                  <Label htmlFor="volunteersNeeded">Volunteers needed?</Label>
                </div>
              </div>
            </div>
          </div>

          {/* TSP Contact Assignment */}
          <div>
            <Label htmlFor="tspContact">TSP Contact Assignment</Label>
            <Select value={formData.tspContact} onValueChange={(value) => setFormData(prev => ({ ...prev, tspContact: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select TSP contact" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.email} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduling Notes */}
          <div>
            <Label htmlFor="schedulingNotes">Notes (optional)</Label>
            <Textarea
              id="schedulingNotes"
              value={formData.schedulingNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, schedulingNotes: e.target.value }))}
              placeholder="Add any notes or special instructions for this scheduled event"
              className="min-h-[100px]"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="text-white"
              style={{ backgroundColor: '#236383' }}
              disabled={updateEventRequestMutation.isPending}
            >
              {updateEventRequestMutation.isPending ? 'Scheduling...' : 'Schedule Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventSchedulingForm;