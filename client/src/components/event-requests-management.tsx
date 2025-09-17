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
import { EventEmailComposer } from '@/components/event-email-composer';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import { TaskAssigneeSelector } from './task-assignee-selector';

// Utility function to convert 24-hour time to 12-hour format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';

  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours);

  if (hour24 === 0) return `12:${minutes} AM`;
  if (hour24 < 12) return `${hour24}:${minutes} AM`;
  if (hour24 === 12) return `12:${minutes} PM`;

  return `${hour24 - 12}:${minutes} PM`;
};

// Utility function to convert 24-hour time to 12-hour format for input display
const formatTimeForInput = (time24: string): string => {
  if (!time24) return '';

  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours);

  if (hour24 === 0) return `12:${minutes}`;
  if (hour24 < 12) return `${hour24}:${minutes}`;
  if (hour24 === 12) return `12:${minutes}`;

  return `${hour24 - 12}:${minutes}`;
};

// Sandwich Destination Tracker Component - Simplified Free Text Entry
interface SandwichDestinationTrackerProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const SandwichDestinationTracker: React.FC<SandwichDestinationTrackerProps> = ({
  value,
  onChange,
  onSave,
  onCancel,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="flex-1 bg-white border rounded-lg p-3 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
          <span className="w-4 h-4 mr-2">🎯</span>
          Sandwich Destination
        </h4>
        <div className="flex space-x-1">
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px] min-w-[44px] p-2 text-green-600 hover:bg-green-50"
            onClick={onSave}
            data-testid="save-inline-edit"
          >
            ✓
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px] min-w-[44px] p-2 text-red-600 hover:bg-red-50"
            onClick={onCancel}
            data-testid="cancel-inline-edit"
          >
            ✗
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Enter destination (organization, address, location)..."
          className="w-full text-sm border rounded px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="text-xs text-gray-600">
          💡 Examples: "Community Food Bank", "Main Office", "123 Main St",
          "Front desk delivery"
        </div>
      </div>
    </div>
  );
};

// Helper function to get sandwich types summary for new standardized format
const getSandwichTypesSummary = (request: any) => {
  // Handle new standardized sandwich types format (array of {type, quantity})
  let sandwichTypes = request.sandwichTypes;

  // If sandwichTypes is a string, try to parse it as JSON
  if (typeof sandwichTypes === 'string') {
    try {
      sandwichTypes = JSON.parse(sandwichTypes);
    } catch (e) {
      console.warn('Failed to parse sandwich types JSON:', sandwichTypes);
      sandwichTypes = null;
    }
  }

  if (sandwichTypes && Array.isArray(sandwichTypes)) {
    const total = sandwichTypes.reduce(
      (sum: number, item: any) => sum + (item.quantity || 0),
      0
    );

    if (sandwichTypes.length === 1) {
      // Single type
      const type = sandwichTypes[0].type;
      const typeLabel =
        SANDWICH_TYPES.find((t) => t.value === type)?.label || type;
      return {
        total,
        breakdown: `${total} ${typeLabel}`,
        hasBreakdown: true,
      };
    } else if (sandwichTypes.length > 1) {
      // Multiple types
      const breakdown = sandwichTypes
        .filter((item: any) => item.quantity > 0)
        .map((item: any) => {
          const typeLabel =
            SANDWICH_TYPES.find((t) => t.value === item.type)?.label ||
            item.type;
          return `${item.quantity} ${typeLabel}`;
        })
        .join(', ');
      return {
        total,
        breakdown,
        hasBreakdown: true,
      };
    }
  }

  // Legacy format fallback
  if (request.estimatedSandwichCount) {
    const total = request.estimatedSandwichCount;
    const type = request.sandwichType || 'Unknown';
    // Convert sandwich type code to readable label
    const typeLabel =
      type !== 'Unknown' && type !== 'unknown'
        ? SANDWICH_TYPES.find((t) => t.value === type)?.label || type
        : 'Unknown';
    return {
      total,
      breakdown:
        typeLabel !== 'Unknown'
          ? `${total} ${typeLabel}`
          : `${total} sandwiches`,
      hasBreakdown: typeLabel !== 'Unknown',
    };
  }

  return { total: 0, breakdown: 'Unknown', hasBreakdown: false };
};

// Enhanced date formatting with day-of-week and color coding
const formatEventDate = (dateString: string) => {
  try {
    if (!dateString)
      return { text: 'No date provided', className: 'text-gray-500' };

    // Parse the date string safely - handle database timestamps, YYYY-MM-DD, and ISO dates
    let date: Date;
    if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      // Database timestamp format: "2025-09-03 00:00:00"
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split(' ')[0];
      date = new Date(dateOnly + 'T12:00:00');
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      // ISO format with midnight time (e.g., "2025-09-03T00:00:00.000Z")
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split('T')[0];
      date = new Date(dateOnly + 'T12:00:00');
    } else if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}$/)
    ) {
      // For YYYY-MM-DD format, add noon to prevent timezone shift
      date = new Date(dateString + 'T12:00:00');
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return { text: 'Invalid date', className: '' };

    const dayOfWeek = date.getDay();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateFormatted = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const isWedOrThu = dayOfWeek === 3 || dayOfWeek === 4;
    let className = 'text-gray-700 font-medium';

    return {
      text: dateFormatted,
      className,
      dayName,
      isWedOrThu,
    };
  } catch (error) {
    return { text: 'Invalid date', className: '' };
  }
};

