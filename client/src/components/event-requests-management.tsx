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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Check,
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
  Car,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import type { EventRequest } from '@shared/schema';
import { TaskAssigneeSelector } from './task-assignee-selector';
import { VolunteerSelectionModal } from './volunteer-selection-modal';
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
import RequestFilters from './event-requests/RequestFilters';
import ContactOrganizerDialog from './ContactOrganizerDialog';

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

// Comprehensive Person Selector Component
interface ComprehensivePersonSelectorProps {
  selectedPeople: string[];
  onSelectionChange: (selected: string[]) => void;
  assignmentType: 'driver' | 'speaker' | 'volunteer' | null;
}

function ComprehensivePersonSelector({ selectedPeople, onSelectionChange, assignmentType }: ComprehensivePersonSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch all the different types of people
  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/users/for-assignments'],
  });
  
  const { data: drivers = [], isLoading: driversLoading } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
  });
  
  const { data: hostsWithContacts = [], isLoading: hostsLoading } = useQuery<any[]>({
    queryKey: ['/api/hosts-with-contacts'],
  });
  
  const isLoading = usersLoading || driversLoading || hostsLoading;
  
  // Extract all host contacts
  const hostContacts = hostsWithContacts.flatMap(host => 
    (host.contacts || []).map((contact: any) => ({
      ...contact,
      hostName: host.name,
      displayName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Unknown Contact',
      type: 'host-contact'
    }))
  );
  
  // Filter all people based on search term
  const allPeople = [
    ...users.map((user: any) => ({
      id: user.id,
      displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || user.email || 'Unknown User',
      email: user.email,
      type: 'user',
      section: 'Team Members'
    })),
    ...drivers.map((driver: any) => ({
      id: driver.id.toString(),
      displayName: driver.name,
      email: driver.email,
      phone: driver.phone,
      type: 'driver',
      section: 'Drivers'
    })),
    ...hostContacts.map((contact: any) => ({
      id: `host-contact-${contact.id}`,
      displayName: contact.displayName,
      email: contact.email,
      phone: contact.phone,
      hostName: contact.hostName,
      type: 'host-contact',
      section: 'Host Contacts'
    }))
  ].filter(person => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return person.displayName.toLowerCase().includes(searchLower) ||
           (person.email && person.email.toLowerCase().includes(searchLower)) ||
           (person.phone && person.phone.toLowerCase().includes(searchLower)) ||
           (person.hostName && person.hostName.toLowerCase().includes(searchLower));
  });
  
  // Group people by section
  const groupedPeople = allPeople.reduce((acc, person) => {
    if (!acc[person.section]) acc[person.section] = [];
    acc[person.section].push(person);
    return acc;
  }, {} as Record<string, any[]>);
  
  const togglePersonSelection = (personId: string) => {
    if (selectedPeople.includes(personId)) {
      onSelectionChange(selectedPeople.filter(id => id !== personId));
    } else {
      onSelectionChange([...selectedPeople, personId]);
    }
  };
  
  const removeSelectedPerson = (personId: string) => {
    onSelectionChange(selectedPeople.filter(id => id !== personId));
  };
  
  return (
    <div className="flex-1 flex flex-col space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search by name, email, phone, or organization..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Selected People */}
      {selectedPeople.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">
            Selected {assignmentType ? assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1) + 's' : 'People'} ({selectedPeople.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedPeople.map((personId) => {
              const person = allPeople.find(p => p.id === personId);
              return (
                <Badge
                  key={personId}
                  variant="secondary"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  {person?.displayName || personId}
                  <button
                    onClick={() => removeSelectedPerson(personId)}
                    className="ml-2 hover:bg-green-200 rounded-full w-4 h-4 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Available People by Category */}
      <div className="flex-1">
        <ScrollArea className="h-96">
          <div className="space-y-6">
            {Object.entries(groupedPeople).map(([section, people]) => (
              <div key={section}>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  {section} ({people.length})
                </h3>
                <div className="space-y-2">
                  {people.map((person) => {
                    const isSelected = selectedPeople.includes(person.id);
                    return (
                      <div
                        key={person.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => togglePersonSelection(person.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {person.type === 'user' && <User className="w-4 h-4 text-gray-400" />}
                            {person.type === 'driver' && <Car className="w-4 h-4 text-gray-400" />}
                            {person.type === 'host-contact' && <Building className="w-4 h-4 text-gray-400" />}
                            <div>
                              <div className="font-medium">{person.displayName}</div>
                              {person.email && (
                                <div className="text-sm text-gray-500">{person.email}</div>
                              )}
                              {person.phone && (
                                <div className="text-sm text-gray-500">{person.phone}</div>
                              )}
                              {person.hostName && (
                                <div className="text-sm text-gray-500">Host: {person.hostName}</div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="text-sm text-gray-500">Loading people...</div>
        </div>
      )}
    </div>
  );
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




export default function EventRequestsManagement({
  initialTab,
  initialEventId,
}: {
  initialTab?: string | null;
  initialEventId?: number;
} = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'organization' | 'event_date'>(
    'newest'
  );
  const [activeTab, setActiveTab] = useState(initialTab || 'new');
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

  // Contact organizer dialog states
  const [showContactOrganizerDialog, setShowContactOrganizerDialog] = useState(false);
  const [contactEventRequest, setContactEventRequest] = useState<EventRequest | null>(null);

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
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
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
              setContactEventRequest(request);
              setShowContactOrganizerDialog(true);
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

  // Comprehensive multi-assignment handler
  const handleMultipleAssignments = async (assigneeIds: string[], type: 'driver' | 'speaker' | 'volunteer', eventId: number) => {
    try {
      const eventRequest = eventRequests.find(req => req.id === eventId);
      if (!eventRequest) return;

      let updateData: any = {};

      // Add new assignees to existing ones
      if (type === 'driver') {
        const currentDrivers = eventRequest.assignedDriverIds || [];
        const newDrivers = [...new Set([...currentDrivers, ...assigneeIds])]; // Remove duplicates
        updateData.assignedDriverIds = newDrivers;
      } else if (type === 'speaker') {
        const currentSpeakers = eventRequest.assignedSpeakerIds || [];
        const newSpeakers = [...new Set([...currentSpeakers, ...assigneeIds])];
        updateData.assignedSpeakerIds = newSpeakers;
      } else if (type === 'volunteer') {
        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        const newVolunteers = [...new Set([...currentVolunteers, ...assigneeIds])];
        updateData.assignedVolunteerIds = newVolunteers;
      }

      await updateEventRequestMutation.mutateAsync({
        id: eventId,
        data: updateData,
      });

      toast({
        title: 'Assignment successful',
        description: `Assigned ${assigneeIds.length} ${type}${assigneeIds.length > 1 ? 's' : ''} to the event.`,
      });

    } catch (error) {
      console.error('Assignment error:', error);
      toast({
        title: 'Assignment failed',
        description: 'Failed to assign people. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setShowAssignmentDialog(false);
      setAssignmentType(null);
      setAssignmentEventId(null);
      setSelectedAssignees([]);
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
        if (!eventRequest.volunteersNeeded || eventRequest.volunteersNeeded <= 0) {
          toast({
            title: 'Volunteers not needed',
            description: 'This event does not require volunteers',
            variant: 'destructive',
          });
          return;
        }

        // Check capacity if volunteer limit is set
        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        if (typeof eventRequest.volunteersNeeded === 'number' && currentVolunteers.length >= eventRequest.volunteersNeeded) {
          toast({
            title: 'No volunteer spots available',
            description: 'All volunteer spots are filled for this event',
            variant: 'destructive',
          });
          return;
        }

        // Check if user is already assigned
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
      // Allow volunteer signup for scheduled events or events that need volunteers
      if (eventRequest.status === 'scheduled' || (eventRequest.volunteersNeeded && eventRequest.volunteersNeeded > 0)) {
        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        // Check if user is not already assigned and there's still capacity
        const notAlreadyAssigned = !currentVolunteers.includes(user.id);
        const hasCapacity = typeof eventRequest.volunteersNeeded !== 'number' || currentVolunteers.length < eventRequest.volunteersNeeded;
        return notAlreadyAssigned && hasCapacity;
      }
      return false;
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

  // Handle initial tab and event ID - auto-open event details if specified
  useEffect(() => {
    // Set initial tab if provided
    if (initialTab && ['new', 'in_process', 'scheduled', 'completed', 'declined'].includes(initialTab)) {
      setActiveTab(initialTab);
    }
    
    // Handle initial event ID
    if (initialEventId && eventRequests.length > 0) {
      const targetEvent = eventRequests.find(req => req.id === initialEventId);
      if (targetEvent) {
        setSelectedEventRequest(targetEvent);
        setShowEventDetails(true);
        setIsEditing(false);
        
        // Set the correct tab based on event status (only if no explicit tab provided)
        if (!initialTab) {
          if (targetEvent.status === 'completed') {
            setActiveTab('completed');
          } else if (targetEvent.status === 'scheduled') {
            setActiveTab('scheduled');
          } else if (targetEvent.status === 'in_process') {
            setActiveTab('in_process');
          } else if (targetEvent.status === 'declined') {
            setActiveTab('declined');
          } else {
            setActiveTab('new');
          }
        }
        
        // Scroll to top to ensure event details are visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [initialTab, initialEventId, eventRequests]);

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
  // Auto-sort by newest when completed tab is selected
  useEffect(() => {
    if (activeTab === 'scheduled' && sortBy !== 'event_date') {
      setSortBy('event_date');
    } else if (activeTab === 'completed' && sortBy !== 'newest') {
      setSortBy('newest');
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

        {/* Event Details Edit Modal - Comprehensive Form */}
        {showEventDetails && (selectedEventRequest || isEditing) && (
          <EventSchedulingForm
            eventRequest={selectedEventRequest}
            isOpen={showEventDetails}
            mode={selectedEventRequest ? "edit" : "create"}
            onClose={() => {
              setShowEventDetails(false);
              setSelectedEventRequest(null);
              setIsEditing(false);
            }}
            onEventScheduled={() => {
              setShowEventDetails(false);
              setSelectedEventRequest(null);
              setIsEditing(false);
            }}
          />
        )}

        {/* Event Scheduling Dialog */}
        {showSchedulingDialog && schedulingEventRequest && (
          <EventSchedulingForm
            eventRequest={schedulingEventRequest}
            isOpen={showSchedulingDialog}
            onClose={() => {
              setShowSchedulingDialog(false);
              setSchedulingEventRequest(null);
            }}
            onEventScheduled={() => {
              setShowSchedulingDialog(false);
              setSchedulingEventRequest(null);
            }}
          />
        )}

        {/* Collection Log Dialog */}
        {showCollectionLog && collectionLogEventRequest && (
          <EventCollectionLog
            eventRequest={collectionLogEventRequest}
            isOpen={showCollectionLog}
            onClose={() => {
              setShowCollectionLog(false);
              setCollectionLogEventRequest(null);
            }}
          />
        )}

        {/* Toolkit Sent Dialog */}
        {showToolkitSentDialog && toolkitEventRequest && (
          <ToolkitSentDialog
            eventRequest={toolkitEventRequest}
            isOpen={showToolkitSentDialog}
            onClose={() => {
              setShowToolkitSentDialog(false);
              setToolkitEventRequest(null);
            }}
            onToolkitSent={(details) => {
              if (toolkitEventRequest) {
                markToolkitSentMutation.mutate({
                  id: toolkitEventRequest.id,
                  details,
                });
              }
            }}
            isLoading={markToolkitSentMutation.isPending}
          />
        )}

        {/* Comprehensive Assignment Dialog */}
        <Dialog open={showAssignmentDialog} onOpenChange={(open) => {
          setShowAssignmentDialog(open);
          if (!open) {
            setSelectedAssignees([]);
            setAssignmentType(null);
            setAssignmentEventId(null);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Assign {assignmentType ? assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1) + 's' : 'People'}
              </DialogTitle>
              <DialogDescription>
                Select people to assign as {assignmentType}s for this event. You can choose from team members, drivers, volunteers, and host contacts.
              </DialogDescription>
            </DialogHeader>

            <ComprehensivePersonSelector 
              selectedPeople={selectedAssignees}
              onSelectionChange={setSelectedAssignees}
              assignmentType={assignmentType}
            />

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setShowAssignmentDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (assignmentEventId && assignmentType) {
                    handleMultipleAssignments(selectedAssignees, assignmentType, assignmentEventId);
                  }
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={selectedAssignees.length === 0}
              >
                Assign {selectedAssignees.length} {assignmentType}s
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* Sandwich Planning Modal */}
        <Dialog open={showSandwichPlanningModal} onOpenChange={setShowSandwichPlanningModal}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <Package className="w-6 h-6" />
                Weekly Sandwich Planning
              </DialogTitle>
              <DialogDescription>
                Plan sandwich production based on scheduled events. Monitor trends and adjust quantities based on demand patterns.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-6">
              <SandwichForecastWidget />
              
              {/* Planning Tips */}
              <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
                <h4 className="font-semibold text-[#1A2332] mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Sandwich Planning Tips
                </h4>
                <ul className="text-sm text-[#236383] space-y-1">
                  <li>• Plan sandwich types based on dietary restrictions and preferences</li>
                  <li>• Factor in 10-15% extra sandwiches for unexpected attendees</li>
                  <li>• Coordinate with kitchen volunteers for preparation schedules</li>
                  <li>• Check delivery addresses for any special requirements</li>
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

        {/* Contact Organizer Dialog */}
        <ContactOrganizerDialog
          isOpen={showContactOrganizerDialog}
          onClose={() => {
            setShowContactOrganizerDialog(false);
            setContactEventRequest(null);
          }}
          eventRequest={contactEventRequest}
        />

      </div>
    </TooltipProvider>
  );
};
