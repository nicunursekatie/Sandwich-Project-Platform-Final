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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold">Event Planning</h1>
          <div className="flex flex-col gap-3">
            {/* Weekly Planning Button - Separated for prominence */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="default"
                onClick={() => setActiveTab('forecast')}
                className="bg-gradient-to-r from-brand-primary to-brand-teal text-white hover:from-brand-primary-dark hover:to-[#005a66] border-0 font-semibold"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="ml-2">Weekly Planning</span>
              </Button>
            </div>
            {/* Data Management Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://docs.google.com/spreadsheets/d/${
                      import.meta.env.VITE_EVENT_REQUESTS_SHEET_ID ||
                      '1WYHS8Yj9Ef8SFDkVnf4bqWn-gjo94KqU-btEcyju4Q0'
                    }/edit`,
                    '_blank'
                  )
                }
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline sm:ml-2">
                  Open Google Sheet
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncToSheetsMutation.mutate()}
                disabled={syncToSheetsMutation.isPending}
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline sm:ml-2">
                  {syncToSheetsMutation.isPending
                    ? 'Syncing...'
                    : 'Sync to Sheets'}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncFromSheetsMutation.mutate()}
                disabled={syncFromSheetsMutation.isPending}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline sm:ml-2">
                  {syncFromSheetsMutation.isPending
                    ? 'Syncing...'
                    : 'Sync from Sheets'}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => importScheduledEventsMutation.mutate()}
                disabled={importScheduledEventsMutation.isPending}
                className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <CalendarPlus className="w-4 h-4" />
                <span className="hidden sm:inline sm:ml-2">
                  {importScheduledEventsMutation.isPending
                    ? 'Importing...'
                    : 'Import Scheduled Events'}
                </span>
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Event Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Event Request</DialogTitle>
              <DialogDescription>
                Create a new event request from an organization
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input name="firstName" required />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input name="lastName" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input name="phone" type="tel" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input name="organizationName" required />
                </div>
                <div>
                  <Label htmlFor="department">Department (Optional)</Label>
                  <Input name="department" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="desiredEventDate">Desired Event Date</Label>
                  <Input name="desiredEventDate" type="date" />
                </div>
                <div>
                  <Label htmlFor="previouslyHosted">
                    Previously Hosted Event?
                  </Label>
                  <Select name="previouslyHosted" defaultValue="no">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {previouslyHostedOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="message">
                  Additional Information (Optional)
                </Label>
                <Textarea name="message" rows={3} />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending
                    ? 'Creating...'
                    : 'Create Event Request'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto p-1 grid grid-cols-2 sm:grid-cols-4 gap-1">
            <TabsTrigger
              value="requests"
              className="relative flex-1 px-2 py-2 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">New Requests</span>
              <span className="sm:hidden">New</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {requestsEvents.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="in_process"
              className="relative flex-1 px-2 py-2 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">In Process</span>
              <span className="sm:hidden">Process</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {inProcessEvents.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="scheduled"
              className="relative flex-1 px-2 py-2 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Scheduled</span>
              <span className="sm:hidden">Schedule</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {scheduledEvents.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="relative flex-1 px-2 py-2 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Past Events</span>
              <span className="sm:hidden">Past</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {pastEvents.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            {/* Search Bar */}
            <div className="mb-6 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={
                    globalSearch
                      ? 'Search across all events...'
                      : 'Search within current tab...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 min-h-[44px] text-base"
                  data-testid="search-events-input"
                />
              </div>
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="globalSearch"
                    checked={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.checked)}
                    className="rounded border-gray-300 focus:ring-teal-500 mt-0.5"
                  />
                  <label
                    htmlFor="globalSearch"
                    className="text-sm text-gray-600 cursor-pointer leading-5"
                  >
                    Search across all events (not just current tab)
                  </label>
                </div>

                {/* Status Filter */}
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="statusFilter"
                    className="text-sm text-gray-600 whitespace-nowrap"
                  >
                    Filter:
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Requests</SelectItem>
                      <SelectItem value="responsive">
                        Responsive Only
                      </SelectItem>
                      <SelectItem value="unresponsive">
                        Unresponsive Only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {globalSearch && searchTerm && (
                <div className="text-sm text-teal-600 bg-teal-50 p-2 rounded">
                  Global search active - showing results from all events
                  regardless of tab
                </div>
              )}
            </div>

            {/* Sorting Controls */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 flex-wrap gap-2 sm:gap-4">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-700">
                    Sort by:
                  </span>

                  {/* Sort Field Selector */}
                  <Select
                    value={
                      activeTab === 'requests'
                        ? requestsSortBy
                        : activeTab === 'in_process'
                          ? inProcessSortBy
                          : activeTab === 'scheduled'
                            ? scheduledSortBy
                            : activeTab === 'past'
                              ? pastSortBy
                              : requestsSortBy
                    }
                    onValueChange={(
                      value: 'date' | 'organization' | 'contact'
                    ) => {
                      if (activeTab === 'requests') {
                        setRequestsSortBy(value);
                      } else if (activeTab === 'in_process') {
                        setInProcessSortBy(value);
                      } else if (activeTab === 'scheduled') {
                        setScheduledSortBy(value);
                      } else if (activeTab === 'past') {
                        setPastSortBy(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[140px] min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="contact">Contact Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Order Buttons */}
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Order:</span>
                  <div className="flex border rounded-md overflow-hidden flex-1 sm:flex-none">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`px-3 py-2 sm:py-1 rounded-none border-r min-h-[44px] sm:min-h-auto flex-1 sm:flex-none ${
                        (activeTab === 'requests'
                          ? requestsSortOrder
                          : activeTab === 'in_process'
                            ? inProcessSortOrder
                            : activeTab === 'scheduled'
                              ? scheduledSortOrder
                              : activeTab === 'past'
                                ? pastSortOrder
                                : requestsSortOrder) === 'asc'
                          ? 'bg-brand-primary text-white'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        if (activeTab === 'requests') {
                          setRequestsSortOrder('asc');
                        } else if (activeTab === 'in_process') {
                          setInProcessSortOrder('asc');
                        } else if (activeTab === 'scheduled') {
                          setScheduledSortOrder('asc');
                        } else if (activeTab === 'past') {
                          setPastSortOrder('asc');
                        }
                      }}
                      data-testid="sort-ascending"
                    >
                      <ArrowUp className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Ascending</span>
                      <span className="sm:hidden">Asc</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`px-3 py-2 sm:py-1 rounded-none min-h-[44px] sm:min-h-auto flex-1 sm:flex-none ${
                        (activeTab === 'requests'
                          ? requestsSortOrder
                          : activeTab === 'in_process'
                            ? inProcessSortOrder
                            : activeTab === 'scheduled'
                              ? scheduledSortOrder
                              : activeTab === 'past'
                                ? pastSortOrder
                                : requestsSortOrder) === 'desc'
                          ? 'bg-brand-primary text-white'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        if (activeTab === 'requests') {
                          setRequestsSortOrder('desc');
                        } else if (activeTab === 'in_process') {
                          setInProcessSortOrder('desc');
                        } else if (activeTab === 'scheduled') {
                          setScheduledSortOrder('desc');
                        } else if (activeTab === 'past') {
                          setPastSortOrder('desc');
                        }
                      }}
                      data-testid="sort-descending"
                    >
                      <ArrowUp className="w-4 h-4 mr-1 transform rotate-180" />
                      <span className="hidden sm:inline">Descending</span>
                      <span className="sm:hidden">Desc</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <TabsContent value="requests" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm
                    ? `Showing ${filteredRequests.length} event${
                        filteredRequests.length !== 1 ? 's' : ''
                      } from global search`
                    : `Showing ${filteredRequests.length} new event request${
                        filteredRequests.length !== 1 ? 's' : ''
                      } needing contact`}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRequestsSortBy(
                        requestsSortBy === 'date' ? 'organization' : 'date'
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {requestsSortBy === 'date' ? (
                      <>
                        <Calendar className="h-4 w-4" />
                        Submission Date
                      </>
                    ) : (
                      <>
                        <Building className="h-4 w-4" />
                        Organization
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRequestsSortOrder(
                        requestsSortOrder === 'desc' ? 'asc' : 'desc'
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {requestsSortOrder === 'desc' ? (
                      <>
                        Newest First
                        <ChevronDown className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Oldest First
                        <ChevronUp className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No event requests found.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map((request: EventRequest) =>
                    renderStandardEventCard(request)
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="followed_up" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm
                    ? `Showing ${filteredRequests.length} event${
                        filteredRequests.length !== 1 ? 's' : ''
                      } from global search`
                    : `Showing ${filteredRequests.length} followed up event${
                        filteredRequests.length !== 1 ? 's' : ''
                      }`}
                </div>
              </div>
              {filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">
                      No followed up events found.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map((request: EventRequest) =>
                    renderStandardEventCard(request)
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="in_process" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm
                    ? `Showing ${filteredRequests.length} event${
                        filteredRequests.length !== 1 ? 's' : ''
                      } from global search`
                    : `Showing ${filteredRequests.length} in process event${
                        filteredRequests.length !== 1 ? 's' : ''
                      }`}
                </div>
              </div>
              {filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No in process events found.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map((request: EventRequest) =>
                    renderStandardEventCard(request)
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm
                    ? `Showing ${filteredRequests.length} event${
                        filteredRequests.length !== 1 ? 's' : ''
                      } from global search`
                    : `Showing ${filteredRequests.length} scheduled event${
                        filteredRequests.length !== 1 ? 's' : ''
                      }`}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setScheduledSortBy(
                        scheduledSortBy === 'date' ? 'organization' : 'date'
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {scheduledSortBy === 'date' ? (
                      <>
                        <Calendar className="h-4 w-4" />
                        Date
                      </>
                    ) : (
                      <>
                        <Building className="h-4 w-4" />
                        Organization
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setScheduledSortOrder(
                        scheduledSortOrder === 'desc' ? 'asc' : 'desc'
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {scheduledSortOrder === 'desc' ? (
                      <>
                        Newest First
                        <ChevronDown className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Oldest First
                        <ChevronUp className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No scheduled events found.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map((request: EventRequest) =>
                    renderScheduledEventCard(request)
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm ? (
                    `Showing ${filteredRequests.length} event${
                      filteredRequests.length !== 1 ? 's' : ''
                    } from global search`
                  ) : pastEventsPagination.totalItems > 0 ? (
                    <>
                      Showing {pastEventsPagination.startItem}-
                      {pastEventsPagination.endItem} of{' '}
                      {pastEventsPagination.totalItems} past event
                      {pastEventsPagination.totalItems !== 1 ? 's' : ''}
                    </>
                  ) : (
                    'No past events found'
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPastSortBy(
                        pastSortBy === 'date' ? 'organization' : 'date'
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {pastSortBy === 'date' ? (
                      <>
                        <Calendar className="h-4 w-4" />
                        Date
                      </>
                    ) : (
                      <>
                        <Building className="h-4 w-4" />
                        Organization
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPastEventsSortOrder(
                        pastEventsSortOrder === 'desc' ? 'asc' : 'desc'
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {pastEventsSortOrder === 'desc' ? (
                      <>
                        Newest First
                        <ChevronDown className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Oldest First
                        <ChevronUp className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {paginatedPastEvents.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No past events found.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-4">
                    {paginatedPastEvents.map((request: EventRequest) =>
                      renderPastEventCard(request)
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {pastEventsPagination.totalPages > 1 && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      {/* Mobile-first design with responsive layout */}
                      <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                        {/* Previous button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPastEventsPage(Math.max(1, pastEventsPage - 1))
                          }
                          disabled={pastEventsPage === 1}
                          className="flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>

                        {/* Page info - responsive layout */}
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-sm text-gray-600 hidden sm:inline">
                            Page
                          </span>

                          {/* Smart pagination - show fewer numbers on mobile */}
                          <div className="flex space-x-1">
                            {(() => {
                              const currentPage = pastEventsPage;
                              const totalPages =
                                pastEventsPagination.totalPages;
                              const isMobile = window.innerWidth < 640; // Tailwind's sm breakpoint
                              const maxVisible = isMobile ? 3 : 5; // Show fewer on mobile

                              if (totalPages <= maxVisible) {
                                // Show all pages if we have few enough
                                return Array.from(
                                  { length: totalPages },
                                  (_, i) => i + 1
                                ).map((pageNum) => (
                                  <Button
                                    key={pageNum}
                                    variant={
                                      pageNum === currentPage
                                        ? 'default'
                                        : 'outline'
                                    }
                                    size="sm"
                                    onClick={() => setPastEventsPage(pageNum)}
                                    className="w-8 h-8 p-0 text-xs"
                                  >
                                    {pageNum}
                                  </Button>
                                ));
                              } else {
                                // Smart truncation for many pages
                                const pages = [];
                                const showEllipsis = totalPages > maxVisible;

                                if (currentPage <= 3) {
                                  // Near beginning
                                  for (
                                    let i = 1;
                                    i <= Math.min(maxVisible - 1, totalPages);
                                    i++
                                  ) {
                                    pages.push(
                                      <Button
                                        key={i}
                                        variant={
                                          i === currentPage
                                            ? 'default'
                                            : 'outline'
                                        }
                                        size="sm"
                                        onClick={() => setPastEventsPage(i)}
                                        className="w-8 h-8 p-0 text-xs"
                                      >
                                        {i}
                                      </Button>
                                    );
                                  }
                                  if (showEllipsis && totalPages > maxVisible) {
                                    pages.push(
                                      <span
                                        key="ellipsis1"
                                        className="text-gray-400 text-xs"
                                      >
                                        ...
                                      </span>
                                    );
                                    pages.push(
                                      <Button
                                        key={totalPages}
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setPastEventsPage(totalPages)
                                        }
                                        className="w-8 h-8 p-0 text-xs"
                                      >
                                        {totalPages}
                                      </Button>
                                    );
                                  }
                                } else if (currentPage >= totalPages - 2) {
                                  // Near end
                                  pages.push(
                                    <Button
                                      key={1}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setPastEventsPage(1)}
                                      className="w-8 h-8 p-0 text-xs"
                                    >
                                      1
                                    </Button>
                                  );
                                  if (showEllipsis) {
                                    pages.push(
                                      <span
                                        key="ellipsis2"
                                        className="text-gray-400 text-xs"
                                      >
                                        ...
                                      </span>
                                    );
                                  }
                                  for (
                                    let i = Math.max(
                                      totalPages - maxVisible + 2,
                                      2
                                    );
                                    i <= totalPages;
                                    i++
                                  ) {
                                    pages.push(
                                      <Button
                                        key={i}
                                        variant={
                                          i === currentPage
                                            ? 'default'
                                            : 'outline'
                                        }
                                        size="sm"
                                        onClick={() => setPastEventsPage(i)}
                                        className="w-8 h-8 p-0 text-xs"
                                      >
                                        {i}
                                      </Button>
                                    );
                                  }
                                } else {
                                  // In middle
                                  pages.push(
                                    <Button
                                      key={1}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setPastEventsPage(1)}
                                      className="w-8 h-8 p-0 text-xs"
                                    >
                                      1
                                    </Button>
                                  );
                                  if (currentPage > 3) {
                                    pages.push(
                                      <span
                                        key="ellipsis3"
                                        className="text-gray-400 text-xs"
                                      >
                                        ...
                                      </span>
                                    );
                                  }

                                  const start = Math.max(2, currentPage - 1);
                                  const end = Math.min(
                                    totalPages - 1,
                                    currentPage + 1
                                  );
                                  for (let i = start; i <= end; i++) {
                                    pages.push(
                                      <Button
                                        key={i}
                                        variant={
                                          i === currentPage
                                            ? 'default'
                                            : 'outline'
                                        }
                                        size="sm"
                                        onClick={() => setPastEventsPage(i)}
                                        className="w-8 h-8 p-0 text-xs"
                                      >
                                        {i}
                                      </Button>
                                    );
                                  }

                                  if (currentPage < totalPages - 2) {
                                    pages.push(
                                      <span
                                        key="ellipsis4"
                                        className="text-gray-400 text-xs"
                                      >
                                        ...
                                      </span>
                                    );
                                  }
                                  pages.push(
                                    <Button
                                      key={totalPages}
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setPastEventsPage(totalPages)
                                      }
                                      className="w-8 h-8 p-0 text-xs"
                                    >
                                      {totalPages}
                                    </Button>
                                  );
                                }
                                return pages;
                              }
                            })()}
                          </div>

                          <span className="text-sm text-gray-600">
                            <span className="hidden sm:inline">
                              of {pastEventsPagination.totalPages}
                            </span>
                            <span className="sm:hidden">
                              {pastEventsPage}/{pastEventsPagination.totalPages}
                            </span>
                          </span>
                        </div>

                        {/* Next button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPastEventsPage(
                              Math.min(
                                pastEventsPagination.totalPages,
                                pastEventsPage + 1
                              )
                            )
                          }
                          disabled={
                            pastEventsPage === pastEventsPagination.totalPages
                          }
                          className="flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="forecast" className="space-y-4">
              <SandwichForecastWidget />
            </TabsContent>
          </div>
        </Tabs>

        {/* Separate Section for Other Event Categories */}
        {(declinedEvents.length > 0 ||
          unresponsiveEvents.length > 0 ||
          otherEvents.length > 0) && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Other Event Categories
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Declined Events */}
              {declinedEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      Declined Events
                      <Badge variant="secondary">{declinedEvents.length}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Events that were declined or canceled
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {declinedEvents.map((request: EventRequest) => (
                        <div
                          key={request.id}
                          className="p-3 bg-red-50 border border-red-200 rounded-lg"
                        >
                          <div className="font-medium text-sm">
                            {request.organizationName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {request.firstName} {request.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {request.desiredEventDate
                              ? formatEventDate(request.desiredEventDate).text
                              : 'No date specified'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Unresponsive Events */}
              {unresponsiveEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Unresponsive Events
                      <Badge variant="secondary">
                        {unresponsiveEvents.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Events where contact was lost or no response received
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {unresponsiveEvents.map((request: EventRequest) => (
                        <div
                          key={request.id}
                          className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                        >
                          <div className="font-medium text-sm">
                            {request.organizationName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {request.firstName} {request.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {request.desiredEventDate
                              ? formatEventDate(request.desiredEventDate).text
                              : 'No date specified'}
                          </div>
                          {request.unresponsiveReason && (
                            <div className="text-xs text-yellow-700 mt-1">
                              {request.unresponsiveReason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Other/Review Events */}
              {otherEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      Other/Review
                      <Badge variant="secondary">{otherEvents.length}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Events with unusual statuses that need review
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {otherEvents.map((request: EventRequest) => (
                        <div
                          key={request.id}
                          className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="font-medium text-sm">
                            {request.organizationName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {request.firstName} {request.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {request.desiredEventDate
                              ? formatEventDate(request.desiredEventDate).text
                              : 'No date specified'}
                          </div>
                          <div className="text-xs text-blue-700 mt-1">
                            Status: {request.status || 'No status'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        {showEditDialog && selectedRequest && (
          <Dialog
            key={selectedRequest.id}
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Event Request</DialogTitle>
                <DialogDescription>
                  Update event request information
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      name="firstName"
                      defaultValue={selectedRequest.firstName}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      name="lastName"
                      defaultValue={selectedRequest.lastName}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      name="email"
                      type="email"
                      defaultValue={(() => {
                        // Always get the latest data from cache instead of stale snapshot
                        const latestData = eventRequests.find(
                          (req) => req.id === selectedRequest?.id
                        );
                        return (
                          latestData?.email || selectedRequest?.email || ''
                        );
                      })()}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      name="phone"
                      type="tel"
                      defaultValue={selectedRequest.phone || ''}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="organizationName">Organization Name</Label>
                    <Input
                      name="organizationName"
                      defaultValue={selectedRequest.organizationName}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      name="department"
                      defaultValue={selectedRequest.department || ''}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="desiredEventDate">Desired Event Date</Label>
                    <Input
                      name="desiredEventDate"
                      type="date"
                      defaultValue={
                        selectedRequest.desiredEventDate
                          ? selectedRequest.desiredEventDate.split('T')[0]
                          : ''
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="previouslyHosted">
                      Previously Hosted Event?
                    </Label>
                    <select
                      name="previouslyHosted"
                      defaultValue={selectedRequest.previouslyHosted}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {previouslyHostedOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    name="status"
                    defaultValue={currentEditingStatus}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="eventAddress">Event Address</Label>
                  <Input
                    name="eventAddress"
                    defaultValue={(selectedRequest as any).eventAddress || ''}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estimatedSandwichCount">
                      Number of Sandwiches
                    </Label>
                    <Input
                      name="estimatedSandwichCount"
                      type="number"
                      defaultValue={
                        selectedRequest.estimatedSandwichCount || ''
                      }
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hasRefrigeration">
                      Refrigeration Available?
                    </Label>
                    <select
                      name="hasRefrigeration"
                      defaultValue={
                        selectedRequest.hasRefrigeration?.toString() || ''
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select option</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="eventStartTime">Event Start Time</Label>
                    <Input
                      name="eventStartTime"
                      type="time"
                      defaultValue={
                        (selectedRequest as any).eventStartTime || ''
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventEndTime">Event End Time</Label>
                    <Input
                      name="eventEndTime"
                      type="time"
                      defaultValue={(selectedRequest as any).eventEndTime || ''}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pickupTime">Pickup Time</Label>
                    <Input
                      name="pickupTime"
                      type="time"
                      defaultValue={(selectedRequest as any).pickupTime || ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sandwichTypes">
                      Sandwich Types & Quantities
                    </Label>
                    <SandwichTypesSelector
                      name="sandwichTypes"
                      defaultValue={(selectedRequest as any).sandwichTypes}
                      estimatedCount={
                        (selectedRequest as any).estimatedSandwichCount
                      }
                    />
                  </div>
                </div>
                {/* Sandwich Destination */}
                <div>
                  <Label htmlFor="deliveryDestination">
                    Sandwich Destination
                  </Label>
                  <Input
                    name="deliveryDestination"
                    defaultValue={
                      (selectedRequest as any).deliveryDestination || ''
                    }
                    placeholder="Final delivery location (organization, address, etc.)"
                  />
                </div>

                {/* Transportation Workflow */}
                <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800">
                    🚛 Transportation Plan
                  </h3>
                  <p className="text-sm text-gray-600">
                    Many events involve temporary storage at a host location
                    before final delivery
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="storageLocation">
                        Overnight Storage Location (Optional)
                      </Label>
                      <Input
                        name="storageLocation"
                        defaultValue={
                          (selectedRequest as any).storageLocation || ''
                        }
                        placeholder="Host location for overnight storage"
                      />
                    </div>
                    <div>
                      <Label htmlFor="finalDeliveryMethod">
                        Final Delivery Method
                      </Label>
                      <select
                        name="finalDeliveryMethod"
                        defaultValue={
                          (selectedRequest as any).finalDeliveryMethod || ''
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select delivery method</option>
                        <option value="direct_delivery">
                          Direct from event to recipient
                        </option>
                        <option value="pickup_by_recipient">
                          Pickup by recipient from storage
                        </option>
                        <option value="driver_delivery">
                          Driver delivery from storage
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Drivers Section */}
                <div className="space-y-4 border rounded-lg p-4 bg-blue-50">
                  <h3 className="text-lg font-semibold text-blue-800">
                    🚗 Drivers
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="driversNeeded">
                        How Many Drivers Needed?
                      </Label>
                      <Input
                        name="driversNeeded"
                        type="number"
                        min="0"
                        defaultValue={
                          (selectedRequest as any).driversNeeded || 0
                        }
                        placeholder="Number of drivers needed"
                      />
                    </div>
                    <div>
                      <Label>Assigned Drivers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentDrivers =
                                (selectedRequest as any).assignedDriverIds ||
                                [];
                              const updatedDrivers = [
                                ...currentDrivers,
                                e.target.value,
                              ];
                              // Update the selectedRequest temporarily for display
                              (selectedRequest as any).assignedDriverIds =
                                updatedDrivers;
                              e.target.value = '';
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Or type custom driver name"
                          className="w-full text-sm border rounded px-2 py-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              const currentDrivers =
                                (selectedRequest as any).assignedDriverIds ||
                                [];
                              const updatedDrivers = [
                                ...currentDrivers,
                                e.target.value.trim(),
                              ];
                              (selectedRequest as any).assignedDriverIds =
                                updatedDrivers;
                              e.target.value = '';
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-1">
                          {(
                            (selectedRequest as any).assignedDriverIds || []
                          ).map((driverId: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                            >
                              {getUserDisplayName(driverId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedDrivers =
                                    (
                                      selectedRequest as any
                                    ).assignedDriverIds?.filter(
                                      (_: any, i: number) => i !== index
                                    ) || [];
                                  (selectedRequest as any).assignedDriverIds =
                                    updatedDrivers;
                                }}
                                className="ml-1 text-brand-primary hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Speakers Section */}
                <div className="space-y-4 border rounded-lg p-4 bg-green-50">
                  <h3 className="text-lg font-semibold text-green-800">
                    🎤 Speakers
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="speakersNeeded">
                        How Many Speakers Needed?
                      </Label>
                      <Input
                        name="speakersNeeded"
                        type="number"
                        min="0"
                        defaultValue={
                          (selectedRequest as any).speakersNeeded || 0
                        }
                        placeholder="Number of speakers needed"
                      />
                    </div>
                    <div>
                      <Label>Assigned Speakers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentSpeakers =
                                (selectedRequest as any).assignedSpeakerIds ||
                                [];
                              const updatedSpeakers = [
                                ...currentSpeakers,
                                e.target.value,
                              ];
                              (selectedRequest as any).assignedSpeakerIds =
                                updatedSpeakers;
                              e.target.value = '';
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Or type custom speaker name"
                          className="w-full text-sm border rounded px-2 py-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              const currentSpeakers =
                                (selectedRequest as any).assignedSpeakerIds ||
                                [];
                              const updatedSpeakers = [
                                ...currentSpeakers,
                                e.target.value.trim(),
                              ];
                              (selectedRequest as any).assignedSpeakerIds =
                                updatedSpeakers;
                              e.target.value = '';
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-1">
                          {(
                            (selectedRequest as any).assignedSpeakerIds || []
                          ).map((speakerId: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center bg-green-100 text-green-800 px-2 py-1 rounded text-xs"
                            >
                              {getUserDisplayName(speakerId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedSpeakers =
                                    (
                                      selectedRequest as any
                                    ).assignedSpeakerIds?.filter(
                                      (_: any, i: number) => i !== index
                                    ) || [];
                                  (selectedRequest as any).assignedSpeakerIds =
                                    updatedSpeakers;
                                }}
                                className="ml-1 text-green-600 hover:text-green-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Volunteers Section */}
                <div className="space-y-4 border rounded-lg p-4 bg-purple-50">
                  <h3 className="text-lg font-semibold text-purple-800">
                    🙋‍♀️ Volunteers
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="volunteersNeeded">
                        Volunteers Needed?
                      </Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <input
                          type="checkbox"
                          name="volunteersNeeded"
                          defaultChecked={
                            (selectedRequest as any).volunteersNeeded || false
                          }
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">
                          Yes, volunteers are needed for this event
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label>Assigned Volunteers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentVolunteers =
                                (selectedRequest as any).assignedVolunteerIds ||
                                [];
                              const updatedVolunteers = [
                                ...currentVolunteers,
                                e.target.value,
                              ];
                              (selectedRequest as any).assignedVolunteerIds =
                                updatedVolunteers;
                              e.target.value = '';
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Or type custom volunteer name"
                          className="w-full text-sm border rounded px-2 py-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              const currentVolunteers =
                                (selectedRequest as any).assignedVolunteerIds ||
                                [];
                              const updatedVolunteers = [
                                ...currentVolunteers,
                                e.target.value.trim(),
                              ];
                              (selectedRequest as any).assignedVolunteerIds =
                                updatedVolunteers;
                              e.target.value = '';
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-1">
                          {(
                            (selectedRequest as any).assignedVolunteerIds || []
                          ).map((volunteerId: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs"
                            >
                              {getUserDisplayName(volunteerId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedVolunteers =
                                    (
                                      selectedRequest as any
                                    ).assignedVolunteerIds?.filter(
                                      (_: any, i: number) => i !== index
                                    ) || [];
                                  (
                                    selectedRequest as any
                                  ).assignedVolunteerIds = updatedVolunteers;
                                }}
                                className="ml-1 text-purple-600 hover:text-purple-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="additionalRequirements">
                    Special Requirements
                  </Label>
                  <Textarea
                    name="additionalRequirements"
                    rows={2}
                    defaultValue={
                      (selectedRequest as any).additionalRequirements || ''
                    }
                  />
                </div>

                {/* TSP Contact Assignment */}
                <div>
                  <Label className="text-base font-semibold">
                    TSP Contact Assignments
                  </Label>
                  <p className="text-sm text-gray-600 mb-3">
                    Assign one or more TSP team members to this event. Selected
                    users will see this event in their "My Actions" page.
                  </p>

                  {/* Primary TSP Contact */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label htmlFor="tspContact">Primary TSP Contact</Label>
                      <select
                        name="tspContact"
                        defaultValue={
                          (selectedRequest as any).tspContact || 'none'
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="none">No primary contact</option>
                        {users
                          .filter((user: any) => user.role !== 'recipient')
                          .map((user: any) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.email}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="tspContactAssigned">
                        Secondary Contact
                      </Label>
                      <select
                        name="tspContactAssigned"
                        defaultValue={
                          (selectedRequest as any).tspContactAssigned || 'none'
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="none">No secondary contact</option>
                        {users
                          .filter((user: any) => user.role !== 'recipient')
                          .map((user: any) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.email}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Additional TSP Contacts */}
                  <div className="space-y-3">
                    <Label htmlFor="additionalTspContacts">
                      Additional TSP Contacts
                    </Label>
                    <p className="text-xs text-gray-500">
                      Select additional team members for this event
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="additionalContact1">
                          Third Contact
                        </Label>
                        <select
                          name="additionalContact1"
                          defaultValue={
                            (selectedRequest as any).additionalContact1 ||
                            'none'
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="none">No third contact</option>
                          {users
                            .filter((user: any) => user.role !== 'recipient')
                            .map((user: any) => (
                              <option key={user.id} value={user.id}>
                                {user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.email}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="additionalContact2">
                          Fourth Contact
                        </Label>
                        <select
                          name="additionalContact2"
                          defaultValue={
                            (selectedRequest as any).additionalContact2 ||
                            'none'
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="none">No fourth contact</option>
                          {users
                            .filter((user: any) => user.role !== 'recipient')
                            .map((user: any) => (
                              <option key={user.id} value={user.id}>
                                {user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.email}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Custom Contact Info */}
                  <div className="mt-4">
                    <Label htmlFor="customTspContact">
                      Custom Contact Information
                    </Label>
                    <p className="text-xs text-gray-500">
                      Enter external contact details or special instructions
                    </p>
                    <Input
                      name="customTspContact"
                      placeholder="External contact name or special instructions"
                      defaultValue={
                        (selectedRequest as any).customTspContact || ''
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="message">Event Details</Label>
                  <Textarea
                    name="message"
                    rows={3}
                    defaultValue={selectedRequest.message || ''}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editMutation.isPending}>
                    {editMutation.isPending
                      ? 'Updating...'
                      : 'Update Event Request'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Complete Contact Dialog */}
        {showCompleteContactDialog && completingRequest && (
          <Dialog
            open={showCompleteContactDialog}
            onOpenChange={setShowCompleteContactDialog}
          >
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Complete Contact & Event Details</DialogTitle>
                <DialogDescription>
                  Record contact details and comprehensive event planning
                  information for {completingRequest.organizationName}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCompleteContact} className="space-y-6">
                {/* Communication Method */}
                <div>
                  <Label htmlFor="communicationMethod">
                    Communication Method
                  </Label>
                  <Select name="communicationMethod" defaultValue="">
                    <SelectTrigger>
                      <SelectValue placeholder="How did you contact them? (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_specified">
                        Not specified
                      </SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="text">Text Message</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Basic Event Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="eventAddress">
                      Event Location/Address (optional)
                    </Label>
                    <Input
                      name="eventAddress"
                      placeholder="Where will the event take place?"
                    />
                  </div>
                  <div>
                    <Label htmlFor="estimatedSandwichCount">
                      Estimated Sandwich Count (optional)
                    </Label>
                    <Input
                      name="estimatedSandwichCount"
                      type="number"
                      min="0"
                      placeholder="How many sandwiches needed?"
                    />
                  </div>
                </div>

                {/* Event Status and Toolkit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Event Status (optional)</Label>
                    <Select name="status" defaultValue="contact_completed">
                      <SelectTrigger>
                        <SelectValue placeholder="Set event status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contact_completed">
                          Contact Completed
                        </SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="toolkitStatus">
                      Toolkit Status (optional)
                    </Label>
                    <Select name="toolkitStatus" defaultValue="">
                      <SelectTrigger>
                        <SelectValue placeholder="Select toolkit status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_set">Not Set</SelectItem>
                        <SelectItem value="not_sent">Not Yet Sent</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="received_confirmed">
                          Received & Confirmed
                        </SelectItem>
                        <SelectItem value="not_needed">Not Needed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Event Times */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="eventStartTime">
                      Event Start Time (optional)
                    </Label>
                    <Input name="eventStartTime" type="time" />
                  </div>
                  <div>
                    <Label htmlFor="eventEndTime">
                      Event End Time (optional)
                    </Label>
                    <Input name="eventEndTime" type="time" />
                  </div>
                  <div>
                    <Label htmlFor="pickupTime">Pickup Time (optional)</Label>
                    <Input name="pickupTime" type="time" />
                  </div>
                </div>

                {/* Food Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sandwichTypes">
                      Sandwich Types/Preferences (optional)
                    </Label>
                    <SandwichTypesSelector
                      name="sandwichTypes"
                      estimatedCount={null}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hasRefrigeration">
                      Refrigeration Available? (optional)
                    </Label>
                    <Select name="hasRefrigeration" defaultValue="none">
                      <SelectTrigger>
                        <SelectValue placeholder="Is refrigeration available?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unknown</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* TSP Contact Assignment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tspContact">
                      TSP Team Contact (optional)
                    </Label>
                    <Select name="tspContact" defaultValue="">
                      <SelectTrigger>
                        <SelectValue placeholder="Assign team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_assignment">
                          No assignment
                        </SelectItem>
                        {users.map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.displayName || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="customTspContact">
                      Custom Contact (optional)
                    </Label>
                    <Input
                      name="customTspContact"
                      placeholder="External contact name or special instructions"
                    />
                  </div>
                </div>

                {/* Drivers and Speakers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="driversNeeded">
                      Drivers Needed (optional)
                    </Label>
                    <Input
                      name="driversNeeded"
                      type="number"
                      min="0"
                      defaultValue="0"
                      placeholder="Number of drivers needed"
                    />
                  </div>
                  <div>
                    <Label htmlFor="speakersNeeded">
                      Speakers Needed (optional)
                    </Label>
                    <Input
                      name="speakersNeeded"
                      type="number"
                      min="0"
                      defaultValue="0"
                      placeholder="Number of speakers needed"
                    />
                  </div>
                </div>

                {/* Additional Details */}
                <div>
                  <Label htmlFor="driverDetails">
                    Driver Details/Notes (optional)
                  </Label>
                  <Textarea
                    name="driverDetails"
                    rows={2}
                    placeholder="Driver arrangements, pickup instructions, or notes"
                  />
                </div>

                <div>
                  <Label htmlFor="speakerDetails">
                    Speaker Details/Notes (optional)
                  </Label>
                  <Textarea
                    name="speakerDetails"
                    rows={2}
                    placeholder="Speaker requirements or details"
                  />
                </div>

                <div>
                  <Label htmlFor="sandwichTypes">
                    Sandwich Types (optional)
                  </Label>
                  <Select name="sandwichTypes" defaultValue="">
                    <SelectTrigger>
                      <SelectValue placeholder="Select sandwich types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_specified">
                        Not specified
                      </SelectItem>
                      <SelectItem value="deli">Deli</SelectItem>
                      <SelectItem value="turkey">Turkey</SelectItem>
                      <SelectItem value="ham">Ham</SelectItem>
                      <SelectItem value="pbj">PB&J</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="planningNotes">
                    Additional Planning Notes (optional)
                  </Label>
                  <Textarea
                    name="planningNotes"
                    rows={3}
                    placeholder="Any additional planning notes or requirements"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCompleteContactDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={completeContactMutation.isPending}
                  >
                    {completeContactMutation.isPending
                      ? 'Saving...'
                      : 'Complete Contact & Event Details'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Event Details Dialog */}
        {showEventDetailsDialog && detailsRequest && (
          <Dialog
            open={showEventDetailsDialog}
            onOpenChange={setShowEventDetailsDialog}
          >
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Event Details for {detailsRequest.organizationName}
                </DialogTitle>
                <DialogDescription>
                  Complete or update the advanced event planning details
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCompleteEventDetails} className="space-y-4">
                {/* Organization Info Section */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    Organization Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="organizationName">
                        Organization Name
                      </Label>
                      <Input
                        name="organizationName"
                        defaultValue={detailsRequest.organizationName || ''}
                        placeholder="Enter organization name"
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Department (optional)</Label>
                      <Input
                        name="department"
                        defaultValue={detailsRequest.department || ''}
                        placeholder="Enter department if applicable"
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        name="firstName"
                        defaultValue={detailsRequest.firstName || ''}
                        placeholder="Contact first name"
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        name="lastName"
                        defaultValue={detailsRequest.lastName || ''}
                        placeholder="Contact last name"
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        name="email"
                        type="email"
                        key={`email-${detailsRequest?.id}-${Date.now()}`} // Force re-render when detailsRequest changes
                        defaultValue={(() => {
                          // Always get the latest data from cache instead of stale snapshot
                          const latestData = eventRequests.find(
                            (req) => req.id === detailsRequest?.id
                          );
                          const emailValue =
                            latestData?.email || detailsRequest?.email || '';
                          console.log(
                            `🔍 Email form field debug for event ${detailsRequest?.id}:`,
                            {
                              latestDataEmail: latestData?.email,
                              detailsRequestEmail: detailsRequest?.email,
                              finalEmailValue: emailValue,
                            }
                          );
                          return emailValue;
                        })()}
                        placeholder="Contact email address"
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        name="phone"
                        type="tel"
                        defaultValue={detailsRequest.phone || ''}
                        placeholder="Contact phone number"
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="toolkitStatus">Toolkit Status</Label>
                    <select
                      name="toolkitStatus"
                      defaultValue={detailsRequest.toolkitStatus || ''}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select toolkit status</option>
                      <option value="not_sent">Not Yet Sent</option>
                      <option value="sent">Sent</option>
                      <option value="received_confirmed">
                        Received & Confirmed
                      </option>
                      <option value="not_needed">Not Needed</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="status">Event Status</Label>
                    <select
                      name="status"
                      defaultValue={(() => {
                        // Always get the latest data from cache instead of stale snapshot
                        const latestData = eventRequests.find(
                          (req) => req.id === detailsRequest?.id
                        );
                        return (
                          latestData?.status || detailsRequest?.status || ''
                        );
                      })()}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select status</option>
                      <option value="new">New Request</option>
                      <option value="followed_up">Followed Up</option>
                      <option value="in_process">In Process</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="tspContact">TSP Team Contact</Label>
                    <select
                      name="tspContact"
                      defaultValue={detailsRequest.tspContact || ''}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select team member</option>
                      <option value="none">No assignment</option>
                      {users.map((user: any) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.displayName || user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="desiredEventDate">Event Date</Label>
                    <Input
                      name="desiredEventDate"
                      type="date"
                      defaultValue={
                        detailsRequest.desiredEventDate
                          ? detailsRequest.desiredEventDate.split('T')[0]
                          : ''
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventStartTime">Event Start Time</Label>
                    <Input
                      name="eventStartTime"
                      type="time"
                      defaultValue={detailsRequest.eventStartTime || ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventEndTime">Event End Time</Label>
                    <Input
                      name="eventEndTime"
                      type="time"
                      defaultValue={detailsRequest.eventEndTime || ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pickupTime">Pickup Time</Label>
                    <Input
                      name="pickupTime"
                      type="time"
                      defaultValue={detailsRequest.pickupTime || ''}
                    />
                  </div>
                </div>

                {/* Event Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="eventAddress">Event Address</Label>
                    <Input
                      name="eventAddress"
                      defaultValue={detailsRequest.eventAddress || ''}
                      placeholder="Where will the event take place?"
                    />
                  </div>
                </div>

                {/* Sandwich Destination */}
                <div>
                  <Label htmlFor="deliveryDestination">
                    Sandwich Destination
                  </Label>
                  <Input
                    name="deliveryDestination"
                    defaultValue={
                      (detailsRequest as any).deliveryDestination || ''
                    }
                    placeholder="Final delivery location (organization, address, etc.)"
                  />
                </div>

                {/* Transportation Workflow */}
                <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800">
                    🚛 Transportation Plan
                  </h3>
                  <p className="text-sm text-gray-600">
                    Many events involve temporary storage at a host location
                    before final delivery
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="storageLocation">
                        Overnight Storage Location (Optional)
                      </Label>
                      <Input
                        name="storageLocation"
                        defaultValue={
                          (detailsRequest as any).storageLocation || ''
                        }
                        placeholder="Host location for overnight storage"
                      />
                    </div>
                    <div>
                      <Label htmlFor="finalDeliveryMethod">
                        Final Delivery Method
                      </Label>
                      <select
                        name="finalDeliveryMethod"
                        defaultValue={
                          (detailsRequest as any).finalDeliveryMethod || ''
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select delivery method</option>
                        <option value="direct_delivery">
                          Direct from event to recipient
                        </option>
                        <option value="pickup_by_recipient">
                          Pickup by recipient from storage
                        </option>
                        <option value="driver_delivery">
                          Driver delivery from storage
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Drivers Section */}
                <div className="space-y-3 border rounded-lg p-3 bg-blue-50">
                  <h3 className="text-base font-semibold text-blue-800">
                    🚗 Drivers
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="driversNeeded">
                        How Many Drivers Needed?
                      </Label>
                      <Input
                        name="driversNeeded"
                        type="text"
                        defaultValue={
                          (detailsRequest as any).driversNeeded || 0
                        }
                        placeholder="0"
                        className="h-8 w-16 text-center"
                        pattern="[0-9]{1,2}"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label>Assigned Drivers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentDrivers =
                                (detailsRequest as any).assignedDriverIds || [];
                              const updatedDrivers = [
                                ...currentDrivers,
                                e.target.value,
                              ];
                              setDetailsRequest((prev) => ({
                                ...prev,
                                assignedDriverIds: updatedDrivers,
                              }));
                              e.target.value = '';
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1 h-8 bg-white"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName}
                            </option>
                          ))}
                        </select>
                        <div className="flex">
                          <input
                            type="text"
                            placeholder="Or type custom driver name"
                            className="flex-1 text-sm border rounded-l px-2 py-1 h-8"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target.value.trim()) {
                                e.preventDefault();
                                const currentDrivers =
                                  (detailsRequest as any).assignedDriverIds ||
                                  [];
                                const updatedDrivers = [
                                  ...currentDrivers,
                                  e.target.value.trim(),
                                ];
                                setDetailsRequest((prev) => ({
                                  ...prev,
                                  assignedDriverIds: updatedDrivers,
                                }));
                                e.target.value = '';
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="bg-green-500 hover:bg-green-600 text-white px-2 rounded-r text-sm h-8"
                            onClick={(e) => {
                              const input = e.currentTarget
                                .previousElementSibling as HTMLInputElement;
                              if (input.value.trim()) {
                                const currentDrivers =
                                  (detailsRequest as any).assignedDriverIds ||
                                  [];
                                const updatedDrivers = [
                                  ...currentDrivers,
                                  input.value.trim(),
                                ];
                                setDetailsRequest((prev) => ({
                                  ...prev,
                                  assignedDriverIds: updatedDrivers,
                                }));
                                input.value = '';
                              }
                            }}
                          >
                            ✓
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(
                            (detailsRequest as any).assignedDriverIds || []
                          ).map((driverId: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                            >
                              {getUserDisplayName(driverId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedDrivers =
                                    (
                                      detailsRequest as any
                                    ).assignedDriverIds?.filter(
                                      (_: any, i: number) => i !== index
                                    ) || [];
                                  setDetailsRequest((prev) => ({
                                    ...prev,
                                    assignedDriverIds: updatedDrivers,
                                  }));
                                }}
                                className="ml-1 text-brand-primary hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Speakers Section */}
                <div className="space-y-3 border rounded-lg p-3 bg-green-50">
                  <h3 className="text-base font-semibold text-green-800">
                    🎤 Speakers
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="speakersNeeded">
                        How Many Speakers Needed?
                      </Label>
                      <Input
                        name="speakersNeeded"
                        type="text"
                        defaultValue={
                          (detailsRequest as any).speakersNeeded || 0
                        }
                        placeholder="0"
                        className="h-8 w-16 text-center"
                        pattern="[0-9]{1,2}"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label>Assigned Speakers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentSpeakers =
                                (detailsRequest as any).assignedSpeakerIds ||
                                [];
                              const updatedSpeakers = [
                                ...currentSpeakers,
                                e.target.value,
                              ];
                              setDetailsRequest((prev) => ({
                                ...prev,
                                assignedSpeakerIds: updatedSpeakers,
                              }));
                              e.target.value = '';
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1 h-8 bg-white"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName}
                            </option>
                          ))}
                        </select>
                        <div className="flex">
                          <input
                            type="text"
                            placeholder="Or type custom speaker name"
                            className="flex-1 text-sm border rounded-l px-2 py-1 h-8"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target.value.trim()) {
                                e.preventDefault();
                                const currentSpeakers =
                                  (detailsRequest as any).assignedSpeakerIds ||
                                  [];
                                const updatedSpeakers = [
                                  ...currentSpeakers,
                                  e.target.value.trim(),
                                ];
                                setDetailsRequest((prev) => ({
                                  ...prev,
                                  assignedSpeakerIds: updatedSpeakers,
                                }));
                                e.target.value = '';
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="bg-green-500 hover:bg-green-600 text-white px-2 rounded-r text-sm h-8"
                            onClick={(e) => {
                              const input = e.currentTarget
                                .previousElementSibling as HTMLInputElement;
                              if (input.value.trim()) {
                                const currentSpeakers =
                                  (detailsRequest as any).assignedSpeakerIds ||
                                  [];
                                const updatedSpeakers = [
                                  ...currentSpeakers,
                                  input.value.trim(),
                                ];
                                setDetailsRequest((prev) => ({
                                  ...prev,
                                  assignedSpeakerIds: updatedSpeakers,
                                }));
                                input.value = '';
                              }
                            }}
                          >
                            ✓
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(
                            (detailsRequest as any).assignedSpeakerIds || []
                          ).map((speakerId: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center bg-green-100 text-green-800 px-2 py-1 rounded text-xs"
                            >
                              {getUserDisplayName(speakerId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedSpeakers =
                                    (
                                      detailsRequest as any
                                    ).assignedSpeakerIds?.filter(
                                      (_: any, i: number) => i !== index
                                    ) || [];
                                  setDetailsRequest((prev) => ({
                                    ...prev,
                                    assignedSpeakerIds: updatedSpeakers,
                                  }));
                                }}
                                className="ml-1 text-green-600 hover:text-green-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Volunteers Section */}
                <div className="space-y-3 border rounded-lg p-3 bg-purple-50">
                  <h3 className="text-base font-semibold text-purple-800">
                    👥 Volunteers
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="volunteersNeeded">
                        Volunteers Needed?
                      </Label>
                      <select
                        name="volunteersNeeded"
                        defaultValue={
                          (detailsRequest as any).volunteersNeeded
                            ? 'true'
                            : 'false'
                        }
                        className="h-8 w-full text-sm border rounded px-2"
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                    <div>
                      <Label>Assigned Volunteers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentVolunteers =
                                (detailsRequest as any).assignedVolunteerIds ||
                                [];
                              const updatedVolunteers = [
                                ...currentVolunteers,
                                e.target.value,
                              ];
                              setDetailsRequest((prev) => ({
                                ...prev,
                                assignedVolunteerIds: updatedVolunteers,
                              }));
                              e.target.value = '';
                            }
                          }}
                          className="h-8 w-full text-xs border rounded px-2"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Or type custom volunteer name"
                          className="h-8 w-full text-xs border rounded px-2"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                const currentVolunteers =
                                  (detailsRequest as any)
                                    .assignedVolunteerIds || [];
                                const updatedVolunteers = [
                                  ...currentVolunteers,
                                  input.value.trim(),
                                ];
                                setDetailsRequest((prev) => ({
                                  ...prev,
                                  assignedVolunteerIds: updatedVolunteers,
                                }));
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-1">
                          {(
                            (detailsRequest as any).assignedVolunteerIds || []
                          ).map((volunteerId: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs"
                            >
                              {availableUsers?.find((u) => u.id === volunteerId)
                                ?.displayName || volunteerId}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedVolunteers =
                                    (
                                      detailsRequest as any
                                    ).assignedVolunteerIds?.filter(
                                      (_: any, i: number) => i !== index
                                    ) || [];
                                  setDetailsRequest((prev) => ({
                                    ...prev,
                                    assignedVolunteerIds: updatedVolunteers,
                                  }));
                                }}
                                className="ml-1 text-purple-600 hover:text-purple-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="customTspContact">
                    Additional TSP Contact Info
                  </Label>
                  <Textarea
                    name="customTspContact"
                    rows={3}
                    defaultValue={detailsRequest.customTspContact}
                    placeholder="Add any additional contact details, phone numbers, or special instructions for this event..."
                  />
                </div>

                <div>
                  <Label htmlFor="planningNotes">
                    Planning Notes & Other Important Info
                  </Label>
                  <Textarea
                    name="planningNotes"
                    rows={4}
                    defaultValue={detailsRequest.planningNotes}
                    placeholder="Special requirements, logistics notes, follow-up tasks, or any other pertinent information for this event"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEventDetailsDialog(false);
                      setDetailsRequest(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={completeEventDetailsMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {completeEventDetailsMutation.isPending
                      ? 'Saving...'
                      : 'Save Event Details'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Comprehensive Scheduling Dialog */}
        {showSchedulingDialog && schedulingRequest && (
          <Dialog
            open={showSchedulingDialog}
            onOpenChange={setShowSchedulingDialog}
          >
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-teal-600" />
                  Schedule Event for {schedulingRequest.organizationName}
                </DialogTitle>
                <DialogDescription>
                  Complete all scheduling details to mark this event as
                  scheduled
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleScheduleEvent} className="space-y-6">
                {/* Event Date & Time Section */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-teal-50 to-cyan-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-teal-600" />
                    Event Date & Time
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="eventStartTime">Event Start Time</Label>
                      <Input
                        name="eventStartTime"
                        type="time"
                        defaultValue={schedulingRequest.eventStartTime || ''}
                        className="bg-white"
                        data-testid="input-event-start-time"
                      />
                    </div>
                    <div>
                      <Label htmlFor="eventEndTime">Event End Time</Label>
                      <Input
                        name="eventEndTime"
                        type="time"
                        defaultValue={schedulingRequest.eventEndTime || ''}
                        className="bg-white"
                        data-testid="input-event-end-time"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pickupTime">Pickup Time</Label>
                      <Input
                        name="pickupTime"
                        type="time"
                        defaultValue={schedulingRequest.pickupTime || ''}
                        className="bg-white"
                        data-testid="input-pickup-time"
                      />
                    </div>
                  </div>
                </div>

                {/* Event Location & Logistics Section */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center">
                    <Building className="h-4 w-4 mr-2 text-brand-primary" />
                    Location & Logistics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="eventAddress">Event Address</Label>
                      <Input
                        name="eventAddress"
                        defaultValue={schedulingRequest.eventAddress || ''}
                        placeholder="Full event address"
                        className="bg-white"
                        data-testid="input-event-address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deliveryDestination">
                        Delivery Destination
                      </Label>
                      <Input
                        name="deliveryDestination"
                        defaultValue={
                          schedulingRequest.deliveryDestination || ''
                        }
                        placeholder="Where sandwiches should be delivered"
                        className="bg-white"
                        data-testid="input-delivery-destination"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="hasRefrigeration">
                      Refrigeration Available?
                    </Label>
                    {/* Hidden input for form submission */}
                    <input
                      type="hidden"
                      name="hasRefrigeration"
                      value={markScheduledFormData.hasRefrigeration}
                    />
                    <Select
                      value={markScheduledFormData.hasRefrigeration}
                      onValueChange={(value) =>
                        setMarkScheduledFormData((prev) => ({
                          ...prev,
                          hasRefrigeration: value || '',
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="true">
                          Yes - refrigeration available
                        </SelectItem>
                        <SelectItem value="false">
                          No - no refrigeration
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Sandwich Details Section */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-orange-50 to-amber-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2 text-orange-600" />
                    Sandwich Requirements
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="estimatedSandwichCount">
                        Estimated Sandwich Count
                      </Label>
                      <Input
                        name="estimatedSandwichCount"
                        type="number"
                        min="0"
                        defaultValue={
                          schedulingRequest.estimatedSandwichCount || ''
                        }
                        placeholder="Total number of sandwiches needed"
                        className="bg-white"
                        data-testid="input-sandwich-count"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">
                          Sandwich Types
                        </Label>
                        <div className="text-xs text-gray-600 mb-2">
                          Specify types and quantities
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <SandwichTypesSelector
                      name="sandwichTypes"
                      defaultValue={schedulingRequest.sandwichTypes}
                      estimatedCount={schedulingRequest.estimatedSandwichCount}
                      className="bg-white"
                    />
                  </div>
                </div>

                {/* Team Assignment Section */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-pink-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-purple-600" />
                    Team & Volunteer Requirements
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="driversNeeded">Drivers Needed</Label>
                      <Input
                        name="driversNeeded"
                        type="number"
                        min="0"
                        max="10"
                        defaultValue={schedulingRequest.driversNeeded || 0}
                        className="bg-white"
                        data-testid="input-drivers-needed"
                      />
                    </div>
                    <div>
                      <Label htmlFor="speakersNeeded">Speakers Needed</Label>
                      <Input
                        name="speakersNeeded"
                        type="number"
                        min="0"
                        max="5"
                        defaultValue={schedulingRequest.speakersNeeded || 0}
                        className="bg-white"
                        data-testid="input-speakers-needed"
                      />
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <input
                        type="checkbox"
                        name="volunteersNeeded"
                        id="volunteersNeeded"
                        defaultChecked={schedulingRequest.volunteersNeeded}
                        className="h-4 w-4 text-purple-600"
                        data-testid="checkbox-volunteers-needed"
                      />
                      <Label htmlFor="volunteersNeeded" className="text-sm">
                        Additional volunteers needed
                      </Label>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="volunteerNotes">Volunteer Notes</Label>
                    <Textarea
                      name="volunteerNotes"
                      rows={2}
                      defaultValue={schedulingRequest.volunteerNotes || ''}
                      placeholder="Special requirements or notes about volunteers needed"
                      className="bg-white"
                      data-testid="textarea-volunteer-notes"
                    />
                  </div>
                </div>

                {/* Van Driver Section */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-indigo-50 to-purple-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center">
                    <Truck className="h-4 w-4 mr-2 text-indigo-600" />
                    Van Driver Assignment
                  </h3>

                  {/* Van Driver Needed Checkbox */}
                  <div className="mb-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="vanDriverNeeded"
                        id="vanDriverNeeded"
                        checked={markScheduledFormData.vanDriverNeeded}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setMarkScheduledFormData((prev) => ({
                            ...prev,
                            vanDriverNeeded: isChecked,
                            // Clear driver fields when unchecked
                            assignedVanDriverId: isChecked
                              ? prev.assignedVanDriverId
                              : '',
                          }));
                        }}
                        className="h-4 w-4 text-indigo-600"
                        data-testid="checkbox-van-driver-needed"
                      />
                      <Label
                        htmlFor="vanDriverNeeded"
                        className="text-sm font-medium"
                      >
                        Van driver needed for this event
                      </Label>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 ml-6">
                      Check if this event requires a van driver for
                      transportation or logistics
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Assigned Van Driver */}
                    <div>
                      <Label htmlFor="assignedVanDriverId">
                        Assigned Van Driver
                      </Label>
                      {/* Hidden input for form submission */}
                      <input
                        type="hidden"
                        name="assignedVanDriverId"
                        value={markScheduledFormData.assignedVanDriverId}
                      />
                      <Select
                        value={markScheduledFormData.assignedVanDriverId}
                        onValueChange={(value) =>
                          setMarkScheduledFormData((prev) => ({
                            ...prev,
                            assignedVanDriverId: value || '',
                          }))
                        }
                        disabled={!markScheduledFormData.vanDriverNeeded}
                      >
                        <SelectTrigger
                          className={`bg-white ${
                            !markScheduledFormData.vanDriverNeeded
                              ? 'opacity-50'
                              : ''
                          }`}
                        >
                          <SelectValue placeholder="Select a van driver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            No driver assigned
                          </SelectItem>
                          {availableDrivers
                            ?.filter((driver: any) => driver.isActive)
                            .map((driver: any) => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name}{' '}
                                {driver.vanApproved && '✓ Van Approved'}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-600 mt-1">
                        Select from available drivers with van approval
                      </p>
                    </div>

                    {/* Custom Van Driver Name */}
                    <div>
                      <Label htmlFor="customVanDriverName">
                        Custom Van Driver Name
                      </Label>
                      <Input
                        name="customVanDriverName"
                        defaultValue={
                          schedulingRequest.customVanDriverName || ''
                        }
                        placeholder="External driver name or contact"
                        className={`bg-white ${
                          !markScheduledFormData.vanDriverNeeded
                            ? 'opacity-50'
                            : ''
                        }`}
                        disabled={!markScheduledFormData.vanDriverNeeded}
                        data-testid="input-custom-van-driver-name"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        For external drivers not in our system
                      </p>
                    </div>
                  </div>

                  {/* Van Driver Notes */}
                  <div className="mt-4">
                    <Label htmlFor="vanDriverNotes">Van Driver Notes</Label>
                    <Textarea
                      name="vanDriverNotes"
                      rows={2}
                      defaultValue={schedulingRequest.vanDriverNotes || ''}
                      placeholder="Special instructions, vehicle requirements, pickup/drop-off details, etc."
                      className={`bg-white ${
                        !markScheduledFormData.vanDriverNeeded
                          ? 'opacity-50'
                          : ''
                      }`}
                      disabled={!markScheduledFormData.vanDriverNeeded}
                      data-testid="textarea-van-driver-notes"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Any special requirements or instructions for the van
                      driver
                    </p>
                  </div>
                </div>

                {/* TSP Contact Assignment Section */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center">
                    <UserCheck className="h-4 w-4 mr-2 text-green-600" />
                    TSP Contact Assignment
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tspContact">Primary TSP Contact</Label>
                      {/* Hidden input for form submission */}
                      <input
                        type="hidden"
                        name="tspContact"
                        value={markScheduledFormData.tspContact}
                      />
                      <Select
                        value={markScheduledFormData.tspContact}
                        onValueChange={(value) =>
                          setMarkScheduledFormData((prev) => ({
                            ...prev,
                            tspContact: value || '',
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select primary contact" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            No contact assigned
                          </SelectItem>
                          {users?.map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.displayName || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="customTspContact">
                        Custom Contact Info
                      </Label>
                      <Input
                        name="customTspContact"
                        defaultValue={schedulingRequest.customTspContact || ''}
                        placeholder="Additional contact details"
                        className="bg-white"
                        data-testid="input-custom-tsp-contact"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="additionalTspContacts">
                      Additional TSP Contacts
                    </Label>
                    <Input
                      name="additionalTspContacts"
                      defaultValue={
                        schedulingRequest.additionalTspContacts || ''
                      }
                      placeholder="Additional team members (comma-separated)"
                      className="bg-white"
                      data-testid="input-additional-tsp-contacts"
                    />
                  </div>
                </div>

                {/* Communication & Toolkit Section */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-yellow-50 to-orange-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-yellow-600" />
                    Communication & Toolkit
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="communicationMethod">
                        Communication Method
                      </Label>
                      {/* Hidden input for form submission */}
                      <input
                        type="hidden"
                        name="communicationMethod"
                        value={markScheduledFormData.communicationMethod}
                      />
                      <Select
                        value={markScheduledFormData.communicationMethod}
                        onValueChange={(value) =>
                          setMarkScheduledFormData((prev) => ({
                            ...prev,
                            communicationMethod: value || '',
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="How was contact made?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unspecified">
                            Not specified
                          </SelectItem>
                          <SelectItem value="phone">Phone Call</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="in_person">In Person</SelectItem>
                          <SelectItem value="text">Text Message</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="toolkitStatus">Toolkit Status</Label>
                      {/* Hidden input for form submission */}
                      <input
                        type="hidden"
                        name="toolkitStatus"
                        value={markScheduledFormData.toolkitStatus}
                      />
                      <Select
                        value={markScheduledFormData.toolkitStatus}
                        onValueChange={(value) =>
                          setMarkScheduledFormData((prev) => ({
                            ...prev,
                            toolkitStatus: value || '',
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Toolkit sent status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unspecified">
                            Not specified
                          </SelectItem>
                          <SelectItem value="sent">Toolkit sent</SelectItem>
                          <SelectItem value="pending">Pending send</SelectItem>
                          <SelectItem value="not_needed">Not needed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Planning Notes Section */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-gray-50 to-slate-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center">
                    <Edit className="h-4 w-4 mr-2 text-gray-600" />
                    Planning Notes & Requirements
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="planningNotes">Planning Notes</Label>
                      <Textarea
                        name="planningNotes"
                        rows={3}
                        defaultValue={schedulingRequest.planningNotes || ''}
                        placeholder="Internal planning notes, follow-up tasks, or special considerations"
                        className="bg-white"
                        data-testid="textarea-planning-notes"
                      />
                    </div>
                    <div>
                      <Label htmlFor="additionalRequirements">
                        Additional Requirements
                      </Label>
                      <Textarea
                        name="additionalRequirements"
                        rows={2}
                        defaultValue={
                          schedulingRequest.additionalRequirements || ''
                        }
                        placeholder="Special dietary needs, accessibility requirements, etc."
                        className="bg-white"
                        data-testid="textarea-additional-requirements"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowSchedulingDialog(false);
                      setSchedulingRequest(null);
                    }}
                    data-testid="button-cancel-scheduling"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={markScheduledMutation.isPending}
                    className="bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white px-6"
                    data-testid="button-confirm-schedule"
                  >
                    {markScheduledMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Scheduled
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* TSP Contact Assignment Dialog */}
        {showTspContactDialog && assigningContactRequest && (
          <Dialog
            open={showTspContactDialog}
            onOpenChange={setShowTspContactDialog}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Assign TSP Contacts</DialogTitle>
                <p className="text-sm text-gray-600">
                  Assign team members and add custom contact information for{' '}
                  {assigningContactRequest.organizationName}
                </p>
              </DialogHeader>

              <div className="space-y-6">
                {/* Team Member Selection */}
                <div>
                  <Label className="text-base font-medium">
                    Team Members (up to 4)
                  </Label>
                  <p className="text-xs text-gray-500 mb-3">
                    Select team members to assign as contacts for this event
                  </p>

                  <div className="space-y-3">
                    {[0, 1, 2, 3].map((index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <span className="text-sm font-medium min-w-0 w-20">
                          {index === 0
                            ? 'Primary:'
                            : index === 1
                              ? 'Secondary:'
                              : index === 2
                                ? 'Third:'
                                : 'Fourth:'}
                        </span>
                        <select
                          value={selectedTspContacts[index] || ''}
                          onChange={(e) => {
                            const newContacts = [...selectedTspContacts];
                            if (e.target.value === '') {
                              newContacts.splice(index, 1);
                            } else {
                              newContacts[index] = e.target.value;
                            }
                            setSelectedTspContacts(newContacts);
                          }}
                          className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select team member</option>
                          {users?.map((user: any) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.displayName || user.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Contact Information */}
                <div>
                  <Label className="text-base font-medium">
                    Custom Contact Information
                  </Label>
                  <p className="text-xs text-gray-500 mb-3">
                    Add external contacts or special instructions
                  </p>

                  <div className="space-y-2">
                    {customTspContacts.map((contact, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={contact}
                          onChange={(e) => {
                            const newContacts = [...customTspContacts];
                            newContacts[index] = e.target.value;
                            setCustomTspContacts(newContacts);
                          }}
                          placeholder="Enter contact name, phone, or instructions"
                          className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                        {customTspContacts.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newContacts = customTspContacts.filter(
                                (_, i) => i !== index
                              );
                              setCustomTspContacts(newContacts);
                            }}
                            className="h-10 w-10 p-0"
                          >
                            ✗
                          </Button>
                        )}
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCustomTspContacts([...customTspContacts, ''])
                      }
                      className="mt-2"
                    >
                      + Add Another Contact
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowTspContactDialog(false);
                    setAssigningContactRequest(null);
                    setSelectedTspContacts([]);
                    setCustomTspContacts(['']);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAssignTspContact}
                  disabled={updateMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {updateMutation.isPending
                    ? 'Assigning...'
                    : 'Assign Contacts'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Speaker Assignment Dialog */}
        {showSpeakerDialog && assigningSpeakerRequest && (
          <Dialog open={showSpeakerDialog} onOpenChange={setShowSpeakerDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Assign Speakers</DialogTitle>
                <p className="text-sm text-gray-600">
                  Assign speakers for {assigningSpeakerRequest.organizationName}
                </p>
              </DialogHeader>

              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Speakers needed:{' '}
                    {(assigningSpeakerRequest as any).speakersNeeded || 0}
                  </p>

                  {/* Team Members Section */}
                  <div className="mb-6">
                    <Label className="text-base font-medium text-teal-700">
                      Team Members
                    </Label>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto mt-2 p-2 bg-teal-50 rounded-md">
                      {availableUsers?.map((user: any) => (
                        <div
                          key={`user-${user.id}`}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={`speaker-user-${user.id}`}
                            checked={selectedSpeakers.includes(
                              `user-${user.id}`
                            )}
                            onChange={(e) => {
                              const speakerId = `user-${user.id}`;
                              if (e.target.checked) {
                                setSelectedSpeakers([
                                  ...selectedSpeakers,
                                  speakerId,
                                ]);
                              } else {
                                setSelectedSpeakers(
                                  selectedSpeakers.filter(
                                    (id) => id !== speakerId
                                  )
                                );
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <label
                            htmlFor={`speaker-user-${user.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {user.displayName} ({user.email})
                          </label>
                        </div>
                      ))}
                      {(!availableUsers || availableUsers.length === 0) && (
                        <p className="text-sm text-gray-500 italic">
                          No team members available
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Drivers Section */}
                  <div>
                    <Label className="text-base font-medium text-orange-700">
                      Drivers (Multi-faceted Volunteers)
                    </Label>
                    <p className="text-xs text-gray-600 mb-2">
                      Select from drivers who can also serve as speakers
                    </p>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-2 bg-orange-50 rounded-md">
                      {availableDrivers
                        ?.filter((driver: any) => driver.isActive)
                        .map((driver: any) => (
                          <div
                            key={`driver-${driver.id}`}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`speaker-driver-${driver.id}`}
                              checked={selectedSpeakers.includes(
                                `driver-${driver.id}`
                              )}
                              onChange={(e) => {
                                const speakerId = `driver-${driver.id}`;
                                if (e.target.checked) {
                                  setSelectedSpeakers([
                                    ...selectedSpeakers,
                                    speakerId,
                                  ]);
                                } else {
                                  setSelectedSpeakers(
                                    selectedSpeakers.filter(
                                      (id) => id !== speakerId
                                    )
                                  );
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <label
                              htmlFor={`speaker-driver-${driver.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {driver.name}{' '}
                              {driver.phone && `(${driver.phone})`}
                              {driver.zone && (
                                <span className="text-xs text-gray-500 ml-1">
                                  - Zone: {driver.zone}
                                </span>
                              )}
                              {driver.area && (
                                <span className="text-xs text-gray-500">
                                  {' '}
                                  | Area: {driver.area}
                                </span>
                              )}
                            </label>
                          </div>
                        ))}
                      {(!availableDrivers ||
                        availableDrivers.filter((d: any) => d.isActive)
                          .length === 0) && (
                        <p className="text-sm text-gray-500 italic">
                          No active drivers available
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowSpeakerDialog(false);
                    setAssigningSpeakerRequest(null);
                    setSelectedSpeakers([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    saveSpeakerAssignmentMutation.mutate({
                      eventId: assigningSpeakerRequest.id,
                      speakerIds: selectedSpeakers,
                    });
                  }}
                  disabled={saveSpeakerAssignmentMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {saveSpeakerAssignmentMutation.isPending
                    ? 'Assigning...'
                    : 'Assign Speakers'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Volunteer Assignment Dialog */}
        {showVolunteerDialog && assigningVolunteerRequest && (
          <Dialog
            open={showVolunteerDialog}
            onOpenChange={setShowVolunteerDialog}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Assign Volunteers</DialogTitle>
                <p className="text-sm text-gray-600">
                  Assign volunteers for{' '}
                  {assigningVolunteerRequest.organizationName}
                </p>
              </DialogHeader>

              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">
                    Available Team Members
                  </Label>
                  <p className="text-sm text-gray-600 mb-3">
                    Select team members to volunteer for this event
                  </p>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {availableUsers?.map((user: any) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          id={`volunteer-${user.id}`}
                          checked={selectedVolunteers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedVolunteers([
                                ...selectedVolunteers,
                                user.id,
                              ]);
                            } else {
                              setSelectedVolunteers(
                                selectedVolunteers.filter(
                                  (id) => id !== user.id
                                )
                              );
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <label
                          htmlFor={`volunteer-${user.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {user.displayName} ({user.email})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowVolunteerDialog(false);
                    setAssigningVolunteerRequest(null);
                    setSelectedVolunteers([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    saveVolunteerAssignmentMutation.mutate({
                      eventId: assigningVolunteerRequest.id,
                      volunteerIds: selectedVolunteers,
                    });
                  }}
                  disabled={saveVolunteerAssignmentMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {saveVolunteerAssignmentMutation.isPending
                    ? 'Assigning...'
                    : 'Assign Volunteers'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Email Composer Dialog */}
        {showEmailComposer && emailComposerRequest && (
          <EventEmailComposer
            isOpen={showEmailComposer}
            onClose={() => {
              setShowEmailComposer(false);
              setEmailComposerRequest(null);
            }}
            eventRequest={emailComposerRequest}
            onEmailSent={() => {
              // Optionally refresh data or show success message
              console.log('Email sent successfully');
            }}
          />
        )}

        {/* Follow-Up Dialog */}
        {showFollowUpDialog && followUpRequest && (
          <Dialog
            open={showFollowUpDialog}
            onOpenChange={setShowFollowUpDialog}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-brand-orange" />
                  <span>Record Follow-Up</span>
                </DialogTitle>
                <DialogDescription>
                  How did you follow up with {followUpRequest.organizationName}?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      followUpMutation.mutate({
                        id: followUpRequest.id,
                        method: 'email',
                      });
                    }}
                    disabled={followUpMutation.isPending}
                    className="bg-brand-primary hover:bg-brand-primary-dark text-white border-brand-primary"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Toolkit/Scheduling Link Emailed
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFollowUpDialog(false);
                      setShowCallbackDialog(true);
                    }}
                    className="bg-brand-teal hover:bg-brand-teal-dark text-white border-brand-teal"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Called Back
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Callback Dialog for collecting email */}
        {showCallbackDialog && followUpRequest && (
          <Dialog
            open={showCallbackDialog}
            onOpenChange={setShowCallbackDialog}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Called Back - Collect Email</DialogTitle>
                <DialogDescription>
                  Enter the email address you collected during the call
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const updatedEmail = formData.get('updatedEmail') as string;
                  const notes = formData.get('notes') as string;

                  followUpMutation.mutate({
                    id: followUpRequest.id,
                    method: 'call',
                    updatedEmail,
                    notes,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="updatedEmail">Email Address Collected</Label>
                  <Input
                    name="updatedEmail"
                    type="email"
                    placeholder="example@domain.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    name="notes"
                    placeholder="Any additional notes from the call..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCallbackDialog(false);
                      setFollowUpRequest(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={followUpMutation.isPending}
                    className="bg-brand-orange hover:bg-brand-orange-dark text-white"
                  >
                    {followUpMutation.isPending
                      ? 'Recording...'
                      : 'Record & Send Toolkit'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Call Completed Dialog */}
        {showCallCompletedDialog && callCompletedRequest && (
          <Dialog
            open={showCallCompletedDialog}
            onOpenChange={setShowCallCompletedDialog}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-brand-primary" />
                  <span>Call Completed - Enter Event Details</span>
                </DialogTitle>
                <DialogDescription>
                  Fill out the complete event details for{' '}
                  {callCompletedRequest.organizationName}
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);

                  const eventDetails = {
                    desiredEventDate: formData.get(
                      'desiredEventDate'
                    ) as string,
                    estimatedAttendeeCount: parseInt(
                      formData.get('estimatedAttendeeCount') as string,
                      10
                    ),
                    estimatedSandwichCount: parseInt(
                      formData.get('estimatedSandwichCount') as string,
                      10
                    ),
                    driversNeeded: parseInt(
                      formData.get('driversNeeded') as string,
                      10
                    ),
                    speakersNeeded: parseInt(
                      formData.get('speakersNeeded') as string,
                      10
                    ),
                    hasRefrigeration:
                      formData.get('hasRefrigeration') === 'true',
                    address: formData.get('address') as string,
                    message: formData.get('message') as string,
                  };

                  callCompletedMutation.mutate({
                    id: callCompletedRequest.id,
                    eventDetails,
                  });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="desiredEventDate">Event Date</Label>
                    <Input name="desiredEventDate" type="date" required />
                  </div>

                  <div>
                    <Label htmlFor="estimatedAttendeeCount">
                      Expected Attendees
                    </Label>
                    <Input
                      name="estimatedAttendeeCount"
                      type="number"
                      min="1"
                      placeholder="50"
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="estimatedSandwichCount">
                      Sandwiches Needed
                    </Label>
                    <Input
                      name="estimatedSandwichCount"
                      type="number"
                      min="1"
                      placeholder="50"
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="driversNeeded">Drivers Needed</Label>
                    <Input
                      name="driversNeeded"
                      type="number"
                      min="0"
                      placeholder="1"
                      defaultValue="1"
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="speakersNeeded">Speakers Needed</Label>
                    <Input
                      name="speakersNeeded"
                      type="number"
                      min="0"
                      placeholder="0"
                      defaultValue="0"
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="hasRefrigeration">
                      Refrigeration Available?
                    </Label>
                    <select
                      name="hasRefrigeration"
                      className="w-full p-2 border rounded"
                      required
                    >
                      <option value="">Select option</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Event Address</Label>
                  <Input
                    name="address"
                    type="text"
                    placeholder="123 Main St, City, State 12345"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="message">Additional Notes</Label>
                  <Textarea
                    name="message"
                    placeholder="Any special instructions or additional information..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCallCompletedDialog(false);
                      setCallCompletedRequest(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={callCompletedMutation.isPending}
                    className="bg-brand-primary hover:bg-brand-primary-dark text-white"
                  >
                    {callCompletedMutation.isPending
                      ? 'Saving...'
                      : 'Schedule Event'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Unresponsive Contact Management Dialog */}
        {showUnresponsiveDialog && unresponsiveRequest && (
          <Dialog
            open={showUnresponsiveDialog}
            onOpenChange={setShowUnresponsiveDialog}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span>Unresponsive Contact Management</span>
                </DialogTitle>
                <DialogDescription>
                  Manage unresponsive contact status for{' '}
                  {unresponsiveRequest.organizationName}
                </DialogDescription>
              </DialogHeader>

              <UnresponsiveManagementForm
                request={unresponsiveRequest}
                onSubmit={handleUnresponsiveSubmit}
                onCancel={() => {
                  setShowUnresponsiveDialog(false);
                  setUnresponsiveRequest(null);
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={showDeleteConfirmDialog}
          onOpenChange={setShowDeleteConfirmDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                <span>Delete Event Request</span>
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this event request? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {deletingRequest && (
              <div className="py-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="font-medium text-gray-900">
                    {deletingRequest.organizationName}
                  </div>
                  {deletingRequest.department && (
                    <div className="text-sm text-gray-600">
                      {deletingRequest.department}
                    </div>
                  )}
                  {deletingRequest.desiredEventDate && (
                    <div className="text-sm text-gray-600 mt-1">
                      {formatEventDate(deletingRequest.desiredEventDate).text}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirmDialog(false);
                  setDeletingRequest(null);
                }}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Event'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Driver Selection Modal */}
      <DriverSelectionModal
        isOpen={showDriverModal}
        onClose={() => {
          setShowDriverModal(false);
          setSelectedEventForDrivers(null);
          setDriverModalMode('regular');
        }}
        mode={driverModalMode}
        onSelectDrivers={(drivers) => {
          if (selectedEventForDrivers) {
            handleAssignmentUpdate(
              selectedEventForDrivers.id,
              'assignedDriverIds',
              drivers
            );
          }
        }}
        onVanDriverSelect={(driverId, customName) => {
          if (selectedEventForDrivers) {
            driverAssignmentMutation.mutate({
              eventId: selectedEventForDrivers.id,
              assignedVanDriverId: driverId,
              customVanDriverName: customName,
            });
          }
        }}
        selectedDrivers={
          (selectedEventForDrivers as any)?.assignedDriverIds || []
        }
        currentVanDriverId={
          (selectedEventForDrivers as any)?.assignedVanDriverId
        }
        currentCustomVanDriverName={
          (selectedEventForDrivers as any)?.customVanDriverName
        }
        eventId={selectedEventForDrivers?.id || 0}
      />

      {/* Back to Top Button */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-brand-primary hover:bg-brand-primary-dark text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-105 focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
          size="sm"
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </Button>
      )}

      {/* Record Sandwich Count Dialog */}
      <Dialog
        open={showSandwichCountDialog}
        onOpenChange={setShowSandwichCountDialog}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Final Sandwich Count</DialogTitle>
            <DialogDescription>
              Enter the actual number of sandwiches provided for this event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actualSandwichCount">Final Sandwich Count</Label>
              <Input
                id="actualSandwichCount"
                type="number"
                min="0"
                value={actualSandwichCount}
                onChange={(e) =>
                  setActualSandwichCount(parseInt(e.target.value) || 0)
                }
                onWheel={(e) => e.target.blur()}
                placeholder="Enter actual count"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actualSandwichTypes">
                Sandwich Types (optional)
              </Label>
              <Textarea
                id="actualSandwichTypes"
                value={actualSandwichTypes}
                onChange={(e) => setActualSandwichTypes(e.target.value)}
                placeholder="e.g., 50 PB&J, 30 Turkey, 20 Ham"
                className="w-full min-h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSandwichCountDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordSandwichCount}
              disabled={
                actualSandwichCount <= 0 ||
                recordSandwichCountMutation.isPending
              }
              className="bg-brand-primary hover:bg-brand-primary-dark text-white"
            >
              {recordSandwichCountMutation.isPending
                ? 'Recording...'
                : 'Record Count'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Distribution Dialog */}
      <Dialog
        open={showDistributionDialog}
        onOpenChange={setShowDistributionDialog}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Sandwich Distribution</DialogTitle>
            <DialogDescription>
              Track where the sandwiches were distributed after the event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Distribution Details</Label>
              {distributionData.map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <Input
                      placeholder="Destination (e.g., Food Bank, Shelter)"
                      value={entry.destination}
                      onChange={(e) =>
                        updateDistributionEntry(
                          index,
                          'destination',
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Count"
                      value={entry.totalCount}
                      onChange={(e) =>
                        updateDistributionEntry(
                          index,
                          'totalCount',
                          parseInt(e.target.value) || 0
                        )
                      }
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>
                  {distributionData.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeDistributionEntry(index)}
                      className="text-red-600 hover:text-red-700 px-2"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addDistributionEntry}
                className="w-full border-dashed"
              >
                + Add Another Destination
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="distributionNotes">
                Distribution Notes (optional)
              </Label>
              <Textarea
                id="distributionNotes"
                value={distributionNotes}
                onChange={(e) => setDistributionNotes(e.target.value)}
                placeholder="Additional notes about the distribution"
                className="w-full min-h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDistributionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordDistribution}
              disabled={
                distributionData.filter(
                  (d) => d.destination && d.totalCount > 0
                ).length === 0 || recordDistributionMutation.isPending
              }
              className="bg-brand-primary hover:bg-brand-primary-dark text-white"
            >
              {recordDistributionMutation.isPending
                ? 'Recording...'
                : 'Record Distribution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Actual Sandwich Count Dialog */}
      <Dialog
        open={showRecordSandwichesDialog}
        onOpenChange={setShowRecordSandwichesDialog}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Actual Sandwich Count</DialogTitle>
            <DialogDescription>
              Record the actual number of sandwiches distributed for this event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {recordSandwichesRequest && (
              <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                <h4 className="font-semibold text-blue-900">
                  {recordSandwichesRequest.organizationName}
                </h4>
                <p className="text-sm text-blue-700">
                  Estimated: {(recordSandwichesRequest as any).estimatedSandwichCount || 'Not specified'} sandwiches
                </p>
                {recordSandwichesRequest.desiredEventDate && (
                  <p className="text-sm text-blue-600">
                    Event Date: {new Date(recordSandwichesRequest.desiredEventDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="actualSandwichCount">
                Actual Sandwich Count <span className="text-red-500">*</span>
              </Label>
              <Input
                id="actualSandwichCount"
                type="number"
                min="0"
                value={actualSandwichCount}
                onChange={(e) => setActualSandwichCount(parseInt(e.target.value) || 0)}
                placeholder="Enter actual sandwich count"
                className="text-lg"
                onWheel={(e) => e.target.blur()}
                data-testid="input-actual-sandwich-count"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actualSandwichNotes">
                Additional Notes (optional)
              </Label>
              <Textarea
                id="actualSandwichNotes"
                value={actualSandwichNotes}
                onChange={(e) => setActualSandwichNotes(e.target.value)}
                placeholder="Add any notes about the distribution, challenges, or other relevant details..."
                className="min-h-20"
                data-testid="input-actual-sandwich-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRecordSandwichesDialog(false);
                setRecordSandwichesRequest(null);
                setActualSandwichCount(0);
                setActualSandwichNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (recordSandwichesRequest) {
                  recordActualSandwichesMutation.mutate({
                    eventId: recordSandwichesRequest.id,
                    actualSandwichCount,
                    actualSandwichNotes,
                  });
                }
              }}
              disabled={
                !recordSandwichesRequest || 
                actualSandwichCount === 0 || 
                recordActualSandwichesMutation.isPending
              }
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-save-sandwich-count"
            >
              {recordActualSandwichesMutation.isPending
                ? 'Recording...'
                : 'Record Count'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Volunteer Selection Modal */}
      {showVolunteerDialog && assigningVolunteerRequest && (
        <VolunteerSelectionModal
          isOpen={showVolunteerDialog}
          onClose={() => {
            setShowVolunteerDialog(false);
            setAssigningVolunteerRequest(null);
          }}
          onSelectVolunteers={(volunteers) => {
            // Update the volunteer assignments
            handleAssignmentUpdate(
              assigningVolunteerRequest.id,
              'assignedVolunteerIds',
              volunteers
            );
          }}
          selectedVolunteers={selectedVolunteers}
          eventId={assigningVolunteerRequest.id}
        />
      )}

      {/* Toolkit Sent Dialog */}
      <ToolkitSentDialog
        isOpen={showToolkitSentDialog}
        onClose={() => {
          setShowToolkitSentDialog(false);
          setToolkitSentRequest(null);
        }}
        eventRequest={toolkitSentRequest}
        onToolkitSent={(toolkitSentDate) => {
          if (toolkitSentRequest) {
            toolkitSentMutation.mutate({
              eventId: toolkitSentRequest.id,
              toolkitSentDate,
            });
          }
        }}
        isLoading={toolkitSentMutation.isPending}
      />

      {/* Schedule Call Dialog */}
      {showScheduleCallDialog && scheduleCallRequest && (
        <Dialog
          open={showScheduleCallDialog}
          onOpenChange={setShowScheduleCallDialog}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Call</DialogTitle>
              <DialogDescription>
                Schedule a follow-up call for{' '}
                {scheduleCallRequest.organizationName}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const scheduledDate = formData.get('scheduledDate') as string;
                const scheduledTime = formData.get('scheduledTime') as string;

                if (!scheduledDate || !scheduledTime) {
                  toast({
                    title: 'Error',
                    description: 'Please select both date and time',
                    variant: 'destructive',
                  });
                  return;
                }

                // Combine date and time into ISO string
                const scheduledDateTime = new Date(
                  `${scheduledDate}T${scheduledTime}`
                ).toISOString();

                scheduleCallMutation.mutate({
                  eventId: scheduleCallRequest.id,
                  scheduledCallDate: scheduledDateTime,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="scheduledDate">Call Date</Label>
                  <Input
                    id="scheduledDate"
                    name="scheduledDate"
                    type="date"
                    required
                    className="mt-1"
                    data-testid="input-scheduled-date"
                  />
                </div>
                <div>
                  <Label htmlFor="scheduledTime">Call Time</Label>
                  <Input
                    id="scheduledTime"
                    name="scheduledTime"
                    type="time"
                    required
                    className="mt-1"
                    data-testid="input-scheduled-time"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowScheduleCallDialog(false)}
                  disabled={scheduleCallMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={scheduleCallMutation.isPending}
                  data-testid="button-confirm-schedule-call"
                >
                  {scheduleCallMutation.isPending
                    ? 'Scheduling...'
                    : 'Schedule Call'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </TooltipProvider>
  );
}
