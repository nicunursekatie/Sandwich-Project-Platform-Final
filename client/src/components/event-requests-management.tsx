import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SandwichForecastWidget from "@/components/sandwich-forecast-widget";
import { EventEmailComposer } from "@/components/event-email-composer";
import {
  formatTime12Hour,
  formatTime,
  getSandwichTypesSummary,
  formatEventDate,
  getDriverStatus,
  getToolkitStatus,
  getRefrigerationStatus,
  getSpeakerStatus
} from "./event-request-utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Package,
  Car,
  MapPin,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";

// Utility function to convert 24-hour time to 12-hour format
// formatTime12Hour function moved to event-request-utils.tsx

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
    if (e.key === "Enter") {
      onSave();
    }
    if (e.key === "Escape") {
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
            className="h-6 w-6 p-0 text-green-600 hover:bg-green-50"
            onClick={onSave}
          >
            ✓
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
            onClick={onCancel}
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
          💡 Examples: "Community Food Bank", "Main Office", "123 Main St", "Front desk delivery"
        </div>
      </div>
    </div>
  );
};

// Helper function to get sandwich types summary
// getSandwichTypesSummary function moved to event-request-utils.tsx

// formatEventDate function moved to event-request-utils.tsx (enhanced version needed)

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
  previouslyHosted: "yes" | "no" | "i_dont_know";
  status:
    | "new"
    | "followed_up"
    | "in_process"
    | "scheduled"
    | "completed"
    | "declined";
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
}

const statusColors = {
  new: "bg-gradient-to-r from-teal-50 to-cyan-100 text-[#236383] border border-teal-200",
  followed_up:
    "bg-gradient-to-r from-orange-50 to-amber-100 text-[#FBAD3F] border border-orange-200",
  in_process:
    "bg-gradient-to-r from-teal-50 to-cyan-100 text-[#007E8C] border border-teal-200",
  scheduled:
    "bg-gradient-to-r from-yellow-50 to-orange-100 text-yellow-800 border border-yellow-200",
  completed:
    "bg-gradient-to-r from-gray-50 to-slate-100 text-gray-700 border border-gray-200",
  declined:
    "bg-gradient-to-r from-[#A31C41] to-red-700 text-white border-2 font-bold shadow-lg",
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
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "i_dont_know", label: "Unknown" },
];

const statusOptions = [
  { value: "new", label: "New Request" },
  { value: "followed_up", label: "Followed Up" },
  { value: "in_process", label: "In Process" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "🚫 EVENT POSTPONED" },
];

// Simple inline sandwich types interface
interface SandwichType {
  type: string;
  quantity: number;
}

