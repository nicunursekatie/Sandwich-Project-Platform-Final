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
import { DriverSelectionModal } from './driver-selection-modal';
import { VolunteerSelectionModal } from './volunteer-selection-modal';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';

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
    let className = '';
    if (dayOfWeek === 2) {
      className = 'text-gray-700 font-medium';
    } else if (isWedOrThu) {
      className = 'text-orange-600 font-medium';
    } else {
      className = 'text-brand-primary font-bold';
    }

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
  status:
    | 'new'
    | 'followed_up'
    | 'in_process'
    | 'scheduled'
    | 'completed'
    | 'declined';
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
}

const statusColors = {
  new: 'bg-gradient-to-r from-teal-50 to-cyan-100 text-brand-primary border border-teal-200',
  followed_up:
    'bg-gradient-to-r from-orange-50 to-amber-100 text-brand-orange border border-orange-200',
  in_process:
    'bg-gradient-to-r from-teal-50 to-cyan-100 text-brand-teal border border-teal-200',
  scheduled:
    'bg-gradient-to-r from-yellow-50 to-orange-100 text-yellow-800 border border-yellow-200',
  completed:
    'bg-gradient-to-r from-gray-50 to-slate-100 text-gray-700 border border-gray-200',
  declined:
    'bg-gradient-to-r from-brand-burgundy to-red-700 text-white border-2 font-bold shadow-lg',
};

