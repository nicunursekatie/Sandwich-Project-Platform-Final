import { useState, useMemo, useEffect } from 'react';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SandwichForecastWidget from '@/components/sandwich-forecast-widget';
import StaffingForecastWidget from '@/components/staffing-forecast-widget';
import { EventEmailComposer } from '@/components/event-email-composer';
import RequestCard from '@/components/event-requests/RequestCard';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Plus,
  Calendar,
  Building,
  User,
  Users,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  Download,
  RotateCcw,
  ExternalLink,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Truck,
  TrendingUp,
  Save,
  X,
  History,
  HelpCircle,
  Shield,
  CalendarPlus,
  ArrowUp,
  Calculator,
  MapPin,
  Megaphone,
  FileText,
  UserPlus,
  Package,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import type { EventRequest } from '@shared/schema';
import { TaskAssigneeSelector } from './task-assignee-selector';
import {
  SANDWICH_TYPES,
  statusColors,
  SANDWICH_DESTINATIONS,
  statusIcons,
  previouslyHostedOptions,
  statusOptions,
} from './event-requests/constants';
import {
  formatTime12Hour,
  formatTimeForInput,
  getSandwichTypesSummary,
  formatEventDate,
  formatDateForInput,
} from './event-requests/utils';
import SandwichDestinationTracker from './event-requests/SandwichDestinationTracker';
import SandwichTypesSelector from './event-requests/SandwichTypesSelector';
import ToolkitSentDialog from './event-requests/ToolkitSentDialog';
import EventSchedulingForm from './event-requests/EventSchedulingForm';
import FollowUpDialog from './event-requests/FollowUpDialog';
import EventCollectionLog from './event-requests/EventCollectionLog';
import ImportEventsTab from './event-requests/ImportEventsTab';
import RequestFilters from './event-requests/RequestFilters';

// Schedule Call Dialog Component
interface ScheduleCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onCallScheduled: () => void;
  isLoading: boolean;
  scheduleCallDate: string;
  setScheduleCallDate: (date: string) => void;
  scheduleCallTime: string;
  setScheduleCallTime: (time: string) => void;
}