export default function EventRequestsManagement() {
  const [activeTab, setActiveTab] = useState("requests");
  const [searchTerm, setSearchTerm] = useState("");
  const [globalSearch, setGlobalSearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EventRequest | null>(
    null,
  );
  const [highlightedEventId, setHighlightedEventId] = useState<number | null>(
    null,
  );
  const [currentEditingStatus, setCurrentEditingStatus] = useState<string>("");
  const [showCompleteContactDialog, setShowCompleteContactDialog] =
    useState(false);
  const [completingRequest, setCompletingRequest] =
    useState<EventRequest | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEventDetailsDialog, setShowEventDetailsDialog] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<EventRequest | null>(
    null,
  );
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [pastEventsSortOrder, setPastEventsSortOrder] = useState<
    "asc" | "desc"
  >("desc");
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailComposerRequest, setEmailComposerRequest] =
    useState<EventRequest | null>(null);
  const [pastEventsPage, setPastEventsPage] = useState(1);
  const [pastEventsPerPage] = useState(10);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState<EventRequest | null>(
    null,
  );
  // Inline editing state
  const [inlineEditing, setInlineEditing] = useState<{
    [key: string]: { field: string; requestId: number }
  }>({});
  const [editValues, setEditValues] = useState<{[key: string]: string}>({});
  // Sorting state for all tabs
  const [requestsSortBy, setRequestsSortBy] = useState<"date" | "organization">(
    "date",
  );
  const [requestsSortOrder, setRequestsSortOrder] = useState<"asc" | "desc">(
    "desc",
  );
  const [scheduledSortBy, setScheduledSortBy] = useState<
    "date" | "organization"
  >("date");
  const [scheduledSortOrder, setScheduledSortOrder] = useState<"asc" | "desc">(
    "asc",
  );
  const [pastSortBy, setPastSortBy] = useState<"date" | "organization">("date");
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
  const [unresponsiveRequest, setUnresponsiveRequest] =
    useState<EventRequest | null>(null);
  const [selectedTspContacts, setSelectedTspContacts] = useState<string[]>([]);
  const [customTspContacts, setCustomTspContacts] = useState<string[]>([""]);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [followUpRequest, setFollowUpRequest] = useState<EventRequest | null>(
    null,
  );
  // Driver Assignment state
  const [editingDriversFor, setEditingDriversFor] = useState<number | null>(null);
  const [tempDriverInput, setTempDriverInput] = useState("");
  // Speaker Assignment state
  const [showSpeakerDialog, setShowSpeakerDialog] = useState(false);
  const [assigningSpeakerRequest, setAssigningSpeakerRequest] =
    useState<EventRequest | null>(null);
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [showCallbackDialog, setShowCallbackDialog] = useState(false);
  const [showCallCompletedDialog, setShowCallCompletedDialog] = useState(false);
  const [callCompletedRequest, setCallCompletedRequest] =
    useState<EventRequest | null>(null);

  // Get current user for permission checking
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available users for speaker/driver assignments
  const { data: availableUsers = [] } = useQuery({
    queryKey: ["/api/users/for-assignments"],
    enabled: true,
  });

  // Handle URL parameters for tab and event highlighting
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    const eventIdParam = urlParams.get("eventId");

    // Set the active tab based on URL parameter
    if (tabParam) {
      setActiveTab(tabParam);
    }

    // Highlight specific event if provided
    if (eventIdParam) {
      const eventId = parseInt(eventIdParam);
      setHighlightedEventId(eventId);

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedEventId(null);
      }, 3000);
    }
  }, []);

  // Reset pagination when search term changes
  useEffect(() => {
    setPastEventsPage(1);
  }, [searchTerm]);

  const {
    data: eventRequests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/event-requests"],
    queryFn: () => apiRequest("GET", "/api/event-requests"),
    refetchOnMount: true,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users/for-assignments"],
    queryFn: () => apiRequest("GET", "/api/users/for-assignments"),
    staleTime: 5 * 60 * 1000,
  });

  // Query for organization event counts (completed events only)
  const {
    data: organizationCounts = {},
    error: countsError,
    isLoading: countsLoading,
  } = useQuery({
    queryKey: ["/api/event-requests/organization-counts"],
    queryFn: () => apiRequest("GET", "/api/event-requests/organization-counts"),
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  // Organization counts debug logging (removed for production)

  // formatTime function moved to event-request-utils.tsx

  // Helper function to get user display name
  const getUserDisplayName = (userId: string | null | undefined) => {
    if (!userId) return "Not specified";

    // First try to find by user ID
    const user = users.find((u: any) => u.id === userId);
    if (user) {
      return user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.displayName || user.email;
    }


    // If not found by ID, check if it's already a display name (plain text)
    // This handles legacy data where names were stored directly
    if (userId.includes("@") || userId.includes("_")) {
      // Looks like a user ID that wasn't found
      return "User not found";
    } else {
      // Assume it's a plain text name (legacy data)
      return userId;
    }
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
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/event-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      setShowAddDialog(false);
      toast({ title: "Event request created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating event request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiRequest("PUT", `/api/event-requests/${id}`, data),
    onMutate: async ({ id, ...updatedData }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/event-requests"] });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(["/api/event-requests"]);

      // Optimistically update to new value
      queryClient.setQueryData(["/api/event-requests"], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === id ? { ...event, ...updatedData } : event,
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowEditDialog(false);
      setSelectedRequest(null);
      toast({ title: "Event request updated successfully" });
    },
    onError: (error: any, variables, context: any) => {
      // Rollback on error
      queryClient.setQueryData(
        ["/api/event-requests"],
        context?.previousEvents,
      );
      toast({
        title: "Error updating event request",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/event-requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({ title: "Event request deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting event request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeContactMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/event-requests/complete-contact", data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/event-requests"] });
      const previousEvents = queryClient.getQueryData(["/api/event-requests"]);

      // Optimistically update the event status
      queryClient.setQueryData(["/api/event-requests"], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === data.id
            ? { ...event, status: "contact_completed" }
            : event,
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowCompleteContactDialog(false);
      setCompletingRequest(null);
      toast({ title: "Contact completion recorded successfully" });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ["/api/event-requests"],
        context?.previousEvents,
      );
      toast({
        title: "Error recording contact completion",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
    },
  });

  const followUpMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/event-requests/follow-up", data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/event-requests"] });
      const previousEvents = queryClient.getQueryData(["/api/event-requests"]);

      // Optimistically update the event status
      queryClient.setQueryData(["/api/event-requests"], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === data.id
            ? {
                ...event,
                status: "in_process", // Both email and call follow-ups should go to in_process
                followUpMethod: data.method,
                updatedEmail: data.updatedEmail,
                followUpDate: new Date().toISOString(),
              }
            : event,
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowFollowUpDialog(false);
      setFollowUpRequest(null);
      toast({ title: "Follow-up recorded successfully" });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ["/api/event-requests"],
        context?.previousEvents,
      );
      toast({
        title: "Error recording follow-up",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
    },
  });

  const callCompletedMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("PATCH", `/api/event-requests/${data.id}/event-details`, {
        status: "scheduled",
        ...data.eventDetails,
      }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/event-requests"] });
      const previousEvents = queryClient.getQueryData(["/api/event-requests"]);

      // Optimistically update the event to scheduled
      queryClient.setQueryData(["/api/event-requests"], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === data.id
            ? {
                ...event,
                status: "scheduled",
                ...data.eventDetails,
              }
            : event,
        );
      });

      return { previousEvents };
    },
    onError: (err, data, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        queryClient.setQueryData(
          ["/api/event-requests"],
          context.previousEvents,
        );
      }
      toast({
        title: "Error",
        description: "Failed to update event details",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      setShowCallCompletedDialog(false);
      setCallCompletedRequest(null);
      toast({
        title: "Call completed",
        description: "Event moved to Scheduled status with full details",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
    },
  });

  const completeEventDetailsMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/event-requests/complete-event-details", data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/event-requests"] });
      const previousEvents = queryClient.getQueryData(["/api/event-requests"]);

      // Optimistically update the event with new details
      queryClient.setQueryData(["/api/event-requests"], (old: any) => {
        if (!old) return old;
        return old.map((event: any) =>
          event.id === data.eventId
            ? {
                ...event,
                status: "completed",
                actualEventDate: data.actualEventDate,
                actualAttendeeCount: data.actualAttendeeCount,
                notes: data.notes,
              }
            : event,
        );
      });

      return { previousEvents };
    },
    onSuccess: () => {
      setShowEventDetailsDialog(false);
      setDetailsRequest(null);
      toast({ title: "Event details saved successfully" });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(
        ["/api/event-requests"],
        context?.previousEvents,
      );
      toast({
        title: "Error saving event details",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
    },
  });

  const syncToSheetsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/import/sync-to-sheets"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({
        title: "Sync to Google Sheets successful",
        description: `Updated ${data.updated} rows in Google Sheets`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error syncing to Google Sheets",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncFromSheetsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/import/sync-from-sheets"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({
        title: "Sync from Google Sheets successful",
        description: `Processed ${data.total} rows, imported ${data.imported} new events`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error syncing from Google Sheets",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importExcelMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/import/import-excel"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({
        title: "Excel import successful",
        description: `Successfully imported ${data.imported} events out of ${data.total} parsed`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error importing Excel file",
        description: error.message,
        variant: "destructive",
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
  const startInlineEdit = (requestId: number, field: string, currentValue: string) => {
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

  const importHistoricalMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/import/import-historical"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({
        title: "Historical import successful",
        description: `Successfully imported ${data.imported} historical events from 2024`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error importing historical events",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiRequest("PUT", `/api/event-requests/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({
        title: "Event request updated",
        description: "The event request has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating event request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assignment update function
  const handleAssignmentUpdate = (eventId: number, field: string, value: any) => {
    updateMutation.mutate({
      id: eventId,
      [field]: value,
    });
  };

  // Assignment save mutations

  const saveSpeakerAssignmentMutation = useMutation({
    mutationFn: ({ eventId, speakerIds }: { eventId: number; speakerIds: string[] }) =>
      apiRequest("PUT", `/api/event-requests/${eventId}`, { assignedSpeakerIds: speakerIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      setShowSpeakerDialog(false);
      toast({ title: "Speaker assignments updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating speaker assignments",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter events by tab
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today for accurate comparison

  const requestsEvents = eventRequests.filter((req: EventRequest) => {
    // Only include new requests - clean separation
    if (!req.desiredEventDate) {
      return req.status === "new" || !req.status;
    }

    // Use the same timezone-safe parsing as formatEventDate function
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      const dateOnly = dateString.split(" ")[0];
      eventDate = new Date(dateOnly + "T12:00:00");
    } else if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      const dateOnly = dateString.split("T")[0];
      eventDate = new Date(dateOnly + "T12:00:00");
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);

    // Show future and past events that are new status
    return req.status === "new" || !req.status;
  });

  const scheduledEvents = eventRequests.filter((req: EventRequest) => {
    if (!req.desiredEventDate) return req.status === "scheduled";
    // Use the same timezone-safe parsing as formatEventDate function
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      const dateOnly = dateString.split(" ")[0];
      eventDate = new Date(dateOnly + "T12:00:00");
    } else if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      const dateOnly = dateString.split("T")[0];
      eventDate = new Date(dateOnly + "T12:00:00");
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today && req.status === "scheduled";
  });

  const pastEvents = eventRequests.filter((req: EventRequest) => {
    // DATE is the primary filter - only show events with past dates
    if (!req.desiredEventDate) {
      // No date specified - only include if status suggests it's truly done
      return req.status === "completed" || req.status === "declined";
    }

    // Parse the event date using timezone-safe logic
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      const dateOnly = dateString.split(" ")[0];
      eventDate = new Date(dateOnly + "T12:00:00");
    } else if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      const dateOnly = dateString.split("T")[0];
      eventDate = new Date(dateOnly + "T12:00:00");
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);

    // PRIMARY FILTER: Event date must be in the past
    if (eventDate >= today) return false;

    // SECONDARY FILTER: Must have a relevant status
    return (
      req.status === "completed" ||
      req.status === "contact_completed" ||
      req.status === "declined"
    );
  });

  const inProcessEvents = eventRequests.filter((req: EventRequest) => {
    // Only include events that are truly "in process" - actively being worked on
    return req.status === "in_process";
  });

  // New filtering arrays for separate tabs
  const declinedEvents = eventRequests.filter((req: EventRequest) => {
    return req.status === "declined";
  });

  const unresponsiveEvents = eventRequests.filter((req: EventRequest) => {
    return req.status === "unresponsive" || req.isUnresponsive;
  });

  const otherEvents = eventRequests.filter((req: EventRequest) => {
    const standardStatuses = [
      "new",
      "in_process",
      "scheduled",
      "completed",
      "contact_completed",
      "declined",
      "unresponsive",
    ];
    return !standardStatuses.includes(req.status || "");
  });

  // Get current events based on active tab
  const getCurrentEvents = () => {
    switch (activeTab) {
      case "requests":
        return requestsEvents;
      case "in_process":
        return inProcessEvents;
      case "scheduled":
        return scheduledEvents;
      case "past":
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
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        request.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (request.desiredEventDate &&
          typeof request.desiredEventDate === "string" &&
          request.desiredEventDate
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (request.desiredEventDate &&
          formatEventDate(request.desiredEventDate)
            .text.toLowerCase()
            .includes(searchTerm.toLowerCase()));

      // Apply status filter
      const matchesStatusFilter = () => {
        if (statusFilter === "all") return true;
        if (statusFilter === "unresponsive")
          return request.isUnresponsive === true;
        if (statusFilter === "responsive")
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
        typeof dateString === "string" &&
        dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      ) {
        const dateOnly = dateString.split(" ")[0];
        return new Date(dateOnly + "T12:00:00");
      } else if (
        dateString &&
        typeof dateString === "string" &&
        dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
      ) {
        const dateOnly = dateString.split("T")[0];
        return new Date(dateOnly + "T12:00:00");
      }
      return new Date(dateString);
    };

    const getSubmissionDate = (req: EventRequest) => {
      if (!req.createdAt) return new Date(0); // Fallback date for requests without submission dates
      return new Date(req.createdAt);
    };

    // Sort events based on tab
    if (activeTab === "requests") {
      return filtered.sort((a: any, b: any) => {
        if (requestsSortBy === "organization") {
          const orgA = a.organizationName.toLowerCase();
          const orgB = b.organizationName.toLowerCase();
          const comparison = orgA.localeCompare(orgB);
          return requestsSortOrder === "desc" ? -comparison : comparison;
        } else {
          // Sort by submission date for new requests
          const dateA = getSubmissionDate(a);
          const dateB = getSubmissionDate(b);
          return requestsSortOrder === "desc"
            ? dateB.getTime() - dateA.getTime()
            : dateA.getTime() - dateB.getTime();
        }
      });
    } else if (activeTab === "followed_up" || activeTab === "in_process") {
      return filtered.sort((a: any, b: any) => {
        if (requestsSortBy === "organization") {
          const orgA = a.organizationName.toLowerCase();
          const orgB = b.organizationName.toLowerCase();
          const comparison = orgA.localeCompare(orgB);
          return requestsSortOrder === "desc" ? -comparison : comparison;
        } else {
          // Sort by event date for in-process requests
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          return requestsSortOrder === "desc"
            ? dateB.getTime() - dateA.getTime()
            : dateA.getTime() - dateB.getTime();
        }
      });
    }

    // Sort scheduled events
    if (activeTab === "scheduled") {
      return filtered.sort((a: any, b: any) => {
        if (scheduledSortBy === "organization") {
          const orgA = a.organizationName.toLowerCase();
          const orgB = b.organizationName.toLowerCase();
          const comparison = orgA.localeCompare(orgB);
          return scheduledSortOrder === "desc" ? -comparison : comparison;
        } else {
          // Sort by date
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          return scheduledSortOrder === "desc"
            ? dateB.getTime() - dateA.getTime()
            : dateA.getTime() - dateB.getTime();
        }
      });
    }

    // Sort past events
    if (activeTab === "past") {
      return filtered.sort((a: any, b: any) => {
        if (pastSortBy === "organization") {
          const orgA = a.organizationName.toLowerCase();
          const orgB = b.organizationName.toLowerCase();
          const comparison = orgA.localeCompare(orgB);
          return pastEventsSortOrder === "desc" ? -comparison : comparison;
        } else {
          // Sort by date
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          return pastEventsSortOrder === "desc"
            ? dateB.getTime() - dateA.getTime()
            : dateA.getTime() - dateB.getTime();
        }
      });
    }

    return filtered;
  }, [
    eventRequests,
    searchTerm,
    activeTab,
    globalSearch,
    pastEventsSortOrder,
    requestsSortBy,
    requestsSortOrder,
    scheduledSortBy,
    scheduledSortOrder,
    pastSortBy,
    statusFilter,
  ]);

  // Paginated past events for display
  const paginatedPastEvents = useMemo(() => {
    if (activeTab !== "past") return filteredRequests;

    const startIndex = (pastEventsPage - 1) * pastEventsPerPage;
    const endIndex = startIndex + pastEventsPerPage;
    return filteredRequests.slice(startIndex, endIndex);
  }, [filteredRequests, activeTab, pastEventsPage, pastEventsPerPage]);

  // Pagination calculations for past events
  const pastEventsPagination = useMemo(() => {
    if (activeTab !== "past")
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

  // Add missing calculated values
  const pastEventsCount = pastEvents.length;
  const closedEventsCount = declinedEvents.length + unresponsiveEvents.length + otherEvents.length;

  // Missing render functions - basic implementations
  const renderEventCard = (request: EventRequest) => {
    return (
      <Card key={request.id} className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold">{request.organizationName}</h3>
          <p className="text-sm text-gray-600">
            Contact: {request.firstName} {request.lastName}
          </p>
          <p className="text-sm text-gray-600">
            Date: {formatEventDate(request.desiredEventDate).text}
          </p>
        </div>
      </Card>
    );
  };

  const renderPastEventCard = (request: EventRequest) => {
    return renderEventCard(request);
  };

  // Import missing WeeklyForecast component
  const WeeklyForecast = () => {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500">Weekly forecast coming soon...</p>
        </CardContent>
      </Card>
    );
  };

  // Status explanations for tooltips
  const statusExplanations = {
    new: "A new event request that hasn't been followed up with yet",
    followed_up: "Toolkit and scheduling link have been sent via email",
    in_process: "Phone call completed, scheduling in progress",
    scheduled: "Event is confirmed and scheduled with details finalized",
    completed: "Event has been successfully completed",
    declined: "Request was declined or event was cancelled",
    past: "Past event that is archived",
  };

  const getStatusDisplay = (status: string) => {
    const option = statusOptions.find((opt) => opt.value === status);
    const Icon = statusIcons[status as keyof typeof statusIcons];
    const explanation =
      statusExplanations[status as keyof typeof statusExplanations] ||
      "Status information";

    const badge = (
      <Badge
        className={
          status === "declined"
            ? "text-white border-2 font-bold shadow-lg px-3 py-1.5"
            : `${statusColors[status as keyof typeof statusColors]} px-3 py-1.5 shadow-sm hover:shadow-md transition-shadow`
        }
        style={
          status === "declined"
            ? {
                background: "linear-gradient(135deg, #A31C41 0%, #8B1538 100%)",
                borderColor: "#A31C41",
              }
            : {}
        }
      >
        <Icon className="w-4 h-4 mr-1.5" />
        <span className="font-medium">{option?.label || status}</span>
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
      user.role === "super_admin"
    );
  };

  const canEditField = (field: string) => {
    if (!user) return false;

    // Lightweight fields that volunteers can edit
    const lightweightFields = ["phone", "email", "planningNotes"];

    // Critical fields that require admin permissions
    const criticalFields = [
      "eventDate",
      "eventStartTime",
      "eventEndTime",
      "eventAddress",
      "estimatedSandwichCount",
      "deliveryDestination",
      "contact",
      "hasRefrigeration",
    ];

    if (lightweightFields.includes(field)) {
      return hasPermission(user, PERMISSIONS.MANAGE_EVENT_REQUESTS);
    }

    if (criticalFields.includes(field)) {
      return (
        hasPermission(user, PERMISSIONS.MANAGE_USERS) ||
        user.role === "super_admin"
      );
    }

    return false;
  };

  // Track pending changes without saving immediately
  const handleTrackChange = (eventId: number, field: string, value: any) => {
    if (!canEditEventRequest()) {
      toast({
        title: "Access denied",
        description: "You don't have permission to edit event requests",
        variant: "destructive",
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
                toast({ title: "Change undone" });
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
        `[AUDIT] User ${user?.email} changed ${field} from "${originalValue}" to "${value}" for event ${eventId}`,
      );
    } catch (error) {
      toast({ title: "Update failed", variant: "destructive" });
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
        title: "All changes saved",
        description: `Updated ${Object.keys(changes).length} field(s)`,
      });

      // Log audit trail for bulk save
      console.log(
        `[AUDIT] User ${user?.email} saved bulk changes for event ${eventId}:`,
        changes,
      );
    } catch (error) {
      toast({ title: "Save failed", variant: "destructive" });
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
      contact.trim(),
    );
    if (nonEmptyCustomContacts.length > 0) {
      contactData.customTspContact = nonEmptyCustomContacts.join("; ");
    }

    updateMutation.mutate({
      id: assigningContactRequest.id,
      ...contactData,
    });

    // Reset state
    setShowTspContactDialog(false);
    setAssigningContactRequest(null);
    setSelectedTspContacts([]);
    setCustomTspContacts([""]);

    toast({ title: "TSP contacts assigned successfully" });
  };

  // Handle unresponsive status management
  const handleUnresponsiveSubmit = async (data: any) => {
    if (!unresponsiveRequest) return;

    try {
      const updateData = {
        isUnresponsive: data.action === "mark",
        markedUnresponsiveAt:
          data.action === "mark" ? new Date().toISOString() : null,
        markedUnresponsiveBy: data.action === "mark" ? user?.id : null,
        unresponsiveReason: data.reason || null,
        contactMethod: data.contactMethod || null,
        nextFollowUpDate: data.nextFollowUpDate || null,
        unresponsiveNotes: data.notes || null,
        contactAttempts:
          data.action === "mark"
            ? (unresponsiveRequest.contactAttempts || 0) + 1
            : unresponsiveRequest.contactAttempts,
        lastContactAttempt:
          data.action === "mark"
            ? new Date().toISOString()
            : unresponsiveRequest.lastContactAttempt,
      };

      await updateMutation.mutateAsync({
        id: unresponsiveRequest.id,
        ...updateData,
      });

      toast({
        title:
          data.action === "mark"
            ? "Marked as unresponsive"
            : "Unresponsive status updated",
        description: `${unresponsiveRequest.organizationName} has been updated`,
      });

      setShowUnresponsiveDialog(false);
      setUnresponsiveRequest(null);

      // Log audit trail
      console.log(
        `[AUDIT] User ${user?.email} ${data.action === "mark" ? "marked" : "updated"} unresponsive status for event ${unresponsiveRequest.id}:`,
        updateData,
      );
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update unresponsive status",
        variant: "destructive",
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
      request.isUnresponsive ? "update" : "mark",
    );
    const [reason, setReason] = useState(request.unresponsiveReason || "");
    const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
    const [notes, setNotes] = useState(request.unresponsiveNotes || "");

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
                  Last attempt:{" "}
                  {new Date(request.lastContactAttempt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Reason */}
        {action !== "resolve" && (
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
              Follow-up will be scheduled for:{" "}
              {new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
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
              action === "resolve"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-amber-600 hover:bg-amber-700"
            }
          >
            {action === "mark" && "Mark as Unresponsive"}
            {action === "update" && "Update Status"}
            {action === "resolve" && "Mark as Responsive"}
          </Button>
        </div>
      </form>
    );
  };

  // Function to render modern scheduled event cards with improved visual hierarchy
  // Inline Contact Section Component  
  const ContactSection = ({ request }: { request: EventRequest }) => {
    return (
      <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200 shadow-sm">
        <h4 className="font-bold text-[#236383] text-sm mb-3 flex items-center">
          <User className="w-4 h-4 mr-2" />
          Contact Person
        </h4>
        <div className="space-y-4">

          {/* Contact Name */}
          <div className="flex items-start space-x-3">
            <User className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
            {editingField === "contact" && editingEventId === request.id ? (
              <div className="flex space-x-2 flex-1 items-center">
                <input
                  className="text-sm border rounded px-2 py-1 flex-1 bg-white"
                  value={tempValues.contact || `${request.firstName} ${request.lastName}`}
                  onChange={(e) =>
                    setTempValues((prev) => ({
                      ...prev,
                      contact: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const [firstName, ...lastNameParts] = (
                        tempValues.contact || e.target.value
                      ).split(" ");
                      handleTrackChange(request.id, "firstName", firstName);
                      handleTrackChange(request.id, "lastName", lastNameParts.join(" "));
                      setEditingField(null);
                      setEditingEventId(null);
                      setTempValues({});
                    }
                    if (e.key === "Escape") handleFieldCancel();
                  }}
                />
                <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                  onClick={() => {
                    const [firstName, ...lastNameParts] = tempValues.contact.split(" ");
                    handleTrackChange(request.id, "firstName", firstName);
                    handleTrackChange(request.id, "lastName", lastNameParts.join(" "));
                    setEditingField(null);
                    setEditingEventId(null);
                    setTempValues({});
                  }}
                >
                  ✓
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={handleFieldCancel}>
                  ✗
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 flex-1">
                <span className="text-sm font-medium text-gray-900 flex-1">
                  {getDisplayValue(request, "firstName")} {getDisplayValue(request, "lastName")}
                </span>
                {canEditField("contact") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                    onClick={() => {
                      setEditingField("contact");
                      setEditingEventId(request.id);
                      setTempValues({
                        contact: `${getDisplayValue(request, "firstName")} ${getDisplayValue(request, "lastName")}`,
                      });
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Email */}
          <div className="flex items-start space-x-3">
            <Mail className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
            {editingField === "email" && editingEventId === request.id ? (
              <div className="flex space-x-2 flex-1 items-center">
                <input
                  className="text-sm border rounded px-2 py-1 flex-1 bg-white"
                  value={tempValues.email || request.email}
                  onChange={(e) =>
                    setTempValues((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleTrackChange(
                        request.id,
                        "email",
                        tempValues.email || e.target.value,
                      );
                      setEditingField(null);
                      setEditingEventId(null);
                      setTempValues({});
                    }
                    if (e.key === "Escape") handleFieldCancel();
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    handleTrackChange(
                      request.id,
                      "email",
                      tempValues.email,
                    );
                    setEditingField(null);
                    setEditingEventId(null);
                    setTempValues({});
                  }}
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={handleFieldCancel}
                >
                  ✗
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 flex-1">
                <span className="text-sm text-gray-600 flex-1 break-all">
                  {getDisplayValue(request, "email")}
                </span>
                {canEditField("email") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                    onClick={() => {
                      setEditingField("email");
                      setEditingEventId(request.id);
                      setTempValues({
                        email: getDisplayValue(request, "email"),
                      });
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="flex items-start space-x-3">
            <Phone className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
            {editingField === "phone" && editingEventId === request.id ? (
              <div className="flex space-x-2 flex-1 items-center">
                <input
                  className="text-sm border rounded px-2 py-1 flex-1 bg-white"
                  value={tempValues.phone || request.phone || ""}
                  onChange={(e) =>
                    setTempValues((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleTrackChange(
                        request.id,
                        "phone",
                        tempValues.phone || e.target.value,
                      );
                      setEditingField(null);
                      setEditingEventId(null);
                      setTempValues({});
                    }
                    if (e.key === "Escape") handleFieldCancel();
                  }}
                  placeholder="Enter phone number"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    handleTrackChange(
                      request.id,
                      "phone",
                      tempValues.phone,
                    );
                    setEditingField(null);
                    setEditingEventId(null);
                    setTempValues({});
                  }}
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={handleFieldCancel}
                >
                  ✗
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 flex-1">
                <span className="text-sm text-gray-600 flex-1">
                  {getDisplayValue(request, "phone") || "Not provided"}
                </span>
                {canEditField("phone") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                    onClick={() => {
                      setEditingField("phone");
                      setEditingEventId(request.id);
                      setTempValues({
                        phone: getDisplayValue(request, "phone") || "",
                      });
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  // Inline EventLocationSection Component
  const EventLocationSection = ({ request }: { request: EventRequest }) => {
    const eventAddress = (request as any).eventAddress;
    
    // Only render if eventAddress exists
    if (!eventAddress) {
      return null;
    }
    
    return (
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200 shadow-sm">
        <h4 className="font-bold text-[#FBAD3F] text-sm mb-3 flex items-center">
          <MapPin className="w-4 h-4 mr-2" />
          Event Location
        </h4>
        <div className="space-y-2">
          <div className="text-sm text-gray-700">
            {eventAddress}
          </div>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(eventAddress || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View on Google Maps
          </a>
        </div>
      </div>
    );
  };

  // Inline TransportationSection Component
  const TransportationSection = ({ request }: { request: EventRequest }) => {
    return (
      <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200 shadow-sm">
        <h4 className="font-bold text-[#A31C41] text-sm mb-3 flex items-center">
          <Users className="w-4 h-4 mr-2" />
          Assignments & Transportation
        </h4>
        <div className="space-y-4">
          {/* Transportation Plan */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <h5 className="font-semibold text-gray-700 text-xs mb-2 flex items-center">
              🚛 Transportation Plan
            </h5>
            <div className="space-y-2">
              {(() => {
                const hasOvernightStorage = (request as any).overnightStorageRequired;
                const isPickup = (request as any).finalDeliveryMethod === "pickup_by_recipient";
                const pickupOrg = (request as any).pickupOrganization;
                const storageLocation = (request as any).storageLocation;
                const driver1 = (request as any).transportDriverDay1;
                const driver2 = (request as any).transportDriverDay2;
                const finalRecipient = (request as any).finalRecipientOrg;
                
                if (isPickup) {
                  return (
                    <div className="flex items-start space-x-3">
                      <span className="text-gray-500 text-xs mt-1 flex-shrink-0">🏃‍♂️</span>
                      <div className="text-xs">
                        <span className="font-medium text-purple-700">Organization Pickup</span>
                        {pickupOrg && (
                          <div className="text-gray-600 mt-1">{pickupOrg} will pick up sandwiches</div>
                        )}
                      </div>
                    </div>
                  );
                } else if (hasOvernightStorage) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-start space-x-3">
                        <span className="text-gray-500 text-xs mt-1 flex-shrink-0">🏠</span>
                        <div className="text-xs">
                          <span className="font-medium text-purple-700">Two-Step Process</span>
                          <div className="text-gray-600 mt-1">Overnight storage required</div>
                        </div>
                      </div>
                      {storageLocation && (
                        <div className="flex items-start space-x-3 ml-4">
                          <span className="text-gray-500 text-xs mt-1 flex-shrink-0">📍</span>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Storage:</span> {storageLocation}
                          </div>
                        </div>
                      )}
                      {driver1 && (
                        <div className="flex items-start space-x-3 ml-4">
                          <span className="text-gray-500 text-xs mt-1 flex-shrink-0">🚗</span>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Day 1 Driver:</span> {getUserDisplayName(driver1)}
                          </div>
                        </div>
                      )}
                      {driver2 && (
                        <div className="flex items-start space-x-3 ml-4">
                          <span className="text-gray-500 text-xs mt-1 flex-shrink-0">🚚</span>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Day 2 Driver:</span> {getUserDisplayName(driver2)}
                          </div>
                        </div>
                      )}
                      {finalRecipient && (
                        <div className="flex items-start space-x-3 ml-4">
                          <span className="text-gray-500 text-xs mt-1 flex-shrink-0">🎯</span>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Final Recipient:</span> {finalRecipient}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } else if ((request as any).finalDeliveryMethod === "direct_delivery") {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-start space-x-3">
                        <span className="text-gray-500 text-xs mt-1 flex-shrink-0">⚡</span>
                        <div className="text-xs">
                          <span className="font-medium text-purple-700">Direct Delivery</span>
                          <div className="text-gray-600 mt-1">Same day delivery from event to recipient</div>
                        </div>
                      </div>
                      {driver1 && (
                        <div className="flex items-start space-x-3 ml-4">
                          <span className="text-gray-500 text-xs mt-1 flex-shrink-0">🚗</span>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Driver:</span> {getUserDisplayName(driver1)}
                          </div>
                        </div>
                      )}
                      {finalRecipient && (
                        <div className="flex items-start space-x-3 ml-4">
                          <span className="text-gray-500 text-xs mt-1 flex-shrink-0">🎯</span>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Deliver to:</span> {finalRecipient}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div className="flex items-start space-x-3">
                      <span className="text-gray-500 text-xs mt-1 flex-shrink-0">❓</span>
                      <div className="text-xs text-gray-500 italic">
                        Transportation plan not yet specified
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        
          {/* Toolkit Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Toolkit</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getToolkitStatus().color}`}>
              {getToolkitStatus().badge}
            </span>
          </div>

          {/* Driver Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Drivers</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getDriverStatus().color}`}>
              {getDriverStatus().badge}
            </span>
          </div>

          {/* Driver Assignment Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">
                  Assigned: {(request as any).assignedDriverIds?.length || 0}/
                </span>
                {editingField === "driversNeeded" && editingEventId === request.id ? (
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="0"
                      className="text-xs border rounded px-1 py-0.5 w-12 bg-white"
                      value={tempValues.driversNeeded || (request as any).driversNeeded || 0}
                      onChange={(e) =>
                        setTempValues((prev) => ({
                          ...prev,
                          driversNeeded: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleTrackChange(
                            request.id,
                            "driversNeeded",
                            parseInt(tempValues.driversNeeded || e.target.value) || 0,
                          );
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }
                        if (e.key === "Escape") handleFieldCancel();
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        handleTrackChange(
                          request.id,
                          "driversNeeded",
                          parseInt(tempValues.driversNeeded) || 0,
                        );
                        setEditingField(null);
                        setEditingEventId(null);
                        setTempValues({});
                      }}
                    >
                      ✓
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={handleFieldCancel}
                    >
                      ✗
                    </Button>
                  </div>
                ) : (
                  <button
                    className="text-xs text-blue-700 hover:text-blue-900 underline"
                    onClick={() => {
                      setEditingField("driversNeeded");
                      setEditingEventId(request.id);
                      setTempValues({
                        driversNeeded: (request as any).driversNeeded || 0,
                      });
                    }}
                  >
                    {(request as any).driversNeeded || 0}
                  </button>
                )}
              </div>
              <button
                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200"
                onClick={() => {
                  setEditingDriversFor(request.id);
                  setTempDriverInput("");
                }}
              >
                {(request as any).assignedDriverIds?.length > 0 ? "Edit Drivers" : "+ Assign Driver"}
              </button>
            </div>
            {(request as any).assignedDriverIds?.map((driverId: string, index: number) => (
              <div key={index} className="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-200 mr-1">
                {getUserDisplayName(driverId)}
                <button
                  className="ml-1 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center"
                  onClick={() => {
                    const updatedDrivers = (request as any).assignedDriverIds?.filter((id: string, i: number) => i !== index) || [];
                    handleAssignmentUpdate(request.id, 'assignedDriverIds', updatedDrivers);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Note: TSP Contact and Speaker sections would continue here */}
          {/* Due to complexity and space, implementing core transportation functionality first */}
          
          {/* Show volunteer notes if present */}
          {(request as any).volunteerNotes && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <span className="font-medium text-yellow-800">Volunteer Notes: </span>
              <span className="text-yellow-700">{(request as any).volunteerNotes}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderScheduledEventCard = (request: EventRequest) => {
    const getDriverStatus = () => {
      const driverIds = (request as any).assignedDriverIds || [];
      const driversNeeded = (request as any).driversNeeded || 0;
      if (driversNeeded === 0)
        return { badge: "N/A", color: "bg-gray-100 text-gray-600 border-gray-200" };
      if (driverIds.length >= driversNeeded)
        return { badge: "✓ Arranged", color: "bg-green-100 text-green-700 border-green-200" };
      return { badge: "⚠️ Needed", color: "bg-orange-100 text-[#FBAD3F] border-orange-200" };
    };

    const getToolkitStatus = () => {
      const status = (request as any).toolkitStatus || "not_sent";
      switch (status) {
        case "sent":
          return { badge: "✓ Delivered", color: "bg-green-100 text-green-700 border-green-200" };
        case "received_confirmed":
          return { badge: "✓ Confirmed", color: "bg-green-100 text-green-700 border-green-200" };
        case "not_needed":
          return { badge: "N/A", color: "bg-gray-100 text-gray-600 border-gray-200" };
        case "not_sent":
          return { badge: "Not Sent", color: "bg-gray-200 text-gray-700 border-gray-300" };
        default:
          return {
            badge: "⚠️ Pending",
            color: "bg-orange-100 text-[#FBAD3F] border-orange-200",
          };
      }
    };

    const getRefrigerationStatus = () => {
      if (request.hasRefrigeration === true)
        return { badge: "✓ Available", color: "bg-green-100 text-green-700" };
      if (request.hasRefrigeration === false)
        return { badge: "❌ None", color: "bg-red-100 text-red-700" };
      return { badge: "❓ Unknown", color: "bg-yellow-100 text-yellow-700" };
    };

    return (
      <Card
        key={request.id}
        className={`group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-teal-500 bg-white overflow-hidden ${highlightedEventId === request.id ? "ring-4 ring-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100 shadow-lg" : ""} ${hasPendingChanges(request.id) ? "ring-2 ring-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50" : ""}`}
      >
        {/* Header Section with improved visual hierarchy */}
        <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-white border-b border-teal-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              {/* Organization Name with Department */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-gray-900">{request.organizationName}</h3>
                {request.department && (
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                    {request.department}
                  </span>
                )}
              </div>
              
              {/* Event Info Row with Icons */}
              <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap">
                {request.desiredEventDate && (
                  <div className="flex items-center gap-2 bg-[#FBAD3F] text-white px-3 py-1.5 rounded-lg shadow-sm">
                    <Calendar className="w-5 h-5" />
                    <span className="font-bold text-base">{formatEventDate(request.desiredEventDate).text}</span>
                  </div>
                )}
                {(request as any).eventStartTime && (
                  <div className="flex items-center gap-1.5 text-[#FBAD3F]">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{formatTime((request as any).eventStartTime)}</span>
                  </div>
                )}
                {(() => {
                  const summary = getSandwichTypesSummary(request);
                  return summary.total > 0 ? (
                    <div className="flex items-center gap-2 bg-[#236383] text-white px-3 py-1.5 rounded-lg shadow-sm">
                      <Package className="w-5 h-5" />
                      <span className="font-bold text-base">{summary.total} sandwiches</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
            
            {/* Status Badge */}
            <div className="flex-shrink-0">
              {getStatusDisplay(request.status)}
            </div>
          </div>
        </CardHeader>


        {/* Body Section with cleaner two-column layout */}
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-5">
            
            {/* Left Column: Contact & Location */}
            <div className="space-y-4">
              {/* Contact Section - Now using extracted component */}
              <ContactSection request={request} />



              {/* Event Location Section - Now using extracted component */}
              <EventLocationSection request={request} />
            </div>

            {/* Right Column: Event Details & Assignments */}
            <div className="space-y-4">
              {/* Event Details Section */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Event Planning
                </h4>
                <div className="space-y-3">
                  {/* Sandwich Count */}
                  <div className="flex items-start space-x-3">
                    <span className="text-gray-500 text-sm mt-1 flex-shrink-0">🥪</span>
                  {editingField === "sandwichTypes" &&
                  editingEventId === request.id ? (
                    <div className="flex space-x-2 flex-1 items-center">
                      <input
                        className="text-sm border rounded px-2 py-1 flex-1 bg-white"
                        value={tempValues.email || request.email}
                        onChange={(e) =>
                          setTempValues((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleTrackChange(
                              request.id,
                              "email",
                              tempValues.email || e.target.value,
                            );
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }
                          if (e.key === "Escape") handleFieldCancel();
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(
                            request.id,
                            "email",
                            tempValues.email,
                          );
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm text-gray-600 flex-1 break-all">
                        {getDisplayValue(request, "email")}
                      </span>
                      {canEditField("email") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField("email");
                            setEditingEventId(request.id);
                            setTempValues({
                              email: getDisplayValue(request, "email"),
                            });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div className="flex items-start space-x-3">
                  <Phone className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                  {editingField === "phone" && editingEventId === request.id ? (
                    <div className="flex space-x-2 flex-1 items-center">
                      <input
                        className="text-sm border rounded px-2 py-1 flex-1 bg-white"
                        value={tempValues.phone || request.phone || ""}
                        onChange={(e) =>
                          setTempValues((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleTrackChange(
                              request.id,
                              "phone",
                              tempValues.phone || e.target.value,
                            );
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }
                          if (e.key === "Escape") handleFieldCancel();
                        }}
                        placeholder="Enter phone number"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(
                            request.id,
                            "phone",
                            tempValues.phone,
                          );
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm text-gray-600 flex-1">
                        {getDisplayValue(request, "phone") || "No phone number"}
                      </span>
                      {canEditField("phone") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField("phone");
                            setEditingEventId(request.id);
                            setTempValues({
                              phone: getDisplayValue(request, "phone") || "",
                            });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Event Location Section - Now using extracted component */}
              <EventLocationSection request={request} />
            </div>

            {/* Right Column: Event Details & Assignments */}
            <div className="space-y-4">
              {/* Event Details Section */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Event Planning
                </h4>
                <div className="space-y-3">
                  {/* Sandwich Count */}
                  <div className="flex items-start space-x-3">
                    <span className="text-gray-500 text-sm mt-1 flex-shrink-0">🥪</span>
                  {editingField === "sandwichTypes" &&
                  editingEventId === request.id ? (
                    <div className="w-full bg-white border rounded-lg p-3 shadow-sm">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={tempValues.estimatedSandwichCount || 0}
                            onChange={(e) => setTempValues(prev => ({ ...prev, estimatedSandwichCount: parseInt(e.target.value) || 0 }))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm text-center"
                            placeholder="0"
                          />
                          <span className="text-sm text-gray-600">sandwiches</span>
                        </div>
                        <div>
                          <Label className="text-sm text-gray-600">Type (optional):</Label>
                          <select
                            value={tempValues.sandwichType || 'Unknown'}
                            onChange={(e) => setTempValues(prev => ({ ...prev, sandwichType: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                          >
                            <option value="Unknown">Unknown</option>
                            <option value="Deli (Turkey, Ham, etc.)">Deli (Turkey, Ham, etc.)</option>
                            <option value="Turkey">Turkey</option>
                            <option value="Ham">Ham</option>
                            <option value="PB&J">PB&J</option>
                            <option value="Vegetarian">Vegetarian</option>
                            <option value="Vegan">Vegan</option>
                            <option value="Gluten-Free">Gluten-Free</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleTrackChange(request.id, "estimatedSandwichCount", tempValues.estimatedSandwichCount);
                            handleTrackChange(request.id, "sandwichType", tempValues.sandwichType || 'Unknown');
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm text-gray-600 flex-1">
                        {(() => {
                          const summary = getSandwichTypesSummary(request);
                          return summary.hasBreakdown ? (
                            <div>
                              <span className="font-medium text-[#236383]">{summary.total}</span> sandwiches to be made
                              <div className="text-xs text-gray-500 mt-1">{summary.breakdown}</div>
                            </div>
                          ) : (
                            <span><span className="font-medium">{summary.total || "Unknown"}</span> sandwiches to be made</span>
                          );
                        })()}
                      </span>
                      {canEditField("estimatedSandwichCount") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField("sandwichTypes");
                            setEditingEventId(request.id);
                            setTempValues({
                              estimatedSandwichCount: request.estimatedSandwichCount || 0,
                              sandwichType: request.sandwichType || 'Unknown'
                            });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sandwich Destination Tracker */}
                <div className="flex items-start space-x-3">
                  <span className="text-gray-500 text-sm mt-1 flex-shrink-0">🚚</span>
                  {editingField === "deliveryDestination" && editingEventId === request.id ? (
                    <SandwichDestinationTracker
                      value={tempValues.deliveryDestination || (request as any).deliveryDestination || ""}
                      onChange={(value) => 
                        setTempValues((prev) => ({
                          ...prev,
                          deliveryDestination: value,
                        }))
                      }
                      onSave={() => {
                        handleAutosave(
                          request.id,
                          "deliveryDestination",
                          tempValues.deliveryDestination || "",
                        );
                        setEditingField(null);
                        setEditingEventId(null);
                        setTempValues({});
                      }}
                      onCancel={handleFieldCancel}
                    />
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm text-gray-600 flex-1">
                        <span className="font-medium text-gray-700">🎯 Sandwich Destination: </span>
                        <span className={`${(request as any).deliveryDestination ? 'text-green-700 font-medium' : 'text-orange-600 italic'}`}>
                          {(request as any).deliveryDestination || "⚠️ Not specified"}
                        </span>
                      </span>
                      {canEditField("deliveryDestination") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setEditingField("deliveryDestination");
                            setEditingEventId(request.id);
                            setTempValues({
                              deliveryDestination: (request as any).deliveryDestination || "",
                            });
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit Destination
                        </Button>
                      ) : (
                        <div className="text-xs text-gray-400 italic">Edit requires admin permissions</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Planning Notes */}
                {(request as any).planningNotes && (
                  <div className="flex items-start space-x-3">
                    <span className="text-gray-500 text-sm mt-1 flex-shrink-0">📝</span>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-700">Planning Notes: </span>
                      <span className="text-gray-600">{(request as any).planningNotes}</span>
                    </div>
                  </div>
                )}

              </div>
            </div>
            
            {/* Refrigeration Section */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 shadow-sm">
              <h4 className="font-bold text-blue-700 text-sm mb-3 flex items-center">
                <span className="text-base mr-2">❄️</span>
                Refrigeration Status
              </h4>
              <div className="flex items-start space-x-3">
                  <span className="text-gray-500 text-sm mt-1 flex-shrink-0">❄️</span>
                  {editingField === "refrigeration" &&
                  editingEventId === request.id ? (
                    <div className="flex space-x-2 items-center">
                      <div className="flex space-x-1">
                        <button
                          className={`px-2 py-1 text-xs rounded ${tempValues.refrigeration === true ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-green-50"}`}
                          onClick={() =>
                            setTempValues((prev) => ({
                              ...prev,
                              refrigeration: true,
                            }))
                          }
                        >
                          ✓ Available
                        </button>
                        <button
                          className={`px-2 py-1 text-xs rounded ${tempValues.refrigeration === false ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600 hover:bg-red-50"}`}
                          onClick={() =>
                            setTempValues((prev) => ({
                              ...prev,
                              refrigeration: false,
                            }))
                          }
                        >
                          ❌ None
                        </button>
                        <button
                          className={`px-2 py-1 text-xs rounded ${tempValues.refrigeration === null || tempValues.refrigeration === undefined ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600 hover:bg-yellow-50"}`}
                          onClick={() =>
                            setTempValues((prev) => ({
                              ...prev,
                              refrigeration: null,
                            }))
                          }
                        >
                          ❓ Unknown
                        </button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(
                            request.id,
                            "hasRefrigeration",
                            tempValues.refrigeration,
                          );
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm text-gray-600 flex-1">
                        {getDisplayValue(request, "hasRefrigeration") === true
                          ? "✓ Available"
                          : getDisplayValue(request, "hasRefrigeration") === false
                            ? "❌ None"
                            : "❓ Unknown"}
                      </span>
                      {canEditField("hasRefrigeration") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField("refrigeration");
                            setEditingEventId(request.id);
                            setTempValues({
                              refrigeration: getDisplayValue(
                                request,
                                "hasRefrigeration",
                              ),
                            });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


              {/* Assignments & Transportation Section - Now using extracted component */}
              <TransportationSection request={request} />
            </div>

          {/* Planning Notes Section */}
          {(request as any).planningNotes && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                <span className="w-4 h-4 mr-2">📝</span>
                Planning Notes
              </h4>
              <p className="text-sm text-gray-700">
                {(request as any).planningNotes}
              </p>
            </div>
          )}
        </CardContent>

        {/* Footer Section: Enhanced Action Buttons */}
        <div className="px-4 sm:px-6 pb-4 bg-gradient-to-b from-white to-gray-50 border-t border-gray-100">
          <div className="flex flex-wrap gap-2 pt-3 sm:pt-4">
            {hasPermission(user, "EVENT_REQUESTS_EDIT") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDetailsRequest(request);
                  setShowEventDetailsDialog(true);
                }}
                className="group hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50 hover:border-teal-300 hover:shadow-sm transition-all duration-200"
              >
                <Edit className="w-4 h-4 mr-1.5 group-hover:rotate-12 transition-transform" />
                Edit Details
              </Button>
            )}

            {getDisplayValue(request, "email") && hasPermission(user, "EVENT_REQUESTS_EDIT") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const subject = `Event Planning - ${request.organizationName}`;
                  const body = `Hello ${request.firstName},\n\nI hope this message finds you well. I'm following up regarding your upcoming event.`;
                  const emailLink = `mailto:${getDisplayValue(request, "email")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  window.open(emailLink, "_blank");
                }}
                className="group hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
              >
                <Mail className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" />
                Email Contact
              </Button>
            )}

            {hasPermission(user, "EVENT_REQUESTS_WORKFLOW") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setUnresponsiveRequest(request);
                  setShowUnresponsiveDialog(true);
                }}
                className="group hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 hover:border-amber-300 hover:shadow-sm transition-all duration-200"
              >
                <AlertTriangle className="w-4 h-4 mr-1.5 group-hover:rotate-12 transition-transform" />
                Unresponsive
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

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
            Error loading event requests:{" "}
            {(error as any)?.message || "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

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
                onClick={() => setActiveTab("forecast")}
                className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white hover:from-[#1a4d63] hover:to-[#005a66] border-0 font-semibold"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="ml-2">
                  Weekly Planning
                </span>
              </Button>
            </div>
            {/* Data Management Buttons */}
            <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_EVENT_REQUESTS_SHEET_ID || "1GsiY_Nafzt_AYr4lXd-Nc-tKiCcSIc4_FW3lDJWX_ss"}/edit`,
                  "_blank",
                )
              }
              className="text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1" />
              Google Sheets
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => syncToSheetsMutation.mutate()}
              disabled={syncToSheetsMutation.isPending}
              className="text-xs"
            >
              {syncToSheetsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              {syncToSheetsMutation.isPending ? "Syncing..." : "Force Sync"}
            </Button>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by organization, contact name, location, or event details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <div className="flex gap-2">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="initial_contact">Initial Contact</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="unresponsive">Unresponsive</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range Filter */}
              <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="next_week">Next Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="past">Past Events</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Event Request Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <TabsList className="grid w-full sm:w-auto grid-cols-3 sm:grid-cols-6 lg:grid-cols-7">
              <TabsTrigger value="need_follow_up" className="text-xs">
                Need Follow-up
                {filteredRequests.filter(req => 
                  req.status === "initial_contact" || 
                  req.status === "pending" || 
                  req.status === "follow_up_needed"
                ).length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 text-xs">
                    {filteredRequests.filter(req => 
                      req.status === "initial_contact" || 
                      req.status === "pending" || 
                      req.status === "follow_up_needed"
                    ).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="followed_up" className="text-xs">
                Followed Up
                {filteredRequests.filter(req => req.status === "contacted").length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-700 text-xs">
                    {filteredRequests.filter(req => req.status === "contacted").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="in_process" className="text-xs">
                In Process
                {filteredRequests.filter(req => 
                  req.status === "confirmed" || 
                  req.status === "planning"
                ).length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700 text-xs">
                    {filteredRequests.filter(req => 
                      req.status === "confirmed" || 
                      req.status === "planning"
                    ).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="text-xs">
                Scheduled
                {filteredRequests.filter(req => req.status === "scheduled").length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700 text-xs">
                    {filteredRequests.filter(req => req.status === "scheduled").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="past_events" className="text-xs">
                Past Events
                {pastEventsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-700 text-xs">
                    {pastEventsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="closed_events" className="text-xs">
                Closed
                {closedEventsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-700 text-xs">
                    {closedEventsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="forecast" className="text-xs">
                Weekly Forecast
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <TabsContent value="need_follow_up">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Events Needing Follow-up ({filteredRequests.filter(req => 
                    req.status === "initial_contact" || 
                    req.status === "pending" || 
                    req.status === "follow_up_needed"
                  ).length})
                </h3>
              </div>
              {filteredRequests.filter(req => 
                req.status === "initial_contact" || 
                req.status === "pending" || 
                req.status === "follow_up_needed"
              ).length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No event requests found.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.filter(req => 
                    req.status === "initial_contact" || 
                    req.status === "pending" || 
                    req.status === "follow_up_needed"
                  ).map((request) => renderEventCard(request))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="followed_up">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Events Followed Up ({filteredRequests.filter(req => req.status === "contacted").length})
                </h3>
              </div>
              {filteredRequests.filter(req => req.status === "contacted").length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">
                      No followed up events found.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.filter(req => req.status === "contacted").map((request) => renderEventCard(request))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="in_process">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Events In Process ({filteredRequests.filter(req => req.status === "confirmed" || req.status === "planning").length})
                </h3>
              </div>
              {filteredRequests.filter(req => req.status === "confirmed" || req.status === "planning").length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No in process events found.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.filter(req => req.status === "confirmed" || req.status === "planning").map((request) => renderEventCard(request))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="scheduled">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-green-600" />
                  Scheduled Events ({filteredRequests.filter(req => req.status === "scheduled").length})
                </h3>
                <div className="text-sm text-gray-600">
                  Events ready for sandwich collection and delivery
                </div>
              </div>
              {filteredRequests.filter(req => req.status === "scheduled").length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No scheduled events found.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.filter(req => req.status === "scheduled").map((request) => renderScheduledEventCard(request))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="past_events">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Past Events</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {Math.ceil(pastEventsCount / itemsPerPage)}
                  </span>
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
                    {paginatedPastEvents.map((request) => renderPastEventCard(request))}
                  </div>

                  {/* Pagination Controls */}
                  {Math.ceil(pastEventsCount / itemsPerPage) > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600 px-3">
                        Page {currentPage} of {Math.ceil(pastEventsCount / itemsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(pastEventsCount / itemsPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(pastEventsCount / itemsPerPage)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="closed_events">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Closed Events</h3>
              
              {declinedEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-700 flex items-center">
                      <XCircle className="w-5 h-5 mr-2" />
                      Declined Events ({declinedEvents.length})
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
                          className="p-3 bg-red-50 rounded-lg border border-red-200"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-red-900">{request.organizationName}</h4>
                              <p className="text-sm text-red-700">Contact: {request.firstName} {request.lastName}</p>
                              <p className="text-xs text-red-600 mt-1">{formatEventDate(request.desiredEventDate).text}</p>
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              {request.status === "declined" ? "Declined" : "Canceled"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {unresponsiveEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-amber-700 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Unresponsive Events ({unresponsiveEvents.length})
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
                          className="p-3 bg-amber-50 rounded-lg border border-amber-200"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-amber-900">{request.organizationName}</h4>
                              <p className="text-sm text-amber-700">Contact: {request.firstName} {request.lastName}</p>
                              <p className="text-xs text-amber-600 mt-1">{formatEventDate(request.desiredEventDate).text}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                              Unresponsive
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {otherEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-gray-700 flex items-center">
                      <HelpCircle className="w-5 h-5 mr-2" />
                      Other Events ({otherEvents.length})
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
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">{request.organizationName}</h4>
                              <p className="text-sm text-gray-700">Contact: {request.firstName} {request.lastName}</p>
                              <p className="text-xs text-gray-600 mt-1">{formatEventDate(request.desiredEventDate).text}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {request.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="forecast">
            <WeeklyForecast />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
