import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
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
  Users,
  MessageSquare,
  Edit,
  User,
  Calendar,
  MapPin,
  Sandwich,
  Car,
  FileText,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, invalidateEventRequestQueries } from '@/lib/queryClient';
import type { EventRequest } from '@shared/schema';
import { SANDWICH_TYPES } from './constants';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { getPickupDateTimeForInput, parsePostgresArray } from './utils';
import { RecipientSelector } from '@/components/ui/recipient-selector';
import { MultiRecipientSelector } from '@/components/ui/multi-recipient-selector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger } from '@/lib/logger';
import { isInMlkDayWeek } from '@/lib/mlk-day-utils';
import { MlkDayDialog } from '@/components/event-requests/MlkDayDialog';
import { useAuth } from '@/hooks/useAuth';
import { useEventCollaboration } from '@/hooks/use-event-collaboration';
import { PresenceAvatars, FieldLockIndicator } from '@/components/collaboration';
import { EventConflictWarnings } from './EventConflictWarnings';

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
    backupDates: [] as string[],
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '',
    pickupDateTime: '',
    pickupDate: '',
    pickupTimeSeparate: '',
    eventAddress: '',
    deliveryDestination: '',
    holdingOvernight: false,
    overnightHoldingLocation: '',
    overnightPickupTime: '',
    sandwichTypes: [] as Array<{type: string, quantity: number}>,
    hasRefrigeration: '',
    driversNeeded: 0,
    selfTransport: false,
    vanDriverNeeded: false,
    assignedVanDriverId: '',
    isDhlVan: false,
    speakersNeeded: 0,
    volunteersNeeded: 0,
    tspContact: '',
    customTspContact: '',
    message: '',
    schedulingNotes: '',
    planningNotes: '',
    nextAction: '',
    totalSandwichCount: 0,
    estimatedSandwichCountMin: 0,
    estimatedSandwichCountMax: 0,
    rangeSandwichType: '',
    volunteerCount: 0,
    estimatedAttendance: 0,
    adultCount: 0,
    childrenCount: 0,
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
    assignedRecipientIds: [] as string[],
    // Contact information fields
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organizationName: '',
    department: '',
    organizationCategory: '',
    schoolClassification: '',
    // Backup contact fields
    backupContactFirstName: '',
    backupContactLastName: '',
    backupContactEmail: '',
    backupContactPhone: '',
    backupContactRole: '',
    // Previously hosted flag
    previouslyHosted: 'i_dont_know',
    // Speaker details (conditional fields when speakers > 0)
    speakerAudienceType: '',
    speakerDuration: '',
    // Delivery details for overnight holding
    deliveryTimeWindow: '',
    deliveryParkingAccess: '',
  });

  const [sandwichMode, setSandwichMode] = useState<'total' | 'range' | 'types'>('total');
  const [actualSandwichMode, setActualSandwichMode] = useState<'total' | 'types'>('total');
  const [attendeeMode, setAttendeeMode] = useState<'total' | 'breakdown'>('total');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showBackupContactInfo, setShowBackupContactInfo] = useState(false);
  const [showCompletedDetails, setShowCompletedDetails] = useState(false);
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState('');
  const [isMessageEditable, setIsMessageEditable] = useState(false);
  const [showMlkDayDialog, setShowMlkDayDialog] = useState(false);
  const [mlkDayAsked, setMlkDayAsked] = useState(false);
  const [pendingMlkDayDecision, setPendingMlkDayDecision] = useState<boolean | null>(null);
  const [showVanConflictDialog, setShowVanConflictDialog] = useState(false);
  const [vanConflictDetails, setVanConflictDetails] = useState<{
    conflictingEvents: Array<{ id: number; name: string; time?: string }>;
    acknowledged: boolean;
  } | null>(null);
  const [showSpeakerWarningDialog, setShowSpeakerWarningDialog] = useState(false);
  const [vanConflictChecked, setVanConflictChecked] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Initialize collaboration hook only for existing events (not in create mode)
  // Pass null for new events - the hook safely handles this by disabling collaboration features
  const collaboration = useEventCollaboration(eventRequest?.id ?? null);
  const isCollaborationEnabled = eventRequest && eventRequest.id;

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
      const hasRangeData = (eventRequest as any)?.estimatedSandwichCountMin && (eventRequest as any)?.estimatedSandwichCountMax;
      const totalCount = eventRequest?.estimatedSandwichCount || 0;
      
      const existingActualSandwichTypes = eventRequest?.actualSandwichTypes ? 
        (typeof eventRequest?.actualSandwichTypes === 'string' ? 
          JSON.parse(eventRequest.actualSandwichTypes) : eventRequest?.actualSandwichTypes) : [];
      
      const hasActualTypesData = Array.isArray(existingActualSandwichTypes) && existingActualSandwichTypes.length > 0;

      setFormData({
        eventDate: eventRequest ? formatDateForInput(eventRequest.desiredEventDate) : '',
        backupDates: (eventRequest as any)?.backupDates?.map((d: string) => formatDateForInput(d)) || [],
        eventStartTime: eventRequest?.eventStartTime || '',
        eventEndTime: eventRequest?.eventEndTime || '',
        pickupTime: eventRequest?.pickupTime || '',
        pickupDateTime: getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate)),
        pickupDate: (() => {
          const pickupDT = getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate));
          return pickupDT ? pickupDT.split('T')[0] : '';
        })(),
        pickupTimeSeparate: (() => {
          const pickupDT = getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate));
          return pickupDT ? pickupDT.split('T')[1]?.substring(0, 5) : '';
        })(),
        eventAddress: eventRequest?.eventAddress || '',
        deliveryDestination: eventRequest?.deliveryDestination || '',
        holdingOvernight: !!(eventRequest?.overnightHoldingLocation),
        overnightHoldingLocation: eventRequest?.overnightHoldingLocation || '',
        overnightPickupTime: eventRequest?.overnightPickupTime || '',
        sandwichTypes: existingSandwichTypes,
        hasRefrigeration: eventRequest?.hasRefrigeration?.toString() || '',
        driversNeeded: eventRequest?.driversNeeded || 0,
        selfTransport: eventRequest?.selfTransport || false,
        vanDriverNeeded: eventRequest?.vanDriverNeeded || false,
        speakersNeeded: eventRequest?.speakersNeeded || 0,
        volunteersNeeded: eventRequest?.volunteersNeeded || 0,
        tspContact: eventRequest?.tspContact || '',
        customTspContact: (eventRequest as any)?.customTspContact || '',
        message: (eventRequest as any)?.message || '',
        schedulingNotes: (eventRequest as any)?.schedulingNotes || '',
        planningNotes: (eventRequest as any)?.planningNotes || '',
        nextAction: (eventRequest as any)?.nextAction || '',
        totalSandwichCount: totalCount,
        estimatedSandwichCountMin: (eventRequest as any)?.estimatedSandwichCountMin || 0,
        estimatedSandwichCountMax: (eventRequest as any)?.estimatedSandwichCountMax || 0,
        rangeSandwichType: (eventRequest as any)?.estimatedSandwichRangeType || '',
        volunteerCount: (eventRequest as any)?.volunteerCount || 0,
        estimatedAttendance: (eventRequest as any)?.estimatedAttendance || 0,
        adultCount: (eventRequest as any)?.adultCount || 0,
        childrenCount: (eventRequest as any)?.childrenCount || 0,
        // Contact information fields
        firstName: eventRequest?.firstName || '',
        lastName: eventRequest?.lastName || '',
        email: eventRequest?.email || '',
        phone: eventRequest?.phone || '',
        organizationName: eventRequest?.organizationName || '',
        department: eventRequest?.department || '',
        organizationCategory: (eventRequest as any)?.organizationCategory || '',
        schoolClassification: (eventRequest as any)?.schoolClassification || '',
        // Backup contact fields
        backupContactFirstName: (eventRequest as any)?.backupContactFirstName || '',
        backupContactLastName: (eventRequest as any)?.backupContactLastName || '',
        backupContactEmail: (eventRequest as any)?.backupContactEmail || '',
        backupContactPhone: (eventRequest as any)?.backupContactPhone || '',
        backupContactRole: (eventRequest as any)?.backupContactRole || '',
        // Previously hosted flag
        previouslyHosted: (eventRequest as any)?.previouslyHosted || 'i_dont_know',
        // Speaker details
        speakerAudienceType: (eventRequest as any)?.speakerAudienceType || '',
        speakerDuration: (eventRequest as any)?.speakerDuration || '',
        // Delivery details for overnight holding
        deliveryTimeWindow: (eventRequest as any)?.deliveryTimeWindow || '',
        deliveryParkingAccess: (eventRequest as any)?.deliveryParkingAccess || '',
        // Van driver assignment
        assignedVanDriverId: eventRequest?.assignedVanDriverId || '',
        isDhlVan: (eventRequest as any)?.isDhlVan || false,
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
        assignedRecipientIds: parsePostgresArray((eventRequest as any)?.assignedRecipientIds),
      });
      
      // Set mode based on existing data
      setSandwichMode(hasTypesData ? 'types' : hasRangeData ? 'range' : 'total');
      setActualSandwichMode(hasActualTypesData ? 'types' : 'total');

      // Set attendee mode based on whether adult/children breakdown exists
      const hasAttendeeBreakdown = ((eventRequest as any)?.adultCount || 0) > 0 || ((eventRequest as any)?.childrenCount || 0) > 0;
      setAttendeeMode(hasAttendeeBreakdown ? 'breakdown' : 'total');

      // Auto-expand Completed Event Details section if event is completed
      setShowCompletedDetails(eventRequest?.status === 'completed');
    }
  }, [isVisible, isOpen, eventRequest, mode]);

  const updateEventRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, data),
    retry: false,
    networkMode: 'always',
    onSuccess: (updatedEvent: any) => {
      // Mark as MLK Day if user decided to
      if (pendingMlkDayDecision === true && updatedEvent?.id) {
        markMlkDayMutation.mutate({ id: updatedEvent.id, isMlkDayEvent: true });
      }
      const isEditMode = mode === 'edit';
      toast({
        title: isEditMode ? 'Event updated successfully' : 'Event scheduled successfully',
        description: isEditMode ? 'The event details have been updated.' : 'The event has been moved to scheduled status with all details.',
      });
      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);
      onSuccessCallback();
      onClose();
      setPendingMlkDayDecision(null);
    },
    onError: (error: any) => {
      logger.error('Update event request error:', error);
      
      // Check if it's a 404 (event not found) error
      const isNotFound = error?.message?.includes('DATA_LOADING_ERROR') || 
                        error?.message?.includes('EVENT_NOT_FOUND') ||
                        error?.message?.includes('not found');
      
      const isEditMode = mode === 'edit';
      toast({
        title: isNotFound ? 'Event Not Found' : 'Error',
        description: isNotFound
          ? 'The event request was not found. It may have been deleted. Please refresh the page and try again.'
          : (isEditMode ? 'Failed to update event.' : 'Failed to schedule event.'),
        variant: 'destructive',
      });
    },
  });

  const createEventRequestMutation = useMutation({
    mutationFn: (data: any) => {
      logger.log('🚀 CREATE MUTATION: Sending data:', data);
      return apiRequest('POST', '/api/event-requests', data);
    },
    onSuccess: (response) => {
      logger.log('✅ CREATE MUTATION SUCCESS: Response:', response);
      // Mark as MLK Day if user decided to
      if (pendingMlkDayDecision === true && response?.id) {
        markMlkDayMutation.mutate({ id: response.id, isMlkDayEvent: true });
      }
      toast({
        title: 'Event created successfully',
        description: 'The new event request has been created.',
      });
      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);
      onSuccessCallback();
      onClose();
      setPendingMlkDayDecision(null);
    },
    onError: (error) => {
      logger.error('❌ CREATE MUTATION ERROR:', error);
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
      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);
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

  // Mutation to mark event as MLK Day event
  const markMlkDayMutation = useMutation({
    mutationFn: ({ id, isMlkDayEvent }: { id: number; isMlkDayEvent: boolean }) =>
      apiRequest('PATCH', `/api/event-requests/${id}/mlk-day`, { isMlkDayEvent }),
    onSuccess: () => {
      invalidateEventRequestQueries(queryClient);
    },
  });

  // Helper to check if event likely needs van based on user's criteria
  const eventLikelyNeedsVan = (): boolean => {
    // Check if van driver is explicitly needed
    if ((formData.vanDriverNeeded || formData.isDhlVan) && !formData.selfTransport) return true;
    
    // Check if sandwich count > 500 (implies van needed)
    const sandwichCount = sandwichMode === 'total' 
      ? formData.totalSandwichCount 
      : sandwichMode === 'range' 
        ? (formData.estimatedSandwichCountMax || formData.estimatedSandwichCountMin || 0)
        : formData.sandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
    if (sandwichCount > 500) return true;
    
    // Check if "van" is mentioned in notes
    const notes = `${formData.schedulingNotes || ''} ${formData.planningNotes || ''}`.toLowerCase();
    if (notes.includes('van') && !notes.includes('van-approved') && !notes.includes('van approved')) {
      return true;
    }
    
    return false;
  };

  // Check for van conflicts before submission
  const checkVanConflicts = async (): Promise<boolean> => {
    if (!formData.eventDate || !eventLikelyNeedsVan()) return true; // No check needed
    
    try {
      const response = await fetch(`/api/event-requests/conflicts-for-date?date=${formData.eventDate}`);
      if (!response.ok) return true; // Allow submission if check fails
      
      const data = await response.json();
      
      if (data.vanConflicts && data.vanConflicts.length > 0) {
        // There are van conflicts - show warning dialog
        const conflictingEvents = data.vanConflicts.flatMap((c: any) => [
          { id: c.event1?.id, name: c.event1?.organizationName, time: c.event1?.eventStartTime },
          { id: c.event2?.id, name: c.event2?.organizationName, time: c.event2?.eventStartTime },
        ]).filter((e: any) => e.id !== eventRequest?.id);
        
        // Remove duplicates
        const uniqueEvents = Array.from(new Map(conflictingEvents.map((e: any) => [e.id, e])).values());
        
        if (uniqueEvents.length > 0) {
          setVanConflictDetails({
            conflictingEvents: uniqueEvents as Array<{ id: number; name: string; time?: string }>,
            acknowledged: false,
          });
          setShowVanConflictDialog(true);
          return false; // Block submission until acknowledged
        }
      }
      
      return true; // No conflicts, proceed
    } catch (error) {
      console.error('Error checking van conflicts:', error);
      return true; // Allow submission if check fails
    }
  };

  const performSubmit = async (skipSpeakerWarning = false) => {
    // Warning: Events with >500 sandwiches usually need a speaker
    let totalRelevantSandwiches = 0;
    
    // Check sandwich types mode
    if (sandwichMode === 'types' && formData.sandwichTypes && formData.sandwichTypes.length > 0) {
      totalRelevantSandwiches = formData.sandwichTypes
        .filter((item: { type: string; quantity: number }) => {
          const typeLower = item.type.toLowerCase();
          // Check for deli (includes deli_turkey, deli_ham, etc.), turkey (standalone), or unknown
          return (
            typeLower === 'deli' ||
            typeLower.includes('deli') ||
            typeLower === 'turkey' ||
            typeLower === 'deli_turkey' ||
            typeLower === 'unknown'
          );
        })
        .reduce((sum: number, item: { type: string; quantity: number }) => sum + item.quantity, 0);
    } else if (sandwichMode === 'total' && formData.totalSandwichCount > 500) {
      // If using total mode and >500, we can't determine types, so check if speakers are needed
      // This is a conservative check - we'll warn if total >500
      totalRelevantSandwiches = formData.totalSandwichCount;
    } else if (sandwichMode === 'range') {
      // For range mode, check the max value
      const maxCount = formData.estimatedSandwichCountMax || formData.estimatedSandwichCountMin || 0;
      if (maxCount > 500) {
        // Can't determine types in range mode, so conservatively warn if max >500
        totalRelevantSandwiches = maxCount;
      }
    }
    
    // Show warning dialog if event has >500 sandwiches and no speakers, but allow proceeding
    if (!skipSpeakerWarning && totalRelevantSandwiches > 500 && formData.speakersNeeded < 1) {
      setShowSpeakerWarningDialog(true);
      return; // Stop submission until user responds
    }

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
      backupDates: formData.backupDates.filter(d => d).map(d => serializeDateToISO(d)),
      // If status is scheduled, also set scheduledEventDate
      ...(formData.status === 'scheduled' ? { scheduledEventDate: serializeDateToISO(formData.eventDate) } : {}),
      eventStartTime: formData.eventStartTime || null,
      eventEndTime: formData.eventEndTime || null,
      pickupTime: formData.pickupTime || null,
      pickupDateTime: (() => {
        // Combine pickupDate and pickupTimeSeparate into pickupDateTime if both are set
        if (formData.pickupDate && formData.pickupTimeSeparate) {
          return `${formData.pickupDate}T${formData.pickupTimeSeparate}`;
        }
        // Otherwise use the existing pickupDateTime value
        return formData.pickupDateTime || null;
      })(),
      eventAddress: formData.eventAddress || null,
      deliveryDestination: formData.deliveryDestination || null,
      overnightHoldingLocation: formData.overnightHoldingLocation || null,
      overnightPickupTime: formData.overnightPickupTime || null,
      hasRefrigeration: formData.hasRefrigeration === 'true' ? true :
                        formData.hasRefrigeration === 'false' ? false : null,
      driversNeeded: formData.selfTransport ? 0 : (parseInt(formData.driversNeeded?.toString() || '0') || 0),
      selfTransport: formData.selfTransport || false,
      vanDriverNeeded: formData.selfTransport ? false : ((formData.vanDriverNeeded || false) || formData.isDhlVan),
      speakersNeeded: parseInt(formData.speakersNeeded?.toString() || '0') || 0,
      volunteersNeeded: parseInt(formData.volunteersNeeded?.toString() || '0') || 0,
      estimatedAttendance: parseInt(formData.estimatedAttendance?.toString() || '0') || null,
      tspContact: formData.tspContact || null,
      customTspContact: formData.customTspContact?.trim() || null,
      message: formData.message || null,
      schedulingNotes: formData.schedulingNotes || null,
      planningNotes: formData.planningNotes || null,
      nextAction: formData.nextAction || null,
      // Contact information fields
      firstName: formData.firstName || null,
      lastName: formData.lastName || null,
      email: formData.email || null,
      phone: formData.phone || null,
      organizationName: formData.organizationName || null,
      department: formData.department || null,
      organizationCategory: formData.organizationCategory || null,
      schoolClassification: formData.schoolClassification || null,
      // Backup contact fields
      backupContactFirstName: formData.backupContactFirstName || null,
      backupContactLastName: formData.backupContactLastName || null,
      backupContactEmail: formData.backupContactEmail || null,
      backupContactPhone: formData.backupContactPhone || null,
      backupContactRole: formData.backupContactRole || null,
      // Previously hosted flag
      previouslyHosted: formData.previouslyHosted || null,
      // Speaker details
      speakerAudienceType: formData.speakerAudienceType || null,
      speakerDuration: formData.speakerDuration || null,
      // Delivery details for overnight holding
      deliveryTimeWindow: formData.deliveryTimeWindow || null,
      deliveryParkingAccess: formData.deliveryParkingAccess || null,
      // Van driver assignment
      assignedVanDriverId: formData.isDhlVan
        ? null
        : (formData.assignedVanDriverId && formData.assignedVanDriverId !== 'none')
          ? formData.assignedVanDriverId
          : null,
      isDhlVan: formData.selfTransport ? false : !!formData.isDhlVan,
      // Toolkit information
      toolkitStatus: formData.toolkitStatus || null,
      toolkitSentDate: serializeDateToISO(formData.toolkitSentDate),
    };

    // Handle sandwich data based on mode
    if (sandwichMode === 'total') {
      eventData.estimatedSandwichCount = formData.totalSandwichCount;
      eventData.sandwichTypes = null; // Clear specific types when using total mode
      eventData.estimatedSandwichCountMin = null;
      eventData.estimatedSandwichCountMax = null;
    } else if (sandwichMode === 'range') {
      eventData.estimatedSandwichCountMin = formData.estimatedSandwichCountMin || null;
      eventData.estimatedSandwichCountMax = formData.estimatedSandwichCountMax || null;
      eventData.estimatedSandwichRangeType = formData.rangeSandwichType || null;
      eventData.estimatedSandwichCount = null; // Clear exact count when using range
      eventData.sandwichTypes = null;
    } else {
      eventData.sandwichTypes = JSON.stringify(formData.sandwichTypes);
      eventData.estimatedSandwichCount = formData.sandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
      eventData.estimatedSandwichCountMin = null;
      eventData.estimatedSandwichCountMax = null;
    }

    // Include volunteer/attendee counts
    eventData.volunteerCount = formData.volunteerCount || 0;
    eventData.adultCount = formData.adultCount || 0;
    eventData.childrenCount = formData.childrenCount || 0;

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

    logger.log('📋 FORM SUBMIT DEBUG:');
    logger.log('  - eventRequest exists?', !!eventRequest);
    logger.log('  - eventRequest.id:', eventRequest?.id);
    logger.log('  - mode:', mode);
    logger.log('  - isCreateMode:', isCreateMode);
    logger.log('  - eventData being sent:', eventData);

    if (eventRequest) {
      if (!eventRequest.id) {
        logger.error('❌ Event request object exists but has no ID');
        toast({
          title: 'Error',
          description: 'Event request ID is missing. Please refresh the page and try again.',
          variant: 'destructive',
        });
        return;
      }
      
      logger.log('🔄 Calling UPDATE mutation for event ID:', eventRequest.id);
      // Update existing event request
      updateEventRequestMutation.mutate({
        id: eventRequest.id,
        data: eventData,
      });
    } else {
      logger.log('➕ Calling CREATE mutation for new event');
      // Create new event request
      createEventRequestMutation.mutate(eventData);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if event is in MLK Day week and we haven't asked yet
    if (formData.eventDate && isInMlkDayWeek(formData.eventDate) && !mlkDayAsked && !eventRequest?.isMlkDayEvent) {
      setShowMlkDayDialog(true);
      setMlkDayAsked(true);
      return; // Stop submission until user responds
    }

    // Check for van conflicts if event needs van and hasn't been checked yet
    if (eventLikelyNeedsVan() && !vanConflictChecked) {
      const canProceed = await checkVanConflicts();
      if (!canProceed) return; // Wait for user to acknowledge
    }

    // All checks passed, proceed with submission
    await performSubmit(false);
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
  };

  // MLK Day dialog handlers
  const handleMlkDayMark = () => {
    setPendingMlkDayDecision(true);
    setShowMlkDayDialog(false);
    // Re-trigger submission with MLK Day decision made
    handleSubmit(new Event('submit') as any);
  };

  const handleMlkDaySkip = () => {
    setPendingMlkDayDecision(false);
    setShowMlkDayDialog(false);
    // Re-trigger submission with MLK Day decision made
    handleSubmit(new Event('submit') as any);
  };

  // For create mode, we can work with null eventRequest
  const isCreateMode = mode === 'create' || !eventRequest;

  // Handle real-time field updates from other users
  useEffect(() => {
    if (!isCollaborationEnabled || !collaboration) return;

    const cleanup = collaboration.onFieldUpdate?.((fieldName, value, version) => {
      logger.log(`[EventSchedulingForm] Field ${fieldName} updated by another user:`, value);
      
      // Update formData with the new value from another user
      setFormData(prev => ({
        ...prev,
        [fieldName]: value,
      }));

      // Show toast notification
      toast({
        title: 'Field Updated',
        description: `${fieldName} was updated by another user.`,
      });
    });

    return cleanup;
  }, [isCollaborationEnabled, collaboration, toast]);

  // Field locking handlers
  const handleFieldFocus = useCallback(async (fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return;
    
    try {
      await collaboration.acquireFieldLock?.(fieldName);
      logger.log(`[EventSchedulingForm] Acquired lock for field: ${fieldName}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`[EventSchedulingForm] Failed to acquire lock for ${fieldName}:`, err);
      
      // Only show "locked by another user" toast if it's actually a lock conflict
      // Connection errors and timeouts should not be presented as lock conflicts
      const isLockConflict = err.message?.includes('locked by') || err.message?.includes('Field is locked');
      
      if (isLockConflict) {
        toast({
          title: 'Field Locked',
          description: err.message || 'This field is currently being edited by another user.',
          variant: 'destructive',
        });
      } else {
        // Connection or timeout error - log but don't show disruptive toast
        logger.warn(`[EventSchedulingForm] Lock acquisition failed (connection issue): ${err.message}`);
      }
    }
  }, [isCollaborationEnabled, collaboration, toast]);

  const handleFieldBlur = useCallback(async (fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return;
    
    try {
      await collaboration.releaseFieldLock?.(fieldName);
      logger.log(`[EventSchedulingForm] Released lock for field: ${fieldName}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`[EventSchedulingForm] Failed to release lock for ${fieldName}:`, err);
    }
  }, [isCollaborationEnabled, collaboration]);

  const isFieldLockedByOther = useCallback((fieldName: string): boolean => {
    if (!isCollaborationEnabled || !collaboration || !currentUser) return false;
    return collaboration.isFieldLockedByOther?.(fieldName, currentUser.id) || false;
  }, [isCollaborationEnabled, collaboration, currentUser]);

  const getFieldLock = useCallback((fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return null;
    return collaboration.locks?.get(fieldName) || null;
  }, [isCollaborationEnabled, collaboration]);

  // Cleanup: release all field locks when dialog closes or component unmounts
  useEffect(() => {
    return () => {
      if (!isCollaborationEnabled || !collaboration?.locks || !currentUser) {
        return;
      }

      // Release any locks held by the current user when leaving
      const releasePromises: Promise<void>[] = [];

      collaboration.locks.forEach((lock, fieldName) => {
        if (lock.lockedBy === currentUser.id) {
          const releasePromise = (
            collaboration.releaseFieldLock?.(fieldName) ?? Promise.resolve()
          )
            .then(() => {
              logger.log(
                `[EventSchedulingForm] Cleanup: Released lock for field: ${fieldName}`
              );
            })
            .catch((error) => {
              logger.error(
                `[EventSchedulingForm] Cleanup: Failed to release lock for ${fieldName}:`,
                error
              );
            });

          releasePromises.push(releasePromise);
        }
      });

      if (releasePromises.length > 0) {
        // Fire-and-forget; React does not await cleanup promises
        void Promise.all(releasePromises);
      }
    };
  }, [isCollaborationEnabled, collaboration, currentUser]);

  // Section completion tracking for progress indicator
  const sectionStatus = {
    contact: !!(formData.firstName || formData.lastName || formData.email || formData.phone),
    schedule: !!(formData.eventDate),
    delivery: !!(formData.eventAddress || formData.assignedRecipientIds.length > 0),
    sandwiches: !!(formData.totalSandwichCount > 0 || formData.sandwichTypes.length > 0 || formData.estimatedSandwichCountMin > 0),
    resources: !!(formData.driversNeeded > 0 || formData.speakersNeeded > 0 || formData.volunteersNeeded > 0 || formData.selfTransport),
    notes: !!(formData.schedulingNotes || formData.planningNotes || formData.nextAction),
  };
  const completedSections = Object.values(sectionStatus).filter(Boolean).length;
  const totalSections = Object.keys(sectionStatus).length;

  return (
    <Dialog open={dialogOpen} onOpenChange={onClose} modal={false}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-[#236383]">
              {isCreateMode ? 'Create New Event' : `${mode === 'edit' ? 'Edit Event Details:' : 'Schedule Event:'} ${eventRequest?.organizationName}`}
            </DialogTitle>
            {isCollaborationEnabled && currentUser && (
              <div className="flex items-center gap-2" data-testid="presence-avatars-container">
                <PresenceAvatars 
                  users={collaboration.presentUsers || []} 
                  currentUserId={currentUser.id} 
                />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="bg-slate-50 rounded-lg p-3 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#236383]">Form Progress</span>
            <span className="text-sm text-gray-600">{completedSections} of {totalSections} sections</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#47B3CB] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedSections / totalSections) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact Information Section - Collapsible */}
          <div className="border rounded-lg overflow-hidden">
            <Button
              type="button"
              variant="ghost"
              className="w-full flex justify-between items-center p-4 bg-[#e6f2f5] hover:bg-[#d4e8ed]"
              onClick={() => setShowContactInfo(!showContactInfo)}
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-[#236383]" />
                <span className="font-semibold text-[#236383]">Primary Contact Information</span>
                {sectionStatus.contact && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              </div>
              <ChevronDown className={`w-4 h-4 text-[#236383] transition-transform ${showContactInfo ? 'rotate-180' : ''}`} />
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
                    <Label htmlFor="previouslyHosted">Previously Hosted?</Label>
                    <Select
                      value={formData.previouslyHosted || 'i_dont_know'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, previouslyHosted: value }))}
                    >
                      <SelectTrigger id="previouslyHosted">
                        <SelectValue placeholder="Select hosting history" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                        <SelectItem value="yes">Yes - Hosted Before</SelectItem>
                        <SelectItem value="no">No - First Time</SelectItem>
                        <SelectItem value="i_dont_know">I Don't Know</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                        <SelectItem value="school">School</SelectItem>
                        <SelectItem value="church_faith">Church/Faith Group</SelectItem>
                        <SelectItem value="religious">Religious Organization</SelectItem>
                        <SelectItem value="nonprofit">Nonprofit</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="hospital">Hospital</SelectItem>
                        <SelectItem value="political">Political Organization</SelectItem>
                        <SelectItem value="club">Club</SelectItem>
                        <SelectItem value="neighborhood">Neighborhood</SelectItem>
                        <SelectItem value="greek_life">Fraternity/Sorority</SelectItem>
                        <SelectItem value="cultural">Cultural Organization</SelectItem>
                        <SelectItem value="corp">Company</SelectItem>
                        <SelectItem value="large_corp">Large Corporation</SelectItem>
                        <SelectItem value="small_medium_corp">Small/Medium Business</SelectItem>
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
                        <SelectContent className="z-[200]" position="popper" sideOffset={5}>
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

          {/* Backup Contact Information Section - Collapsible */}
          <div className="border rounded-lg">
            <Button
              type="button"
              variant="ghost"
              className="w-full flex justify-between items-center p-4"
              onClick={() => setShowBackupContactInfo(!showBackupContactInfo)}
            >
              <span className="font-semibold text-sm text-gray-700">
                Backup/Secondary Contact (Optional)
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showBackupContactInfo ? 'rotate-180' : ''}`} />
            </Button>

            {showBackupContactInfo && (
              <div className="p-4 border-t bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="backupFirstName" className="text-sm">First Name</Label>
                  <Input
                    id="backupFirstName"
                    value={formData.backupContactFirstName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, backupContactFirstName: e.target.value }))}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label htmlFor="backupLastName" className="text-sm">Last Name</Label>
                  <Input
                    id="backupLastName"
                    value={formData.backupContactLastName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, backupContactLastName: e.target.value }))}
                    placeholder="Enter last name"
                  />
                </div>
                <div>
                  <Label htmlFor="backupEmail" className="text-sm">Email</Label>
                  <Input
                    id="backupEmail"
                    type="email"
                    value={formData.backupContactEmail || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, backupContactEmail: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="backupPhone" className="text-sm">Phone</Label>
                  <Input
                    id="backupPhone"
                    value={formData.backupContactPhone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, backupContactPhone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="backupRole" className="text-sm">Role/Title</Label>
                  <Input
                    id="backupRole"
                    value={formData.backupContactRole || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, backupContactRole: e.target.value }))}
                    placeholder="e.g., Assistant Principal, Events Coordinator"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                <SelectItem value="new">New Request</SelectItem>
                <SelectItem value="in_process">In Process</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="postponed">Postponed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  <SelectContent className="z-[200]" position="popper" sideOffset={5}>
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

          {/* Event Schedule */}
          <div className="space-y-4 border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-3 pb-2 border-b">
              <Calendar className="w-5 h-5 text-[#236383]" />
              <span className="text-lg font-semibold text-[#236383]">Event Schedule</span>
              {sectionStatus.schedule && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            </div>

            {/* Conflict Warnings */}
            <EventConflictWarnings
              eventId={eventRequest?.id}
              scheduledEventDate={formData.eventDate || null}
              eventStartTime={formData.eventStartTime || null}
              eventEndTime={formData.eventEndTime || null}
              pickupTime={formData.pickupTime || null}
              vanDriverNeeded={formData.vanDriverNeeded}
              selfTransport={formData.selfTransport}
              assignedVanDriverId={formData.assignedVanDriverId || null}
              assignedSpeakerIds={(eventRequest as any)?.assignedSpeakerIds || null}
              assignedRecipientIds={formData.assignedRecipientIds || null}
              organizationName={formData.organizationName || eventRequest?.organizationName || null}
              enabled={!!formData.eventDate}
            />

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
                    // Reset van conflict check when date changes
                    setVanConflictChecked(false);
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

              {/* Backup Dates */}
              <div className="md:col-span-2 lg:col-span-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Backup Dates (Optional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          backupDates: [...prev.backupDates, '']
                        }));
                      }}
                      className="h-7 text-xs"
                    >
                      + Add Backup Date
                    </Button>
                  </div>
                  {formData.backupDates.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {formData.backupDates.map((date, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={date}
                            onChange={(e) => {
                              const newBackupDates = [...formData.backupDates];
                              newBackupDates[index] = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                backupDates: newBackupDates
                              }));
                            }}
                            placeholder="Select backup date"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                backupDates: prev.backupDates.filter((_, i) => i !== index)
                              }));
                            }}
                            className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.backupDates.length === 0 && (
                    <p className="text-xs text-gray-500">
                      Add alternate dates if the primary event date is not available
                    </p>
                  )}
                </div>
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
                <Label htmlFor="pickupDate">Pickup Date</Label>
                <Input
                  id="pickupDate"
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      pickupDate: newDate,
                      // Combine date and time into pickupDateTime
                      pickupDateTime: newDate && prev.pickupTimeSeparate ? `${newDate}T${prev.pickupTimeSeparate}` : '',
                      pickupTime: ''
                    }));
                  }}
                  min={formData.eventDate || undefined}
                  data-testid="pickup-date-input"
                />
              </div>
              <div>
                <Label htmlFor="pickupTimeSeparate">Pickup Time</Label>
                <Input
                  id="pickupTimeSeparate"
                  type="time"
                  value={formData.pickupTimeSeparate}
                  onChange={(e) => {
                    const newTime = e.target.value;
                    setFormData(prev => {
                      // Validate: if pickup date is same as event date, time must be after event end time
                      let validatedTime = newTime;
                      if (prev.pickupDate === formData.eventDate && formData.eventEndTime && newTime) {
                        if (newTime <= formData.eventEndTime) {
                          // Time is before or equal to end time - keep the change but could show warning
                          validatedTime = newTime;
                        }
                      }
                      return { 
                        ...prev, 
                        pickupTimeSeparate: validatedTime,
                        // Combine date and time into pickupDateTime
                        pickupDateTime: prev.pickupDate && validatedTime ? `${prev.pickupDate}T${validatedTime}` : '',
                        pickupTime: ''
                      };
                    });
                  }}
                  min={formData.pickupDate === formData.eventDate && formData.eventEndTime ? formData.eventEndTime : undefined}
                  data-testid="pickup-time-input"
                />
                {formData.pickupDate === formData.eventDate &&
                 formData.eventEndTime &&
                 formData.pickupTimeSeparate &&
                 formData.pickupTimeSeparate < formData.eventEndTime && (
                  <p className="text-xs text-amber-600 mt-1">
                    Note: Pickup time is before event ends ({formData.eventEndTime})
                  </p>
                )}
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

            {/* Overnight Holding Checkbox */}
            <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                id="holdingOvernight"
                checked={formData.holdingOvernight}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData(prev => ({ 
                    ...prev, 
                    holdingOvernight: checked,
                    // Clear overnight fields if unchecking
                    ...(checked ? {} : {
                      overnightHoldingLocation: '',
                      overnightPickupTime: '',
                      deliveryTimeWindow: '',
                      deliveryParkingAccess: ''
                    })
                  }));
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                data-testid="checkbox-holding-overnight"
              />
              <Label htmlFor="holdingOvernight" className="text-sm font-medium text-blue-900 cursor-pointer">
                🌙 This group will hold sandwiches overnight
              </Label>
            </div>

            {/* Overnight Holding Location (shows when checkbox is checked) */}
            {formData.holdingOvernight && (
              <div className="space-y-2">
                <Label htmlFor="overnightHoldingLocation">
                  Overnight Holding Location
                </Label>
                <Input
                  id="overnightHoldingLocation"
                  value={formData.overnightHoldingLocation}
                  onChange={(e) => setFormData(prev => ({ ...prev, overnightHoldingLocation: e.target.value }))}
                  placeholder="Location where sandwiches will be stored overnight (e.g., church, community center)"
                  data-testid="input-overnight-location"
                />
                {formData.overnightHoldingLocation && (
                <div className="ml-4 mt-2 space-y-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900">Next-Day Delivery Details</h4>
                  <div>
                    <Label htmlFor="overnightPickupTime">Pickup Time from Overnight Location</Label>
                    <Input
                      id="overnightPickupTime"
                      type="time"
                      value={formData.overnightPickupTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, overnightPickupTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryTimeWindow">Delivery Time Window</Label>
                    <Input
                      id="deliveryTimeWindow"
                      type="text"
                      value={formData.deliveryTimeWindow || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, deliveryTimeWindow: e.target.value }))}
                      placeholder="e.g., 11:00 AM - 12:00 PM"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryParkingAccess">Parking/Access Details</Label>
                    <Textarea
                      id="deliveryParkingAccess"
                      value={formData.deliveryParkingAccess || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, deliveryParkingAccess: e.target.value }))}
                      placeholder="e.g., Park in rear lot, use loading dock entrance"
                      rows={2}
                    />
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Final Delivery Destination - Multiple Recipients */}
            <div>
              <Label htmlFor="deliveryDestination">
                {formData.overnightHoldingLocation ? '📍 Final Delivery Destinations' : '📍 Delivery Destinations'}
              </Label>
              <p className="text-sm text-gray-500 mb-2">
                Select one or more recipient organizations where the sandwiches will be delivered
              </p>
              <MultiRecipientSelector
                value={formData.assignedRecipientIds}
                onChange={(ids) => setFormData(prev => ({ ...prev, assignedRecipientIds: ids }))}
                placeholder={formData.overnightHoldingLocation
                  ? "Select recipient organizations for final delivery..."
                  : "Select recipient organizations..."}
                data-testid="delivery-destination-multi-selector"
              />
            </div>
          </div>

          {/* Sandwich Planning */}
          <div className="space-y-4 border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-3 pb-2 border-b">
              <Sandwich className="w-5 h-5 text-[#236383]" />
              <span className="text-lg font-semibold text-[#236383]">Sandwich Planning</span>
              {sectionStatus.sandwiches && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            </div>
            
            {/* Mode Selector */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={sandwichMode === 'total' ? 'default' : 'outline'}
                onClick={() => setSandwichMode('total')}
                className="text-xs"
              >
                Exact Count
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sandwichMode === 'range' ? 'default' : 'outline'}
                onClick={() => setSandwichMode('range')}
                className="text-xs"
              >
                Range
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
                  placeholder="Enter exact count (e.g., 550)"
                  min="0"
                  className="w-40"
                />
                <p className="text-sm text-[#236383]">
                  Use this when you know the exact count.
                </p>
              </div>
            )}

            {/* Range Mode */}
            {sandwichMode === 'range' && (
              <div className="space-y-3">
                <div>
                  <Label>Estimated Sandwich Range</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="sandwichCountMin"
                      type="number"
                      value={formData.estimatedSandwichCountMin || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedSandwichCountMin: parseInt(e.target.value) || 0 }))}
                      placeholder="Min (e.g., 500)"
                      min="0"
                      className="w-32"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      id="sandwichCountMax"
                      type="number"
                      value={formData.estimatedSandwichCountMax || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedSandwichCountMax: parseInt(e.target.value) || 0 }))}
                      placeholder="Max (e.g., 700)"
                      min="0"
                      className="w-32"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="rangeSandwichType">Type (Optional)</Label>
                  <Select
                    value={formData.rangeSandwichType || undefined}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, rangeSandwichType: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger id="rangeSandwichType" className="w-48">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                      <SelectItem value="none">No specific type</SelectItem>
                      {SANDWICH_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-[#236383]">
                  Use this when the final count isn't confirmed yet (e.g., 500-700 turkey sandwiches).
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
                          <SelectContent className="z-[200]" position="popper" sideOffset={5}>
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

          {/* Volunteer/Attendee Count (Optional) */}
          <div className="space-y-3">
            <Label># of Attendees (Optional)</Label>

            {/* Mode Selector */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={attendeeMode === 'total' ? 'default' : 'outline'}
                onClick={() => setAttendeeMode('total')}
                className="text-xs"
              >
                Total Count
              </Button>
              <Button
                type="button"
                size="sm"
                variant={attendeeMode === 'breakdown' ? 'default' : 'outline'}
                onClick={() => setAttendeeMode('breakdown')}
                className="text-xs"
              >
                Adults & Children
              </Button>
            </div>

            {/* Total Count Mode */}
            {attendeeMode === 'total' && (
              <div>
                <Label htmlFor="estimatedAttendance">Estimated Attendance</Label>
                <Input
                  id="estimatedAttendance"
                  type="number"
                  value={formData.estimatedAttendance}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedAttendance: parseInt(e.target.value) || 0, volunteerCount: parseInt(e.target.value) || 0, adultCount: 0, childrenCount: 0 }))}
                  placeholder="Enter estimated number of attendees"
                  min="0"
                  className="w-40"
                  data-testid="input-estimated-attendance"
                />
              </div>
            )}

            {/* Breakdown Mode */}
            {attendeeMode === 'breakdown' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adultCount">Adults</Label>
                  <Input
                    id="adultCount"
                    type="number"
                    value={formData.adultCount || 0}
                    onChange={(e) => {
                      const adults = parseInt(e.target.value) || 0;
                      const children = formData.childrenCount || 0;
                      setFormData(prev => ({
                        ...prev,
                        adultCount: adults,
                        volunteerCount: adults + children,
                        estimatedAttendance: adults + children
                      }));
                    }}
                    placeholder="# of adults"
                    min="0"
                    className="w-32"
                    data-testid="input-adult-count"
                  />
                </div>
                <div>
                  <Label htmlFor="childrenCount">Children</Label>
                  <Input
                    id="childrenCount"
                    type="number"
                    value={formData.childrenCount || 0}
                    onChange={(e) => {
                      const children = parseInt(e.target.value) || 0;
                      const adults = formData.adultCount || 0;
                      setFormData(prev => ({
                        ...prev,
                        childrenCount: children,
                        volunteerCount: adults + children,
                        estimatedAttendance: adults + children
                      }));
                    }}
                    placeholder="# of children"
                    min="0"
                    className="w-32"
                    data-testid="input-children-count"
                  />
                </div>
              </div>
            )}

            <p className="text-sm text-[#236383]">
              Optional: Estimate how many people will attend this event.
            </p>
          </div>

          {/* Refrigeration */}
          <div>
            <Label htmlFor="hasRefrigeration">Refrigeration Available?</Label>
            <Select value={formData.hasRefrigeration} onValueChange={(value) => setFormData(prev => ({ ...prev, hasRefrigeration: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select refrigeration status" />
              </SelectTrigger>
              <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resource Requirements */}
          <div className="space-y-4 border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-3 pb-2 border-b">
              <Car className="w-5 h-5 text-[#236383]" />
              <span className="text-lg font-semibold text-[#236383]">Resource Requirements</span>
              {sectionStatus.resources && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Drivers */}
            <div className="space-y-3">
              <Label>Driver Requirements</Label>
              <div className="space-y-2">
                {/* Self-Transport Option */}
                <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="selfTransport"
                    checked={formData.selfTransport}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      selfTransport: e.target.checked,
                      // Clear driver fields when self-transport is enabled
                      driversNeeded: e.target.checked ? 0 : prev.driversNeeded,
                      vanDriverNeeded: e.target.checked ? false : prev.vanDriverNeeded,
                      isDhlVan: e.target.checked ? false : prev.isDhlVan,
                    }))}
                  />
                  <Label htmlFor="selfTransport" className="text-amber-800 font-medium">
                    Organization Self-Transport
                  </Label>
                </div>
                {formData.selfTransport && (
                  <p className="text-sm text-amber-700 ml-6">
                    The organization will transport sandwiches themselves (no TSP driver needed).
                    Use the Delivery Destination field above to note where they're delivering.
                  </p>
                )}

                {/* Driver fields - only show when NOT self-transport */}
                {!formData.selfTransport && (
                  <>
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
                        onChange={(e) => setFormData(prev => ({ ...prev, vanDriverNeeded: e.target.checked, isDhlVan: e.target.checked ? prev.isDhlVan : false }))}
                      />
                      <Label htmlFor="vanDriverNeeded">Van driver needed?</Label>
                    </div>
                  </>
                )}
                
                {/* Van Driver Selection - Only show when van driver is needed and NOT self-transport */}
                {formData.vanDriverNeeded && !formData.selfTransport && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        id="isDhlVan"
                        checked={formData.isDhlVan}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          isDhlVan: e.target.checked,
                          assignedVanDriverId: e.target.checked ? '' : prev.assignedVanDriverId,
                          vanDriverNeeded: e.target.checked ? true : prev.vanDriverNeeded,
                        }))}
                      />
                      <Label htmlFor="isDhlVan">Use DHL van (external driver)</Label>
                    </div>
                    {formData.isDhlVan && (
                      <p className="text-xs text-amber-700 mb-2">
                        We will not assign an internal van driver. This still counts as the van being covered.
                      </p>
                    )}
                    <Label htmlFor="assignedVanDriver">Select Van Driver (Optional)</Label>
                    <Select
                      value={formData.assignedVanDriverId || ''}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, assignedVanDriverId: value }))}
                      disabled={formData.isDhlVan}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a van-approved driver..." />
                      </SelectTrigger>
                      <SelectContent className="z-[200]" position="popper" sideOffset={5}>
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

                {/* Speaker Details - Only show when speakers are needed */}
                {formData.speakersNeeded > 0 && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                    <h4 className="font-medium text-purple-900">Speaker Details</h4>
                    <div>
                      <Label htmlFor="speakerAudienceType">Audience Type</Label>
                      <Input
                        id="speakerAudienceType"
                        type="text"
                        value={formData.speakerAudienceType || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, speakerAudienceType: e.target.value }))}
                        placeholder="e.g., Elementary School, Adults, Mixed"
                      />
                    </div>
                    <div>
                      <Label htmlFor="speakerDuration">Duration</Label>
                      <Input
                        id="speakerDuration"
                        type="text"
                        value={formData.speakerDuration || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, speakerDuration: e.target.value }))}
                        placeholder="e.g., 30 minutes, 1 hour"
                      />
                    </div>
                  </div>
                )}

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
          </div>
          {/* TSP Contact Assignment */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="tspContact">TSP Contact Assignment</Label>
              {isCollaborationEnabled && isFieldLockedByOther('tspContact') && (
                <FieldLockIndicator 
                  lockedBy={getFieldLock('tspContact')?.lockedByName || 'Another user'} 
                  expiresAt={getFieldLock('tspContact')?.expiresAt}
                  data-testid="field-lock-tsp-contact"
                />
              )}
            </div>
            <Tabs 
              value={formData.customTspContact?.trim() ? 'custom' : 'user'} 
              onValueChange={(value) => {
                if (value === 'custom') {
                  setFormData(prev => ({ ...prev, tspContact: '', customTspContact: prev.customTspContact || '' }));
                } else {
                  setFormData(prev => ({ ...prev, customTspContact: '', tspContact: prev.tspContact || '' }));
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2 mb-3">
                <TabsTrigger value="user" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Select User
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Custom Contact
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="user" className="space-y-2">
                <Select 
                  value={formData.tspContact} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tspContact: value, customTspContact: '' }))}
                  disabled={isCollaborationEnabled && isFieldLockedByOther('tspContact')}
                >
                  <SelectTrigger
                    onFocus={() => handleFieldFocus('tspContact')}
                    onBlur={() => handleFieldBlur('tspContact')}
                    data-testid="select-tsp-contact"
                  >
                    <SelectValue placeholder="Select TSP contact" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              
              <TabsContent value="custom" className="space-y-2">
                <Textarea
                  id="customTspContact"
                  value={formData.customTspContact}
                  onChange={(e) => setFormData(prev => ({ ...prev, customTspContact: e.target.value, tspContact: '' }))}
                  onFocus={() => handleFieldFocus('tspContact')}
                  onBlur={() => handleFieldBlur('tspContact')}
                  placeholder="Enter custom TSP contact information (e.g., John Smith - john.smith@email.com - (555) 123-4567)"
                  className="min-h-[100px]"
                  disabled={isCollaborationEnabled && isFieldLockedByOther('tspContact')}
                  data-testid="textarea-custom-tsp-contact"
                />
                <p className="text-xs text-gray-500">
                  Use this for contacts not in the system. Enter name, email, phone, or other relevant information.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Contact Attempts History Section */}
          {eventRequest && (eventRequest.contactAttempts > 0 || eventRequest.unresponsiveNotes) && (
            <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Contact Attempts History
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="bg-white px-3 py-1 rounded border border-blue-300">
                    <span className="font-medium text-blue-900">Total Attempts:</span>{' '}
                    <span className="text-blue-700 font-bold">{eventRequest.contactAttempts || 0}</span>
                  </div>
                  {eventRequest.lastContactAttempt && (
                    <div className="bg-white px-3 py-1 rounded border border-blue-300">
                      <span className="font-medium text-blue-900">Last Attempt:</span>{' '}
                      <span className="text-blue-700">
                        {new Date(eventRequest.lastContactAttempt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  )}
                  {eventRequest.contactMethod && (
                    <div className="bg-white px-3 py-1 rounded border border-blue-300">
                      <span className="font-medium text-blue-900">Method:</span>{' '}
                      <span className="text-blue-700 capitalize">{eventRequest.contactMethod}</span>
                    </div>
                  )}
                </div>
                {eventRequest.unresponsiveNotes && (
                  <div className="bg-white p-3 rounded border border-blue-300">
                    <p className="text-sm font-medium text-blue-900 mb-1">Attempt Log:</p>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {eventRequest.unresponsiveNotes}
                    </div>
                  </div>
                )}
                {eventRequest.isUnresponsive && (
                  <div className="bg-yellow-100 border border-yellow-400 rounded p-2 flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-800">Marked as Unresponsive</p>
                      {eventRequest.unresponsiveReason && (
                        <p className="text-sm text-yellow-700">Reason: {eventRequest.unresponsiveReason}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes & Requirements Section */}
          <div className="space-y-4 border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-3 pb-2 border-b">
              <FileText className="w-5 h-5 text-[#236383]" />
              <span className="text-lg font-semibold text-[#236383]">Notes & Requirements</span>
              {sectionStatus.notes && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            </div>
            <div>
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
                          // Reset to original value from eventRequest
                          setFormData(prev => ({ ...prev, message: (eventRequest as any)?.message || '' }));
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

              {/* Next Action - Prominent field for intake tracking */}
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="nextAction" className="text-amber-800 font-semibold">Next Action</Label>
                  {isCollaborationEnabled && isFieldLockedByOther('nextAction') && (
                    <FieldLockIndicator
                      lockedBy={getFieldLock('nextAction')?.lockedByName || 'Another user'}
                      expiresAt={getFieldLock('nextAction')?.expiresAt}
                      data-testid="field-lock-next-action"
                    />
                  )}
                </div>
                <p className="text-sm text-amber-700 mb-2">What needs to happen next for this event? (e.g., "Waiting for callback", "Need to confirm date", "Follow up on van availability")</p>
                <Input
                  id="nextAction"
                  value={formData.nextAction}
                  onChange={(e) => setFormData(prev => ({ ...prev, nextAction: e.target.value }))}
                  onFocus={() => handleFieldFocus('nextAction')}
                  onBlur={() => handleFieldBlur('nextAction')}
                  placeholder="Enter the next action needed..."
                  className="bg-white border-amber-300 focus:border-amber-500"
                  disabled={isCollaborationEnabled && isFieldLockedByOther('nextAction')}
                  data-testid="input-next-action"
                />
              </div>

              {/* Scheduling Notes */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="schedulingNotes">Scheduling Notes</Label>
                  {isCollaborationEnabled && isFieldLockedByOther('schedulingNotes') && (
                    <FieldLockIndicator
                      lockedBy={getFieldLock('schedulingNotes')?.lockedByName || 'Another user'}
                      expiresAt={getFieldLock('schedulingNotes')?.expiresAt}
                      data-testid="field-lock-scheduling-notes"
                    />
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">Notes added while the event is being processed</p>
                <Textarea
                  id="schedulingNotes"
                  value={formData.schedulingNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, schedulingNotes: e.target.value }))}
                  onFocus={() => handleFieldFocus('schedulingNotes')}
                  onBlur={() => handleFieldBlur('schedulingNotes')}
                  placeholder="Add notes about scheduling, coordination, or processing status"
                  className="min-h-[80px]"
                  disabled={isCollaborationEnabled && isFieldLockedByOther('schedulingNotes')}
                  data-testid="textarea-scheduling-notes"
                />
              </div>

              {/* Planning Notes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="planningNotes">Planning Notes</Label>
                  {isCollaborationEnabled && isFieldLockedByOther('planningNotes') && (
                    <FieldLockIndicator 
                      lockedBy={getFieldLock('planningNotes')?.lockedByName || 'Another user'} 
                      expiresAt={getFieldLock('planningNotes')?.expiresAt}
                      data-testid="field-lock-planning-notes"
                    />
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">Notes for when the event is scheduled or being planned</p>
                <Textarea
                  id="planningNotes"
                  value={formData.planningNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, planningNotes: e.target.value }))}
                  onFocus={() => handleFieldFocus('planningNotes')}
                  onBlur={() => handleFieldBlur('planningNotes')}
                  placeholder="Add planning notes, logistics, or post-scheduling information"
                  className="min-h-[80px]"
                  disabled={isCollaborationEnabled && isFieldLockedByOther('planningNotes')}
                  data-testid="textarea-planning-notes"
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
                                  <SelectContent className="z-[200]" position="popper" sideOffset={5}>
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

                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {/* Delete button - only show for existing events in edit mode */}
              {eventRequest && mode === 'edit' && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
                  onClick={() => setShowDeleteConfirmation(true)}
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

      {/* MLK Day Dialog */}
      <MlkDayDialog
        isOpen={showMlkDayDialog}
        onClose={() => setShowMlkDayDialog(false)}
        onMarkAsMLK={handleMlkDayMark}
        onSkip={handleMlkDaySkip}
        eventDate={formData.eventDate}
      />

      {/* Van Conflict Warning Dialog */}
      <AlertDialog open={showVanConflictDialog} onOpenChange={setShowVanConflictDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Van Already Booked
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                The van appears to already be booked for another event on this date:
              </p>
              {vanConflictDetails && (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {vanConflictDetails.conflictingEvents.map((event, i) => (
                    <li key={event.id || i}>
                      <strong>{event.name}</strong>
                      {event.time && <span className="text-muted-foreground"> at {event.time}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="font-medium text-amber-700">
                Please confirm you have verified the van is available for the time you need it.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowVanConflictDialog(false);
              setVanConflictChecked(false);
            }}>
              Go Back & Check
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowVanConflictDialog(false);
                setVanConflictChecked(true);
                // Directly call performSubmit now that conflict is acknowledged
                await performSubmit(false);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              I've Verified Van Availability
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Speaker Warning Dialog */}
      <AlertDialog open={showSpeakerWarningDialog} onOpenChange={setShowSpeakerWarningDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              ⚠️ Speaker Recommendation
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                We usually send a speaker to events making more than 500 sandwiches. Are you sure this event doesn't need one?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowSpeakerWarningDialog(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowSpeakerWarningDialog(false);
                // Proceed with submission even without a speaker
                await performSubmit(true);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continue Without Speaker
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event request for{' '}
              <span className="font-semibold">{eventRequest?.organizationName}</span>?
              {eventRequest?.scheduledEventDate && (
                <> This event is scheduled for {new Date(eventRequest.scheduledEventDate).toLocaleDateString()}.</>
              )}
              <br /><br />
              <span className="text-red-600 font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirmation(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (eventRequest) {
                  if (onDelete) {
                    onDelete(eventRequest.id);
                  } else {
                    deleteEventRequestMutation.mutate(eventRequest.id);
                  }
                  setShowDeleteConfirmation(false);
                }
              }}
              className="bg-[#A31C41] hover:bg-[#8a1837]"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default EventSchedulingForm;
