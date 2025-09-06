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
  MapPin,
  Home,
  ArrowRight,
  Moon,
  UserPlus,
  MessageCircle,
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
            ? "text-white border-2 font-bold shadow-lg"
            : statusColors[status as keyof typeof statusColors]
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

  // New UX-optimized scheduled event card following specification
  const renderScheduledEventCard = (request: EventRequest) => {
    const driverIds = (request as any).assignedDriverIds || [];
    const speakerIds = (request as any).assignedSpeakerIds || [];
    
    // Helper functions for status chips
    const getDriverChip = () => {
      if (driverIds.length > 0) {
        const driverName = driverIds.map((id: string) => getUserDisplayName(id)).join(", ");
        return {
          text: `Driver: Assigned – ${driverName}`,
          className: "bg-green-100 text-green-800 border-green-200"
        };
      }
      return {
        text: "Driver: Needed",
        className: "bg-red-100 text-red-800 border-red-200"
      };
    };
    
    const getSpeakerChip = () => {
      if (speakerIds.length > 0) {
        const speakerName = speakerIds.map((id: string) => getUserDisplayName(id)).join(", ");
        return {
          text: `Speaker: Assigned – ${speakerName}`,
          className: "bg-green-100 text-green-800 border-green-200"
        };
      }
      return {
        text: "Speaker: Needed",
        className: "bg-amber-100 text-amber-800 border-amber-200"
      };
    };
    
    const getVanStatus = () => {
      const needsVan = (request as any).vanRequired || false;
      return needsVan ? "Van? Yes" : "Van? No";
    };
    
    // Check if header should be amber-tinted (any "Needed" status)
    const hasNeededItems = driverIds.length === 0 || speakerIds.length === 0;
    
    const getPathType = () => {
      const storageLocation = (request as any).storageLocation;
      const deliveryMethod = (request as any).finalDeliveryMethod;
      
      if (storageLocation || deliveryMethod === 'pickup_by_recipient' || deliveryMethod === 'driver_delivery') {
        return 'overnight';
      }
      return 'same_day';
    };
    
    const pathType = getPathType();

    return (
      <Card
        key={request.id}
        className={`transition-all duration-300 border rounded-lg shadow-sm hover:shadow-lg ${
          hasNeededItems ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
        } ${
          highlightedEventId === request.id ? "ring-4 ring-yellow-400" : ""
        }`}
      >
        {/* Header (always visible) - Organization Name + Chips */}
        <CardHeader className="pb-3">
          {/* Organization Name - large, bold */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {request.organizationName}
          </h2>
          
          {/* Chips Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date & pickup time chip */}
            {request.desiredEventDate && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                <Calendar className="w-4 h-4 mr-1" />
                {(() => {
                  const dateInfo = formatEventDate(request.desiredEventDate);
                  const pickupTime = (request as any).pickupTime ? ` • ${formatTime((request as any).pickupTime)}` : '';
                  return `${dateInfo.text}${pickupTime}`;
                })()}
              </span>
            )}
            
            {/* Sandwich count chip */}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
              {request.estimatedSandwichCount || 'TBD'} sandwiches
            </span>
            
            {/* Driver status chip */}
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border cursor-pointer hover:opacity-80 ${getDriverChip().className}`}>
              <Truck className="w-4 h-4 mr-1" />
              {getDriverChip().text}
            </span>
            
            {/* Speaker status chip */}
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border cursor-pointer hover:opacity-80 ${getSpeakerChip().className}`}>
              <User className="w-4 h-4 mr-1" />
              {getSpeakerChip().text}
            </span>
            
            {/* Van requirement chip */}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200">
              <Truck className="w-4 h-4 mr-1" />
              {getVanStatus()}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Section 1 - "Where & who" */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Where & who</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Event Location */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Event Location</label>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  {(request as any).eventAddress ? (
                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent((request as any).eventAddress)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {(request as any).eventAddress}
                    </a>
                  ) : (
                    <span className="text-gray-500 text-sm">No address provided</span>
                  )}
                </div>
              </div>
              
              {/* Primary Contact */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Primary Contact</label>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">{request.firstName} {request.lastName}</span>
                  </div>
                  <div className="flex items-center space-x-2 ml-6">
                    <button 
                      onClick={() => navigator.clipboard?.writeText(request.phone || '')}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {request.phone || 'No phone'}
                    </button>
                    <span className="text-gray-400">•</span>
                    <button 
                      onClick={() => navigator.clipboard?.writeText(request.email || '')}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {request.email || 'No email'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Toolkit Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Toolkit Status</label>
                <div className="flex items-center space-x-2">
                  {(() => {
                    const status = (request as any).toolkitStatus || "not_sent";
                    if (status === "sent" || status === "received_confirmed") {
                      return (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          ✓ Delivered
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
          
          {/* Section 2 - "Plan at a glance" (Timeline) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Plan at a glance</h3>
            
            {/* Timeline Visualization */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-5 items-center gap-2">
                {/* Leg 1: Pickup @ Event */}
                <div className="text-center">
                  <div className="bg-blue-100 rounded-lg p-3 border border-blue-200">
                    <MapPin className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                    <div className="text-xs font-medium text-blue-800">Pickup @ Event</div>
                    <div className="text-xs text-blue-600">
                      {(request as any).pickupTime ? formatTime((request as any).pickupTime) : 'TBD'}
                    </div>
                    {/* Driver assignment for leg 1 */}
                    <div className="mt-2">
                      {driverIds.length > 0 ? (
                        <div className="bg-blue-200 rounded-full px-2 py-1 text-xs text-blue-800">
                          {getUserDisplayName(driverIds[0])}
                        </div>
                      ) : (
                        <button className="bg-gray-200 hover:bg-gray-300 rounded-full px-2 py-1 text-xs text-gray-600">
                          Assign driver
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Arrow */}
                <div className="flex justify-center">
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                
                {/* Destination Node */}
                <div className="text-center">
                  {pathType === 'overnight' ? (
                    <div className="bg-purple-100 rounded-lg p-3 border border-purple-200">
                      <Home className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                      <div className="text-xs font-medium text-purple-800">Host (Overnight)</div>
                      <div className="text-xs text-purple-600">
                        {(request as any).storageLocation || 'Storage location'}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-100 rounded-lg p-3 border border-green-200">
                      <Building className="w-5 h-5 mx-auto text-green-600 mb-1" />
                      <div className="text-xs font-medium text-green-800">Recipient (Same-day)</div>
                      <div className="text-xs text-green-600">
                        {(request as any).deliveryDestination || 'Direct delivery'}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Second Arrow (only for overnight) */}
                {pathType === 'overnight' && (
                  <div className="flex justify-center">
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                
                {/* Leg 2: Next-day delivery (only for overnight) */}
                {pathType === 'overnight' && (
                  <div className="text-center">
                    <div className="bg-green-100 rounded-lg p-3 border border-green-200">
                      <Building className="w-5 h-5 mx-auto text-green-600 mb-1" />
                      <div className="text-xs font-medium text-green-800">Next-day delivery</div>
                      <div className="text-xs text-green-600">
                        {(request as any).deliveryDestination || 'Recipient location'}
                      </div>
                      {/* Driver assignment for leg 2 */}
                      <div className="mt-2">
                        {driverIds.length > 1 ? (
                          <div className="bg-green-200 rounded-full px-2 py-1 text-xs text-green-800">
                            {getUserDisplayName(driverIds[1])}
                          </div>
                        ) : (
                          <button className="bg-gray-200 hover:bg-gray-300 rounded-full px-2 py-1 text-xs text-gray-600">
                            Assign driver
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Connection indicator for overnight */}
              {pathType === 'overnight' && (
                <div className="flex items-center justify-center mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <Moon className="w-4 h-4" />
                    <span>Overnight at {(request as any).storageLocation || 'host location'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Section 3 - Actions (Primary buttons) */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Actions</h3>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="default" 
                size="sm"
                className="bg-[#236383] hover:bg-[#1e5470] text-white"
                onClick={() => {
                  // TODO: Add driver self-assignment
                  console.log("I'll Drive clicked for event:", request.id);
                }}
              >
                <Truck className="w-4 h-4 mr-2" />
                I'll Drive
              </Button>
              
              <Button 
                variant="default" 
                size="sm"
                className="bg-[#FBAD3F] hover:bg-[#e89d35] text-white"
                onClick={() => {
                  // TODO: Add speaker self-assignment
                  console.log("I'll Speak clicked for event:", request.id);
                }}
              >
                <User className="w-4 h-4 mr-2" />
                I'll Speak
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="border-gray-300 hover:bg-gray-50"
                onClick={() => {
                  // TODO: Open assignment modal
                  console.log("Assign clicked for event:", request.id);
                }}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Assign…
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="border-gray-300 hover:bg-gray-50"
                onClick={() => {
                  // TODO: Open message group functionality
                  console.log("Message group clicked for event:", request.id);
                }}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message group
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                onClick={() => {
                  // TODO: Toggle edit mode
                  console.log("Edit mode clicked for event:", request.id);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Details
              </Button>
            </div>
          </div>
          
          {/* Section 4 - Planning notes (editable) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <span className="text-lg font-semibold text-gray-900">Planning Notes</span>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  // TODO: Implement inline editing for planning notes
                  console.log("Edit planning notes for event:", request.id);
                }}
                className="text-[#236383] hover:bg-[#236383] hover:text-white"
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </div>
            
            {/* Notes content - clickable to edit */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div 
                className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-2 rounded border-dashed border-2 border-transparent hover:border-[#236383] transition-all"
                onClick={() => {
                  // TODO: Toggle to edit mode
                  console.log("Click to edit notes for event:", request.id);
                }}
              >
                {(request as any).planningNotes ? (
                  <div className="whitespace-pre-wrap">{(request as any).planningNotes}</div>
                ) : (
                  <div className="text-gray-500 italic">Click to add planning notes...</div>
                )}
              </div>
              
              {/* System notes */}
              <div className="text-xs text-gray-500 border-t border-gray-200 pt-2 mt-2">
                <div className="space-y-1">
                  {driverIds.length > 0 && (
                    <div>🚗 Driver: {getUserDisplayName(driverIds[0])}</div>
                  )}
                  {speakerIds.length > 0 && (
                    <div>🎤 Speaker: {getUserDisplayName(speakerIds[0])}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    Last updated: {request.updatedAt ? formatEventDate(request.updatedAt) : 'Never'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
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
            </CardTitle>
            <div className="space-y-2">{/* Placeholder content - will fix later */}</div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  // Function to render past event cards  
  const renderPastEventCard = (request: EventRequest) => (
    <Card
      key={request.id}
      className="hover:shadow-lg transition-all duration-200"
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold">
              {request.organizationName}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  // Main component JSX return statement
  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Event Requests Management</h1>
            <p className="text-muted-foreground">
              Manage sandwich event requests and track their progress
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="requests">New Requests</TabsTrigger>
            <TabsTrigger value="followed-up">Followed Up</TabsTrigger>
            <TabsTrigger value="in-process">In Process</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="past">Past Events</TabsTrigger>
            <TabsTrigger value="system">System Management</TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                {filteredRequests.length > 0 
                  ? `Showing ${filteredRequests.length} scheduled event${filteredRequests.length !== 1 ? "s" : ""}`
                  : "No scheduled events found."}
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

          <TabsContent value="requests">
            <div className="text-center py-8">
              <p className="text-gray-500">Other tabs will be restored here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

/* 
 * Note: This file was cleaned up to fix syntax errors. 
 * The new scheduled event card is implemented above.
 * Other functionality needs to be restored.
 */
