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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import type { EventRequest } from '@shared/schema';
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


const statusColors = {
  new: 'bg-gradient-to-r from-teal-50 to-cyan-100 text-brand-primary border border-teal-200',
  in_process:
    'bg-gradient-to-r from-teal-50 to-cyan-100 text-brand-teal border border-teal-200',
  scheduled:
    'bg-white border border-slate-200 shadow-sm',
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
              <div className="flex space-x-2">
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
                
                {eventRequest?.phone && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const phoneNumber = eventRequest.phone;
                      
                      // Check if on mobile device
                      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                      
                      if (isMobile) {
                        // On mobile, open the dialer
                        window.location.href = `tel:${phoneNumber}`;
                      } else {
                        // On desktop, copy to clipboard
                        if (phoneNumber) {
                          navigator.clipboard.writeText(phoneNumber)
                            .then(() => {
                              window.alert(`Phone number copied!\n${phoneNumber} has been copied to your clipboard.`);
                            })
                            .catch(() => {
                              window.alert(`Failed to copy phone number.\nPlease copy manually: ${phoneNumber}`);
                            });
                        } else {
                          window.alert('No phone number available to copy.');
                        }
                      }
                    }}
                    className="flex items-center space-x-2"
                    data-testid="button-call-contact"
                    title={eventRequest.phone}
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call Contact</span>
                  </Button>
                )}
              </div>

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
              <h3 className="text-sm font-medium">Send Toolkit Email</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailComposer(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <EventEmailComposer
              eventRequest={{
                ...eventRequest,
                phone: eventRequest.phone || undefined,
              }}
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
      sandwichTypes: [...prev.sandwichTypes, { type: 'turkey', quantity: 0 }]
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
              <div className="p-4 border-t bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-sm text-gray-600">
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
                  <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-300 rounded">
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
                            <SelectItem value="turkey">Turkey</SelectItem>
                            <SelectItem value="ham">Ham</SelectItem>
                            <SelectItem value="deli">Deli (Generic)</SelectItem>
                            <SelectItem value="pbj">PB&J</SelectItem>
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
                    <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
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
            <Phone className="w-5 h-5 text-blue-600" />
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="font-medium text-blue-900 mb-2">Contact Details</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>{eventRequest.email}</span>
              </div>
              {eventRequest.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-blue-600" />
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

// Follow-up Dialog Component
interface FollowUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onFollowUpCompleted: (notes: string) => void;
  isLoading: boolean;
  followUpType: '1-day' | '1-month';
  notes: string;
  setNotes: (notes: string) => void;
}

const FollowUpDialog: React.FC<FollowUpDialogProps> = ({
  isOpen,
  onClose,
  eventRequest,
  onFollowUpCompleted,
  isLoading,
  followUpType,
  notes,
  setNotes,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFollowUpCompleted(notes);
  };

  if (!eventRequest) return null;

  const isOneDay = followUpType === '1-day';
  const title = isOneDay ? '1-Day Follow-up' : '1-Month Follow-up';
  const description = isOneDay 
    ? 'Record follow-up communication one day after the event'
    : 'Record follow-up communication one month after the event';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            {description} with{' '}
            <strong>
              {eventRequest.firstName} {eventRequest.lastName}
            </strong>{' '}
            at <strong>{eventRequest.organizationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h4 className="font-medium text-gray-900 mb-2">Event Details</h4>
            <div className="space-y-1 text-sm">
                              <div><strong>Event Date:</strong> {
                                eventRequest.desiredEventDate ? 
                                  (eventRequest.desiredEventDate instanceof Date ? 
                                    eventRequest.desiredEventDate.toLocaleDateString() : 
                                    eventRequest.desiredEventDate.toString()) : 
                                  'Not specified'
                              }</div>
              <div><strong>Address:</strong> {eventRequest.eventAddress || 'Not specified'}</div>
              <div><strong>Estimated Sandwiches:</strong> {eventRequest.estimatedSandwichCount || 'Not specified'}</div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="font-medium text-blue-900 mb-2">Contact Information</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>{eventRequest.email}</span>
              </div>
              {eventRequest.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-blue-600" />
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

          {/* Follow-up Notes */}
          <div className="space-y-2">
            <Label htmlFor="followup-notes">Follow-up Notes</Label>
            <Textarea
              id="followup-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Record notes from your ${followUpType} follow-up communication...`}
              className="min-h-[120px]"
              required
            />
          </div>

          {/* Information */}
          <div className={`${isOneDay ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'} border rounded-lg p-3`}>
            <h4 className={`font-medium ${isOneDay ? 'text-orange-900' : 'text-green-900'} mb-2`}>
              {title} Guidelines:
            </h4>
            <ul className={`text-sm ${isOneDay ? 'text-orange-800' : 'text-green-800'} space-y-1`}>
              {isOneDay ? (
                <>
                  <li>• Ask how the event went and if there were any issues</li>
                  <li>• Gather feedback on sandwich quality and quantity</li>
                  <li>• Note any suggestions for future events</li>
                </>
              ) : (
                <>
                  <li>• Check if they're planning any future events</li>
                  <li>• Ask about their overall experience with TSP</li>
                  <li>• Gather feedback for program improvement</li>
                </>
              )}
            </ul>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!notes.trim() || isLoading}
              className={`text-white ${isOneDay ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
              data-testid={`button-confirm-followup-${followUpType}`}
            >
              {isLoading ? 'Saving...' : `Complete ${title}`}
            </Button>
          </div>
        </form>
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
                    <p className="text-sm font-medium text-green-600">
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
              <h3 className="text-sm font-semibold">Collection Records</h3>
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
                  <p className="text-sm font-medium">Select Excel File</p>
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
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'organization' | 'event_date'>(
    'newest'
  );
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
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
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
            <p className="text-gray-600">
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

        {/* Tabs */}
        <Tabs defaultValue="new" className="space-y-4">
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
              <TabsContent key={status} value={status} className="space-y-4">
                {/* Search and Filters for this specific status */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by organization, name, email, date, or location..."
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
                      {status === 'scheduled' && (
                        <SelectItem value="event_date">
                          Event Date
                        </SelectItem>
                      )}
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
                          // Sort by desired event date for scheduled events
                          const dateA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
                          const dateB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
                          return dateA - dateB; // Earliest dates first
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
                          <CardContent className="p-0">
                            {/* Brand accent for scheduled events */}
                            {request.status === 'scheduled' && (
                              <div className="h-1 bg-[#236383] rounded-t-md"></div>
                            )}
                            <div className="p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-4">
                                {/* Organization Name - Most Prominent */}
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3">
                                    <StatusIcon className="w-7 h-7 text-brand-primary flex-shrink-0" />
                                    <h2 className="text-2xl font-bold text-brand-primary leading-tight">
                                      {request.organizationName}
                                    </h2>
                                    </div>
                                    {/* Request Submitted Date */}
                                    <div className="flex items-center space-x-2 mt-1 ml-10">
                                      <span className="text-sm text-gray-500">
                                        Submitted: {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                  <Badge
                                    className={`${
                                      request.status === 'scheduled' 
                                        ? 'bg-[#E7F1F5] text-[#236383] border border-[#B8D4DE] font-semibold' 
                                        : statusColors[request.status]
                                    } text-sm font-bold px-4 py-2 rounded-full uppercase tracking-wide flex-shrink-0 ml-3`}
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
                                      <span className="text-sm font-medium text-gray-600">
                                        Event Date
                                      </span>
                                      <div
                                        className={`text-base font-semibold ${dateInfo.className}`}
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
                                        <span className="font-bold text-blue-900 text-base md:text-lg">
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
                                      {/* Contact Info - Grouped */}
                                      <div className="md:col-span-2 bg-brand-teal/5 border border-brand-teal/20 rounded-lg p-3">
                                        <div className="text-sm font-semibold text-brand-teal mb-2">
                                          Contact Information
                                        </div>
                                        <div className="space-y-2">
                                          <div className="flex items-center space-x-3">
                                            <User className="w-4 h-4 text-brand-teal flex-shrink-0" />
                                            <span className="font-bold text-brand-primary text-base">
                                              {request.firstName} {request.lastName}
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-3">
                                            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                            <span className="font-medium text-gray-700 text-base truncate">
                                              {request.email}
                                            </span>
                                          </div>
                                          {request.phone && (
                                            <div className="flex items-center space-x-3">
                                              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                              <span className="font-medium text-gray-700 text-base">
                                                {request.phone}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Sandwich Count - Right side */}
                                      {request.estimatedSandwichCount && (
                                        <div className="space-y-2 md:col-start-3 flex flex-col items-end text-right">
                                          <div className="text-sm font-semibold text-brand-orange mb-1">
                                            {request.status === 'completed' ? 'Estimated' : 
                                             request.status === 'scheduled' ? 'Planned' : 'Requested'}
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-lg">🥪</span>
                                            <span className="font-bold text-brand-orange text-lg">
                                              {request.estimatedSandwichCount} sandwiches
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Staffing Need Badges - For Scheduled/In Process Events */}
                                {(request.status === 'scheduled' || request.status === 'in_process') && (
                                  (() => {
                                    const staffingBadges = [];
                                    
                                    // Check drivers needed
                                    const driversNeeded = request.driversNeeded || 0;
                                    const assignedDrivers = request.assignedDriverIds?.length || 0;
                                    if (driversNeeded > assignedDrivers) {
                                      const driversShort = driversNeeded - assignedDrivers;
                                      staffingBadges.push({
                                        key: 'drivers',
                                        icon: '🚗',
                                        text: `${driversShort} driver${driversShort > 1 ? 's' : ''} needed`,
                                        className: 'bg-red-100 text-red-800 border border-red-300'
                                      });
                                    }

                                    // Check speakers needed
                                    const speakersNeeded = request.speakersNeeded || 0;
                                    const assignedSpeakers = request.assignedSpeakerIds?.length || 0;
                                    if (speakersNeeded > assignedSpeakers) {
                                      const speakersShort = speakersNeeded - assignedSpeakers;
                                      staffingBadges.push({
                                        key: 'speakers',
                                        icon: '🎤',
                                        text: `${speakersShort} speaker${speakersShort > 1 ? 's' : ''} needed`,
                                        className: 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                      });
                                    }

                                    // Check volunteers needed
                                    if (request.volunteersNeeded && (!request.assignedVolunteerIds || request.assignedVolunteerIds.length === 0)) {
                                      staffingBadges.push({
                                        key: 'volunteers',
                                        icon: '👥',
                                        text: 'Volunteers needed',
                                        className: 'bg-blue-100 text-blue-800 border border-blue-300'
                                      });
                                    }

                                    // Check van driver needed
                                    if (request.vanDriverNeeded && !request.assignedVanDriverId) {
                                      staffingBadges.push({
                                        key: 'van',
                                        icon: '🚐',
                                        text: 'Van driver needed',
                                        className: 'bg-purple-100 text-purple-800 border border-purple-300'
                                      });
                                    }

                                    return staffingBadges.length > 0 ? (
                                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                        <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center">
                                          <AlertTriangle className="w-4 h-4 mr-2" />
                                          Staffing Needs
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {staffingBadges.map((badge) => (
                                            <Badge
                                              key={badge.key}
                                              className={`${badge.className} text-xs font-medium px-2 py-1 flex items-center space-x-1`}
                                              data-testid={`badge-${badge.key}-needed`}
                                            >
                                              <span>{badge.icon}</span>
                                              <span>{badge.text}</span>
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null;
                                  })()
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
                                      <div className="space-y-2 bg-[#f0f8fa] p-3 rounded-lg border border-[#236383]/20">
                                        <h4 className="text-base font-semibold flex items-center border-b border-gray-200 pb-2" style={{color: '#1A2332'}}>
                                          <Calendar className="w-4 h-4 mr-2 text-brand-teal" />
                                          Schedule & Location
                                        </h4>
                                        
                                        {/* Times in compact rows */}
                                        <div className="space-y-1">
                                          {/* Start and End times with proper layout */}
                                          <div className="space-y-2">
                                            {/* Start time */}
                                            <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                                              <span className="text-sm font-medium text-muted-foreground min-w-16">Start:</span>
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
                                                  <span className="text-base font-medium text-slate-900 dark:text-slate-100">
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
                                              <span className="text-sm font-medium text-muted-foreground min-w-16">End:</span>
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
                                                  <span className="text-base font-medium text-slate-900 dark:text-slate-100">
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
                                            <span className="text-sm font-medium text-muted-foreground min-w-16">Pickup:</span>
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
                                                <span className="text-base font-medium text-slate-900 dark:text-slate-100">
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
                                        <div className="pt-2 border-t border-gray-100">
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-1 sm:space-y-0">
                                            <span className="text-[#FBAD3F] text-base font-semibold flex-shrink-0">Address:</span>
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
                                                         className="text-blue-600 hover:text-blue-800 underline">
                                                        {request.eventAddress}
                                                      </a>
                                                    ) : <span className="text-gray-500">Not specified</span>}
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
                                      <div className="space-y-2 bg-[#fff8f0] p-3 rounded-lg border border-[#FBAD3F]/20">
                                        <h4 className="text-base font-semibold flex items-center border-b border-gray-200 pb-2" style={{color: '#1A2332'}}>
                                          <span className="mr-2 text-base">🥪</span>
                                          Sandwich Details
                                        </h4>
                                        
                                        <div className="space-y-2">
                                          {/* Total Sandwiches Count */}
                                          <div className="flex justify-between items-center">
                                            <span className="text-[#FBAD3F] text-base font-semibold">Total:</span>
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
                                                <span className="font-bold text-[#1A2332] text-lg">
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
                                                <span className="font-bold text-[#1A2332] text-sm">
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
                                          
                                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-1 sm:space-y-0 pt-2 border-t border-gray-100">
                                            <span className="text-[#FBAD3F] text-base font-semibold flex-shrink-0">Destination:</span>
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
                                      <div className="space-y-2 bg-[#f0f6f8] p-3 rounded-lg border border-[#007E8C]/20">
                                        <h4 className="text-base font-semibold flex items-center border-b border-gray-200 pb-2" style={{color: '#1A2332'}}>
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
                                          
                                          {/* Drivers Section */}
                                          <div className="space-y-2 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Truck className="w-4 h-4 text-[#007E8C]" />
                                                <span className="text-[#007E8C] text-base font-semibold">Drivers</span>
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
                                                    <div className="text-[#1A2332] font-bold text-lg">
                                                      <span className={assignedCount >= neededCount ? "text-green-600" : "text-[#007E8C]"}>
                                                        {assignedCount}
                                                      </span>
                                                      <span className="text-gray-500 mx-1">of</span>
                                                      <span className="text-[#1A2332]">{neededCount}</span>
                                                      <span className="text-gray-600 text-sm ml-1">assigned</span>
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
                                                  className="bg-[#47B3CB] hover:bg-[#007E8C] text-white text-xs px-3 py-1"
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
                                          <div className="space-y-2 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-[#FBAD3F] rounded-lg">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center space-x-2">
                                                <Megaphone className="w-4 h-4 text-[#FBAD3F]" />
                                                <span className="text-[#FBAD3F] text-base font-semibold">Speakers</span>
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
                                                      <span className="text-gray-500 mx-1">of</span>
                                                      <span className="text-[#1A2332]">{neededCount}</span>
                                                      <span className="text-gray-600 text-sm ml-1">assigned</span>
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
                                          </div>
                                          
                                          {/* Volunteers Section */}
                                          <div className="space-y-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg">
                                            <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Users className="w-4 h-4 text-blue-600" />
                                                <span className="text-blue-600 text-base font-semibold">Volunteers</span>
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
                                                      <div className="text-[#1A2332] font-bold text-lg">
                                                        <span className="text-blue-600">{assignedCount}</span>
                                                        <span className="text-gray-600 text-sm ml-1">volunteers assigned</span>
                                                      </div>
                                                    );
                                                  })()
                                                ) : (
                                                  <div className="text-gray-500 font-medium text-base">
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
                                                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1"
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
                                                    className="text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white text-xs px-3 py-1" 
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
                                          </div>
                                        </div>
                                        
                                        {/* Show assigned people if any */}
                                        {(() => {
                                          const assignedDrivers = request.assignedDriverIds || [];
                                          const assignedSpeakers = Object.keys(request.speakerDetails || {});
                                          const assignedVolunteers = request.assignedVolunteerIds || [];
                                          const hasAssignments = assignedDrivers.length > 0 || assignedSpeakers.length > 0 || assignedVolunteers.length > 0;
                                          
                                          if (!hasAssignments) return null;
                                          
                                          return (
                                            <div className="pt-2 border-t border-gray-100">
                                              <div className="text-xs text-gray-600 mb-1">Assigned:</div>
                                              <div className="space-y-1 text-xs">
                                                {/* Drivers */}
                                                {assignedDrivers.map((driverId, i) => {
                                                  const driverDetails = request.driverDetails?.[driverId];
                                                  const driverName = driverDetails?.name || resolveUserName(driverId);
                                                  return (
                                                    <div key={`driver-${i}`} className="flex items-center justify-between bg-brand-primary/10 text-brand-primary px-2 py-1 rounded text-xs font-medium">
                                                      <span>🚗 {driverName}</span>
                                                      {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveAssignment(driverId, 'driver', request.id);
                                                          }}
                                                          className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                                                        >
                                                          <X className="w-3 h-3" />
                                                        </Button>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                                
                                                {/* Speakers */}
                                                {assignedSpeakers.map((speakerId, i) => {
                                                  const speakerDetails = request.speakerDetails?.[speakerId];
                                                  const speakerName = speakerDetails?.name || resolveUserName(speakerId);
                                                  return (
                                                    <div key={`speaker-${i}`} className="flex items-center justify-between bg-brand-primary/10 text-brand-primary px-2 py-1 rounded text-xs font-medium">
                                                      <span>🎤 {speakerName}</span>
                                                      {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveAssignment(speakerId, 'speaker', request.id);
                                                          }}
                                                          className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                                                        >
                                                          <X className="w-3 h-3" />
                                                        </Button>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                                
                                                {/* Volunteers */}
                                                {assignedVolunteers.map((volunteerId, i) => {
                                                  const volunteerDetails = request.volunteerDetails?.[volunteerId];
                                                  const volunteerName = volunteerDetails?.name || resolveUserName(volunteerId);
                                                  return (
                                                    <div key={`volunteer-${i}`} className="flex items-center justify-between bg-brand-primary/10 text-brand-primary px-2 py-1 rounded text-xs font-medium">
                                                      <span>👥 {volunteerName}</span>
                                                      {hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveAssignment(volunteerId, 'volunteer', request.id);
                                                          }}
                                                          className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                                                        >
                                                          <X className="w-3 h-3" />
                                                        </Button>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    
                                    {/* Additional Requirements & Notes - Full Width */}
                                    {(request.additionalRequirements || request.planningNotes) && (
                                      <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
                                        {request.additionalRequirements && (
                                          <div>
                                            <div className="text-base font-semibold text-blue-900 mb-1 flex items-center">
                                              <AlertTriangle className="w-4 h-4 mr-1 text-brand-orange" />
                                              Additional Requirements
                                            </div>
                                            <p className="text-sm text-gray-700 bg-brand-orange/10 p-2 rounded border-l-4 border-brand-orange/30">
                                              {request.additionalRequirements}
                                            </p>
                                          </div>
                                        )}
                                        
                                        <div>
                                          <div className="text-base font-semibold text-blue-900 mb-1 flex items-center justify-between">
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
                                          <p className="text-sm text-gray-700 bg-brand-primary/5 p-2 rounded border-l-4 border-brand-primary/20">
                                            {request.planningNotes || 'No planning notes'}
                                          </p>
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

                                {/* Action Buttons for New Status */}
                                {request.status === 'new' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventRequest(request);
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
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-gray-200">
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
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-gray-200">
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

                                {/* Action Buttons for Completed Status */}
                                {request.status === 'completed' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-gray-200">
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
                                  </div>
                                )}

                                {/* Action Buttons for Declined Status */}
                                {request.status === 'declined' && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT) && (
                                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-gray-200">
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
                              </div>
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
                          <h3 className="text-base font-medium text-gray-900">Contact Information</h3>
                          <div className="mt-2 space-y-2">
                            <p><span className="font-medium">Name:</span> {selectedEventRequest.firstName} {selectedEventRequest.lastName}</p>
                            <p><span className="font-medium">Email:</span> {selectedEventRequest.email}</p>
                            <p><span className="font-medium">Phone:</span> {selectedEventRequest.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-base font-medium text-gray-900">Event Details</h3>
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
                          <h3 className="text-base font-medium text-gray-900">Event Logistics</h3>
                          <div className="mt-2 space-y-2">
                            <p><span className="font-medium">Start Time:</span> {selectedEventRequest.eventStartTime || 'Not set'}</p>
                            <p><span className="font-medium">End Time:</span> {selectedEventRequest.eventEndTime || 'Not set'}</p>
                            <p><span className="font-medium">Pickup Time:</span> {selectedEventRequest.pickupTime || 'Not set'}</p>
                            <p><span className="font-medium">Address:</span> {selectedEventRequest.eventAddress || 'Not set'}</p>
                            <p><span className="font-medium">Destination:</span> {selectedEventRequest.sandwichDestination || 'Not set'}</p>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-base font-medium text-gray-900">Additional Details</h3>
                          <div className="mt-2 space-y-2">
                            <p><span className="font-medium">TSP Contact:</span> {selectedEventRequest.tspContact || 'Not assigned'}</p>
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
                        <h3 className="text-base font-medium text-gray-900">Planning Notes</h3>
                        <p className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded">{selectedEventRequest.planningNotes}</p>
                      </div>
                    )}
                    {selectedEventRequest.message && (
                      <div>
                        <h3 className="text-base font-medium text-gray-900">Original Message</h3>
                        <p className="mt-2 text-sm text-gray-700 bg-blue-50 p-3 rounded border-l-4 border-blue-400">{selectedEventRequest.message}</p>
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
                            <h3 className="text-base font-medium text-gray-900 mb-3">Contact Information</h3>
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
                            <h3 className="text-base font-medium text-gray-900 mb-3">Event Details</h3>
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
                            <h3 className="text-base font-medium text-gray-900 mb-3">Event Logistics</h3>
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
                            <h3 className="text-base font-medium text-gray-900 mb-3">Additional Details</h3>
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
                                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
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
                                      <p className="text-sm text-gray-600">
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
                                        <div className="text-center py-4 text-gray-500 text-sm">
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
                                          <div className="mt-3 p-2 bg-white rounded border-l-4 border-blue-200">
                                            <span className="text-sm font-medium">
                                              Total: {modalSandwichTypes.reduce((sum, item) => sum + item.quantity, 0)} sandwiches
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Summary */}
                                  <div className="text-xs text-gray-600 bg-white p-2 rounded border-l-4 border-green-200">
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
                  <UserPlus className="w-5 h-5 text-blue-600" />
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
                    <h4 className="font-semibold text-gray-900">
                      {assignmentType === 'driver' ? 'Available Drivers' : 
                       assignmentType === 'speaker' ? 'Available Hosts' : 
                       'Available Volunteers'}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {assignmentType === 'driver' ? drivers.length : 
                       assignmentType === 'speaker' ? hosts.length : 
                       volunteers.length} in database
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {(assignmentType === 'driver' ? drivers : 
                      assignmentType === 'speaker' ? hosts : 
                      volunteers).map((person: any) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {person.firstName} {person.lastName}
                          </div>
                          {person.email && (
                            <div className="text-sm text-gray-600">{person.email}</div>
                          )}
                          {person.phone && (
                            <div className="text-sm text-gray-600">{person.phone}</div>
                          )}
                          {assignmentType === 'driver' && person.vanCapable && (
                            <Badge className="text-xs bg-purple-100 text-purple-800 mt-1">
                              Van Capable
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            const personName = `${person.firstName} ${person.lastName}`;
                            handleAssignment(person.id, personName);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Assign
                        </Button>
                      </div>
                    ))}
                    
                    {(assignmentType === 'driver' ? drivers.length : 
                      assignmentType === 'speaker' ? hosts.length : 
                      volunteers.length) === 0 && (
                      <div className="col-span-2 text-center py-4 text-gray-500">
                        No {assignmentType}s found in database
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Entry Section */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
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
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
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
                      <h4 className="font-semibold text-gray-900">Currently Assigned</h4>
                      <div className="space-y-2">
                        {assignedPeople.map((personId, index) => {
                          // Try to resolve name from different sources
                          let personName = 'Unknown';
                          let personDetails = null;
                          
                          if (assignmentType === 'driver') {
                            const driverDetails = eventRequest.driverDetails?.[personId];
                            if (driverDetails) {
                              personName = driverDetails.name;
                              personDetails = driverDetails;
                            } else {
                              // Try to find in drivers database
                              const driver = drivers.find(d => d.id === personId);
                              if (driver) {
                                personName = `${driver.firstName} ${driver.lastName}`;
                              }
                            }
                          } else if (assignmentType === 'speaker') {
                            const speakerDetails = eventRequest.speakerDetails?.[personId];
                            if (speakerDetails) {
                              personName = speakerDetails.name;
                              personDetails = speakerDetails;
                            } else {
                              // Try to find in hosts database
                              const host = hosts.find(h => h.id === personId);
                              if (host) {
                                personName = `${host.firstName} ${host.lastName}`;
                              }
                            }
                          } else if (assignmentType === 'volunteer') {
                            const volunteerDetails = eventRequest.volunteerDetails?.[personId];
                            if (volunteerDetails) {
                              personName = volunteerDetails.name;
                              personDetails = volunteerDetails;
                            } else {
                              // Try to find in volunteers database
                              const volunteer = volunteers.find(v => v.id === personId);
                              if (volunteer) {
                                personName = `${volunteer.firstName} ${volunteer.lastName}`;
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Staffing Planning Tips
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
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
