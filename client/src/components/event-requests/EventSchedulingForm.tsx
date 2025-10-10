import * as React from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ChevronDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { EventRequest } from '@shared/schema';
import { SANDWICH_TYPES } from './constants';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { getPickupDateTimeForInput } from './utils';
import { RecipientSelector } from '@/components/ui/recipient-selector';
import { MultiRecipientSelector } from '@/components/ui/multi-recipient-selector';

// Event Scheduling Form Component
interface EventSchedulingFormProps {
  eventRequest: EventRequest | null;
  isVisible?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onScheduled?: () => void;
  onEventScheduled?: () => void;
  onDelete?: (eventRequestId: number) => void;
  mode?: 'schedule' | 'edit' | 'create';
}

const EventSchedulingForm: React.FC<EventSchedulingFormProps> = ({
  eventRequest,
  isVisible,
  isOpen,
  onClose,
  onScheduled,
  onEventScheduled,
  onDelete,
  mode = 'schedule',
}) => {
  const dialogOpen = isVisible || isOpen || false;
  const onSuccessCallback = onScheduled || onEventScheduled || (() => {});
  const [formData, setFormData] = useState({
    eventDate: '',
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '',
    pickupDateTime: '',
    eventAddress: '',
    deliveryDestination: '',
    overnightHoldingLocation: '',
    overnightPickupTime: '',
    sandwichTypes: [] as Array<{type: string, quantity: number}>,
    hasRefrigeration: '',
    driversNeeded: 0,
    vanDriverNeeded: false,
    assignedVanDriverId: '',
    speakersNeeded: 0,
    volunteersNeeded: 0,
    tspContact: '',
    message: '',
    schedulingNotes: '',
    planningNotes: '',
    totalSandwichCount: 0,
    volunteerCount: 0,
    status: 'new',
    toolkitSent: false,
    toolkitSentDate: '',
    toolkitStatus: 'not_sent',
    // Completed event tracking fields
    socialMediaPostRequested: false,
    socialMediaPostRequestedDate: '',
    socialMediaPostCompleted: false,
    socialMediaPostCompletedDate: '',
    socialMediaPostNotes: '',
    actualSandwichCount: 0,
    actualSandwichTypes: [] as Array<{type: string, quantity: number}>,
    actualSandwichCountRecordedDate: '',
    actualSandwichCountRecordedBy: '',
    followUpOneDayCompleted: false,
    followUpOneDayDate: '',
    followUpOneMonthCompleted: false,
    followUpOneMonthDate: '',
    followUpNotes: '',
    assignedRecipientIds: [] as number[],
  });

  const [sandwichMode, setSandwichMode] = useState<'total' | 'types'>('total');
  const [actualSandwichMode, setActualSandwichMode] = useState<'total' | 'types'>('total');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showCompletedDetails, setShowCompletedDetails] = useState(false);
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState('');
  const [isMessageEditable, setIsMessageEditable] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users for TSP contact selection
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users/for-assignments'],
    staleTime: 10 * 60 * 1000,
  });

  // Fetch van-approved drivers
  const { data: vanDrivers = [] } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
    select: (drivers) => drivers.filter(driver => driver.vanApproved),
    staleTime: 10 * 60 * 1000,
  });

  // Helper function to format date for input (YYYY-MM-DD format to avoid timezone issues)
  const formatDateForInput = (date: any) => {
    if (!date) return '';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Helper function to serialize date to ISO midnight string for backend
  const serializeDateToISO = (dateString: string) => {
    if (!dateString) return null;
    return `${dateString}T00:00:00.000Z`;
  };

  // Initialize form with existing data when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      const existingSandwichTypes = eventRequest?.sandwichTypes ? 
        (typeof eventRequest?.sandwichTypes === 'string' ? 
          JSON.parse(eventRequest.sandwichTypes) : eventRequest?.sandwichTypes) : [];
      
      // Determine mode based on existing data
      const hasTypesData = Array.isArray(existingSandwichTypes) && existingSandwichTypes.length > 0;
      const totalCount = eventRequest?.estimatedSandwichCount || 0;
      
      const existingActualSandwichTypes = eventRequest?.actualSandwichTypes ? 
        (typeof eventRequest?.actualSandwichTypes === 'string' ? 
          JSON.parse(eventRequest.actualSandwichTypes) : eventRequest?.actualSandwichTypes) : [];
      
      const hasActualTypesData = Array.isArray(existingActualSandwichTypes) && existingActualSandwichTypes.length > 0;
      
      // Normalize assignedRecipientIds to new string format with prefixes
      // Supports legacy numeric IDs and new prefixed format (host:ID, recipient:ID, custom:text)
      const normalizeRecipientIds = (ids: any): string[] => {
        if (!ids) return [];
        
        let rawIds: any[] = [];
        
        // Handle PostgreSQL array format: {1,2,3} or {"host:5","recipient:10","custom:Hall, Room 2"}
        if (typeof ids === 'string' && ids.startsWith('{') && ids.endsWith('}')) {
          const arrayContent = ids.slice(1, -1); // Remove { and }
          
          // Parse PostgreSQL array format respecting quoted strings
          // PostgreSQL escapes quotes as "" (doubled) or \" (backslash)
          // Handles: {value1,value2} and {"value 1","value 2"} and {"value,with,commas"} and {"value with ""quotes"""}
          const parsed: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < arrayContent.length; i++) {
            const char = arrayContent[i];
            const nextChar = i < arrayContent.length - 1 ? arrayContent[i + 1] : null;
            const prevChar = i > 0 ? arrayContent[i - 1] : null;
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                // Doubled quote ("") inside quoted string = escaped quote, add one quote
                current += '"';
                i++; // Skip the next quote
              } else if (inQuotes && prevChar === '\\') {
                // Backslash-escaped quote (\") = actual quote (backslash was already added)
                current = current.slice(0, -1) + '"'; // Replace the backslash with quote
              } else {
                // Regular quote - toggle quote state
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              // Comma outside quotes = separator
              if (current.trim()) {
                parsed.push(current.trim());
              }
              current = '';
            } else {
              current += char;
            }
          }
          
          // Don't forget the last value
          if (current.trim()) {
            parsed.push(current.trim());
          }
          
          rawIds = parsed;
        }
        // Handle JSON array format: [1,2,3] or ["host:5","recipient:10"]
        else if (Array.isArray(ids)) {
          rawIds = ids;
        }
        
        // Convert to new format with prefixes
        return rawIds.map(id => {
          const idStr = String(id);
          
          // If already has a prefix (host:, recipient:, custom:), keep as-is
          if (idStr.includes(':')) {
            return idStr;
          }
          
          // Legacy numeric ID - assume it's a recipient ID
          const numId = parseInt(idStr, 10);
          if (!isNaN(numId)) {
            return `recipient:${numId}`;
          }
          
          // Fallback - treat as custom text
          return `custom:${idStr}`;
        }).filter(id => id);
      };

      setFormData({
        eventDate: eventRequest ? formatDateForInput(eventRequest.desiredEventDate) : '',
        eventStartTime: eventRequest?.eventStartTime || '',
        eventEndTime: eventRequest?.eventEndTime || '',
        pickupTime: eventRequest?.pickupTime || '',
        pickupDateTime: getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, eventRequest?.desiredEventDate),
        eventAddress: eventRequest?.eventAddress || '',
        deliveryDestination: eventRequest?.deliveryDestination || '',
        overnightHoldingLocation: eventRequest?.overnightHoldingLocation || '',
        overnightPickupTime: eventRequest?.overnightPickupTime || '',
        sandwichTypes: existingSandwichTypes,
        hasRefrigeration: eventRequest?.hasRefrigeration?.toString() || '',
        driversNeeded: eventRequest?.driversNeeded || 0,
        vanDriverNeeded: eventRequest?.vanDriverNeeded || false,
        speakersNeeded: eventRequest?.speakersNeeded || 0,
        volunteersNeeded: eventRequest?.volunteersNeeded || 0,
        tspContact: eventRequest?.tspContact || '',
        message: (eventRequest as any)?.message || '',
        schedulingNotes: (eventRequest as any)?.schedulingNotes || '',
        planningNotes: (eventRequest as any)?.planningNotes || '',
        totalSandwichCount: totalCount,
        volunteerCount: (eventRequest as any)?.volunteerCount || 0,
        // Contact information fields
        firstName: eventRequest?.firstName || '',
        lastName: eventRequest?.lastName || '',
        email: eventRequest?.email || '',
        phone: eventRequest?.phone || '',
        organizationName: eventRequest?.organizationName || '',
        department: eventRequest?.department || '',
        organizationCategory: (eventRequest as any)?.organizationCategory || '',
        schoolClassification: (eventRequest as any)?.schoolClassification || '',
        // Van driver assignment
        assignedVanDriverId: eventRequest?.assignedVanDriverId || '',
        // Status
        status: eventRequest?.status || 'new',
        // Toolkit status
        toolkitSent: eventRequest?.toolkitSent || false,
        toolkitSentDate: eventRequest?.toolkitSentDate ? formatDateForInput(eventRequest.toolkitSentDate) : '',
        toolkitStatus: eventRequest?.toolkitStatus || 'not_sent',
        // Completed event tracking fields
        socialMediaPostRequested: (eventRequest as any)?.socialMediaPostRequested || false,
        socialMediaPostRequestedDate: (eventRequest as any)?.socialMediaPostRequestedDate ? formatDateForInput((eventRequest as any).socialMediaPostRequestedDate) : '',
        socialMediaPostCompleted: (eventRequest as any)?.socialMediaPostCompleted || false,
        socialMediaPostCompletedDate: (eventRequest as any)?.socialMediaPostCompletedDate ? formatDateForInput((eventRequest as any).socialMediaPostCompletedDate) : '',
        socialMediaPostNotes: (eventRequest as any)?.socialMediaPostNotes || '',
        actualSandwichCount: (eventRequest as any)?.actualSandwichCount || 0,
        actualSandwichTypes: existingActualSandwichTypes,
        actualSandwichCountRecordedDate: (eventRequest as any)?.actualSandwichCountRecordedDate ? formatDateForInput((eventRequest as any).actualSandwichCountRecordedDate) : '',
        actualSandwichCountRecordedBy: (eventRequest as any)?.actualSandwichCountRecordedBy || '',
        followUpOneDayCompleted: (eventRequest as any)?.followUpOneDayCompleted || false,
        followUpOneDayDate: (eventRequest as any)?.followUpOneDayDate ? formatDateForInput((eventRequest as any).followUpOneDayDate) : '',
        followUpOneMonthCompleted: (eventRequest as any)?.followUpOneMonthCompleted || false,
        followUpOneMonthDate: (eventRequest as any)?.followUpOneMonthDate ? formatDateForInput((eventRequest as any).followUpOneMonthDate) : '',
        followUpNotes: (eventRequest as any)?.followUpNotes || '',
        assignedRecipientIds: normalizeRecipientIds((eventRequest as any)?.assignedRecipientIds),
      });
      
      // Set mode based on existing data
      setSandwichMode(hasTypesData ? 'types' : 'total');
      setActualSandwichMode(hasActualTypesData ? 'types' : 'total');
      
      // Auto-expand Completed Event Details section if event is completed
      setShowCompletedDetails(eventRequest?.status === 'completed');
    }
  }, [isVisible, isOpen, eventRequest, mode]);

  const updateEventRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, data),
    retry: false,
    networkMode: 'always',
    onSuccess: () => {
      const isEditMode = mode === 'edit';
      toast({
        title: isEditMode ? 'Event updated successfully' : 'Event scheduled successfully',
        description: isEditMode ? 'The event details have been updated.' : 'The event has been moved to scheduled status with all details.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      onSuccessCallback();
      onClose();
    },
    onError: () => {
      const isEditMode = mode === 'edit';
      toast({
        title: 'Error',
        description: isEditMode ? 'Failed to update event.' : 'Failed to schedule event.',
        variant: 'destructive',
      });
    },
  });

  const createEventRequestMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('🚀 CREATE MUTATION: Sending data:', data);
      return apiRequest('POST', '/api/event-requests', data);
    },
    onSuccess: (response) => {
      console.log('✅ CREATE MUTATION SUCCESS: Response:', response);
      toast({
        title: 'Event created successfully',
        description: 'The new event request has been created.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      onSuccessCallback();
      onClose();
    },
    onError: (error) => {
      console.error('❌ CREATE MUTATION ERROR:', error);
      toast({
        title: 'Error',
        description: 'Failed to create event.',
        variant: 'destructive',
      });
    },
  });

  const deleteEventRequestMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/event-requests/${id}`),
    onSuccess: () => {
      toast({
        title: 'Event deleted successfully',
        description: 'The event request has been deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      onSuccessCallback();
      onClose();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete event.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // All fields are optional - no validation required

    // Construct data explicitly without client-only fields
    const eventData: any = {
      // Only change status to 'scheduled' when in schedule mode (for updates)
      ...(eventRequest && mode === 'schedule' ? { status: 'scheduled' } : {}),
      // For new events (create mode), use the status from form data
      ...(!eventRequest ? { status: formData.status || 'new' } : {}),
      // For edit mode, include the status from form data
      ...(eventRequest && mode === 'edit' ? { status: formData.status } : {}),
      // Serialize date properly to avoid timezone issues
      desiredEventDate: serializeDateToISO(formData.eventDate),
      // If status is scheduled, also set scheduledEventDate
      ...(formData.status === 'scheduled' ? { scheduledEventDate: serializeDateToISO(formData.eventDate) } : {}),
      eventStartTime: formData.eventStartTime || null,
      eventEndTime: formData.eventEndTime || null,
      pickupTime: formData.pickupTime || null,
      pickupDateTime: formData.pickupDateTime || null,
      eventAddress: formData.eventAddress || null,
      deliveryDestination: formData.deliveryDestination || null,
      overnightHoldingLocation: formData.overnightHoldingLocation || null,
      overnightPickupTime: formData.overnightPickupTime || null,
      hasRefrigeration: formData.hasRefrigeration === 'true' ? true : 
                        formData.hasRefrigeration === 'false' ? false : null,
      driversNeeded: parseInt(formData.driversNeeded?.toString() || '0') || 0,
      vanDriverNeeded: formData.vanDriverNeeded || false,
      speakersNeeded: parseInt(formData.speakersNeeded?.toString() || '0') || 0,
      volunteersNeeded: parseInt(formData.volunteersNeeded?.toString() || '0') || 0,
      tspContact: formData.tspContact || null,
      message: formData.message || null,
      schedulingNotes: formData.schedulingNotes || null,
      planningNotes: formData.planningNotes || null,
      // Contact information fields
      firstName: formData.firstName || null,
      lastName: formData.lastName || null,
      email: formData.email || null,
      phone: formData.phone || null,
      organizationName: formData.organizationName || null,
      department: formData.department || null,
      organizationCategory: formData.organizationCategory || null,
      schoolClassification: formData.schoolClassification || null,
      // Van driver assignment
      assignedVanDriverId: (formData.assignedVanDriverId && formData.assignedVanDriverId !== 'none') ? formData.assignedVanDriverId : null,
      // Toolkit information
      toolkitStatus: formData.toolkitStatus || null,
      toolkitSentDate: formData.toolkitSentDate || null,
    };

    // Handle sandwich data based on mode
    if (sandwichMode === 'total') {
      eventData.estimatedSandwichCount = formData.totalSandwichCount;
      eventData.sandwichTypes = null; // Clear specific types when using total mode
    } else {
      eventData.sandwichTypes = JSON.stringify(formData.sandwichTypes);
      eventData.estimatedSandwichCount = formData.sandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Include volunteer count
    eventData.volunteerCount = formData.volunteerCount || 0;

    // Include completed event tracking fields
    eventData.socialMediaPostRequested = formData.socialMediaPostRequested;
    eventData.socialMediaPostRequestedDate = serializeDateToISO(formData.socialMediaPostRequestedDate);
    eventData.socialMediaPostCompleted = formData.socialMediaPostCompleted;
    eventData.socialMediaPostCompletedDate = serializeDateToISO(formData.socialMediaPostCompletedDate);
    eventData.socialMediaPostNotes = formData.socialMediaPostNotes || null;
    
    // Handle actual sandwich data based on mode
    if (actualSandwichMode === 'total') {
      eventData.actualSandwichCount = formData.actualSandwichCount;
      eventData.actualSandwichTypes = null;
    } else {
      eventData.actualSandwichTypes = JSON.stringify(formData.actualSandwichTypes);
      eventData.actualSandwichCount = formData.actualSandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
    }
    eventData.actualSandwichCountRecordedDate = serializeDateToISO(formData.actualSandwichCountRecordedDate);
    eventData.actualSandwichCountRecordedBy = formData.actualSandwichCountRecordedBy || null;
    
    eventData.followUpOneDayCompleted = formData.followUpOneDayCompleted;
    eventData.followUpOneDayDate = serializeDateToISO(formData.followUpOneDayDate);
    eventData.followUpOneMonthCompleted = formData.followUpOneMonthCompleted;
    eventData.followUpOneMonthDate = serializeDateToISO(formData.followUpOneMonthDate);
    eventData.followUpNotes = formData.followUpNotes || null;
    
    // Include assigned recipient IDs
    eventData.assignedRecipientIds = formData.assignedRecipientIds || [];

    console.log('📋 FORM SUBMIT DEBUG:');
    console.log('  - eventRequest exists?', !!eventRequest);
    console.log('  - mode:', mode);
    console.log('  - isCreateMode:', isCreateMode);
    console.log('  - eventData being sent:', eventData);

    if (eventRequest) {
      console.log('🔄 Calling UPDATE mutation for event ID:', eventRequest.id);
      // Update existing event request
      updateEventRequestMutation.mutate({
        id: eventRequest.id,
        data: eventData,
      });
    } else {
      console.log('➕ Calling CREATE mutation for new event');
      // Create new event request
      createEventRequestMutation.mutate(eventData);
    }
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

  // Helper functions for actual sandwich types
  const addActualSandwichType = () => {
    setFormData(prev => ({
      ...prev,
      actualSandwichTypes: [...prev.actualSandwichTypes, { type: 'deli_turkey', quantity: 0 }]
    }));
  };

  const updateActualSandwichType = (index: number, field: 'type' | 'quantity', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      actualSandwichTypes: prev.actualSandwichTypes.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeActualSandwichType = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actualSandwichTypes: prev.actualSandwichTypes.filter((_, i) => i !== index)
    }));
  };

  // Handle date change confirmation
  const handleDateChangeConfirmation = () => {
    setFormData(prev => ({ ...prev, eventDate: pendingDateChange }));
    setShowDateConfirmation(false);
    setPendingDateChange('');
  };

  const handleDateChangeCancellation = () => {
    setShowDateConfirmation(false);
    setPendingDateChange('');
  };

  // For create mode, we can work with null eventRequest
  const isCreateMode = mode === 'create' || !eventRequest;

  return (
    <Dialog open={dialogOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#236383]">
            {isCreateMode ? 'Create New Event' : `${mode === 'edit' ? 'Edit Event Details:' : 'Schedule Event:'} ${eventRequest?.organizationName}`}
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
                Contact Information (Editable)
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showContactInfo ? 'rotate-180' : ''}`} />
            </Button>
            
            {showContactInfo && (
              <div className="p-4 border-t bg-[#e6f2f5] grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* All contact fields are now editable */}
                <>
                  <div>
                    <Label htmlFor="contactFirstName">First Name</Label>
                    <Input 
                      id="contactFirstName"
                      value={formData.firstName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactLastName">Last Name</Label>
                    <Input 
                      id="contactLastName"
                      value={formData.lastName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Enter last name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input 
                      id="contactEmail"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input 
                      id="contactPhone"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactOrganization">Organization</Label>
                    <Input 
                      id="contactOrganization"
                      value={formData.organizationName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, organizationName: e.target.value }))}
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactDepartment">Department</Label>
                    <Input 
                      id="contactDepartment"
                      value={formData.department || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Enter department"
                    />
                  </div>
                  <div>
                    <Label htmlFor="organizationCategory">Organization Category</Label>
                    <Select
                      value={formData.organizationCategory || ''}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        organizationCategory: value,
                        // Clear school classification if category changes to non-school
                        schoolClassification: value === 'school' ? prev.schoolClassification : ''
                      }))}
                    >
                      <SelectTrigger id="organizationCategory">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small_medium_corp">Small/Medium Corporation</SelectItem>
                        <SelectItem value="large_corp">Large Corporation</SelectItem>
                        <SelectItem value="church_faith">Church/Faith Group</SelectItem>
                        <SelectItem value="school">School</SelectItem>
                        <SelectItem value="neighborhood">Neighborhood</SelectItem>
                        <SelectItem value="club">Club</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.organizationCategory === 'school' && (
                    <div>
                      <Label htmlFor="schoolClassification">School Classification</Label>
                      <Select
                        value={formData.schoolClassification || ''}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, schoolClassification: value }))}
                      >
                        <SelectTrigger id="schoolClassification">
                          <SelectValue placeholder="Select school type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="charter">Charter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              </div>
            )}
          </div>

          {/* Event Schedule */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Event Schedule</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="eventDate">Event Date</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => {
                    // Always update the display value immediately (no confirmation on keystroke)
                    setFormData(prev => ({ ...prev, eventDate: e.target.value }));
                  }}
                  onBlur={(e) => {
                    const newDate = e.target.value;
                    // Only check for confirmation when user finishes editing (onBlur)
                    if (eventRequest?.status === 'scheduled' && 
                        formatDateForInput(eventRequest.desiredEventDate) !== newDate &&
                        formatDateForInput(eventRequest.desiredEventDate) !== '' &&
                        newDate !== formatDateForInput(eventRequest.desiredEventDate)) {
                      setPendingDateChange(newDate);
                      setShowDateConfirmation(true);
                    }
                  }}
                  data-testid="input-event-date"
                />
              </div>
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
                <Label htmlFor="pickupDateTime">Pickup Date & Time</Label>
                <DateTimePicker
                  value={formData.pickupDateTime}
                  onChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    pickupDateTime: value,
                    // Clear legacy pickupTime when datetime is set
                    pickupTime: ''
                  }))}
                  eventDate={formData.eventDate}
                  data-testid="pickup-datetime-picker"
                />
              </div>
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

          {/* Delivery Destinations */}
          <div className="space-y-4">
            <div className="p-3 bg-brand-primary-lighter border border-brand-primary-border rounded-lg">
              <p className="text-sm text-brand-primary mb-2 font-medium">
                📍 Delivery Options: You can specify either a direct delivery destination, or an overnight holding location with a final destination.
              </p>
            </div>

            {/* Overnight Holding Location (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="overnightHoldingLocation">
                🌙 Overnight Holding Location (Optional)
              </Label>
              <Input
                id="overnightHoldingLocation"
                value={formData.overnightHoldingLocation}
                onChange={(e) => setFormData(prev => ({ ...prev, overnightHoldingLocation: e.target.value }))}
                placeholder="Location where sandwiches will be stored overnight (e.g., church, community center)"
              />
              {formData.overnightHoldingLocation && (
                <div className="ml-4 mt-2">
                  <Label htmlFor="overnightPickupTime">Pickup Time from Overnight Location</Label>
                  <Input
                    id="overnightPickupTime"
                    type="time"
                    value={formData.overnightPickupTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, overnightPickupTime: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Final Delivery Destination */}
            <div>
              <Label htmlFor="deliveryDestination">
                {formData.overnightHoldingLocation ? '📍 Final Delivery Destination' : '📍 Delivery Destination'}
              </Label>
              <RecipientSelector
                value={formData.deliveryDestination}
                onChange={(value) => setFormData(prev => ({ ...prev, deliveryDestination: value }))}
                placeholder={formData.overnightHoldingLocation
                  ? "Final destination after overnight hold (organization, address, etc.)"
                  : "Where should the sandwiches be delivered? (organization, address, etc.)"}
                data-testid="delivery-destination-selector"
              />
            </div>
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

          {/* Volunteer Count (Optional) */}
          <div>
            <Label htmlFor="volunteerCount"># of Volunteers (Optional)</Label>
            <Input
              id="volunteerCount"
              type="number"
              value={formData.volunteerCount}
              onChange={(e) => setFormData(prev => ({ ...prev, volunteerCount: parseInt(e.target.value) || 0 }))}
              placeholder="Enter expected number of volunteers"
              min="0"
              className="w-40"
              data-testid="input-volunteer-count"
            />
            <p className="text-sm text-[#236383]">
              Optional: Estimate how many volunteers will participate in this event.
            </p>
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
                
                {/* Van Driver Selection - Only show when van driver is needed */}
                {formData.vanDriverNeeded && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <Label htmlFor="assignedVanDriver">Select Van Driver (Optional)</Label>
                    <Select 
                      value={formData.assignedVanDriverId || ''} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, assignedVanDriverId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a van-approved driver..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No driver assigned yet</SelectItem>
                        {vanDrivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id.toString()}>
                            {driver.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-orange-600 mt-1">
                      If no driver is selected, the event card will show "Van Driver Needed"
                    </p>
                  </div>
                )}
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
                <div>
                  <Label htmlFor="volunteersNeeded">How many volunteers needed?</Label>
                  <Input
                    id="volunteersNeeded"
                    type="number"
                    value={formData.volunteersNeeded}
                    onChange={(e) => setFormData(prev => ({ ...prev, volunteersNeeded: parseInt(e.target.value) || 0 }))}
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New Request</SelectItem>
                <SelectItem value="in_process">In Process</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toolkit Status Section */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Toolkit Status</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="toolkitStatus">Toolkit Status</Label>
                <Select value={formData.toolkitStatus} onValueChange={(value) => setFormData(prev => ({ ...prev, toolkitStatus: value }))}>
                  <SelectTrigger data-testid="select-toolkit-status">
                    <SelectValue placeholder="Select toolkit status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_sent">Not Sent</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="received_confirmed">Received Confirmed</SelectItem>
                    <SelectItem value="not_needed">Not Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="toolkitSentDate">Toolkit Sent Date</Label>
                <Input
                  id="toolkitSentDate"
                  type="date"
                  value={formData.toolkitSentDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, toolkitSentDate: e.target.value }))}
                  disabled={formData.toolkitStatus === 'not_sent' || formData.toolkitStatus === 'not_needed'}
                  data-testid="input-toolkit-sent-date"
                />
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

          {/* Notes & Requirements Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#47B3CB] mb-4">Notes & Requirements</h3>
              
              {/* Initial Request Message */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="message">Initial Request Message</Label>
                  {!isMessageEditable && formData.message && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsMessageEditable(true)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Edit
                    </Button>
                  )}
                </div>
                {isMessageEditable ? (
                  <div className="space-y-2">
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Original request message from the organizer"
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsMessageEditable(false)}
                        className="bg-[#47B3CB] hover:bg-[#47B3CB]/80 text-white"
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsMessageEditable(false);
                          // Reset to original value if needed
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-brand-primary-lighter p-3 rounded border-l-4 border-brand-primary-border text-sm text-gray-700">
                    {formData.message || 'No initial message recorded'}
                  </div>
                )}
              </div>

              {/* Scheduling Notes */}
              <div className="mb-4">
                <Label htmlFor="schedulingNotes">Scheduling Notes</Label>
                <p className="text-sm text-gray-500 mb-2">Notes added while the event is being processed</p>
                <Textarea
                  id="schedulingNotes"
                  value={formData.schedulingNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, schedulingNotes: e.target.value }))}
                  placeholder="Add notes about scheduling, coordination, or processing status"
                  className="min-h-[80px]"
                />
              </div>

              {/* Planning Notes */}
              <div>
                <Label htmlFor="planningNotes">Planning Notes</Label>
                <p className="text-sm text-gray-500 mb-2">Notes for when the event is scheduled or being planned</p>
                <Textarea
                  id="planningNotes"
                  value={formData.planningNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, planningNotes: e.target.value }))}
                  placeholder="Add planning notes, logistics, or post-scheduling information"
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>

          {/* Completed Event Details Section - Only visible when status is "completed" */}
          {formData.status === 'completed' && (
            <div className="border rounded-lg">
              <Button
                type="button"
                variant="ghost"
                className="w-full flex justify-between items-center p-4"
                onClick={() => setShowCompletedDetails(!showCompletedDetails)}
                data-testid="toggle-completed-details"
              >
                <span className="font-semibold text-[#236383]">
                  Completed Event Details
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showCompletedDetails ? 'rotate-180' : ''}`} />
              </Button>
              
              {showCompletedDetails && (
                <div className="p-4 border-t bg-[#e6f2f5] space-y-6">
                  
                  {/* Social Media Tracking Section */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-[#236383]">Social Media Tracking</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="socialMediaPostRequested"
                            checked={formData.socialMediaPostRequested}
                            onChange={(e) => setFormData(prev => ({ ...prev, socialMediaPostRequested: e.target.checked }))}
                            className="w-4 h-4"
                            data-testid="checkbox-social-media-requested"
                          />
                          <Label htmlFor="socialMediaPostRequested">Social Media Post Requested</Label>
                        </div>
                        {formData.socialMediaPostRequested && (
                          <div className="ml-6">
                            <Label htmlFor="socialMediaPostRequestedDate">Requested Date</Label>
                            <Input
                              id="socialMediaPostRequestedDate"
                              type="date"
                              value={formData.socialMediaPostRequestedDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, socialMediaPostRequestedDate: e.target.value }))}
                              data-testid="input-social-media-requested-date"
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="socialMediaPostCompleted"
                            checked={formData.socialMediaPostCompleted}
                            onChange={(e) => setFormData(prev => ({ ...prev, socialMediaPostCompleted: e.target.checked }))}
                            className="w-4 h-4"
                            data-testid="checkbox-social-media-completed"
                          />
                          <Label htmlFor="socialMediaPostCompleted">Social Media Post Completed</Label>
                        </div>
                        {formData.socialMediaPostCompleted && (
                          <div className="ml-6">
                            <Label htmlFor="socialMediaPostCompletedDate">Completed Date</Label>
                            <Input
                              id="socialMediaPostCompletedDate"
                              type="date"
                              value={formData.socialMediaPostCompletedDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, socialMediaPostCompletedDate: e.target.value }))}
                              data-testid="input-social-media-completed-date"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="socialMediaPostNotes">Social Media Notes</Label>
                      <Textarea
                        id="socialMediaPostNotes"
                        value={formData.socialMediaPostNotes}
                        onChange={(e) => setFormData(prev => ({ ...prev, socialMediaPostNotes: e.target.value }))}
                        placeholder="Notes about social media posts, links, or other details"
                        className="min-h-[80px]"
                        data-testid="textarea-social-media-notes"
                      />
                    </div>
                  </div>

                  {/* Actual Sandwiches Delivered Section */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-[#236383]">Actual Sandwiches Delivered</h4>
                    
                    {/* Mode Selector for Actual Sandwiches */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={actualSandwichMode === 'total' ? 'default' : 'outline'}
                        onClick={() => setActualSandwichMode('total')}
                        className="text-xs"
                        data-testid="button-actual-sandwich-mode-total"
                      >
                        Total Count Only
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={actualSandwichMode === 'types' ? 'default' : 'outline'}
                        onClick={() => setActualSandwichMode('types')}
                        className="text-xs"
                        data-testid="button-actual-sandwich-mode-types"
                      >
                        Specify Types
                      </Button>
                    </div>

                    {/* Total Count Mode for Actual Sandwiches */}
                    {actualSandwichMode === 'total' && (
                      <div className="space-y-2">
                        <Label htmlFor="actualSandwichCount">Total Number of Sandwiches Actually Delivered</Label>
                        <Input
                          id="actualSandwichCount"
                          type="number"
                          value={formData.actualSandwichCount}
                          onChange={(e) => setFormData(prev => ({ ...prev, actualSandwichCount: parseInt(e.target.value) || 0 }))}
                          placeholder="Enter actual sandwich count"
                          min="0"
                          className="w-40"
                          data-testid="input-actual-sandwich-count"
                        />
                      </div>
                    )}

                    {/* Specific Types Mode for Actual Sandwiches */}
                    {actualSandwichMode === 'types' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label>Actual Sandwich Types & Quantities</Label>
                          <Button 
                            type="button" 
                            onClick={addActualSandwichType} 
                            size="sm"
                            data-testid="button-add-actual-sandwich-type"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Type
                          </Button>
                        </div>
                        
                        {formData.actualSandwichTypes.length === 0 ? (
                          <div className="text-center py-4 text-[#007E8C] border-2 border-dashed border-[#236383]/30 rounded">
                            <p>No actual sandwich types added yet. Click "Add Type" to get started.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {formData.actualSandwichTypes.map((sandwich, index) => (
                              <div key={index} className="flex items-center gap-3 p-3 border rounded bg-white">
                                <Select
                                  value={sandwich.type}
                                  onValueChange={(value) => updateActualSandwichType(index, 'type', value)}
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
                                  onChange={(e) => updateActualSandwichType(index, 'quantity', parseInt(e.target.value) || 0)}
                                  className="w-24"
                                  min="0"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeActualSandwichType(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <div className="text-sm text-[#236383] bg-white p-2 rounded border border-[#236383]/30">
                              <strong>Total:</strong> {formData.actualSandwichTypes.reduce((sum, item) => sum + item.quantity, 0)} sandwiches
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="actualSandwichCountRecordedDate">Date Recorded</Label>
                      <Input
                        id="actualSandwichCountRecordedDate"
                        type="date"
                        value={formData.actualSandwichCountRecordedDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, actualSandwichCountRecordedDate: e.target.value }))}
                        data-testid="input-actual-sandwich-recorded-date"
                      />
                    </div>

                    <div>
                      <Label htmlFor="actualSandwichCountRecordedBy">Recorded By</Label>
                      <Input
                        id="actualSandwichCountRecordedBy"
                        value={formData.actualSandwichCountRecordedBy}
                        onChange={(e) => setFormData(prev => ({ ...prev, actualSandwichCountRecordedBy: e.target.value }))}
                        placeholder="Enter name of person who recorded the count"
                        data-testid="input-actual-sandwich-recorded-by"
                      />
                    </div>
                  </div>

                  {/* Follow-up Completion Section */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-[#236383]">Follow-up Completion</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="followUpOneDayCompleted"
                            checked={formData.followUpOneDayCompleted}
                            onChange={(e) => setFormData(prev => ({ ...prev, followUpOneDayCompleted: e.target.checked }))}
                            className="w-4 h-4"
                            data-testid="checkbox-followup-oneday-completed"
                          />
                          <Label htmlFor="followUpOneDayCompleted">1-Day Follow-up Completed</Label>
                        </div>
                        {formData.followUpOneDayCompleted && (
                          <div className="ml-6">
                            <Label htmlFor="followUpOneDayDate">Follow-up Date</Label>
                            <Input
                              id="followUpOneDayDate"
                              type="date"
                              value={formData.followUpOneDayDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, followUpOneDayDate: e.target.value }))}
                              data-testid="input-followup-oneday-date"
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="followUpOneMonthCompleted"
                            checked={formData.followUpOneMonthCompleted}
                            onChange={(e) => setFormData(prev => ({ ...prev, followUpOneMonthCompleted: e.target.checked }))}
                            className="w-4 h-4"
                            data-testid="checkbox-followup-onemonth-completed"
                          />
                          <Label htmlFor="followUpOneMonthCompleted">1-Month Follow-up Completed</Label>
                        </div>
                        {formData.followUpOneMonthCompleted && (
                          <div className="ml-6">
                            <Label htmlFor="followUpOneMonthDate">Follow-up Date</Label>
                            <Input
                              id="followUpOneMonthDate"
                              type="date"
                              value={formData.followUpOneMonthDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, followUpOneMonthDate: e.target.value }))}
                              data-testid="input-followup-onemonth-date"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="followUpNotes">Follow-up Notes</Label>
                      <Textarea
                        id="followUpNotes"
                        value={formData.followUpNotes}
                        onChange={(e) => setFormData(prev => ({ ...prev, followUpNotes: e.target.value }))}
                        placeholder="Notes from follow-up conversations or feedback received"
                        className="min-h-[80px]"
                        data-testid="textarea-followup-notes"
                      />
                    </div>
                  </div>

                  {/* Recipient Assignment Section */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-[#236383]">Recipient Assignment</h4>
                    <div className="space-y-2">
                      <Label>Recipient Organizations</Label>
                      <p className="text-sm text-gray-500 mb-2">
                        Track which recipient organizations actually received the sandwiches from this event
                      </p>
                      <MultiRecipientSelector
                        value={formData.assignedRecipientIds}
                        onChange={(ids) => setFormData(prev => ({ ...prev, assignedRecipientIds: ids }))}
                        placeholder="Select recipient organizations..."
                        data-testid="multi-recipient-selector"
                      />
                    </div>
                  </div>
                  
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {/* Delete button - only show for existing events */}
              {eventRequest && onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
                  onClick={() => {
                    if (eventRequest && confirm('Are you sure you want to delete this event request? This action cannot be undone.')) {
                      if (onDelete) {
                        onDelete(eventRequest.id);
                      } else {
                        deleteEventRequestMutation.mutate(eventRequest.id);
                      }
                    }
                  }}
                  disabled={deleteEventRequestMutation.isPending}
                  data-testid="button-delete-event"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteEventRequestMutation.isPending ? 'Deleting...' : 'Delete Event'}
                </Button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="text-white"
                style={{ backgroundColor: '#236383' }}
                disabled={updateEventRequestMutation.isPending || createEventRequestMutation.isPending}
                data-testid="button-submit"
              >
                {(updateEventRequestMutation.isPending || createEventRequestMutation.isPending)
                  ? (mode === 'edit' ? 'Saving...' : 'Scheduling...') 
                  : (mode === 'edit' ? 'Save Changes' : 'Schedule Event')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Date Change Confirmation Dialog */}
      <AlertDialog open={showDateConfirmation} onOpenChange={setShowDateConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Date Change</AlertDialogTitle>
            <AlertDialogDescription>
              This event is already scheduled. Changing the date may affect logistics, notifications, and volunteer assignments. 
              Are you sure you want to change the event date?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDateChangeCancellation}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDateChangeConfirmation}
              className="bg-[#236383] hover:bg-[#1a4e68]"
            >
              Yes, Change Date
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default EventSchedulingForm;