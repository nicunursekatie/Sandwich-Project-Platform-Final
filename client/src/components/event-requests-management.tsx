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
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
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
  const handleDestinationEdit = (collectionId: number, currentValue: string) => {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
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
                          {new Date(collection.collectionDate).toLocaleDateString('en-US', {
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
                            Types: {getSandwichTypesSummary(collection).breakdown}
                          </p>
                        </div>
                      )}

                      {/* Destination with inline editing */}
                      <div className="ml-8 flex items-center space-x-2">
                        {editingDestination?.id === collection.id ? (
                          <SandwichDestinationTracker
                            value={editingDestination.value}
                            onChange={(value) =>
                              setEditingDestination({
                                ...editingDestination,
                                value,
                              })
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
      apiRequest('/api/import-events/import-2023-events', { method: 'POST' }),
    onSuccess: (data: any) => {
      setImportResults(data);
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${data.imported || 0} events from 2023 (skipped ${data.duplicates || 0} duplicates)`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
    },
    onError: (error: any) => {
      setImportResults({ error: error?.details || 'Failed to import 2023 events' });
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
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || 
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
            Upload a 2023 Events Excel file to import historical event data. This will add past events to the system for tracking and analysis.
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
              disabled={!selectedFile || !isFileValid || import2023EventsMutation.isPending}
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
                        <strong>Events Imported:</strong> {importResults.imported || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-600">
                        <strong>Duplicates Skipped:</strong> {importResults.duplicates || 0}
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
              <li>• Ensure your Excel file contains 2023 event data in the expected format</li>
              <li>• The system will automatically detect and skip duplicate entries</li>
              <li>• Successfully imported events will appear in the Completed tab</li>
              <li>• Import status and counts will be displayed above after completion</li>
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

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch event requests
  const { data: eventRequests = [], isLoading } = useQuery({
    queryKey: ['/api/event-requests'],
  });

  // Mutations
  const deleteEventRequestMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/event-requests/${id}`, { method: 'DELETE' }),
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
      apiRequest(`/api/event-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: 'Event request updated',
        description: 'The event request has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update event request.',
        variant: 'destructive',
      });
    },
  });

  const markToolkitSentMutation = useMutation({
    mutationFn: ({ id, toolkitSentDate }: { id: number; toolkitSentDate: string }) =>
      apiRequest(`/api/event-requests/${id}/toolkit-sent`, {
        method: 'PATCH',
        body: JSON.stringify({ toolkitSentDate }),
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
    mutationFn: ({ id, scheduledCallDate }: { id: number; scheduledCallDate: string }) =>
      apiRequest(`/api/event-requests/${id}/schedule-call`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledCallDate }),
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
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
    followed_up: requestsByStatus.followed_up?.length || 0,
    in_process: requestsByStatus.in_process?.length || 0,
    scheduled: requestsByStatus.scheduled?.length || 0,
    completed: requestsByStatus.completed?.length || 0,
    declined: requestsByStatus.declined?.length || 0,
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
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
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="new" className="relative">
              New ({statusCounts.new})
              {statusCounts.new > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="followed_up">
              Followed Up ({statusCounts.followed_up})
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
            <TabsTrigger value="audit-log" className="bg-purple-50 border-purple-200">
              <Shield className="w-4 h-4 mr-1" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import">
            <ImportEventsTab />
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit-log">
            <EventRequestAuditLog showFilters data-testid="audit-log" />
          </TabsContent>

          {/* Status-based tabs (existing logic) */}
          {['new', 'followed_up', 'in_process', 'scheduled', 'completed', 'declined'].map((status) => (
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
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="organization">Organization A-Z</SelectItem>
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
                      request.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      request.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      request.email.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  })
                  .sort((a: EventRequest, b: EventRequest) => {
                    switch (sortBy) {
                      case 'newest':
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      case 'oldest':
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      case 'organization':
                        return a.organizationName.localeCompare(b.organizationName);
                      default:
                        return 0;
                    }
                  })
                  .map((request: EventRequest) => {
                    const StatusIcon = statusIcons[request.status];
                    const dateInfo = formatEventDate(request.desiredEventDate || '');

                    return (
                      <Card
                        key={request.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] ${
                          statusColors[request.status]
                        }`}
                        onClick={() => handleEventClick(request)}
                        data-testid={`card-event-request-${request.id}`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center space-x-3">
                                <StatusIcon className="w-5 h-5" />
                                <h3 className="text-lg font-semibold">
                                  {request.organizationName}
                                </h3>
                                <Badge className={statusColors[request.status]}>
                                  {statusOptions.find((s) => s.value === request.status)?.label}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-500" />
                                  <span>
                                    {request.firstName} {request.lastName}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Mail className="w-4 h-4 text-gray-500" />
                                  <span>{request.email}</span>
                                </div>
                                {request.phone && (
                                  <div className="flex items-center space-x-2">
                                    <Phone className="w-4 h-4 text-gray-500" />
                                    <span>{request.phone}</span>
                                  </div>
                                )}
                                {request.desiredEventDate && (
                                  <div className="flex items-center space-x-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span className={dateInfo.className}>
                                      {dateInfo.text}
                                    </span>
                                  </div>
                                )}
                                {request.estimatedSandwichCount && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm">🥪</span>
                                    <span>~{request.estimatedSandwichCount} sandwiches</span>
                                  </div>
                                )}
                              </div>

                              {request.message && (
                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                  {request.message}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col items-end space-y-2">
                              <span className="text-xs text-gray-500">
                                {new Date(request.createdAt).toLocaleDateString()}
                              </span>
                              
                              {/* Status-specific action buttons */}
                              <div className="flex space-x-1">
                                {request.status === 'new' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openToolkitSentDialog(request);
                                        }}
                                        className="text-green-600 hover:bg-green-50"
                                        data-testid={`button-send-toolkit-${request.id}`}
                                      >
                                        <Shield className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Send Toolkit</TooltipContent>
                                  </Tooltip>
                                )}

                                {request.status === 'completed' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewCollectionLog(request);
                                        }}
                                        className="text-brand-primary hover:bg-brand-primary hover:text-white"
                                        data-testid={`button-view-collections-${request.id}`}
                                      >
                                        <TrendingUp className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View Collections</TooltipContent>
                                  </Tooltip>
                                )}

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEventClick(request);
                                      }}
                                      className="text-brand-primary hover:bg-brand-primary hover:text-white"
                                      data-testid={`button-view-details-${request.id}`}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View Details</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                {/* Empty state */}
                {(requestsByStatus[status] || []).length === 0 && (
                  <div className="text-center py-12">
                    <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Clock className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No {status.replace('_', ' ')} requests
                    </h3>
                    <p className="text-gray-600">
                      There are currently no event requests with {status.replace('_', ' ')} status.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Event Details Dialog */}
        {showEventDetails && selectedEventRequest && (
          <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Building className="w-5 h-5" />
                  <span>{selectedEventRequest.organizationName}</span>
                  <Badge className={statusColors[selectedEventRequest.status]}>
                    {statusOptions.find((s) => s.value === selectedEventRequest.status)?.label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Event request from {selectedEventRequest.firstName}{' '}
                  {selectedEventRequest.lastName} • Created{' '}
                  {new Date(selectedEventRequest.createdAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Contact Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>Contact Information</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Name</Label>
                        <p className="text-sm">
                          {selectedEventRequest.firstName}{' '}
                          {selectedEventRequest.lastName}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Email</Label>
                        <p className="text-sm">{selectedEventRequest.email}</p>
                      </div>
                      {selectedEventRequest.phone && (
                        <div>
                          <Label className="text-sm font-medium">Phone</Label>
                          <p className="text-sm">{selectedEventRequest.phone}</p>
                        </div>
                      )}
                      {selectedEventRequest.department && (
                        <div>
                          <Label className="text-sm font-medium">Department</Label>
                          <p className="text-sm">{selectedEventRequest.department}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Event Details</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedEventRequest.desiredEventDate && (
                        <div>
                          <Label className="text-sm font-medium">Desired Date</Label>
                          <p className="text-sm">
                            {formatEventDate(selectedEventRequest.desiredEventDate).text}
                          </p>
                        </div>
                      )}
                      {selectedEventRequest.estimatedSandwichCount && (
                        <div>
                          <Label className="text-sm font-medium">
                            Estimated Sandwich Count
                          </Label>
                          <p className="text-sm">
                            {selectedEventRequest.estimatedSandwichCount}
                          </p>
                        </div>
                      )}
                      <div>
                        <Label className="text-sm font-medium">
                          Previously Hosted
                        </Label>
                        <p className="text-sm">
                          {previouslyHostedOptions.find(
                            (option) =>
                              option.value === selectedEventRequest.previouslyHosted
                          )?.label || 'Unknown'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Message */}
                {selectedEventRequest.message && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Message</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedEventRequest.message}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between space-x-4">
                  <div className="flex space-x-2">
                    {selectedEventRequest.status === 'new' && (
                      <Button
                        onClick={() => openToolkitSentDialog(selectedEventRequest)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        data-testid="button-send-toolkit-dialog"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Send Toolkit
                      </Button>
                    )}

                    {selectedEventRequest.status === 'completed' && (
                      <Button
                        onClick={() => handleViewCollectionLog(selectedEventRequest)}
                        className="bg-brand-primary hover:bg-brand-primary/90"
                        data-testid="button-view-collections-dialog"
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        View Collections
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => {
                        setScheduleCallDate('');
                        setScheduleCallTime('');
                        setShowScheduleCallDialog(true);
                      }}
                      data-testid="button-schedule-call"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Schedule Call
                    </Button>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(!isEditing)}
                      data-testid="button-edit-request"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      {isEditing ? 'Cancel Edit' : 'Edit'}
                    </Button>

                    {hasPermission(user, PERMISSIONS.DELETE_EVENT_REQUESTS) && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (
                            confirm(
                              'Are you sure you want to delete this event request?'
                            )
                          ) {
                            deleteEventRequestMutation.mutate(selectedEventRequest.id);
                          }
                        }}
                        data-testid="button-delete-request"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {/* Edit Form */}
                {isEditing && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const updatedData = Object.fromEntries(formData.entries());
                      updateEventRequestMutation.mutate({
                        id: selectedEventRequest.id,
                        data: updatedData,
                      });
                    }}
                    className="space-y-4 border-t pt-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-status">Status</Label>
                        <Select
                          name="status"
                          defaultValue={selectedEventRequest.status}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-estimated-count">
                          Estimated Sandwich Count
                        </Label>
                        <Input
                          id="edit-estimated-count"
                          name="estimatedSandwichCount"
                          type="number"
                          defaultValue={selectedEventRequest.estimatedSandwichCount || ''}
                          data-testid="input-edit-sandwich-count"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit-notes">Notes</Label>
                      <Textarea
                        id="edit-notes"
                        name="planningNotes"
                        defaultValue={selectedEventRequest.planningNotes || ''}
                        rows={3}
                        data-testid="textarea-edit-notes"
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateEventRequestMutation.isPending}
                        data-testid="button-save-changes"
                      >
                        {updateEventRequestMutation.isPending
                          ? 'Saving...'
                          : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Collection Log Modal */}
        <EventCollectionLog
          eventRequest={collectionLogEventRequest}
          isVisible={showCollectionLog}
          onClose={() => {
            setShowCollectionLog(false);
            setCollectionLogEventRequest(null);
          }}
        />

        {/* Toolkit Sent Dialog */}
        <ToolkitSentDialog
          isOpen={showToolkitSentDialog}
          onClose={() => {
            setShowToolkitSentDialog(false);
            setToolkitEventRequest(null);
          }}
          eventRequest={toolkitEventRequest}
          onToolkitSent={handleToolkitSent}
          isLoading={markToolkitSentMutation.isPending}
        />

        {/* Schedule Call Dialog */}
        {showScheduleCallDialog && selectedEventRequest && (
          <Dialog
            open={showScheduleCallDialog}
            onOpenChange={setShowScheduleCallDialog}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Call</DialogTitle>
                <DialogDescription>
                  Schedule a call with {selectedEventRequest.firstName}{' '}
                  {selectedEventRequest.lastName} from{' '}
                  {selectedEventRequest.organizationName}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleScheduleCall();
              }}>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-date">Call Date</Label>
                    <Input
                      id="schedule-date"
                      type="date"
                      value={scheduleCallDate}
                      onChange={(e) => setScheduleCallDate(e.target.value)}
                      required
                      className="mt-1"
                      data-testid="input-scheduled-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-time">Call Time</Label>
                    <Input
                      id="schedule-time"
                      type="time"
                      value={scheduleCallTime}
                      onChange={(e) => setScheduleCallTime(e.target.value)}
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

        {/* Weekly Planning Modal */}
        {showWeeklyPlanningModal && (
          <Dialog open={showWeeklyPlanningModal} onOpenChange={setShowWeeklyPlanningModal}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-brand-primary" />
                  <span>Weekly Planning & Sandwich Forecast</span>
                </DialogTitle>
                <DialogDescription>
                  Plan upcoming events and view sandwich preparation forecasts
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <SandwichForecastWidget />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
}