interface EventRequest {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  organizationName: string;
  department?: string;
  desiredEventDate?: string;
  message?: string;
  previouslyHosted: 'yes' | 'no' | 'i_dont_know';
  status: 'new' | 'in_process' | 'scheduled' | 'completed' | 'declined';
  assignedTo?: string;
  organizationExists: boolean;
  duplicateNotes?: string;
  createdAt: string;
  isUnresponsive?: boolean;
  contactAttempts?: number;
  lastContactAttempt?: string;
  unresponsiveAfterAttempts?: number;
  firstAttemptDate?: string;
  lastAttemptDate?: string;
  unresponsiveStatus?: string;
  unresponsiveNotes?: string;
  updatedAt: string;
  contactedAt?: string;
  createdBy?: string;
  contactCompletedAt?: string;
  completedByUserId?: string;
  communicationMethod?: string;
  eventAddress?: string;
  estimatedSandwichCount?: number;
  hasRefrigeration?: boolean;
  contactCompletionNotes?: string;
  tspContactAssigned?: string;
  toolkitSent?: boolean;
  toolkitSentDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  pickupTime?: string;
  additionalRequirements?: string;
  planningNotes?: string;
  toolkitStatus?: string;
  tspContact?: string;
  additionalTspContacts?: string;
  additionalContact1?: string;
  additionalContact2?: string;
  customTspContact?: string;
  followUpMethod?: string;
  updatedEmail?: string;
  followUpDate?: string;
  scheduledCallDate?: string;
  scheduledCallTime?: string;
  driverCount?: number;
  speakerCount?: number;
  volunteerCount?: number;
  vanDriverCount?: number;
  driverAssignments?: string[];
  speakerAssignments?: string[];
  volunteerAssignments?: string[];
  vanDriverAssignments?: string[];
  actualSandwiches?: number;
  actualSandwichTypes?: string;
  sandwichTypes?: string;
  sandwichDestination?: string; // Where sandwiches are going
  hostLocation?: string; // Where sandwiches are stored overnight
  vanNeeded?: boolean; // Whether a van is needed for this event
  completedNotes?: string;
  nextDayFollowUp?: string;
  oneMonthFollowUp?: string;
  assignedDriverIds?: string[];
  assignedVolunteerIds?: string[];
  driverDetails?: any;
  speakerDetails?: any;
}

const statusColors = {
  new: 'bg-gradient-to-r from-teal-50 to-cyan-100 text-brand-primary border border-teal-200',
  in_process:
    'bg-gradient-to-r from-teal-50 to-cyan-100 text-brand-teal border border-teal-200',
  scheduled:
    'bg-gradient-to-r from-yellow-50 to-amber-100 text-brand-orange border border-amber-200',
  completed:
    'bg-gradient-to-r from-gray-50 to-slate-100 text-gray-700 border border-gray-200',
  declined:
    'bg-gradient-to-r from-red-50 to-red-100 text-red-900 border-2 border-red-300 font-bold shadow-lg',
};

const SANDWICH_DESTINATIONS = [
  'Atlanta Community Food Bank',
  'Atlanta Mission',
  'Covenant House Georgia',
  'Gateway Center',
  'Hosea Helps',
  'Mercy Care',
  'Open Hand Atlanta',
  'Salvation Army',
  'St. Vincent de Paul',
  'The Atlanta Day Center',
  'The Extension',
  "The Shepherd's Inn",
  'Zaban Paradies Center',
];

// Helper function to format date for input field
const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';

  // If it's already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Try to parse various date formats and convert to YYYY-MM-DD
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('Error formatting date:', error);
    return '';
  }
};

const statusIcons = {
  new: Clock,
  in_process: Phone,
  scheduled: Calendar,
  completed: CheckCircle,
  declined: XCircle,
};

const previouslyHostedOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'i_dont_know', label: 'Unknown' },
];

const statusOptions = [
  { value: 'new', label: 'New Request' },
  { value: 'in_process', label: 'In Process' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: '🚫 EVENT POSTPONED' },
];

// Standardized sandwich types - only these 5 options allowed
const SANDWICH_TYPES = [
  { value: 'pbj', label: 'PB&J' },
  { value: 'deli', label: 'Deli (General)' },
  { value: 'deli_turkey', label: 'Deli (Turkey)' },
  { value: 'deli_ham', label: 'Deli (Ham)' },
  { value: 'unknown', label: 'Unknown' },
] as const;

// Simple inline sandwich types interface
interface SandwichType {
  type: string;
  quantity: number;
}

// Sandwich Types Selector Component
interface SandwichTypesSelectorProps {
  name: string;
  defaultValue?: SandwichType[] | string | null;
  estimatedCount?: number | null;
  className?: string;
}