const statusIcons = {
  new: Clock,
  followed_up: Mail,
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
  { value: 'followed_up', label: 'Followed Up' },
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
              <span className="ml-2 text-orange-600">
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
                onWheel={(e) => e.target.blur()}
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

            {/* Action Summary */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                What happens next:
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  • Toolkit will be marked as sent on {toolkitSentDate} at{' '}
                  {toolkitSentTime}
                </li>
                <li>• Event status will change from "New" to "In Process"</li>
                <li>• Event will appear in the "In Process" tab</li>
                {!emailSent && (
                  <li>
                    • You can optionally send a toolkit email before submitting
                  </li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          // Email Composer embedded in the dialog
          <div className="min-h-[500px]">
            <EventEmailComposer
              isOpen={true}
              onClose={() => setShowEmailComposer(false)}
              eventRequest={eventRequest}
              onEmailSent={handleEmailSent}
            />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-3">
          {!showEmailComposer && (
            <>
              {/* Draft Email Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEmailComposer(true)}
                className="bg-gradient-to-r from-teal-50 to-cyan-100 hover:from-teal-100 hover:to-cyan-200 text-teal-700 border-teal-300"
                data-testid="button-draft-email"
              >
                <Mail className="w-4 h-4 mr-2" />
                Draft Email
              </Button>

              {/* Cancel Button */}
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>

              {/* Submit Button */}
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!toolkitSentDate || !toolkitSentTime || isLoading}
                className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white"
                data-testid="button-submit-toolkit-sent"
              >
                {isLoading ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Mark Toolkit as Sent
                  </>
                )}
              </Button>
            </>
          )}

          {showEmailComposer && (
            <div className="text-sm text-gray-600">
              The email composer will remain open until you send the email or
              close it. You can submit the toolkit record after sending the
              email.
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function EventRequestsManagement() {
  const [activeTab, setActiveTab] = useState('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSearch, setGlobalSearch] = useState(false);

  // Collapsible event details state
  const [collapsedEventDetails, setCollapsedEventDetails] = useState<
    Set<number>
  >(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EventRequest | null>(
    null
  );
  const [highlightedEventId, setHighlightedEventId] = useState<number | null>(
    null
  );
  const [currentEditingStatus, setCurrentEditingStatus] = useState<string>('');
  const [showCompleteContactDialog, setShowCompleteContactDialog] =
    useState(false);
  const [completingRequest, setCompletingRequest] =
    useState<EventRequest | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEventDetailsDialog, setShowEventDetailsDialog] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<EventRequest | null>(
    null
  );
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [pastEventsSortOrder, setPastEventsSortOrder] = useState<
    'asc' | 'desc'
  >('desc');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailComposerRequest, setEmailComposerRequest] =
    useState<EventRequest | null>(null);
  
  // State for recording actual sandwich counts
  const [showRecordSandwichesDialog, setShowRecordSandwichesDialog] = useState(false);
  const [recordSandwichesRequest, setRecordSandwichesRequest] = useState<EventRequest | null>(null);
  const [actualSandwichNotes, setActualSandwichNotes] = useState('');
  
  // Toolkit Sent Dialog state
  const [showToolkitSentDialog, setShowToolkitSentDialog] = useState(false);
  const [toolkitSentRequest, setToolkitSentRequest] =
    useState<EventRequest | null>(null);

  // Form state for Mark Scheduled dialog to track Select values
  const [markScheduledFormData, setMarkScheduledFormData] = useState({
    assignedVanDriverId: '',
    hasRefrigeration: '',
    tspContact: '',
    communicationMethod: '',
    toolkitStatus: '',
    vanDriverNeeded: false,
  });

  const [pastEventsPage, setPastEventsPage] = useState(1);
  const [pastEventsPerPage] = useState(10);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState<EventRequest | null>(
    null
  );
  // Inline editing state
  const [inlineEditing, setInlineEditing] = useState<{
    [key: string]: { field: string; requestId: number };
  }>({});
  const [editValues, setEditValues] = useState<{ [key: string]: string }>({});
  // Sorting state for all tabs
  const [requestsSortBy, setRequestsSortBy] = useState<
    'date' | 'organization' | 'contact'
  >('date');
  const [requestsSortOrder, setRequestsSortOrder] = useState<'asc' | 'desc'>(
    'desc'
  );
  const [scheduledSortBy, setScheduledSortBy] = useState<
    'date' | 'organization' | 'contact'
  >('date');
  const [scheduledSortOrder, setScheduledSortOrder] = useState<'asc' | 'desc'>(
    'asc'
  );
  const [pastSortBy, setPastSortBy] = useState<
    'date' | 'organization' | 'contact'
  >('date');
  const [pastSortOrder, setPastSortOrder] = useState<'asc' | 'desc'>('desc');
  const [inProcessSortBy, setInProcessSortBy] = useState<
    'date' | 'organization' | 'contact'
  >('date');
  const [inProcessSortOrder, setInProcessSortOrder] = useState<'asc' | 'desc'>(
    'desc'
  );

  // Enhanced inline editing state for safer editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [tempValues, setTempValues] = useState<any>({});
  const [pendingChanges, setPendingChanges] = useState<{
    [eventId: number]: { [field: string]: any };
  }>({});
  const [undoTimeouts, setUndoTimeouts] = useState<{
    [key: string]: NodeJS.Timeout;
  }>({});
  // TSP Contact Assignment state
  const [showTspContactDialog, setShowTspContactDialog] = useState(false);
  const [assigningContactRequest, setAssigningContactRequest] =
    useState<EventRequest | null>(null);
  const [showUnresponsiveDialog, setShowUnresponsiveDialog] = useState(false);

  // Social Media and Sandwich Tracking state
  const [showSandwichCountDialog, setShowSandwichCountDialog] = useState(false);
  const [showDistributionDialog, setShowDistributionDialog] = useState(false);
  const [currentEventForTracking, setCurrentEventForTracking] =
    useState<EventRequest | null>(null);
  const [actualSandwichCount, setActualSandwichCount] = useState<number>(0);
  const [actualSandwichTypes, setActualSandwichTypes] = useState<string>('');
  const [distributionData, setDistributionData] = useState<
    { destination: string; totalCount: number; notes?: string }[]
  >([]);
  const [distributionNotes, setDistributionNotes] = useState<string>('');
  const [unresponsiveRequest, setUnresponsiveRequest] =
    useState<EventRequest | null>(null);
  const [selectedTspContacts, setSelectedTspContacts] = useState<string[]>([]);
  const [customTspContacts, setCustomTspContacts] = useState<string[]>(['']);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [followUpRequest, setFollowUpRequest] = useState<EventRequest | null>(
    null
  );
  // Driver Assignment state
  const [editingDriversFor, setEditingDriversFor] = useState<number | null>(
    null
  );
  const [tempDriverInput, setTempDriverInput] = useState('');
  const [showingCustomDriver, setShowingCustomDriver] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedEventForDrivers, setSelectedEventForDrivers] =
    useState<EventRequest | null>(null);
  const [driverModalMode, setDriverModalMode] = useState<'regular' | 'van'>(
    'regular'
  );
  // Speaker Assignment state
  const [showSpeakerDialog, setShowSpeakerDialog] = useState(false);
  const [assigningSpeakerRequest, setAssigningSpeakerRequest] =
    useState<EventRequest | null>(null);
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [editingSpeakersFor, setEditingSpeakersFor] = useState<number | null>(
    null
  );
  const [tempSpeakerInput, setTempSpeakerInput] = useState('');
  const [showingCustomSpeaker, setShowingCustomSpeaker] = useState(false);

  // Volunteer Assignment state
  const [showVolunteerDialog, setShowVolunteerDialog] = useState(false);
  const [assigningVolunteerRequest, setAssigningVolunteerRequest] =
    useState<EventRequest | null>(null);
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const [showCallbackDialog, setShowCallbackDialog] = useState(false);
  const [showCallCompletedDialog, setShowCallCompletedDialog] = useState(false);
  const [callCompletedRequest, setCallCompletedRequest] =
    useState<EventRequest | null>(null);
  const [showSchedulingDialog, setShowSchedulingDialog] = useState(false);
  const [schedulingRequest, setSchedulingRequest] =
    useState<EventRequest | null>(null);
  const [showScheduleCallDialog, setShowScheduleCallDialog] = useState(false);
  const [scheduleCallRequest, setScheduleCallRequest] =
    useState<EventRequest | null>(null);

  // Get current user for permission checking
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available users for speaker/driver assignments
  const { data: availableUsers = [] } = useQuery({
    queryKey: ['/api/users/for-assignments'],
    enabled: true,
  });

  // Fetch drivers for speaker assignments (multi-faceted volunteers)
  const { data: availableDrivers = [] } = useQuery({
    queryKey: ['/api/drivers'],
    enabled: true,
  });

  // Query for event requests - must come before useEffect that references it
  const {
    data: eventRequests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/event-requests'],
    queryFn: () => apiRequest('GET', '/api/event-requests'),
    refetchOnMount: true,
  });

  // Handle URL parameters for tab and event highlighting
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const eventIdParam = urlParams.get('eventId');

    // Set the active tab based on URL parameter
    if (tabParam) {
      setActiveTab(tabParam);
    }

    // Highlight specific event if provided
    if (eventIdParam) {
      const eventId = parseInt(eventIdParam);
      setHighlightedEventId(eventId);

      // Auto-scroll to the event after DOM updates
      setTimeout(() => {
        const element = document.getElementById(`event-${eventId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Show toast notification with organization name
          const event = eventRequests.find((req) => req.id === eventId);
          if (event) {
            toast({
              title: 'Event Located',
              description: `Navigated to ${event.organizationName} event`,
              duration: 4000,
            });
          }
        }
      }, 1000);

      // Clear highlight after 5 seconds
      setTimeout(() => {
        setHighlightedEventId(null);
      }, 5000);
    }
  }, [eventRequests, toast]);

  // Reset pagination when search term changes
  useEffect(() => {
    setPastEventsPage(1);
  }, [searchTerm]);

  // Initialize collapsed state for event message content by default
  const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    if (eventRequests.length > 0) {
      // Set all event messages as collapsed by default
      const allEventIds = eventRequests.map((req: EventRequest) => req.id);
      setCollapsedMessages(new Set(allEventIds));
    }
  }, [eventRequests]);

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users/for-assignments'],
    queryFn: () => apiRequest('GET', '/api/users/for-assignments'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['/api/drivers'],
    queryFn: () => apiRequest('GET', '/api/drivers'),
    staleTime: 5 * 60 * 1000,
  });

  // Query for organization event counts (completed events only)
  const {
    data: organizationCounts = {},
    error: countsError,
    isLoading: countsLoading,
  } = useQuery({
    queryKey: ['/api/event-requests/organization-counts'],
    queryFn: () => apiRequest('GET', '/api/event-requests/organization-counts'),
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  // Organization counts debug logging (removed for production)

  // Early returns for loading and error states
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Event Planning</h1>
        <div className="text-center py-8">
          <p>Loading event requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Event Planning</h1>
        <div className="text-center py-8 text-red-600">
          <p>
            Error loading event requests:{' '}
            {(error as any)?.message || 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  // Helper function to get user display name
  const getUserDisplayName = (userId: string | null | undefined) => {
    if (!userId) return 'Not specified';

    // First try to find by user ID
    const user = users.find((u: any) => u.id === userId);
    if (user) {
      return user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.displayName || user.email;
    }

    // Then try to find by driver ID (for van drivers)
    const driver = drivers.find(
      (d: any) => d.id.toString() === userId.toString()
    );
    if (driver) {
      return driver.name || 'Driver';
    }

    // If not found by ID, check if it's already a display name (plain text)
    // This handles legacy data where names were stored directly
    if (userId.includes('@') || userId.includes('_')) {
      // Looks like a user ID that wasn't found
      return 'User not found';
    } else {
      // Assume it's a plain text name (legacy data)
      return userId;
    }
  };

  // Helper function to get driver display name
  const getDriverDisplayName = (driverId: string | null | undefined) => {
    if (!driverId) return 'Not specified';

    // First try to find by driver ID in available drivers
    const driver = availableDrivers?.find(
      (d: any) => d.id.toString() === driverId
    );
    if (driver) {
      return driver.name || 'Unknown Driver';
    }

    // Backward compatibility: try to find by name (for legacy data)
    const driverByName = availableDrivers?.find(
      (d: any) => d.name === driverId
    );
    if (driverByName) {
      return driverByName.name;
    }

    // If not found in drivers, just return the ID as is (might be a custom name)
    return driverId;
  };

  // Helper function to get organization event count
  const getOrganizationEventCount = (organizationName: string) => {
    const trimmedName = organizationName.trim();
    const count = organizationCounts[trimmedName] || 0;

    // Debug logging removed for production

    return count;
  };

  // Get current user for fallback when users array is restricted
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/event-requests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      setShowAddDialog(false);
      toast({ title: 'Event request created successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating event request',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => {
      console.log('🔄 Edit mutation called with data:', { id, ...data });
      return apiRequest('PUT', `/api/event-requests/${id}`, data);
    },
    onMutate: async ({ id, ...updatedData }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(['/api/event-requests']);

      // Optimistically update to new value
      queryClient.setQueryData(['/api/event-requests'], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === id ? { ...event, ...updatedData } : event
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowEditDialog(false);
      setSelectedRequest(null);
      toast({ title: 'Event request updated successfully' });
    },
    onError: (error: any, variables, context: any) => {
      // Rollback on error
      queryClient.setQueryData(
        ['/api/event-requests'],
        context?.previousEvents
      );
      toast({
        title: 'Error updating event request',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('DELETE', `/api/event-requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      toast({ title: 'Event request deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting event request',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const completeContactMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('POST', '/api/event-requests/complete-contact', data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      const previousEvents = queryClient.getQueryData(['/api/event-requests']);

      // Optimistically update the event status
      queryClient.setQueryData(['/api/event-requests'], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === data.id
            ? { ...event, status: 'contact_completed' }
            : event
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowCompleteContactDialog(false);
      setCompletingRequest(null);
      toast({ title: 'Contact completion recorded successfully' });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ['/api/event-requests'],
        context?.previousEvents
      );
      toast({
        title: 'Error recording contact completion',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
    },
  });

  const followUpMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('POST', '/api/event-requests/follow-up', data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      const previousEvents = queryClient.getQueryData(['/api/event-requests']);

      // Optimistically update the event status
      queryClient.setQueryData(['/api/event-requests'], (old: any) => {
        if (!old) return old;
        return old.map((event: any) => {
          if (event.id === data.id) {
            // Build update object with only defined fields to avoid overwriting with undefined
            const updateFields: any = {
              status: 'in_process', // Both email and call follow-ups should go to in_process
              followUpMethod: data.method,
              followUpDate: new Date().toISOString(),
            };

            // Only set updatedEmail if it's provided (for call follow-ups)
            if (data.updatedEmail !== undefined) {
              updateFields.updatedEmail = data.updatedEmail;
            }

            // Only set notes if it's provided (for call follow-ups)
            if (data.notes !== undefined) {
              updateFields.notes = data.notes;
            }

            // Preserve ALL existing event fields, especially desiredEventDate
            return {
              ...event,
              ...updateFields,
            };
          }
          return event;
        });
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowFollowUpDialog(false);
      setFollowUpRequest(null);
      toast({ title: 'Follow-up recorded successfully' });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ['/api/event-requests'],
        context?.previousEvents
      );
      toast({
        title: 'Error recording follow-up',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
    },
  });

  // Mutation for recording actual sandwich counts
  const recordActualSandwichesMutation = useMutation({
    mutationFn: async (data: {
      eventId: number;
      actualSandwichCount: number;
      actualSandwichNotes: string;
    }) => {
      return await apiRequest('PATCH', `/api/event-requests/${data.eventId}/actual-sandwiches`, {
        actualSandwichCount: data.actualSandwichCount,
        actualSandwichCountRecordedDate: new Date().toISOString(),
        actualSandwichCountRecordedBy: currentUser?.id || 'unknown',
        distributionNotes: data.actualSandwichNotes,
      });
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      const previousEvents = queryClient.getQueryData(['/api/event-requests']);

      // Optimistically update the event with actual sandwich count
      queryClient.setQueryData(['/api/event-requests'], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === data.eventId
            ? {
                ...event,
                actualSandwichCount: data.actualSandwichCount,
                actualSandwichCountRecordedDate: new Date().toISOString(),
                actualSandwichCountRecordedBy: currentUser?.id || 'unknown',
                distributionNotes: data.actualSandwichNotes,
              }
            : event
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowRecordSandwichesDialog(false);
      setRecordSandwichesRequest(null);
      setActualSandwichCount(0);
      setActualSandwichNotes('');
      toast({
        title: 'Success',
        description: 'Actual sandwich count recorded successfully',
      });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ['/api/event-requests'],
        context?.previousEvents
      );
      toast({
        title: 'Error recording sandwich count',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
    },
  });

  const callCompletedMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/event-requests/${data.id}/event-details`, {
        status: 'scheduled',
        ...data.eventDetails,
      }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      const previousEvents = queryClient.getQueryData(['/api/event-requests']);

      // Optimistically update the event to scheduled
      queryClient.setQueryData(['/api/event-requests'], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === data.id
            ? {
                ...event,
                status: 'scheduled',
                ...data.eventDetails,
              }
            : event
        );
      });

      return { previousEvents };
    },
    onError: (err, data, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        queryClient.setQueryData(
          ['/api/event-requests'],
          context.previousEvents
        );
      }
      toast({
        title: 'Error',
        description: 'Failed to update event details',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      setShowCallCompletedDialog(false);
      setCallCompletedRequest(null);
      toast({
        title: 'Call completed',
        description: 'Event moved to Scheduled status with full details',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
    },
  });

  const completeEventDetailsMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('POST', '/api/event-requests/complete-event-details', data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      const previousEvents = queryClient.getQueryData(['/api/event-requests']);

      // Optimistically update the event with new details
      queryClient.setQueryData(['/api/event-requests'], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === data.eventId
            ? {
                ...event,
                status: 'completed',
                actualEventDate: data.actualEventDate,
                actualAttendeeCount: data.actualAttendeeCount,
                notes: data.notes,
              }
            : event
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowEventDetailsDialog(false);
      setDetailsRequest(null);
      toast({ title: 'Event details saved successfully' });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ['/api/event-requests'],
        context?.previousEvents
      );
      toast({
        title: 'Error saving event details',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
    },
  });

  const syncToSheetsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/import/sync-to-sheets'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      toast({
        title: 'Sync to Google Sheets successful',
        description: `Updated ${data.updated} rows in Google Sheets`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error syncing to Google Sheets',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncFromSheetsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/import/sync-from-sheets'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      toast({
        title: 'Sync from Google Sheets successful',
        description: `Processed ${data.total} rows, imported ${data.imported} new events`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error syncing from Google Sheets',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const importScheduledEventsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/import-scheduled-events'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      toast({
        title: 'Scheduled Events Import successful',
        description: `Imported ${data.imported} new events, skipped ${data.skipped} existing events`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error importing scheduled events',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle delete confirmation
  const handleDeleteRequest = (request: EventRequest) => {
    setDeletingRequest(request);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = () => {
    if (deletingRequest) {
      deleteMutation.mutate(deletingRequest.id);
      setShowDeleteConfirmDialog(false);
      setDeletingRequest(null);
    }
  };

  // Inline editing handlers
  const startInlineEdit = (
    requestId: number,
    field: string,
    currentValue: string
  ) => {
    const editKey = `${requestId}-${field}`;
    setInlineEditing({ ...inlineEditing, [editKey]: { field, requestId } });
    setEditValues({ ...editValues, [editKey]: currentValue });
  };

  const saveInlineEdit = (requestId: number, field: string) => {
    const editKey = `${requestId}-${field}`;
    const newValue = editValues[editKey];

    if (newValue !== undefined) {
      // Prepare the update data
      const updateData = { [field]: newValue };

      // Call the update mutation
      updateMutation.mutate({ id: requestId, ...updateData });

      // Clear the editing state
      const newInlineEditing = { ...inlineEditing };
      delete newInlineEditing[editKey];
      setInlineEditing(newInlineEditing);

      const newEditValues = { ...editValues };
      delete newEditValues[editKey];
      setEditValues(newEditValues);
    }
  };

  const cancelInlineEdit = (requestId: number, field: string) => {
    const editKey = `${requestId}-${field}`;
    const newInlineEditing = { ...inlineEditing };
    delete newInlineEditing[editKey];
    setInlineEditing(newInlineEditing);

    const newEditValues = { ...editValues };
    delete newEditValues[editKey];
    setEditValues(newEditValues);
  };

  const isEditing = (requestId: number, field: string) => {
    const editKey = `${requestId}-${field}`;
    return inlineEditing[editKey] !== undefined;
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiRequest('PUT', `/api/event-requests/${id}`, data),
    onSuccess: (_, variables) => {
      console.log(
        '🔄 Event request updated - invalidating caches...',
        variables
      );
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });

      // If the details dialog is open, refresh the detailsRequest data
      if (detailsRequest && variables.id === detailsRequest.id) {
        console.log('📝 Updating detailsRequest data for open dialog...');
        // Immediately invalidate and refetch, then update dialog data
        queryClient
          .refetchQueries({ queryKey: ['/api/event-requests'] })
          .then(() => {
            const updatedRequest = queryClient
              .getQueryData(['/api/event-requests'])
              ?.find((req: any) => req.id === variables.id);
            if (updatedRequest) {
              console.log(
                '🆕 Refreshing dialog with updated data:',
                updatedRequest
              );
              setDetailsRequest(updatedRequest);
            }
          });
      }

      console.log('✅ Cache invalidation complete');
      toast({
        title: 'Event request updated',
        description: 'The event request has been updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating event request',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Assignment update function
  const handleAssignmentUpdate = (
    eventId: number,
    field: string,
    value: any
  ) => {
    // Use specific driver endpoint for driver assignments and van driver fields
    if (field === 'assignedDriverIds' || field.startsWith('van')) {
      const updateData: any = {};
      updateData[field] = value;

      if (field === 'assignedDriverIds') {
        updateData.driversArranged = value && value.length > 0;
      }

      driverAssignmentMutation.mutate({
        eventId,
        ...updateData,
      });
    } else {
      updateMutation.mutate({
        id: eventId,
        [field]: value,
      });
    }
  };

  // Driver assignment mutation
  const driverAssignmentMutation = useMutation({
    mutationFn: ({
      eventId,
      assignedDriverIds,
      vanDriverNeeded,
      assignedVanDriverId,
      customVanDriverName,
      vanDriverNotes,
    }: {
      eventId: number;
      assignedDriverIds?: string[];
      vanDriverNeeded?: boolean;
      assignedVanDriverId?: string | null;
      customVanDriverName?: string | null;
      vanDriverNotes?: string | null;
    }) =>
      apiRequest('PATCH', `/api/event-requests/${eventId}/drivers`, {
        assignedDriverIds,
        driversArranged: assignedDriverIds && assignedDriverIds.length > 0,
        vanDriverNeeded,
        assignedVanDriverId,
        customVanDriverName,
        vanDriverNotes,
      }),
    onSuccess: () => {
      // Force immediate cache invalidation and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      queryClient.refetchQueries({ queryKey: ['/api/event-requests'] });
      toast({
        title: 'Success',
        description: 'Driver assignments updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update driver assignments',
        variant: 'destructive',
      });
    },
  });

  // Assignment save mutations

  const saveSpeakerAssignmentMutation = useMutation({
    mutationFn: ({
      eventId,
      speakerIds,
    }: {
      eventId: number;
      speakerIds: string[];
    }) => {
      // Process mixed speaker IDs (users and drivers)
      const speakers = {
        userSpeakers: speakerIds
          .filter((id) => id.startsWith('user-'))
          .map((id) => id.replace('user-', '')),
        driverSpeakers: speakerIds
          .filter((id) => id.startsWith('driver-'))
          .map((id) => id.replace('driver-', '')),
      };

      return apiRequest('PUT', `/api/event-requests/${eventId}`, {
        assignedSpeakerIds: speakers.userSpeakers, // Keep existing user speakers for backwards compatibility
        assignedDriverSpeakers: speakers.driverSpeakers, // Add new driver speakers field
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      setShowSpeakerDialog(false);
      setSelectedSpeakers([]);
      toast({ title: 'Speaker assignments updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating speaker assignments',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const saveVolunteerAssignmentMutation = useMutation({
    mutationFn: ({
      eventId,
      volunteerIds,
    }: {
      eventId: number;
      volunteerIds: string[];
    }) =>
      apiRequest('PUT', `/api/event-requests/${eventId}`, {
        assignedVolunteerIds: volunteerIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      setShowVolunteerDialog(false);
      toast({ title: 'Volunteer assignments updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating volunteer assignments',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mark in_process event as scheduled with comprehensive data
  const markScheduledMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('POST', `/api/event-requests/complete-event-details`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });
      setShowSchedulingDialog(false);
      setSchedulingRequest(null);
      toast({
        title: 'Event scheduled successfully',
        description:
          'The event has been moved to scheduled status with all details',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error scheduling event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Social media post tracking mutations
  const socialMediaMutation = useMutation({
    mutationFn: ({ eventId, data }: { eventId: number; data: any }) =>
      apiRequest('PATCH', `/api/event-requests/${eventId}/social-media`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      toast({
        title: 'Social media tracking updated',
        description: 'Social media post status has been updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating social media tracking',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Record actual sandwich count mutation
  const recordSandwichCountMutation = useMutation({
    mutationFn: ({
      eventId,
      actualSandwichCount,
      actualSandwichTypes,
    }: {
      eventId: number;
      actualSandwichCount: number;
      actualSandwichTypes?: string;
    }) =>
      apiRequest(
        'PATCH',
        `/api/event-requests/${eventId}/actual-sandwich-count`,
        {
          actualSandwichCount,
          actualSandwichTypes,
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setShowSandwichCountDialog(false);
      setCurrentEventForTracking(null);
      toast({
        title: 'Final sandwich count recorded',
        description: 'The actual sandwich count has been saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error recording sandwich count',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Record distribution mutation
  const recordDistributionMutation = useMutation({
    mutationFn: ({
      eventId,
      sandwichDistributions,
      distributionNotes,
    }: {
      eventId: number;
      sandwichDistributions: any[];
      distributionNotes?: string;
    }) =>
      apiRequest('PATCH', `/api/event-requests/${eventId}/distribution`, {
        sandwichDistributions,
        distributionNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setShowDistributionDialog(false);
      setCurrentEventForTracking(null);
      toast({
        title: 'Distribution recorded',
        description: 'Sandwich distribution has been saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error recording distribution',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toolkit sent mutation
  const toolkitSentMutation = useMutation({
    mutationFn: ({
      eventId,
      toolkitSentDate,
    }: {
      eventId: number;
      toolkitSentDate: string;
    }) =>
      apiRequest('PATCH', `/api/event-requests/${eventId}`, {
        toolkitSent: true,
        toolkitSentDate,
        status: 'in_process',
      }),
    onMutate: async ({ eventId }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      const previousEvents = queryClient.getQueryData(['/api/event-requests']);

      // Optimistically update the event
      queryClient.setQueryData(['/api/event-requests'], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === eventId
            ? {
                ...event,
                toolkitSent: true,
                toolkitSentDate: new Date().toISOString(),
                status: 'in_process',
              }
            : event
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setShowToolkitSentDialog(false);
      setToolkitSentRequest(null);
      toast({
        title: 'Toolkit sent successfully',
        description: "Event has been moved to 'In Process' status",
      });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ['/api/event-requests'],
        context?.previousEvents
      );
      toast({
        title: 'Error marking toolkit as sent',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Schedule Call mutation
  const scheduleCallMutation = useMutation({
    mutationFn: ({
      eventId,
      scheduledCallDate,
    }: {
      eventId: number;
      scheduledCallDate: string;
    }) =>
      apiRequest('PATCH', `/api/event-requests/${eventId}`, {
        scheduledCallDate,
      }),
    onMutate: async ({ eventId, scheduledCallDate }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      const previousEvents = queryClient.getQueryData(['/api/event-requests']);

      // Optimistically update the event
      queryClient.setQueryData(['/api/event-requests'], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === eventId
            ? {
                ...event,
                scheduledCallDate,
              }
            : event
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setShowScheduleCallDialog(false);
      setScheduleCallRequest(null);
      toast({
        title: 'Call scheduled successfully',
        description: 'The scheduled call date has been saved',
      });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ['/api/event-requests'],
        context?.previousEvents
      );
      toast({
        title: 'Error scheduling call',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Helper functions for social media and sandwich tracking
  const updateSocialMediaPostStatus = (
    eventId: number,
    data: {
      socialMediaPostRequested?: boolean;
      socialMediaPostCompleted?: boolean;
    }
  ) => {
    socialMediaMutation.mutate({ eventId, data });
  };

  const openSandwichCountDialog = (request: EventRequest) => {
    setCurrentEventForTracking(request);
    setActualSandwichCount(0);
    setActualSandwichTypes('');
    setShowSandwichCountDialog(true);
  };

  const openDistributionDialog = (request: EventRequest) => {
    setCurrentEventForTracking(request);
    setDistributionData([{ destination: '', totalCount: 0 }]);
    setDistributionNotes('');
    setShowDistributionDialog(true);
  };

  const handleRecordSandwichCount = () => {
    if (!currentEventForTracking || actualSandwichCount <= 0) return;

    recordSandwichCountMutation.mutate({
      eventId: currentEventForTracking.id,
      actualSandwichCount,
      actualSandwichTypes: actualSandwichTypes || undefined,
    });
  };

  const handleRecordDistribution = () => {
    if (!currentEventForTracking || distributionData.length === 0) return;

    const validDistributions = distributionData.filter(
      (d) => d.destination && d.totalCount > 0
    );
    if (validDistributions.length === 0) return;

    recordDistributionMutation.mutate({
      eventId: currentEventForTracking.id,
      sandwichDistributions: validDistributions,
      distributionNotes: distributionNotes || undefined,
    });
  };

  const addDistributionEntry = () => {
    setDistributionData([
      ...distributionData,
      { destination: '', totalCount: 0 },
    ]);
  };

  const removeDistributionEntry = (index: number) => {
    setDistributionData(distributionData.filter((_, i) => i !== index));
  };

  const updateDistributionEntry = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const updated = [...distributionData];
    updated[index] = { ...updated[index], [field]: value };
    setDistributionData(updated);
  };

  // Sorting helper functions
  const sortEvents = (
    events: EventRequest[],
    sortBy: 'date' | 'organization' | 'contact',
    sortOrder: 'asc' | 'desc'
  ) => {
    return events.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case 'organization':
          valueA = a.organizationName?.toLowerCase() || '';
          valueB = b.organizationName?.toLowerCase() || '';
          break;
        case 'contact':
          valueA = `${a.firstName || ''} ${a.lastName || ''}`
            .toLowerCase()
            .trim();
          valueB = `${b.firstName || ''} ${b.lastName || ''}`
            .toLowerCase()
            .trim();
          break;
        case 'date':
        default:
          // For requests tab, sort by created date; for others, sort by event date then created date
          if (a.desiredEventDate && b.desiredEventDate) {
            valueA = new Date(a.desiredEventDate);
            valueB = new Date(b.desiredEventDate);
          } else {
            valueA = new Date(a.createdAt);
            valueB = new Date(b.createdAt);
          }
          break;
      }

      if (sortBy === 'date') {
        const comparison = valueA.getTime() - valueB.getTime();
        return sortOrder === 'asc' ? comparison : -comparison;
      } else {
        const comparison = valueA.localeCompare(valueB);
        return sortOrder === 'asc' ? comparison : -comparison;
      }
    });
  };

  // Filter events by tab
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today for accurate comparison

  const requestsEvents = (eventRequests || []).filter((req: EventRequest) => {
    // Only include new requests - clean separation
    if (!req.desiredEventDate) {
      return req.status === 'new' || !req.status;
    }

    // Use the same timezone-safe parsing as formatEventDate function
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      const dateOnly = dateString.split(' ')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      const dateOnly = dateString.split('T')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);

    // Show future and past events that are new status
    return req.status === 'new' || !req.status;
  });

  const scheduledEvents = (eventRequests || []).filter((req: EventRequest) => {
    if (!req.desiredEventDate) return req.status === 'scheduled';
    // Use the same timezone-safe parsing as formatEventDate function
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      const dateOnly = dateString.split(' ')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      const dateOnly = dateString.split('T')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today && req.status === 'scheduled';
  });

  const pastEvents = (eventRequests || []).filter((req: EventRequest) => {
    // DATE is the primary filter - only show events with past dates
    if (!req.desiredEventDate) {
      // No date specified - only include if status suggests it's truly done
      return req.status === 'completed' || req.status === 'declined';
    }

    // Parse the event date using timezone-safe logic
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      const dateOnly = dateString.split(' ')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else if (
      dateString &&
      typeof dateString === 'string' &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      const dateOnly = dateString.split('T')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);

    // PRIMARY FILTER: Event date must be in the past
    if (eventDate >= today) return false;

    // SECONDARY FILTER: Must have a relevant status
    return (
      req.status === 'completed' ||
      req.status === 'contact_completed' ||
      req.status === 'declined'
    );
  });

  const inProcessEvents = (eventRequests || []).filter((req: EventRequest) => {
    // Only include events that are truly "in process" - actively being worked on
    return req.status === 'in_process';
  });

  // New filtering arrays for separate tabs
  const declinedEvents = (eventRequests || []).filter((req: EventRequest) => {
    return req.status === 'declined';
  });

  const unresponsiveEvents = (eventRequests || []).filter(
    (req: EventRequest) => {
      return req.status === 'unresponsive' || req.isUnresponsive;
    }
  );

  const otherEvents = (eventRequests || []).filter((req: EventRequest) => {
    const standardStatuses = [
      'new',
      'in_process',
      'scheduled',
      'completed',
      'contact_completed',
      'declined',
      'unresponsive',
    ];
    return !standardStatuses.includes(req.status || '');
  });

  // Get current events based on active tab
  const getCurrentEvents = () => {
    switch (activeTab) {
      case 'requests':
        return requestsEvents;
      case 'in_process':
        return inProcessEvents;
      case 'scheduled':
        return scheduledEvents;
      case 'past':
        return pastEvents;
      default:
        return requestsEvents;
    }
  };

  const filteredRequests = useMemo(() => {
    // If global search is enabled and there's a search term, search all events
    const currentEvents =
      globalSearch && searchTerm ? eventRequests : getCurrentEvents();
    const filtered = currentEvents.filter((request: EventRequest) => {
      const matchesSearch =
        !searchTerm ||
        request.organizationName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        request.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (request.desiredEventDate &&
          typeof request.desiredEventDate === 'string' &&
          request.desiredEventDate
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (request.desiredEventDate &&
          formatEventDate(request.desiredEventDate)
            .text.toLowerCase()
            .includes(searchTerm.toLowerCase()));

      // Apply status filter
      const matchesStatusFilter = () => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'unresponsive')
          return request.isUnresponsive === true;
        if (statusFilter === 'responsive')
          return request.isUnresponsive !== true;
        return true;
      };

      return matchesSearch && matchesStatusFilter();
    });

    // Sorting function for safe date parsing
    const getEventDate = (req: EventRequest) => {
      if (!req.desiredEventDate) return new Date(0); // Fallback date for events without dates

      const dateString = req.desiredEventDate;
      if (
        dateString &&
        typeof dateString === 'string' &&
        dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      ) {
        const dateOnly = dateString.split(' ')[0];
        return new Date(dateOnly + 'T12:00:00');
      } else if (
        dateString &&
        typeof dateString === 'string' &&
        dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
      ) {
        const dateOnly = dateString.split('T')[0];
        return new Date(dateOnly + 'T12:00:00');
      }
      return new Date(dateString);
    };

    const getSubmissionDate = (req: EventRequest) => {
      if (!req.createdAt) return new Date(0); // Fallback date for requests without submission dates
      return new Date(req.createdAt);
    };

    // Apply sorting based on active tab
    switch (activeTab) {
      case 'requests':
        return sortEvents(filtered, requestsSortBy, requestsSortOrder);
      case 'in_process':
        return sortEvents(filtered, inProcessSortBy, inProcessSortOrder);
      case 'scheduled':
        return sortEvents(filtered, scheduledSortBy, scheduledSortOrder);
      case 'past':
        return sortEvents(filtered, pastSortBy, pastSortOrder);
      default:
        return sortEvents(filtered, requestsSortBy, requestsSortOrder);
    }
  }, [
    eventRequests,
    searchTerm,
    activeTab,
    globalSearch,
    requestsSortBy,
    requestsSortOrder,
    scheduledSortBy,
    scheduledSortOrder,
    pastSortBy,
    pastSortOrder,
    inProcessSortBy,
    inProcessSortOrder,
    statusFilter,
  ]);

  // Paginated past events for display
  const paginatedPastEvents = useMemo(() => {
    if (activeTab !== 'past') return filteredRequests;

    const startIndex = (pastEventsPage - 1) * pastEventsPerPage;
    const endIndex = startIndex + pastEventsPerPage;
    return filteredRequests.slice(startIndex, endIndex);
  }, [filteredRequests, activeTab, pastEventsPage, pastEventsPerPage]);

  // Pagination calculations for past events
  const pastEventsPagination = useMemo(() => {
    if (activeTab !== 'past')
      return { totalPages: 1, currentPage: 1, totalItems: 0 };

    const totalItems = filteredRequests.length;
    const totalPages = Math.ceil(totalItems / pastEventsPerPage);
    return {
      totalPages,
      currentPage: pastEventsPage,
      totalItems,
      startItem:
        totalItems === 0 ? 0 : (pastEventsPage - 1) * pastEventsPerPage + 1,
      endItem: Math.min(pastEventsPage * pastEventsPerPage, totalItems),
    };
  }, [filteredRequests, activeTab, pastEventsPage, pastEventsPerPage]);

  // Status explanations for tooltips
  const statusExplanations = {
    new: "A new event request that hasn't been followed up with yet",
    followed_up: 'Toolkit and scheduling link have been sent via email',
    in_process: 'Phone call completed, scheduling in progress',
    scheduled: 'Event is confirmed and scheduled with details finalized',
    completed: 'Event has been successfully completed',
    declined: 'Request was declined or event was cancelled',
    past: 'Past event that is archived',
  };

  const getStatusDisplay = (status: string) => {
    const option = statusOptions.find((opt) => opt.value === status);
    const Icon = statusIcons[status as keyof typeof statusIcons] || Clock;
    const explanation =
      statusExplanations[status as keyof typeof statusExplanations] ||
      'Status information';

    const badge = (
      <Badge
        className={
          status === 'declined'
            ? 'text-white border-2 font-bold shadow-lg'
            : statusColors[status as keyof typeof statusColors]
        }
        style={
          status === 'declined'
            ? {
                background: 'linear-gradient(135deg, #A31C41 0%, #8B1538 100%)',
                borderColor: '#A31C41',
              }
            : {}
        }
      >
        <Icon className="w-3 h-3 mr-1" />
        {option?.label || status}
      </Badge>
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{explanation}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const hasAdvancedDetails = (request: EventRequest) => {
    return !!(
      (request as any).toolkitStatus ||
      (request as any).eventStartTime ||
      (request as any).eventEndTime ||
      (request as any).pickupTime ||
      (request as any).tspContact ||
      (request as any).customTspContact ||
      (request as any).planningNotes
    );
  };

  // Permission checking functions
  const canEditEventRequest = () => {
    if (!user) return false;
    return (
      hasPermission(user, PERMISSIONS.MANAGE_EVENT_REQUESTS) ||
      hasPermission(user, PERMISSIONS.MANAGE_USERS) ||
      user.role === 'super_admin'
    );
  };

  const canEditField = (field: string) => {
    if (!user) return false;

    // All editing requires EVENT_REQUESTS_EDIT permission
    if (!hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT)) {
      return false;
    }

    // Standard editable fields for users with edit permissions
    const editableFields = [
      'phone',
      'email',
      'planningNotes',
      'eventDate',
      'eventStartTime',
      'eventEndTime',
      'eventAddress',
      'estimatedSandwichCount',
      'sandwichTypes',
      'deliveryDestination',
      'contact',
      'hasRefrigeration',
      'additionalRequirements', // Special Requirements field
      'driversNeeded',
      'speakersNeeded',
      'volunteersNeeded',
    ];

    return editableFields.includes(field);
  };

  // Track pending changes without saving immediately
  const handleTrackChange = (eventId: number, field: string, value: any) => {
    if (!canEditEventRequest()) {
      toast({
        title: 'Access denied',
        description: "You don't have permission to edit event requests",
        variant: 'destructive',
      });
      return;
    }

    setPendingChanges((prev) => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        [field]: value,
      },
    }));
  };

  // Enhanced autosave with undo functionality
  const handleAutosave = async (eventId: number, field: string, value: any) => {
    const originalValue = eventRequests.find((r) => r.id === eventId)?.[
      field as keyof EventRequest
    ];

    try {
      await updateMutation.mutateAsync({
        id: eventId,
        [field]: value,
      });

      // Show success toast with undo option
      const undoKey = `${eventId}-${field}`;

      // Clear any existing undo timeout for this field
      if (undoTimeouts[undoKey]) {
        clearTimeout(undoTimeouts[undoKey]);
      }

      // Create undo functionality
      const undoTimeout = setTimeout(() => {
        setUndoTimeouts((prev) => {
          const newTimeouts = { ...prev };
          delete newTimeouts[undoKey];
          return newTimeouts;
        });
      }, 8000); // 8 seconds to undo

      setUndoTimeouts((prev) => ({
        ...prev,
        [undoKey]: undoTimeout,
      }));

      toast({
        title: `${field.charAt(0).toUpperCase() + field.slice(1)} updated`,
        description: (
          <div className="flex items-center justify-between">
            <span>Changed to: {value}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // Undo the change
                await updateMutation.mutateAsync({
                  id: eventId,
                  [field]: originalValue,
                });
                clearTimeout(undoTimeout);
                setUndoTimeouts((prev) => {
                  const newTimeouts = { ...prev };
                  delete newTimeouts[undoKey];
                  return newTimeouts;
                });
                toast({ title: 'Change undone' });
              }}
            >
              Undo
            </Button>
          </div>
        ),
        duration: 8000,
      });

      // Log audit trail
      console.log(
        `[AUDIT] User ${user?.email} changed ${field} from "${originalValue}" to "${value}" for event ${eventId}`
      );
    } catch (error) {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  // Handle inline editing with confirmation
  const handleFieldSave = (eventId: number, field: string, value: any) => {
    handleAutosave(eventId, field, value);
    setEditingField(null);
    setEditingEventId(null);
    setTempValues({});
  };

  // Cancel editing without saving
  const handleFieldCancel = () => {
    setEditingField(null);
    setEditingEventId(null);
    setTempValues({});
  };

  // Check if event has pending changes
  const hasPendingChanges = (eventId: number) => {
    return (
      pendingChanges[eventId] && Object.keys(pendingChanges[eventId]).length > 0
    );
  };

  // Get display value (pending change or original value)
  const getDisplayValue = (request: EventRequest, field: string) => {
    if (
      pendingChanges[request.id] &&
      pendingChanges[request.id][field] !== undefined
    ) {
      return pendingChanges[request.id][field];
    }
    return request[field as keyof EventRequest];
  };

  // Save all pending changes for an event
  const handleSaveAllChanges = async (eventId: number) => {
    const changes = pendingChanges[eventId];
    if (!changes) return;

    try {
      await updateMutation.mutateAsync({
        id: eventId,
        ...changes,
      });

      // Clear pending changes
      setPendingChanges((prev) => {
        const newPending = { ...prev };
        delete newPending[eventId];
        return newPending;
      });

      toast({
        title: 'All changes saved',
        description: `Updated ${Object.keys(changes).length} field(s)`,
      });

      // Log audit trail for bulk save
      console.log(
        `[AUDIT] User ${user?.email} saved bulk changes for event ${eventId}:`,
        changes
      );
    } catch (error) {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  // Handle TSP contact assignment
  const handleAssignTspContact = () => {
    if (!assigningContactRequest) return;

    const contactData: any = {};

    // Assign selected team members to contact fields
    if (selectedTspContacts.length > 0) {
      contactData.tspContact = selectedTspContacts[0] || null;
      contactData.tspContactAssigned = selectedTspContacts[1] || null;
      contactData.additionalContact1 = selectedTspContacts[2] || null;
      contactData.additionalContact2 = selectedTspContacts[3] || null;
    }

    // Combine custom contacts into one field
    const nonEmptyCustomContacts = customTspContacts.filter((contact) =>
      contact.trim()
    );
    if (nonEmptyCustomContacts.length > 0) {
      contactData.customTspContact = nonEmptyCustomContacts.join('; ');
    }

    updateMutation.mutate({
      id: assigningContactRequest.id,
      ...contactData,
    });

    // Reset state
    setShowTspContactDialog(false);
    setAssigningContactRequest(null);
    setSelectedTspContacts([]);
    setCustomTspContacts(['']);

    toast({ title: 'TSP contacts assigned successfully' });
  };

  // Handle unresponsive status management
  const handleUnresponsiveSubmit = async (data: any) => {
    if (!unresponsiveRequest) return;

    try {
      const updateData = {
        isUnresponsive: data.action === 'mark',
        markedUnresponsiveAt:
          data.action === 'mark' ? new Date().toISOString() : null,
        markedUnresponsiveBy: data.action === 'mark' ? user?.id : null,
        unresponsiveReason: data.reason || null,
        contactMethod: data.contactMethod || null,
        nextFollowUpDate: data.nextFollowUpDate || null,
        unresponsiveNotes: data.notes || null,
        contactAttempts:
          data.action === 'mark'
            ? (unresponsiveRequest.contactAttempts || 0) + 1
            : unresponsiveRequest.contactAttempts,
        lastContactAttempt:
          data.action === 'mark'
            ? new Date().toISOString()
            : unresponsiveRequest.lastContactAttempt,
      };

      await updateMutation.mutateAsync({
        id: unresponsiveRequest.id,
        ...updateData,
      });

      toast({
        title:
          data.action === 'mark'
            ? 'Marked as unresponsive'
            : 'Unresponsive status updated',
        description: `${unresponsiveRequest.organizationName} has been updated`,
      });

      setShowUnresponsiveDialog(false);
      setUnresponsiveRequest(null);

      // Log audit trail
      console.log(
        `[AUDIT] User ${user?.email} ${
          data.action === 'mark' ? 'marked' : 'updated'
        } unresponsive status for event ${unresponsiveRequest.id}:`,
        updateData
      );
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to update unresponsive status',
        variant: 'destructive',
      });
    }
  };

  // Unresponsive Management Form Component
  const UnresponsiveManagementForm = ({
    request,
    onSubmit,
    onCancel,
  }: {
    request: any;
    onSubmit: (data: any) => void;
    onCancel: () => void;
  }) => {
    const [action, setAction] = useState(
      request.isUnresponsive ? 'update' : 'mark'
    );
    const [reason, setReason] = useState(request.unresponsiveReason || '');
    const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
    const [notes, setNotes] = useState(request.unresponsiveNotes || '');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      // Auto-calculate follow-up date one week out if requested
      const nextFollowUpDate = scheduleFollowUp
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      onSubmit({
        action,
        reason,
        nextFollowUpDate,
        notes,
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Action Selection */}
        <div className="space-y-2">
          <Label>Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mark">Mark as Unresponsive</SelectItem>
              {request.isUnresponsive && (
                <>
                  <SelectItem value="update">
                    Update Unresponsive Status
                  </SelectItem>
                  <SelectItem value="resolve">
                    Mark as Responsive Again
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Current Status Display */}
        {request.isUnresponsive && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-md">
            <div className="text-sm">
              <p className="font-medium text-red-800">
                Currently marked as unresponsive
              </p>
              <p className="text-red-600">
                Contact attempts: {request.contactAttempts || 0}
              </p>
              {request.lastContactAttempt && (
                <p className="text-red-600">
                  Last attempt:{' '}
                  {new Date(request.lastContactAttempt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Reason */}
        {action !== 'resolve' && (
          <div className="space-y-2">
            <Label htmlFor="reason">What contact issue occurred?</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select what happened..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_email">No email provided</SelectItem>
                <SelectItem value="no_phone">
                  No phone number provided
                </SelectItem>
                <SelectItem value="no_response_email">
                  No response to emails
                </SelectItem>
                <SelectItem value="no_response_phone">
                  No response to phone calls
                </SelectItem>
                <SelectItem value="incorrect_contact">
                  Contact information appears incorrect
                </SelectItem>
                <SelectItem value="organization_inactive">
                  Organization appears inactive
                </SelectItem>
                <SelectItem value="other">Other reason</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Simple Follow-up Checkbox */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="scheduleFollowUp"
              checked={scheduleFollowUp}
              onChange={(e) => setScheduleFollowUp(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="scheduleFollowUp" className="text-sm">
              Schedule follow-up attempt? (automatically sets date one week from
              now)
            </Label>
          </div>
          {scheduleFollowUp && (
            <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
              Follow-up will be scheduled for:{' '}
              {new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
              ).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about contact attempts, issues, or next steps..."
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            className={
              action === 'resolve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }
          >
            {action === 'mark' && 'Mark as Unresponsive'}
            {action === 'update' && 'Update Status'}
            {action === 'resolve' && 'Mark as Responsive'}
          </Button>
        </div>
      </form>
    );
  };

  // Function to render scheduled event cards with consistent layout matching standard cards
  const renderScheduledEventCard = (request: EventRequest) => (
    <Card
      key={request.id}
      id={`event-${request.id}`}
      className={`hover:shadow-xl transition-all duration-300 border-l-4 border-l-brand-primary bg-gradient-to-br from-white to-orange-50 ${
        highlightedEventId === request.id
          ? 'ring-4 ring-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100'
          : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center space-x-3 text-xl mb-3">
              <Building className="w-6 h-6" style={{ color: '#236383' }} />
              <span className="text-gray-900">
                {request.organizationName}
                {request.department && (
                  <span className="text-sm text-gray-600 ml-2">
                    - {request.department}
                  </span>
                )}
              </span>
            </CardTitle>

            <div className="space-y-2">
              {/* Event Date Display */}
              {request.desiredEventDate && (
                <div className="flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-orange-50 p-2 rounded-lg border border-brand-orange">
                  <Calendar className="w-5 h-5 text-brand-orange" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-brand-orange uppercase tracking-wide">
                      Event Date
                    </span>
                    <span className="text-sm font-medium text-gray-600">
                      {(() => {
                        const dateInfo = formatEventDate(request.desiredEventDate);
                        return dateInfo.text;
                      })()}
                    </span>
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5" style={{ color: '#236383' }} />
                <span
                  className="text-lg font-semibold"
                  style={{ color: '#236383' }}
                >
                  {request.firstName} {request.lastName}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5" style={{ color: '#236383' }} />
                <span
                  className="text-base font-medium"
                  style={{ color: '#236383' }}
                >
                  {request.email}
                </span>
              </div>
              {request.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-5 h-5" style={{ color: '#236383' }} />
                  <span
                    className="text-base font-medium"
                    style={{ color: '#236383' }}
                  >
                    {request.phone}
                  </span>
                </div>
              )}
              
              {/* Event Address */}
              {request.eventAddress && (
                <div className="flex items-center space-x-2">
                  <Building className="w-5 h-5" style={{ color: '#236383' }} />
                  <a
                    href={`https://maps.google.com/maps?q=${encodeURIComponent(
                      request.eventAddress
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    📍 {request.eventAddress}
                  </a>
                </div>
              )}

              {/* Event Times */}
              {((request as any).eventStartTime || (request as any).eventEndTime || (request as any).pickupTime) && (
                <div className="space-y-1">
                  {(request as any).eventStartTime && (
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5" style={{ color: '#236383' }} />
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Starts: {(() => {
                          try {
                            const [hours, minutes] = (request as any).eventStartTime.split(':');
                            const time = new Date();
                            time.setHours(parseInt(hours), parseInt(minutes));
                            return time.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            });
                          } catch {
                            return (request as any).eventStartTime;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                  {(request as any).eventEndTime && (
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5" style={{ color: '#236383' }} />
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Ends: {(() => {
                          try {
                            const [hours, minutes] = (request as any).eventEndTime.split(':');
                            const time = new Date();
                            time.setHours(parseInt(hours), parseInt(minutes));
                            return time.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            });
                          } catch {
                            return (request as any).eventEndTime;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                  {(request as any).pickupTime && (
                    <div className="flex items-center space-x-2">
                      <Truck className="w-5 h-5" style={{ color: '#236383' }} />
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Pickup: {(() => {
                          try {
                            const [hours, minutes] = (request as any).pickupTime.split(':');
                            const time = new Date();
                            time.setHours(parseInt(hours), parseInt(minutes));
                            return time.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            });
                          } catch {
                            return (request as any).pickupTime;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Sandwich Information */}
              {(request.estimatedSandwichCount || request.sandwichTypes) && (
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🥪</span>
                  <span className="text-base font-medium" style={{ color: '#236383' }}>
                    {(() => {
                      const summary = getSandwichTypesSummary(request);
                      return summary.hasBreakdown ? (
                        <span>
                          {summary.total} sandwiches ({summary.breakdown})
                        </span>
                      ) : (
                        <span>{summary.total || 'Unknown'} sandwiches</span>
                      );
                    })()}
                  </span>
                </div>
              )}

              {/* Assignments Summary */}
              {(() => {
                const assignments = [];
                
                // Van Driver
                if ((request as any).vanDriverNeeded) {
                  const hasVanDriver = (request as any).assignedVanDriverId || (request as any).customVanDriverName;
                  assignments.push(
                    <div key="van-driver" className="flex items-center space-x-2">
                      <Truck className="w-5 h-5" style={{ color: '#236383' }} />
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Van Driver: {hasVanDriver ? '✓ Assigned' : '⚠️ Needed'}
                      </span>
                    </div>
                  );
                }

                // Regular Drivers
                if ((request as any).driversNeeded > 0) {
                  const driverIds = (request as any).assignedDriverIds || [];
                  const driversNeeded = (request as any).driversNeeded || 0;
                  const status = driverIds.length >= driversNeeded ? '✓ Arranged' : '⚠️ Needed';
                  assignments.push(
                    <div key="drivers" className="flex items-center space-x-2">
                      <Users className="w-5 h-5" style={{ color: '#236383' }} />
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Drivers ({driversNeeded}): {status}
                      </span>
                    </div>
                  );
                }

                // Speakers
                if ((request as any).speakersNeeded > 0) {
                  const userSpeakers = (request as any).assignedSpeakerIds || [];
                  const driverSpeakers = (request as any).assignedDriverSpeakers || [];
                  const totalSpeakers = userSpeakers.length + driverSpeakers.length;
                  const speakersNeeded = (request as any).speakersNeeded || 0;
                  const status = totalSpeakers >= speakersNeeded ? '✓ Arranged' : '⚠️ Needed';
                  assignments.push(
                    <div key="speakers" className="flex items-center space-x-2">
                      <Users className="w-5 h-5" style={{ color: '#236383' }} />
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Speakers ({speakersNeeded}): {status}
                      </span>
                    </div>
                  );
                }

                // Volunteers
                if ((request as any).volunteersNeeded) {
                  const assignedVolunteers = (request as any).assignedVolunteerIds || [];
                  const status = assignedVolunteers.length > 0 ? '✓ Assigned' : '⚠️ Needed';
                  assignments.push(
                    <div key="volunteers" className="flex items-center space-x-2">
                      <Users className="w-5 h-5" style={{ color: '#236383' }} />
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Volunteers: {status}
                      </span>
                    </div>
                  );
                }

                return assignments;
              })()}

              {/* Additional Information */}
              {(request.hasRefrigeration !== undefined || (request as any).toolkitStatus) && (
                <div className="space-y-1">
                  {request.hasRefrigeration !== undefined && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">❄️</span>
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Refrigeration: {
                          request.hasRefrigeration === true
                            ? '✓ Available'
                            : request.hasRefrigeration === false
                            ? '❌ None'
                            : '❓ Unknown'
                        }
                      </span>
                    </div>
                  )}
                  {(request as any).toolkitStatus && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">📋</span>
                      <span className="text-base font-medium" style={{ color: '#236383' }}>
                        Toolkit: {(() => {
                          const status = (request as any).toolkitStatus;
                          switch (status) {
                            case 'sent':
                              return '✓ Delivered';
                            case 'received_confirmed':
                              return '✓ Confirmed';
                            case 'not_needed':
                              return 'N/A';
                            case 'not_sent':
                              return 'Not Sent';
                            default:
                              return '⚠️ Pending';
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {getStatusDisplay(request.status)}
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedRequest(request);
                  setCurrentEditingStatus(request.status);
                  setShowEditDialog(true);
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteRequest(request)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                title="Delete event request"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  // Render functions for different card types

};
