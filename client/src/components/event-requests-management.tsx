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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";

// Utility function to convert 24-hour time to 12-hour format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return "";

  const [hours, minutes] = time24.split(":");
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
const getSandwichTypesSummary = (request: any) => {
  if (request.estimatedSandwichCount) {
    const total = request.estimatedSandwichCount;
    const type = request.sandwichType || 'Unknown';
    return { 
      total, 
      breakdown: type !== 'Unknown' ? `${total} ${type}` : `${total} sandwiches`,
      hasBreakdown: type !== 'Unknown'
    };
  }
  
  return { total: 0, breakdown: 'Unknown', hasBreakdown: false };
};

// Enhanced date formatting with day-of-week and color coding
const formatEventDate = (dateString: string) => {
  try {
    if (!dateString)
      return { text: "No date provided", className: "text-gray-500" };

    // Parse the date string safely - handle database timestamps, YYYY-MM-DD, and ISO dates
    let date: Date;
    if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      // Database timestamp format: "2025-09-03 00:00:00"
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split(" ")[0];
      date = new Date(dateOnly + "T12:00:00");
    } else if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
    ) {
      // ISO format with midnight time (e.g., "2025-09-03T00:00:00.000Z")
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split("T")[0];
      date = new Date(dateOnly + "T12:00:00");
    } else if (dateString.includes("T") || dateString.includes("Z")) {
      date = new Date(dateString);
    } else if (
      dateString &&
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2}$/)
    ) {
      // For YYYY-MM-DD format, add noon to prevent timezone shift
      date = new Date(dateString + "T12:00:00");
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return { text: "Invalid date", className: "" };

    const dayOfWeek = date.getDay();
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const dateFormatted = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const isWedOrThu = dayOfWeek === 3 || dayOfWeek === 4;
    let className = "";
    if (dayOfWeek === 2) {
      className = "text-gray-700 font-medium";
    } else if (isWedOrThu) {
      className = "text-orange-600 font-medium";
    } else {
      className = "text-[#236383] font-bold";
    }

    return {
      text: dateFormatted,
      className,
      dayName,
      isWedOrThu,
    };
  } catch (error) {
    return { text: "Invalid date", className: "" };
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

  // Helper function to convert military time to 12-hour format
  const formatTime = (militaryTime: string | null | undefined) => {
    if (!militaryTime) return "Not specified";
    
    try {
      const [hours, minutes] = militaryTime.split(":");
      const time = new Date();
      time.setHours(parseInt(hours), parseInt(minutes));
      return time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return militaryTime; // Return original if parsing fails
    }
  };

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
                  <div className="flex items-center gap-1.5 text-[#FBAD3F]">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">{formatEventDate(request.desiredEventDate).text}</span>
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
                    <div className="flex items-center gap-1.5 text-[#236383]">
                      <Package className="w-4 h-4" />
                      <span className="font-medium">{summary.total} sandwiches</span>
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


        {/* Body Section with improved spacing */}
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            
            {/* Left Column: Contact Information */}
            <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="font-bold text-[#236383] text-sm sm:text-base mb-3 flex items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#236383] flex items-center justify-center mr-2">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-sm sm:text-base">Contact Information</span>
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
            </div>

            {/* Center Column: Event Logistics */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="font-bold text-[#FBAD3F] text-sm sm:text-base mb-3 flex items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FBAD3F] flex items-center justify-center mr-2">
                  <Building className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-sm sm:text-base">Event Details</span>
              </h4>
              <div className="space-y-4">
                
                {/* Address */}
                <div className="flex items-start space-x-3">
                  <Building className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                  {editingField === "address" &&
                  editingEventId === request.id ? (
                    <div className="flex space-x-2 flex-1 items-center">
                      <input
                        className="text-sm border rounded px-2 py-1 flex-1 bg-white"
                        value={tempValues.address || request.eventAddress || ""}
                        onChange={(e) =>
                          setTempValues((prev) => ({
                            ...prev,
                            address: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleTrackChange(
                              request.id,
                              "eventAddress",
                              tempValues.address || e.target.value,
                            );
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }
                          if (e.key === "Escape") handleFieldCancel();
                        }}
                        placeholder="Enter event address"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(
                            request.id,
                            "eventAddress",
                            tempValues.address,
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
                        {getDisplayValue(request, "eventAddress") ||
                          "No address provided"}
                      </span>
                      {canEditField("eventAddress") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField("address");
                            setEditingEventId(request.id);
                            setTempValues({
                              address:
                                getDisplayValue(request, "eventAddress") || "",
                            });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

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

                {/* Event Address */}
                {(request as any).eventAddress && (
                  <div className="flex items-start space-x-3">
                    <span className="text-gray-500 text-sm mt-1 flex-shrink-0">📍</span>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-700">Event Location: </span>
                      <span className="text-gray-600">{(request as any).eventAddress}</span>
                    </div>
                  </div>
                )}

                {/* Transportation Plan Section - New Workflow */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-4">
                  <h5 className="font-semibold text-purple-800 text-sm mb-3 flex items-center">
                    🚛 Transportation Plan
                  </h5>
                  <div className="space-y-2">
                    {(() => {
                      const hasOvernightStorage = (request as any).overnightStorageRequired;
                      const isPickup = (request as any).finalDeliveryMethod === "pickup_by_recipient";
                      const pickupOrg = (request as any).pickupOrganization;
                      const storageLocation = (request as any).storageLocation;
                      const driver1 = (request as any).transportDriver1;
                      const driver2 = (request as any).transportDriver2;
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
                      } else if (driver1 || (request as any).finalDeliveryMethod === "direct_delivery") {
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

                {/* Refrigeration */}
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


            {/* Right Column: Status & Assignments */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="font-bold text-[#A31C41] text-sm sm:text-base mb-3 flex items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#A31C41] flex items-center justify-center mr-2">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-sm sm:text-base">Assignments</span>
              </h4>
              <div className="space-y-4">
                
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
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
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

                {/* TSP Contact Assignment */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">TSP Contact</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs bg-gradient-to-r from-[#236383] to-[#007E8C] text-white hover:from-[#1a4d63] hover:to-[#005a66] border-0"
                      onClick={() => {
                        setAssigningContactRequest(request);
                        setShowTspContactDialog(true);
                        const currentContacts = [
                          (request as any).tspContact,
                          (request as any).tspContactAssigned,
                          (request as any).additionalContact1,
                          (request as any).additionalContact2,
                          (request as any).customTspContact,
                        ].filter(Boolean);
                        setSelectedTspContacts(currentContacts);
                      }}
                    >
                      <Users className="w-3 h-3 mr-1" />
                      Manage TSP Contact
                    </Button>
                  </div>
                  
                  {/* TSP Contact Display - Visually distinct and larger */}
                  <div className="bg-white border-2 border-[#236383] rounded-lg p-4">
                    {(() => {
                      const currentContacts = [
                        (request as any).tspContact,
                        (request as any).tspContactAssigned,
                        (request as any).additionalContact1,
                        (request as any).additionalContact2,
                        (request as any).customTspContact,
                      ].filter(Boolean);

                      if (currentContacts.length === 0) {
                        return (
                          <div className="text-center py-3">
                            <span className="text-gray-400 text-sm italic">No TSP contact assigned</span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-[#236383] uppercase tracking-wide mb-2">
                            Assigned TSP Team ({currentContacts.length})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {currentContacts.map((contactId: string, index: number) => (
                              <div key={index} className="flex items-center bg-gradient-to-r from-[#236383] to-[#007E8C] text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm">
                                <Users className="w-4 h-4 mr-2" />
                                {getUserDisplayName(contactId)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Pickup Time Display */}
                {(request as any).pickupTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Pickup Time</span>
                    <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">
                      {formatTime((request as any).pickupTime)}
                    </span>
                  </div>
                )}

                {/* Speaker Assignment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Speakers</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600">
                        Assigned: {(request as any).assignedSpeakerIds?.length || 0}/
                      </span>
                      {editingField === "speakersNeeded" && editingEventId === request.id ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            className="text-xs border rounded px-1 py-0.5 w-12 bg-white"
                            value={tempValues.speakersNeeded || (request as any).speakersNeeded || 0}
                            onChange={(e) =>
                              setTempValues((prev) => ({
                                ...prev,
                                speakersNeeded: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleTrackChange(
                                  request.id,
                                  "speakersNeeded",
                                  parseInt(tempValues.speakersNeeded || e.target.value) || 0,
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
                                "speakersNeeded",
                                parseInt(tempValues.speakersNeeded) || 0,
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
                          className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
                          onClick={() => {
                            setEditingField("speakersNeeded");
                            setEditingEventId(request.id);
                            setTempValues({
                              speakersNeeded: (request as any).speakersNeeded || 0,
                            });
                          }}
                        >
                          {(request as any).speakersNeeded || 0}
                        </button>
                      )}
                    </div>
                    <button
                      className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-1 rounded border border-purple-200"
                      onClick={() => {
                        setAssigningSpeakerRequest(request);
                        setShowSpeakerDialog(true);
                        const currentSpeakers = (request as any).assignedSpeakerIds || [];
                        setSelectedSpeakers(currentSpeakers);
                      }}
                    >
                      {(request as any).assignedSpeakerIds?.length > 0 ? "Edit Speakers" : "+ Assign Speaker"}
                    </button>
                  </div>
                  {(request as any).assignedSpeakerIds?.map((speakerId: string, index: number) => (
                      <div key={index} className="inline-flex items-center bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs border border-purple-200 mr-1">
                        {getUserDisplayName(speakerId)}
                        <button
                          className="ml-1 hover:bg-purple-200 rounded-full w-4 h-4 flex items-center justify-center"
                          onClick={() => {
                            const updatedSpeakers = (request as any).assignedSpeakerIds?.filter((id: string, i: number) => i !== index) || [];
                            handleAssignmentUpdate(request.id, 'assignedSpeakerIds', updatedSpeakers);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                {/* Show volunteer notes if present */}
                {(request as any).volunteerNotes && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <span className="font-medium text-yellow-800">Volunteer Notes: </span>
                    <span className="text-yellow-700">{(request as any).volunteerNotes}</span>
                  </div>
                )}
              </div>
            </div>
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
                Email
              </Button>
            )}

            {hasPendingChanges(request.id) && (
              <Button
                size="sm"
                onClick={() => handleSaveAllChanges(request.id)}
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Save className="w-4 h-4 mr-1.5 animate-pulse" />
                Save Changes
              </Button>
            )}

            {/* Past Event Check-in buttons */}
            {request.status === "scheduled" &&
              (() => {
                try {
                  let eventDate = new Date();
                  if (typeof request.desiredEventDate === "string") {
                    eventDate = new Date(request.desiredEventDate);
                  } else if (request.desiredEventDate instanceof Date) {
                    eventDate = new Date(request.desiredEventDate);
                  }

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  eventDate.setHours(0, 0, 0, 0);

                  return eventDate < today;
                } catch {
                  return false;
                }
              })() && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[#FBAD3F] hover:text-[#FBAD3F] border-[#FBAD3F] hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 hover:shadow-sm transition-all duration-200"
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    1 Week Check-in
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-600 hover:text-amber-800 border-amber-200 hover:bg-gradient-to-r hover:from-amber-50 hover:to-yellow-50 hover:shadow-sm transition-all duration-200"
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    1 Day Check-in
                  </Button>
                </>
              )}
          </div>
        </div>
      </Card>
    );
  };

  // Function to render standard event cards (for requests and past events)
  const renderStandardEventCard = (request: EventRequest) => (
    <Card
      key={request.id}
      className={`hover:shadow-xl transition-all duration-300 border-l-4 border-l-[#236383] bg-gradient-to-br from-white to-orange-50 ${highlightedEventId === request.id ? "ring-4 ring-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center space-x-3 text-xl mb-3">
              <Building className="w-6 h-6" style={{ color: "#236383" }} />
              <span className="text-gray-900">
                {request.organizationName}
                {request.department && (
                  <span className="text-sm text-gray-600 ml-2">
                    - {request.department}
                  </span>
                )}
              </span>
              {request.organizationExists && (
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    borderColor: "#FBAD3F",
                  }}
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Potential Duplicate
                </Badge>
              )}
            </CardTitle>

            <div className="space-y-2">
              {/* Prominent Submission Date Display */}
              <div className="flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-orange-50 p-2 rounded-lg border border-[#FBAD3F]">
                <Calendar className="w-5 h-5 text-[#FBAD3F]" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-[#FBAD3F] uppercase tracking-wide">
                    Submitted
                  </span>
                  <span className="text-sm font-medium text-gray-600">
                    {(() => {
                      try {
                        let date: Date;
                        if (
                          request.createdAt.match(
                            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
                          )
                        ) {
                          const [datePart, timePart] =
                            request.createdAt.split(" ");
                          date = new Date(datePart + "T" + timePart);
                        } else {
                          date = new Date(request.createdAt);
                        }
                        return isNaN(date.getTime())
                          ? "Invalid date"
                          : date.toLocaleDateString("en-US", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            });
                      } catch (error) {
                        return "Invalid date";
                      }
                    })()}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <User className="w-5 h-5" style={{ color: "#236383" }} />
                <span
                  className="text-lg font-semibold"
                  style={{ color: "#236383" }}
                >
                  {request.firstName} {request.lastName}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5" style={{ color: "#236383" }} />
                <span
                  className="text-base font-medium"
                  style={{ color: "#236383" }}
                >
                  {request.email}
                </span>
              </div>
              {request.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-5 h-5" style={{ color: "#236383" }} />
                  <span
                    className="text-base font-medium"
                    style={{ color: "#236383" }}
                  >
                    {request.phone}
                  </span>
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
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to delete this event request?",
                    )
                  ) {
                    deleteMutation.mutate(request.id);
                  }
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Department Field - Hide if it contains invalid values like "Yes"/"No" from data mapping issues */}
          {request.department && 
           !["Yes", "No", "yes", "no", "Unknown", "unknown", "i_dont_know"].includes(request.department.toLowerCase()) && (
            <p className="flex items-center">
              <Building className="w-4 h-4 mr-2 text-gray-500" />
              <strong>Department:</strong>
              <span className="ml-2">{request.department}</span>
            </p>
          )}
          
          {request.desiredEventDate && (
            <p className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-gray-500" />
              <strong>Desired Date:</strong>
              <span className="ml-2">
                {(() => {
                  const dateInfo = formatEventDate(request.desiredEventDate);
                  return (
                    <span className={dateInfo.className}>{dateInfo.text}</span>
                  );
                })()}
              </span>
            </p>
          )}
          
          {/* Previously Hosted - Enhanced display with icons and badges */}
          <div className="flex items-center">
            <History className="w-4 h-4 mr-2 text-gray-500" />
            <strong>Previously Hosted:</strong>
            <span className="ml-2">
              {(() => {
                const previouslyHostedValue = request.previouslyHosted;
                const matchedOption = previouslyHostedOptions.find(
                  (opt) => opt.value === previouslyHostedValue
                );
                
                if (matchedOption) {
                  return (
                    <Badge 
                      variant={matchedOption.value === "yes" ? "default" : "secondary"}
                      className={`text-xs ${
                        matchedOption.value === "yes" 
                          ? "bg-green-100 text-green-800 border-green-300" 
                          : matchedOption.value === "no" 
                          ? "bg-orange-100 text-orange-800 border-orange-300"
                          : "bg-gray-100 text-gray-700 border-gray-300"
                      }`}
                    >
                      {matchedOption.value === "yes" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {matchedOption.value === "no" && <XCircle className="w-3 h-3 mr-1" />}
                      {matchedOption.value === "i_dont_know" && <HelpCircle className="w-3 h-3 mr-1" />}
                      {matchedOption.label}
                    </Badge>
                  );
                } else {
                  // Handle case where data might be in wrong field due to import issues
                  return (
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 border-gray-300">
                      <HelpCircle className="w-3 h-3 mr-1" />
                      Unknown
                    </Badge>
                  );
                }
              })()}
            </span>
          </div>
          {request.message && (
            <div>
              <strong>Additional Information:</strong>
              <p className="mt-1 text-gray-600">{request.message}</p>
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t">
            <div className="text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                {/* Unresponsive Status Badge */}
                {request.isUnresponsive && (
                  <Badge
                    variant="destructive"
                    className="text-xs bg-red-100 text-red-700 border-red-300"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Unresponsive
                  </Badge>
                )}
              </div>
              {request.status === "new" && !request.contactCompletedAt && (
                <div className="font-medium" style={{ color: "#FBAD3F" }}>
                  Action needed:{" "}
                  {(() => {
                    try {
                      // Parse timestamp safely to preserve the original time
                      let submissionDate: Date;
                      if (
                        request.createdAt.match(
                          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
                        )
                      ) {
                        const [datePart, timePart] =
                          request.createdAt.split(" ");
                        submissionDate = new Date(datePart + "T" + timePart);
                      } else {
                        submissionDate = new Date(request.createdAt);
                      }
                      const targetDate = new Date(
                        submissionDate.getTime() + 3 * 24 * 60 * 60 * 1000,
                      );
                      const daysUntilTarget = Math.ceil(
                        (targetDate.getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24),
                      );
                      if (daysUntilTarget > 0) {
                        return `Contact within ${daysUntilTarget} day${daysUntilTarget === 1 ? "" : "s"}`;
                      } else {
                        const daysOverdue = Math.abs(daysUntilTarget);
                        return `Contact overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;
                      }
                    } catch (error) {
                      return "Contact needed";
                    }
                  })()}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmailComposerRequest(request);
                  setShowEmailComposer(true);
                }}
                className="text-teal-600 hover:text-teal-800 bg-gradient-to-r from-teal-50 to-cyan-100 hover:from-teal-100 hover:to-cyan-200 flex-shrink-0"
              >
                <Mail className="h-4 w-4 mr-1" />
                Email Contact
              </Button>

              {/* Show "Followed Up" only for new requests in Event Requests tab */}
              {activeTab === "requests" &&
                request.status === "new" &&
                !request.followUpDate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFollowUpRequest(request);
                      setShowFollowUpDialog(true);
                    }}
                    className="bg-[#FBAD3F] hover:bg-[#e69d36] text-white border-[#FBAD3F] flex-shrink-0"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Followed Up
                  </Button>
                )}

              {/* Show unresponsive workflow buttons for new requests */}
              {activeTab === "requests" &&
                request.status === "new" &&
                !request.isUnresponsive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUnresponsiveRequest(request);
                      setShowUnresponsiveDialog(true);
                    }}
                    className="text-amber-600 hover:text-amber-800 bg-gradient-to-r from-amber-50 to-yellow-100 hover:from-amber-100 hover:to-yellow-200 flex-shrink-0"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Mark Unresponsive
                  </Button>
                )}

              {/* Show if already marked unresponsive */}
              {request.isUnresponsive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUnresponsiveRequest(request);
                    setShowUnresponsiveDialog(true);
                  }}
                  className="text-red-600 hover:text-red-800 bg-gradient-to-r from-red-50 to-pink-100 hover:from-red-100 hover:to-pink-200 flex-shrink-0"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Manage Unresponsive
                </Button>
              )}

              {/* Show "Update Event Details" only for past events tab */}
              {activeTab === "past" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setDetailsRequest(request);
                    setShowEventDetailsDialog(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  View Event Details
                </Button>
              )}
            </div>
          </div>

          {/* Save All Changes Button - only show if there are pending changes */}
          {hasPendingChanges(request.id) && (
            <div className="pt-4 border-t bg-yellow-50 -mx-6 -mb-6 px-6 pb-6 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-amber-700 font-medium">
                  ⚠️ You have unsaved changes
                </div>
                <Button
                  onClick={() => handleSaveAllChanges(request.id)}
                  disabled={updateMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  size="sm"
                >
                  {updateMutation.isPending ? "Saving..." : "Save All Changes"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Function to render comprehensive past event cards with all details
  const renderPastEventCard = (request: EventRequest) => (
    <Card
      key={request.id}
      className={`hover:shadow-xl transition-all duration-300 border-l-4 border-l-gray-500 bg-gradient-to-br from-white to-gray-50 ${highlightedEventId === request.id ? "ring-4 ring-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Organization Name and Event Date */}
            <CardTitle className="flex items-center space-x-3 text-xl mb-2">
              <CheckCircle className="w-6 h-6 text-gray-600" />
              <div className="flex-1">
                {/* Organization Name with inline editing */}
                <div className="flex items-center space-x-2 mb-1">
                  {isEditing(request.id, 'organizationName') ? (
                    <div className="flex items-center space-x-2 flex-1">
                      <Input
                        value={editValues[`${request.id}-organizationName`] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [`${request.id}-organizationName`]: e.target.value })}
                        placeholder="Organization name"
                        className="h-8 text-sm font-semibold"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                        onClick={() => saveInlineEdit(request.id, 'organizationName')}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                        onClick={() => cancelInlineEdit(request.id, 'organizationName')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-gray-900 text-xl font-semibold">
                        {request.organizationName}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        onClick={() => startInlineEdit(request.id, 'organizationName', request.organizationName)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                
                {/* Department with inline editing */}
                <div className="flex items-center space-x-2">
                  {isEditing(request.id, 'department') ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        value={editValues[`${request.id}-department`] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [`${request.id}-department`]: e.target.value })}
                        placeholder="Department (optional)"
                        className="h-6 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-green-600 hover:text-green-800"
                        onClick={() => saveInlineEdit(request.id, 'department')}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-red-600 hover:text-red-800"
                        onClick={() => cancelInlineEdit(request.id, 'department')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {request.department && (
                        <>
                          <span className="text-lg font-medium text-gray-700">
                            {request.department}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                            onClick={() => startInlineEdit(request.id, 'department', request.department || '')}
                          >
                            <Edit className="h-2 w-2" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardTitle>

            {/* Event Date */}
            {request.desiredEventDate && (
              <div className="text-lg font-semibold text-gray-700 mb-2">
                {(() => {
                  const dateInfo = formatEventDate(request.desiredEventDate);
                  return dateInfo.text;
                })()}
              </div>
            )}

            {/* Event Address (smaller, below other info) */}
            {request.eventAddress && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                <Building className="w-4 h-4" />
                <span>{request.eventAddress}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Badge variant="secondary" className="text-xs">
              Event Completed
            </Badge>
            {/* Edit button for admins */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmailComposerRequest(request);
                  setShowEmailComposer(true);
                }}
                className="text-teal-600 hover:text-teal-800 bg-gradient-to-r from-teal-50 to-cyan-100 hover:from-teal-100 hover:to-cyan-200"
              >
                <Mail className="h-4 w-4 mr-1" />
                Email Contact
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRequest(request);
                  setCurrentEditingStatus(request.status);
                  setShowEditDialog(true);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteRequest(request)}
                className="text-red-600 hover:text-red-800 bg-gradient-to-r from-red-50 to-pink-100 hover:from-red-100 hover:to-pink-200"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleteMutation.isPending ? "Deleting..." : "Delete Event"}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Prominent Sandwich Count */}
          {(() => {
            const summary = getSandwichTypesSummary(request);
            return summary.total > 0 ? (
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-[#FBAD3F]">
                <div className="flex items-center justify-center space-x-3">
                  <span className="text-3xl">🥪</span>
                  <div className="text-center">
                    <span className="text-2xl font-bold text-[#FBAD3F]">
                      {summary.total} Sandwiches
                    </span>
                    {summary.hasBreakdown && (
                      <div className="text-sm text-[#FBAD3F]/80 mt-1">
                        {summary.breakdown}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null;
          })()}


          {/* Organization Contact Information */}
          <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
            <h4 className="font-semibold text-teal-800 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Organization Contact
            </h4>
            <div className="space-y-1 text-sm text-teal-700">
              <div>
                <strong>Name:</strong> {request.firstName} {request.lastName}
              </div>
              <div className="break-all">
                <strong>Email:</strong> {request.email}
              </div>
              {request.phone && (
                <div>
                  <strong>Phone:</strong> {request.phone}
                </div>
              )}
              {request.department && (
                <div>
                  <strong>Department:</strong> {request.department}
                </div>
              )}
            </div>
          </div>

          {/* Event Summary with all remaining details */}
          <div className="bg-orange-50 p-3 rounded-lg border border-[#FBAD3F]">
            <h4 className="font-semibold text-[#FBAD3F] mb-2">
              Event Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* Event Start Time with inline editing */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {isEditing(request.id, 'eventStartTime') ? (
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#FBAD3F]">Start Time:</span>
                      <input
                        type="time"
                        value={editValues[`${request.id}-eventStartTime`] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [`${request.id}-eventStartTime`]: e.target.value })}
                        className="h-6 px-2 text-xs border rounded"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-green-600 hover:text-green-800"
                        onClick={() => saveInlineEdit(request.id, 'eventStartTime')}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-red-600 hover:text-red-800"
                        onClick={() => cancelInlineEdit(request.id, 'eventStartTime')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-800">
                        <span className="font-semibold text-blue-700">Start Time:</span>{" "}
                        <span className="text-gray-900 font-medium">{(request as any).eventStartTime ? formatTime12Hour((request as any).eventStartTime) : "Not set"}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-[#FBAD3F] hover:text-orange-600"
                        onClick={() => startInlineEdit(request.id, 'eventStartTime', (request as any).eventStartTime || '')}
                      >
                        <Edit className="h-2 w-2" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Event End Time with inline editing */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {isEditing(request.id, 'eventEndTime') ? (
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#FBAD3F]">End Time:</span>
                      <input
                        type="time"
                        value={editValues[`${request.id}-eventEndTime`] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [`${request.id}-eventEndTime`]: e.target.value })}
                        className="h-6 px-2 text-xs border rounded"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-green-600 hover:text-green-800"
                        onClick={() => saveInlineEdit(request.id, 'eventEndTime')}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-red-600 hover:text-red-800"
                        onClick={() => cancelInlineEdit(request.id, 'eventEndTime')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-800">
                        <span className="font-semibold text-blue-700">End Time:</span>{" "}
                        <span className="text-gray-900 font-medium">{(request as any).eventEndTime ? formatTime12Hour((request as any).eventEndTime) : "Not set"}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-[#FBAD3F] hover:text-orange-600"
                        onClick={() => startInlineEdit(request.id, 'eventEndTime', (request as any).eventEndTime || '')}
                      >
                        <Edit className="h-2 w-2" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Pickup Time with inline editing */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {isEditing(request.id, 'pickupTime') ? (
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#FBAD3F]">Pickup Time:</span>
                      <input
                        type="time"
                        value={editValues[`${request.id}-pickupTime`] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [`${request.id}-pickupTime`]: e.target.value })}
                        className="h-6 px-2 text-xs border rounded"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-green-600 hover:text-green-800"
                        onClick={() => saveInlineEdit(request.id, 'pickupTime')}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-red-600 hover:text-red-800"
                        onClick={() => cancelInlineEdit(request.id, 'pickupTime')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-800">
                        <span className="font-semibold text-blue-700">Pickup Time:</span>{" "}
                        <span className="text-gray-900 font-medium">{(request as any).pickupTime ? formatTime12Hour((request as any).pickupTime) : "Not set"}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-[#FBAD3F] hover:text-orange-600"
                        onClick={() => startInlineEdit(request.id, 'pickupTime', (request as any).pickupTime || '')}
                      >
                        <Edit className="h-2 w-2" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sandwich details */}
              {(request as any).sandwichTypes && (
                <div className="text-gray-800">
                  <span className="font-semibold text-green-700">Sandwich Types:</span>{" "}
                  <span className="text-gray-900 font-medium">{(request as any).sandwichTypes}</span>
                </div>
              )}

              {/* Drivers section */}
              <div className="text-gray-800">
                <span className="font-semibold text-purple-700">Drivers:</span>{" "}
                <span className="text-gray-900 font-medium">{(request as any).driverDetails || "Not specified"}</span>
              </div>

              {/* Speakers section */}
              <div className="text-gray-800">
                <span className="font-semibold text-indigo-700">Speakers:</span>{" "}
                <span className="text-gray-900 font-medium">{(request as any).speakerDetails || "Not specified"}</span>
              </div>

              {/* Other logistics */}
              <div className="text-gray-800">
                <span className="font-semibold text-cyan-700">Refrigeration:</span>{" "}
                <span className="text-gray-900 font-medium">{request.hasRefrigeration === true
                  ? "Available"
                  : request.hasRefrigeration === false
                    ? "Not available"
                    : "Not specified"}</span>
              </div>
              {(request as any).additionalRequirements && (
                <div className="text-gray-800">
                  <span className="font-semibold text-red-700">Special Requirements:</span>{" "}
                  <span className="text-gray-900 font-medium">{(request as any).additionalRequirements}</span>
                </div>
              )}

              {/* Include original message in event summary if it exists and isn't generic */}
              {request.message &&
                request.message !== "Imported from Excel file" && (
                  <div className="col-span-full text-gray-800 p-3 bg-gray-50 rounded border-l-4 border-orange-400">
                    <span className="font-semibold text-orange-700">Event Details:</span>{" "}
                    <span className="text-gray-900 font-medium">{request.message}</span>
                  </div>
                )}
            </div>
          </div>

          {/* TSP Contact Information */}
          {(() => {
            const hasPrimaryContact = (request as any).tspContact;
            const hasSecondaryContact = (request as any).tspContactAssigned;
            const hasCustomContact = (request as any).customTspContact;
            const hasAnyContact = hasPrimaryContact || hasSecondaryContact || hasCustomContact;
            
            if (!hasAnyContact) {
              return (
                <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 rounded-lg border border-teal-300 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <UserCheck className="w-5 h-5 mr-2 text-teal-600" />
                      <h4 className="font-bold text-teal-900">TSP Team Assignment</h4>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-teal-700 border-teal-300 hover:bg-teal-100"
                      onClick={() => startInlineEdit(request.id, 'tspContact', '')}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Assign TSP Contacts
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 rounded-lg border border-teal-300 shadow-sm">
                <h4 className="font-bold text-teal-900 mb-3 flex items-center">
                  <UserCheck className="w-5 h-5 mr-2 text-teal-600" />
                  TSP Team Assignment
                </h4>
                <div className="space-y-2 text-sm">
                  {/* Primary Contact - only show if has value */}
                  {hasPrimaryContact && (
                    <div className="bg-white/70 p-3 rounded-md border border-teal-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-teal-600 rounded-full"></div>
                          <span className="font-semibold text-teal-900">Primary Contact</span>
                        </div>
                        {!isEditing(request.id, 'tspContact') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-teal-600 hover:text-teal-800"
                            onClick={() => startInlineEdit(request.id, 'tspContact', (request as any).tspContact || '')}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-1">
                        {isEditing(request.id, 'tspContact') ? (
                          <div className="flex items-center space-x-2">
                            <select
                              value={editValues[`${request.id}-tspContact`] || ''}
                              onChange={(e) => setEditValues({ ...editValues, [`${request.id}-tspContact`]: e.target.value })}
                              className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-sm"
                            >
                              <option value="">Remove primary contact</option>
                              {users.filter((user: any) => user.role !== "recipient").map((user: any) => (
                                <option key={user.id} value={user.id}>
                                  {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                              onClick={() => saveInlineEdit(request.id, 'tspContact')}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                              onClick={() => cancelInlineEdit(request.id, 'tspContact')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="text-teal-800 font-medium">
                            {getUserDisplayName((request as any).tspContact)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Secondary Contact - only show if has value */}
                  {hasSecondaryContact && (
                    <div className="bg-white/70 p-3 rounded-md border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <span className="font-semibold text-blue-900">Secondary Contact</span>
                        </div>
                        {!isEditing(request.id, 'tspContactAssigned') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                            onClick={() => startInlineEdit(request.id, 'tspContactAssigned', (request as any).tspContactAssigned || '')}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-1">
                        {isEditing(request.id, 'tspContactAssigned') ? (
                          <div className="flex items-center space-x-2">
                            <select
                              value={editValues[`${request.id}-tspContactAssigned`] || ''}
                              onChange={(e) => setEditValues({ ...editValues, [`${request.id}-tspContactAssigned`]: e.target.value })}
                              className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-sm"
                            >
                              <option value="">Remove secondary contact</option>
                              {users.filter((user: any) => user.role !== "recipient").map((user: any) => (
                                <option key={user.id} value={user.id}>
                                  {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                              onClick={() => saveInlineEdit(request.id, 'tspContactAssigned')}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                              onClick={() => cancelInlineEdit(request.id, 'tspContactAssigned')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="text-blue-800 font-medium">
                            {getUserDisplayName((request as any).tspContactAssigned)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Custom TSP Contact - only show if has value */}
                  {hasCustomContact && (
                    <div className="bg-white/70 p-3 rounded-md border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                          <span className="font-semibold text-gray-900">Custom Contact</span>
                        </div>
                        {!isEditing(request.id, 'customTspContact') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800"
                            onClick={() => startInlineEdit(request.id, 'customTspContact', (request as any).customTspContact || '')}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-1">
                        {isEditing(request.id, 'customTspContact') ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              value={editValues[`${request.id}-customTspContact`] || ''}
                              onChange={(e) => setEditValues({ ...editValues, [`${request.id}-customTspContact`]: e.target.value })}
                              placeholder="External contact name or special instructions"
                              className="h-8 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                              onClick={() => saveInlineEdit(request.id, 'customTspContact')}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                              onClick={() => cancelInlineEdit(request.id, 'customTspContact')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="text-gray-800 font-medium">
                            {(request as any).customTspContact}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Add more contacts button - show when there are existing contacts */}
                  {hasAnyContact && (
                    <div className="flex justify-center pt-2">
                      <div className="flex space-x-2">
                        {!hasPrimaryContact && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-teal-600 border-teal-300 hover:bg-teal-50"
                            onClick={() => startInlineEdit(request.id, 'tspContact', '')}
                          >
                            + Primary
                          </Button>
                        )}
                        {!hasSecondaryContact && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={() => startInlineEdit(request.id, 'tspContactAssigned', '')}
                          >
                            + Secondary
                          </Button>
                        )}
                        {!hasCustomContact && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-gray-600 border-gray-300 hover:bg-gray-50"
                            onClick={() => startInlineEdit(request.id, 'customTspContact', '')}
                          >
                            + Custom
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Submission Information */}
          <div className="flex justify-between items-center pt-3 border-t text-xs text-gray-500">
            <div>
              {request.message === "Imported from Excel file"
                ? "Imported"
                : "Submitted"}
              :{" "}
              {(() => {
                try {
                  // Parse timestamp safely to preserve the original time
                  let date: Date;
                  if (
                    request.createdAt.match(
                      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
                    )
                  ) {
                    // Database timestamp format: "2025-08-27 06:26:14"
                    // Treat as-is without timezone conversion
                    const [datePart, timePart] = request.createdAt.split(" ");
                    date = new Date(datePart + "T" + timePart);
                  } else {
                    date = new Date(request.createdAt);
                  }
                  return isNaN(date.getTime())
                    ? "Invalid date"
                    : date.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                } catch (error) {
                  return "Invalid date";
                }
              })()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      organizationName: formData.get("organizationName"),
      department: formData.get("department"),
      desiredEventDate: formData.get("desiredEventDate")
        ? (() => {
            const dateStr = formData.get("desiredEventDate") as string;
            // Timezone-safe date parsing for form data
            return new Date(dateStr + "T12:00:00");
          })()
        : null,
      message: formData.get("message"),
      previouslyHosted: formData.get("previouslyHosted"),
      status: formData.get("status") || "new",
    };
    createMutation.mutate(data);
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      id: selectedRequest.id,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      organizationName: formData.get("organizationName"),
      department: formData.get("department"),
      desiredEventDate: formData.get("desiredEventDate")
        ? (() => {
            const dateStr = formData.get("desiredEventDate") as string;
            // Timezone-safe date parsing for form data
            return new Date(dateStr + "T12:00:00");
          })()
        : null,
      message: formData.get("message"),
      previouslyHosted: formData.get("previouslyHosted"),
      status: formData.get("status"),
      // Event planning fields
      eventStartTime: formData.get("eventStartTime") || null,
      eventEndTime: formData.get("eventEndTime") || null,
      pickupTime: formData.get("pickupTime") || null,
      sandwichTypes: formData.get("sandwichTypes") || null,
      // Driver and speaker requirements
      driversNeeded: formData.get("driversNeeded")
        ? parseInt(formData.get("driversNeeded") as string)
        : 0,
      speakersNeeded: formData.get("speakersNeeded")
        ? parseInt(formData.get("speakersNeeded") as string)
        : 0,
      volunteerNotes: formData.get("volunteerNotes") || null,
      additionalRequirements: formData.get("additionalRequirements") || null,
      // TSP Contact fields
      tspContact:
        formData.get("tspContact") === "none"
          ? null
          : formData.get("tspContact") || null,
      tspContactAssigned:
        formData.get("tspContactAssigned") === "none"
          ? null
          : formData.get("tspContactAssigned") || null,
      additionalContact1:
        formData.get("additionalContact1") === "none"
          ? null
          : formData.get("additionalContact1") || null,
      additionalContact2:
        formData.get("additionalContact2") === "none"
          ? null
          : formData.get("additionalContact2") || null,
      customTspContact: formData.get("customTspContact") || null,
    };
    editMutation.mutate(data);
  };

  const handleCompleteContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!completingRequest) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      id: completingRequest.id,
      communicationMethod: formData.get("communicationMethod") || null,
      eventAddress: formData.get("eventAddress") || null,
      estimatedSandwichCount: formData.get("estimatedSandwichCount")
        ? parseInt(formData.get("estimatedSandwichCount") as string)
        : null,
      hasRefrigeration:
        formData.get("hasRefrigeration") === "none"
          ? null
          : formData.get("hasRefrigeration") === "true",
      status: formData.get("status") || "contact_completed",
      toolkitStatus: formData.get("toolkitStatus") || null,
      eventStartTime: formData.get("eventStartTime") || null,
      eventEndTime: formData.get("eventEndTime") || null,
      pickupTime: formData.get("pickupTime") || null,
      tspContact: formData.get("tspContact") || null,
      customTspContact: formData.get("customTspContact") || null,
      sandwichTypes: formData.get("sandwichTypes") || null,
      driversNeeded: formData.get("driversNeeded")
        ? parseInt(formData.get("driversNeeded") as string)
        : 0,
      speakersNeeded: formData.get("speakersNeeded")
        ? parseInt(formData.get("speakersNeeded") as string)
        : 0,
      volunteerNotes: formData.get("volunteerNotes") || null,
      planningNotes: formData.get("planningNotes") || null,
    };

    completeContactMutation.mutate(data);
  };

  const handleCompleteEventDetails = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!detailsRequest) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      id: detailsRequest.id,
      toolkitStatus: formData.get("toolkitStatus"),
      eventStartTime: formData.get("eventStartTime") || null,
      eventEndTime: formData.get("eventEndTime") || null,
      pickupTime: formData.get("pickupTime") || null,
      tspContact: formData.get("tspContact") || null,
      customTspContact: formData.get("customTspContact") || null,
      planningNotes: formData.get("planningNotes") || null,
      eventAddress: formData.get("eventAddress") || null,
      estimatedSandwichCount: formData.get("estimatedSandwichCount")
        ? parseInt(formData.get("estimatedSandwichCount") as string)
        : null,
      sandwichTypes: formData.get("sandwichTypes") || null,
      
      // Transportation workflow fields
      deliveryDestination: formData.get("deliveryDestination") || null,
      storageLocation: formData.get("storageLocation") || null,
      finalDeliveryMethod: formData.get("finalDeliveryMethod") || null,
      
      driversNeeded: formData.get("driversNeeded")
        ? parseInt(formData.get("driversNeeded") as string)
        : 0,
      speakersNeeded: formData.get("speakersNeeded")
        ? parseInt(formData.get("speakersNeeded") as string)
        : 0,
      volunteerNotes: formData.get("volunteerNotes") || null,
      
      // Driver and speaker assignments from component state
      assignedDriverIds: (detailsRequest as any).assignedDriverIds || [],
      assignedSpeakerIds: (detailsRequest as any).assignedSpeakerIds || [],
    };

    completeEventDetailsMutation.mutate(data);
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
                  ? "Syncing..."
                  : "Sync to Sheets"}
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
                  ? "Syncing..."
                  : "Sync from Sheets"}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importExcelMutation.mutate()}
              disabled={importExcelMutation.isPending}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline sm:ml-2">
                {importExcelMutation.isPending
                  ? "Importing..."
                  : "Import Excel"}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importHistoricalMutation.mutate()}
              disabled={importHistoricalMutation.isPending}
              title="Import historical 2024 events"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline sm:ml-2">
                {importHistoricalMutation.isPending
                  ? "Importing..."
                  : "Import 2024 Data"}
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
                  <Label htmlFor="organizationName">
                    Organization Name
                  </Label>
                  <Input name="organizationName" required />
                </div>
                <div>
                  <Label htmlFor="department">Department (Optional)</Label>
                  <Input name="department" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="desiredEventDate">
                    Desired Event Date
                  </Label>
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
                    ? "Creating..."
                    : "Create Event Request"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto p-1 grid grid-cols-6 gap-1">
            <TabsTrigger
              value="requests"
              className="relative flex-1 px-2 py-2 text-center"
            >
              New Requests
              <Badge variant="secondary" className="ml-2">
                {requestsEvents.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="in_process"
              className="relative flex-1 px-2 py-2 text-center"
            >
              In Process
              <Badge variant="secondary" className="ml-2">
                {inProcessEvents.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="scheduled"
              className="relative flex-1 px-2 py-2 text-center"
            >
              Scheduled
              <Badge variant="secondary" className="ml-2">
                {scheduledEvents.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="relative flex-1 px-2 py-2 text-center"
            >
              Past Events
              <Badge variant="secondary" className="ml-2">
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
                      ? "Search across all events..."
                      : "Search within current tab..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="globalSearch"
                    checked={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.checked)}
                    className="rounded border-gray-300 focus:ring-teal-500"
                  />
                  <label
                    htmlFor="globalSearch"
                    className="text-sm text-gray-600 cursor-pointer"
                  >
                    Search across all events (not just current tab)
                  </label>
                </div>

                {/* Status Filter */}
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="statusFilter"
                    className="text-sm text-gray-600"
                  >
                    Filter:
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
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

            {/* Tab Content */}
            <TabsContent value="requests" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm
                    ? `Showing ${filteredRequests.length} event${filteredRequests.length !== 1 ? "s" : ""} from global search`
                    : `Showing ${filteredRequests.length} new event request${filteredRequests.length !== 1 ? "s" : ""} needing contact`}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRequestsSortBy(
                        requestsSortBy === "date" ? "organization" : "date",
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {requestsSortBy === "date" ? (
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
                        requestsSortOrder === "desc" ? "asc" : "desc",
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {requestsSortOrder === "desc" ? (
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
                    renderStandardEventCard(request),
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="followed_up" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm
                    ? `Showing ${filteredRequests.length} event${filteredRequests.length !== 1 ? "s" : ""} from global search`
                    : `Showing ${filteredRequests.length} followed up event${filteredRequests.length !== 1 ? "s" : ""}`}
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
                    renderStandardEventCard(request),
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="in_process" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm
                    ? `Showing ${filteredRequests.length} event${filteredRequests.length !== 1 ? "s" : ""} from global search`
                    : `Showing ${filteredRequests.length} in process event${filteredRequests.length !== 1 ? "s" : ""}`}
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
                    renderScheduledEventCard(request),
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm
                    ? `Showing ${filteredRequests.length} event${filteredRequests.length !== 1 ? "s" : ""} from global search`
                    : `Showing ${filteredRequests.length} scheduled event${filteredRequests.length !== 1 ? "s" : ""}`}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setScheduledSortBy(
                        scheduledSortBy === "date" ? "organization" : "date",
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {scheduledSortBy === "date" ? (
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
                        scheduledSortOrder === "desc" ? "asc" : "desc",
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {scheduledSortOrder === "desc" ? (
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
                    renderScheduledEventCard(request),
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {globalSearch && searchTerm ? (
                    `Showing ${filteredRequests.length} event${filteredRequests.length !== 1 ? "s" : ""} from global search`
                  ) : pastEventsPagination.totalItems > 0 ? (
                    <>
                      Showing {pastEventsPagination.startItem}-
                      {pastEventsPagination.endItem} of{" "}
                      {pastEventsPagination.totalItems} past event
                      {pastEventsPagination.totalItems !== 1 ? "s" : ""}
                    </>
                  ) : (
                    "No past events found"
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPastSortBy(
                        pastSortBy === "date" ? "organization" : "date",
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {pastSortBy === "date" ? (
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
                        pastEventsSortOrder === "desc" ? "asc" : "desc",
                      )
                    }
                    className="flex items-center gap-2"
                  >
                    {pastEventsSortOrder === "desc" ? (
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
                      renderPastEventCard(request),
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
                                  (_, i) => i + 1,
                                ).map((pageNum) => (
                                  <Button
                                    key={pageNum}
                                    variant={
                                      pageNum === currentPage
                                        ? "default"
                                        : "outline"
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
                                            ? "default"
                                            : "outline"
                                        }
                                        size="sm"
                                        onClick={() => setPastEventsPage(i)}
                                        className="w-8 h-8 p-0 text-xs"
                                      >
                                        {i}
                                      </Button>,
                                    );
                                  }
                                  if (showEllipsis && totalPages > maxVisible) {
                                    pages.push(
                                      <span
                                        key="ellipsis1"
                                        className="text-gray-400 text-xs"
                                      >
                                        ...
                                      </span>,
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
                                      </Button>,
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
                                    </Button>,
                                  );
                                  if (showEllipsis) {
                                    pages.push(
                                      <span
                                        key="ellipsis2"
                                        className="text-gray-400 text-xs"
                                      >
                                        ...
                                      </span>,
                                    );
                                  }
                                  for (
                                    let i = Math.max(
                                      totalPages - maxVisible + 2,
                                      2,
                                    );
                                    i <= totalPages;
                                    i++
                                  ) {
                                    pages.push(
                                      <Button
                                        key={i}
                                        variant={
                                          i === currentPage
                                            ? "default"
                                            : "outline"
                                        }
                                        size="sm"
                                        onClick={() => setPastEventsPage(i)}
                                        className="w-8 h-8 p-0 text-xs"
                                      >
                                        {i}
                                      </Button>,
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
                                    </Button>,
                                  );
                                  if (currentPage > 3) {
                                    pages.push(
                                      <span
                                        key="ellipsis3"
                                        className="text-gray-400 text-xs"
                                      >
                                        ...
                                      </span>,
                                    );
                                  }

                                  const start = Math.max(2, currentPage - 1);
                                  const end = Math.min(
                                    totalPages - 1,
                                    currentPage + 1,
                                  );
                                  for (let i = start; i <= end; i++) {
                                    pages.push(
                                      <Button
                                        key={i}
                                        variant={
                                          i === currentPage
                                            ? "default"
                                            : "outline"
                                        }
                                        size="sm"
                                        onClick={() => setPastEventsPage(i)}
                                        className="w-8 h-8 p-0 text-xs"
                                      >
                                        {i}
                                      </Button>,
                                    );
                                  }

                                  if (currentPage < totalPages - 2) {
                                    pages.push(
                                      <span
                                        key="ellipsis4"
                                        className="text-gray-400 text-xs"
                                      >
                                        ...
                                      </span>,
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
                                    </Button>,
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
                                pastEventsPage + 1,
                              ),
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
                              : "No date specified"}
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
                              : "No date specified"}
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
                              : "No date specified"}
                          </div>
                          <div className="text-xs text-blue-700 mt-1">
                            Status: {request.status || "No status"}
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
                      defaultValue={selectedRequest.email}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      name="phone"
                      type="tel"
                      defaultValue={selectedRequest.phone || ""}
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
                      defaultValue={selectedRequest.department || ""}
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
                          ? selectedRequest.desiredEventDate.split("T")[0]
                          : ""
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
                    defaultValue={(selectedRequest as any).eventAddress || ""}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estimatedSandwichCount">
                      Number of Sandwiches to be Made
                    </Label>
                    <Input
                      name="estimatedSandwichCount"
                      type="number"
                      defaultValue={
                        selectedRequest.estimatedSandwichCount || ""
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="hasRefrigeration">
                      Refrigeration Available?
                    </Label>
                    <select
                      name="hasRefrigeration"
                      defaultValue={
                        selectedRequest.hasRefrigeration?.toString() || ""
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
                        (selectedRequest as any).eventStartTime || ""
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventEndTime">Event End Time</Label>
                    <Input
                      name="eventEndTime"
                      type="time"
                      defaultValue={(selectedRequest as any).eventEndTime || ""}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pickupTime">Pickup Time</Label>
                    <Input
                      name="pickupTime"
                      type="time"
                      defaultValue={(selectedRequest as any).pickupTime || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sandwichTypes">Sandwich Types</Label>
                    <Input
                      name="sandwichTypes"
                      defaultValue={
                        (selectedRequest as any).sandwichTypes || ""
                      }
                    />
                  </div>
                </div>
                {/* Sandwich Destination */}
                <div>
                  <Label htmlFor="deliveryDestination">Sandwich Destination</Label>
                  <Input
                    name="deliveryDestination"
                    defaultValue={(selectedRequest as any).deliveryDestination || ""}
                    placeholder="Final delivery location (organization, address, etc.)"
                  />
                </div>

                {/* Transportation Workflow */}
                <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800">🚛 Transportation Plan</h3>
                  <p className="text-sm text-gray-600">Many events involve temporary storage at a host location before final delivery</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="storageLocation">Overnight Storage Location (Optional)</Label>
                      <Input
                        name="storageLocation"
                        defaultValue={(selectedRequest as any).storageLocation || ""}
                        placeholder="Host location for overnight storage"
                      />
                    </div>
                    <div>
                      <Label htmlFor="finalDeliveryMethod">Final Delivery Method</Label>
                      <select
                        name="finalDeliveryMethod"
                        defaultValue={(selectedRequest as any).finalDeliveryMethod || ""}
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select delivery method</option>
                        <option value="direct_delivery">Direct from event to recipient</option>
                        <option value="pickup_by_recipient">Pickup by recipient from storage</option>
                        <option value="driver_delivery">Driver delivery from storage</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Drivers Section */}
                <div className="space-y-4 border rounded-lg p-4 bg-blue-50">
                  <h3 className="text-lg font-semibold text-blue-800">🚗 Drivers</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="driversNeeded">How Many Drivers Needed?</Label>
                      <Input
                        name="driversNeeded"
                        type="number"
                        min="0"
                        defaultValue={(selectedRequest as any).driversNeeded || 0}
                        placeholder="Number of drivers needed"
                      />
                    </div>
                    <div>
                      <Label>Assigned Drivers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentDrivers = (selectedRequest as any).assignedDriverIds || [];
                              const updatedDrivers = [...currentDrivers, e.target.value];
                              // Update the selectedRequest temporarily for display
                              (selectedRequest as any).assignedDriverIds = updatedDrivers;
                              e.target.value = "";
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map(user => (
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
                            if (e.key === "Enter" && e.target.value.trim()) {
                              const currentDrivers = (selectedRequest as any).assignedDriverIds || [];
                              const updatedDrivers = [...currentDrivers, e.target.value.trim()];
                              (selectedRequest as any).assignedDriverIds = updatedDrivers;
                              e.target.value = "";
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-1">
                          {((selectedRequest as any).assignedDriverIds || []).map((driverId: string, index: number) => (
                            <span key={index} className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              {getUserDisplayName(driverId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedDrivers = (selectedRequest as any).assignedDriverIds?.filter((_: any, i: number) => i !== index) || [];
                                  (selectedRequest as any).assignedDriverIds = updatedDrivers;
                                }}
                                className="ml-1 text-blue-600 hover:text-blue-800"
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
                  <h3 className="text-lg font-semibold text-green-800">🎤 Speakers</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="speakersNeeded">How Many Speakers Needed?</Label>
                      <Input
                        name="speakersNeeded"
                        type="number"
                        min="0"
                        defaultValue={(selectedRequest as any).speakersNeeded || 0}
                        placeholder="Number of speakers needed"
                      />
                    </div>
                    <div>
                      <Label>Assigned Speakers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentSpeakers = (selectedRequest as any).assignedSpeakerIds || [];
                              const updatedSpeakers = [...currentSpeakers, e.target.value];
                              (selectedRequest as any).assignedSpeakerIds = updatedSpeakers;
                              e.target.value = "";
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map(user => (
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
                            if (e.key === "Enter" && e.target.value.trim()) {
                              const currentSpeakers = (selectedRequest as any).assignedSpeakerIds || [];
                              const updatedSpeakers = [...currentSpeakers, e.target.value.trim()];
                              (selectedRequest as any).assignedSpeakerIds = updatedSpeakers;
                              e.target.value = "";
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-1">
                          {((selectedRequest as any).assignedSpeakerIds || []).map((speakerId: string, index: number) => (
                            <span key={index} className="inline-flex items-center bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                              {getUserDisplayName(speakerId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedSpeakers = (selectedRequest as any).assignedSpeakerIds?.filter((_: any, i: number) => i !== index) || [];
                                  (selectedRequest as any).assignedSpeakerIds = updatedSpeakers;
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
                <div>
                  <Label htmlFor="additionalRequirements">
                    Special Requirements
                  </Label>
                  <Textarea
                    name="additionalRequirements"
                    rows={2}
                    defaultValue={
                      (selectedRequest as any).additionalRequirements || ""
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
                          (selectedRequest as any).tspContact || "none"
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="none">No primary contact</option>
                        {users
                          .filter((user: any) => user.role !== "recipient")
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
                          (selectedRequest as any).tspContactAssigned || "none"
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="none">No secondary contact</option>
                        {users
                          .filter((user: any) => user.role !== "recipient")
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
                            "none"
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="none">No third contact</option>
                          {users
                            .filter((user: any) => user.role !== "recipient")
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
                            "none"
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="none">No fourth contact</option>
                          {users
                            .filter((user: any) => user.role !== "recipient")
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
                        (selectedRequest as any).customTspContact || ""
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="message">Event Details</Label>
                  <Textarea
                    name="message"
                    rows={3}
                    defaultValue={selectedRequest.message || ""}
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
                      ? "Updating..."
                      : "Update Event Request"}
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
                      placeholder="How many sandwiches to be made?"
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
                    <Input
                      name="sandwichTypes"
                      placeholder="Any specific sandwich preferences?"
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
                      ? "Saving..."
                      : "Complete Contact & Event Details"}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="toolkitStatus">Toolkit Status</Label>
                    <select
                      name="toolkitStatus"
                      defaultValue={detailsRequest.toolkitStatus || ""}
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
                    <Label htmlFor="tspContact">TSP Team Contact</Label>
                    <select
                      name="tspContact"
                      defaultValue={detailsRequest.tspContact || ""}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="eventStartTime">Event Start Time</Label>
                    <Input
                      name="eventStartTime"
                      type="time"
                      defaultValue={detailsRequest.eventStartTime || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventEndTime">Event End Time</Label>
                    <Input
                      name="eventEndTime"
                      type="time"
                      defaultValue={detailsRequest.eventEndTime || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pickupTime">Pickup Time</Label>
                    <Input
                      name="pickupTime"
                      type="time"
                      defaultValue={detailsRequest.pickupTime || ""}
                    />
                  </div>
                </div>

                {/* Event Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="eventAddress">Event Address</Label>
                    <Input
                      name="eventAddress"
                      defaultValue={detailsRequest.eventAddress || ""}
                      placeholder="Where will the event take place?"
                    />
                  </div>
                  <div>
                    <Label htmlFor="estimatedSandwichCount">
                      Estimated # of Sandwiches to be Made
                    </Label>
                    <Input
                      name="estimatedSandwichCount"
                      type="number"
                      min="1"
                      defaultValue={detailsRequest.estimatedSandwichCount || ""}
                      placeholder="How many sandwiches to be made?"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="estimatedSandwichCount">
                      How Many Sandwiches to be Made?
                    </Label>
                    <Input
                      name="estimatedSandwichCount"
                      type="number"
                      min="0"
                      value={detailsRequest?.estimatedSandwichCount || ''}
                      onChange={(e) => setDetailsRequest(prev => ({
                        ...prev,
                        estimatedSandwichCount: parseInt(e.target.value) || 0
                      }))}
                      placeholder="How many sandwiches to be made?"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sandwichType">
                      Sandwich Type (optional)
                    </Label>
                    <select
                      value={detailsRequest?.sandwichType || 'Unknown'}
                      onChange={(e) => setDetailsRequest(prev => ({
                        ...prev,
                        sandwichType: e.target.value
                      }))}
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

                {/* Sandwich Destination */}
                <div>
                  <Label htmlFor="deliveryDestination">Sandwich Destination</Label>
                  <Input
                    name="deliveryDestination"
                    value={(detailsRequest as any).deliveryDestination || ""}
                    onChange={(e) => setDetailsRequest(prev => ({
                      ...prev,
                      deliveryDestination: e.target.value
                    }))}
                    placeholder="Final delivery location (organization, address, etc.)"
                  />
                </div>

                {/* Transportation Workflow */}
                <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800">🚛 Transportation Plan</h3>
                  
                  {/* Step 1: Overnight Storage Required? */}
                  <div>
                    <Label className="text-base font-medium">Does this event need overnight storage?</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="no-storage-details"
                          name="overnightStorageRequired"
                          value="false"
                          checked={(detailsRequest as any).overnightStorageRequired === false}
                          onChange={(e) => setDetailsRequest(prev => ({
                            ...prev,
                            overnightStorageRequired: e.target.value === "true"
                          }))}
                          className="mr-2"
                        />
                        <label htmlFor="no-storage-details">No - Direct delivery same day</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="yes-storage-details"
                          name="overnightStorageRequired"
                          value="true"
                          checked={(detailsRequest as any).overnightStorageRequired === true}
                          onChange={(e) => setDetailsRequest(prev => ({
                            ...prev,
                            overnightStorageRequired: e.target.value === "true"
                          }))}
                          className="mr-2"
                        />
                        <label htmlFor="yes-storage-details">Yes - Two-step process with overnight storage</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="pickup-details"
                          name="overnightStorageRequired"
                          value="pickup"
                          checked={(detailsRequest as any).finalDeliveryMethod === "pickup_by_recipient"}
                          onChange={(e) => setDetailsRequest(prev => ({
                            ...prev,
                            finalDeliveryMethod: "pickup_by_recipient",
                            overnightStorageRequired: false
                          }))}
                          className="mr-2"
                        />
                        <label htmlFor="pickup-details">Organization will pick up sandwiches</label>
                      </div>
                    </div>
                  </div>

                  {/* Show different fields based on selection */}
                  {(detailsRequest as any).overnightStorageRequired === false && (detailsRequest as any).finalDeliveryMethod !== "pickup_by_recipient" && (
                    <div>
                      <Label htmlFor="transportDriver1">Driver for Direct Delivery</Label>
                      <Input
                        name="transportDriver1"
                        value={(detailsRequest as any).transportDriver1 || ""}
                        onChange={(e) => setDetailsRequest(prev => ({
                          ...prev,
                          transportDriver1: e.target.value
                        }))}
                        placeholder="Driver name or assignment"
                      />
                    </div>
                  )}

                  {(detailsRequest as any).overnightStorageRequired === true && (
                    <>
                      <div>
                        <Label htmlFor="storageLocation">Overnight Storage Location</Label>
                        <Input
                          name="storageLocation"
                          value={(detailsRequest as any).storageLocation || ""}
                          onChange={(e) => setDetailsRequest(prev => ({
                            ...prev,
                            storageLocation: e.target.value
                          }))}
                          placeholder="Host location for overnight storage"
                        />
                      </div>
                      <div>
                        <Label htmlFor="transportDriver1">Driver for Day 1 (Event → Storage)</Label>
                        <Input
                          name="transportDriver1"
                          value={(detailsRequest as any).transportDriver1 || ""}
                          onChange={(e) => setDetailsRequest(prev => ({
                            ...prev,
                            transportDriver1: e.target.value
                          }))}
                          placeholder="Driver name for event pickup"
                        />
                      </div>
                      <div>
                        <Label htmlFor="transportDriver2">Driver for Day 2 (Storage → Recipient)</Label>
                        <Input
                          name="transportDriver2"
                          value={(detailsRequest as any).transportDriver2 || ""}
                          onChange={(e) => setDetailsRequest(prev => ({
                            ...prev,
                            transportDriver2: e.target.value
                          }))}
                          placeholder="Driver name for final delivery"
                        />
                      </div>
                      <div>
                        <Label htmlFor="finalRecipientOrg">Final Recipient Organization</Label>
                        <Input
                          name="finalRecipientOrg"
                          value={(detailsRequest as any).finalRecipientOrg || ""}
                          onChange={(e) => setDetailsRequest(prev => ({
                            ...prev,
                            finalRecipientOrg: e.target.value
                          }))}
                          placeholder="Organization receiving sandwiches on day 2"
                        />
                      </div>
                    </>
                  )}

                  {(detailsRequest as any).finalDeliveryMethod === "pickup_by_recipient" && (
                    <div>
                      <Label htmlFor="pickupOrganization">Organization Picking Up</Label>
                      <Input
                        name="pickupOrganization"
                        value={(detailsRequest as any).pickupOrganization || ""}
                        onChange={(e) => setDetailsRequest(prev => ({
                          ...prev,
                          pickupOrganization: e.target.value
                        }))}
                        placeholder="Name of organization that will pick up sandwiches"
                      />
                    </div>
                  )}
                </div>

                {/* Drivers Section */}
                <div className="space-y-3 border rounded-lg p-3 bg-blue-50">
                  <h3 className="text-base font-semibold text-blue-800">🚗 Drivers</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="driversNeeded">How Many Drivers Needed?</Label>
                      <Input
                        name="driversNeeded"
                        type="number"
                        min="0"
                        defaultValue={(detailsRequest as any).driversNeeded || 0}
                        placeholder="Number of drivers needed"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label>Assigned Drivers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentDrivers = (detailsRequest as any).assignedDriverIds || [];
                              const updatedDrivers = [...currentDrivers, e.target.value];
                              setDetailsRequest(prev => ({
                                ...prev,
                                assignedDriverIds: updatedDrivers
                              }));
                              e.target.value = "";
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1 h-8 bg-white"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map(user => (
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
                              if (e.key === "Enter" && e.target.value.trim()) {
                                e.preventDefault();
                                const currentDrivers = (detailsRequest as any).assignedDriverIds || [];
                                const updatedDrivers = [...currentDrivers, e.target.value.trim()];
                                setDetailsRequest(prev => ({
                                  ...prev,
                                  assignedDriverIds: updatedDrivers
                                }));
                                e.target.value = "";
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="bg-green-500 hover:bg-green-600 text-white px-2 rounded-r text-sm h-8"
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                              if (input.value.trim()) {
                                const currentDrivers = (detailsRequest as any).assignedDriverIds || [];
                                const updatedDrivers = [...currentDrivers, input.value.trim()];
                                setDetailsRequest(prev => ({
                                  ...prev,
                                  assignedDriverIds: updatedDrivers
                                }));
                                input.value = "";
                              }
                            }}
                          >
                            ✓
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {((detailsRequest as any).assignedDriverIds || []).map((driverId: string, index: number) => (
                            <span key={index} className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              {getUserDisplayName(driverId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedDrivers = (detailsRequest as any).assignedDriverIds?.filter((_: any, i: number) => i !== index) || [];
                                  setDetailsRequest(prev => ({
                                    ...prev,
                                    assignedDriverIds: updatedDrivers
                                  }));
                                }}
                                className="ml-1 text-blue-600 hover:text-blue-800"
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
                  <h3 className="text-base font-semibold text-green-800">🎤 Speakers</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="speakersNeeded">How Many Speakers Needed?</Label>
                      <Input
                        name="speakersNeeded"
                        type="number"
                        min="0"
                        defaultValue={(detailsRequest as any).speakersNeeded || 0}
                        placeholder="Number of speakers needed"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label>Assigned Speakers</Label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentSpeakers = (detailsRequest as any).assignedSpeakerIds || [];
                              const updatedSpeakers = [...currentSpeakers, e.target.value];
                              setDetailsRequest(prev => ({
                                ...prev,
                                assignedSpeakerIds: updatedSpeakers
                              }));
                              e.target.value = "";
                            }
                          }}
                          className="w-full text-sm border rounded px-2 py-1 h-8 bg-white"
                        >
                          <option value="">Add team member...</option>
                          {availableUsers?.map(user => (
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
                              if (e.key === "Enter" && e.target.value.trim()) {
                                e.preventDefault();
                                const currentSpeakers = (detailsRequest as any).assignedSpeakerIds || [];
                                const updatedSpeakers = [...currentSpeakers, e.target.value.trim()];
                                setDetailsRequest(prev => ({
                                  ...prev,
                                  assignedSpeakerIds: updatedSpeakers
                                }));
                                e.target.value = "";
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="bg-green-500 hover:bg-green-600 text-white px-2 rounded-r text-sm h-8"
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                              if (input.value.trim()) {
                                const currentSpeakers = (detailsRequest as any).assignedSpeakerIds || [];
                                const updatedSpeakers = [...currentSpeakers, input.value.trim()];
                                setDetailsRequest(prev => ({
                                  ...prev,
                                  assignedSpeakerIds: updatedSpeakers
                                }));
                                input.value = "";
                              }
                            }}
                          >
                            ✓
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {((detailsRequest as any).assignedSpeakerIds || []).map((speakerId: string, index: number) => (
                            <span key={index} className="inline-flex items-center bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                              {getUserDisplayName(speakerId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedSpeakers = (detailsRequest as any).assignedSpeakerIds?.filter((_: any, i: number) => i !== index) || [];
                                  setDetailsRequest(prev => ({
                                    ...prev,
                                    assignedSpeakerIds: updatedSpeakers
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
                      ? "Saving..."
                      : "Save Event Details"}
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
                  Assign team members and add custom contact information for{" "}
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
                            ? "Primary:"
                            : index === 1
                              ? "Secondary:"
                              : index === 2
                                ? "Third:"
                                : "Fourth:"}
                        </span>
                        <select
                          value={selectedTspContacts[index] || ""}
                          onChange={(e) => {
                            const newContacts = [...selectedTspContacts];
                            if (e.target.value === "") {
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
                                (_, i) => i !== index,
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
                        setCustomTspContacts([...customTspContacts, ""])
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
                    setCustomTspContacts([""]);
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
                    ? "Assigning..."
                    : "Assign Contacts"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}


        {/* Speaker Assignment Dialog */}
        {showSpeakerDialog && assigningSpeakerRequest && (
          <Dialog
            open={showSpeakerDialog}
            onOpenChange={setShowSpeakerDialog}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Assign Speakers</DialogTitle>
                <p className="text-sm text-gray-600">
                  Assign speakers for{" "}
                  {assigningSpeakerRequest.organizationName}
                </p>
              </DialogHeader>

              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">
                    Available Team Members
                  </Label>
                  <p className="text-sm text-gray-600 mb-3">
                    Speakers needed: {(assigningSpeakerRequest as any).speakersNeeded || 0}
                  </p>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {availableUsers?.map((user: any) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          id={`speaker-${user.id}`}
                          checked={selectedSpeakers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSpeakers([...selectedSpeakers, user.id]);
                            } else {
                              setSelectedSpeakers(
                                selectedSpeakers.filter((id) => id !== user.id)
                              );
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <label
                          htmlFor={`speaker-${user.id}`}
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
                    ? "Assigning..."
                    : "Assign Speakers"}
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
                  <CheckCircle className="h-5 w-5 text-[#FBAD3F]" />
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
                        method: "email",
                      });
                    }}
                    disabled={followUpMutation.isPending}
                    className="bg-[#236383] hover:bg-[#1a4d63] text-white border-[#236383]"
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
                    className="bg-[#007E8C] hover:bg-[#006b76] text-white border-[#007E8C]"
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
                  const updatedEmail = formData.get("updatedEmail") as string;
                  const notes = formData.get("notes") as string;

                  followUpMutation.mutate({
                    id: followUpRequest.id,
                    method: "call",
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
                    className="bg-[#FBAD3F] hover:bg-[#e69d36] text-white"
                  >
                    {followUpMutation.isPending
                      ? "Recording..."
                      : "Record & Send Toolkit"}
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
                  <Phone className="h-5 w-5 text-[#236383]" />
                  <span>Call Completed - Enter Event Details</span>
                </DialogTitle>
                <DialogDescription>
                  Fill out the complete event details for{" "}
                  {callCompletedRequest.organizationName}
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);

                  const eventDetails = {
                    desiredEventDate: formData.get(
                      "desiredEventDate",
                    ) as string,
                    estimatedAttendeeCount: parseInt(
                      formData.get("estimatedAttendeeCount") as string,
                      10,
                    ),
                    estimatedSandwichCount: parseInt(
                      formData.get("estimatedSandwichCount") as string,
                      10,
                    ),
                    driversNeeded: parseInt(
                      formData.get("driversNeeded") as string,
                      10,
                    ),
                    speakersNeeded: parseInt(
                      formData.get("speakersNeeded") as string,
                      10,
                    ),
                    hasRefrigeration:
                      formData.get("hasRefrigeration") === "true",
                    address: formData.get("address") as string,
                    message: formData.get("message") as string,
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
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="estimatedSandwichCount">
                      Sandwiches to be Made
                    </Label>
                    <Input
                      name="estimatedSandwichCount"
                      type="number"
                      min="1"
                      placeholder="50"
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
                    className="bg-[#236383] hover:bg-[#1d4f6a] text-white"
                  >
                    {callCompletedMutation.isPending
                      ? "Saving..."
                      : "Schedule Event"}
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
                  Manage unresponsive contact status for{" "}
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
        <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                <span>Delete Event Request</span>
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this event request? This action cannot be undone.
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
                {deleteMutation.isPending ? "Deleting..." : "Delete Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Driver Assignment Modal */}
        <Dialog open={editingDriversFor !== null} onOpenChange={(open) => {
          if (!open) {
            setEditingDriversFor(null);
            setTempDriverInput("");
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Drivers</DialogTitle>
              <DialogDescription>
                Add or remove drivers for this event
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Current Drivers */}
              {editingDriversFor && eventRequests?.find(r => r.id === editingDriversFor)?.assignedDriverIds?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Current Drivers:</span>
                  <div className="space-y-2">
                    {(eventRequests.find(r => r.id === editingDriversFor) as any)?.assignedDriverIds?.map((driverId: string, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-blue-50 text-blue-700 px-3 py-2 rounded border border-blue-200">
                        <span>{getUserDisplayName(driverId)}</span>
                        <button
                          className="ml-2 hover:bg-blue-200 rounded-full w-6 h-6 flex items-center justify-center"
                          onClick={() => {
                            const currentRequest = eventRequests.find(r => r.id === editingDriversFor);
                            const updatedDrivers = (currentRequest as any)?.assignedDriverIds?.filter((id: string, i: number) => i !== index) || [];
                            handleAssignmentUpdate(editingDriversFor, 'assignedDriverIds', updatedDrivers);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Driver */}
              <div className="space-y-3">
                <span className="text-sm font-medium">Add Driver:</span>
                
                {/* Select from existing users */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Select from registered users:</label>
                  <select
                    value=""
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        const currentRequest = eventRequests?.find(r => r.id === editingDriversFor);
                        const currentDrivers = (currentRequest as any)?.assignedDriverIds || [];
                        if (!currentDrivers.includes(value)) {
                          const updatedDrivers = [...currentDrivers, value];
                          handleAssignmentUpdate(editingDriversFor, 'assignedDriverIds', updatedDrivers);
                        }
                      }
                    }}
                    className="w-full text-sm border rounded px-3 py-2"
                  >
                    <option value="">Choose a user...</option>
                    {availableUsers?.filter(user => {
                      const currentRequest = eventRequests?.find(r => r.id === editingDriversFor);
                      const currentDrivers = (currentRequest as any)?.assignedDriverIds || [];
                      return !currentDrivers.includes(user.id);
                    }).map(user => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Or add custom driver */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Or add custom driver name:</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Enter driver name..."
                      value={tempDriverInput}
                      onChange={(e) => setTempDriverInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tempDriverInput.trim()) {
                          const currentRequest = eventRequests?.find(r => r.id === editingDriversFor);
                          const currentDrivers = (currentRequest as any)?.assignedDriverIds || [];
                          const updatedDrivers = [...currentDrivers, tempDriverInput.trim()];
                          handleAssignmentUpdate(editingDriversFor, 'assignedDriverIds', updatedDrivers);
                          setTempDriverInput("");
                        }
                      }}
                      className="flex-1 text-sm border rounded px-3 py-2"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (tempDriverInput.trim()) {
                          const currentRequest = eventRequests?.find(r => r.id === editingDriversFor);
                          const currentDrivers = (currentRequest as any)?.assignedDriverIds || [];
                          const updatedDrivers = [...currentDrivers, tempDriverInput.trim()];
                          handleAssignmentUpdate(editingDriversFor, 'assignedDriverIds', updatedDrivers);
                          setTempDriverInput("");
                        }
                      }}
                      disabled={!tempDriverInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingDriversFor(null);
                  setTempDriverInput("");
                }}
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