const SandwichTypesSelector = ({
  name,
  defaultValue,
  estimatedCount,
  className = '',
}: SandwichTypesSelectorProps) => {
  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [singleType, setSingleType] = useState('unknown');
  const [quantities, setQuantities] = useState<Record<string, number>>({
    pbj: 0,
    deli: 0,
    deli_turkey: 0,
    deli_ham: 0,
    unknown: 0,
  });

  // Initialize from default value
  useEffect(() => {
    if (defaultValue) {
      try {
        // Handle array format from database
        if (Array.isArray(defaultValue)) {
          if (defaultValue.length === 1) {
            setMode('single');
            setSingleType(defaultValue[0].type);
          } else {
            setMode('multiple');
            const newQuantities = { ...quantities };
            defaultValue.forEach((item) => {
              newQuantities[item.type] = item.quantity;
            });
            setQuantities(newQuantities);
          }
        }
        // Handle string format (legacy)
        else if (typeof defaultValue === 'string' && defaultValue.trim()) {
          const typeMatch = SANDWICH_TYPES.find(
            (t) =>
              defaultValue.toLowerCase().includes(t.value) ||
              defaultValue.toLowerCase().includes(t.label.toLowerCase())
          );
          if (typeMatch) {
            setSingleType(typeMatch.value);
          }
        }
      } catch (error) {
        console.warn('Error parsing sandwich types:', error);
      }
    }
  }, [defaultValue]);

  // Calculate total quantity for multiple mode
  const totalQuantity = Object.values(quantities).reduce(
    (sum, qty) => sum + qty,
    0
  );

  // Generate the value for form submission
  const generateFormValue = () => {
    if (mode === 'single') {
      const quantity = estimatedCount || 0;
      return quantity > 0 ? [{ type: singleType, quantity }] : [];
    } else {
      return Object.entries(quantities)
        .filter(([_, qty]) => qty > 0)
        .map(([type, quantity]) => ({ type, quantity }));
    }
  };

  return (
    <div className={`space-y-4 p-4 border rounded-lg bg-gray-50 ${className}`}>
      {/* Hidden input for form submission */}
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(generateFormValue())}
      />

      {/* Mode Selector */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === 'single' ? 'default' : 'outline'}
          onClick={() => setMode('single')}
          className="text-xs"
        >
          All Same Type
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'multiple' ? 'default' : 'outline'}
          onClick={() => setMode('multiple')}
          className="text-xs"
        >
          Mixed Types
        </Button>
      </div>

      {/* Single Type Mode */}
      {mode === 'single' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              All {estimatedCount || '?'} sandwiches will be:
            </span>
          </div>
          <Select value={singleType} onValueChange={setSingleType}>
            <SelectTrigger>
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
        </div>
      )}

      {/* Multiple Types Mode */}
      {mode === 'multiple' && (
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Specify quantities for each type:
            {totalQuantity > 0 && (
              <span className="ml-2 text-brand-primary">
                Total: {totalQuantity} sandwiches
              </span>
            )}
            {estimatedCount && totalQuantity !== estimatedCount && (
              <span className="ml-2 text-brand-orange">
                (Expected: {estimatedCount})
              </span>
            )}
          </div>
          {SANDWICH_TYPES.map((type) => (
            <div key={type.value} className="flex items-center justify-between">
              <label className="text-sm">{type.label}:</label>
              <Input
                type="number"
                min="0"
                value={quantities[type.value]}
                onChange={(e) =>
                  setQuantities({
                    ...quantities,
                    [type.value]: parseInt(e.target.value) || 0,
                  })
                }
                onWheel={(e) => {
                  (e.target as HTMLInputElement).blur();
                }}
                className="w-20 text-center"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-gray-600 bg-white p-2 rounded border-l-4 border-blue-200">
        <strong>Current Selection:</strong>{' '}
        {mode === 'single'
          ? `${estimatedCount || '?'} ${
              SANDWICH_TYPES.find((t) => t.value === singleType)?.label ||
              singleType
            }`
          : totalQuantity > 0
            ? Object.entries(quantities)
                .filter(([_, qty]) => qty > 0)
                .map(
                  ([type, qty]) =>
                    `${qty} ${
                      SANDWICH_TYPES.find((t) => t.value === type)?.label ||
                      type
                    }`
                )
                .join(', ')
            : 'No types specified'}
      </div>
    </div>
  );
};

// ToolkitSentDialog Component - handles marking toolkit as sent and optionally sending email
interface ToolkitSentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onToolkitSent: (toolkitSentDate: string) => void;
  isLoading: boolean;
}

const ToolkitSentDialog = ({
  isOpen,
  onClose,
  eventRequest,
  onToolkitSent,
  isLoading,
}: ToolkitSentDialogProps) => {
  const [toolkitSentDate, setToolkitSentDate] = useState('');
  const [toolkitSentTime, setToolkitSentTime] = useState('');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Initialize date/time when dialog opens
  useEffect(() => {
    if (isOpen && eventRequest) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toTimeString().slice(0, 5); // HH:MM format
      setToolkitSentDate(dateStr);
      setToolkitSentTime(timeStr);
      setShowEmailComposer(false);
      setEmailSent(false);
    }
  }, [isOpen, eventRequest]);

  const handleSubmit = () => {
    if (!toolkitSentDate || !toolkitSentTime) return;

    // Combine date and time into ISO string
    const combinedDateTime = new Date(
      `${toolkitSentDate}T${toolkitSentTime}`
    ).toISOString();
    onToolkitSent(combinedDateTime);
  };

  const handleEmailSent = () => {
    setEmailSent(true);
    setShowEmailComposer(false);
  };

  if (!eventRequest) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span>Mark Toolkit as Sent</span>
          </DialogTitle>
          <DialogDescription>
            Record when the toolkit was sent to{' '}
            <strong>
              {eventRequest.firstName} {eventRequest.lastName}
            </strong>{' '}
            at <strong>{eventRequest.organizationName}</strong>. This will move
            the event to "In Process" status.
          </DialogDescription>
        </DialogHeader>

        {!showEmailComposer ? (
          <div className="space-y-6">
            {/* Date and Time Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="toolkit-sent-date">Toolkit Sent Date</Label>
                <Input
                  id="toolkit-sent-date"
                  type="date"
                  value={toolkitSentDate}
                  onChange={(e) => setToolkitSentDate(e.target.value)}
                  data-testid="input-toolkit-sent-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toolkit-sent-time">Toolkit Sent Time</Label>
                <Input
                  id="toolkit-sent-time"
                  type="time"
                  value={toolkitSentTime}
                  onChange={(e) => setToolkitSentTime(e.target.value)}
                  data-testid="input-toolkit-sent-time"
                />
              </div>
            </div>

            {/* Email Status Display */}
            {emailSent && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Email successfully sent!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  The toolkit email has been sent to {eventRequest.email}
                </p>
              </div>
            )}

            {/* Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">
                What happens when you mark toolkit as sent:
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Event status will change from "New" to "In Process"</li>
                <li>• Event will appear in the "In Process" tab</li>
                {!emailSent && (
                  <li>
                    • You can optionally send an email to{' '}
                    {eventRequest.firstName} with toolkit attachments
                  </li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between space-x-4">
              {!emailSent && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEmailComposer(true)}
                  className="flex items-center space-x-2"
                  data-testid="button-send-toolkit-email"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Toolkit Email</span>
                </Button>
              )}

              <div className="flex space-x-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  data-testid="button-cancel-toolkit-sent"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!toolkitSentDate || !toolkitSentTime || isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-confirm-toolkit-sent"
                >
                  {isLoading ? 'Marking as Sent...' : 'Mark as Sent'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Send Toolkit Email</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailComposer(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <EventEmailComposer
              eventRequest={eventRequest}
              onEmailSent={handleEmailSent}
              isOpen={showEmailComposer}
              onClose={() => setShowEmailComposer(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Event Collection Log Component
interface EventCollectionLogProps {
  eventRequest: EventRequest | null;
  isVisible: boolean;
  onClose: () => void;
}

const EventCollectionLog: React.FC<EventCollectionLogProps> = ({
  eventRequest,
  isVisible,
  onClose,
}) => {
  const [collections, setCollections] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    number | null
  >(null);

  // State for editing collection destinations
  const [editingDestination, setEditingDestination] = useState<{
    id: number;
    value: string;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch collections for this event request
  const { data: collectionsData, refetch: refetchCollections } = useQuery({
    queryKey: ['/api/collections', { eventRequestId: eventRequest?.id }],
    enabled: isVisible && !!eventRequest?.id,
  });

  useEffect(() => {
    if (Array.isArray(collectionsData)) {
      setCollections(collectionsData);
    } else if (collectionsData && typeof collectionsData === 'object') {
      setCollections([collectionsData]);
    } else {
      setCollections([]);
    }
  }, [collectionsData]);
  const handleDestinationEdit = (
    collectionId: number,
    currentValue: string
  ) => {
    setEditingDestination({ id: collectionId, value: currentValue || '' });
  };

  const handleDestinationSave = async () => {
    if (!editingDestination) return;

    try {
      await apiRequest('PATCH', `/api/collections/${editingDestination.id}`, {
        sandwichDestination: editingDestination.value,
      });

      // Update local state
      setCollections(
        collections.map((collection) =>
          collection.id === editingDestination.id
            ? { ...collection, sandwichDestination: editingDestination.value }
            : collection
        )
      );

      setEditingDestination(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/collections'],
      });

      toast({
        title: 'Destination Updated',
        description: 'Sandwich destination has been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating destination:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update sandwich destination.',
        variant: 'destructive',
      });
    }
  };

  const handleDestinationCancel = () => {
    setEditingDestination(null);
  };

  if (!isVisible || !eventRequest) return null;

  const totals = collections.reduce(
    (acc, collection) => {
      acc.totalSandwiches += collection.sandwichCount || 0;
      return acc;
    },
    { totalSandwiches: 0 }
  );
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      style={{
        left: window.innerWidth > 768 ? 240 : 0, // 240px nav bar width on desktop
        width: window.innerWidth > 768 ? `calc(100vw - 240px)` : '100vw',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Collection Log for {eventRequest.organizationName}
              </h2>
              <p className="text-gray-600">
                {eventRequest.firstName} {eventRequest.lastName}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              data-testid="button-close-collection-log"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🥪</span>
                  <div>
                    <p className="text-sm text-gray-600">Total Sandwiches</p>
                    <p className="text-2xl font-bold text-brand-primary">
                      {totals.totalSandwiches.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-sm text-gray-600">Collection Days</p>
                    <p className="text-2xl font-bold text-brand-teal">
                      {collections.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="text-lg font-medium text-green-600">
                      {collections.length > 0 ? 'Active' : 'No Collections'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Collections List */}
          {collections.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Collection Records</h3>
              {collections.map((collection) => (
                <Card key={collection.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-brand-primary" />
                        <span className="font-medium">
                          {new Date(
                            collection.collectionDate
                          ).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-brand-primary text-white"
                        >
                          {collection.sandwichCount || 0} sandwiches
                        </Badge>
                      </div>

                      {/* Sandwich Types Breakdown */}
                      {collection.sandwichTypes && (
                        <div className="ml-8">
                          <p className="text-sm text-gray-600">
                            Types:{' '}
                            {getSandwichTypesSummary(collection).breakdown}
                          </p>
                        </div>
                      )}

                      {/* Destination with inline editing */}
                      <div className="ml-8 flex items-center space-x-2">
                        {editingDestination?.id === collection.id ? (
                          <SandwichDestinationTracker
                            value={editingDestination?.value || ''}
                            onChange={(value) =>
                              setEditingDestination((prev) =>
                                prev ? { ...prev, value } : null
                              )
                            }
                            onSave={handleDestinationSave}
                            onCancel={handleDestinationCancel}
                          />
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">
                              <strong>Destination:</strong>{' '}
                              {collection.sandwichDestination ||
                                'Not specified'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleDestinationEdit(
                                  collection.id,
                                  collection.sandwichDestination || ''
                                )
                              }
                              className="text-brand-primary hover:bg-brand-primary hover:text-white"
                              data-testid={`button-edit-destination-${collection.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {collection.notes && (
                        <div className="ml-8">
                          <p className="text-sm text-gray-600">
                            <strong>Notes:</strong> {collection.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                No collections recorded for this event yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 2023 Events Import Component
interface ImportEventsTabProps {}

const ImportEventsTab: React.FC<ImportEventsTabProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const [isFileValid, setIsFileValid] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Import 2023 events mutation
  const import2023EventsMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/import-events/import-2023-events'),
    onSuccess: (data: any) => {
      setImportResults(data);
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${data.imported || 0} events from 2023 (skipped ${data.duplicates || 0} duplicates)`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
    },
    onError: (error: any) => {
      setImportResults({
        error: error?.details || 'Failed to import 2023 events',
      });
      toast({
        title: 'Import Failed',
        description: error?.details || 'Failed to import 2023 events',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const isExcel =
        file.name.toLowerCase().endsWith('.xlsx') ||
        file.name.toLowerCase().endsWith('.xls') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel');

      if (isExcel) {
        setSelectedFile(file);
        setIsFileValid(true);
        setImportResults(null);
      } else {
        setSelectedFile(null);
        setIsFileValid(false);
        toast({
          title: 'Invalid File Type',
          description: 'Please select a valid Excel file (.xlsx or .xls)',
          variant: 'destructive',
        });
      }
    }
  };

  const handleImport = () => {
    if (!selectedFile || !isFileValid) {
      toast({
        title: 'No File Selected',
        description: 'Please select a valid Excel file to import',
        variant: 'destructive',
      });
      return;
    }

    import2023EventsMutation.mutate();
  };

  const resetImport = () => {
    setSelectedFile(null);
    setIsFileValid(false);
    setImportResults(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Import 2023 Events</h2>
          <p className="text-gray-600">
            Import historical event data from 2023 Excel files
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Data Import
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5" />
            2023 Events Import
          </CardTitle>
          <CardDescription>
            Upload a 2023 Events Excel file to import historical event data.
            This will add past events to the system for tracking and analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="excel-file-input"
                data-testid="input-excel-file"
              />
              <label
                htmlFor="excel-file-input"
                className="cursor-pointer space-y-2"
              >
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-lg font-medium">Select Excel File</p>
                  <p className="text-sm text-gray-600">
                    Choose a 2023 Events .xlsx or .xls file to import
                  </p>
                </div>
              </label>
            </div>

            {/* File Information */}
            {selectedFile && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      File Selected: {selectedFile.name}
                    </p>
                    <p className="text-sm text-green-600">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetImport}
                    className="ml-auto"
                    data-testid="button-reset-file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Import Button */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <p>• Only Excel files (.xlsx, .xls) are supported</p>
              <p>• Duplicate events will be automatically skipped</p>
              <p>• Import process may take several minutes for large files</p>
            </div>
            <Button
              onClick={handleImport}
              disabled={
                !selectedFile ||
                !isFileValid ||
                import2023EventsMutation.isPending
              }
              className="bg-brand-primary hover:bg-brand-primary/90"
              data-testid="button-import-events"
            >
              {import2023EventsMutation.isPending ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Events
                </>
              )}
            </Button>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="space-y-4">
              {importResults.error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-red-700">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Import Failed</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    {importResults.error}
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-700 mb-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Import Successful!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-green-600">
                        <strong>Events Imported:</strong>{' '}
                        {importResults.imported || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-600">
                        <strong>Duplicates Skipped:</strong>{' '}
                        {importResults.duplicates || 0}
                      </p>
                    </div>
                  </div>
                  {importResults.details && (
                    <p className="text-sm text-green-600 mt-2">
                      {importResults.details}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Additional Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">
              📋 Import Guidelines
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Ensure your Excel file contains 2023 event data in the
                expected format
              </li>
              <li>
                • The system will automatically detect and skip duplicate
                entries
              </li>
              <li>
                • Successfully imported events will appear in the Completed tab
              </li>
              <li>
                • Import status and counts will be displayed above after
                completion
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function EventRequestsManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'organization'>(
    'newest'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showWeeklyPlanningModal, setShowWeeklyPlanningModal] = useState(false);

  // Event details dialog states
  const [selectedEventRequest, setSelectedEventRequest] =
    useState<EventRequest | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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

  // Helper functions for inline editing
  const startEditing = (id: number, field: string, currentValue: string) => {
    setEditingScheduledId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');
  };

  const saveEdit = () => {
    if (editingScheduledId && editingField) {
      updateScheduledFieldMutation.mutate({
        id: editingScheduledId,
        field: editingField,
        value: editingValue,
      });
    }
  };

  const cancelEdit = () => {
    setEditingScheduledId(null);
    setEditingField(null);
    setEditingValue('');
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
      } else if (assignmentType === 'volunteer') {
        // Add to assignedVolunteerIds array
        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        const newVolunteers = [...currentVolunteers, personId];
        updateData.assignedVolunteerIds = newVolunteers;
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

  // Helper function to resolve user ID to name
  const resolveUserName = (userIdOrName: string | undefined): string => {
    if (!userIdOrName) return 'Not assigned';

    // If it looks like a user ID, try to resolve it
    if (userIdOrName.startsWith('user_') && userIdOrName.includes('_')) {
      const user = users.find((u) => u.id === userIdOrName);
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
    onSuccess: () => {
      toast({
        title: 'Event request updated',
        description: 'The event request has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
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
    onSuccess: () => {
      toast({
        title: 'Toolkit marked as sent',
        description: 'Event status updated to "In Process".',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
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
    onSuccess: () => {
      toast({
        title: 'Call scheduled',
        description: 'Call has been scheduled successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setShowScheduleCallDialog(false);
      setSelectedEventRequest(null);
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
    onSuccess: () => {
      toast({
        title: 'Field updated',
        description: 'Event field has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
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
        request.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort the filtered results
    filtered.sort((a: EventRequest, b: EventRequest) => {
      switch (sortBy) {
        case 'newest':
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case 'organization':
          return a.organizationName.localeCompare(b.organizationName);
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
      <div className="space-y-6 text-lg md:text-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Event Requests Management</h1>
            <p className="text-gray-600">
              Manage and track event requests from organizations
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowWeeklyPlanningModal(true)}
              variant="outline"
              className="flex items-center space-x-2"
              data-testid="button-weekly-planning"
            >
              <Calendar className="w-4 h-4" />
              <span>Weekly Planning</span>
            </Button>
            <Badge
              variant="secondary"
              className="bg-brand-primary text-white px-3 py-1 text-sm"
            >
              {eventRequests.length} Total Requests
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="new" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="new" className="relative">
              New ({statusCounts.new})
              {statusCounts.new > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="in_process">
              In Process ({statusCounts.in_process})
            </TabsTrigger>
            <TabsTrigger value="scheduled">
              Scheduled ({statusCounts.scheduled})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({statusCounts.completed})
            </TabsTrigger>
            <TabsTrigger value="declined">
              Declined ({statusCounts.declined})
            </TabsTrigger>
            <TabsTrigger value="import" className="bg-blue-50 border-blue-200">
              Import
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import">
            <ImportEventsTab />
          </TabsContent>

          {/* Status-based tabs (existing logic) */}
          {['new', 'in_process', 'scheduled', 'completed', 'declined'].map(
            (status) => (
              <TabsContent key={status} value={status} className="space-y-6">
                {/* Search and Filters for this specific status */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by organization, name, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-requests"
                    />
                  </div>
                  <Select
                    value={sortBy}
                    onValueChange={(value: any) => setSortBy(value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="organization">
                        Organization A-Z
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Requests List for this specific status */}
                <div className="space-y-4">
                  {(requestsByStatus[status] || [])
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
                          .includes(searchQuery.toLowerCase())
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
                        default:
                          return 0;
                      }
                    })
                    .map((request: EventRequest) => {
                      const StatusIcon = statusIcons[request.status];
                      const dateInfo = formatEventDate(
                        request.desiredEventDate || ''
                      );

                      return (
                        <Card
                          key={request.id}
                          className={`transition-all duration-200 hover:shadow-lg ${
                            statusColors[request.status]
                          }`}
                          data-testid={`card-event-request-${request.id}`}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-4">
                                {/* Organization Name - Most Prominent */}
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center space-x-3 flex-1">
                                    <StatusIcon className="w-7 h-7 text-brand-primary flex-shrink-0" />
                                    <h2 className="text-2xl font-bold text-brand-primary leading-tight">
                                      {request.organizationName}
                                    </h2>
                                  </div>
                                  <Badge
                                    className={`${statusColors[request.status]} text-sm font-bold px-4 py-2 rounded-full uppercase tracking-wide flex-shrink-0 ml-3`}
                                  >
                                    {
                                      statusOptions.find(
                                        (s) => s.value === request.status
                                      )?.label
                                    }
                                  </Badge>
                                </div>

                                {/* Event Date - Secondary Prominence */}
                                {request.desiredEventDate && (
                                  <div className="flex items-center space-x-3 mb-4 bg-gray-50 p-3 rounded-lg border-l-4 border-brand-primary">
                                    <Calendar className="w-5 h-5 text-brand-primary" />
                                    <div>
                                      <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                                        Event Date
                                      </span>
                                      <div
                                        className={`text-lg font-semibold ${dateInfo.className}`}
                                      >
                                        {dateInfo.text}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Contact Information - Grouped for In Process, inline for others */}
                                {request.status === 'in_process' ? (
                                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 max-w-md">
                                    <h4 className="text-xs font-bold text-blue-900 mb-3 flex items-center uppercase tracking-wider">
                                      <User className="w-4 h-4 mr-2 text-blue-600" />
                                      Contact Information
                                    </h4>
                                    <div className="space-y-3">
                                      <div className="flex items-center space-x-3">
                                        <User className="w-4 h-4 text-blue-600" />
                                        <span className="font-bold text-blue-900 text-base">
                                          {request.firstName} {request.lastName}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-3">
                                        <Mail className="w-4 h-4 text-blue-600" />
                                        <span className="font-medium text-blue-700 text-sm">
                                          {request.email}
                                        </span>
                                      </div>
                                      {request.phone && (
                                        <div className="flex items-center space-x-3">
                                          <Phone className="w-4 h-4 text-blue-600" />
                                          <span className="font-medium text-blue-700 text-sm">
                                            {request.phone}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  // Compact Basic Info Grid
                                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {/* Contact Info */}
                                      <div className="space-y-2">
                                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                          Contact Information
                                        </div>
                                        <div className="space-y-1">
                                          <div className="flex items-center space-x-2">
                                            <User className="w-4 h-4 text-brand-teal flex-shrink-0" />
                                            <span className="font-bold text-brand-primary text-base">
                                              {request.firstName} {request.lastName}
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                            <span className="font-medium text-gray-700 text-sm truncate">
                                              {request.email}
                                            </span>
                                          </div>
                                          {request.phone && (
                                            <div className="flex items-center space-x-2">
                                              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                              <span className="font-medium text-gray-700 text-sm">
                                                {request.phone}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Event Date */}
                                      <div className="space-y-2">
                                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                          Event Date
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                          <span className="font-bold text-gray-900 text-base">
                                            {request.desiredEventDate
                                              ? formatEventDate(request.desiredEventDate).text
                                              : 'Not specified'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Sandwich Count */}
                                      {request.estimatedSandwichCount && (
                                        <div className="space-y-2">
                                          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                            {request.status === 'completed' ? 'Estimated' : 'Requested'}
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xl">🥪</span>
                                            <span className="font-bold text-brand-orange text-lg">
                                              {request.estimatedSandwichCount} sandwiches
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

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
                                  <div className="mt-3 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                      
                                      {/* Column 1: Schedule & Location */}
                                      <div className="space-y-3">
                                        <h4 className="text-base font-semibold text-brand-navy flex items-center border-b border-gray-200 pb-2">
                                          <Calendar className="w-4 h-4 mr-2 text-brand-teal" />
                                          Schedule & Location
                                        </h4>
                                        
                                        {/* Times in compact rows */}
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-700 text-base font-medium">Start:</span>
                                            <div className="flex items-center space-x-1">
                                              <span className="font-semibold text-gray-900 text-base">
                                                {request.eventStartTime ? formatTime12Hour(request.eventStartTime) : 'Not set'}
                                              </span>
                                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                <Button size="sm" variant="ghost" onClick={(e) => {
                                                  e.stopPropagation();
                                                  startEditing(request.id, 'eventStartTime', request.eventStartTime || '');
                                                }} className="h-5 w-5 p-0">
                                                  <Edit className="w-3 h-3" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-700 text-base font-medium">End:</span>
                                            <div className="flex items-center space-x-1">
                                              <span className="font-semibold text-gray-900 text-base">
                                                {request.eventEndTime ? formatTime12Hour(request.eventEndTime) : 'Not set'}
                                              </span>
                                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                <Button size="sm" variant="ghost" onClick={(e) => {
                                                  e.stopPropagation();
                                                  startEditing(request.id, 'eventEndTime', request.eventEndTime || '');
                                                }} className="h-5 w-5 p-0">
                                                  <Edit className="w-3 h-3" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-700 text-base font-medium">Pickup:</span>
                                            <div className="flex items-center space-x-1">
                                              <span className="font-semibold text-gray-900 text-base">
                                                {request.pickupTime ? formatTime12Hour(request.pickupTime) : 'Not set'}
                                              </span>
                                              {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                <Button size="sm" variant="ghost" onClick={(e) => {
                                                  e.stopPropagation();
                                                  startEditing(request.id, 'pickupTime', request.pickupTime || '');
                                                }} className="h-5 w-5 p-0">
                                                  <Edit className="w-3 h-3" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Address */}
                                        <div className="pt-2 border-t border-gray-100">
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-1 sm:space-y-0">
                                            <span className="text-gray-700 text-base font-medium flex-shrink-0">Address:</span>
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
                                                  <span className="font-medium text-sm sm:text-right sm:max-w-[200px] break-words">
                                                    {request.eventAddress ? (
                                                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.eventAddress)}`}
                                                         target="_blank" rel="noopener noreferrer"
                                                         className="text-blue-600 hover:text-blue-800 underline">
                                                        {request.eventAddress}
                                                      </a>
                                                    ) : 'Not specified'}
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
                                      <div className="space-y-3">
                                        <h4 className="text-base font-semibold text-brand-navy flex items-center border-b border-gray-200 pb-2">
                                          <span className="mr-2">🥪</span>
                                          Sandwich Details
                                        </h4>
                                        
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-700 text-base font-medium">Types:</span>
                                            <span className="font-semibold text-gray-900 text-base text-right max-w-[150px] truncate">
                                              {request.sandwichTypes ? getSandwichTypesSummary(request).breakdown : 'Not specified'}
                                            </span>
                                          </div>
                                          
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-700 text-base font-medium">Refrigeration:</span>
                                            <span className="font-semibold text-gray-900 text-base">
                                              {request.hasRefrigeration === true ? 'Yes' : request.hasRefrigeration === false ? 'No' : 'Unknown'}
                                            </span>
                                          </div>
                                          
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-1 sm:space-y-0 pt-2 border-t border-gray-100">
                                            <span className="text-gray-700 text-base font-medium flex-shrink-0">Destination:</span>
                                            <div className="flex items-start space-x-1 sm:flex-1 sm:justify-end">
                                              {editingScheduledId === request.id && editingField === 'sandwichDestination' ? (
                                                <div className="flex items-center space-x-2 w-full">
                                                  <Input
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    className="text-sm"
                                                    placeholder="Enter destination"
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
                                                  <span className="font-medium text-sm sm:text-right sm:max-w-[150px] break-words">
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
                                      <div className="space-y-3">
                                        <h4 className="text-base font-semibold text-brand-navy flex items-center border-b border-gray-200 pb-2">
                                          <Users className="w-4 h-4 mr-2 text-brand-primary" />
                                          Staffing
                                        </h4>
                                        
                                        <div className="space-y-2">
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                                            <span className="text-gray-700 text-base font-medium flex-shrink-0">TSP Contact:</span>
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
                                                  <span className="font-semibold text-gray-900 text-base break-words">
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
                                          
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                                            <span className="text-gray-700 text-base font-medium">Drivers:</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold text-gray-900 text-base">{request.driverCount || 0}</span>
                                              <Button size="sm" variant="outline" className="text-sm px-3 py-1" onClick={(e) => {
                                                e.stopPropagation();
                                                openAssignmentDialog(request.id, 'driver');
                                              }}>
                                                Assign
                                              </Button>
                                            </div>
                                          </div>
                                          
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                                            <span className="text-gray-700 text-base font-medium">Speakers:</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold text-gray-900 text-base">{request.speakerCount || 0}</span>
                                              <Button size="sm" variant="outline" className="text-sm px-3 py-1" onClick={(e) => {
                                                e.stopPropagation();
                                                openAssignmentDialog(request.id, 'speaker');
                                              }}>
                                                Assign
                                              </Button>
                                            </div>
                                          </div>
                                          
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                                            <span className="text-gray-700 text-base font-medium">Volunteers:</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold text-gray-900 text-base">{request.volunteerCount || 0}</span>
                                              <Button size="sm" variant="outline" className="text-sm px-3 py-1" onClick={(e) => {
                                                e.stopPropagation();
                                                openAssignmentDialog(request.id, 'volunteer');
                                              }}>
                                                Assign
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Show assigned people if any */}
                                        {((request.driverAssignments?.length ?? 0) > 0 || (request.speakerAssignments?.length ?? 0) > 0 || (request.volunteerAssignments?.length ?? 0) > 0) && (
                                          <div className="pt-2 border-t border-gray-100">
                                            <div className="text-xs text-gray-600 mb-1">Assigned:</div>
                                            <div className="space-y-1 text-xs">
                                              {request.driverAssignments?.map((driver, i) => (
                                                <div key={i} className="bg-brand-primary/10 text-brand-primary px-2 py-1 rounded text-xs font-medium">
                                                  🚗 {driver}
                                                </div>
                                              ))}
                                              {request.speakerAssignments?.map((speaker, i) => (
                                                <div key={i} className="bg-brand-primary/10 text-brand-primary px-2 py-1 rounded text-xs font-medium">
                                                  🎤 {speaker}
                                                </div>
                                              ))}
                                              {request.volunteerAssignments?.map((volunteer, i) => (
                                                <div key={i} className="bg-brand-primary/10 text-brand-primary px-2 py-1 rounded text-xs font-medium">
                                                  👥 {volunteer}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Additional Requirements & Notes - Full Width */}
                                    {(request.additionalRequirements || request.planningNotes) && (
                                      <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
                                        {request.additionalRequirements && (
                                          <div>
                                            <div className="text-base font-semibold text-brand-navy mb-1 flex items-center">
                                              <AlertTriangle className="w-4 h-4 mr-1 text-brand-orange" />
                                              Additional Requirements
                                            </div>
                                            <p className="text-sm text-gray-700 bg-brand-orange/10 p-2 rounded border-l-4 border-brand-orange/30">
                                              {request.additionalRequirements}
                                            </p>
                                          </div>
                                        )}
                                        
                                        <div>
                                          <div className="text-base font-semibold text-brand-navy mb-1 flex items-center justify-between">
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
                                          {editingScheduledId === request.id && editingField === 'planningNotes' ? (
                                            <div className="space-y-2">
                                              <Textarea
                                                value={editingValue}
                                                onChange={(e) => setEditingValue(e.target.value)}
                                                className="text-sm"
                                                placeholder="Enter planning notes"
                                                rows={2}
                                              />
                                              <div className="flex space-x-2">
                                                <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                                  <CheckCircle className="w-4 h-4 mr-1" />
                                                  Save
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                                  <X className="w-4 h-4 mr-1" />
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <p className="text-sm text-gray-700 bg-brand-primary/5 p-2 rounded border-l-4 border-brand-primary/20">
                                              {request.planningNotes || 'No planning notes'}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {request.message && (
                                  <div className="mt-4 p-3 bg-gray-50 border-l-4 border-brand-primary rounded-r-lg">
                                    <p className="text-base text-brand-primary line-clamp-2 font-medium">
                                      {request.message}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>
            )
          )}

          {/* Import tab */}
          <TabsContent value="import" className="space-y-6">
            <ImportEventsTab />
          </TabsContent>
        </Tabs>

        {/* Event Details Modal */}
        {showEventDetails && selectedEventRequest && (
          <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      statusColors[selectedEventRequest.status]
                    }`}
                  />
                  <span>{selectedEventRequest.organizationName}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {!isEditing ? (
                  <>
                    {/* Read-only view content here */}
                  </>
                ) : (
                  <>
                    {/* Edit mode content here */}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Other modals and dialogs */}
      </div>
    </TooltipProvider>
  );
};