const ScheduleCallDialog: React.FC<ScheduleCallDialogProps> = ({
  isOpen,
  onClose,
  eventRequest,
  onCallScheduled,
  isLoading,
  scheduleCallDate,
  setScheduleCallDate,
  scheduleCallTime,
  setScheduleCallTime,
}) => {
  // Initialize date/time when dialog opens
  useEffect(() => {
    if (isOpen && eventRequest) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toTimeString().slice(0, 5); // HH:MM format
      setScheduleCallDate(dateStr);
      setScheduleCallTime(timeStr);
    }
  }, [isOpen, eventRequest, setScheduleCallDate, setScheduleCallTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleCallDate || !scheduleCallTime) return;
    onCallScheduled();
  };

  if (!eventRequest) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Phone className="w-5 h-5 text-[#007E8C]" />
            <span>Schedule Follow-up Call</span>
          </DialogTitle>
          <DialogDescription>
            Schedule a follow-up call with{' '}
            <strong>
              {eventRequest.firstName} {eventRequest.lastName}
            </strong>{' '}
            at <strong>{eventRequest.organizationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact Information */}
          <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-3">
            <h4 className="font-medium text-[#1A2332] mb-2">Contact Details</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#007E8C]" />
                <span>{eventRequest.email}</span>
              </div>
              {eventRequest.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-[#007E8C]" />
                  <span>{eventRequest.phone}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const phoneNumber = eventRequest.phone;
                      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                      
                      if (isMobile) {
                        window.location.href = `tel:${phoneNumber}`;
                      } else {
                        navigator.clipboard.writeText(phoneNumber || '');
                      }
                    }}
                    className="ml-auto text-xs"
                  >
                    {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Call' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Date and Time Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-call-date">Call Date</Label>
              <Input
                id="schedule-call-date"
                type="date"
                value={scheduleCallDate}
                onChange={(e) => setScheduleCallDate(e.target.value)}
                required
                data-testid="input-schedule-call-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-call-time">Call Time</Label>
              <Input
                id="schedule-call-time"
                type="time"
                value={scheduleCallTime}
                onChange={(e) => setScheduleCallTime(e.target.value)}
                required
                data-testid="input-schedule-call-time"
              />
            </div>
          </div>

          {/* Information */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h4 className="font-medium text-amber-900 mb-2">What happens when you schedule a call:</h4>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• A reminder will be set for the scheduled time</li>
              <li>• The event will remain in "In Process" status</li>
              <li>• You can update the call time later if needed</li>
            </ul>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!scheduleCallDate || !scheduleCallTime || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-confirm-schedule-call"
            >
              {isLoading ? 'Scheduling...' : 'Schedule Call'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};




export default function EventRequestsManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'organization' | 'event_date'>(
    'newest'
  );
  const [activeTab, setActiveTab] = useState('new');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showSandwichPlanningModal, setShowSandwichPlanningModal] = useState(false);
  const [showStaffingPlanningModal, setShowStaffingPlanningModal] = useState(false);

  // Event details dialog states
  const [selectedEventRequest, setSelectedEventRequest] =
    useState<EventRequest | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Modal sandwich form states
  const [modalSandwichMode, setModalSandwichMode] = useState<'total' | 'types'>('total');
  const [modalTotalCount, setModalTotalCount] = useState(0);
  const [modalSandwichTypes, setModalSandwichTypes] = useState<Array<{type: string, quantity: number}>>([]);

  // Event scheduling dialog state
  const [showSchedulingDialog, setShowSchedulingDialog] = useState(false);
  const [schedulingEventRequest, setSchedulingEventRequest] =
    useState<EventRequest | null>(null);

  // Collection log dialog state
  const [showCollectionLog, setShowCollectionLog] = useState(false);
  const [collectionLogEventRequest, setCollectionLogEventRequest] =
    useState<EventRequest | null>(null);

  // Toolkit sent dialog states
  const [showToolkitSentDialog, setShowToolkitSentDialog] = useState(false);
  const [toolkitEventRequest, setToolkitEventRequest] =
    useState<EventRequest | null>(null);

  // Driver/volunteer selection states
  const [showDriverSelection, setShowDriverSelection] = useState(false);
  const [showVolunteerSelection, setShowVolunteerSelection] = useState(false);

  // Schedule call dialog state
  const [showScheduleCallDialog, setShowScheduleCallDialog] = useState(false);
  const [scheduleCallDate, setScheduleCallDate] = useState('');
  const [scheduleCallTime, setScheduleCallTime] = useState('');

  // Follow-up dialog states
  const [showOneDayFollowUpDialog, setShowOneDayFollowUpDialog] = useState(false);
  const [showOneMonthFollowUpDialog, setShowOneMonthFollowUpDialog] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');

  // 1. Add state for inline editing of completed event fields:
  const [editingCompletedId, setEditingCompletedId] = useState<number | null>(
    null
  );

  // Add state for inline editing of scheduled event fields:
  const [editingScheduledId, setEditingScheduledId] = useState<number | null>(
    null
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Add state for assignment dialogs:
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [assignmentType, setAssignmentType] = useState<
    'driver' | 'speaker' | 'volunteer' | null
  >(null);
  const [assignmentEventId, setAssignmentEventId] = useState<number | null>(
    null
  );
  const [customPersonData, setCustomPersonData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    vanCapable: false,
  });

  // Inline sandwich editing states
  const [inlineSandwichMode, setInlineSandwichMode] = useState<'total' | 'types'>('total');
  const [inlineTotalCount, setInlineTotalCount] = useState(0);
  const [inlineSandwichTypes, setInlineSandwichTypes] = useState<Array<{type: string, quantity: number}>>([]);

  // Helper functions for inline editing
  const startEditing = (id: number, field: string, currentValue: string) => {
    setEditingScheduledId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');
    
    // Special handling for sandwich types
    if (field === 'sandwichTypes') {
      const eventRequest = eventRequests.find(req => req.id === id);
      if (eventRequest) {
        // Initialize sandwich editing state based on current data
        const existingSandwichTypes = eventRequest.sandwichTypes ? 
          (typeof eventRequest.sandwichTypes === 'string' ? 
            JSON.parse(eventRequest.sandwichTypes) : eventRequest.sandwichTypes) : [];
        
        const hasTypesData = Array.isArray(existingSandwichTypes) && existingSandwichTypes.length > 0;
        const totalCount = eventRequest.estimatedSandwichCount || 0;
        
        setInlineSandwichMode(hasTypesData ? 'types' : 'total');
        setInlineTotalCount(totalCount);
        setInlineSandwichTypes(hasTypesData ? existingSandwichTypes : []);
      }
    }
  };

  const saveEdit = () => {
    if (editingScheduledId && editingField) {
      // Show confirmation dialog for critical fields
      const criticalFields = ['eventStartTime', 'eventEndTime', 'pickupTime', 'eventAddress', 'hasRefrigeration', 'driversNeeded', 'speakersNeeded', 'volunteersNeeded'];
      
      if (criticalFields.includes(editingField)) {
        const fieldName = editingField.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
        const confirmed = window.confirm(`Are you sure you want to update ${fieldName}?\n\nThis will change the event details and may affect planning.`);
        if (!confirmed) {
          cancelEdit();
          return;
        }
      }
      // Special handling for sandwich types
      if (editingField === 'sandwichTypes') {
        const updateData: any = {};
        
        if (inlineSandwichMode === 'total') {
          updateData.estimatedSandwichCount = inlineTotalCount;
          updateData.sandwichTypes = null; // Clear specific types
        } else {
          updateData.sandwichTypes = JSON.stringify(inlineSandwichTypes);
          updateData.estimatedSandwichCount = inlineSandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
        }
        
        // Use the regular update mutation with multiple fields
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: updateData,
        });
      } else if (editingField === 'hasRefrigeration') {
        // Special handling for refrigeration - convert string to boolean/null
        let refrigerationValue: boolean | null;
        if (editingValue === 'true') {
          refrigerationValue = true;
        } else if (editingValue === 'false') {
          refrigerationValue = false;
        } else {
          refrigerationValue = null; // for 'unknown'
        }
        
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { hasRefrigeration: refrigerationValue },
        });
      } else {
        // Regular single field update
        updateScheduledFieldMutation.mutate({
          id: editingScheduledId,
          field: editingField,
          value: editingValue,
        });
      }
    }
  };

  const cancelEdit = () => {
    setEditingScheduledId(null);
    setEditingField(null);
    setEditingValue('');
    // Reset sandwich editing state
    setInlineSandwichMode('total');
    setInlineTotalCount(0);
    setInlineSandwichTypes([]);
  };

  // Helper functions for inline sandwich editing
  const addInlineSandwichType = () => {
    setInlineSandwichTypes(prev => [...prev, { type: 'turkey', quantity: 0 }]);
  };

  // Helper functions for modal sandwich editing
  const addModalSandwichType = () => {
    setModalSandwichTypes(prev => [...prev, { type: 'deli_turkey', quantity: 0 }]);
  };
  
  const updateModalSandwichType = (index: number, field: 'type' | 'quantity', value: string | number) => {
    setModalSandwichTypes(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };
  
  const removeModalSandwichType = (index: number) => {
    setModalSandwichTypes(prev => prev.filter((_, i) => i !== index));
  };
  
  const resetModalSandwichData = () => {
    setModalSandwichMode('total');
    setModalTotalCount(0);
    setModalSandwichTypes([]);
  };
  
  const initializeModalSandwichState = (eventRequest: EventRequest | null) => {
    if (!eventRequest) {
      // New event - start with default state
      resetModalSandwichData();
      return;
    }
    
    // Initialize based on existing event data
    const existingSandwichTypes = eventRequest.sandwichTypes ? 
      (typeof eventRequest.sandwichTypes === 'string' ? 
        JSON.parse(eventRequest.sandwichTypes) : eventRequest.sandwichTypes) : [];
    
    const hasTypesData = Array.isArray(existingSandwichTypes) && existingSandwichTypes.length > 0;
    const totalCount = eventRequest.estimatedSandwichCount || 0;
    
    if (hasTypesData) {
      // Has specific types data - use types mode
      setModalSandwichMode('types');
      setModalSandwichTypes(existingSandwichTypes);
      setModalTotalCount(existingSandwichTypes.reduce((sum, item) => sum + item.quantity, 0));
    } else {
      // Only has total count - use total mode
      setModalSandwichMode('total');
      setModalTotalCount(totalCount);
      setModalSandwichTypes([]);
    }
  };

  const updateInlineSandwichType = (index: number, field: 'type' | 'quantity', value: string | number) => {
    setInlineSandwichTypes(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeInlineSandwichType = (index: number) => {
    setInlineSandwichTypes(prev => prev.filter((_, i) => i !== index));
  };

  // Helper function to open assignment dialog
  const openAssignmentDialog = (
    eventId: number,
    type: 'driver' | 'speaker' | 'volunteer'
  ) => {
    setAssignmentEventId(eventId);
    setAssignmentType(type);
    setShowAssignmentDialog(true);
  };

  // Helper function to handle removing assignment
  const handleRemoveAssignment = async (personId: string, type: 'driver' | 'speaker' | 'volunteer', eventId: number) => {
    try {
      const eventRequest = eventRequests.find(req => req.id === eventId);
      if (!eventRequest) return;

      let updateData: any = {};

      if (type === 'driver') {
        // Remove from assignedDriverIds array
        const currentDrivers = eventRequest.assignedDriverIds || [];
        updateData.assignedDriverIds = currentDrivers.filter(id => id !== personId);

        // Remove from driver details
        const currentDriverDetails = eventRequest.driverDetails || {};
        const newDriverDetails = { ...currentDriverDetails };
        delete newDriverDetails[personId];
        updateData.driverDetails = newDriverDetails;
      } else if (type === 'speaker') {
        // Remove from speaker details
        const currentSpeakerDetails = eventRequest.speakerDetails || {};
        const newSpeakerDetails = { ...currentSpeakerDetails };
        delete newSpeakerDetails[personId];
        updateData.speakerDetails = newSpeakerDetails;

        // Remove from speaker assignments array
        const currentSpeakerAssignments = eventRequest.speakerAssignments || [];
        const speakerName = currentSpeakerDetails[personId]?.name;
        if (speakerName) {
          updateData.speakerAssignments = currentSpeakerAssignments.filter(name => name !== speakerName);
        }
      } else if (type === 'volunteer') {
        // Remove from assignedVolunteerIds array
        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        updateData.assignedVolunteerIds = currentVolunteers.filter(id => id !== personId);

        // Remove from volunteer details
        const currentVolunteerDetails = eventRequest.volunteerDetails || {};
        const newVolunteerDetails = { ...currentVolunteerDetails };
        delete newVolunteerDetails[personId];
        updateData.volunteerDetails = newVolunteerDetails;

        // Remove from volunteer assignments array
        const currentVolunteerAssignments = eventRequest.volunteerAssignments || [];
        const volunteerName = currentVolunteerDetails[personId]?.name;
        if (volunteerName) {
          updateData.volunteerAssignments = currentVolunteerAssignments.filter(name => name !== volunteerName);
        }
      }

      // Update the event request
      await updateEventRequestMutation.mutateAsync({
        id: eventId,
        data: updateData,
      });

      toast({
        title: 'Assignment removed',
        description: `Person has been removed from ${type} assignments`,
      });
    } catch (error) {
      console.error('Failed to remove assignment:', error);
      toast({
        title: 'Removal failed',
        description: 'Failed to remove assignment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Helper function to render events for a specific status
  const renderEventsForStatus = (status: string) => {
    return (requestsByStatus[status] || [])
      .filter((request: EventRequest) => {
        return (
          searchQuery === '' ||
          request.organizationName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          request.firstName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          request.lastName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          request.email
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (request.eventAddress && request.eventAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
          dateMatchesSearch(request.desiredEventDate, searchQuery)
        );
      })
      .sort((a: EventRequest, b: EventRequest) => {
        switch (sortBy) {
          case 'newest':
            return (
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
            );
          case 'oldest':
            return (
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()
            );
          case 'organization':
            return a.organizationName.localeCompare(
              b.organizationName
            );
          case 'event_date':
            const dateA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
            const dateB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
            return dateA - dateB;
          default:
            return 0;
        }
      })
      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      .map((request: EventRequest) => {
        const StatusIcon = statusIcons[request.status];
        const dateInfo = formatEventDate(
          request.desiredEventDate || ''
        );

        return (
          <RequestCard
            key={request.id}
            request={request}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            editingField={editingField}
            setEditingField={setEditingField}
            editingValue={editingValue}
            setEditingValue={setEditingValue}
            editingScheduledId={editingScheduledId}
            setEditingScheduledId={setEditingScheduledId}
            inlineSandwichMode={inlineSandwichMode}
            setInlineSandwichMode={setInlineSandwichMode}
            inlineTotalCount={inlineTotalCount}
            setInlineTotalCount={setInlineTotalCount}
            inlineSandwichTypes={inlineSandwichTypes}
            setInlineSandwichTypes={setInlineSandwichTypes}
            onEdit={(request) => {
              setSelectedEventRequest(request);
              setIsEditing(true);
              setShowEventDetails(true);
            }}
            onDelete={(id) => deleteEventRequestMutation.mutate(id)}
            onSchedule={(request) => {
              setSchedulingEventRequest(request);
              setShowSchedulingDialog(true);
            }}
            onCall={(request) => {
              const phoneNumber = request.phone;
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              
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
            }}
            onToolkit={(request) => {
              setSelectedEventRequest(request);
              setToolkitEventRequest(request);
              setShowToolkitSentDialog(true);
            }}
            onScheduleCall={(request) => {
              setSelectedEventRequest(request);
              setShowScheduleCallDialog(true);
            }}
            onFollowUp1Day={(request) => {
              setSelectedEventRequest(request);
              setShowOneDayFollowUpDialog(true);
            }}
            onFollowUp1Month={(request) => {
              setSelectedEventRequest(request);
              setShowOneMonthFollowUpDialog(true);
            }}
            onReschedule={(id) => handleStatusChange(id, 'new')}
            onContact={(request) => {
              const phone = request.phone;
              const email = request.email;
              const contactName = `${request.firstName} ${request.lastName}`;
              
              let message = `Contact ${contactName}:\n\n`;
              if (phone) message += `📞 Call: ${phone}\n`;
              if (email) message += `📧 Email: ${email}\n`;
              
              alert(message);
            }}
            onStatusChange={handleStatusChange}
            startEditing={startEditing}
            saveEdit={saveEdit}
            cancelEdit={cancelEdit}
            addInlineSandwichType={addInlineSandwichType}
            updateInlineSandwichType={updateInlineSandwichType}
            removeInlineSandwichType={removeInlineSandwichType}
            openAssignmentDialog={(eventId, type) => {
              setAssignmentEventId(eventId);
              setAssignmentType(type);
              setShowAssignmentDialog(true);
            }}
            handleRemoveAssignment={handleRemoveAssignment}
            handleSelfSignup={handleSelfSignup}
            canSelfSignup={canSelfSignup}
            isUserSignedUp={isUserSignedUp}
            resolveUserName={resolveUserName}
            resolveRecipientName={resolveRecipientName}
          />
        );
      });
  };

  // Helper function to handle assignment
  const handleAssignment = async (personId: string, personName: string) => {
    if (!assignmentEventId || !assignmentType) return;

    try {
      const eventRequest = eventRequests.find(
        (req) => req.id === assignmentEventId
      );
      if (!eventRequest) return;

      let updateData: any = {};

      if (assignmentType === 'driver') {
        // Add to assignedDriverIds array
        const currentDrivers = eventRequest.assignedDriverIds || [];
        const newDrivers = [...currentDrivers, personId];
        updateData.assignedDriverIds = newDrivers;

        // Update driver details
        const currentDriverDetails = eventRequest.driverDetails || {};
        updateData.driverDetails = {
          ...currentDriverDetails,
          [personId]: {
            name: personName,
            assignedAt: new Date().toISOString(),
            assignedBy: user?.id,
          },
        };
      } else if (assignmentType === 'speaker') {
        // Update speaker details
        const currentSpeakerDetails = eventRequest.speakerDetails || {};
        updateData.speakerDetails = {
          ...currentSpeakerDetails,
          [personId]: {
            name: personName,
            assignedAt: new Date().toISOString(),
            assignedBy: user?.id,
          },
        };

        // Update speaker assignments array for consistency
        const currentSpeakerAssignments = eventRequest.speakerAssignments || [];
        if (!currentSpeakerAssignments.includes(personName)) {
          updateData.speakerAssignments = [...currentSpeakerAssignments, personName];
        }
      } else if (assignmentType === 'volunteer') {
        // Add to assignedVolunteerIds array
        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        const newVolunteers = [...currentVolunteers, personId];
        updateData.assignedVolunteerIds = newVolunteers;

        // Update volunteer details for consistency
        const currentVolunteerDetails = eventRequest.volunteerDetails || {};
        updateData.volunteerDetails = {
          ...currentVolunteerDetails,
          [personId]: {
            name: personName,
            assignedAt: new Date().toISOString(),
            assignedBy: user?.id,
          },
        };

        // Update volunteer assignments array for consistency
        const currentVolunteerAssignments = eventRequest.volunteerAssignments || [];
        if (!currentVolunteerAssignments.includes(personName)) {
          updateData.volunteerAssignments = [...currentVolunteerAssignments, personName];
        }
      }

      // Update the event request
      await updateEventRequestMutation.mutateAsync({
        id: assignmentEventId,
        data: updateData,
      });

      toast({
        title: 'Assignment successful',
        description: `${personName} has been assigned as ${assignmentType}`,
      });
    } catch (error) {
      console.error('Failed to assign person:', error);
      toast({
        title: 'Assignment failed',
        description: 'Failed to assign person. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setShowAssignmentDialog(false);
      setAssignmentType(null);
      setAssignmentEventId(null);
    }
  };

  // Self-signup functions
  const handleSelfSignup = async (eventId: number, type: 'driver' | 'speaker' | 'volunteer') => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to sign up for roles',
        variant: 'destructive',
      });
      return;
    }

    try {
      const eventRequest = eventRequests.find(req => req.id === eventId);
      if (!eventRequest) return;

      let updateData: any = {};

      if (type === 'driver') {
        // Check if user is already assigned
        const currentDrivers = eventRequest.assignedDriverIds || [];
        if (currentDrivers.includes(user.id)) {
          toast({
            title: 'Already signed up',
            description: 'You are already assigned as a driver for this event',
          });
          return;
        }

        // Check if there are available spots (only if driversNeeded is explicitly set)
        const driversNeeded = eventRequest.driversNeeded;
        if (typeof driversNeeded === 'number' && currentDrivers.length >= driversNeeded) {
          toast({
            title: 'No spots available',
            description: 'All driver spots are filled for this event',
            variant: 'destructive',
          });
          return;
        }

        // Add user to driver assignments
        const newDrivers = [...currentDrivers, user.id];
        updateData.assignedDriverIds = newDrivers;

        // Update driver details
        const currentDriverDetails = eventRequest.driverDetails || {};
        updateData.driverDetails = {
          ...currentDriverDetails,
          [user.id]: {
            name: `${user.firstName} ${user.lastName}`.trim(),
            assignedAt: new Date().toISOString(),
            assignedBy: user.id,
            selfAssigned: true,
          },
        };
      } else if (type === 'speaker') {
        // Check if user is already assigned
        const currentSpeakerDetails = eventRequest.speakerDetails || {};
        if (currentSpeakerDetails[user.id]) {
          toast({
            title: 'Already signed up',
            description: 'You are already assigned as a speaker for this event',
          });
          return;
        }

        // Check if there are available spots (only if speakersNeeded is explicitly set)
        const speakersNeeded = eventRequest.speakersNeeded;
        const currentSpeakersCount = Object.keys(currentSpeakerDetails).length;
        if (typeof speakersNeeded === 'number' && currentSpeakersCount >= speakersNeeded) {
          toast({
            title: 'No spots available',
            description: 'All speaker spots are filled for this event',
            variant: 'destructive',
          });
          return;
        }

        // Update speaker details
        updateData.speakerDetails = {
          ...currentSpeakerDetails,
          [user.id]: {
            name: `${user.firstName} ${user.lastName}`.trim(),
            assignedAt: new Date().toISOString(),
            assignedBy: user.id,
            selfAssigned: true,
          },
        };

        // Update speaker assignments array for consistency
        const currentSpeakerAssignments = eventRequest.speakerAssignments || [];
        const userName = `${user.firstName} ${user.lastName}`.trim();
        if (!currentSpeakerAssignments.includes(userName)) {
          updateData.speakerAssignments = [...currentSpeakerAssignments, userName];
        }
      } else if (type === 'volunteer') {
        // Check if volunteers are needed
        if (!eventRequest.volunteersNeeded) {
          toast({
            title: 'Volunteers not needed',
            description: 'This event does not require volunteers',
            variant: 'destructive',
          });
          return;
        }

        // Check if user is already assigned
        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        if (currentVolunteers.includes(user.id)) {
          toast({
            title: 'Already signed up',
            description: 'You are already assigned as a volunteer for this event',
          });
          return;
        }

        // Add user to volunteer assignments
        const newVolunteers = [...currentVolunteers, user.id];
        updateData.assignedVolunteerIds = newVolunteers;

        // Update volunteer details for consistency
        const currentVolunteerDetails = eventRequest.volunteerDetails || {};
        updateData.volunteerDetails = {
          ...currentVolunteerDetails,
          [user.id]: {
            name: `${user.firstName} ${user.lastName}`.trim(),
            assignedAt: new Date().toISOString(),
            assignedBy: user.id,
            selfAssigned: true,
          },
        };

        // Update volunteer assignments array for consistency
        const currentVolunteerAssignments = eventRequest.volunteerAssignments || [];
        const userName = `${user.firstName} ${user.lastName}`.trim();
        if (!currentVolunteerAssignments.includes(userName)) {
          updateData.volunteerAssignments = [...currentVolunteerAssignments, userName];
        }
      }

      // Update the event request
      await updateEventRequestMutation.mutateAsync({
        id: eventId,
        data: updateData,
      });

      toast({
        title: 'Signed up successfully!',
        description: `You have been signed up as a ${type} for this event`,
      });
    } catch (error) {
      console.error('Failed to self-signup:', error);
      toast({
        title: 'Signup failed',
        description: 'Failed to sign up. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Check if user can sign up for a specific role
  const canSelfSignup = (eventRequest: EventRequest, type: 'driver' | 'speaker' | 'volunteer'): boolean => {
    if (!user) return false;

    if (type === 'driver') {
      const currentDrivers = eventRequest.assignedDriverIds || [];
      const driversNeeded = eventRequest.driversNeeded;
      // Allow signup if user not already assigned and either no limit set or under the limit
      return !currentDrivers.includes(user.id) && (typeof driversNeeded !== 'number' || currentDrivers.length < driversNeeded);
    } else if (type === 'speaker') {
      const currentSpeakerDetails = eventRequest.speakerDetails || {};
      const speakersNeeded = eventRequest.speakersNeeded;
      const currentSpeakersCount = Object.keys(currentSpeakerDetails).length;
      // Allow signup if user not already assigned and either no limit set or under the limit
      return !currentSpeakerDetails[user.id] && (typeof speakersNeeded !== 'number' || currentSpeakersCount < speakersNeeded);
    } else if (type === 'volunteer') {
      if (!eventRequest.volunteersNeeded) return false;
      const currentVolunteers = eventRequest.assignedVolunteerIds || [];
      return !currentVolunteers.includes(user.id);
    }

    return false;
  };

  // Check if user is already signed up for a role
  const isUserSignedUp = (eventRequest: EventRequest, type: 'driver' | 'speaker' | 'volunteer'): boolean => {
    if (!user) return false;

    if (type === 'driver') {
      const currentDrivers = eventRequest.assignedDriverIds || [];
      return currentDrivers.includes(user.id);
    } else if (type === 'speaker') {
      const currentSpeakerDetails = eventRequest.speakerDetails || {};
      return !!currentSpeakerDetails[user.id];
    } else if (type === 'volunteer') {
      const currentVolunteers = eventRequest.assignedVolunteerIds || [];
      return currentVolunteers.includes(user.id);
    }

    return false;
  };

  const [completedEdit, setCompletedEdit] = useState<any>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch event requests
  const { data: eventRequests = [], isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
  });

  // Fetch users for resolving user IDs to names
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Fetch drivers, hosts, and volunteers for assignment modal
  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
  });

  const { data: hosts = [] } = useQuery<any[]>({
    queryKey: ['/api/hosts'],
  });

  const { data: volunteers = [] } = useQuery<any[]>({
    queryKey: ['/api/volunteers'],
  });

  // Fetch recipients for sandwich destination dropdown
  const { data: recipients = [] } = useQuery<any[]>({
    queryKey: ['/api/recipients'],
  });

  // Helper function to resolve user ID or email to name
  const resolveUserName = (userIdOrName: string | undefined): string => {
    if (!userIdOrName) return 'Not assigned';

    // If it looks like a user ID, try to resolve it
    if (userIdOrName.startsWith('user_') && userIdOrName.includes('_')) {
      const user = users.find((u) => u.id === userIdOrName);
      if (user) {
        return `${user.firstName} ${user.lastName}`.trim() || user.email;
      }
    }

    // If it looks like an email address, try to find the user by email
    if (userIdOrName.includes('@')) {
      const user = users.find((u) => u.email === userIdOrName);
      if (user) {
        return `${user.firstName} ${user.lastName}`.trim() || user.email;
      }
    }

    // Return as-is if it's already a name or user not found
    return userIdOrName;
  };

  // Helper function to resolve recipient ID to name
  const resolveRecipientName = (
    recipientIdOrName: string | undefined
  ): string => {
    if (!recipientIdOrName) return 'Not specified';

    // Check if it's a recipient ID (numeric string)
    if (/^\d+$/.test(recipientIdOrName)) {
      const recipient = recipients.find(
        (r) => r.id.toString() === recipientIdOrName
      );
      return recipient ? recipient.name : recipientIdOrName;
    }

    // Otherwise, it's already a name
    return recipientIdOrName;
  };

  // Mutations
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
      
      // Force a complete cache invalidation and refetch
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/event-requests'],
        refetchType: 'all'
      });
      
      // Close the dialog after successful update
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
      
      // Force a complete cache invalidation and refetch
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/event-requests'],
        refetchType: 'all'
      });
      
      // Also explicitly refetch the query to ensure fresh data
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
      
      // Update selectedEventRequest if this event is currently displayed
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
      
      // Update selectedEventRequest if this event is currently displayed
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

  // Mutation for inline editing of scheduled event fields
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
      
      // Update selectedEventRequest if this event is currently displayed
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

  // Follow-up mutations
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
      
      // Update selectedEventRequest if this event is currently displayed
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
      
      // Update selectedEventRequest if this event is currently displayed
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

  // Handle status change for event requests
  const handleStatusChange = (id: number, status: string) => {
    updateEventRequestMutation.mutate({
      id,
      data: { status }
    });
  };

  // Helper function to check if a date matches the search query
  const dateMatchesSearch = (dateValue: string | Date | null | undefined, searchQuery: string): boolean => {
    if (!dateValue || !searchQuery) return false;
    
    try {
      // Convert date to string if it's a Date object
      const dateStr = dateValue instanceof Date ? dateValue.toISOString() : dateValue.toString();
      
      // Try multiple date formats for matching
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;
      
      const searchLower = searchQuery.toLowerCase();
      
      // Format date in various ways to match user input
      const formats = [
        dateStr.toLowerCase(), // Original format
        date.toLocaleDateString(), // MM/DD/YYYY
        date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), // MM/DD/YYYY
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), // Sep 18, 2025
        date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), // September 18, 2025
        date.toISOString().split('T')[0], // YYYY-MM-DD
        `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`, // M/D/YYYY
        `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`, // MM/DD/YYYY
      ];
      
      return formats.some(format => format.toLowerCase().includes(searchLower));
    } catch (error) {
      return false;
    }
  };

  // Filter and sort event requests
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = eventRequests.filter((request: EventRequest) => {
      const matchesSearch =
        searchQuery === '' ||
        request.organizationName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        request.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (request.eventAddress && request.eventAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
        dateMatchesSearch(request.desiredEventDate, searchQuery);

      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort the filtered results
    filtered.sort((a: EventRequest, b: EventRequest) => {
      switch (sortBy) {
        case 'newest':
          // Sort by desired event date (newest events first)
          const newestDateA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
          const newestDateB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
          return newestDateB - newestDateA;
        case 'oldest':
          // Sort by desired event date (oldest events first)
          const oldestDateA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
          const oldestDateB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
          return oldestDateA - oldestDateB;
        case 'organization':
          return a.organizationName.localeCompare(b.organizationName);
        case 'event_date':
          // Sort by desired event date for scheduled events
          const dateA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
          const dateB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
          return dateA - dateB; // Earliest dates first
        default:
          return 0;
      }
    });

    return filtered;
  }, [eventRequests, searchQuery, statusFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredAndSortedRequests.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy]);

  // Auto-sort by event date when scheduled tab is selected
  useEffect(() => {
    if (activeTab === 'scheduled' && sortBy !== 'event_date') {
      setSortBy('event_date');
    }
  }, [activeTab, sortBy]);

  // Group requests by status for tab display
  const requestsByStatus = useMemo(() => {
    const groups = eventRequests.reduce((acc: any, request: EventRequest) => {
      if (!acc[request.status]) {
        acc[request.status] = [];
      }
      acc[request.status].push(request);
      return acc;
    }, {});

    // Sort each group by newest first
    Object.keys(groups).forEach((status) => {
      groups[status].sort(
        (a: EventRequest, b: EventRequest) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return groups;
  }, [eventRequests]);

  const handleEventClick = (eventRequest: EventRequest) => {
    setSelectedEventRequest(eventRequest);
    setShowEventDetails(true);
    setIsEditing(false);
    
    // Initialize modal sandwich state based on existing event data
    initializeModalSandwichState(eventRequest);
  };

  const handleToolkitSent = (toolkitSentDate: string) => {
    if (!toolkitEventRequest) return;
    markToolkitSentMutation.mutate({
      id: toolkitEventRequest.id,
      toolkitSentDate,
    });
  };

  const handleScheduleCall = () => {
    if (!selectedEventRequest || !scheduleCallDate || !scheduleCallTime) return;

    const combinedDateTime = new Date(
      `${scheduleCallDate}T${scheduleCallTime}`
    ).toISOString();

    scheduleCallMutation.mutate({
      id: selectedEventRequest.id,
      scheduledCallDate: combinedDateTime,
    });
  };

  const handleViewCollectionLog = (eventRequest: EventRequest) => {
    setCollectionLogEventRequest(eventRequest);
    setShowCollectionLog(true);
  };

  const openToolkitSentDialog = (eventRequest: EventRequest) => {
    setToolkitEventRequest(eventRequest);
    setShowToolkitSentDialog(true);
  };

  if (isLoading) {
    return <div>Loading event requests...</div>;
  }

  const statusCounts = {
    new: requestsByStatus.new?.length || 0,
    in_process: requestsByStatus.in_process?.length || 0,
    scheduled: requestsByStatus.scheduled?.length || 0,
    completed: requestsByStatus.completed?.length || 0,
    declined: requestsByStatus.declined?.length || 0,
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Event Requests Management</h1>
            <p className="text-[#236383]">
              Manage and track event requests from organizations
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => {
                // Close any open dialogs first
                setShowScheduleCallDialog(false);
                setShowOneDayFollowUpDialog(false);
                setShowOneMonthFollowUpDialog(false);
                setShowToolkitSentDialog(false);
                setShowAssignmentDialog(false);
                
                // Set up for manual event request creation
                setSelectedEventRequest(null);
                setIsEditing(true);
                setShowEventDetails(true);
                
                // Initialize modal sandwich state for new event
                initializeModalSandwichState(null);
              }}
              className="text-white"
              style={{ backgroundColor: '#007E8C' }}
              data-testid="button-add-manual-event"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Manual Event Request
            </Button>
            <Button
              onClick={() => setShowSandwichPlanningModal(true)}
              variant="outline"
              className="flex items-center space-x-2"
              data-testid="button-sandwich-planning"
            >
              <span className="text-lg mr-1">🥪</span>
              <span>Sandwich Planning</span>
            </Button>
            <Button
              onClick={() => setShowStaffingPlanningModal(true)}
              variant="outline"
              className="flex items-center space-x-2"
              data-testid="button-staffing-planning"
            >
              <Users className="w-4 h-4" />
              <span>Staffing Planning</span>
            </Button>
            <Badge
              variant="secondary"
              className="bg-brand-primary text-white px-3 py-1 text-sm"
            >
              {eventRequests.length} Total Requests
            </Badge>
          </div>
        </div>

        {/* Request Filters with Tabs */}
        <RequestFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          currentPage={currentPage}
          onCurrentPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          statusCounts={statusCounts}
          totalItems={filteredAndSortedRequests.length}
          totalPages={totalPages}
          children={{
            new: <div className="space-y-4">{renderEventsForStatus('new')}</div>,
            in_process: <div className="space-y-4">{renderEventsForStatus('in_process')}</div>,
            scheduled: <div className="space-y-4">{renderEventsForStatus('scheduled')}</div>,
            completed: <div className="space-y-4">{renderEventsForStatus('completed')}</div>,
            declined: <div className="space-y-4">{renderEventsForStatus('declined')}</div>,
          }}
        />

        {/* Event Details Modal */}

                                {/* Toolkit Status - Only for In Process */}
                                {request.status === 'in_process' && (
                                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                                      <Shield className="w-4 h-4 mr-2 text-green-600" />
                                      Toolkit Status
                                    </h4>
                                    <div className="flex items-center space-x-4">
                                      {request.toolkitSent ? (
                                        <div className="flex items-center space-x-2">
                                          <CheckCircle className="w-5 h-5 text-green-600" />
                                          <span className="text-green-800 font-medium">
                                            Toolkit Sent
                                          </span>
                                          {request.toolkitSentDate && (
                                            <span className="text-sm text-green-600">
                                              on{' '}
                                              {new Date(
                                                request.toolkitSentDate
                                              ).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center space-x-2">
                                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                                          <span className="text-orange-800 font-medium">
                                            Toolkit Not Sent
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Comprehensive Event Details for Scheduled Events - Compact Grid */}
                                {request.status === 'scheduled' && (
                                  <div className="mt-3 bg-white border rounded-lg p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                      
                                      {/* Column 1: Schedule & Location */}
                                      <div className="space-y-2 bg-[#e6f2f5] p-3 rounded-lg border border-[#007E8C]/20">
                                        <h4 className="text-base font-semibold tracking-tight flex items-center border-b pb-2">
                                          <Calendar className="w-4 h-4 mr-2" />
                                          Schedule & Location
                                        </h4>
                                        
                                        {/* Times in compact rows */}
                                        <div className="space-y-1">
                                          {/* Start and End times with proper layout */}
                                          <div className="space-y-2">
                                            {/* Start time */}
                                            <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                                              <span className="text-base font-medium text-[#236383] min-w-16">Start:</span>
                                              {editingScheduledId === request.id && editingField === 'eventStartTime' ? (
                                                <div className="flex items-center gap-2">
                                                  <Input
                                                    type="time"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    className="w-28"
                                                  />
                                                  <Button size="icon" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-7 w-7">
                                                    <CheckCircle className="w-4 h-4" />
                                                  </Button>
                                                  <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-7 w-7">
                                                    <X className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1">
                                                  <span className="text-base font-medium">
                                                    {request.eventStartTime ? formatTime12Hour(request.eventStartTime) : 'Not set'}
                                                  </span>
                                                  {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button variant="ghost" size="icon" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'eventStartTime', request.eventStartTime || '');
                                                    }} className="h-6 w-6 ml-1">
                                                      <Edit className="w-4 h-4" />
                                                    </Button>
                                                  )}
                                                </div>
                                              )}
                                            </div>

                                            {/* End time */}
                                            <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                                              <span className="text-base font-medium text-[#236383] min-w-16">End:</span>
                                              {editingScheduledId === request.id && editingField === 'eventEndTime' ? (
                                                <div className="flex items-center gap-2">
                                                  <Input
                                                    type="time"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    className="w-28"
                                                  />
                                                  <Button size="icon" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-7 w-7">
                                                    <CheckCircle className="w-4 h-4" />
                                                  </Button>
                                                  <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-7 w-7">
                                                    <X className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1">
                                                  <span className="text-base font-medium">
                                                    {request.eventEndTime ? formatTime12Hour(request.eventEndTime) : 'Not set'}
                                                  </span>
                                                  {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button variant="ghost" size="icon" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'eventEndTime', request.eventEndTime || '');
                                                    }} className="h-6 w-6 ml-1">
                                                      <Edit className="w-4 h-4" />
                                                    </Button>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Pickup time with proper alignment */}
                                          <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                                            <span className="text-base font-medium text-[#236383] min-w-16">Pickup:</span>
                                            {editingScheduledId === request.id && editingField === 'pickupTime' ? (
                                              <div className="flex items-center gap-2">
                                                <Input
                                                  type="time"
                                                  value={editingValue}
                                                  onChange={(e) => setEditingValue(e.target.value)}
                                                  className="w-28"
                                                />
                                                <Button size="icon" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-7 w-7">
                                                  <CheckCircle className="w-4 h-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-7 w-7">
                                                  <X className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1">
                                                <span className="text-base font-medium">
                                                  {request.pickupTime ? formatTime12Hour(request.pickupTime) : 'Not set'}
                                                </span>
                                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                  <Button variant="ghost" size="icon" onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEditing(request.id, 'pickupTime', request.pickupTime || '');
                                                  }} className="h-6 w-6 ml-1">
                                                    <Edit className="w-4 h-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Address */}
                                        <div className="pt-2 border-t">
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-1 sm:space-y-0">
                                            <span className="text-base font-medium text-[#236383] flex-shrink-0">Address:</span>
                                            <div className="flex items-start space-x-1 sm:flex-1 sm:justify-end">
                                              {editingScheduledId === request.id && editingField === 'eventAddress' ? (
                                                <div className="flex items-center space-x-2 w-full">
                                                  <Input
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    className="text-sm"
                                                    placeholder="Enter address"
                                                  />
                                                  <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                                    <CheckCircle className="w-4 h-4" />
                                                  </Button>
                                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                                    <X className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <>
                                                  <span className="font-semibold text-base sm:text-right sm:max-w-[200px] break-words">
                                                    {request.eventAddress ? (
                                                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.eventAddress)}`}
                                                         target="_blank" rel="noopener noreferrer"
                                                         className="text-[#007E8C] hover:text-[#236383] underline">
                                                        {request.eventAddress}
                                                      </a>
                                                    ) : <span className="text-[#007E8C]">Not specified</span>}
                                                  </span>
                                                  {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button size="sm" variant="ghost" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'eventAddress', request.eventAddress || '');
                                                    }} className="h-5 w-5 p-0 flex-shrink-0">
                                                      <Edit className="w-3 h-3" />
                                                    </Button>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Column 2: Sandwich & Logistics */}
                                      <div className="space-y-2 bg-[#e6f2f5] p-3 rounded-lg border border-[#007E8C]/20">
                                        <h4 className="text-base font-semibold tracking-tight flex items-center border-b pb-2">
                                          <Package className="w-4 h-4 mr-2" />
                                          Sandwich Details
                                        </h4>
                                        
                                        <div className="space-y-2">
                                          {/* Total Sandwiches Count */}
                                          <div className="flex justify-between items-center">
                                            <span className="text-base font-medium text-[#236383]">Total:</span>
                                            {editingScheduledId === request.id && editingField === 'estimatedSandwichCount' ? (
                                              <div className="flex items-center space-x-2">
                                                <Input
                                                  type="number"
                                                  value={editingValue}
                                                  onChange={(e) => setEditingValue(e.target.value)}
                                                  className="w-24 h-7 text-sm"
                                                  min="0"
                                                />
                                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                                  <CheckCircle className="w-4 h-4" />
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                                  <X className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center space-x-1">
                                                <span className="font-semibold text-base">
                                                  {request.estimatedSandwichCount || 0} sandwiches
                                                </span>
                                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                  <Button size="sm" variant="ghost" onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEditing(request.id, 'estimatedSandwichCount', request.estimatedSandwichCount?.toString() || '0');
                                                  }} className="h-4 w-4 p-0">
                                                    <Edit className="w-3 h-3" />
                                                  </Button>
                                                )}
                                              </div>
                                            )}
                                          </div>

                                          {/* Sandwich Types */}
                                          <div className="flex flex-col space-y-2">
                                            <div className="flex justify-between items-center">
                                              <span className="text-[#FBAD3F] text-base font-semibold">Types:</span>
                                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                <Button size="sm" variant="ghost" onClick={(e) => {
                                                  e.stopPropagation();
                                                  startEditing(request.id, 'sandwichTypes', JSON.stringify(request.sandwichTypes) || '');
                                                }} className="h-4 w-4 p-0">
                                                  <Edit className="w-3 h-3" />
                                                </Button>
                                              )}
                                            </div>
                                            
                                            {editingScheduledId === request.id && editingField === 'sandwichTypes' ? (
                                              <div className="flex items-center space-x-2">
                                                <Input
                                                  type="number"
                                                  value={inlineTotalCount}
                                                  onChange={(e) => setInlineTotalCount(parseInt(e.target.value) || 0)}
                                                  className="w-20 h-8 text-sm"
                                                  min="0"
                                                  placeholder="Total"
                                                />
                                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-8 px-2">
                                                  <CheckCircle className="w-4 h-4" />
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-8 px-2">
                                                  <X className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="text-right">
                                                <span className="font-bold text-[#1A2332] text-base">
                                                  {request.sandwichTypes ? getSandwichTypesSummary(request).breakdown : 'Not specified'}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                          
                                          <div className="flex justify-between items-center">
                                            <span className="text-[#47B3CB] text-base font-semibold">Refrigeration:</span>
                                            {editingScheduledId === request.id && editingField === 'hasRefrigeration' ? (
                                              <div className="flex items-center space-x-2">
                                                <Select value={editingValue} onValueChange={setEditingValue}>
                                                  <SelectTrigger className="w-32">
                                                    <SelectValue placeholder="Select..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="true">Yes</SelectItem>
                                                    <SelectItem value="false">No</SelectItem>
                                                    <SelectItem value="unknown">Unknown</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                                  <CheckCircle className="w-4 h-4" />
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                                  <X className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            ) : (
                                            <div className="flex items-center space-x-1">
                                              <span className="font-bold text-[#1A2332] text-base">
                                                {request.hasRefrigeration === true ? 'Yes' : request.hasRefrigeration === false ? 'No' : 'Unknown'}
                                              </span>
                                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                <Button size="sm" variant="ghost" onClick={(e) => {
                                                  e.stopPropagation();
                                                  startEditing(request.id, 'hasRefrigeration', request.hasRefrigeration?.toString() || '');
                                                }} className="h-4 w-4 p-0">
                                                  <Edit className="w-3 h-3" />
                                                </Button>
                                              )}
                                            </div>
                                            )}
                                          </div>
                                          
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-1 sm:space-y-0 pt-2 border-t border-[#e6f2f5]">
                                            <span className="text-[#FBAD3F] text-base font-semibold flex-shrink-0">Destination:</span>
                                            <div className="flex items-start space-x-1 sm:flex-1 sm:justify-end">
                                              {editingScheduledId === request.id && editingField === 'sandwichDestination' ? (
                                                <div className="flex items-center space-x-1">
                                                  <Input
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    className="h-6 text-sm w-32"
                                                    placeholder="Destination"
                                                  />
                                                  <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-6 w-6 p-0">
                                                    <CheckCircle className="w-3 h-3" />
                                                  </Button>
                                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-6 w-6 p-0">
                                                    <X className="w-3 h-3" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <>
                                                  <span className="font-medium text-base sm:text-right sm:max-w-[150px] break-words">
                                                    {resolveRecipientName(request.sandwichDestination) || 'Not specified'}
                                                  </span>
                                                  {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button size="sm" variant="ghost" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'sandwichDestination', request.sandwichDestination || '');
                                                    }} className="h-5 w-5 p-0 flex-shrink-0">
                                                      <Edit className="w-3 h-3" />
                                                    </Button>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Column 3: Staffing */}
                                      <div className="space-y-2 bg-[#e6f2f5] p-3 rounded-lg border border-[#007E8C]/20">
                                        <h4 className="text-sm font-semibold flex items-center border-b border-[#007E8C]/20 pb-2" style={{color: '#1A2332'}}>
                                          <Users className="w-5 h-5 mr-2 text-brand-primary" />
                                          Staffing
                                        </h4>
                                        
                                        <div className="space-y-2">
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                                            <span className="text-[#007E8C] text-base font-semibold flex-shrink-0">TSP Contact:</span>
                                            <div className="flex items-center space-x-1">
                                              {editingScheduledId === request.id && editingField === 'tspContact' ? (
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                                                  <TaskAssigneeSelector
                                                    value={{ assigneeName: editingValue }}
                                                    onChange={(value) => setEditingValue(value.assigneeName || '')}
                                                    placeholder="Select contact"
                                                  />
                                                  <div className="flex space-x-2">
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                                      <CheckCircle className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                                      <X className="w-4 h-4" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <>
                                                  <span className="font-semibold text-[#1A2332] text-base break-words">
                                                    {resolveUserName(request.tspContact) || 'Not assigned'}
                                                  </span>
                                                  {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button size="sm" variant="ghost" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'tspContact', resolveUserName(request.tspContact));
                                                    }} className="h-5 w-5 p-0 flex-shrink-0">
                                                      <Edit className="w-3 h-3" />
                                                    </Button>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Drivers Section */}
                                          <div className="space-y-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Truck className="w-4 h-4" />
                                                <span className="text-base font-medium text-teal-700">Drivers</span>
                                                {editingScheduledId === request.id && editingField === 'driversNeeded' ? (
                                                  <div className="flex items-center space-x-2">
                                                    <Input
                                                      type="number"
                                                      value={editingValue}
                                                      onChange={(e) => setEditingValue(e.target.value)}
                                                      className="w-16 h-6 text-sm"
                                                      min="0"
                                                    />
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-6 px-2">
                                                      <CheckCircle className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-6 px-2">
                                                      <X className="w-3 h-3" />
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button size="sm" variant="ghost" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'driversNeeded', request.driversNeeded?.toString() || '0');
                                                    }} className="h-6 w-6 p-0">
                                                      <Edit className="w-3 h-3" />
                                                    </Button>
                                                  )
                                                )}
                                              </div>
                                              
                                              <div className="text-right">
                                                {(() => {
                                                  const assignedCount = (request.assignedDriverIds || []).length;
                                                  const neededCount = request.driversNeeded || 0;
                                                  return (
                                                    <div className="font-semibold text-base">
                                                      <span className={assignedCount >= neededCount ? "text-green-600" : "text-foreground"}>
                                                        {assignedCount}
                                                      </span>
                                                      <span className="text-[#236383] mx-1">of</span>
                                                      <span>{neededCount}</span>
                                                      <span className="text-[#236383] text-base ml-1">assigned</span>
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 justify-end">
                                              {/* Self-signup button */}
                                              {canSelfSignup(request, 'driver') && (
                                                <Button 
                                                  size="sm" 
                                                  className="text-xs px-3 py-1"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelfSignup(request.id, 'driver');
                                                  }}
                                                  data-testid={`button-self-signup-driver-${request.id}`}
                                                >
                                                  <UserCheck className="w-3 h-3 mr-1" />
                                                  Sign Me Up
                                                </Button>
                                              )}
                                              
                                              {/* Already signed up indicator */}
                                              {isUserSignedUp(request, 'driver') && (
                                                <Badge className="bg-green-100 text-green-800 text-xs">
                                                  <CheckCircle className="w-3 h-3 mr-1" />
                                                  You're signed up
                                                </Badge>
                                              )}
                                              
                                              {/* Admin assign button */}
                                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                <Button 
                                                  size="sm" 
                                                  variant="outline" 
                                                  className="text-[#007E8C] border-[#007E8C] hover:bg-[#007E8C] hover:text-white text-xs px-3 py-1" 
                                                  onClick={(e) => {
                                                e.stopPropagation();
                                                openAssignmentDialog(request.id, 'driver');
                                                  }}
                                                  data-testid={`button-assign-driver-${request.id}`}
                                                >
                                                  <Users className="w-3 h-3 mr-1" />
                                                Assign
                                              </Button>
                                              )}
                                            </div>
                                            
                                            {/* Show assigned drivers under this section */}
                                            {(() => {
                                              const assignedDrivers = request.assignedDriverIds || [];
                                              if (assignedDrivers.length === 0) return null;
                                              
                                              return (
                                                <div className="mt-2 space-y-1">
                                                  <div className="text-base font-medium text-teal-700 mb-1">Assigned Drivers:</div>
                                                  {assignedDrivers.map((driverId, i) => {
                                                    const driverDetails = request.driverDetails?.[driverId];
                                                    const driverName = driverDetails?.name || resolveUserName(driverId);
                                                    return (
                                                      <div key={`driver-${i}`} className="flex items-center justify-between bg-teal-100 text-teal-800 px-2 py-1 rounded text-base font-medium">
                                                        <span>🚗 {driverName}</span>
                                                        {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleRemoveAssignment(driverId, 'driver', request.id);
                                                            }}
                                                            className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                                          >
                                                            <X className="w-3 h-3" />
                                                          </Button>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                          
                                          {/* Van Driver */}
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                                            <span className="text-[#007E8C] text-base font-semibold">Van Driver:</span>
                                            <div className="flex items-center space-x-1">
                                              {editingScheduledId === request.id && editingField === 'vanDriverNeeded' ? (
                                            <div className="flex items-center space-x-2">
                                                  <Select value={editingValue} onValueChange={setEditingValue}>
                                                    <SelectTrigger className="w-24">
                                                      <SelectValue placeholder="Select..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="true">Yes</SelectItem>
                                                      <SelectItem value="false">No</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                  <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                                    <CheckCircle className="w-4 h-4" />
                                                  </Button>
                                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                                    <X className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <div className="flex items-center space-x-2">
                                                  <span className="font-bold text-[#1A2332] text-base">
                                                    {request.vanDriverNeeded ? 'Yes' : 'No'}
                                                  </span>
                                                  {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button size="sm" variant="ghost" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'vanDriverNeeded', request.vanDriverNeeded?.toString() || 'false');
                                                    }} className="h-4 w-4 p-0">
                                                      <Edit className="w-3 h-3" />
                                                    </Button>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Speakers Section */}
                                          <div className="space-y-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center space-x-2">
                                                <Megaphone className="w-4 h-4" />
                                                <span className="text-base font-medium text-orange-700">Speakers</span>
                                                {editingScheduledId === request.id && editingField === 'speakersNeeded' ? (
                                                  <div className="flex items-center space-x-2">
                                                    <Input
                                                      type="number"
                                                      value={editingValue}
                                                      onChange={(e) => setEditingValue(e.target.value)}
                                                      className="w-16 h-6 text-sm"
                                                      min="0"
                                                    />
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-6 px-2">
                                                      <CheckCircle className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-6 px-2">
                                                      <X className="w-3 h-3" />
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button size="sm" variant="ghost" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'speakersNeeded', request.speakersNeeded?.toString() || '0');
                                                    }} className="h-6 w-6 p-0">
                                                      <Edit className="w-3 h-3" />
                                                    </Button>
                                                  )
                                                )}
                                              </div>
                                              
                                              <div className="text-right">
                                                {(() => {
                                                  const assignedCount = Object.keys(request.speakerDetails || {}).length;
                                                  const neededCount = request.speakersNeeded || 0;
                                                  return (
                                                    <div className="text-[#1A2332] font-bold text-lg">
                                                      <span className={assignedCount >= neededCount ? "text-green-600" : "text-[#FBAD3F]"}>
                                                        {assignedCount}
                                                      </span>
                                                      <span className="text-[#007E8C] mx-1">of</span>
                                                      <span className="text-[#1A2332]">{neededCount}</span>
                                                      <span className="text-[#236383] text-sm ml-1">assigned</span>
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 justify-end">
                                              {/* Self-signup button */}
                                              {canSelfSignup(request, 'speaker') && (
                                                <Button 
                                                  size="sm" 
                                                  className="bg-[#FBAD3F] hover:bg-orange-600 text-white text-xs px-3 py-1"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelfSignup(request.id, 'speaker');
                                                  }}
                                                  data-testid={`button-self-signup-speaker-${request.id}`}
                                                >
                                                  <UserCheck className="w-3 h-3 mr-1" />
                                                  Sign Me Up
                                                </Button>
                                              )}
                                              
                                              {/* Already signed up indicator */}
                                              {isUserSignedUp(request, 'speaker') && (
                                                <Badge className="bg-green-100 text-green-800 text-xs">
                                                  <CheckCircle className="w-3 h-3 mr-1" />
                                                  You're signed up
                                                </Badge>
                                              )}
                                              
                                              {/* Admin assign button */}
                                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                <Button 
                                                  size="sm" 
                                                  variant="outline" 
                                                  className="text-[#FBAD3F] border-[#FBAD3F] hover:bg-[#FBAD3F] hover:text-white text-xs px-3 py-1" 
                                                  onClick={(e) => {
                                                e.stopPropagation();
                                                openAssignmentDialog(request.id, 'speaker');
                                                  }}
                                                  data-testid={`button-assign-speaker-${request.id}`}
                                                >
                                                  <Users className="w-3 h-3 mr-1" />
                                                Assign
                                              </Button>
                                              )}
                                            </div>
                                            
                                            {/* Show assigned speakers under this section */}
                                            {(() => {
                                              const assignedSpeakers = Object.keys(request.speakerDetails || {});
                                              if (assignedSpeakers.length === 0) return null;
                                              
                                              return (
                                                <div className="mt-2 space-y-1">
                                                  <div className="text-xs font-medium text-orange-700 mb-1">Assigned Speakers:</div>
                                                  {assignedSpeakers.map((speakerId, i) => {
                                                    const speakerDetails = request.speakerDetails?.[speakerId];
                                                    const speakerName = speakerDetails?.name || resolveUserName(speakerId);
                                                    return (
                                                      <div key={`speaker-${i}`} className="flex items-center justify-between bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-medium">
                                                        <span>🎤 {speakerName}</span>
                                                        {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleRemoveAssignment(speakerId, 'speaker', request.id);
                                                            }}
                                                            className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                                          >
                                                            <X className="w-3 h-3" />
                                                          </Button>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                          
                                          {/* Volunteers Section */}
                                          <div className="space-y-2 p-3 bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg">
                                            <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Users className="w-4 h-4" />
                                                <span className="text-base font-medium text-blue-700">Volunteers</span>
                                                {editingScheduledId === request.id && editingField === 'volunteersNeeded' ? (
                                                  <div className="flex items-center space-x-2">
                                                    <Select value={editingValue} onValueChange={setEditingValue}>
                                                      <SelectTrigger className="w-20 h-6 text-sm">
                                                        <SelectValue placeholder="Select..." />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="true">Yes</SelectItem>
                                                        <SelectItem value="false">No</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="h-6 px-2">
                                                      <CheckCircle className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="h-6 px-2">
                                                      <X className="w-3 h-3" />
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                    <Button size="sm" variant="ghost" onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditing(request.id, 'volunteersNeeded', request.volunteersNeeded?.toString() || 'false');
                                                    }} className="h-6 w-6 p-0">
                                                      <Edit className="w-3 h-3" />
                                                    </Button>
                                                  )
                                                )}
                                              </div>
                                              
                                              <div className="text-right">
                                                {request.volunteersNeeded ? (
                                                  (() => {
                                                    const assignedCount = (request.assignedVolunteerIds || []).length;
                                                    return (
                                                      <div className="text-[#1A2332] font-bold text-base">
                                                        <span className="text-[#007E8C]">{assignedCount}</span>
                                                        <span className="text-[#236383] text-base ml-1">volunteers assigned</span>
                                                      </div>
                                                    );
                                                  })()
                                                ) : (
                                                  <div className="text-[#007E8C] font-medium text-base">
                                                    Not needed
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            
                                            {request.volunteersNeeded && (
                                              <div className="flex flex-wrap gap-2 justify-end">
                                                {/* Self-signup button */}
                                                {canSelfSignup(request, 'volunteer') && (
                                                  <Button 
                                                    size="sm" 
                                                    className="bg-[#e6f2f5]0 hover:bg-blue-600 text-white text-xs px-3 py-1"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleSelfSignup(request.id, 'volunteer');
                                                    }}
                                                    data-testid={`button-self-signup-volunteer-${request.id}`}
                                                  >
                                                    <UserCheck className="w-3 h-3 mr-1" />
                                                    Sign Me Up
                                                  </Button>
                                                )}
                                                
                                                {/* Already signed up indicator */}
                                                {isUserSignedUp(request, 'volunteer') && (
                                                  <Badge className="bg-green-100 text-green-800 text-xs">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    You're signed up
                                                  </Badge>
                                                )}
                                                
                                                {/* Admin assign button */}
                                                {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                  <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="text-[#007E8C] border-blue-600 hover:bg-blue-600 hover:text-white text-xs px-3 py-1" 
                                                    onClick={(e) => {
                                                e.stopPropagation();
                                                openAssignmentDialog(request.id, 'volunteer');
                                                    }}
                                                    data-testid={`button-assign-volunteer-${request.id}`}
                                                  >
                                                    <Users className="w-3 h-3 mr-1" />
                                                Assign
                                              </Button>
                                                )}
                                            </div>
                                            )}
                                            
                                            {/* Show assigned volunteers under this section */}
                                            {(() => {
                                              const assignedVolunteers = request.assignedVolunteerIds || [];
                                              if (assignedVolunteers.length === 0) return null;
                                              
                                              return (
                                                <div className="mt-2 space-y-1">
                                                  <div className="text-xs font-medium text-blue-700 mb-1">Assigned Volunteers:</div>
                                                  {assignedVolunteers.map((volunteerId, i) => {
                                                    const volunteerDetails = request.volunteerDetails?.[volunteerId];
                                                    const volunteerName = volunteerDetails?.name || resolveUserName(volunteerId);
                                                    return (
                                                      <div key={`volunteer-${i}`} className="flex items-center justify-between bg-blue-100 text-[#236383] px-2 py-1 rounded text-sm font-medium">
                                                        <span>👥 {volunteerName}</span>
                                                        {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleRemoveAssignment(volunteerId, 'volunteer', request.id);
                                                            }}
                                                            className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                                          >
                                                            <X className="w-3 h-3" />
                                                          </Button>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Additional Requirements & Notes - Full Width */}
                                    {(request.additionalRequirements || request.planningNotes) && (
                                      <div className="mt-6 pt-4 border-t border-[#007E8C]/20 space-y-3">
                                        {request.additionalRequirements && (
                                          <div>
                                            <div className="text-base font-semibold text-[#1A2332] mb-1 flex items-center">
                                              <AlertTriangle className="w-4 h-4 mr-1 text-brand-orange" />
                                              Additional Requirements
                                            </div>
                                            <p className="text-sm text-[#1A2332] bg-brand-orange/10 p-2 rounded border-l-4 border-brand-orange/30">
                                              {request.additionalRequirements}
                                            </p>
                                          </div>
                                        )}
                                        
                                        <div>
                                          <div className="text-base font-semibold text-[#1A2332] mb-1 flex items-center justify-between">
                                            <span className="flex items-center">
                                              <FileText className="w-4 h-4 mr-1 text-brand-primary" />
                                              Planning Notes
                                            </span>
                                            {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                              <Button size="sm" variant="ghost" onClick={(e) => {
                                                e.stopPropagation();
                                                startEditing(request.id, 'planningNotes', request.planningNotes || '');
                                              }} className="h-6 w-6 p-0">
                                                <Edit className="w-3 h-3" />
                                              </Button>
                                            )}
                                          </div>
                                          <p className="text-sm text-[#1A2332] bg-brand-primary/5 p-2 rounded border-l-4 border-brand-primary/20">
                                            {request.planningNotes || 'No planning notes'}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {request.message && (
                                  <div className="mt-4 p-3 bg-[#e6f2f5] border-l-4 border-brand-primary rounded-r-lg">
                                    <p className="text-base text-brand-primary line-clamp-2 font-medium">
                                      {request.message}
                                    </p>
                                  </div>
                                )}

                                {/* Action Buttons for New Status */}
                                {request.status === 'new' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setToolkitEventRequest(request);
                                        setShowToolkitSentDialog(true);
                                      }}
                                      className="text-white"
                                      style={{ backgroundColor: '#007E8C' }}
                                      data-testid={`button-send-toolkit-${request.id}`}
                                    >
                                      <Shield className="w-4 h-4 mr-2" />
                                      Send Toolkit
                                    </Button>
                                    
                                    {request.phone && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const phoneNumber = request.phone;
                                          
                                          // Check if on mobile device
                                          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                                          
                                          if (isMobile) {
                                            // On mobile, open the dialer
                                            window.location.href = `tel:${phoneNumber}`;
                                          } else {
                                            // On desktop, copy to clipboard
                                            navigator.clipboard.writeText(phoneNumber).then(() => {
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
                                        }}
                                        data-testid={`button-call-${request.id}`}
                                        title={request.phone}
                                      >
                                        <Phone className="w-4 h-4 mr-2" />
                                        Call Contact
                                      </Button>
                                    )}
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setIsEditing(true);
                                        setShowEventDetails(true);
                                      }}
                                      data-testid={`button-edit-${request.id}`}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </Button>
                                  </div>
                                )}

                                {/* Action Buttons for In Process Status */}
                                {request.status === 'in_process' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSchedulingEventRequest(request);
                                        setShowSchedulingDialog(true);
                                      }}
                                      className="text-white"
                                      style={{ backgroundColor: '#47B3CB' }}
                                      data-testid={`button-mark-scheduled-${request.id}`}
                                    >
                                      <Calendar className="w-4 h-4 mr-2" />
                                      Mark Scheduled
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setShowScheduleCallDialog(true);
                                      }}
                                      data-testid={`button-schedule-call-${request.id}`}
                                    >
                                      <Phone className="w-4 h-4 mr-2" />
                                      Schedule Call
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setIsEditing(true);
                                        setShowEventDetails(true);
                                      }}
                                      data-testid={`button-edit-${request.id}`}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </Button>
                                  </div>
                                )}

                                {/* Action Buttons for Scheduled Status */}
                                {request.status === 'scheduled' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setIsEditing(true);
                                        setShowEventDetails(true);
                                      }}
                                      data-testid={`button-edit-${request.id}`}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit Event Details
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Create contact options - call or email
                                        const phone = request.phone;
                                        const email = request.email;
                                        const contactName = `${request.firstName} ${request.lastName}`;
                                        
                                        let message = `Contact ${contactName}:\n\n`;
                                        if (phone) message += `📞 Call: ${phone}\n`;
                                        if (email) message += `📧 Email: ${email}\n`;
                                        
                                        alert(message);
                                      }}
                                      className="text-white"
                                      style={{ backgroundColor: '#236383' }}
                                      data-testid={`button-contact-${request.id}`}
                                    >
                                      <Phone className="w-4 h-4 mr-2" />
                                      Contact Organizer
                                    </Button>
                                  </div>
                                )}

                                {/* Driver Information for Completed Events */}
                                {request.status === 'completed' && request.assignedDriverIds && request.assignedDriverIds.length > 0 && (
                                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                                      <span className="mr-2">🚗</span>
                                      Drivers Who Served
                                    </h4>
                                    <div className="space-y-1">
                                      {request.assignedDriverIds.map((driverId, index) => {
                                        const driverDetails = request.driverDetails?.[driverId];
                                        const driverName = driverDetails?.name || `Driver ${index + 1}`;
                                        return (
                                          <div key={driverId} className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                            <span className="text-sm font-medium text-green-800">{driverName}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Action Buttons for Completed Status */}
                                {request.status === 'completed' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setIsEditing(true);
                                        setShowEventDetails(true);
                                      }}
                                      data-testid={`button-edit-${request.id}`}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setShowOneDayFollowUpDialog(true);
                                      }}
                                      className="text-white"
                                      style={{ backgroundColor: '#FBAD3F' }}
                                      data-testid={`button-followup-1day-${request.id}`}
                                    >
                                      <Clock className="w-4 h-4 mr-2" />
                                      1 Day Follow-up
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setShowOneMonthFollowUpDialog(true);
                                      }}
                                      className="text-white"
                                      style={{ backgroundColor: '#1A2332' }}
                                      data-testid={`button-followup-1month-${request.id}`}
                                    >
                                      <Calendar className="w-4 h-4 mr-2" />
                                      1 Month Follow-up
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Are you sure you want to delete this event request? This action cannot be undone.')) {
                                          deleteEventRequestMutation.mutate(request.id);
                                        }
                                      }}
                                      data-testid={`button-delete-${request.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </Button>
                                  </div>
                                )}

                                {/* Action Buttons for Declined Status */}
                                {request.status === 'declined' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#007E8C]/20">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        setIsEditing(true);
                                        setShowEventDetails(true);
                                      }}
                                      data-testid={`button-edit-${request.id}`}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
                                        handleStatusChange(request.id, 'new');
                                      }}
                                      className="text-white"
                                      style={{ backgroundColor: '#47B3CB' }}
                                      data-testid={`button-reschedule-${request.id}`}
                                    >
                                      <RotateCcw className="w-4 h-4 mr-2" />
                                      Reschedule
                                    </Button>
                                  </div>
                                )}

        {/* Event Details Modal */}
        {showEventDetails && (
          <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  {selectedEventRequest ? (
                    <>
                      <div
                        className={`w-3 h-3 rounded-full ${
                          statusColors[selectedEventRequest.status]
                        }`}
                      />
                      <span>{selectedEventRequest.organizationName}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-green-600" />
                      <span>Add New Event Request</span>
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {!isEditing && selectedEventRequest ? (
                  <>
                    {/* Read-only view - comprehensive event details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-medium text-[#1A2332]">Contact Information</h3>
                          <div className="mt-2 space-y-2">
                            <p><span className="font-medium">Name:</span> {selectedEventRequest.firstName} {selectedEventRequest.lastName}</p>
                            <p><span className="font-medium">Email:</span> {selectedEventRequest.email}</p>
                            <p><span className="font-medium">Phone:</span> {selectedEventRequest.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-base font-medium text-[#1A2332]">Event Details</h3>
                          <div className="mt-2 space-y-2">
                            <p><span className="font-medium">Organization:</span> {selectedEventRequest.organizationName}</p>
                            <p><span className="font-medium">Desired Date:</span> {
                              selectedEventRequest.desiredEventDate ? 
                                (selectedEventRequest.desiredEventDate instanceof Date ? 
                                  selectedEventRequest.desiredEventDate.toLocaleDateString() : 
                                  selectedEventRequest.desiredEventDate.toString()) : 
                                'Not specified'
                            }</p>
                            <p><span className="font-medium">Status:</span> <Badge className={statusColors[selectedEventRequest.status]}>{selectedEventRequest.status}</Badge></p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-medium text-[#1A2332]">Event Logistics</h3>
                          <div className="mt-2 space-y-2">
                            <p><span className="font-medium">Start Time:</span> {selectedEventRequest.eventStartTime || 'Not set'}</p>
                            <p><span className="font-medium">End Time:</span> {selectedEventRequest.eventEndTime || 'Not set'}</p>
                            <p><span className="font-medium">Pickup Time:</span> {selectedEventRequest.pickupTime || 'Not set'}</p>
                            <p><span className="font-medium">Address:</span> {selectedEventRequest.eventAddress || 'Not set'}</p>
                            <p><span className="font-medium">Destination:</span> {selectedEventRequest.sandwichDestination || 'Not set'}</p>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-base font-medium text-[#1A2332]">Additional Details</h3>
                          <div className="mt-2 space-y-2">
                            <p><span className="font-medium">TSP Contact:</span> {resolveUserName(selectedEventRequest.tspContact) || 'Not assigned'}</p>
                            <p><span className="font-medium">Sandwich Types:</span> {
                              (() => {
                                if (!selectedEventRequest.sandwichTypes) return 'Not specified';
                                try {
                                  const types = typeof selectedEventRequest.sandwichTypes === 'string' 
                                    ? JSON.parse(selectedEventRequest.sandwichTypes) 
                                    : selectedEventRequest.sandwichTypes;
                                  
                                  const typesList = Object.entries(types)
                                    .filter(([_, count]) => typeof count === 'number' && count > 0)
                                    .map(([type, count]) => `${count} ${type}`)
                                    .join(', ');
                                  
                                  return typesList || 'Not specified';
                                } catch (e) {
                                  console.warn('Failed to parse sandwich types:', selectedEventRequest.sandwichTypes);
                                  return selectedEventRequest.sandwichTypes;
                                }
                              })()
                            }</p>
                            <p><span className="font-medium">Refrigeration:</span> {selectedEventRequest.hasRefrigeration === true ? 'Yes' : selectedEventRequest.hasRefrigeration === false ? 'No' : 'Not specified'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {selectedEventRequest.planningNotes && (
                      <div>
                        <h3 className="text-base font-medium text-[#1A2332]">Planning Notes</h3>
                        <p className="mt-2 text-sm text-[#1A2332] bg-[#e6f2f5] p-3 rounded">{selectedEventRequest.planningNotes}</p>
                      </div>
                    )}
                    {selectedEventRequest.message && (
                      <div>
                        <h3 className="text-base font-medium text-[#1A2332]">Original Message</h3>
                        <p className="mt-2 text-sm text-[#1A2332] bg-[#e6f2f5] p-3 rounded border-l-4 border-blue-400">{selectedEventRequest.message}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Edit mode - comprehensive form */}
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      // Handle form submission - create or update
                      const formData = {
                          firstName: (e.target as any).firstName.value,
                          lastName: (e.target as any).lastName.value,
                          email: (e.target as any).email.value,
                          phone: (e.target as any).phone.value,
                          organizationName: (e.target as any).organizationName.value,
                          desiredEventDate: (e.target as any).desiredEventDate.value,
                          eventStartTime: (e.target as any).startTime.value,
                          eventEndTime: (e.target as any).endTime.value,
                          pickupTime: (e.target as any).pickupTime.value,
                          eventAddress: (e.target as any).eventAddress.value,
                          ...(((e.target as any).sandwichDestination.value.trim() !== '') ? {
                            sandwichDestination: (e.target as any).sandwichDestination.value
                          } : {}),
                          tspContact: (e.target as any).tspContact.value === 'none' ? '' : (e.target as any).tspContact.value,
                          // Handle sandwich data based on mode
                          ...(modalSandwichMode === 'total' ? {
                            estimatedSandwichCount: modalTotalCount,
                            sandwichTypes: null, // Clear specific types when using total mode
                          } : {
                            sandwichTypes: JSON.stringify(modalSandwichTypes),
                            estimatedSandwichCount: modalSandwichTypes.reduce((sum, item) => sum + item.quantity, 0),
                          }),
                          hasRefrigeration: (e.target as any).refrigeration.value === 'yes' ? true : 
                                           (e.target as any).refrigeration.value === 'no' ? false : null,
                          driversNeeded: parseInt((e.target as any).driversNeeded.value) || 0,
                          vanDriverNeeded: (e.target as any).vanDriverNeeded.checked || false,
                          speakersNeeded: parseInt((e.target as any).speakersNeeded.value) || 0,
                          volunteersNeeded: (e.target as any).volunteersNeeded.checked || false,
                          planningNotes: (e.target as any).planningNotes.value,
                          status: (e.target as any).status.value
                        };

                      // Create or update based on whether we have an existing event
                      if (selectedEventRequest) {
                        updateEventRequestMutation.mutate({
                          id: selectedEventRequest.id,
                          data: formData
                        });
                      } else {
                        createEventRequestMutation.mutate(formData);
                      }
                    }} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-base font-medium text-[#1A2332] mb-3">Contact Information</h3>
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                  id="firstName"
                                  name="firstName"
                                  defaultValue={selectedEventRequest?.firstName || ''}
                                />
                              </div>
                              <div>
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                  id="lastName"
                                  name="lastName"
                                  defaultValue={selectedEventRequest?.lastName || ''}
                                />
                              </div>
                              <div>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                  id="email"
                                  name="email"
                                  type="email"
                                  defaultValue={selectedEventRequest?.email || ''}
                                />
                              </div>
                              <div>
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                  id="phone"
                                  name="phone"
                                  defaultValue={selectedEventRequest?.phone || ''}
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-base font-medium text-[#1A2332] mb-3">Event Details</h3>
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="organizationName">Organization Name</Label>
                                <Input
                                  id="organizationName"
                                  name="organizationName"
                                  defaultValue={selectedEventRequest?.organizationName || ''}
                                />
                              </div>
                              <div>
                                <Label htmlFor="desiredEventDate">Desired Event Date</Label>
                                  <Input
                                    id="desiredEventDate"
                                    name="desiredEventDate"
                                    type="date"
                                    defaultValue={
                                      selectedEventRequest?.desiredEventDate ? 
                                      (() => {
                                        // Handle Date object or string
                                        const dateValue = selectedEventRequest?.desiredEventDate;
                                        if (dateValue instanceof Date) {
                                          return dateValue.toISOString().split('T')[0];
                                        }
                                        const dateStr = dateValue.toString();
                                        if (dateStr.includes('/')) {
                                          const [month, day, year] = dateStr.split('/');
                                          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                                        }
                                        // If already in YYYY-MM-DD format or ISO, try to parse and format
                                        try {
                                          const date = new Date(dateStr);
                                          if (!isNaN(date.getTime())) {
                                            return date.toISOString().split('T')[0];
                                          }
                                        } catch (e) {
                                          console.warn('Date conversion failed:', dateStr);
                                        }
                                        return dateStr;
                                      })() : ''
                                    }
                                />
                              </div>
                              <div>
                                <Label htmlFor="status">Status</Label>
                                <Select name="status" defaultValue={selectedEventRequest?.status || 'new'}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="in_process">In Process</SelectItem>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="declined">Declined</SelectItem>
                                    <SelectItem value="postponed">Postponed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-base font-medium text-[#1A2332] mb-3">Event Logistics</h3>
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="startTime">Start Time</Label>
                                <Input
                                  id="startTime"
                                  name="startTime"
                                  type="time"
                                  defaultValue={selectedEventRequest?.eventStartTime || ''}
                                />
                              </div>
                              <div>
                                <Label htmlFor="endTime">End Time</Label>
                                <Input
                                  id="endTime"
                                  name="endTime"
                                  type="time"
                                  defaultValue={selectedEventRequest?.eventEndTime || ''}
                                />
                              </div>
                              <div>
                                <Label htmlFor="pickupTime">Pickup Time</Label>
                                <Input
                                  id="pickupTime"
                                  name="pickupTime"
                                  type="time"
                                  defaultValue={selectedEventRequest?.pickupTime || ''}
                                />
                              </div>
                              <div>
                                <Label htmlFor="eventAddress">Event Address</Label>
                                <Input
                                  id="eventAddress"
                                  name="eventAddress"
                                  defaultValue={selectedEventRequest?.eventAddress || ''}
                                />
                              </div>
                              <div>
                                <Label htmlFor="sandwichDestination">Sandwich Destination</Label>
                                <Input
                                  id="sandwichDestination"
                                  name="sandwichDestination"
                                  defaultValue={selectedEventRequest?.sandwichDestination || ''}
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-base font-medium text-[#1A2332] mb-3">Additional Details</h3>
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="tspContact">TSP Contact</Label>
                                <Select name="tspContact" defaultValue={selectedEventRequest?.tspContact || "none"}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select TSP contact" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No contact assigned</SelectItem>
                                    {users?.map((user: any) => (
                                      <SelectItem key={user.id} value={user.id}>
                                        {user.firstName && user.lastName
                                          ? `${user.firstName} ${user.lastName}`
                                          : user.email} ({user.email})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="sandwichTypes">Sandwich Planning</Label>
                                <div className="space-y-4 p-4 border rounded-lg bg-[#e6f2f5]">
                                  {/* Mode Selector */}
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={modalSandwichMode === 'total' ? 'default' : 'outline'}
                                      onClick={() => setModalSandwichMode('total')}
                                      className="text-xs"
                                      data-testid="button-total-mode"
                                    >
                                      Total Count Only
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={modalSandwichMode === 'types' ? 'default' : 'outline'}
                                      onClick={() => setModalSandwichMode('types')}
                                      className="text-xs"
                                      data-testid="button-types-mode"
                                    >
                                      Specify Types
                                    </Button>
                                  </div>

                                  {/* Total Count Mode */}
                                  {modalSandwichMode === 'total' && (
                                    <div className="space-y-2">
                                      <Label htmlFor="totalSandwichCount">Total Number of Sandwiches</Label>
                                      <Input
                                        id="totalSandwichCount"
                                        type="number"
                                        value={modalTotalCount}
                                        onChange={(e) => setModalTotalCount(parseInt(e.target.value) || 0)}
                                        placeholder="Enter total sandwich count"
                                        min="0"
                                        className="w-40"
                                        data-testid="input-total-count"
                                      />
                                      <p className="text-sm text-[#236383]">
                                        Use this when you know the total count but types will be determined later.
                                      </p>
                                    </div>
                                  )}

                                  {/* Specific Types Mode */}
                                  {modalSandwichMode === 'types' && (
                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center">
                                        <Label>Sandwich Types & Quantities</Label>
                                        <Button type="button" onClick={addModalSandwichType} size="sm" data-testid="button-add-type">
                                          <Plus className="w-4 h-4 mr-2" />
                                          Add Type
                                        </Button>
                                      </div>
                                      
                                      {modalSandwichTypes.length === 0 ? (
                                        <div className="text-center py-4 text-[#007E8C] text-sm">
                                          Click "Add Type" to specify individual sandwich types and quantities
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {modalSandwichTypes.map((sandwichType, index) => (
                                            <div key={index} className="flex items-center space-x-2" data-testid={`row-sandwich-type-${index}`}>
                                              <Select 
                                                value={sandwichType.type} 
                                                onValueChange={(value) => updateModalSandwichType(index, 'type', value)}
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
                                                value={sandwichType.quantity}
                                                onChange={(e) => updateModalSandwichType(index, 'quantity', parseInt(e.target.value) || 0)}
                                                placeholder="Qty"
                                                min="0"
                                                className="w-20"
                                              />
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeModalSandwichType(index)}
                                                className="text-red-600 hover:text-red-700"
                                                data-testid={`button-remove-type-${index}`}
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          ))}
                                          
                                          {/* Total Summary */}
                                          <div className="mt-3 p-2 bg-white rounded border-l-4 border-[#007E8C]/30">
                                            <span className="text-sm font-medium">
                                              Total: {modalSandwichTypes.reduce((sum, item) => sum + item.quantity, 0)} sandwiches
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Summary */}
                                  <div className="text-xs text-[#236383] bg-white p-2 rounded border-l-4 border-green-200">
                                    <strong>Current Selection:</strong>{' '}
                                    {modalSandwichMode === 'total'
                                      ? `${modalTotalCount} sandwiches (types to be determined)`
                                      : modalSandwichTypes.length > 0
                                        ? modalSandwichTypes
                                            .filter(item => item.quantity > 0)
                                            .map(item => `${item.quantity} ${SANDWICH_TYPES.find(t => t.value === item.type)?.label || item.type}`)
                                            .join(', ')
                                        : 'No types specified'
                                    }
                                  </div>
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="refrigeration">Refrigeration Available</Label>
                                <Select name="refrigeration" defaultValue={selectedEventRequest?.hasRefrigeration === true ? "yes" : selectedEventRequest?.hasRefrigeration === false ? "no" : "unknown"}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select refrigeration status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="yes">Yes</SelectItem>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="unknown">Unknown</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="driversNeeded">Drivers Needed</Label>
                                <div className="space-y-2">
                                  <Input
                                    type="number"
                                    name="driversNeeded"
                                    placeholder="Number of drivers needed"
                                    min="0"
                                    defaultValue={selectedEventRequest?.driversNeeded || 0}
                                  />
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="vanDriverNeeded"
                                      name="vanDriverNeeded"
                                      defaultChecked={selectedEventRequest?.vanDriverNeeded || false}
                                    />
                                    <Label htmlFor="vanDriverNeeded" className="text-sm">Van driver required</Label>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Driver Assignment Section for Completed Events */}
                              {selectedEventRequest?.status === 'completed' && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                  <Label className="text-sm font-medium text-green-800">Actual Drivers Who Served</Label>
                                  <div className="mt-2 space-y-2">
                                    <Input
                                      name="actualDrivers"
                                      placeholder="Enter driver names (comma separated)"
                                      defaultValue={(() => {
                                        if (!selectedEventRequest?.assignedDriverIds) return '';
                                        const driverNames = selectedEventRequest.assignedDriverIds.map(id => {
                                          const details = selectedEventRequest.driverDetails?.[id];
                                          return details?.name || id;
                                        });
                                        return driverNames.join(', ');
                                      })()}
                                    />
                                    <p className="text-xs text-green-600">Example: John Smith, Jane Doe, Mike Johnson</p>
                                  </div>
                                </div>
                              )}
                              <div>
                                <Label htmlFor="speakersNeeded">Speakers Needed</Label>
                                <Input
                                  type="number"
                                  name="speakersNeeded"
                                  placeholder="Number of speakers needed"
                                  min="0"
                                  defaultValue={selectedEventRequest?.speakersNeeded || 0}
                                />
                              </div>
                              <div>
                                <Label htmlFor="volunteersNeeded">Additional Volunteers Needed</Label>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id="volunteersNeeded"
                                    name="volunteersNeeded"
                                    defaultChecked={selectedEventRequest?.volunteersNeeded || false}
                                  />
                                  <Label htmlFor="volunteersNeeded" className="text-sm">Additional volunteers needed</Label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="planningNotes">Planning Notes</Label>
                        <Textarea
                          id="planningNotes"
                          name="planningNotes"
                          defaultValue={selectedEventRequest?.planningNotes || ''}
                          rows={4}
                          placeholder="Add planning notes..."
                        />
                      </div>
                      <div className="flex justify-end space-x-3 pt-4 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="text-white"
                          style={{ backgroundColor: '#236383' }}
                          disabled={createEventRequestMutation.isPending || updateEventRequestMutation.isPending}
                        >
                          {selectedEventRequest ? 
                            (updateEventRequestMutation.isPending ? 'Saving...' : 'Save Changes') :
                            (createEventRequestMutation.isPending ? 'Creating...' : 'Create Event Request')
                          }
                        </Button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Enhanced Assignment Dialog */}
        {showAssignmentDialog && assignmentType && assignmentEventId && (
          <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-[#007E8C]" />
                  <span>Assign {assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1)}s</span>
                </DialogTitle>
                <DialogDescription>
                  Select multiple people from the {assignmentType} database or add custom entries. 
                  You can assign multiple {assignmentType}s to this event.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Database Selection */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-[#1A2332]">
                      Available People (All Drivers, Volunteers, Hosts)
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {drivers.length + volunteers.length + hosts.length} in database
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {[...drivers, ...volunteers, ...hosts].map((person: any) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-[#e6f2f5]"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-[#1A2332]">
                            {person.firstName} {person.lastName}
                          </div>
                          {assignmentType === 'driver' && person.vanCapable && (
                            <Badge className="text-xs bg-[#007E8C] text-white mt-1">
                              Van Capable
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const personName = `${person.firstName} ${person.lastName}`;
                            handleAssignment(person.id, personName);
                          }}
                          className="text-xs px-2 py-1"
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                    
                    {(drivers.length + volunteers.length + hosts.length) === 0 && (
                      <div className="col-span-2 text-center py-4 text-[#007E8C]">
                        No people found in database
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Entry Section */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-[#1A2332] flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Add Custom {assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1)}</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      placeholder="First Name"
                      value={customPersonData.firstName}
                      onChange={(e) => setCustomPersonData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                    <Input
                      placeholder="Last Name"
                      value={customPersonData.lastName}
                      onChange={(e) => setCustomPersonData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                    <Input
                      placeholder="Email (optional)"
                      type="email"
                      value={customPersonData.email}
                      onChange={(e) => setCustomPersonData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Phone (optional)"
                      value={customPersonData.phone}
                      onChange={(e) => setCustomPersonData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                    {assignmentType === 'driver' && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="vanCapable"
                          checked={customPersonData.vanCapable}
                          onChange={(e) => setCustomPersonData(prev => ({ ...prev, vanCapable: e.target.checked }))}
                        />
                        <Label htmlFor="vanCapable" className="text-sm">Van capable</Label>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => {
                      if (!customPersonData.firstName.trim() || !customPersonData.lastName.trim()) {
                        toast({
                          title: 'Name required',
                          description: 'Please enter both first and last name',
                          variant: 'destructive',
                        });
                        return;
                      }
                      
                      const personName = `${customPersonData.firstName} ${customPersonData.lastName}`;
                      const customId = `custom_${Date.now()}`;
                      handleAssignment(customId, personName);
                      
                      // Reset custom form
                      setCustomPersonData({
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: '',
                        vanCapable: false,
                      });
                    }}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Custom {assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1)}
                  </Button>
                </div>

                {/* Currently Assigned Section */}
                {(() => {
                  const eventRequest = eventRequests.find(req => req.id === assignmentEventId);
                  if (!eventRequest) return null;
                  
                  let assignedPeople: string[] = [];
                  if (assignmentType === 'driver') {
                    assignedPeople = eventRequest.assignedDriverIds || [];
                  } else if (assignmentType === 'speaker') {
                    assignedPeople = Object.keys(eventRequest.speakerDetails || {});
                  } else if (assignmentType === 'volunteer') {
                    assignedPeople = eventRequest.assignedVolunteerIds || [];
                  }
                  
                  if (assignedPeople.length === 0) return null;
                  
                  return (
                    <div className="space-y-3 border-t pt-4">
                      <h4 className="font-semibold text-[#1A2332]">Currently Assigned</h4>
                      <div className="space-y-2">
                        {assignedPeople.map((personId, index) => {
                          // Try to resolve name from different sources
                          let personName = 'Unknown';
                          let personDetails = null;
                          
                          // First check if there are stored details for this assignment type
                          if (assignmentType === 'driver') {
                            const driverDetails = eventRequest.driverDetails?.[personId];
                            if (driverDetails) {
                              personName = driverDetails.name;
                              personDetails = driverDetails;
                            }
                          } else if (assignmentType === 'speaker') {
                            const speakerDetails = eventRequest.speakerDetails?.[personId];
                            if (speakerDetails) {
                              personName = speakerDetails.name;
                              personDetails = speakerDetails;
                            }
                          } else if (assignmentType === 'volunteer') {
                            const volunteerDetails = eventRequest.volunteerDetails?.[personId];
                            if (volunteerDetails) {
                              personName = volunteerDetails.name;
                              personDetails = volunteerDetails;
                            }
                          }
                          
                          // If no stored details, search in ALL databases to find the person
                          if (personName === 'Unknown') {
                            // Try drivers database
                            const driver = drivers.find(d => d.id === personId);
                            if (driver) {
                              personName = `${driver.firstName} ${driver.lastName}`;
                            } else {
                              // Try volunteers database
                              const volunteer = volunteers.find(v => v.id === personId);
                              if (volunteer) {
                                personName = `${volunteer.firstName} ${volunteer.lastName}`;
                              } else {
                                // Try hosts database
                                const host = hosts.find(h => h.id === personId);
                                if (host) {
                                  personName = `${host.firstName} ${host.lastName}`;
                                }
                              }
                            }
                          }
                          
                          return (
                            <div key={index} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                              <div className="flex-1">
                                <div className="font-medium text-green-800">{personName}</div>
                                {personDetails?.assignedAt && (
                                  <div className="text-xs text-green-600">
                                    Assigned {new Date(personDetails.assignedAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  handleRemoveAssignment(personId, assignmentType!, assignmentEventId!);
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAssignmentDialog(false);
                      setAssignmentType(null);
                      setAssignmentEventId(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Event Scheduling Dialog */}
        <EventSchedulingForm
          eventRequest={schedulingEventRequest}
          isVisible={showSchedulingDialog}
          onClose={() => {
            setShowSchedulingDialog(false);
            setSchedulingEventRequest(null);
          }}
          onScheduled={() => {
            // Refresh the data after successful scheduling
            queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
          }}
        />

        {/* Toolkit Sent Dialog */}
        <ToolkitSentDialog
          isOpen={showToolkitSentDialog}
          onClose={() => setShowToolkitSentDialog(false)}
          eventRequest={toolkitEventRequest}
          onToolkitSent={(toolkitSentDate) => {
            // Update the event request status
            if (selectedEventRequest?.id) {
              updateEventRequestMutation.mutate({
                id: selectedEventRequest.id,
                data: {
                  status: 'in_process',
                  toolkitSent: true,
                  toolkitSentDate: toolkitSentDate,
                  toolkitStatus: 'sent'
                }
              });
            }
            setShowToolkitSentDialog(false);
          }}
          isLoading={updateEventRequestMutation.isPending}
        />

        {/* Sandwich Planning Modal */}
        <Dialog open={showSandwichPlanningModal} onOpenChange={setShowSandwichPlanningModal}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <span className="text-2xl">🥪</span>
                Weekly Sandwich Planning
              </DialogTitle>
              <DialogDescription>
                Plan sandwich production for upcoming weeks. Track distribution days and coordinate with individual makers and group events.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-6">
              <SandwichForecastWidget />
              
              {/* Planning Tips */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Sandwich Planning Tips
                </h4>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Individual makers typically prep sandwiches on Wednesdays</li>
                  <li>• Group distributions happen on Thursdays</li>
                  <li>• Check upcoming events for sandwich type requirements</li>
                  <li>• Coordinate with hosts for special dietary needs</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button
                onClick={() => setShowSandwichPlanningModal(false)}
                className="text-white"
                style={{ backgroundColor: '#236383' }}
                data-testid="button-close-sandwich-planning"
              >
                Close Sandwich Planning
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Staffing Planning Modal */}
        <Dialog open={showStaffingPlanningModal} onOpenChange={setShowStaffingPlanningModal}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <Users className="w-6 h-6" />
                Weekly Staffing Planning
              </DialogTitle>
              <DialogDescription>
                Coordinate drivers, speakers, and volunteers for scheduled events. Ensure all positions are filled before event dates.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-6">
              <StaffingForecastWidget />
              
              {/* Staffing Tips */}
              <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
                <h4 className="font-semibold text-[#1A2332] mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Staffing Planning Tips
                </h4>
                <ul className="text-sm text-[#236383] space-y-1">
                  <li>• Check driver assignments early - transportation is critical</li>
                  <li>• Speaker assignments should be confirmed 1 week before events</li>
                  <li>• Van drivers are needed for large events or special delivery requirements</li>
                  <li>• Volunteers help with event setup and sandwich distribution</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button
                onClick={() => setShowStaffingPlanningModal(false)}
                className="text-white"
                style={{ backgroundColor: '#236383' }}
                data-testid="button-close-staffing-planning"
              >
                Close Staffing Planning
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Schedule Call Dialog */}
        <ScheduleCallDialog
          isOpen={showScheduleCallDialog}
          onClose={() => setShowScheduleCallDialog(false)}
          eventRequest={selectedEventRequest}
          onCallScheduled={handleScheduleCall}
          isLoading={scheduleCallMutation.isPending}
          scheduleCallDate={scheduleCallDate}
          setScheduleCallDate={setScheduleCallDate}
          scheduleCallTime={scheduleCallTime}
          setScheduleCallTime={setScheduleCallTime}
        />

        {/* 1-Day Follow-up Dialog */}
        <FollowUpDialog
          isOpen={showOneDayFollowUpDialog}
          onClose={() => setShowOneDayFollowUpDialog(false)}
          eventRequest={selectedEventRequest}
          onFollowUpCompleted={(notes) => {
            if (selectedEventRequest) {
              oneDayFollowUpMutation.mutate({
                id: selectedEventRequest.id,
                notes,
              });
            }
          }}
          isLoading={oneDayFollowUpMutation.isPending}
          followUpType="1-day"
          notes={followUpNotes}
          setNotes={setFollowUpNotes}
        />

        {/* 1-Month Follow-up Dialog */}
        <FollowUpDialog
          isOpen={showOneMonthFollowUpDialog}
          onClose={() => setShowOneMonthFollowUpDialog(false)}
          eventRequest={selectedEventRequest}
          onFollowUpCompleted={(notes) => {
            if (selectedEventRequest) {
              oneMonthFollowUpMutation.mutate({
                id: selectedEventRequest.id,
                notes,
              });
            }
          }}
          isLoading={oneMonthFollowUpMutation.isPending}
          followUpType="1-month"
          notes={followUpNotes}
          setNotes={setFollowUpNotes}
        />

        {/* Other modals and dialogs */}
      </div>
    </TooltipProvider>
  );
};
